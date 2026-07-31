import { useEffect, useMemo, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { getAssessmentSummaryList } from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { getAvailableSlots } from "../API/SlotAPI";
import { bookForStudent, getStudentsForAssessment, CompletedStudentRow } from "../API/AdminBookingAPI";

interface AssessmentSummary {
  id: number;
  assessmentName: string;
  isActive?: boolean;
}

interface RawSlot {
  id: number;
  date: string;       // "2026-07-01"
  startTime: string;  // "14:30:00"
  endTime: string;
  mode?: string;      // ONLINE | OFFLINE
}

// One bookable time on a day. Multiple counsellors free at the same time collapse into one
// chip with several candidate slot ids — we try them in order so a slot taken meanwhile falls
// back to another counsellor at the same time (mirrors the student picker).
interface TimeOption {
  key: string;
  startTime: string;
  endTime: string;
  mode?: string;
  candidateIds: number[];
}

interface DayGroup {
  date: string;
  options: TimeOption[];
}

/**
 * Single-student counselling booking. The admin picks an assessment, finds one student who
 * completed it (type-ahead on name/email), picks an available slot, and books it. Reuses the
 * existing booking engine; no email is sent from here.
 */
const SingleStudentBookingPage = () => {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentId, setAssessmentId] = useState<string>("");

  const [students, setStudents] = useState<CompletedStudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentListOpen, setStudentListOpen] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);

  const [weekStart, setWeekStart] = useState<string>(todayIso());
  const [slots, setSlots] = useState<RawSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState<TimeOption | null>(null);
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<any | null>(null);

  useEffect(() => {
    getAssessmentSummaryList()
      .then((res) => {
        const list: AssessmentSummary[] = Array.isArray(res.data) ? res.data : [];
        setAssessments(list.filter((a) => a.isActive !== false));
      })
      .catch(() => setAssessments([]));
  }, []);

  const handleAssessmentChange = (value: string) => {
    setAssessmentId(value);
    setStudents([]);
    setStudentSearch("");
    setStudentId(null);
    setSelected(null);
    setBooked(null);
    setError("");
    if (!value) return;
    setStudentsLoading(true);
    getStudentsForAssessment(Number(value))
      .then((res) => setStudents(Array.isArray(res.data) ? res.data : []))
      .catch((e) => {
        setStudents([]);
        setError(readErr(e, "Could not load students for this assessment."));
      })
      .finally(() => setStudentsLoading(false));
  };

  // Load available slots whenever a student is chosen or the week changes.
  useEffect(() => {
    if (!studentId) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSelected(null);
    getAvailableSlots(weekStart)
      .then((res) => setSlots(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [studentId, weekStart]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const selectedStudent = students.find((s) => s.studentId === studentId);

  // Group slots → days → distinct times (with candidate counsellor slot ids).
  const dayGroups: DayGroup[] = useMemo(() => {
    const byDate = new Map<string, Map<string, TimeOption>>();
    for (const s of slots) {
      const tkey = `${s.startTime}|${s.endTime}|${s.mode || "ONLINE"}`;
      if (!byDate.has(s.date)) byDate.set(s.date, new Map());
      const day = byDate.get(s.date)!;
      if (!day.has(tkey)) {
        day.set(tkey, {
          key: `${s.date}|${tkey}`,
          startTime: s.startTime,
          endTime: s.endTime,
          mode: s.mode,
          candidateIds: [],
        });
      }
      day.get(tkey)!.candidateIds.push(s.id);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, times]) => ({
        date,
        options: Array.from(times.values()).sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [slots]);

  const handleBook = async () => {
    if (!studentId || !selected) return;
    setBusy(true);
    setError("");
    let lastErr: any = null;
    // Try each candidate counsellor slot at the chosen time until one books.
    for (const slotId of selected.candidateIds) {
      try {
        const res = await bookForStudent(studentId, slotId, reason.trim() || undefined);
        setBooked(res.data);
        setBusy(false);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    setBusy(false);
    setError(readErr(lastErr, "Could not book this slot — it may have just been taken. Pick another time."));
    // Refresh slots so a taken time disappears.
    if (studentId) {
      getAvailableSlots(weekStart).then((res) => setSlots(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    }
  };

  const resetForAnother = () => {
    setBooked(null);
    setSelected(null);
    setReason("");
    if (studentId) {
      getAvailableSlots(weekStart).then((res) => setSlots(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    }
  };

  return (
    <div style={card}>
      <h2 style={{ fontWeight: 700, fontSize: "1.3rem", color: "#1e293b", marginBottom: 4 }}>
        Book Counselling for a Student
      </h2>
      <div style={{ fontSize: "0.86rem", color: "#64748b", marginBottom: 20 }}>
        Pick an assessment, find the student, choose an available slot, and book. The student joins
        the session the same way as always (the counsellor verifies a check-in code on the call).
      </div>

      {/* Step 1: assessment */}
      <Label>1 · Assessment</Label>
      <Form.Select value={assessmentId} onChange={(e) => handleAssessmentChange(e.target.value)} style={sel}>
        <option value="">-- Select an assessment --</option>
        {assessments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.assessmentName}
          </option>
        ))}
      </Form.Select>

      {/* Step 2: student type-ahead */}
      {assessmentId && (
        <>
          <Label style={{ marginTop: 20 }}>2 · Student</Label>
          {studentsLoading ? (
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
              <Spinner animation="border" size="sm" /> Loading students…
            </div>
          ) : (
            <div style={{ position: "relative", maxWidth: 480 }}>
              <Form.Control
                type="text"
                placeholder="🔍 Type a name or email…"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setStudentId(null);
                  setStudentListOpen(true);
                }}
                onFocus={() => setStudentListOpen(true)}
                onBlur={() => setTimeout(() => setStudentListOpen(false), 150)}
                style={sel}
              />
              {studentListOpen && students.length > 0 && (
                <div style={comboList}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ padding: "10px 14px", color: "#94a3b8", fontSize: "0.84rem" }}>
                      No students match “{studentSearch.trim()}”
                    </div>
                  ) : (
                    filteredStudents.slice(0, 50).map((s) => (
                      <div
                        key={s.studentId}
                        onMouseDown={() => {
                          setStudentId(s.studentId);
                          setStudentSearch(s.name || "Unnamed");
                          setStudentListOpen(false);
                          setBooked(null);
                        }}
                        style={comboItem}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >
                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.88rem" }}>
                          {s.name || "Unnamed"}
                          {s.hasUpcomingAppointment && (
                            <span style={badge}>already booked</span>
                          )}
                        </div>
                        {s.email && (
                          <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>{s.email}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {!studentsLoading && students.length === 0 && (
            <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: 6 }}>
              No students have completed this assessment yet.
            </div>
          )}
          {selectedStudent && (
            <div style={{ fontSize: "0.78rem", color: "#059669", marginTop: 6 }}>
              ✓ Selected: <strong>{selectedStudent.name || "student"}</strong>
              {selectedStudent.hasUpcomingAppointment && (
                <span style={{ color: "#b45309", marginLeft: 8 }}>
                  — this student already has an upcoming session; booking will add another.
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Step 3: slot picker */}
      {studentId && !booked && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
            <Label style={{ marginBottom: 0 }}>3 · Pick a slot</Label>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={weekStart <= todayIso()}
                onClick={() => setWeekStart(shiftIso(weekStart, -7))}
              >
                ← Earlier
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={() => setWeekStart(shiftIso(weekStart, 7))}>
                Later →
              </Button>
            </div>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "4px 0 12px" }}>
            Showing the week of {fmtDate(weekStart)} across all counsellors.
          </div>

          {slotsLoading ? (
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
              <Spinner animation="border" size="sm" /> Loading slots…
            </div>
          ) : dayGroups.length === 0 ? (
            <div style={{ fontSize: "0.84rem", color: "#94a3b8" }}>
              No available slots this week. Try a later week, or add counsellor availability.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {dayGroups.map((day) => (
                <div key={day.date}>
                  <div style={{ fontWeight: 600, color: "#475569", fontSize: "0.84rem", marginBottom: 8 }}>
                    {fmtDate(day.date)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {day.options.map((opt) => {
                      const isSel = selected?.key === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setSelected(opt)}
                          style={{ ...chip, ...(isSel ? chipSel : {}) }}
                        >
                          {fmtTime(opt.startTime)}
                          <span style={{ fontSize: "0.68rem", opacity: 0.8, marginLeft: 6 }}>
                            {opt.mode === "OFFLINE" ? "In-person" : "Online"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Optional note + confirm */}
          {selected && (
            <div style={{ marginTop: 20 }}>
              <Label>Note (optional)</Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Anything the counsellor should know…"
                style={{ ...sel, maxWidth: 480 }}
              />
              <div style={{ marginTop: 14 }}>
                <Button onClick={handleBook} disabled={busy}>
                  {busy ? (
                    <>
                      <Spinner animation="border" size="sm" /> Booking…
                    </>
                  ) : (
                    `Book ${fmtTime(selected.startTime)} on ${fmtDate(dayGroups.find((d) => d.options.some((o) => o.key === selected.key))?.date || "")}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <div style={errBox}>{error}</div>}

      {/* Success */}
      {booked && (
        <div style={successBox}>
          <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 8 }}>
            ✓ Session booked for {selectedStudent?.name || "the student"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#065f46" }}>
            {booked.slot?.date && (
              <div>
                {fmtDate(booked.slot.date)} at {fmtTime(booked.slot.startTime)} ·{" "}
                {booked.mode === "OFFLINE" ? "In-person" : "Online"}
              </div>
            )}
            {booked.mode !== "OFFLINE" && booked.meetingLink && (
              <div style={{ marginTop: 4, wordBreak: "break-all" }}>
                Meeting link: <a href={booked.meetingLink} target="_blank" rel="noreferrer">{booked.meetingLink}</a>
              </div>
            )}
            {booked.mode === "OFFLINE" && booked.location && (
              <div style={{ marginTop: 4 }}>Venue: {booked.location}</div>
            )}
          </div>
          <Button variant="success" size="sm" style={{ marginTop: 12 }} onClick={resetForAnother}>
            Book another slot
          </Button>
        </div>
      )}
    </div>
  );
};

// ---- date/time helpers -------------------------------------------------------

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const today = todayIso();
  const next = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  return next < today ? today : next;
}
function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtTime(t: string): string {
  if (!t) return "";
  const [h, min] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min)} ${ampm}`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function readErr(e: any, fallback: string): string {
  const d = e?.response?.data;
  if (typeof d === "string" && d) return d;
  if (d?.message) return d.message;
  const status = e?.response?.status;
  return status ? `${fallback} (HTTP ${status})` : fallback;
}

const Label = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <Form.Label
    style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8, display: "block", ...style }}
  >
    {children}
  </Form.Label>
);

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: "26px 28px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  width: "100%",
};
const sel: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  fontSize: "0.9rem",
  maxWidth: 480,
};
const comboList: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 20,
  background: "#fff",
  border: "1.5px solid #e2e8f0",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
  maxHeight: 260,
  overflowY: "auto",
};
const comboItem: React.CSSProperties = {
  padding: "9px 14px",
  cursor: "pointer",
  borderBottom: "1px solid #f1f5f9",
  background: "#fff",
};
const badge: React.CSSProperties = {
  marginLeft: 8,
  fontSize: "0.66rem",
  fontWeight: 600,
  color: "#b45309",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: 6,
  padding: "1px 6px",
};
const chip: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  background: "#fff",
  color: "#1e293b",
  fontSize: "0.84rem",
  fontWeight: 600,
  cursor: "pointer",
};
const chipSel: React.CSSProperties = {
  borderColor: "#2563eb",
  background: "#eff6ff",
  color: "#1d4ed8",
};
const errBox: React.CSSProperties = {
  marginTop: 14,
  padding: "10px 14px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 10,
  color: "#b91c1c",
  fontSize: "0.85rem",
};
const successBox: React.CSSProperties = {
  marginTop: 18,
  background: "#f0fdf4",
  border: "1.5px solid #a7f3d0",
  borderRadius: 12,
  padding: "16px 18px",
};

export default SingleStudentBookingPage;
