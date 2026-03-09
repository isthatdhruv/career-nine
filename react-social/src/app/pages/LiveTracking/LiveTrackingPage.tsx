import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAssessmentList, getLiveTracking } from "./API/LiveTracking_APIs";

/* ─── Types ─── */

interface StudentEntry {
  userStudentId: number;
  studentName: string;
  instituteName: string;
  status: string;
  answeredCount: number;
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
  AssessmentName: string;
  isActive: boolean;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isPolling, setIsPolling] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataRef = useRef<string>("");

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

  // Fetch tracking data
  const fetchData = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await getLiveTracking(selectedId);
      const newData: TrackingData = res.data;

      // Only update state if data actually changed (prevents unnecessary re-renders)
      const serialized = JSON.stringify(newData);
      if (serialized !== prevDataRef.current) {
        prevDataRef.current = serialized;
        setData(newData);
      }
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      // Don't clear existing data on transient errors (important for flaky connections)
      if (!data) {
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
    setFilterStatus("all");
    setSearchQuery("");
  };

  // Filtered & searched students (memoized to avoid re-computation)
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    let list = data.students;

    if (filterStatus !== "all") {
      list = list.filter((s) => s.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName?.toLowerCase().includes(q) ||
          s.instituteName?.toLowerCase().includes(q) ||
          String(s.userStudentId).includes(q)
      );
    }

    // Sort: ongoing first, then notstarted, then completed
    const order: Record<string, number> = { ongoing: 0, notstarted: 1, completed: 2 };
    return [...list].sort(
      (a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1)
    );
  }, [data, filterStatus, searchQuery]);

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="d-flex flex-wrap justify-content-between align-items-center w-100 gap-3">
          <h1 className="mb-0 fs-3">Live Assessment Tracking</h1>
          <div className="d-flex align-items-center gap-3">
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
                  {a.AssessmentName} {a.isActive ? "(Active)" : ""}
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

        {error && (
          <div className="alert alert-warning py-2">{error}</div>
        )}

        {!selectedId && !error && (
          <div className="text-center text-muted py-5">
            Select an assessment to start tracking
          </div>
        )}

        {data && (
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
                    <th>Institute</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 220 }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
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
                          <small>{s.instituteName}</small>
                        </td>
                        <td>{statusBadge(s.status)}</td>
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

        {/* Loading skeleton for initial load */}
        {loading && !data && selectedId && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <div className="text-muted mt-2">Loading tracking data...</div>
          </div>
        )}
      </div>

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
