import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAssessmentList, getLiveTracking, getLiveTrackingLite, getRedisPartials, flushPartialToDb, getRedisPartialDetail, submitFromRedis } from "./API/LiveTracking_APIs";
import { showErrorToast } from '../../utils/toast';

/* ─── Types ─── */

interface StudentEntry {
  userStudentId: number;
  studentName: string;
  email?: string;
  instituteName: string;
  status: string;
  answeredCount: number;
  currentPage?: string | null;
  currentSection?: string | null;
  currentQuestionIndex?: number | null;
  lastSeen?: string | null;
  isLive?: boolean;
}

interface Summary {
  total: number;
  notStarted: number;
  ongoing: number;
  completed: number;
}

interface TrackingData {
  assessmentId: number;
  assessmentName: string;
  totalQuestions: number;
  students: StudentEntry[];
  summary: Summary;
}

interface AssessmentOption {
  id: number;
  assessmentName: string;
  isActive: boolean;
}

interface RedisPartialEntry {
  userStudentId: number;
  assessmentId: number;
  studentName: string;
  answerCount: number;
  ttlSeconds: number;
  savedAt: string | null;
}

/* ─── Adaptive polling config ─── */
const POLL_FAST = 8_000;   // 8s when there are active students
const POLL_SLOW = 25_000;  // 25s when idle (all notstarted or all completed)
const POLL_MIN = 5_000;    // floor when user manually refreshes

/* ─── Status badge ─── */
const statusBadge = (status: string) => {
  switch (status) {
    case "ongoing":
      return (
        <span className="badge bg-warning text-dark px-3 py-2">
          In Progress
        </span>
      );
    case "completed":
      return (
        <span className="badge bg-success px-3 py-2">Completed</span>
      );
    default:
      return (
        <span className="badge bg-secondary px-3 py-2">Not Started</span>
      );
  }
};

/* ─── Current position label ─── */
const CurrentPosition = ({ student }: { student: StudentEntry }) => {
  if (student.status !== "ongoing") return null;
  if (!student.currentPage) {
    return <small className="text-muted fst-italic">No signal</small>;
  }

  const pageLabels: Record<string, string> = {
    question: "Question",
    "section-select": "Selecting Section",
    instructions: "Reading Instructions",
    "section-instructions": "Section Instructions",
    demographics: "Demographics Form",
  };

  const label = pageLabels[student.currentPage] || student.currentPage;

  if (student.currentPage === "question") {
    const qNum =
      student.currentQuestionIndex != null
        ? Number(student.currentQuestionIndex) + 1
        : "?";
    const section = student.currentSection || "";
    return (
      <div>
        <small className="fw-semibold">
          Q{qNum}
        </small>
        {section && (
          <small className="text-muted ms-1">({section})</small>
        )}
      </div>
    );
  }

  return <small className="text-muted">{label}</small>;
};

/* ─── Progress bar (lightweight, no chart library) ─── */
const ProgressBar = ({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) => {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="d-flex align-items-center gap-2" style={{ minWidth: 160 }}>
      <div
        className="progress flex-grow-1"
        style={{ height: 8, backgroundColor: "#e9ecef" }}
      >
        <div
          className="progress-bar"
          role="progressbar"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? "#198754" : "#0d6efd",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <small className="text-muted" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
        {answered}/{total} ({pct}%)
      </small>
    </div>
  );
};

/* ─── Summary cards ─── */
const SummaryCards = ({ summary }: { summary: Summary }) => {
  const cards = [
    { label: "Total Students", value: summary.total, color: "#6c757d" },
    { label: "Not Started", value: summary.notStarted, color: "#adb5bd" },
    { label: "In Progress", value: summary.ongoing, color: "#ffc107" },
    { label: "Completed", value: summary.completed, color: "#198754" },
  ];
  return (
    <div className="row g-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="col-6 col-md-3">
          <div
            className="card border-0 text-center py-3"
            style={{ backgroundColor: c.color + "18" }}
          >
            <div className="fw-bold fs-2" style={{ color: c.color }}>
              {c.value}
            </div>
            <small className="text-muted">{c.label}</small>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Main component ─── */
const LiveTrackingPage = () => {
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterInstitute, setFilterInstitute] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPolling, setIsPolling] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "redis">("live");
  const [redisPartials, setRedisPartials] = useState<RedisPartialEntry[]>([]);
  const [redisLoading, setRedisLoading] = useState(false);
  const [flushingIds, setFlushingIds] = useState<Set<number>>(new Set());
  const [flushingAll, setFlushingAll] = useState(false);
  const [redisJsonModal, setRedisJsonModal] = useState<{
    show: boolean; studentName: string; data: any;
  }>({ show: false, studentName: "", data: null });
  const [submittingIds, setSubmittingIds] = useState<Set<number>>(new Set());

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataRef = useRef<string>("");
  // High watermark: progress & position should never go backwards per student
  const progressHighWaterRef = useRef<Record<number, number>>({});
  // Cache last known position so heartbeat gaps don't flash "No signal"
  const positionCacheRef = useRef<Record<number, {
    currentPage: string;
    currentSection?: string | null;
    currentQuestionIndex?: number | null;
  }>>({});

  // Load assessment list on mount
  useEffect(() => {
    getAssessmentList()
      .then((res) => {
        const list: AssessmentOption[] = res.data || [];
        setAssessments(list);
        // Auto-select first active assessment
        const active = list.find((a) => a.isActive);
        if (active) setSelectedId(active.id);
      })
      .catch(() => setError("Failed to load assessments"));
  }, []);

  // Track whether we've already loaded lite data for the current assessment
  const liteLoadedRef = useRef<number | null>(null);

  // Fetch tracking data: lite first (instant), then full in background
  const fetchData = useCallback(async () => {
    if (!selectedId) return;

    // On first load for this assessment, fetch lite data instantly
    if (liteLoadedRef.current !== selectedId) {
      try {
        const liteRes = await getLiveTrackingLite(selectedId);
        const lite = liteRes.data;
        // Build a TrackingData with lite fields — no progress/position yet
        const liteData: TrackingData = {
          assessmentId: lite.assessmentId,
          assessmentName: lite.assessmentName,
          totalQuestions: 0,
          students: (lite.students || []).map((s: any) => ({
            userStudentId: s.userStudentId,
            studentName: s.studentName,
            email: s.email || "",
            instituteName: "",
            status: s.status || "notstarted",
            answeredCount: 0,
          })),
          summary: lite.summary || { total: 0, notStarted: 0, ongoing: 0, completed: 0 },
        };
        setData(liteData);
        setLoading(false);
        liteLoadedRef.current = selectedId;
      } catch {
        // If lite fails, fall through to full fetch
      }
    }

    // Then fetch full data (with progress, heartbeats, answer counts)
    try {
      const res = await getLiveTracking(selectedId);
      const newData: TrackingData = res.data;

      // Preserve email from lite data if full response doesn't include it
      if (data) {
        const emailMap = new Map(data.students.map(s => [s.userStudentId, s.email]));
        for (const s of newData.students) {
          if (!s.email && emailMap.has(s.userStudentId)) {
            s.email = emailMap.get(s.userStudentId);
          }
        }
      }

      // High watermark logic for ongoing students:
      // - Progress never drops (answers are in localStorage until submission)
      // - Position sticks to last known value during heartbeat gaps
      const hw = progressHighWaterRef.current;
      const pc = positionCacheRef.current;
      for (const s of newData.students) {
        if (s.status === "ongoing") {
          // Progress watermark
          const prev = hw[s.userStudentId] ?? 0;
          if (s.answeredCount >= prev) {
            hw[s.userStudentId] = s.answeredCount;
          } else {
            s.answeredCount = prev;
          }

          // Position cache: update when we have fresh data, restore when gap
          if (s.currentPage) {
            pc[s.userStudentId] = {
              currentPage: s.currentPage,
              currentSection: s.currentSection,
              currentQuestionIndex: s.currentQuestionIndex,
            };
          } else if (pc[s.userStudentId]) {
            // Heartbeat expired — show last known position instead of "No signal"
            s.currentPage = pc[s.userStudentId].currentPage;
            s.currentSection = pc[s.userStudentId].currentSection;
            s.currentQuestionIndex = pc[s.userStudentId].currentQuestionIndex;
          }
        } else {
          // Student completed or not started — reset caches
          delete hw[s.userStudentId];
          delete pc[s.userStudentId];
        }
      }

      // Only update state if data actually changed (prevents unnecessary re-renders)
      const serialized = JSON.stringify(newData);
      if (serialized !== prevDataRef.current) {
        prevDataRef.current = serialized;
        setData(newData);
      }
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      // Don't show error if lite data already loaded (user can see names/emails)
      if (liteLoadedRef.current !== selectedId) {
        setError("Failed to load tracking data. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // Adaptive polling interval
  const getInterval = useCallback((): number => {
    if (!data) return POLL_FAST;
    const { ongoing } = data.summary;
    return ongoing > 0 ? POLL_FAST : POLL_SLOW;
  }, [data]);

  // Polling loop
  useEffect(() => {
    if (!selectedId || !isPolling) return;

    setLoading(true);
    fetchData();

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        fetchData().then(schedule);
      }, getInterval());
    };
    schedule();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [selectedId, isPolling, fetchData, getInterval]);

  // Manual refresh
  const handleRefresh = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(true);
    fetchData();
  };

  // Handle assessment change
  const handleAssessmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelectedId(id || null);
    setData(null);
    prevDataRef.current = "";
    progressHighWaterRef.current = {};
    positionCacheRef.current = {};
    liteLoadedRef.current = null;
    setFilterStatus("all");
    setFilterInstitute("all");
    setSearchQuery("");
  };

  // Fetch Redis partials when tab switches or assessment changes
  const fetchRedisPartials = useCallback(async () => {
    setRedisLoading(true);
    try {
      const res = await getRedisPartials(selectedId ?? undefined);
      setRedisPartials(res.data || []);
    } catch {
      setRedisPartials([]);
    } finally {
      setRedisLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (activeTab === "redis") {
      fetchRedisPartials();
    }
  }, [activeTab, selectedId, fetchRedisPartials]);

  // Flush a single student's partial answers to DB
  const handleFlushOne = async (studentId: number, assessmentId: number) => {
    setFlushingIds((prev) => new Set(prev).add(studentId));
    try {
      await flushPartialToDb({ userStudentId: studentId, assessmentId });
      await fetchRedisPartials();
    } catch (err) {
      console.error("Flush failed", err);
    } finally {
      setFlushingIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  // Flush all partial answers for the selected assessment
  const handleFlushAll = async () => {
    if (!selectedId) return;
    setFlushingAll(true);
    try {
      await flushPartialToDb({ assessmentId: selectedId });
      await fetchRedisPartials();
    } catch (err) {
      console.error("Flush all failed", err);
    } finally {
      setFlushingAll(false);
    }
  };

  // View raw Redis JSON for a student's partial answers
  const handleViewRedisJson = async (entry: RedisPartialEntry) => {
    try {
      const res = await getRedisPartialDetail(entry.userStudentId, entry.assessmentId);
      setRedisJsonModal({ show: true, studentName: entry.studentName, data: res.data });
    } catch (err) {
      console.error("Failed to fetch Redis detail", err);
      showErrorToast("Failed to load Redis data");
    }
  };

  // Admin submit: trigger async submission pipeline from Redis partial answers
  const handleSubmitFromRedis = async (entry: RedisPartialEntry) => {
    setSubmittingIds((prev) => new Set(prev).add(entry.userStudentId));
    try {
      await submitFromRedis(entry.userStudentId, entry.assessmentId);
      await fetchRedisPartials();
    } catch (err: any) {
      console.error("Submit from Redis failed", err);
      const msg = err?.response?.data?.error || err?.response?.data || "Submit failed";
      showErrorToast(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.userStudentId);
        return next;
      });
    }
  };

  // Format TTL for display
  const formatTtl = (seconds: number) => {
    if (seconds < 0) return "Unknown";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Unique institute names for filter dropdown
  const instituteOptions = useMemo(() => {
    if (!data) return [];
    const names = new Set(
      data.students.map((s) => s.instituteName).filter(Boolean)
    );
    return Array.from(names).sort();
  }, [data]);

  // Filtered & searched students (memoized to avoid re-computation)
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    let list = data.students;

    if (filterStatus !== "all") {
      list = list.filter((s) => s.status === filterStatus);
    }

    if (filterInstitute !== "all") {
      list = list.filter((s) => s.instituteName === filterInstitute);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.instituteName?.toLowerCase().includes(q) ||
          String(s.userStudentId).includes(q)
      );
    }

    // Sort: ongoing first, then notstarted, then completed
    const order: Record<string, number> = { ongoing: 0, notstarted: 1, completed: 2 };
    return [...list].sort(
      (a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1)
    );
  }, [data, filterStatus, filterInstitute, searchQuery]);

  return (
    <div className="card">
      <div className="card-header border-0 pt-6" style={{ overflow: "visible" }}>
        <div className="d-flex flex-wrap align-items-center w-100 gap-3">
          <h1 className="mb-0 fs-3 me-auto">Live Assessment Tracking</h1>

          {/* Polling indicator */}
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: isPolling ? "#198754" : "#dc3545",
                animation: isPolling ? "pulse 2s infinite" : "none",
              }}
            />
            <small className="text-muted">
              {isPolling ? "Live" : "Paused"}
            </small>
          </div>

          <button
            className={`btn btn-sm ${isPolling ? "btn-outline-secondary" : "btn-outline-success"}`}
            onClick={() => setIsPolling(!isPolling)}
          >
            {isPolling ? "Pause" : "Resume"}
          </button>

          <button
            className="btn btn-sm btn-outline-primary"
            onClick={handleRefresh}
            disabled={loading || !selectedId}
          >
            {loading ? (
              <span
                className="spinner-border spinner-border-sm me-1"
                role="status"
              />
            ) : null}
            Refresh
          </button>
        </div>
      </div>

      <div className="card-body pt-4">
        {/* Assessment selector */}
        <div className="row mb-4">
          <div className="col-md-6 col-lg-4">
            <label className="form-label fw-semibold">Select Assessment</label>
            <select
              className="form-select"
              value={selectedId ?? ""}
              onChange={handleAssessmentChange}
            >
              <option value="">-- Choose Assessment --</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assessmentName} {a.isActive ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>
          {lastUpdated && (
            <div className="col-md-6 col-lg-4 d-flex align-items-end">
              <small className="text-muted">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </small>
            </div>
          )}
        </div>

        {/* Tab toggle */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "live" ? "active" : ""}`}
              onClick={() => setActiveTab("live")}
            >
              Live Progress
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "redis" ? "active" : ""}`}
              onClick={() => setActiveTab("redis")}
            >
              Redis Buffered Answers
              {redisPartials.length > 0 && (
                <span className="badge bg-info ms-2">{redisPartials.length}</span>
              )}
            </button>
          </li>
        </ul>

        {error && (
          <div className="alert alert-warning py-2">{error}</div>
        )}

        {!selectedId && !error && (
          <div className="text-center text-muted py-5">
            Select an assessment to start tracking
          </div>
        )}

        {/* ─── Live Progress Tab ─── */}
        {activeTab === "live" && data && (
          <>
            {/* Summary cards */}
            <SummaryCards summary={data.summary} />

            {/* Completion progress */}
            <div className="mb-4">
              <div className="d-flex justify-content-between mb-1">
                <small className="fw-semibold">Overall Completion</small>
                <small className="text-muted">
                  {data.summary.completed} / {data.summary.total} students
                </small>
              </div>
              <div className="progress" style={{ height: 12 }}>
                <div
                  className="progress-bar bg-success"
                  style={{
                    width: `${data.summary.total > 0
                      ? (data.summary.completed / data.summary.total) * 100
                      : 0}%`,
                    transition: "width 0.5s ease",
                  }}
                />
                <div
                  className="progress-bar bg-warning"
                  style={{
                    width: `${data.summary.total > 0
                      ? (data.summary.ongoing / data.summary.total) * 100
                      : 0}%`,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="d-flex flex-wrap gap-3 mb-3">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: 260 }}
              />
              <select
                className="form-select form-select-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ maxWidth: 180 }}
              >
                <option value="all">All Statuses</option>
                <option value="ongoing">In Progress</option>
                <option value="notstarted">Not Started</option>
                <option value="completed">Completed</option>
              </select>
              {instituteOptions.length > 1 && (
                <select
                  className="form-select form-select-sm"
                  value={filterInstitute}
                  onChange={(e) => setFilterInstitute(e.target.value)}
                  style={{ maxWidth: 240 }}
                >
                  <option value="all">All Institutes</option>
                  {instituteOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <small className="text-muted align-self-center">
                Showing {filteredStudents.length} of {data.students.length}
              </small>
            </div>

            {/* Student table */}
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Institute</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 150 }}>Current Page</th>
                    <th style={{ width: 220 }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        No students match the current filter
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <tr key={s.userStudentId}>
                        <td className="text-muted">{idx + 1}</td>
                        <td>
                          <div className="fw-semibold">{s.studentName}</div>
                          <small className="text-muted">
                            ID: {s.userStudentId}
                          </small>
                        </td>
                        <td>
                          <small>{s.email || ""}</small>
                        </td>
                        <td>
                          <small>{s.instituteName}</small>
                        </td>
                        <td>{statusBadge(s.status)}</td>
                        <td>
                          <CurrentPosition student={s} />
                        </td>
                        <td>
                          <ProgressBar
                            answered={s.answeredCount}
                            total={data.totalQuestions}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── Redis Buffered Answers Tab ─── */}
        {activeTab === "redis" && (
          <>
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={fetchRedisPartials}
                disabled={redisLoading}
              >
                {redisLoading ? (
                  <span className="spinner-border spinner-border-sm me-1" role="status" />
                ) : null}
                Refresh
              </button>
              {redisPartials.length > 0 && (
                <button
                  className="btn btn-sm btn-success"
                  onClick={handleFlushAll}
                  disabled={flushingAll}
                >
                  {flushingAll ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status" />
                  ) : null}
                  Save All to DB ({redisPartials.length})
                </button>
              )}
              <small className="text-muted">
                {redisPartials.length} student{redisPartials.length !== 1 ? "s" : ""} with buffered answers
              </small>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Student</th>
                    <th style={{ width: 100 }}>Answers</th>
                    <th style={{ width: 120 }}>TTL</th>
                    <th style={{ width: 180 }}>Last Saved</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {redisPartials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        {redisLoading ? "Loading..." : "No buffered answers in Redis"}
                      </td>
                    </tr>
                  ) : (
                    redisPartials.map((entry, idx) => (
                      <tr key={`${entry.userStudentId}-${entry.assessmentId}`}>
                        <td className="text-muted">{idx + 1}</td>
                        <td>
                          <div className="fw-semibold">{entry.studentName}</div>
                          <small className="text-muted">ID: {entry.userStudentId}</small>
                        </td>
                        <td>
                          <span
                            className="badge bg-info px-3 py-2"
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewRedisJson(entry)}
                            title="Click to view Redis JSON"
                          >
                            {entry.answerCount}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge px-3 py-2 ${
                              entry.ttlSeconds < 3600
                                ? "bg-warning text-dark"
                                : "bg-success"
                            }`}
                          >
                            {formatTtl(entry.ttlSeconds)}
                          </span>
                        </td>
                        <td>
                          <small className="text-muted">
                            {entry.savedAt
                              ? new Date(entry.savedAt).toLocaleTimeString()
                              : "Unknown"}
                          </small>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleFlushOne(entry.userStudentId, entry.assessmentId)}
                            disabled={flushingIds.has(entry.userStudentId)}
                          >
                            {flushingIds.has(entry.userStudentId) ? (
                              <span className="spinner-border spinner-border-sm me-1" role="status" />
                            ) : null}
                            Save to DB
                          </button>
                          <button
                            className="btn btn-sm btn-outline-warning ms-2"
                            onClick={() => handleSubmitFromRedis(entry)}
                            disabled={submittingIds.has(entry.userStudentId)}
                          >
                            {submittingIds.has(entry.userStudentId) ? (
                              <span className="spinner-border spinner-border-sm me-1" role="status" />
                            ) : null}
                            Submit this Data
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Loading skeleton for initial load */}
        {loading && !data && selectedId && activeTab === "live" && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <div className="text-muted mt-2">Loading tracking data...</div>
          </div>
        )}
      </div>

      {/* Redis JSON Modal */}
      {redisJsonModal.show && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Redis Data &mdash; {redisJsonModal.studentName}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setRedisJsonModal({ show: false, studentName: "", data: null })}
                />
              </div>
              <div className="modal-body">
                <pre style={{ maxHeight: "60vh", overflow: "auto", fontSize: "0.85rem" }}>
                  {JSON.stringify(redisJsonModal.data, null, 2)}
                </pre>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setRedisJsonModal({ show: false, studentName: "", data: null })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation for live indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default LiveTrackingPage;
