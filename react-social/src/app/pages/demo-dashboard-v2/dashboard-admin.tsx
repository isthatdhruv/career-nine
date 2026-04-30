import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { PageTitle } from "../../../_metronic/layout/core";
import { useThemeMode } from "../../../_metronic/partials/layout/theme-mode/ThemeModeProvider";
import { useAuth } from "../../modules/auth/core/Auth";
import {
  fetchAssessments,
  fetchCounsellingAppointments,
  fetchCounsellorRatingSummary,
  fetchCounsellors,
  fetchGeneratedReports,
  fetchInstitutes,
  fetchLogins,
  fetchStudents,
  fetchStudentsWithMapping,
} from "./dashboard-admin.api";

/* ============================================================
   THEME
   ============================================================ */
type Theme = typeof lightTheme;

const lightTheme = {
  name: "light",
  bg: "#fafafa",
  bgSubtle: "#f4f4f5",
  card: "#ffffff",
  border: "rgba(15, 23, 42, 0.06)",
  borderStrong: "rgba(15, 23, 42, 0.1)",
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  primarySoft: "#eef2ff",
  success: "#10b981",
  successSoft: "#ecfdf5",
  warning: "#f59e0b",
  warningSoft: "#fffbeb",
  danger: "#f43f5e",
  dangerSoft: "#fff1f2",
  info: "#64748b",
  infoSoft: "#f1f5f9",
  purple: "#8b5cf6",
  purpleSoft: "#f5f3ff",
  gridLine: "rgba(15, 23, 42, 0.06)",
  shadow: "0 1px 2px rgba(15,23,42,0.04)",
  shadowHover:
    "0 8px 24px -8px rgba(15,23,42,0.12), 0 2px 6px -2px rgba(15,23,42,0.06)",
  gradientHeader:
    "linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(6,182,212,0.06) 50%, rgba(16,185,129,0.05) 100%)",
};

const darkTheme: Theme = {
  name: "dark",
  bg: "#09090b",
  bgSubtle: "#111113",
  card: "#111113",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.1)",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textSubtle: "#71717a",
  primary: "#818cf8",
  primaryHover: "#a5b4fc",
  primarySoft: "rgba(129, 140, 248, 0.12)",
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.12)",
  warning: "#fbbf24",
  warningSoft: "rgba(251, 191, 36, 0.12)",
  danger: "#fb7185",
  dangerSoft: "rgba(251, 113, 133, 0.12)",
  info: "#94a3b8",
  infoSoft: "rgba(148, 163, 184, 0.12)",
  purple: "#a78bfa",
  purpleSoft: "rgba(167, 139, 250, 0.12)",
  gridLine: "rgba(255,255,255,0.05)",
  shadow: "0 1px 2px rgba(0,0,0,0.3)",
  shadowHover:
    "0 12px 32px -12px rgba(0,0,0,0.55), 0 4px 8px -2px rgba(0,0,0,0.3)",
  gradientHeader:
    "linear-gradient(135deg, rgba(129,140,248,0.12) 0%, rgba(34,211,238,0.08) 50%, rgba(52,211,153,0.06) 100%)",
};

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "purple";

/* ============================================================
   HELPERS
   ============================================================ */
const pick = (obj: any, keys: string[]): any => {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== "") return obj[k];
  return undefined;
};

const fmtNum = (n: number | undefined) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString();

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const relativeTime = (iso: string | undefined): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

/* ============================================================
   PAGE
   ============================================================ */
const DashboardAdminContent: FC = () => {
  const { mode } = useThemeMode();
  const { currentUser, logout } = useAuth();
  const t: Theme = mode === "dark" ? darkTheme : lightTheme;
  const [now, setNow] = useState(new Date());

  // raw data
  const [students, setStudents] = useState<any[]>([]);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [counsellors, setCounsellors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [ratingSummary, setRatingSummary] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [logins, setLogins] = useState<any[]>([]);
  const [loginsLoading, setLoginsLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [studentMappings, setStudentMappings] = useState<any[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refreshing = loading || mappingsLoading || loginsLoading;
  const [manualRefresh, setManualRefresh] = useState(false);

  const handleRefresh = () => {
    if (refreshing) return;
    setManualRefresh(true);
    setRefreshNonce((n) => n + 1);
  };

  // Clear the manual-refresh flag once everything settles
  useEffect(() => {
    if (manualRefresh && !refreshing) {
      const t = setTimeout(() => setManualRefresh(false), 250);
      return () => clearTimeout(t);
    }
  }, [manualRefresh, refreshing]);

  // ---- Date range filter ----
  type RangeKey = "7d" | "30d" | "90d" | "all" | "custom";
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const range = useMemo<{ start: Date | null; end: Date | null }>(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    if (rangeKey === "all") return { start: null, end: null };
    if (rangeKey === "custom") {
      if (!customStart || !customEnd) return { start: null, end: null };
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    const days = rangeKey === "7d" ? 7 : rangeKey === "30d" ? 30 : 90;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [rangeKey, customStart, customEnd]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors({});
    (async () => {
      const calls: { key: string; fn: () => Promise<any[]>; setter: (v: any[]) => void }[] = [
        { key: "students", fn: fetchStudents, setter: setStudents },
        { key: "institutes", fn: fetchInstitutes, setter: setInstitutes },
        { key: "counsellors", fn: fetchCounsellors, setter: setCounsellors },
        { key: "appointments", fn: fetchCounsellingAppointments, setter: setAppointments },
        { key: "ratingSummary", fn: fetchCounsellorRatingSummary, setter: setRatingSummary },
        { key: "assessments", fn: fetchAssessments, setter: setAssessments },
        { key: "reports", fn: fetchGeneratedReports, setter: setReports },
      ];

      const errs: Record<string, string> = {};
      await Promise.all(
        calls.map(async ({ key, fn, setter }) => {
          try {
            const data = await fn();
            if (!cancelled) setter(data);
          } catch (e: any) {
            const status = e?.response?.status;
            const msg = status ? `HTTP ${status}` : e?.message || "request failed";
            errs[key] = msg;
            // eslint-disable-next-line no-console
            console.error(`[admin dashboard] ${key} failed:`, status, e?.response?.data || e);
          }
        })
      );
      if (cancelled) return;
      setErrors(errs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  // Second pass: once institutes are known, fetch student+mapping data per institute
  // and flatten. This unlocks accurate "attempted vs report generated" numbers in the drill-down.
  useEffect(() => {
    if (institutes.length === 0) return;
    let cancelled = false;
    setMappingsLoading(true);
    (async () => {
      const instituteIds = institutes
        .map((i) => pick(i, ["id", "instituteId", "instituteCode"]))
        .filter((v) => v != null);
      const results = await Promise.allSettled(
        instituteIds.map((id) => fetchStudentsWithMapping(id))
      );
      if (cancelled) return;
      const flat: any[] = [];
      results.forEach((r) => {
        if (r.status === "fulfilled") flat.push(...r.value);
      });
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setErrors((prev) => ({
          ...prev,
          mappings: `${failed}/${instituteIds.length} institutes failed`,
        }));
      }
      setStudentMappings(flat);
      setMappingsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [institutes]);

  // Logins: re-fetch whenever the date range changes
  useEffect(() => {
    let cancelled = false;
    setLoginsLoading(true);
    (async () => {
      // Backend requires startDate + endDate. For "All time" fall back to a wide window.
      const end = range.end || new Date();
      const start =
        range.start ||
        (() => {
          const d = new Date(end);
          d.setFullYear(d.getFullYear() - 5);
          return d;
        })();
      try {
        const data = await fetchLogins(toISODate(start), toISODate(end));
        if (!cancelled) {
          setLogins(data);
          setErrors((prev) => {
            const { logins: _omit, ...rest } = prev;
            return rest;
          });
        }
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = status ? `HTTP ${status}` : e?.message || "request failed";
        if (!cancelled) setErrors((prev) => ({ ...prev, logins: msg }));
        // eslint-disable-next-line no-console
        console.error("[admin dashboard] logins failed:", e);
      } finally {
        if (!cancelled) setLoginsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, refreshNonce]);

  const tone = (k: Tone) => {
    switch (k) {
      case "primary": return { solid: t.primary, soft: t.primarySoft };
      case "success": return { solid: t.success, soft: t.successSoft };
      case "warning": return { solid: t.warning, soft: t.warningSoft };
      case "danger": return { solid: t.danger, soft: t.dangerSoft };
      case "info": return { solid: t.info, soft: t.infoSoft };
      case "purple": return { solid: t.purple, soft: t.purpleSoft };
    }
  };

  const greeting = useMemo(() => {
    const h = now.getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, [now]);

  const adminName =
    (currentUser as any)?.name ||
    (currentUser as any)?.username ||
    (currentUser as any)?.email ||
    "Admin";

  const dateDisplay = now.toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  /* Derived series ------------------------------------------- */
  const loginsByDay = useMemo(() => {
    const map = new Map<string, number>();
    const end = range.end || new Date();
    const start =
      range.start ||
      (logins.length > 0
        ? new Date(
            Math.min(
              ...logins
                .map((l) => new Date(pick(l, ["loginTime", "createdAt", "accessTime"]) || 0).getTime())
                .filter((t) => !Number.isNaN(t) && t > 0)
            )
          )
        : (() => {
            const d = new Date(end);
            d.setDate(d.getDate() - 29);
            return d;
          })());
    const dayMs = 86400000;
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    // Cap buckets at ~180 to avoid huge x-axis on "All time"
    const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / dayMs);
    const bucketSize = totalDays > 180 ? Math.ceil(totalDays / 180) : 1;
    for (let t = startDay.getTime(); t <= endDay.getTime(); t += dayMs * bucketSize) {
      map.set(toISODate(new Date(t)), 0);
    }
    logins.forEach((l) => {
      const raw = pick(l, ["loginTime", "createdAt", "accessTime"]);
      if (!raw) return;
      const day = String(raw).slice(0, 10);
      if (bucketSize === 1) {
        if (map.has(day)) map.set(day, (map.get(day) || 0) + 1);
      } else {
        const rowTime = new Date(day).getTime();
        if (Number.isNaN(rowTime)) return;
        const offsetDays = Math.floor((rowTime - startDay.getTime()) / dayMs);
        const bucketIdx = Math.floor(offsetDays / bucketSize);
        const bucketDay = new Date(startDay.getTime() + bucketIdx * bucketSize * dayMs);
        const key = toISODate(bucketDay);
        if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries());
  }, [logins, range]);

  // Reports filtered by date range (client-side — GeneratedReport.createdAt)
  const reportsInRange = useMemo(() => {
    if (!range.start || !range.end) return reports;
    const s = range.start.getTime();
    const e = range.end.getTime();
    return reports.filter((r) => {
      const raw = pick(r, ["createdAt", "created_at", "updatedAt"]);
      if (!raw) return false;
      const t = new Date(raw).getTime();
      return !Number.isNaN(t) && t >= s && t <= e;
    });
  }, [reports, range]);

  const rangeActive = rangeKey !== "all";

  // Student → institute lookup (authoritative from mappings)
  const studentToInstitute = useMemo(() => {
    const m = new Map<string, string>();
    studentMappings.forEach((s) => {
      const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
      const iid = String(pick(s, ["instituteId", "institute_id"]) ?? "");
      if (sid && iid) m.set(sid, iid);
    });
    return m;
  }, [studentMappings]);

  // -----------------------------------------------------------
  // Window-based: "active in range" via AssessmentTable.starDate/endDate
  // This is what "assessment is running during X" actually means.
  // -----------------------------------------------------------
  const activeAssessmentIds = useMemo(() => {
    const ids = new Set<string>();
    if (!rangeActive || !range.start || !range.end) {
      assessments.forEach((a) => {
        const id = pick(a, ["id", "assessmentId"]);
        if (id != null) ids.add(String(id));
      });
      return ids;
    }
    const rStart = range.start.getTime();
    const rEnd = range.end.getTime();
    assessments.forEach((a) => {
      const id = pick(a, ["id", "assessmentId"]);
      if (id == null) return;
      const startStr = pick(a, ["starDate", "startDate"]);
      const endStr = pick(a, ["endDate"]);
      const aStartDate = startStr ? new Date(String(startStr)) : null;
      const aEndDate = endStr ? new Date(String(endStr)) : null;
      // Assessments with no declared window are excluded when a range is active —
      // they have no schedule, so we can't claim they're running in the range.
      if (!aStartDate && !aEndDate) return;
      const aStart =
        aStartDate && !Number.isNaN(aStartDate.getTime()) ? aStartDate.getTime() : -Infinity;
      const aEnd =
        aEndDate && !Number.isNaN(aEndDate.getTime())
          ? aEndDate.getTime() + 86400000 - 1
          : Infinity;
      if (aEnd >= rStart && aStart <= rEnd) ids.add(String(id));
    });
    return ids;
  }, [assessments, rangeActive, range]);

  // Data health: students with reports in range but no current institute mapping
  // (graduated, transferred, or their institute no longer in getAll). Their
  // activity gets silently dropped from institute-level metrics.
  const dataHealth = useMemo(() => {
    const sidsWithReports = new Set<string>();
    reportsInRange.forEach((r) => {
      const nested = r?.userStudent;
      const sid = String(
        (nested && (nested.userStudentId ?? nested.id ?? nested.studentId)) ??
          pick(r, ["userStudentId", "user_student_id"]) ??
          ""
      );
      if (sid) sidsWithReports.add(sid);
    });
    let orphaned = 0;
    sidsWithReports.forEach((sid) => {
      if (!studentToInstitute.has(sid)) orphaned++;
    });
    // Reports in range with missing assessment id
    const reportsWithoutAid = reportsInRange.filter(
      (r) => pick(r, ["assessmentId", "assessment_id"]) == null
    ).length;
    return {
      reportedStudents: sidsWithReports.size,
      orphanedStudents: orphaned,
      reportsWithoutAid,
    };
  }, [reportsInRange, studentToInstitute]);

  // Assessments that have BOTH window overlap AND reports in range.
  // Difference vs activeAssessmentIds shows "scheduled but no report activity".
  const activeWithReportsCount = useMemo(() => {
    const reportedIds = new Set<string>();
    reportsInRange.forEach((r) => {
      const aid = pick(r, ["assessmentId", "assessment_id"]);
      if (aid != null) reportedIds.add(String(aid));
    });
    let count = 0;
    activeAssessmentIds.forEach((aid) => {
      if (reportedIds.has(aid)) count++;
    });
    return count;
  }, [reportsInRange, activeAssessmentIds]);

  // Students who completed any assessment whose window overlaps the range.
  // Mapping rows lack a timestamp, so we infer "in range" via the assessment's
  // scheduled window — honest, accurate when windows are short.
  const completedInRangeStudents = useMemo(() => {
    const ids = new Set<string>();
    if (!rangeActive) return ids;
    studentMappings.forEach((s) => {
      const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
      if (!sid) return;
      const assigned = Array.isArray(s.assessments) ? s.assessments : [];
      for (const m of assigned) {
        const aid = String(pick(m, ["assessmentId", "assessment_id"]) ?? "");
        if (!aid || !activeAssessmentIds.has(aid)) continue;
        const st = String(pick(m, ["status"]) || "").toLowerCase();
        if (st === "completed" || st === "submitted") {
          ids.add(sid);
          break;
        }
      }
    });
    return ids;
  }, [studentMappings, activeAssessmentIds, rangeActive]);

  // -----------------------------------------------------------
  // Report-based sets (precise via GeneratedReport.createdAt)
  // -----------------------------------------------------------
  const reportStudentIds = useMemo(() => {
    const ids = new Set<string>();
    reportsInRange.forEach((r) => {
      const nested = r?.userStudent;
      const sid =
        (nested && (nested.userStudentId ?? nested.id ?? nested.studentId)) ??
        pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"]);
      if (sid != null) ids.add(String(sid));
    });
    return ids;
  }, [reportsInRange]);

  const generatedStudentIds = useMemo(() => {
    const ids = new Set<string>();
    reportsInRange.forEach((r) => {
      const status = String(pick(r, ["reportStatus", "status"]) || "").toLowerCase();
      if (status !== "generated") return;
      const nested = r?.userStudent;
      const sid =
        (nested && (nested.userStudentId ?? nested.id ?? nested.studentId)) ??
        pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"]);
      if (sid != null) ids.add(String(sid));
    });
    return ids;
  }, [reportsInRange]);

  // Union: student is "active in range" if they either completed an
  // assessment whose window overlaps the range OR have a report in range.
  const activeStudentIds = useMemo(() => {
    const ids = new Set<string>();
    completedInRangeStudents.forEach((id) => ids.add(id));
    reportStudentIds.forEach((id) => ids.add(id));
    return ids;
  }, [completedInRangeStudents, reportStudentIds]);

  const activeInstituteIds = useMemo(() => {
    const ids = new Set<string>();
    activeStudentIds.forEach((sid) => {
      const iid = studentToInstitute.get(sid);
      if (iid) ids.add(iid);
    });
    return ids;
  }, [activeStudentIds, studentToInstitute]);

  // Does any active assessment have a window wider than 2× the range?
  // If yes, KPIs that depend on completedInRangeStudents are approximate.
  const hasWindowOvershoot = useMemo(() => {
    if (!rangeActive || !range.start || !range.end) return false;
    const dayMs = 86400000;
    const rangeDays = Math.max(
      Math.round((range.end.getTime() - range.start.getTime()) / dayMs) + 1,
      1
    );
    for (const id of activeAssessmentIds) {
      const a = assessments.find(
        (x) => String(pick(x, ["id", "assessmentId"])) === id
      );
      if (!a) continue;
      const startStr = pick(a, ["starDate", "startDate"]);
      const endStr = pick(a, ["endDate"]);
      if (!startStr || !endStr) continue;
      const aStart = new Date(String(startStr)).getTime();
      const aEnd = new Date(String(endStr)).getTime();
      if (Number.isNaN(aStart) || Number.isNaN(aEnd)) continue;
      const windowDays = Math.round((aEnd - aStart) / dayMs) + 1;
      if (windowDays > rangeDays * 2) return true;
    }
    return false;
  }, [rangeActive, range, activeAssessmentIds, assessments]);

  const overshootTooltip =
    "Some active assessments have scheduling windows wider than your selected range. " +
    "Because the mapping data has no per-student completion timestamp, completions " +
    "spanning the full window are included — this number may overcount versus your exact range.";

  // Per-institute activity summary (used by the institutes table).
  // Combines: window-based completions + report-based generation.
  const institutesActivity = useMemo(() => {
    type Agg = { activeStudents: Set<string>; reportsGenerated: number };
    const m = new Map<string, Agg>();
    const ensure = (iid: string): Agg => {
      let e = m.get(iid);
      if (!e) {
        e = { activeStudents: new Set(), reportsGenerated: 0 };
        m.set(iid, e);
      }
      return e;
    };

    // 1. From completions on assessments active in range
    completedInRangeStudents.forEach((sid) => {
      const iid = studentToInstitute.get(sid);
      if (iid) ensure(iid).activeStudents.add(sid);
    });

    // 2. From GeneratedReport in range (adds reports + active students)
    reportsInRange.forEach((r) => {
      const nested = r?.userStudent;
      const sid = String(
        (nested && (nested.userStudentId ?? nested.id ?? nested.studentId)) ??
          pick(r, ["userStudentId", "user_student_id"]) ??
          ""
      );
      if (!sid) return;
      const iid = studentToInstitute.get(sid);
      if (!iid) return;
      const entry = ensure(iid);
      entry.activeStudents.add(sid);
      const status = String(pick(r, ["reportStatus", "status"]) || "").toLowerCase();
      if (status === "generated") entry.reportsGenerated++;
    });
    return m;
  }, [completedInRangeStudents, reportsInRange, studentToInstitute]);

  const validStudents = useMemo(() => {
    const instituteIds = new Set<string>();
    institutes.forEach((i) => {
      const id = pick(i, ["id", "instituteId"]);
      const code = pick(i, ["instituteCode", "code"]);
      if (id != null) instituteIds.add(String(id));
      if (code != null) instituteIds.add(String(code));
    });
    if (instituteIds.size === 0) return students;
    return students.filter((s) => {
      const sid = pick(s, ["instituteId", "institute_id"]);
      return sid != null && instituteIds.has(String(sid));
    });
  }, [students, institutes]);

  const assessmentStatus = useMemo(() => {
    let active = 0, inactive = 0;
    assessments.forEach((a) => {
      if (pick(a, ["isActive", "active"]) === true) active++;
      else inactive++;
    });
    return { active, inactive };
  }, [assessments]);

  const completionMetrics = useMemo(() => {
    const students = new Set<string>();
    const assessmentsCovered = new Set<string>();
    let totalCompletions = 0;
    studentMappings.forEach((s) => {
      const sid = pick(s, ["userStudentId", "user_student_id", "id"]);
      const assigned = Array.isArray(s.assessments) ? s.assessments : [];
      assigned.forEach((a: any) => {
        const status = String(pick(a, ["status"]) || "").toLowerCase();
        if (status === "completed" || status === "submitted") {
          totalCompletions++;
          if (sid != null) students.add(String(sid));
          const aid = pick(a, ["assessmentId", "assessment_id"]);
          if (aid != null) assessmentsCovered.add(String(aid));
        }
      });
    });
    return {
      students: students.size,
      totalCompletions,
      assessmentsCovered: assessmentsCovered.size,
    };
  }, [studentMappings]);

  const reportMetrics = useMemo(() => {
    let generated = 0;
    let failed = 0;
    let notGenerated = 0;
    const perAssessment = new Map<string | number, { total: number; generated: number }>();

    reportsInRange.forEach((r) => {
      const status = String(pick(r, ["reportStatus", "status"]) || "").toLowerCase();
      if (status === "generated") generated++;
      else if (status === "failed") failed++;
      else notGenerated++;

      const aid = pick(r, ["assessmentId", "assessment_id"]);
      if (aid != null) {
        const entry = perAssessment.get(aid) || { total: 0, generated: 0 };
        entry.total++;
        if (status === "generated") entry.generated++;
        perAssessment.set(aid, entry);
      }
    });

    const nameById = new Map<any, string>();
    assessments.forEach((a) => {
      const id = pick(a, ["id", "assessmentId"]);
      const name =
        pick(a, ["assessmentName", "name", "title"]) || `Assessment #${id ?? "?"}`;
      if (id != null) nameById.set(id, name);
    });

    const rows = Array.from(perAssessment.entries())
      .map(([aid, v]) => ({
        assessmentId: aid,
        name: nameById.get(aid) || `Assessment #${aid}`,
        total: v.total,
        generated: v.generated,
      }))
      .sort((a, b) => b.generated - a.generated);

    return {
      totalConducted: reportsInRange.length,
      generated,
      failed,
      notGenerated,
      rows,
    };
  }, [reportsInRange, assessments]);

  const topInstitutes = useMemo(() => {
    return institutes
      .slice()
      .sort((a, b) => (pick(b, ["id"]) ?? 0) - (pick(a, ["id"]) ?? 0))
      .map((i) => ({
        id: pick(i, ["id"]),
        name:
          pick(i, ["instituteName", "name", "schoolName", "collegeName"]) ||
          "Unnamed institute",
        city: pick(i, ["city", "instituteCity", "location", "state"]) || "—",
        address: pick(i, ["instituteAddress", "address"]) || "",
        active: pick(i, ["isActive", "active", "status"]) !== false,
        branches: Array.isArray(pick(i, ["branches"])) ? pick(i, ["branches"]).length : null,
      }));
  }, [institutes]);

  const recentLogins = useMemo(() => {
    return logins
      .slice()
      .sort((a, b) => {
        const ta = new Date(pick(a, ["loginTime", "createdAt"]) || 0).getTime();
        const tb = new Date(pick(b, ["loginTime", "createdAt"]) || 0).getTime();
        return tb - ta;
      })
      .slice(0, 6);
  }, [logins]);

  return (
    <>
      <PageTitle breadcrumbs={[]}>Admin</PageTitle>

      <DashboardStyles theme={t} />

      <div
        className="ds-root"
        style={{
          background: t.bg,
          color: t.text,
          padding: "24px 32px 64px",
          margin: "-30px -40px -60px",
          minHeight: "100vh",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          fontFeatureSettings: '"cv11", "ss01"',
        }}
      >
        {manualRefresh && refreshing && <div className="ds-refresh-bar" />}
        <Hero
          greeting={greeting}
          name={adminName}
          date={dateDisplay}
          onLogout={logout}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          loading={loading}
          error={
            Object.keys(errors).length > 0
              ? `${Object.keys(errors).length} source(s) failed`
              : null
          }
          quickStats={[
            { label: "Students", value: loading ? "—" : fmtNum(validStudents.length) },
            { label: "Institutes", value: loading ? "—" : fmtNum(institutes.length) },
            { label: "Assessments", value: loading ? "—" : fmtNum(assessments.length) },
          ]}
        />

        <DateRangeBar
          t={t}
          rangeKey={rangeKey}
          setRangeKey={setRangeKey}
          range={range}
          customStart={customStart}
          customEnd={customEnd}
          setCustomStart={setCustomStart}
          setCustomEnd={setCustomEnd}
        />

        {/* KPI GRID */}
        <div className="ds-grid" style={{ marginTop: 24 }}>
          <KpiCard
            t={t}
            tone={tone("primary")}
            icon={<IconUsers />}
            title={rangeActive ? "Students with report" : "Total students"}
            loading={loading}
            value={
              rangeActive
                ? errors.reports
                  ? "—"
                  : fmtNum(generatedStudentIds.size)
                : errors.students
                ? "—"
                : fmtNum(validStudents.length)
            }
            caption={
              loading
                ? "Loading…"
                : rangeActive
                ? errors.reports
                  ? `Failed: ${errors.reports}`
                  : `Distinct students whose report generated in ${rangeLabel(rangeKey, range).toLowerCase()}`
                : errors.students
                ? `Failed: ${errors.students}`
                : `Across ${institutes.length} active institutes`
            }
            errored={rangeActive ? !!errors.reports : !!errors.students}
            dateFiltered={rangeActive}
          />
          <KpiCard
            t={t}
            tone={tone("success")}
            icon={<IconBuilding />}
            title={rangeActive ? "Institutes active" : "Active institutes"}
            loading={loading || (rangeActive && mappingsLoading)}
            value={
              rangeActive
                ? fmtNum(activeInstituteIds.size)
                : errors.institutes
                ? "—"
                : fmtNum(institutes.length)
            }
            caption={
              loading
                ? "Loading…"
                : rangeActive && mappingsLoading
                ? "Loading mappings…"
                : rangeActive
                ? `Institutes with completions or in-range reports`
                : errors.institutes
                ? `Failed: ${errors.institutes}`
                : "Schools & colleges onboarded"
            }
            errored={rangeActive ? false : !!errors.institutes}
            dateFiltered={rangeActive}
            warn={rangeActive && hasWindowOvershoot ? overshootTooltip : undefined}
          />
          <KpiCard
            t={t}
            tone={tone("info")}
            icon={<IconClipboard />}
            title={rangeActive ? "Assessments scheduled" : "Assessments"}
            loading={loading}
            value={
              rangeActive
                ? fmtNum(activeAssessmentIds.size)
                : errors.assessments
                ? "—"
                : fmtNum(assessments.length)
            }
            caption={
              loading
                ? "Loading…"
                : rangeActive
                ? `Scheduled window overlaps ${rangeLabel(rangeKey, range).toLowerCase()}`
                : errors.assessments
                ? `Failed: ${errors.assessments}`
                : `${assessmentStatus.active} active · ${assessmentStatus.inactive} inactive`
            }
            errored={rangeActive ? false : !!errors.assessments}
            dateFiltered={rangeActive}
          />
          <KpiCard
            t={t}
            tone={tone("warning")}
            icon={<IconHeadset />}
            title="Counsellors"
            loading={loading}
            value={errors.counsellors ? "—" : fmtNum(counsellors.length)}
            caption={
              loading
                ? "Loading…"
                : errors.counsellors
                ? `Failed: ${errors.counsellors}`
                : "Available for student guidance · lifetime"
            }
            errored={!!errors.counsellors}
          />
          <KpiCard
            t={t}
            tone={tone("purple")}
            icon={<IconActivity />}
            title="Assessments conducted"
            loading={loading}
            value={errors.reports ? "—" : fmtNum(reportMetrics.totalConducted)}
            caption={
              loading
                ? "Loading…"
                : errors.reports
                ? `Failed: ${errors.reports}`
                : rangeActive
                ? `Reports generated in ${rangeLabel(rangeKey, range).toLowerCase()} · ${reportMetrics.rows.length} distinct assessments`
                : `All time · across ${reportMetrics.rows.length} assessments`
            }
            errored={!!errors.reports}
            dateFiltered={rangeActive}
          />
          <KpiCard
            t={t}
            tone={tone("success")}
            icon={<IconFileCheck />}
            title="Students completed"
            loading={loading || mappingsLoading}
            value={
              rangeActive
                ? fmtNum(completedInRangeStudents.size)
                : errors.mappings
                ? "—"
                : fmtNum(completionMetrics.students)
            }
            caption={
              loading
                ? "Loading…"
                : mappingsLoading
                ? "Loading mappings…"
                : rangeActive
                ? `Lifetime per active assessment · ${fmtNum(generatedStudentIds.size)} got report in range`
                : errors.mappings
                ? `Failed: ${errors.mappings}`
                : `${fmtNum(completionMetrics.totalCompletions)} completions · ${completionMetrics.assessmentsCovered} assessments`
            }
            errored={rangeActive ? false : !!errors.mappings}
            dateFiltered={rangeActive}
            warn={rangeActive && hasWindowOvershoot ? overshootTooltip : undefined}
          />
        </div>

        {/* ENGAGEMENT + ASSESSMENTS DONUT */}
        <div className="ds-two-col" style={{ marginTop: 24 }}>
          <EngagementCard
            t={t}
            series={loginsByDay}
            loading={loading || loginsLoading}
            rangeLabel={rangeLabel(rangeKey, range)}
          />
          <AssessmentBreakdownCard
            t={t}
            rangeActive={rangeActive}
            rangeLabelText={rangeLabel(rangeKey, range)}
            total={assessments.length}
            activeWithReports={rangeActive ? activeWithReportsCount : 0}
            activeWithoutReports={
              rangeActive ? Math.max(activeAssessmentIds.size - activeWithReportsCount, 0) : 0
            }
            dormant={
              rangeActive
                ? Math.max(assessments.length - activeAssessmentIds.size, 0)
                : assessmentStatus.inactive
            }
            lifetimeActive={assessmentStatus.active}
            loading={loading}
          />
        </div>

        {/* ASSESSMENT REPORT DRILL-DOWN */}
        <div style={{ marginTop: 24 }}>
          <AssessmentReportDrilldown
            t={t}
            assessments={assessments}
            institutes={institutes}
            reports={reportsInRange}
            studentMappings={studentMappings}
            mappingsLoading={mappingsLoading}
            loading={loading}
            rangeActive={rangeActive}
            rangeLabelText={rangeLabel(rangeKey, range)}
            rangeStart={range.start}
            rangeEnd={range.end}
            activeAssessmentIds={activeAssessmentIds}
            errored={!!errors.reports || !!errors.assessments}
          />
        </div>

        {/* COUNSELLING DRILL-DOWN */}
        <div style={{ marginTop: 24 }}>
          <CounsellingDrillDownCard
            t={t}
            institutes={institutes}
            studentMappings={studentMappings}
            appointments={appointments}
            mappingsLoading={mappingsLoading}
            loading={loading}
            errored={!!errors.appointments}
          />
        </div>

        {/* COUNSELLOR LEADERBOARD */}
        <div style={{ marginTop: 24 }}>
          <CounsellorLeaderboardCard
            t={t}
            counsellors={counsellors}
            appointments={appointments}
            ratingSummary={ratingSummary}
            loading={loading}
            errored={!!errors.counsellors || !!errors.appointments}
          />
        </div>

        {/* DATA HEALTH */}
        {rangeActive && (dataHealth.orphanedStudents > 0 || dataHealth.reportsWithoutAid > 0) && (
          <div style={{ marginTop: 24 }}>
            <DataHealthRow t={t} health={dataHealth} />
          </div>
        )}

        {/* INSTITUTES TABLE */}
        <div style={{ marginTop: 24 }}>
          <InstitutesTable
            t={t}
            data={topInstitutes}
            loading={loading}
            rangeActive={rangeActive}
            rangeLabelText={rangeLabel(rangeKey, range)}
            activity={institutesActivity}
          />
        </div>

        {/* RECENT LOGINS */}
        <div style={{ marginTop: 24 }}>
          <RecentLoginsCard t={t} logins={recentLogins} loading={loading} tone={tone} />
        </div>
      </div>
    </>
  );
};

/* ============================================================
   TOP BAR
   ============================================================ */
const Hero: FC<{
  greeting: string;
  name: string;
  date: string;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  loading: boolean;
  error: string | null;
  quickStats: { label: string; value: string }[];
}> = ({ greeting, name, date, onLogout, onRefresh, refreshing, loading, error, quickStats }) => (
  <div className="ds-hero">
    <div className="ds-hero-grid" />
    <div className="ds-hero-glow ds-hero-glow-1" />
    <div className="ds-hero-glow ds-hero-glow-2" />
    <div className="ds-hero-glow ds-hero-glow-3" />

    <div className="ds-hero-content">
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          {error ? (
            <span className="ds-hero-pill" style={{ background: "rgba(251,191,36,0.18)", color: "#fde68a" }}>
              <IconAlert /> {error}
            </span>
          ) : (
            <span className="ds-hero-pill" style={{ background: "rgba(52,211,153,0.18)", color: "#a7f3d0" }}>
              <span className="ds-pulse" style={{ background: "#34d399" }} />
              {loading ? "Loading network data…" : "Live network data"}
            </span>
          )}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{date}</span>
        </div>

        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          {greeting},
        </div>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#ffffff",
            margin: "4px 0 0",
            lineHeight: 1.05,
          }}
        >
          {name}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.7)",
            margin: "10px 0 0",
            maxWidth: 520,
          }}
        >
          Here's what's happening across your network — institutes, assessments, and students in one place.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button
            className="ds-btn ds-btn-hero-primary"
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              opacity: refreshing ? 0.75 : 1,
              cursor: refreshing ? "wait" : "pointer",
            }}
          >
            <span
              className={refreshing ? "ds-spin-icon" : ""}
              style={{ display: "inline-flex" }}
            >
              <IconRefresh />
            </span>
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
          <button className="ds-btn ds-btn-hero-ghost" onClick={onLogout}>
            <IconLogout /> Logout
          </button>
        </div>
      </div>

      <div className="ds-hero-stats">
        {quickStats.map((s, i) => (
          <div key={s.label} className="ds-hero-stat" style={{ animationDelay: `${i * 80}ms` }}>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#ffffff",
                fontVariantNumeric: "tabular-nums",
                marginTop: 6,
                letterSpacing: "-0.02em",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ============================================================
   DATE RANGE BAR
   ============================================================ */
const rangeLabel = (
  key: "7d" | "30d" | "90d" | "all" | "custom",
  range: { start: Date | null; end: Date | null }
): string => {
  if (key === "all") return "All time";
  if (key === "7d") return "Last 7 days";
  if (key === "30d") return "Last 30 days";
  if (key === "90d") return "Last 90 days";
  if (!range.start || !range.end) return "Custom";
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
};

const DateRangeBar: FC<{
  t: Theme;
  rangeKey: "7d" | "30d" | "90d" | "all" | "custom";
  setRangeKey: (k: "7d" | "30d" | "90d" | "all" | "custom") => void;
  range: { start: Date | null; end: Date | null };
  customStart: string;
  customEnd: string;
  setCustomStart: (s: string) => void;
  setCustomEnd: (s: string) => void;
}> = ({ t, rangeKey, setRangeKey, range, customStart, customEnd, setCustomStart, setCustomEnd }) => {
  const presets: { key: "7d" | "30d" | "90d" | "all"; label: string }[] = [
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" },
    { key: "90d", label: "Last 90 days" },
    { key: "all", label: "All time" },
  ];

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 18px",
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
        <IconCalendar />
        <span style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Date range</span>
      </div>

      <div className="ds-preset-group" role="tablist">
        {presets.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={rangeKey === p.key}
            className={`ds-preset-btn ${rangeKey === p.key ? "active" : ""}`}
            onClick={() => setRangeKey(p.key)}
          >
            {p.label}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={rangeKey === "custom"}
          className={`ds-preset-btn ${rangeKey === "custom" ? "active" : ""}`}
          onClick={() => setRangeKey("custom")}
        >
          Custom
        </button>
      </div>

      {rangeKey === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="date"
            className="ds-date-input"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span style={{ color: t.textMuted, fontSize: 12 }}>to</span>
          <input
            type="date"
            className="ds-date-input"
            value={customEnd}
            min={customStart || undefined}
            max={toISODate(new Date())}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </div>
      )}

      <div
        style={{
          marginLeft: "auto",
          fontSize: 12,
          color: t.textMuted,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>Showing:</span>
        <span style={{ fontWeight: 700, color: t.text }}>{rangeLabel(rangeKey, range)}</span>
        {range.start && range.end && rangeKey !== "custom" && (
          <span style={{ color: t.textSubtle }}>
            ({range.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – {range.end.toLocaleDateString(undefined, { day: "numeric", month: "short" })})
          </span>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   KPI CARD
   ============================================================ */
const Spinner: FC<{ color: string; size?: number }> = ({ color, size = 22 }) => (
  <span
    className="ds-spinner"
    style={{
      width: size,
      height: size,
      borderColor: `${color}26`,
      borderTopColor: color,
    }}
  />
);

const KpiCard: FC<{
  t: Theme;
  tone: { solid: string; soft: string };
  icon: ReactNode;
  title: string;
  value: string;
  caption: string;
  loading?: boolean;
  errored?: boolean;
  dateFiltered?: boolean;
  warn?: string;
}> = ({ t, tone, icon, title, value, caption, loading, errored, dateFiltered, warn }) => (
  <div
    className="ds-card ds-kpi-card"
    style={{
      background: t.card,
      border: `1px solid ${errored ? t.dangerSoft : t.border}`,
      borderRadius: 16,
      padding: "22px 22px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      minHeight: 148,
      position: "relative",
      overflow: "hidden",
      // @ts-ignore — CSS custom prop for hover glow
      ["--kpi-tone" as any]: tone.solid,
    }}
  >
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${tone.solid}, ${tone.solid}00 80%)`,
        opacity: errored ? 0 : 0.9,
      }}
    />
    {(dateFiltered || warn) && (
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {warn && (
          <span
            title={warn}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: t.warning,
              background: t.warningSoft,
              padding: "2px 7px",
              borderRadius: 100,
              letterSpacing: "0.02em",
              cursor: "help",
            }}
          >
            <IconAlert />
            APPROX
          </span>
        )}
        {dateFiltered && (
          <span
            title="Affected by date range filter"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: t.primary,
              background: t.primarySoft,
              padding: "2px 7px",
              borderRadius: 100,
              letterSpacing: "0.02em",
            }}
          >
            <IconClock />
            IN RANGE
          </span>
        )}
      </div>
    )}
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: errored
          ? t.dangerSoft
          : `linear-gradient(135deg, ${tone.soft}, ${tone.soft}66)`,
        color: errored ? t.danger : tone.solid,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: errored ? "none" : `inset 0 0 0 1px ${tone.solid}1a`,
      }}
    >
      {errored ? <IconAlert /> : icon}
    </div>
    <div>
      <div
        style={{
          fontSize: 11,
          color: t.textMuted,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: t.text,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.05,
          minHeight: 40,
          display: "flex",
          alignItems: "center",
        }}
      >
        {loading ? <Spinner color={tone.solid} size={24} /> : value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: errored ? t.danger : t.textMuted,
          marginTop: 8,
          lineHeight: 1.4,
        }}
      >
        {caption}
      </div>
    </div>
  </div>
);

/* ============================================================
   ENGAGEMENT CHART
   ============================================================ */
const EngagementCard: FC<{
  t: Theme;
  series: [string, number][];
  loading: boolean;
  rangeLabel: string;
}> = ({ t, series, loading, rangeLabel }) => {
  const totalLogins = series.reduce((sum, [, v]) => sum + v, 0);
  const peak = series.reduce((max, [, v]) => Math.max(max, v), 0);

  const opts: ApexOptions = {
    chart: {
      type: "area",
      fontFamily: "inherit",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { easing: "easeinout", speed: 400 },
    },
    colors: [t.primary],
    stroke: { curve: "smooth", width: 2.5 },
    dataLabels: { enabled: false },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] },
    },
    grid: { borderColor: t.gridLine, strokeDashArray: 4, padding: { left: 0, right: 0 } },
    xaxis: {
      categories: series.map(([d]) => {
        const dt = new Date(d);
        return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      }),
      labels: {
        style: { colors: t.textMuted, fontSize: "11px" },
        rotate: 0,
        hideOverlappingLabels: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: 6,
    },
    yaxis: {
      labels: {
        style: { colors: t.textMuted, fontSize: "11px" },
        formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`),
      },
    },
    legend: { show: false },
    tooltip: {
      theme: t.name,
      y: { formatter: (v) => `${v} logins` },
    },
    markers: { size: 0, hover: { size: 5 } },
  };

  return (
    <Card t={t}>
      <CardHeader
        t={t}
        title="Daily login activity"
        subtitle={`User logins across the platform — ${rangeLabel}`}
        right={<Pill t={t} tone="info">{rangeLabel}</Pill>}
      />
      <div style={{ display: "flex", gap: 24, padding: "4px 24px 0", flexWrap: "wrap" }}>
        <Stat t={t} label="Total logins" value={fmtNum(totalLogins)} />
        <Stat t={t} label="Peak day" value={fmtNum(peak)} />
        <Stat
          t={t}
          label="Daily average"
          value={fmtNum(Math.round(totalLogins / Math.max(series.length, 1)))}
        />
      </div>
      <div style={{ padding: "8px 12px 16px", minHeight: 340 }}>
        {loading ? (
          <Skeleton t={t} height={300} />
        ) : (
          <Chart
            key={`eng-${t.name}`}
            options={opts}
            series={[{ name: "Logins", data: series.map(([, v]) => v) }]}
            type="area"
            height={320}
          />
        )}
      </div>
    </Card>
  );
};

const Stat: FC<{ t: Theme; label: string; value: string }> = ({ t, label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>{label}</div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: t.text,
        fontVariantNumeric: "tabular-nums",
        marginTop: 2,
      }}
    >
      {value}
    </div>
  </div>
);

/* ============================================================
   ASSESSMENT BREAKDOWN
   ============================================================ */
const AssessmentBreakdownCard: FC<{
  t: Theme;
  rangeActive: boolean;
  rangeLabelText: string;
  total: number;
  activeWithReports: number;
  activeWithoutReports: number;
  dormant: number;
  lifetimeActive: number;
  loading: boolean;
}> = ({
  t,
  rangeActive,
  rangeLabelText,
  total,
  activeWithReports,
  activeWithoutReports,
  dormant,
  lifetimeActive,
  loading,
}) => {
  const series = rangeActive
    ? [activeWithReports, activeWithoutReports, dormant]
    : [lifetimeActive, dormant];
  const labels = rangeActive
    ? ["Active with reports", "Active · no reports yet", "Dormant"]
    : ["Active", "Inactive"];
  const colors = rangeActive ? [t.success, t.warning, t.textSubtle] : [t.success, t.textSubtle];

  const opts: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    labels,
    colors,
    stroke: { width: 0 },
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "78%",
          labels: {
            show: true,
            name: { show: true, color: t.textMuted, fontSize: "12px", offsetY: 16 },
            value: {
              show: true,
              color: t.text,
              fontSize: "28px",
              fontWeight: 700,
              offsetY: -16,
              formatter: (val) => `${val}`,
            },
            total: {
              show: true,
              label: "Assessments",
              color: t.textMuted,
              formatter: () => `${total}`,
            },
          },
        },
      },
    },
    tooltip: { theme: t.name },
  };

  return (
    <Card t={t}>
      <CardHeader
        t={t}
        title="Assessments"
        subtitle={
          rangeActive
            ? `Active in ${rangeLabelText.toLowerCase()} — with vs without report activity`
            : "Active vs inactive on the platform"
        }
        right={rangeActive ? <Pill t={t} tone="primary">{rangeLabelText}</Pill> : undefined}
      />
      <div style={{ padding: "0 12px", minHeight: 260 }}>
        {loading ? (
          <Skeleton t={t} height={240} />
        ) : total === 0 ? (
          <EmptyState t={t} label="No assessments yet" />
        ) : (
          <Chart
            key={`ass-${t.name}-${rangeActive ? "r" : "l"}`}
            options={opts}
            series={series}
            type="donut"
            height={240}
          />
        )}
      </div>
      <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {rangeActive ? (
          <>
            <Row t={t} color={t.success} label="Active · with reports" value={fmtNum(activeWithReports)} />
            <Row t={t} color={t.warning} label="Active · no reports yet" value={fmtNum(activeWithoutReports)} />
            <Row t={t} color={t.textSubtle} label="Dormant (not in range)" value={fmtNum(dormant)} />
          </>
        ) : (
          <>
            <Row t={t} color={t.success} label="Active" value={fmtNum(lifetimeActive)} />
            <Row t={t} color={t.textSubtle} label="Inactive" value={fmtNum(dormant)} />
          </>
        )}
      </div>
    </Card>
  );
};

const Row: FC<{ t: Theme; color: string; label: string; value: string }> = ({ t, color, label, value }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ color: t.text, fontSize: 13, fontWeight: 500 }}>{label}</span>
    </div>
    <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {value}
    </span>
  </div>
);

/* ============================================================
   DATA HEALTH
   ============================================================ */
const DataHealthRow: FC<{
  t: Theme;
  health: {
    reportedStudents: number;
    orphanedStudents: number;
    reportsWithoutAid: number;
  };
}> = ({ t, health }) => {
  const orphanPct =
    health.reportedStudents > 0
      ? Math.round((health.orphanedStudents / health.reportedStudents) * 100)
      : 0;
  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: t.warningSoft,
            color: t.warning,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconAlert />
        </span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Data health
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            Silent undercounts that may affect institute-level numbers
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {health.orphanedStudents > 0 && (
          <HealthMetric
            t={t}
            label="Students not linked to any institute"
            value={`${health.orphanedStudents} / ${health.reportedStudents}`}
            sub={`${orphanPct}% of students with reports in range · institute bucket dropped`}
            tone={orphanPct > 20 ? t.danger : t.warning}
          />
        )}
        {health.reportsWithoutAid > 0 && (
          <HealthMetric
            t={t}
            label="Reports missing assessment link"
            value={`${health.reportsWithoutAid}`}
            sub="excluded from per-assessment breakdown"
            tone={t.danger}
          />
        )}
      </div>
    </div>
  );
};

const HealthMetric: FC<{ t: Theme; label: string; value: string; sub: string; tone: string }> = ({
  t,
  label,
  value,
  sub,
  tone,
}) => (
  <div style={{ minWidth: 200 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone }} />
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: "0.02em" }}>
        {label.toUpperCase()}
      </span>
    </div>
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: t.text,
        fontVariantNumeric: "tabular-nums",
        marginTop: 4,
        lineHeight: 1.1,
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 11, color: t.textSubtle, marginTop: 2 }}>{sub}</div>
  </div>
);

/* ============================================================
   INSTITUTES TABLE
   ============================================================ */
const InstitutesTable: FC<{
  t: Theme;
  data: {
    id: any;
    name: string;
    city: string;
    address: string;
    active: boolean;
    branches: number | null;
  }[];
  loading: boolean;
  rangeActive: boolean;
  rangeLabelText: string;
  activity: Map<string, { activeStudents: Set<string>; reportsGenerated: number }>;
}> = ({ t, data, loading, rangeActive, rangeLabelText, activity }) => {
  const enriched = useMemo(() => {
    const rows = data.map((s) => {
      const act = activity.get(String(s.id));
      return {
        ...s,
        activeStudents: act?.activeStudents.size ?? 0,
        reportsGenerated: act?.reportsGenerated ?? 0,
      };
    });
    if (rangeActive) {
      // Consider every institute; keep ones with any activity; sort by activity.
      return rows
        .filter((r) => r.activeStudents > 0 || r.reportsGenerated > 0)
        .sort(
          (a, b) =>
            b.activeStudents - a.activeStudents ||
            b.reportsGenerated - a.reportsGenerated ||
            a.name.localeCompare(b.name)
        );
    }
    // Lifetime view: just the 8 most recently created institutes
    return rows.slice(0, 8);
  }, [data, activity, rangeActive]);

  return (
    <Card t={t}>
      <CardHeader
        t={t}
        title={rangeActive ? "Institutes active in range" : "Newest institutes"}
        subtitle={
          rangeActive
            ? `${enriched.length} ${
                enriched.length === 1 ? "institute had" : "institutes had"
              } student activity in ${rangeLabelText.toLowerCase()}`
            : `${enriched.length} shown · most recent first`
        }
        right={rangeActive ? <Pill t={t} tone="primary">{rangeLabelText}</Pill> : undefined}
      />
      <div style={{ padding: "0 8px 8px", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "0 16px 16px" }}>
            <Skeleton t={t} height={220} />
          </div>
        ) : enriched.length === 0 ? (
          <EmptyState
            t={t}
            label={
              rangeActive
                ? `No institute had recorded activity in ${rangeLabelText.toLowerCase()}`
                : "No institutes found"
            }
          />
        ) : (
          <table
            className="ds-table"
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 13,
              color: t.text,
            }}
          >
            <thead>
              <tr>
                {(rangeActive
                  ? ["#", "Institute", "Active students", "Reports generated", "Status"]
                  : ["#", "Institute", "Status"]
                ).map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign:
                        h === "Status" ||
                        h === "Active students" ||
                        h === "Reports generated"
                          ? "right"
                          : "left",
                      padding: "12px 16px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: t.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: `1px solid ${t.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map((s, i) => (
                <tr key={s.id ?? i} className="ds-row">
                  <td
                    style={{
                      padding: "14px 16px",
                      borderBottom: `1px solid ${t.border}`,
                      color: t.textMuted,
                      fontWeight: 600,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: t.primarySoft,
                          color: t.primary,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {initials(s.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: t.text }}>{s.name}</div>
                        {s.address && (
                          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                            {s.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {rangeActive && (
                    <>
                      <td
                        style={{
                          padding: "14px 16px",
                          borderBottom: `1px solid ${t.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          color: s.activeStudents > 0 ? t.primary : t.textMuted,
                        }}
                      >
                        {fmtNum(s.activeStudents)}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          borderBottom: `1px solid ${t.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          color: s.reportsGenerated > 0 ? t.success : t.textMuted,
                        }}
                      >
                        {fmtNum(s.reportsGenerated)}
                      </td>
                    </>
                  )}
                  <td
                    style={{
                      padding: "14px 16px",
                      borderBottom: `1px solid ${t.border}`,
                      textAlign: "right",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 10px",
                        borderRadius: 100,
                        fontSize: 11,
                        fontWeight: 600,
                        background: s.active ? t.successSoft : t.bgSubtle,
                        color: s.active ? t.success : t.textMuted,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: s.active ? t.success : t.textSubtle,
                        }}
                      />
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
};

/* ============================================================
   RECENT LOGINS FEED
   ============================================================ */
const RecentLoginsCard: FC<{
  t: Theme;
  logins: any[];
  loading: boolean;
  tone: (k: Tone) => { solid: string; soft: string };
}> = ({ t, logins, loading, tone }) => {
  const rotation: Tone[] = ["primary", "info", "success", "warning", "purple", "danger"];
  return (
    <Card t={t}>
      <CardHeader t={t} title="Recent logins" subtitle="Latest sign-ins across the network" />
      <div style={{ padding: "0 20px 16px", minHeight: 240 }}>
        {loading ? (
          <Skeleton t={t} height={240} />
        ) : logins.length === 0 ? (
          <EmptyState t={t} label="No login activity in the last 30 days" />
        ) : (
          logins.map((a, i) => {
            const tn = tone(rotation[i % rotation.length]);
            const name =
              pick(a, ["userName", "fullName", "name", "username", "email"]) || "User";
            const who = String(name);
            const when = pick(a, ["loginTime", "createdAt", "accessTime"]);
            const email = pick(a, ["email"]);
            const role = pick(a, ["role", "userRole"]);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i < logins.length - 1 ? `1px dashed ${t.border}` : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: tn.soft,
                    color: tn.solid,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {initials(who)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{who}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                    {role ? `${role} · ` : ""}
                    {email || "signed in"}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: t.textSubtle, whiteSpace: "nowrap" }}>
                  {relativeTime(when)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

/* ============================================================
   ASSESSMENT REPORT DRILL-DOWN
   ============================================================ */
const AssessmentReportDrilldown: FC<{
  t: Theme;
  assessments: any[];
  institutes: any[];
  reports: any[];
  studentMappings: any[];
  mappingsLoading: boolean;
  loading: boolean;
  rangeActive: boolean;
  rangeLabelText: string;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  activeAssessmentIds: Set<string>;
  errored: boolean;
}> = ({
  t,
  assessments,
  institutes,
  reports,
  studentMappings,
  mappingsLoading,
  loading,
  rangeActive,
  rangeLabelText,
  rangeStart,
  rangeEnd,
  activeAssessmentIds,
  errored,
}) => {
  // Build per-assessment data from TWO sources:
  // 1. studentMappings → source of truth for "assigned / started / completed"
  // 2. reports (GeneratedReport) → source of truth for "report generated / failed"
  const byAssessment = useMemo(() => {
    type Agg = {
      studentsAssigned: Set<string>;    // anyone with a mapping for this assessment
      studentsCompleted: Set<string>;   // mapping status completed/submitted
      studentsStarted: Set<string>;     // mapping status ongoing
      studentsGenerated: Set<string>;   // has a GeneratedReport row with status=generated
      studentsFailed: Set<string>;      // has a GeneratedReport row with status=failed
      rowsGenerated: number;
      rowsTotal: number;
    };
    const ensure = (m: Map<string, Agg>, aid: string): Agg => {
      let e = m.get(aid);
      if (!e) {
        e = {
          studentsAssigned: new Set<string>(),
          studentsCompleted: new Set<string>(),
          studentsStarted: new Set<string>(),
          studentsGenerated: new Set<string>(),
          studentsFailed: new Set<string>(),
          rowsGenerated: 0,
          rowsTotal: 0,
        };
        m.set(aid, e);
      }
      return e;
    };

    const m = new Map<string, Agg>();

    // 1. Walk student mappings (authoritative for assigned/completed)
    studentMappings.forEach((s) => {
      const sid = String(
        pick(s, ["userStudentId", "user_student_id", "id"]) ?? ""
      );
      if (!sid) return;
      const assigned = Array.isArray(s.assessments) ? s.assessments : [];
      assigned.forEach((a: any) => {
        const aid = String(pick(a, ["assessmentId", "assessment_id"]) ?? "");
        if (!aid) return;
        const status = String(pick(a, ["status"]) || "").toLowerCase();
        const entry = ensure(m, aid);
        entry.studentsAssigned.add(sid);
        if (status === "completed" || status === "submitted") entry.studentsCompleted.add(sid);
        else if (status === "ongoing") entry.studentsStarted.add(sid);
      });
    });

    // 2. Walk GeneratedReport rows (authoritative for report generation)
    reports.forEach((r: any) => {
      const aid = String(pick(r, ["assessmentId", "assessment_id"]) ?? "");
      if (!aid) return;
      const status = String(pick(r, ["reportStatus", "status"]) || "").toLowerCase();
      const nested = r?.userStudent;
      const sidRaw =
        (nested && (nested.userStudentId ?? nested.id ?? nested.studentId)) ??
        pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"]);
      const sid = sidRaw != null ? String(sidRaw) : "";

      const entry = ensure(m, aid);
      entry.rowsTotal++;
      if (status === "generated") {
        entry.rowsGenerated++;
        if (sid) entry.studentsGenerated.add(sid);
      } else if (status === "failed") {
        if (sid) entry.studentsFailed.add(sid);
      }
    });

    return m;
  }, [studentMappings, reports]);

  const assessmentOptions = useMemo(() => {
    const all = assessments
      .map((a) => {
        const id = pick(a, ["id", "assessmentId"]);
        const name =
          pick(a, ["assessmentName", "name", "title"]) || `Assessment #${id ?? "?"}`;
        const stats = byAssessment.get(String(id));
        return {
          id: String(id ?? ""),
          name: String(name),
          studentsCompleted: stats?.studentsCompleted.size ?? 0,
          studentsGenerated: stats?.studentsGenerated.size ?? 0,
          studentsAssigned: stats?.studentsAssigned.size ?? 0,
        };
      })
      .filter((a) => a.id);

    // When a date range is active, only show assessments whose scheduled window
    // overlaps the range (window-based active set from parent).
    const visible = rangeActive
      ? all.filter((a) => activeAssessmentIds.has(a.id))
      : all;

    return visible.sort(
      (a, b) =>
        b.studentsCompleted - a.studentsCompleted ||
        b.studentsAssigned - a.studentsAssigned ||
        a.name.localeCompare(b.name)
    );
  }, [assessments, byAssessment, rangeActive, activeAssessmentIds]);

  const [selectedId, setSelectedId] = useState<string>("");

  // Default select top assessment; also re-pick if current selection becomes
  // invisible after range change.
  useEffect(() => {
    if (assessmentOptions.length === 0) return;
    const stillVisible = assessmentOptions.some((a) => a.id === selectedId);
    if (!selectedId || !stillVisible) {
      const withCompletions = assessmentOptions.find((a) => a.studentsCompleted > 0);
      setSelectedId((withCompletions || assessmentOptions[0]).id);
    }
  }, [assessmentOptions, selectedId]);

  const selected = byAssessment.get(selectedId);
  const selectedMeta = assessmentOptions.find((a) => a.id === selectedId);

  // Warn when the selected assessment's window is much wider than the user's range
  // (completions below include activity outside the range).
  const windowOvershoot = useMemo(() => {
    if (!rangeActive || !rangeStart || !rangeEnd || !selectedId) return null;
    const a = assessments.find((x) => String(pick(x, ["id", "assessmentId"])) === selectedId);
    if (!a) return null;
    const startStr = pick(a, ["starDate", "startDate"]);
    const endStr = pick(a, ["endDate"]);
    if (!startStr || !endStr) return null;
    const aStart = new Date(String(startStr)).getTime();
    const aEnd = new Date(String(endStr)).getTime();
    if (Number.isNaN(aStart) || Number.isNaN(aEnd)) return null;
    const dayMs = 86400000;
    const windowDays = Math.max(Math.round((aEnd - aStart) / dayMs) + 1, 1);
    const rangeDays = Math.max(Math.round((rangeEnd.getTime() - rangeStart.getTime()) / dayMs) + 1, 1);
    if (windowDays > rangeDays * 2) {
      return { windowDays, rangeDays };
    }
    return null;
  }, [rangeActive, rangeStart, rangeEnd, selectedId, assessments]);

  // Student → institute + institute → name lookups (scoped to drilldown)
  const studentToInstitute = useMemo(() => {
    const m = new Map<string, string>();
    studentMappings.forEach((s: any) => {
      const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
      const iid = String(pick(s, ["instituteId", "institute_id"]) ?? "");
      if (sid && iid) m.set(sid, iid);
    });
    return m;
  }, [studentMappings]);

  const instituteNameById = useMemo(() => {
    const m = new Map<string, string>();
    institutes.forEach((i: any) => {
      const id = pick(i, ["id", "instituteId", "instituteCode"]);
      const altId = pick(i, ["instituteCode", "code"]);
      const name =
        pick(i, ["instituteName", "name", "schoolName", "collegeName"]) ||
        `Institute #${id ?? altId ?? "?"}`;
      if (id != null) m.set(String(id), String(name));
      if (altId != null) m.set(String(altId), String(name));
    });
    return m;
  }, [institutes]);

  // Per-institute breakdown for the currently selected assessment
  const perInstitute = useMemo(() => {
    if (!selectedId) return [] as {
      instituteId: string;
      name: string;
      students: number;
      completed: number;
      reports: number;
    }[];
    type Agg = {
      students: Set<string>;
      completed: Set<string>;
      reports: Set<string>;
    };
    const m = new Map<string, Agg>();
    const ensure = (iid: string): Agg => {
      let e = m.get(iid);
      if (!e) {
        e = { students: new Set(), completed: new Set(), reports: new Set() };
        m.set(iid, e);
      }
      return e;
    };

    // 1. Walk mappings: assigned + completed, per institute
    studentMappings.forEach((s) => {
      const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
      const iid = String(pick(s, ["instituteId", "institute_id"]) ?? "");
      if (!sid || !iid) return;
      const assigned = Array.isArray(s.assessments) ? s.assessments : [];
      const mapping = assigned.find(
        (a: any) => String(pick(a, ["assessmentId", "assessment_id"]) ?? "") === selectedId
      );
      if (!mapping) return;
      const entry = ensure(iid);
      entry.students.add(sid);
      const st = String(pick(mapping, ["status"]) || "").toLowerCase();
      if (st === "completed" || st === "submitted") entry.completed.add(sid);
    });

    // 2. Walk (date-filtered) reports for this assessment
    reports.forEach((r: any) => {
      if (String(pick(r, ["assessmentId", "assessment_id"]) ?? "") !== selectedId) return;
      const status = String(pick(r, ["reportStatus", "status"]) || "").toLowerCase();
      if (status !== "generated") return;
      const nested = r?.userStudent;
      const sid = String(
        (nested && (nested.userStudentId ?? nested.id ?? nested.studentId)) ??
          pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"]) ??
          ""
      );
      if (!sid) return;
      const iid = studentToInstitute.get(sid);
      if (!iid) return;
      const entry = ensure(iid);
      entry.reports.add(sid);
    });

    return Array.from(m.entries())
      .map(([iid, v]) => ({
        instituteId: iid,
        name: instituteNameById.get(iid) || `Institute #${iid}`,
        students: v.students.size,
        completed: v.completed.size,
        reports: v.reports.size,
      }))
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  }, [selectedId, studentMappings, reports, studentToInstitute, instituteNameById]);

  const studentsGenerated = selected?.studentsGenerated.size ?? 0;
  const studentsCompleted = selected?.studentsCompleted.size ?? 0;
  const studentsAssigned = selected?.studentsAssigned.size ?? 0;
  const studentsStarted = selected?.studentsStarted.size ?? 0;
  // completed but no generated report yet
  const completedIds = selected?.studentsCompleted ?? new Set<string>();
  const generatedIds = selected?.studentsGenerated ?? new Set<string>();
  let studentsWaitingForReport = 0;
  completedIds.forEach((id) => {
    if (!generatedIds.has(id)) studentsWaitingForReport++;
  });
  const studentsNotStarted = Math.max(
    studentsAssigned - studentsCompleted - studentsStarted,
    0
  );

  const donutOpts: ApexOptions = useMemo(
    () => ({
      chart: { type: "donut", fontFamily: "inherit" },
      labels: ["Report generated", "Completed · awaiting report", "In progress", "Not started"],
      colors: [t.success, t.warning, t.info, t.textSubtle],
      stroke: { width: 0 },
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: "76%",
            labels: {
              show: true,
              name: { show: true, color: t.textMuted, fontSize: "12px", offsetY: 16 },
              value: {
                show: true,
                color: t.text,
                fontSize: "32px",
                fontWeight: 700,
                offsetY: -14,
                formatter: (val) => `${val}`,
              },
              total: {
                show: true,
                label: "Students with report",
                color: t.textMuted,
                formatter: () => `${studentsGenerated}`,
              },
            },
          },
        },
      },
      tooltip: {
        theme: t.name,
        y: { formatter: (v) => `${v} ${v === 1 ? "student" : "students"}` },
      },
    }),
    [t, studentsGenerated]
  );

  return (
    <Card t={t}>
      <CardHeader
        t={t}
        title="Assessment drill-down"
        subtitle={
          errored
            ? "Could not load assessments or reports"
            : rangeActive
            ? `${assessmentOptions.length} ${
                assessmentOptions.length === 1 ? "assessment" : "assessments"
              } active in ${rangeLabelText.toLowerCase()} · completions shown are lifetime per assessment`
            : `${assessmentOptions.length} assessments · completions & students are lifetime per assessment`
        }
        right={
          <select
            className="ds-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading || assessmentOptions.length === 0}
          >
            <option value="" disabled>
              {loading ? "Loading assessments…" : "Select assessment"}
            </option>
            {assessmentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.studentsAssigned > 0
                  ? ` · ${a.studentsCompleted} completed / ${a.studentsGenerated} got report`
                  : ""}
              </option>
            ))}
          </select>
        }
      />
      <div style={{ padding: "0 24px 24px" }}>
        {windowOvershoot && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${t.warning}44`,
              background: t.warningSoft,
              color: t.warning,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>
              <IconAlert />
            </span>
            <div>
              <strong>Heads up:</strong> this assessment's window is{" "}
              <strong>{windowOvershoot.windowDays} days</strong>, but your selected range
              is <strong>{windowOvershoot.rangeDays} days</strong>. The "Students completed"
              count below includes completions across the full window, not just your range
              — mapping data has no per-student completion timestamp to filter precisely.
            </div>
          </div>
        )}
        {loading ? (
          <Skeleton t={t} height={280} />
        ) : !selected || !selectedMeta ? (
          <EmptyState
            t={t}
            label={
              assessmentOptions.length === 0
                ? "No assessments available"
                : "No data for this assessment yet"
            }
          />
        ) : (
          <div className="ds-drilldown">
            <div className="ds-drilldown-chart">
              {studentsAssigned === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 260,
                    color: t.textMuted,
                    fontSize: 13,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  {mappingsLoading
                    ? "Loading student mappings across institutes…"
                    : "No students assigned to this assessment yet"}
                </div>
              ) : (
                <Chart
                  key={`drill-${selectedId}-${t.name}`}
                  options={donutOpts}
                  series={[
                    studentsGenerated,
                    studentsWaitingForReport,
                    studentsStarted,
                    studentsNotStarted,
                  ]}
                  type="donut"
                  height={260}
                />
              )}
            </div>

            <div className="ds-drilldown-stats">
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                {selectedMeta.name}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
                {mappingsLoading
                  ? "Loading student mappings…"
                  : `${fmtNum(studentsAssigned)} ${
                      studentsAssigned === 1 ? "student" : "students"
                    } assigned · ${fmtNum(studentsCompleted)} completed`}
              </div>

              <StatTile
                t={t}
                color={t.success}
                label="Students with generated report"
                value={studentsGenerated}
                helper={
                  studentsCompleted > 0
                    ? `${pct(studentsGenerated, studentsCompleted)}% of students who completed`
                    : "—"
                }
              />
              <StatTile
                t={t}
                color={t.warning}
                label="Completed · awaiting report"
                value={studentsWaitingForReport}
                helper="finished assessment, no report yet"
              />
              <StatTile
                t={t}
                color={t.info}
                label="In progress"
                value={studentsStarted}
                helper="started but not submitted"
              />
              <StatTile
                t={t}
                color={t.textSubtle}
                label="Not started"
                value={studentsNotStarted}
                helper="assigned but never opened"
              />
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px dashed ${t.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: t.textMuted,
                }}
              >
                <span>Report records on file (bet + navigator)</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: t.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtNum(selected.rowsGenerated)} / {fmtNum(selected.rowsTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Per-institute breakdown */}
        {!loading && selected && perInstitute.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${t.border}` }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  Conducted across {perInstitute.length}{" "}
                  {perInstitute.length === 1 ? "institute" : "institutes"}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {rangeActive
                    ? "Students & completions via assessment window · reports by createdAt"
                    : "Lifetime totals per institute"}
                </div>
              </div>
              {rangeActive && <Pill t={t} tone="info">{rangeLabelText}</Pill>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                className="ds-table"
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: 13,
                  color: t.text,
                }}
              >
                <thead>
                  <tr>
                    {[
                      { label: "Institute", align: "left" as const },
                      { label: "Students (lifetime)", align: "right" as const },
                      { label: "Completed (lifetime)", align: "right" as const },
                      {
                        label: rangeActive ? "Reports in range" : "Reports (lifetime)",
                        align: "right" as const,
                      },
                      { label: "Completion", align: "right" as const },
                      { label: "Report rate", align: "right" as const },
                    ].map((h) => (
                      <th
                        key={h.label}
                        style={{
                          textAlign: h.align,
                          padding: "10px 14px",
                          fontSize: 10,
                          fontWeight: 600,
                          color: t.textMuted,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          borderBottom: `1px solid ${t.border}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perInstitute.map((row) => {
                    const completionPct = pct(row.completed, Math.max(row.students, 1));
                    const reportPct = pct(row.reports, Math.max(row.completed, 1));
                    return (
                      <tr key={row.instituteId} className="ds-row">
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${t.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: t.primarySoft,
                                color: t.primary,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 11,
                                flexShrink: 0,
                              }}
                            >
                              {initials(row.name)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{row.name}</span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            borderBottom: `1px solid ${t.border}`,
                            textAlign: "right",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtNum(row.students)}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            borderBottom: `1px solid ${t.border}`,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: row.completed > 0 ? t.text : t.textMuted,
                          }}
                        >
                          {fmtNum(row.completed)}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            borderBottom: `1px solid ${t.border}`,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: row.reports > 0 ? t.success : t.textMuted,
                            fontWeight: row.reports > 0 ? 700 : 500,
                          }}
                        >
                          {fmtNum(row.reports)}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            borderBottom: `1px solid ${t.border}`,
                            textAlign: "right",
                          }}
                        >
                          <PercentBar t={t} value={completionPct} color={t.info} />
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            borderBottom: `1px solid ${t.border}`,
                            textAlign: "right",
                          }}
                        >
                          <PercentBar t={t} value={reportPct} color={t.success} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

/* ============================================================
   COUNSELLOR LEADERBOARD
   ============================================================ */
const COUNSELLING_ACTIVE_STATUSES = new Set([
  "PENDING",
  "ASSIGNED",
  "CONFIRMED",
  "COMPLETED",
]);

const apptSessionTime = (appt: any): number => {
  const date = appt?.slot?.date;
  const time = appt?.slot?.startTime;
  if (!date) return NaN;
  const iso = time ? `${date}T${time}` : `${date}T00:00:00`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? NaN : t;
};

const RatingCell: FC<{ t: Theme; average: number; count: number }> = ({
  t,
  average,
  count,
}) => {
  if (!count || !average) {
    return (
      <span style={{ fontSize: 12, color: t.textSubtle }}>No ratings yet</span>
    );
  }
  const fillPct = Math.max(0, Math.min(100, (average / 5) * 100));
  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      title={`${average.toFixed(2)} from ${count} ${count === 1 ? "review" : "reviews"}`}
    >
      <div
        style={{ position: "relative", lineHeight: 1, fontSize: 13, letterSpacing: 1 }}
        aria-label={`${average.toFixed(2)} out of 5`}
      >
        <span style={{ color: t.textSubtle, opacity: 0.35 }}>★★★★★</span>
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${fillPct}%`,
            overflow: "hidden",
            color: t.warning,
            whiteSpace: "nowrap",
          }}
        >
          ★★★★★
        </span>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: t.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {average.toFixed(2)}
      </span>
      <span
        style={{ fontSize: 11, color: t.textMuted, fontVariantNumeric: "tabular-nums" }}
      >
        ({count})
      </span>
    </div>
  );
};

const CounsellorLeaderboardCard: FC<{
  t: Theme;
  counsellors: any[];
  appointments: any[];
  ratingSummary: any[];
  loading: boolean;
  errored: boolean;
}> = ({ t, counsellors, appointments, ratingSummary, loading, errored }) => {
  const rows = useMemo(() => {
    const byCounsellor = new Map<
      string,
      { completed: number; upcoming: number; cancelled: number }
    >();
    const ensure = (id: string) => {
      let e = byCounsellor.get(id);
      if (!e) {
        e = { completed: 0, upcoming: 0, cancelled: 0 };
        byCounsellor.set(id, e);
      }
      return e;
    };
    const now = Date.now();
    appointments.forEach((a) => {
      const cid = String(pick(a?.counsellor || {}, ["id"]) ?? "");
      if (!cid) return;
      const status = String(a?.status || "").toUpperCase();
      const st = apptSessionTime(a);
      const entry = ensure(cid);
      if (status === "CANCELLED") {
        entry.cancelled += 1;
      } else if (status === "RESCHEDULED") {
        // rescheduled rows are replaced by a new CONFIRMED row; don't double-count
      } else if (status === "COMPLETED") {
        // Set by SessionNotesService when the counsellor files notes — authoritative
        entry.completed += 1;
      } else if (status === "CONFIRMED") {
        // Proxy: confirmed session with a slot in the past ran; notes may not be filed yet
        if (!Number.isNaN(st) && st < now) entry.completed += 1;
        else entry.upcoming += 1;
      } else if (status === "ASSIGNED" || status === "PENDING") {
        entry.upcoming += 1;
      }
    });

    const ratingById = new Map<string, { average: number; count: number }>();
    ratingSummary.forEach((r) => {
      const id = String(pick(r, ["counsellorId", "id"]) ?? "");
      if (!id) return;
      const average = Number(pick(r, ["average", "avg"]) ?? 0);
      const count = Number(pick(r, ["count", "total"]) ?? 0);
      ratingById.set(id, { average, count });
    });

    return counsellors
      .map((c) => {
        const id = String(pick(c, ["id", "counsellorId"]) ?? "");
        const stats = byCounsellor.get(id) || { completed: 0, upcoming: 0, cancelled: 0 };
        const rating = ratingById.get(id) || { average: 0, count: 0 };
        return {
          id,
          name: pick(c, ["name", "fullName"]) || "Counsellor",
          email: pick(c, ["email"]) || "",
          isActive: c?.isActive !== false,
          profileImageUrl: pick(c, ["profileImageUrl"]) || "",
          ...stats,
          avgRating: rating.average,
          ratingCount: rating.count,
        };
      })
      .sort(
        (a, b) =>
          b.completed - a.completed ||
          b.avgRating - a.avgRating ||
          b.upcoming - a.upcoming ||
          a.name.localeCompare(b.name)
      );
  }, [counsellors, appointments, ratingSummary]);

  const totalCompleted = rows.reduce((sum, r) => sum + r.completed, 0);
  const activeCounsellors = rows.filter((r) => r.isActive).length;
  const maxCompleted = rows.reduce((m, r) => Math.max(m, r.completed), 0);
  const networkRating = useMemo(() => {
    let total = 0;
    let count = 0;
    rows.forEach((r) => {
      if (r.ratingCount > 0) {
        total += r.avgRating * r.ratingCount;
        count += r.ratingCount;
      }
    });
    return { average: count > 0 ? total / count : 0, count };
  }, [rows]);

  return (
    <Card t={t}>
      <CardHeader
        t={t}
        title="Counsellor sessions & ratings"
        subtitle={
          errored
            ? "Could not load counsellor data"
            : networkRating.count > 0
            ? `${fmtNum(totalCompleted)} sessions completed · network rating ${networkRating.average.toFixed(
                2
              )} ★ from ${fmtNum(networkRating.count)} ${
                networkRating.count === 1 ? "review" : "reviews"
              }`
            : `${fmtNum(totalCompleted)} sessions completed across ${activeCounsellors} active ${
                activeCounsellors === 1 ? "counsellor" : "counsellors"
              }`
        }
        right={
          networkRating.count > 0 ? (
            <Pill t={t} tone="warning">
              {networkRating.average.toFixed(2)} ★ · {fmtNum(networkRating.count)}
            </Pill>
          ) : totalCompleted > 0 ? (
            <Pill t={t} tone="success">{fmtNum(totalCompleted)} completed</Pill>
          ) : undefined
        }
      />
      <div style={{ padding: "0 20px 20px", minHeight: 240 }}>
        {loading ? (
          <Skeleton t={t} height={240} />
        ) : rows.length === 0 ? (
          <EmptyState t={t} label="No counsellors configured yet" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className="ds-table"
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                fontSize: 13,
                color: t.text,
              }}
            >
              <thead>
                <tr>
                  {[
                    { label: "#", align: "left" as const },
                    { label: "Counsellor", align: "left" as const },
                    { label: "Rating", align: "left" as const },
                    { label: "Completed", align: "right" as const },
                    { label: "Upcoming", align: "right" as const },
                    { label: "Share", align: "right" as const },
                  ].map((h) => (
                    <th
                      key={h.label}
                      style={{
                        textAlign: h.align,
                        padding: "10px 12px",
                        fontSize: 10,
                        fontWeight: 600,
                        color: t.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: `1px solid ${t.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="ds-row">
                    <td
                      style={{
                        padding: "12px 12px",
                        borderBottom: `1px solid ${t.border}`,
                        color: t.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "12px 12px", borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: r.profileImageUrl
                              ? `center/cover no-repeat url(${r.profileImageUrl})`
                              : t.primarySoft,
                            color: t.primary,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          {!r.profileImageUrl && initials(r.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: t.text,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.name}
                            </span>
                            {!r.isActive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: t.textSubtle,
                                  fontWeight: 500,
                                }}
                              >
                                · inactive
                              </span>
                            )}
                          </div>
                          {r.email && (
                            <div
                              style={{
                                fontSize: 11,
                                color: t.textMuted,
                                marginTop: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: 240,
                              }}
                            >
                              {r.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        borderBottom: `1px solid ${t.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <RatingCell
                        t={t}
                        average={r.avgRating}
                        count={r.ratingCount}
                      />
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        borderBottom: `1px solid ${t.border}`,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 700,
                        color: r.completed > 0 ? t.success : t.textMuted,
                      }}
                    >
                      {fmtNum(r.completed)}
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        borderBottom: `1px solid ${t.border}`,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: r.upcoming > 0 ? t.text : t.textMuted,
                      }}
                    >
                      {fmtNum(r.upcoming)}
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        borderBottom: `1px solid ${t.border}`,
                        textAlign: "right",
                      }}
                    >
                      <PercentBar
                        t={t}
                        value={pct(r.completed, Math.max(maxCompleted, 1))}
                        color={t.success}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
};

/* ============================================================
   COUNSELLING DRILL-DOWN (per institute)
   ============================================================ */
const CounsellingDrillDownCard: FC<{
  t: Theme;
  institutes: any[];
  studentMappings: any[];
  appointments: any[];
  mappingsLoading: boolean;
  loading: boolean;
  errored: boolean;
}> = ({ t, institutes, studentMappings, appointments, mappingsLoading, loading, errored }) => {
  // Students who have at least one non-cancelled/non-rescheduled counselling appointment
  const studentsWithCounselling = useMemo(() => {
    const s = new Set<string>();
    appointments.forEach((a) => {
      const status = String(a?.status || "").toUpperCase();
      if (!COUNSELLING_ACTIVE_STATUSES.has(status)) return;
      const sid =
        pick(a?.student || {}, ["userStudentId", "id", "studentId"]) ??
        pick(a, ["studentId", "userStudentId"]);
      if (sid != null) s.add(String(sid));
    });
    return s;
  }, [appointments]);

  // Build: instituteId → { students, completedAssessment, counselled }
  const perInstitute = useMemo(() => {
    type Agg = {
      id: string;
      name: string;
      totalStudents: number;
      completedAssessment: Set<string>;
      counselled: Set<string>;
    };
    const byInstitute = new Map<string, Agg>();

    const nameById = new Map<string, string>();
    institutes.forEach((i: any) => {
      const primaryId = pick(i, ["id", "instituteId", "instituteCode"]);
      const altId = pick(i, ["instituteCode", "code"]);
      const resolvedName = pick(i, [
        "instituteName",
        "name",
        "schoolName",
        "collegeName",
      ]);
      const name =
        resolvedName || `Institute #${primaryId ?? altId ?? "?"}`;
      if (primaryId != null) nameById.set(String(primaryId), String(name));
      if (altId != null) nameById.set(String(altId), String(name));
    });

    studentMappings.forEach((s: any) => {
      const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
      const iid = String(pick(s, ["instituteId", "institute_id"]) ?? "");
      if (!sid || !iid) return;
      let agg = byInstitute.get(iid);
      if (!agg) {
        agg = {
          id: iid,
          name: nameById.get(iid) || `Institute #${iid}`,
          totalStudents: 0,
          completedAssessment: new Set(),
          counselled: new Set(),
        };
        byInstitute.set(iid, agg);
      }
      agg.totalStudents += 1;

      const assigned = Array.isArray(s.assessments) ? s.assessments : [];
      const completedAny = assigned.some((a: any) => {
        const st = String(pick(a, ["status"]) || "").toLowerCase();
        return st === "completed" || st === "submitted";
      });
      if (completedAny) agg.completedAssessment.add(sid);
      if (studentsWithCounselling.has(sid)) agg.counselled.add(sid);
    });

    return Array.from(byInstitute.values())
      .map((v) => ({
        id: v.id,
        name: v.name,
        totalStudents: v.totalStudents,
        completedAssessment: v.completedAssessment.size,
        counselled: Array.from(v.completedAssessment).filter((sid) =>
          v.counselled.has(sid)
        ).length,
      }))
      .sort(
        (a, b) => b.completedAssessment - a.completedAssessment || a.name.localeCompare(b.name)
      );
  }, [institutes, studentMappings, studentsWithCounselling]);

  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (perInstitute.length === 0) return;
    const stillVisible = perInstitute.some((i) => i.id === selectedId);
    if (!selectedId || !stillVisible) {
      const withAny = perInstitute.find((i) => i.completedAssessment > 0);
      setSelectedId((withAny || perInstitute[0]).id);
    }
  }, [perInstitute, selectedId]);

  const selected = perInstitute.find((i) => i.id === selectedId);
  const completedAssessment = selected?.completedAssessment ?? 0;
  const counselled = selected?.counselled ?? 0;
  const notCounselled = Math.max(completedAssessment - counselled, 0);

  const donutOpts: ApexOptions = useMemo(
    () => ({
      chart: { type: "donut", fontFamily: "inherit" },
      labels: ["Took counselling", "Did not take counselling"],
      colors: [t.success, t.textSubtle],
      stroke: { width: 0 },
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: "76%",
            labels: {
              show: true,
              name: { show: true, color: t.textMuted, fontSize: "12px", offsetY: 16 },
              value: {
                show: true,
                color: t.text,
                fontSize: "32px",
                fontWeight: 700,
                offsetY: -14,
                formatter: (val) => `${val}`,
              },
              total: {
                show: true,
                label: "Assessment completed",
                color: t.textMuted,
                formatter: () => `${completedAssessment}`,
              },
            },
          },
        },
      },
      tooltip: {
        theme: t.name,
        y: { formatter: (v) => `${v} ${v === 1 ? "student" : "students"}` },
      },
    }),
    [t, completedAssessment]
  );

  return (
    <Card t={t}>
      <CardHeader
        t={t}
        title="Counselling drill-down"
        subtitle={
          errored
            ? "Could not load counselling appointments"
            : `${perInstitute.length} ${
                perInstitute.length === 1 ? "institute" : "institutes"
              } · of students who completed assessment, how many took counselling`
        }
        right={
          <select
            className="ds-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading || mappingsLoading || perInstitute.length === 0}
          >
            <option value="" disabled>
              {loading || mappingsLoading ? "Loading…" : "Select institute"}
            </option>
            {perInstitute.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.completedAssessment > 0
                  ? ` · ${i.counselled}/${i.completedAssessment} counselled`
                  : ""}
              </option>
            ))}
          </select>
        }
      />
      <div style={{ padding: "0 24px 24px" }}>
        {loading || mappingsLoading ? (
          <Skeleton t={t} height={280} />
        ) : !selected ? (
          <EmptyState
            t={t}
            label={
              perInstitute.length === 0
                ? "No institutes with students yet"
                : "No data for this institute yet"
            }
          />
        ) : completedAssessment === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 240,
              color: t.textMuted,
              fontSize: 13,
              textAlign: "center",
              padding: 20,
            }}
          >
            No students from {selected.name} have completed an assessment yet.
          </div>
        ) : (
          <div className="ds-drilldown">
            <div className="ds-drilldown-chart">
              <Chart
                key={`counsel-drill-${selectedId}-${t.name}`}
                options={donutOpts}
                series={[counselled, notCounselled]}
                type="donut"
                height={260}
              />
            </div>
            <div className="ds-drilldown-stats">
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
                {fmtNum(selected.totalStudents)}{" "}
                {selected.totalStudents === 1 ? "student" : "students"} on roster ·{" "}
                {fmtNum(completedAssessment)} finished an assessment
              </div>

              <StatTile
                t={t}
                color={t.success}
                label="Took counselling"
                value={counselled}
                helper={
                  completedAssessment > 0
                    ? `${pct(counselled, completedAssessment)}% of assessment-completers`
                    : "—"
                }
              />
              <StatTile
                t={t}
                color={t.textSubtle}
                label="Have not taken counselling"
                value={notCounselled}
                helper="completed assessment · no booking yet"
              />
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px dashed ${t.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: t.textMuted,
                }}
              >
                <span>Conversion (counselling / assessment)</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: t.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct(counselled, Math.max(completedAssessment, 1))}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

const PercentBar: FC<{ t: Theme; value: number; color: string }> = ({ t, value, color }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 110 }}>
    <div
      style={{
        flex: 1,
        height: 5,
        background: t.bgSubtle,
        borderRadius: 100,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(value, 100)}%`,
          height: "100%",
          borderRadius: 100,
          background: color,
          transition: "width 400ms ease",
        }}
      />
    </div>
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: t.text,
        fontVariantNumeric: "tabular-nums",
        minWidth: 38,
        textAlign: "right",
      }}
    >
      {value}%
    </span>
  </div>
);

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

const StatTile: FC<{ t: Theme; color: string; label: string; value: number; helper: string }> = ({
  t, color, label, value, helper,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px",
      borderRadius: 10,
      border: `1px solid ${t.border}`,
      background: t.bg,
      marginBottom: 8,
      gap: 12,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{helper}</div>
      </div>
    </div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: t.text,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {fmtNum(value)}
    </div>
  </div>
);

/* ============================================================
   PRIMITIVES
   ============================================================ */
const Card: FC<{ t: Theme; children: ReactNode }> = ({ t, children }) => (
  <div
    className="ds-card"
    style={{
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 14,
      overflow: "hidden",
      height: "100%",
    }}
  >
    {children}
  </div>
);

const CardHeader: FC<{ t: Theme; title: string; subtitle?: string; right?: ReactNode }> = ({
  t, title, subtitle, right,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "22px 26px 14px",
      flexWrap: "wrap",
    }}
  >
    <div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: t.text,
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 13,
            color: t.textMuted,
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
    {right && <div>{right}</div>}
  </div>
);

const Pill: FC<{ t: Theme; tone: Tone; children: ReactNode }> = ({ t, tone, children }) => {
  const map: Record<Tone, { solid: string; soft: string }> = {
    primary: { solid: t.primary, soft: t.primarySoft },
    success: { solid: t.success, soft: t.successSoft },
    warning: { solid: t.warning, soft: t.warningSoft },
    danger: { solid: t.danger, soft: t.dangerSoft },
    info: { solid: t.info, soft: t.infoSoft },
    purple: { solid: t.purple, soft: t.purpleSoft },
  };
  const c = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 100,
        background: c.soft,
        color: c.solid,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
};

const Skeleton: FC<{ t: Theme; height: number }> = ({ t, height }) => (
  <div
    className="ds-skeleton"
    style={{
      width: "100%",
      height,
      borderRadius: 10,
      background: t.bgSubtle,
    }}
  />
);

const EmptyState: FC<{ t: Theme; label: string }> = ({ t, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 180,
      color: t.textMuted,
      fontSize: 13,
    }}
  >
    {label}
  </div>
);

/* ============================================================
   STYLES
   ============================================================ */
const DashboardStyles: FC<{ theme: Theme }> = ({ theme: t }) => (
  <style>{`
    .ds-root {
      transition: background 200ms ease, color 200ms ease;
    }

    /* Break out of any restrictive parent container while dashboard is mounted */
    body #kt_app_content,
    body #kt_app_content_container,
    body .app-content,
    body .app-content-container,
    body .container,
    body .container-xxl,
    body .container-fluid {
      max-width: none !important;
    }

    /* --------------------- HERO (slate + muted rose) --------------------- */
    .ds-hero {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      padding: 48px 56px;
      background:
        radial-gradient(1200px 500px at 85% -15%, rgba(244,63,94,0.14), transparent 60%),
        radial-gradient(800px 400px at -5% 115%, rgba(244,63,94,0.08), transparent 55%),
        linear-gradient(135deg, #0f172a 0%, #1a2238 50%, #1e293b 100%);
      color: #fff;
      animation: ds-fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .ds-hero-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(70px);
      pointer-events: none;
    }
    .ds-hero-glow-1 {
      top: -140px; right: -80px; width: 380px; height: 380px;
      background: radial-gradient(closest-side, rgba(244,63,94,0.22), transparent);
    }
    .ds-hero-glow-2 {
      bottom: -160px; left: 15%; width: 440px; height: 440px;
      background: radial-gradient(closest-side, rgba(100,116,139,0.28), transparent);
    }
    .ds-hero-glow-3 {
      top: 40%; right: 28%; width: 220px; height: 220px;
      background: radial-gradient(closest-side, rgba(244,63,94,0.1), transparent);
    }
    .ds-hero-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
      pointer-events: none;
    }
    .ds-hero-content {
      position: relative;
      display: flex;
      gap: 40px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
    .ds-hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 100px;
      fontSize: 11px;
      font-weight: 600;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .ds-hero-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(110px, 1fr));
      gap: 12px;
      min-width: 380px;
    }
    @media (max-width: 900px) { .ds-hero-stats { min-width: 0; grid-template-columns: repeat(3, 1fr); width: 100%; } }
    .ds-hero-stat {
      padding: 16px 18px;
      border-radius: 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform 200ms ease, background 200ms ease, border-color 200ms ease;
      animation: ds-fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .ds-hero-stat:hover {
      transform: translateY(-2px);
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.18);
    }

    .ds-btn-hero-primary {
      background: #fff;
      color: #0b1020;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .ds-btn-hero-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.35);
      background: #f5f5f7;
    }
    .ds-btn-hero-ghost {
      background: rgba(255,255,255,0.08);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.16);
      backdrop-filter: blur(10px);
    }
    .ds-btn-hero-ghost:hover {
      background: rgba(255,255,255,0.16);
      border-color: rgba(255,255,255,0.28);
    }

    /* --------------------- ENTRANCE ANIMATION --------------------- */
    @keyframes ds-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ds-grid > * {
      animation: ds-fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .ds-grid > *:nth-child(1) { animation-delay: 40ms; }
    .ds-grid > *:nth-child(2) { animation-delay: 80ms; }
    .ds-grid > *:nth-child(3) { animation-delay: 120ms; }
    .ds-grid > *:nth-child(4) { animation-delay: 160ms; }
    .ds-grid > *:nth-child(5) { animation-delay: 200ms; }
    .ds-grid > *:nth-child(6) { animation-delay: 240ms; }


    .ds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px !important;
    }

    .ds-two-col {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }
    @media (max-width: 1100px) { .ds-two-col { grid-template-columns: 1fr; } }

    .ds-drilldown {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: center;
    }
    @media (max-width: 900px) { .ds-drilldown { grid-template-columns: 1fr; } }

    .ds-select {
      appearance: none;
      -webkit-appearance: none;
      min-width: 260px;
      max-width: 360px;
      padding: 8px 34px 8px 12px;
      border-radius: 10px;
      border: 1px solid ${t.border};
      background: ${t.card};
      color: ${t.text};
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 200ms ease;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(
        t.textMuted
      )}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>");
      background-repeat: no-repeat;
      background-position: right 10px center;
    }
    .ds-select:hover { border-color: ${t.borderStrong}; }
    .ds-select:focus { outline: none; border-color: ${t.primary}; box-shadow: 0 0 0 3px ${t.primarySoft}; }
    .ds-select:disabled { opacity: 0.6; cursor: not-allowed; }

    .ds-preset-group {
      display: inline-flex;
      padding: 3px;
      border-radius: 10px;
      background: ${t.bgSubtle};
      border: 1px solid ${t.border};
      flex-wrap: wrap;
    }
    .ds-preset-btn {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: ${t.textMuted};
      font-size: 12px;
      font-weight: 600;
      border-radius: 7px;
      cursor: pointer;
      transition: all 200ms ease;
      font-family: inherit;
    }
    .ds-preset-btn:hover { color: ${t.text}; }
    .ds-preset-btn.active {
      background: ${t.card};
      color: ${t.text};
      box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px ${t.border};
    }

    .ds-date-input {
      padding: 7px 10px;
      border-radius: 8px;
      border: 1px solid ${t.border};
      background: ${t.card};
      color: ${t.text};
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      color-scheme: ${t.name};
      transition: all 200ms ease;
    }
    .ds-date-input:hover { border-color: ${t.borderStrong}; }
    .ds-date-input:focus { outline: none; border-color: ${t.primary}; box-shadow: 0 0 0 3px ${t.primarySoft}; }

    .ds-card {
      position: relative;
      transition:
        transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 260ms ease,
        border-color 260ms ease;
    }
    .ds-card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: ${t.name === "dark" ? 1 : 0};
    }
    .ds-card:hover {
      transform: translateY(-3px);
      box-shadow: ${t.shadowHover};
      border-color: ${t.borderStrong} !important;
    }

    /* KPI card hover glow driven by per-card tone custom prop */
    .ds-kpi-card::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      transition: opacity 260ms ease;
      background: radial-gradient(
        400px circle at 50% -20%,
        var(--kpi-tone, transparent) 0%,
        transparent 50%
      );
      mix-blend-mode: ${t.name === "dark" ? "screen" : "multiply"};
    }
    .ds-kpi-card:hover::after {
      opacity: ${t.name === "dark" ? 0.12 : 0.08};
    }

    .ds-row { transition: background 150ms ease; }
    .ds-row:hover { background: ${t.bg}; }

    .ds-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      height: 36px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.005em;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 200ms ease;
      font-family: inherit;
      line-height: 1;
    }
    .ds-btn-secondary {
      background: ${t.card};
      color: ${t.text};
      border-color: ${t.border};
    }
    .ds-btn-secondary:hover {
      background: ${t.bg};
      border-color: ${t.borderStrong};
    }
    .ds-btn-ghost {
      background: transparent;
      color: ${t.textMuted};
    }
    .ds-btn-ghost:hover {
      background: ${t.bg};
      color: ${t.text};
    }

    .ds-pulse {
      position: relative;
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    .ds-pulse::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: inherit;
      animation: ds-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    @keyframes ds-pulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(2.6); opacity: 0; }
    }

    @keyframes ds-spin {
      to { transform: rotate(360deg); }
    }
    .ds-spinner {
      display: inline-block;
      border-radius: 50%;
      border-style: solid;
      border-width: 2.5px;
      animation: ds-spin 0.8s linear infinite;
      vertical-align: middle;
    }

    .ds-spin-icon {
      animation: ds-spin 0.9s linear infinite;
    }

    /* Top progress bar shown while a manual refresh is in flight */
    .ds-refresh-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 9999;
      background: linear-gradient(
        90deg,
        transparent 0%,
        ${t.primary} 50%,
        transparent 100%
      );
      background-size: 50% 100%;
      background-repeat: no-repeat;
      animation: ds-refresh-sweep 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
      pointer-events: none;
    }
    @keyframes ds-refresh-sweep {
      0% { background-position: -50% 0; }
      100% { background-position: 150% 0; }
    }

    .ds-skeleton {
      position: relative;
      overflow: hidden;
    }
    .ds-skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, ${t.border}, transparent);
      animation: ds-shimmer 1.5s infinite;
    }
    @keyframes ds-shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .apexcharts-tooltip {
      background: ${t.card} !important;
      border: 1px solid ${t.border} !important;
      box-shadow: ${t.shadowHover} !important;
      border-radius: 10px !important;
      font-family: inherit !important;
      color: ${t.text} !important;
    }
    .apexcharts-tooltip-title {
      background: ${t.bg} !important;
      border-bottom: 1px solid ${t.border} !important;
      color: ${t.textMuted} !important;
      font-weight: 600 !important;
      font-size: 11px !important;
    }
  `}</style>
);

/* ============================================================
   ICONS
   ============================================================ */
const svgBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const IconUsers = () => (
  <svg {...svgBase} width={18} height={18}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconBuilding = () => (
  <svg {...svgBase} width={18} height={18}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 21V9h6v12" />
  </svg>
);
const IconClipboard = () => (
  <svg {...svgBase} width={18} height={18}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);
const IconHeadset = () => (
  <svg {...svgBase} width={18} height={18}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" />
  </svg>
);
const IconActivity = () => (
  <svg {...svgBase} width={18} height={18}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconFileCheck = () => (
  <svg {...svgBase} width={18} height={18}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);
const IconClock = () => (
  <svg {...svgBase} width={10} height={10}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconCalendar = () => (
  <svg {...svgBase} width={14} height={14}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconLogout = () => (
  <svg {...svgBase}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconRefresh = () => (
  <svg {...svgBase}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IconAlert = () => (
  <svg {...svgBase} width={12} height={12}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/* ============================================================
   EXPORT
   ============================================================ */
const DashboardAdminPage: FC = () => {
  const intl = useIntl();
  return (
    <>
      <PageTitle breadcrumbs={[]}>{intl.formatMessage({ id: "MENU.DASHBOARD" })}</PageTitle>
      <DashboardAdminContent />
    </>
  );
};

export { DashboardAdminPage };
export default DashboardAdminPage;
