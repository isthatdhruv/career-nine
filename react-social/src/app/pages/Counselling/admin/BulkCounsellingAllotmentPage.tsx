import { useEffect, useMemo, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { getAssessmentSummaryList } from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import {
  BookedStudentRow,
  BulkPreview,
  BulkResult,
  StudentBrief,
  getBulkPreview,
  confirmBulkAllot,
  rebookWithCounsellor,
} from "../API/AdminBookingAPI";
import { getActiveCounsellors } from "../API/CounsellorAPI";

interface AssessmentSummary {
  id: number;
  assessmentName: string;
  isActive?: boolean;
}

interface CounsellorOption {
  id: number;
  name: string;
}

/**
 * Bulk counselling allotment. The admin picks an assessment; the page shows two separate,
 * individually-selectable lists of students who completed it:
 *   • "To be booked" — students with no upcoming session (all ticked by default).
 *   • "Already have an upcoming session" — students already booked (none ticked by default;
 *      tick to give them a second session).
 * Confirming books exactly the ticked students into the earliest available counsellor slots —
 * we book what fits and report the rest. No emails are sent from here.
 */
const BulkCounsellingAllotmentPage = () => {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentId, setAssessmentId] = useState<string>("");

  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Two independent selections — to-book (default all) and re-book (default none).
  const [toBookSel, setToBookSel] = useState<Set<number>>(new Set());
  const [rebookSel, setRebookSel] = useState<Set<number>>(new Set());

  // Active counsellors for the "change counsellor" dropdowns.
  const [counsellors, setCounsellors] = useState<CounsellorOption[]>([]);
  // Per-row counsellor choice in the already-booked list, keyed by appointmentId.
  const [counsellorChoice, setCounsellorChoice] = useState<Record<number, number>>({});
  // The appointmentId currently being rebooked (drives the row spinner).
  const [rebookingId, setRebookingId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAssessmentSummaryList()
      .then((res) => {
        const list: AssessmentSummary[] = Array.isArray(res.data) ? res.data : [];
        setAssessments(list.filter((a) => a.isActive !== false));
      })
      .catch(() => setAssessments([]));

    getActiveCounsellors()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCounsellors(
          list
            .filter((c: any) => c && c.id != null)
            .map((c: any) => ({ id: Number(c.id), name: c.name || `Counsellor #${c.id}` }))
        );
      })
      .catch(() => setCounsellors([]));
  }, []);

  const selectedName = useMemo(
    () => assessments.find((a) => String(a.id) === assessmentId)?.assessmentName || "Assessment",
    [assessments, assessmentId]
  );

  const applyPreview = (p: BulkPreview) => {
    // Guard the shape: a malformed response (e.g. an HTML error page from a backend
    // that doesn't yet serve this endpoint) must not white-screen the page. Reject it
    // here so the caller's catch surfaces a readable error instead of crashing render.
    if (!p || !Array.isArray(p.toBook) || !Array.isArray(p.alreadyBooked)) {
      throw new Error("Unexpected response from the preview endpoint.");
    }
    setPreview(p);
    // To-book selected by default; re-book starts empty.
    setToBookSel(new Set(p.toBook.map((s) => s.studentId)));
    setRebookSel(new Set());
    // Default each already-booked row's dropdown to its current counsellor.
    const choice: Record<number, number> = {};
    for (const r of p.alreadyBooked) {
      if (r.appointmentId != null && r.counsellorId != null) choice[r.appointmentId] = r.counsellorId;
    }
    setCounsellorChoice(choice);
  };

  const handleAssessmentChange = async (value: string) => {
    setAssessmentId(value);
    setPreview(null);
    setResult(null);
    setError("");
    setToBookSel(new Set());
    setRebookSel(new Set());
    if (!value) return;
    setLoadingPreview(true);
    try {
      const res = await getBulkPreview(Number(value));
      applyPreview(res.data);
    } catch (e: any) {
      setError(readErr(e, "Could not load the allotment preview."));
    } finally {
      setLoadingPreview(false);
    }
  };

  const totalSelected = toBookSel.size + rebookSel.size;
  const overflow = preview ? Math.max(0, totalSelected - preview.availableSlotCount) : 0;

  const handleConfirm = async () => {
    if (!assessmentId || !preview) return;
    if (totalSelected === 0) {
      setError("Tick at least one student to book.");
      return;
    }
    const studentIds = [...toBookSel, ...rebookSel];
    const reBookNote =
      rebookSel.size > 0 ? ` (including ${rebookSel.size} re-booking${rebookSel.size === 1 ? "" : "s"})` : "";
    if (
      !window.confirm(
        `Book counselling for ${totalSelected} student${totalSelected === 1 ? "" : "s"}${reBookNote} for "${selectedName}"?\n\n` +
          `Up to ${preview.availableSlotCount} slot${preview.availableSlotCount === 1 ? "" : "s"} are available; any that don't fit will be reported.`
      )
    )
      return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await confirmBulkAllot(Number(assessmentId), studentIds);
      setResult(res.data);
      // Refresh the preview so the lists reflect the new bookings.
      try {
        const p = await getBulkPreview(Number(assessmentId));
        applyPreview(p.data);
      } catch {
        /* keep the result visible even if the refresh fails */
      }
    } catch (e: any) {
      setError(readErr(e, "Bulk allotment failed."));
    } finally {
      setBusy(false);
    }
  };

  // Change counsellor & rebook: move this student's upcoming session onto the earliest
  // available slot of the chosen counsellor, then refresh the preview to show the new
  // counsellor/timing. Distinct from the "2nd session" checkbox below.
  const handleRebook = async (row: BookedStudentRow) => {
    if (!assessmentId || row.appointmentId == null) return;
    const chosen = counsellorChoice[row.appointmentId] ?? row.counsellorId;
    if (!chosen) {
      setError("Pick a counsellor to rebook with.");
      return;
    }
    const counsellorName =
      counsellors.find((c) => c.id === chosen)?.name || `Counsellor #${chosen}`;
    if (
      !window.confirm(
        `Rebook ${row.name || "this student"} with ${counsellorName}?\n\n` +
          `Their current session will be moved to ${counsellorName}'s earliest available slot.`
      )
    )
      return;
    setRebookingId(row.appointmentId);
    setError("");
    try {
      await rebookWithCounsellor(row.appointmentId, chosen);
      // Refresh so the row reflects the new counsellor + timing.
      const p = await getBulkPreview(Number(assessmentId));
      applyPreview(p.data);
    } catch (e: any) {
      setError(readErr(e, "Rebooking failed."));
    } finally {
      setRebookingId(null);
    }
  };

  return (
    <div style={card}>
      <h2 style={{ fontWeight: 700, fontSize: "1.3rem", color: "#1e293b", marginBottom: 4 }}>
        Bulk Counselling Allotment
      </h2>
      <div style={{ fontSize: "0.86rem", color: "#64748b", marginBottom: 20 }}>
        Pick an assessment, choose who to book in each list below, and confirm. Sessions are filled
        into the earliest available slots across all counsellors — we book what fits and report the rest.
      </div>

      <Label>Assessment</Label>
      <Form.Select value={assessmentId} onChange={(e) => handleAssessmentChange(e.target.value)} style={sel}>
        <option value="">-- Select an assessment --</option>
        {assessments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.assessmentName}
          </option>
        ))}
      </Form.Select>

      {loadingPreview && (
        <div style={{ marginTop: 16, color: "#64748b", fontSize: "0.85rem" }}>
          <Spinner animation="border" size="sm" /> Loading preview…
        </div>
      )}

      {preview && !loadingPreview && (
        <>
          {/* Summary stat tiles */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <Stat label="Completed students" value={preview.totalCompleted} />
            <Stat label="Not yet booked" value={preview.toBookCount} accent="#2563eb" />
            <Stat label="Already booked" value={preview.alreadyBookedCount} accent="#b45309" />
            <Stat label="Available slots" value={preview.availableSlotCount} accent="#059669" />
          </div>

          {overflow > 0 && (
            <div style={warnBox}>
              ⚠️ You've selected {totalSelected} student{totalSelected === 1 ? "" : "s"} but only{" "}
              {preview.availableSlotCount} slot{preview.availableSlotCount === 1 ? "" : "s"} are available —{" "}
              <strong>{overflow}</strong> won't fit and will be reported as unbooked. Add more counsellor
              availability or reduce the selection.
            </div>
          )}

          {/* List 1: not yet booked (selected by default) */}
          <SelectableList
            title={`To be booked — not yet booked (${preview.toBook.length})`}
            accent="#2563eb"
            note="All selected by default. Untick anyone you don't want to book."
            rows={preview.toBook}
            selected={toBookSel}
            onToggle={(id) => setToBookSel((p) => toggle(p, id))}
            onToggleAll={() => setToBookSel((p) => toggleAll(p, preview.toBook))}
            emptyText="Everyone who completed this assessment already has a session."
          />

          {/* List 2: already booked — shows the current counsellor + timing, offers a
              counsellor-change rebook per row, and keeps the opt-in "2nd session" checkbox. */}
          <AlreadyBookedList
            title={`Already have an upcoming session (${preview.alreadyBooked.length})`}
            rows={preview.alreadyBooked}
            selected={rebookSel}
            onToggle={(id) => setRebookSel((p) => toggle(p, id))}
            onToggleAll={() => setRebookSel((p) => toggleAll(p, preview.alreadyBooked))}
            counsellors={counsellors}
            counsellorChoice={counsellorChoice}
            onChooseCounsellor={(appointmentId, counsellorId) =>
              setCounsellorChoice((prev) => ({ ...prev, [appointmentId]: counsellorId }))
            }
            onRebook={handleRebook}
            rebookingId={rebookingId}
            emptyText="No students have an upcoming session yet."
          />

          {/* Confirm */}
          <div style={{ marginTop: 22 }}>
            <Button onClick={handleConfirm} disabled={busy || totalSelected === 0}>
              {busy ? (
                <>
                  <Spinner animation="border" size="sm" /> Booking…
                </>
              ) : (
                `Book ${totalSelected} session${totalSelected === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        </>
      )}

      {error && <div style={errBox}>{error}</div>}

      {/* Result report */}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 12 }}>
            Allotment complete — booked {result.bookedCount} of {result.requestedCount}, unbooked{" "}
            {result.unbookedCount}.
          </div>

          <ResultList
            title={`Booked (${result.bookedCount})`}
            color="#059669"
            rows={result.booked.map((b) => ({
              key: b.studentId,
              main: b.name || `#${b.studentId}`,
              sub: [fmtWhen(b.date, b.startTime, b.endTime), b.counsellorName ? `with ${b.counsellorName}` : ""]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
          {result.unbookedCount > 0 && (
            <ResultList
              title={`Unbooked (${result.unbookedCount})`}
              color="#b91c1c"
              rows={result.unbooked.map((b) => ({
                key: b.studentId,
                main: b.name || `#${b.studentId}`,
                sub: b.reason || "",
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ---- selection helpers -------------------------------------------------------

function toggle(prev: Set<number>, id: number): Set<number> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function toggleAll(prev: Set<number>, rows: StudentBrief[]): Set<number> {
  return prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.studentId));
}

// ---- presentational helpers --------------------------------------------------

const SelectableList = ({
  title,
  accent,
  note,
  rows,
  selected,
  onToggle,
  onToggleAll,
  emptyText,
}: {
  title: string;
  accent: string;
  note?: string;
  rows: StudentBrief[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  emptyText: string;
}) => (
  <div style={{ marginTop: 22 }}>
    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: accent, marginBottom: note ? 4 : 8 }}>{title}</div>
    {note && <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 10 }}>{note}</div>}
    {rows.length === 0 ? (
      <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{emptyText}</div>
    ) : (
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={trHead}>
              <th style={th}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    title="Select all"
                    checked={rows.length > 0 && selected.size === rows.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length;
                    }}
                    onChange={onToggleAll}
                  />
                  Book
                </div>
              </th>
              <th style={th}>Student</th>
              <th style={th}>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.studentId} style={trBody}>
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={selected.has(s.studentId)}
                    onChange={() => onToggle(s.studentId)}
                  />
                </td>
                <td style={td}>{s.name || "—"}</td>
                <td style={{ ...td, color: "#94a3b8" }}>{s.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// The "already booked" list: like SelectableList but with the current counsellor + timing
// per row and a per-row "change counsellor & rebook" control. The checkbox is the separate
// opt-in to book a SECOND session (re-book selection), unchanged from before.
const AlreadyBookedList = ({
  title,
  rows,
  selected,
  onToggle,
  onToggleAll,
  counsellors,
  counsellorChoice,
  onChooseCounsellor,
  onRebook,
  rebookingId,
  emptyText,
}: {
  title: string;
  rows: BookedStudentRow[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  counsellors: CounsellorOption[];
  counsellorChoice: Record<number, number>;
  onChooseCounsellor: (appointmentId: number, counsellorId: number) => void;
  onRebook: (row: BookedStudentRow) => void;
  rebookingId: number | null;
  emptyText: string;
}) => (
  <div style={{ marginTop: 22 }}>
    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#b45309", marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 10 }}>
      Each row shows the current session. Use “Change counsellor” to move it to another counsellor's
      earliest slot. Tick “2nd session” only to book an additional session for that student.
    </div>
    {rows.length === 0 ? (
      <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{emptyText}</div>
    ) : (
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={trHead}>
              <th style={th}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    title="Select all"
                    checked={rows.length > 0 && selected.size === rows.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length;
                    }}
                    onChange={onToggleAll}
                  />
                  2nd session
                </div>
              </th>
              <th style={th}>Student</th>
              <th style={th}>Email</th>
              <th style={th}>Booked with</th>
              <th style={th}>When</th>
              <th style={th}>Change counsellor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const apptId = s.appointmentId;
              const options = counsellorOptionsFor(counsellors, s);
              const value = apptId != null ? counsellorChoice[apptId] ?? s.counsellorId ?? "" : "";
              const isRebooking = rebookingId != null && rebookingId === apptId;
              // Rebook is only offered once the session's scheduled time has passed.
              const passed = sessionHasPassed(s.date, s.startTime, s.endTime);
              return (
                <tr key={s.studentId} style={trBody}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={selected.has(s.studentId)}
                      onChange={() => onToggle(s.studentId)}
                    />
                  </td>
                  <td style={td}>{s.name || "—"}</td>
                  <td style={{ ...td, color: "#94a3b8" }}>{s.email || "—"}</td>
                  <td style={td}>{s.counsellorName || "—"}</td>
                  <td style={td}>{fmtWhen(s.date, s.startTime, s.endTime)}</td>
                  <td style={td}>
                    {apptId == null ? (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Form.Select
                            size="sm"
                            value={value}
                            disabled={isRebooking || !passed}
                            onChange={(e) => onChooseCounsellor(apptId, Number(e.target.value))}
                            style={{ minWidth: 160, fontSize: "0.82rem" }}
                          >
                            {options.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Form.Select>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            disabled={isRebooking || !value || !passed}
                            title={!passed ? "Available after the session time has passed" : undefined}
                            onClick={() => onRebook(s)}
                          >
                            {isRebooking ? <Spinner animation="border" size="sm" /> : "Rebook"}
                          </Button>
                        </div>
                        {!passed && (
                          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                            Available after the session time
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// Keep the row's current counsellor selectable even if they're no longer in the active list.
function counsellorOptionsFor(counsellors: CounsellorOption[], row: BookedStudentRow): CounsellorOption[] {
  if (row.counsellorId == null || counsellors.some((c) => c.id === row.counsellorId)) return counsellors;
  return [{ id: row.counsellorId, name: row.counsellorName || `Counsellor #${row.counsellorId}` }, ...counsellors];
}

// True once the session's scheduled time is in the past — uses the end time (so a session in
// progress isn't yet "passed"), falling back to the start time. Gates the rebook action.
function sessionHasPassed(date?: string, start?: string, end?: string): boolean {
  if (!date) return false;
  const time = end || start;
  if (!time) return false;
  const t = new Date(`${date}T${time.length === 5 ? time + ":00" : time}`);
  return !isNaN(t.getTime()) && t.getTime() <= Date.now();
}

// "2026-07-02", "10:00:00", "10:45:00" -> "2 Jul 2026, 10:00–10:45".
function fmtWhen(date?: string, start?: string, end?: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  const datePart = isNaN(d.getTime())
    ? date
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const hhmm = (x?: string) => (x ? x.slice(0, 5) : "");
  const timePart = start ? `${hhmm(start)}${end ? "–" + hhmm(end) : ""}` : "";
  return timePart ? `${datePart}, ${timePart}` : datePart;
}

const Stat = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
  <div style={statTile}>
    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: accent || "#1e293b" }}>{value}</div>
    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{label}</div>
  </div>
);

const ResultList = ({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: { key: number; main: string; sub?: string }[];
}) => (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontWeight: 600, color, fontSize: "0.9rem", marginBottom: 6 }}>{title}</div>
    {rows.length === 0 ? (
      <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>None.</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r) => (
          <div key={r.key} style={resultRow}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{r.main}</span>
            {r.sub && <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{r.sub}</span>}
          </div>
        ))}
      </div>
    )}
  </div>
);

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
const statTile: React.CSSProperties = {
  flex: "1 1 130px",
  minWidth: 120,
  background: "#f8fafc",
  border: "1.5px solid #e2e8f0",
  borderRadius: 12,
  padding: "14px 16px",
};
const warnBox: React.CSSProperties = {
  marginTop: 16,
  padding: "10px 14px",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: 10,
  color: "#92400e",
  fontSize: "0.85rem",
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
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" };
const trHead: React.CSSProperties = { textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" };
const trBody: React.CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px", verticalAlign: "middle" };
const resultRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 10px",
  background: "#f8fafc",
  borderRadius: 8,
};

export default BulkCounsellingAllotmentPage;
