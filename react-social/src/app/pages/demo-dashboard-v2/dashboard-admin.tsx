import { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { createPortal } from "react-dom";
import { PageTitle } from "../../../_metronic/layout/core";
import { useThemeMode } from "../../../_metronic/partials/layout/theme-mode/ThemeModeProvider";
import { useAuth } from "../../modules/auth/core/Auth";
import { Scope } from "../../modules/auth";
import { getUserCollegeMappings } from "../Users/API/UserMapping_APIs";
import { getScopedAssessmentSummariesByInstitute } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import SearchableMultiSelect from "../../components/SearchableMultiSelect";
// Drop-in fork of SheetJS (same API) that also writes cell styles — needed for
// the bold title row on the card drill-down export.
import * as XLSX from "xlsx-js-style";
import { GetSessionsByInstituteCode } from "../College/API/College_APIs";
import { showErrorToast } from "../../utils/toast";
import {
  AdminDashboardSnapshot,
  fetchAdminDashboardSnapshot,
  refreshAdminDashboardSnapshot,
} from "./dashboard-admin.api";
import {
  OVERVIEW_CARD_KEYS,
  OverviewCard,
  OverviewCardKey,
  OverviewDetail,
  OverviewDetailColumn,
  OverviewQuery,
  fetchOverviewCard,
  fetchOverviewStudents,
} from "./dashboard-admin.overview.api";
import {
  applyInstituteAssessmentFilter,
  assessmentIdsAssignedTo,
  instituteKeysOf,
  stripTestEntities,
} from "./dashboard-admin.filter";
import {
  buildSchoolReportWorkbook,
  OverviewExportContext,
  overviewExportFileName,
  overviewExportTitle,
  overviewSheetName,
  schoolReportFileName,
  SectionLookup,
  SNO_HEADER,
  styleOverviewSheet,
} from "./dashboard-admin.export";

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


const toNum = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const applyScopeToSnapshot = (
  snap: AdminDashboardSnapshot,
  rules: Scope[],
  isSuperAdmin: boolean
): AdminDashboardSnapshot => {
  if (isSuperAdmin) return snap;
  if (!rules.length) {
    // Deny-by-default: a non-super-admin with no institute scope (neither
    // user_role_scope nor ContactPerson) sees nothing rather than the whole
    // platform — same rule as the BE AccessScopeService.
    return {
      ...snap,
      students: [],
      studentMappings: [],
      institutes: [],
      assessments: [],
      reports: [],
      appointments: [],
      counsellors: [],
      ratingSummary: [],
    };
  }

  const studentDims = (s: any) => ({
    i: toNum(pick(s, ["instituteId", "institute_id"])),
    s: toNum(pick(s, ["sessionId", "session_id"])),
    c: toNum(pick(s, ["courseCode", "course_code", "classId", "class_id"])),
    x: toNum(pick(s, ["schoolSectionId", "school_section_id", "sectionId"])),
  });

  const students = snap.students.filter((s) => matchesScope(rules, studentDims(s)));
  const studentMappings = snap.studentMappings.filter((s) => matchesScope(rules, studentDims(s)));

  // Institutes: match scope.i against the institute's code (the scope's
  // institute dimension stores `instituteCode`, not the DB row id).
  const institutes = snap.institutes.filter((inst) => {
    const code = toNum(pick(inst, ["instituteCode", "code", "id"]));
    return matchesScope(rules, { i: code });
  });

  // Reports/appointments don't carry institute/session/class/section on the
  // top-level object — we map them through their userStudent reference.
  const studentDimsById = new Map<string, ReturnType<typeof studentDims>>();
  studentMappings.forEach((s) => {
    const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
    if (sid) studentDimsById.set(sid, studentDims(s));
  });
  students.forEach((s) => {
    const sid = String(pick(s, ["userStudentId", "user_student_id", "id"]) ?? "");
    if (sid && !studentDimsById.has(sid)) studentDimsById.set(sid, studentDims(s));
  });

  const reportSid = (r: any) =>
    String(
      (r?.userStudent && (r.userStudent.userStudentId ?? r.userStudent.id ?? r.userStudent.studentId)) ??
        pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"]) ??
        ""
    );
  const reports = snap.reports.filter((r) => {
    const sid = reportSid(r);
    if (sid && studentDimsById.has(sid)) return true;
    // Reports without a resolvable student are dropped under a scoped session
    // — we can't prove they belong to the user.
    return false;
  });

  const apptSid = (a: any) =>
    String(
      (a?.student && (a.student.userStudentId ?? a.student.id)) ??
        pick(a, ["userStudentId", "studentId"]) ??
        ""
    );
  const appointments = snap.appointments.filter((a) => {
    const sid = apptSid(a);
    if (sid && studentDimsById.has(sid)) return true;
    return false;
  });

  return {
    ...snap,
    students,
    studentMappings,
    institutes,
    reports,
    appointments,
  };
};

/** A banner tile value from one overview card: "—" until it has loaded, "!" if it failed. */
const heroStat = (st: CardState | undefined, take: (c: OverviewCard) => any): string => {
  if (!st) return "\u2014";
  if (st.loading && !st.data) return "\u2014";
  if (st.error && !st.data) return "!";
  if (!st.data) return "\u2014";
  return fmtNum(Number(take(st.data) ?? 0));
};

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

  // ABAC scope context — used to filter the snapshot client-side so the
  // dashboard only ever shows the institutes/sessions/classes/sections the
  // current user is mapped to. Backend already filters via
  // DashboardDataService; this is defense-in-depth.
  const userScopes: Scope[] = useMemo(() => currentUser?.scopes ?? [], [currentUser]);
  const isSuperAdmin = currentUser?.superAdmin === true;

  // user_role_scope rows are the canonical scope source, but many school
  // accounts are only mapped via ContactPerson rows (the legacy "Map to
  // College" UI). Mirror useScopedAssessments: fall back to ContactPerson
  // institutes, and deny-by-default when neither source yields anything.
  // null = fallback not resolved yet.
  const [fallbackRules, setFallbackRules] = useState<Scope[] | null>(null);
  // Institute code -> name, resolved from the caller's ContactPerson mappings.
  // Populated for every non-super-admin (even when user_role_scope already
  // supplies the rules) so the hero "Institute" card can name the mapped
  // institute even if the snapshot's institutes section is empty or fails.
  const [contactInstituteNames, setContactInstituteNames] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    if (isSuperAdmin || currentUser?.id == null) {
      setFallbackRules([]);
      return;
    }
    let cancelled = false;
    getUserCollegeMappings(currentUser.id)
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = res.data || [];
        const names = new Map<number, string>();
        rows.forEach((cp: any) => {
          const code = Number(cp.institute?.instituteCode ?? cp.instituteCode);
          const name = cp.institute?.instituteName ?? cp.instituteName;
          if (Number.isFinite(code) && name) names.set(code, name);
        });
        setContactInstituteNames(names);
        // user_role_scope is the canonical rules source; only fall back to
        // ContactPerson institutes when it gave nothing.
        const rules: Scope[] =
          userScopes.length > 0 ? [] : Array.from(names.keys()).map((i) => ({ i }));
        setFallbackRules(rules);
      })
      .catch(() => {
        if (!cancelled) setFallbackRules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, userScopes.length, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveRules = useMemo<Scope[]>(
    () => (userScopes.length > 0 ? userScopes : fallbackRules ?? []),
    [userScopes, fallbackRules]
  );
  // Hold the snapshot fetch until scope is resolved so the first paint can't
  // flash unscoped platform-wide data to a school account.
  const scopeReady = isSuperAdmin || userScopes.length > 0 || fallbackRules !== null;
  const scopeDenied = scopeReady && !isSuperAdmin && effectiveRules.length === 0;
  // School mode: a scoped (non-super-admin) viewer gets an institute-focused
  // dashboard — platform-wide widgets are hidden below.
  const schoolMode = !isSuperAdmin;

  // raw data (post-ABAC scope, pre view-filter — see `viewFiltered` below)
  const [rawStudents, setRawStudents] = useState<any[]>([]);
  const [rawInstitutes, setRawInstitutes] = useState<any[]>([]);
  const [counsellors, setCounsellors] = useState<any[]>([]);
  const [rawAppointments, setRawAppointments] = useState<any[]>([]);
  const [ratingSummary, setRatingSummary] = useState<any[]>([]);
  const [rawAssessments, setRawAssessments] = useState<any[]>([]);
  // Defense-in-depth narrowing of the snapshot's `assessments` section.
  // Mirrors the BE rule (DashboardDataService#queryAssessments and
  // /assessments/get/list-summary-by-institute): assessments with an active
  // AssessmentInstituteMapping to a scoped institute UNIONED with assessments
  // that institute's students are allotted to. The union matters for schools
  // whose assessments were mapped only through the school registration config
  // (never mirrored into assessment_institute_mapping) — intersecting with the
  // mapping table alone hid those from the school's own dashboard.
  // null = no restriction (super-admin / wildcard / still resolving).
  const [scopedAssessmentIds, setScopedAssessmentIds] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (isSuperAdmin || !scopeReady || effectiveRules.length === 0) {
      setScopedAssessmentIds(null);
      return;
    }
    if (effectiveRules.some((r) => r.i == null)) {
      // wildcard institute rule → every institute's assessments are in scope
      setScopedAssessmentIds(null);
      return;
    }
    const codes = Array.from(
      new Set(effectiveRules.map((r) => r.i).filter((v): v is number => v != null))
    );
    let cancelled = false;
    Promise.all(
      codes.map((code) =>
        getScopedAssessmentSummariesByInstitute(code)
          .then((res: any) =>
            (res.data || [])
              .map((a: any) => Number(a.id ?? a.assessmentId))
              .filter((v: number) => Number.isFinite(v))
          )
          .catch(() => [] as number[])
      )
    ).then((perInstitute) => {
      if (cancelled) return;
      const ids = new Set<number>();
      perInstitute.forEach((arr) => arr.forEach((id) => Number.isFinite(id) && ids.add(id)));
      setScopedAssessmentIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, scopeReady, effectiveRules]);

  const scopedAssessments = useMemo(
    () =>
      scopedAssessmentIds == null
        ? rawAssessments
        : rawAssessments.filter((a: any) =>
            scopedAssessmentIds.has(Number(a?.id ?? a?.assessmentId))
          ),
    [rawAssessments, scopedAssessmentIds]
  );
  const [rawReports, setRawReports] = useState<any[]>([]);
  const [rawStudentMappings, setRawStudentMappings] = useState<any[]>([]);

  // ---- Super-admin view filter: a set of institutes and/or a set of assessments ----
  // `viewInstitutes`/`viewAssessmentIds` are the APPLIED values (set on Search);
  // the pickers edit `draftInstitutes`/`draftAssessmentIds` below.
  // Applied client-side to the loaded snapshot (it already holds every row for
  // a super-admin), so the KPIs, drill-downs and tables below narrow without
  // any of their code changing. Hidden for scoped (school) viewers, who are
  // already narrowed by ABAC.
  const [viewInstitutes, setViewInstitutes] = useState<string[]>([]);
  const [viewAssessmentIds, setViewAssessmentIds] = useState<string[]>([]);
  // Draft picker values — copied into viewInstitutes/viewAssessmentIds on Search.
  const [draftInstitutes, setDraftInstitutes] = useState<string[]>([]);
  const [draftAssessmentIds, setDraftAssessmentIds] = useState<string[]>([]);
  // Institute rows for a list of picked codes (unknown codes dropped), and the
  // union of their filter keys — null when nothing is picked (= no narrowing).
  const instituteRowsFor = useCallback(
    (codes: string[]): any[] =>
      codes
        .map((code) => rawInstitutes.find((i) => String(pick(i, ["instituteCode", "code"]) ?? "") === code))
        .filter(Boolean),
    [rawInstitutes]
  );
  const draftInstituteRows = useMemo(() => instituteRowsFor(draftInstitutes), [instituteRowsFor, draftInstitutes]);
  const draftInstituteKeys = useMemo(() => unionInstituteKeys(draftInstituteRows), [draftInstituteRows]);
  const viewInstituteRows = useMemo(() => instituteRowsFor(viewInstitutes), [instituteRowsFor, viewInstitutes]);
  const viewInstituteKeys = useMemo(() => unionInstituteKeys(viewInstituteRows), [viewInstituteRows]);
  // Assessments offered in the picker: only those assigned to students at any
  // of the chosen institutes (or every scoped assessment when none is chosen).
  const viewAssessmentOptions = useMemo(() => {
    let pool = scopedAssessments;
    if (draftInstituteKeys) {
      const assigned = assessmentIdsAssignedTo(
        rawStudentMappings.filter((m) =>
          draftInstituteKeys.has(String(pick(m, ["instituteId", "institute_id"]) ?? ""))
        )
      );
      pool = pool.filter((a) => assigned.has(String(pick(a, ["id", "assessmentId"]) ?? "")));
    }
    return pool
      .map((a) => ({
        value: String(pick(a, ["id", "assessmentId"]) ?? ""),
        label: String(pick(a, ["assessmentName", "name", "title"]) || `Assessment #${pick(a, ["id", "assessmentId"])}`),
      }))
      .filter((o) => o.value)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [scopedAssessments, rawStudentMappings, draftInstituteKeys]);
  // Drop selections that are no longer offered (e.g. after switching institute).
  useEffect(() => {
    if (draftAssessmentIds.length === 0) return;
    const offered = new Set(viewAssessmentOptions.map((o) => o.value));
    const kept = draftAssessmentIds.filter((id) => offered.has(id));
    if (kept.length !== draftAssessmentIds.length) setDraftAssessmentIds(kept);
  }, [viewAssessmentOptions, draftAssessmentIds]);
  const viewFilterActive = isSuperAdmin && (viewInstituteKeys != null || viewAssessmentIds.length > 0);

  const viewFiltered = useMemo(
    () =>
      applyInstituteAssessmentFilter(
        {
          students: rawStudents,
          institutes: rawInstitutes,
          counsellors,
          appointments: rawAppointments,
          ratingSummary,
          assessments: scopedAssessments,
          reports: rawReports,
          studentMappings: rawStudentMappings,
        },
        {
          instituteKeys: isSuperAdmin ? viewInstituteKeys : null,
          assessmentIds: isSuperAdmin && viewAssessmentIds.length > 0 ? new Set(viewAssessmentIds) : null,
        }
      ),
    [
      rawStudents, rawInstitutes, counsellors, rawAppointments, ratingSummary,
      scopedAssessments, rawReports, rawStudentMappings,
      isSuperAdmin, viewInstituteKeys, viewAssessmentIds,
    ]
  );
  const { institutes, assessments, reports, studentMappings } = viewFiltered;
  // The institutes a scoped (school) viewer is mapped to, each resolved to its
  // name and region (city/state). The scope carries only institute codes, so
  // resolve each from the fullest source available: the scoped snapshot
  // institutes, then the unfiltered snapshot, then the caller's ContactPerson
  // mappings (name only). This keeps the mapped institute named even when the
  // snapshot's institutes section is empty or failed, and feeds both the hero
  // "Institute" card and the card-drill-down Excel naming so it matches the
  // main-dashboard exports. Empty for super-admins and wildcard scopes.
  const scopedInstitutes = useMemo<{ code: number; name: string; region: string }[]>(() => {
    if (isSuperAdmin) return [];
    if (effectiveRules.some((r) => r.i == null)) return []; // wildcard institute scope
    const codes = Array.from(
      new Set(
        effectiveRules
          .map((r) => (r.i == null ? null : Number(r.i)))
          .filter((v): v is number => v != null && Number.isFinite(v))
      )
    );
    return codes.map((code) => {
      const inSnap = (list: any[]) =>
        list.find((i) => Number(pick(i, ["instituteCode", "code", "id"])) === code);
      const row = inSnap(institutes) || inSnap(rawInstitutes);
      const name =
        (row && String(pick(row, ["instituteName", "name"]) || "")) ||
        contactInstituteNames.get(code) ||
        "";
      const region = row ? String(pick(row, ["city", "state"]) || "") : "";
      return { code, name, region };
    });
  }, [isSuperAdmin, effectiveRules, institutes, rawInstitutes, contactInstituteNames]);
  // Hero "Institute" label. null => name not resolved yet (show a placeholder,
  // not "Not mapped") or let the default institutes[] logic decide. As soon as
  // the ContactPerson name fetch resolves (fast, independent of the slow
  // snapshot) this returns the name, so the card fills in with the other tiles.
  const scopedInstituteLabel = useMemo<string | null>(() => {
    if (isSuperAdmin || effectiveRules.some((r) => r.i == null)) return null;
    if (scopedInstitutes.length === 0) return null;
    if (scopedInstitutes.length > 1) return `${scopedInstitutes.length} institutes`;
    return scopedInstitutes[0].name || null;
  }, [isSuperAdmin, effectiveRules, scopedInstitutes]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  // Cache freshness — backend stamps the original compute time onto every
  // payload (cached or fresh), so we can show "updated X ago" regardless of
  // whether this load came from Redis or from a live DB compute.
  const [computedAt, setComputedAt] = useState<string | undefined>(undefined);
  const [cacheHit, setCacheHit] = useState<boolean | undefined>(undefined);

  // ---- Filters: DRAFT (what the pickers show) vs APPLIED (what the cards use) ----
  // Nothing below the filter bars reacts to a click until Search is pressed.
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [applied, setApplied] = useState<AppliedFilters>(() => ({
    rangeKey: "30d",
    customStart: "",
    customEnd: "",
    range: computeRange("30d", "", ""),
    nonce: 0,
  }));

  const customIncomplete = rangeKey === "custom" && (!customStart || !customEnd);
  const filtersDirty =
    rangeKey !== applied.rangeKey ||
    (rangeKey === "custom" &&
      (customStart !== applied.customStart || customEnd !== applied.customEnd)) ||
    draftInstitutes.join(",") !== viewInstitutes.join(",") ||
    draftAssessmentIds.join(",") !== viewAssessmentIds.join(",");

  const handleSearch = () => {
    if (customIncomplete) return;
    setViewInstitutes(draftInstitutes);
    setViewAssessmentIds(draftAssessmentIds);
    setApplied((prev) => ({
      rangeKey,
      customStart,
      customEnd,
      range: computeRange(rangeKey, customStart, customEnd),
      // bumps even when nothing changed, so Search always re-queries
      nonce: prev.nonce + 1,
    }));
  };

  // The query every overview card is fetched with. Memoised on the APPLIED
  // values only, so the cards ignore the pickers until Search. null = hold
  // (scope still resolving, or the viewer is mapped to nothing).
  const overviewQuery = useMemo<OverviewQuery | null>(() => {
    if (!scopeReady || scopeDenied) return null;
    return {
      from: applied.range.start ? toLocalISODate(applied.range.start) : null,
      to: applied.range.end ? toLocalISODate(applied.range.end) : null,
      instituteCodes: isSuperAdmin ? viewInstitutes : [],
      assessmentIds: isSuperAdmin ? viewAssessmentIds : [],
    };
  }, [scopeReady, scopeDenied, applied, isSuperAdmin, viewInstitutes, viewAssessmentIds]);
  // Naming for the card drill-down Excel: "CAREER-9 <assessment> - <school>, <region>".
  // Super-admins name the institutes via the view filter; school viewers get
  // their mapped institute(s) from scopedInstitutes, which survives an empty or
  // failed snapshot so the file is named the same way as the main-dashboard
  // (Live Tracking) export.
  const overviewExportContext = useMemo<OverviewExportContext>(() => {
    const assessmentNames = scopedAssessments
      .filter((a) => viewAssessmentIds.includes(String(pick(a, ["id", "assessmentId"]) ?? "")))
      .map((a) => String(pick(a, ["assessmentName", "name", "title"]) || ""))
      .filter(Boolean);
    if (isSuperAdmin) {
      return {
        assessmentNames,
        instituteName: viewInstituteRows
          .map((r) => String(pick(r, ["instituteName", "name"]) || ""))
          .filter(Boolean)
          .join(" & "),
        region:
          viewInstituteRows.length === 1
            ? String(pick(viewInstituteRows[0], ["city", "state"]) || "")
            : "",
      };
    }
    return {
      assessmentNames: [],
      instituteName: scopedInstitutes.map((i) => i.name).filter(Boolean).join(" & "),
      region: scopedInstitutes.length === 1 ? scopedInstitutes[0].region : "",
    };
  }, [isSuperAdmin, viewInstituteRows, scopedInstitutes, scopedAssessments, viewAssessmentIds]);
  const overview = useOverviewCards(overviewQuery, refreshNonce);
  const refreshing = loading || overview.busy;
  const [manualRefresh, setManualRefresh] = useState(false);

  const handleRefresh = () => {
    if (refreshing) return;
    setManualRefresh(true);
    setRefreshNonce((n) => n + 1);
  };

  // "Export for school": two-sheet workbook (Summary + Students) built from
  // the view-filtered snapshot — lifetime numbers, the date range is ignored.
  // Class/section names come from the institute hierarchy; if that call
  // fails we fall back to the flat `studentClass` column on each student.
  const [exporting, setExporting] = useState(false);
  const handleExportForSchool = async () => {
    if (viewInstituteRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      const instituteName = viewInstituteRows
        .map((r) => String(pick(r, ["instituteName", "name"]) || `Institute ${pick(r, ["instituteCode", "code"])}`))
        .join(" & ");
      const sectionLookup: SectionLookup = new Map();
      // One hierarchy call per selected institute; a failed one just falls back
      // to the flat class column for that institute's students.
      const hierarchies = await Promise.all(
        viewInstitutes.map((code) => GetSessionsByInstituteCode(code).catch(() => null))
      );
      for (const res of hierarchies) {
        for (const session of (res as any)?.data || []) {
          for (const cls of session?.schoolClasses || []) {
            for (const sec of cls?.schoolSections || []) {
              if (sec?.id != null && !sectionLookup.has(Number(sec.id))) {
                sectionLookup.set(Number(sec.id), {
                  className: String(cls?.className ?? ""),
                  sectionName: String(sec?.sectionName ?? ""),
                });
              }
            }
          }
        }
      }
      const selectedNames = viewAssessmentOptions
        .filter((o) => viewAssessmentIds.includes(o.value))
        .map((o) => o.label);
      const exportedAt = new Date();
      const wb = buildSchoolReportWorkbook({
        assessments,
        studentMappings,
        reports,
        sectionLookup,
        instituteName,
        exportedAt,
        assessmentFilterLabel: selectedNames.length ? selectedNames.join(", ") : "All assessments",
      });
      XLSX.writeFile(wb, schoolReportFileName(instituteName, exportedAt));
    } catch (e: any) {
      showErrorToast(`Export failed: ${e?.message || "unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // Clear the manual-refresh flag once everything settles
  useEffect(() => {
    if (manualRefresh && !refreshing) {
      const t = setTimeout(() => setManualRefresh(false), 250);
      return () => clearTimeout(t);
    }
  }, [manualRefresh, refreshing]);


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Single cached snapshot call: returns a 24h-cached blob from the server (or
  // recomputes server-side if older). Manual refresh forces a recompute.
  useEffect(() => {
    if (!scopeReady) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const raw = manualRefresh
          ? await refreshAdminDashboardSnapshot()
          : await fetchAdminDashboardSnapshot();
        if (cancelled) return;
        // Test records (anything with "test" in a name / email / login) never
        // reach a count, a table or an export — same rule as the card queries.
        const snap = stripTestEntities(applyScopeToSnapshot(raw, effectiveRules, isSuperAdmin));
        setRawStudents(snap.students);
        setRawInstitutes(snap.institutes);
        setCounsellors(snap.counsellors);
        setRawAppointments(snap.appointments);
        setRatingSummary(snap.ratingSummary);
        setRawAssessments(snap.assessments);
        setRawReports(snap.reports);
        setRawStudentMappings(snap.studentMappings);
        setComputedAt(snap.computedAt);
        setCacheHit(snap.cacheHit);
        setErrors((prev) => {
          const { snapshot: _omit, ...rest } = prev;
          return rest;
        });
      } catch (e: any) {
        if (cancelled) return;
        const status = e?.response?.status;
        const msg = status ? `HTTP ${status}` : e?.message || "request failed";
        setErrors((prev) => ({ ...prev, snapshot: msg }));
        // eslint-disable-next-line no-console
        console.error("[admin dashboard] snapshot failed:", status, e?.response?.data || e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, effectiveRules, isSuperAdmin, scopeReady]); // eslint-disable-line react-hooks/exhaustive-deps


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
          computedAt={computedAt}
          cacheHit={cacheHit}
          error={
            Object.keys(errors).length > 0
              ? `${Object.keys(errors).length} source(s) failed`
              : null
          }
          quickStats={
            schoolMode
              ? [
                  {
                    label: "Institute",
                    value:
                      scopedInstituteLabel != null
                        ? scopedInstituteLabel
                        : loading
                        ? "—"
                        : institutes.length > 1
                        ? `${institutes.length} institutes`
                        : institutes[0]?.instituteName || "Not mapped",
                  },
                  { label: "Sign-ups", value: heroStat(overview.states.signups, (c) => c.value) },
                  { label: "Assessments used", value: heroStat(overview.states["active-assessments"], (c) => c.extra.withCompletions) },
                ]
              : [
                  { label: "Sign-ups", value: heroStat(overview.states.signups, (c) => c.value) },
                  { label: "Institutes", value: heroStat(overview.states.signups, (c) => c.extra.institutes) },
                  { label: "Assessments used", value: heroStat(overview.states["active-assessments"], (c) => c.extra.withCompletions) },
                ]
          }
          quickStatsCaption={`${rangeLabel(applied.rangeKey, applied.range)}${
            isSuperAdmin && viewInstitutes.length > 0
              ? " · " +
                (viewInstitutes.length === 1
                  ? String(pick(viewInstituteRows[0], ["instituteName", "name"]) || `institute ${viewInstitutes[0]}`)
                  : `${viewInstitutes.length} institutes`)
              : ""
          }${isSuperAdmin && viewAssessmentIds.length > 0 ? ` · ${viewAssessmentIds.length} ${viewAssessmentIds.length === 1 ? "assessment" : "assessments"}` : ""}`}
        />

        {scopeDenied && (
          <div
            style={{
              marginTop: 24,
              padding: "18px 22px",
              borderRadius: 14,
              background: t.warningSoft,
              border: `1px solid ${t.warning}`,
              color: t.text,
              fontSize: "0.9rem",
            }}
          >
            <strong>No institute is mapped to your account.</strong>{" "}
            This dashboard only shows data for your own institute, and your
            account isn't linked to one yet — ask an administrator to map you
            to your institute.
          </div>
        )}

        <DateRangeBar
          t={t}
          rangeKey={rangeKey}
          setRangeKey={setRangeKey}
          customStart={customStart}
          customEnd={customEnd}
          setCustomStart={setCustomStart}
          setCustomEnd={setCustomEnd}
          appliedLabel={rangeLabel(applied.rangeKey, applied.range)}
          appliedRange={applied.range}
          dirty={filtersDirty}
          canSearch={!customIncomplete && scopeReady && !scopeDenied}
          searching={overview.busy}
          onSearch={handleSearch}
        />

        {/* VIEW FILTER + SCHOOL EXPORT — super-admin only; draft until Search */}
        {isSuperAdmin && (
          <ViewFilterBar
            t={t}
            institutes={rawInstitutes}
            draftInstitutes={draftInstitutes}
            setDraftInstitutes={setDraftInstitutes}
            assessmentOptions={viewAssessmentOptions}
            draftAssessmentIds={draftAssessmentIds}
            setDraftAssessmentIds={setDraftAssessmentIds}
            appliedActive={viewFilterActive}
            exportEnabled={viewInstitutes.length > 0}
            loading={loading}
            exporting={exporting}
            onExport={handleExportForSchool}
            studentCount={studentMappings.length}
          />
        )}

        {/* OVERVIEW CARDS — one API call per card, all in flight at once; each
            tile paints the moment its own number lands. Nothing here reacts to
            the pickers until Search is pressed (see `applied`). */}
        <OverviewSection
          t={t}
          states={overview.states}
          retry={overview.retry}
          appliedRangeKey={applied.rangeKey}
          appliedRange={applied.range}
          denied={scopeDenied}
          query={overviewQuery}
          exportContext={overviewExportContext}
        />
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
  /** ISO timestamp of when the backend payload was originally computed. */
  computedAt?: string;
  /** True if this payload was served from Redis (vs. a fresh DB compute). */
  cacheHit?: boolean;
  quickStats: { label: string; value: string }[];
  /** What window / filters the tiles reflect. */
  quickStatsCaption?: string;
}> = ({ greeting, name, date, onLogout, onRefresh, refreshing, loading, error, computedAt, cacheHit, quickStats, quickStatsCaption }) => (
  <div className="ds-hero">
    <div className="ds-hero-grid" />
    <div className="ds-hero-glow ds-hero-glow-1" />
    <div className="ds-hero-glow ds-hero-glow-2" />
    <div className="ds-hero-glow ds-hero-glow-3" />

    <div className="ds-hero-content">
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
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
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            margin: "2px 0 0",
            lineHeight: 1.1,
          }}
        >
          {name}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            margin: "6px 0 0",
            maxWidth: 560,
          }}
        >
          Here's what's happening across your network — institutes, assessments, and students in one place.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
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
        {computedAt && (
          <div
            title={
              cacheHit
                ? `Served from cache · original compute: ${new Date(computedAt).toLocaleString()}`
                : `Fresh compute: ${new Date(computedAt).toLocaleString()}`
            }
            style={{
              marginLeft: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              background: cacheHit
                ? "rgba(251, 191, 36, 0.18)"
                : "rgba(52, 211, 153, 0.18)",
              color: cacheHit ? "#fcd34d" : "#a7f3d0",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            <span
              className="ds-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: cacheHit ? "#fbbf24" : "#34d399",
              }}
            />
            {cacheHit ? "cached" : "fresh"} · updated {relativeTime(computedAt)}
          </div>
        )}
        </div>
      </div>

      <div className="ds-hero-stats-wrap">
      <div className="ds-hero-stats">
        {quickStats.map((s, i) => (
          <div key={s.label} className="ds-hero-stat" style={{ animationDelay: `${i * 80}ms` }}>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.55)",
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </div>
            <div
              title={s.value}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#ffffff",
                fontVariantNumeric: "tabular-nums",
                marginTop: 2,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                maxWidth: 150,
                overflowWrap: "break-word",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      {quickStatsCaption && (
        <div className="ds-hero-stats-caption">
          <IconClock /> {quickStatsCaption}
        </div>
      )}
      </div>
    </div>
  </div>
);

/* ============================================================
   DATE RANGE (draft → Search → applied)
   ============================================================ */
type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "all" | "custom";
type DateRange = { start: Date | null; end: Date | null };
type AppliedFilters = {
  rangeKey: RangeKey;
  customStart: string;
  customEnd: string;
  range: DateRange;
  /** Bumped on every Search so identical filters still re-query. */
  nonce: number;
};

const RANGE_PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

const startOfDay = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};
const endOfDay = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};

/** Union of the filter keys of several institute rows; null when none are picked (= no narrowing). */
const unionInstituteKeys = (rows: any[]): Set<string> | null => {
  if (rows.length === 0) return null;
  const keys = new Set<string>();
  rows.forEach((r) => instituteKeysOf(r).forEach((k) => keys.add(k)));
  return keys;
};

/** Local-calendar yyyy-mm-dd. (toISOString() would roll "today 00:00" back a day east of UTC.) */
const toLocalISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const computeRange = (key: RangeKey, customStart: string, customEnd: string): DateRange => {
  const today = new Date();
  if (key === "all") return { start: null, end: null };
  if (key === "custom") {
    if (!customStart || !customEnd) return { start: null, end: null };
    // "T00:00:00" forces local-time parsing; a bare date parses as UTC midnight.
    return {
      start: startOfDay(new Date(`${customStart}T00:00:00`)),
      end: endOfDay(new Date(`${customEnd}T00:00:00`)),
    };
  }
  if (key === "today") return { start: startOfDay(today), end: endOfDay(today) };
  if (key === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { start: startOfDay(start), end: endOfDay(today) };
};

const fmtShortDate = (d: Date) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const rangeLabel = (key: RangeKey, range: DateRange): string => {
  const preset = RANGE_PRESETS.find((p) => p.key === key);
  if (preset) return preset.label;
  if (!range.start || !range.end) return "Custom";
  return `${fmtShortDate(range.start)} – ${fmtShortDate(range.end)}`;
};

const DateRangeBar: FC<{
  t: Theme;
  rangeKey: RangeKey;
  setRangeKey: (k: RangeKey) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (s: string) => void;
  setCustomEnd: (s: string) => void;
  appliedLabel: string;
  appliedRange: DateRange;
  dirty: boolean;
  canSearch: boolean;
  searching: boolean;
  onSearch: () => void;
}> = ({
  t,
  rangeKey,
  setRangeKey,
  customStart,
  customEnd,
  setCustomStart,
  setCustomEnd,
  appliedLabel,
  appliedRange,
  dirty,
  canSearch,
  searching,
  onSearch,
}) => (
  <div
    style={{
      marginTop: 12,
      padding: "12px 18px",
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
      {RANGE_PRESETS.map((p) => (
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
          max={customEnd || toLocalISODate(new Date())}
          onChange={(e) => setCustomStart(e.target.value)}
        />
        <span style={{ color: t.textMuted, fontSize: 12 }}>to</span>
        <input
          type="date"
          className="ds-date-input"
          value={customEnd}
          min={customStart || undefined}
          max={toLocalISODate(new Date())}
          onChange={(e) => setCustomEnd(e.target.value)}
        />
      </div>
    )}

    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
        <span>Showing:</span>
        <span style={{ fontWeight: 700, color: t.text }}>{appliedLabel}</span>
        {appliedRange.start && appliedRange.end && (
          <span style={{ color: t.textSubtle }}>
            ({appliedRange.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} –{" "}
            {appliedRange.end.toLocaleDateString(undefined, { day: "numeric", month: "short" })})
          </span>
        )}
        {dirty && <span className="ds-dirty-pill">Unapplied</span>}
      </div>
      <button
        className={`ds-search-btn ${dirty ? "dirty" : ""}`}
        disabled={!canSearch || searching}
        onClick={onSearch}
        title={
          !canSearch
            ? "Pick both custom dates first"
            : dirty
            ? "Apply the selected date range and view filters"
            : "Re-run every card with the current filters"
        }
      >
        {searching ? <Spinner color="#fff" size={14} /> : <IconSearch />}
        Search
      </button>
    </div>
  </div>
);

/* ============================================================
   VIEW FILTER BAR (super-admin: institute + assessments + export)
   Selections here are DRAFT until Search is pressed.
   ============================================================ */
const ViewFilterBar: FC<{
  t: Theme;
  institutes: any[];
  draftInstitutes: string[];
  setDraftInstitutes: (codes: string[]) => void;
  assessmentOptions: { value: string; label: string }[];
  draftAssessmentIds: string[];
  setDraftAssessmentIds: (ids: string[]) => void;
  appliedActive: boolean;
  exportEnabled: boolean;
  loading: boolean;
  exporting: boolean;
  onExport: () => void;
  studentCount: number;
}> = ({
  t,
  institutes,
  draftInstitutes,
  setDraftInstitutes,
  assessmentOptions,
  draftAssessmentIds,
  setDraftAssessmentIds,
  appliedActive,
  exportEnabled,
  loading,
  exporting,
  onExport,
  studentCount,
}) => {
  const instituteOptions = useMemo(
    () =>
      institutes
        .map((i) => {
          const code = pick(i, ["instituteCode", "code"]);
          return {
            value: String(code ?? ""),
            label: String(pick(i, ["instituteName", "name"]) || `Institute #${code ?? "?"}`),
          };
        })
        .filter((o) => o.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [institutes]
  );
  const draftActive = draftInstitutes.length > 0 || draftAssessmentIds.length > 0;

  return (
    <div
      style={{
        marginTop: 12,
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
        <IconBuilding />
        <span style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>View</span>
      </div>

      <SearchableMultiSelect
        options={instituteOptions}
        value={draftInstitutes}
        onChange={setDraftInstitutes}
        placeholder={loading ? "Loading…" : "All institutes"}
        disabled={loading || instituteOptions.length === 0}
        style={{ minWidth: 260, flex: 1, maxWidth: 480 }}
      />
      <SearchableMultiSelect
        options={assessmentOptions}
        value={draftAssessmentIds}
        onChange={setDraftAssessmentIds}
        placeholder={loading ? "Loading…" : "All assessments"}
        disabled={loading || assessmentOptions.length === 0}
        style={{ minWidth: 280, flex: 1, maxWidth: 560 }}
      />
      {draftActive && (
        <button
          className="ds-preset-btn"
          onClick={() => {
            setDraftInstitutes([]);
            setDraftAssessmentIds([]);
          }}
          title="Clear the pickers (press Search to apply)"
        >
          Clear
        </button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {appliedActive && (
          <Pill t={t} tone="primary">
            {fmtNum(studentCount)} {studentCount === 1 ? "student" : "students"} in view
          </Pill>
        )}
        <button
          className="ds-export-btn"
          disabled={!exportEnabled || loading || exporting}
          onClick={onExport}
          title={
            exportEnabled
              ? "Download a two-sheet Excel report (summary + per-student rows) for the selected school(s)"
              : "Choose one or more institutes and press Search to export their report"
          }
        >
          {exporting ? <Spinner color="#fff" size={14} /> : <IconDownload />}
          {exporting ? "Preparing…" : "Export for school (.xlsx)"}
        </button>
      </div>
    </div>
  );
};

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

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

const toneColors = (t: Theme, k: Tone): { solid: string; soft: string } => {
  switch (k) {
    case "primary": return { solid: t.primary, soft: t.primarySoft };
    case "success": return { solid: t.success, soft: t.successSoft };
    case "warning": return { solid: t.warning, soft: t.warningSoft };
    case "danger": return { solid: t.danger, soft: t.dangerSoft };
    case "info": return { solid: t.info, soft: t.infoSoft };
    case "purple": return { solid: t.purple, soft: t.purpleSoft };
  }
};

type Fact = { label: string; value: string; tone?: Tone };
type MeterSeg = { label: string; value: number; tone: Tone };
type Tile = { label: string; value: number; tone: Tone; hint?: string };

const KpiCard: FC<{
  t: Theme;
  tone: { solid: string; soft: string };
  icon: ReactNode;
  title: string;
  value: string;
  /** One short line saying what the number is. */
  note?: string;
  /** Secondary numbers, shown as labelled chips. */
  facts?: Fact[];
  /** Composition of the headline number, shown as a thin stacked meter with a legend. */
  meter?: MeterSeg[];
  /** Mini stat tiles (one per group) under the headline. */
  tiles?: Tile[];
  /** Span two grid columns. */
  wide?: boolean;
  /** Error / placeholder text (replaces note, facts and meter). */
  caption?: string;
  loading?: boolean;
  errored?: boolean;
  /** Shows the "IN RANGE" chip — the number honoured the applied date window. */
  dateFiltered?: boolean;
  /** Extra chip, e.g. LIVE, for cards that do not follow the date window. */
  badge?: { label: string; tone: Tone; title?: string; icon?: ReactNode };
  warn?: string;
  /** Tiny footer text (server timing / thread). */
  meta?: string;
  /** When set, an inline "Retry" appears next to the caption. */
  onRetry?: () => void;
  /** When set, the whole card is a button (opens the drill-down). */
  onClick?: () => void;
}> = ({ t, tone, icon, title, value, note, facts, meter, tiles, wide, caption, loading, errored, dateFiltered, badge, warn, meta, onRetry, onClick }) => {
  const meterTotal = meter ? meter.reduce((a, s) => a + Math.max(0, s.value), 0) : 0;
  return (
    <div
      className={`ds-card ds-kpi-card ${onClick ? "clickable" : ""} ${wide ? "ds-kpi-wide" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? "Click to see the students behind this number" : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        background: t.card,
        border: `1px solid ${errored ? t.dangerSoft : t.border}`,
        // @ts-ignore — CSS custom props drive the tint, glow and link colour
        ["--kpi-tone" as any]: tone.solid,
        ["--kpi-soft" as any]: tone.soft,
      }}
    >
      <span className="ds-kpi-wash" aria-hidden />
      <span className="ds-kpi-topline" aria-hidden style={{ opacity: errored ? 0 : 1 }} />

      <div className="ds-kpi-top">
        <div className="ds-kpi-icon" style={errored ? { background: t.dangerSoft, color: t.danger, boxShadow: "none" } : undefined}>
          {errored ? <IconAlert /> : icon}
        </div>
        <div className="ds-kpi-chips">
          {warn && (
            <span className="ds-chip" title={warn} style={{ color: t.warning, background: t.warningSoft, cursor: "help" }}>
              <IconAlert /> APPROX
            </span>
          )}
          {badge && (
            <span
              className="ds-chip"
              title={badge.title}
              style={{ color: toneColors(t, badge.tone).solid, background: toneColors(t, badge.tone).soft, cursor: badge.title ? "help" : "default" }}
            >
              {badge.icon}
              {badge.label}
            </span>
          )}
          {dateFiltered && (
            <span className="ds-chip" title="Narrowed by the applied date range" style={{ color: t.primary, background: t.primarySoft }}>
              <IconClock /> IN RANGE
            </span>
          )}
        </div>
      </div>

      <div className="ds-kpi-title">{title}</div>
      <div className="ds-kpi-value" style={{ color: t.text }}>
        {loading ? <Spinner color={tone.solid} size={24} /> : value}
      </div>

      {errored || (!note && !facts?.length && !meter?.length && !tiles?.length) ? (
        <div className="ds-kpi-note" style={{ color: errored ? t.danger : t.textMuted }}>
          {caption}
          {onRetry && (
            <button className="ds-retry-link" onClick={(e) => { e.stopPropagation(); onRetry(); }}>
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          {note && <div className="ds-kpi-note" style={{ color: t.textMuted }}>{note}</div>}
          {tiles && tiles.length > 0 && (
            <div className="ds-kpi-tiles">
              {tiles.map((tile) => {
                const c = toneColors(t, tile.tone);
                return (
                  <div key={tile.label} className="ds-kpi-tile" title={tile.hint} style={{ background: c.soft, borderColor: `${c.solid}33` }}>
                    <span className="ds-kpi-tile-dot" style={{ background: c.solid }} />
                    <span className="ds-kpi-tile-value" style={{ color: t.text }}>{fmtNum(tile.value)}</span>
                    <span className="ds-kpi-tile-label" style={{ color: c.solid }}>{tile.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {meter && meterTotal > 0 && (
            <div className="ds-kpi-meter">
              <div className="ds-kpi-meter-bar" style={{ background: t.bgSubtle }}>
                {meter.filter((s) => s.value > 0).map((s) => (
                  <span
                    key={s.label}
                    title={`${s.label}: ${fmtNum(s.value)}`}
                    style={{ width: `${(s.value / meterTotal) * 100}%`, background: toneColors(t, s.tone).solid }}
                  />
                ))}
              </div>
              <div className="ds-kpi-meter-legend">
                {meter.map((s) => (
                  <span key={s.label} style={{ color: t.textMuted }}>
                    <i style={{ background: toneColors(t, s.tone).solid }} />
                    <b style={{ color: t.text }}>{fmtNum(s.value)}</b> {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {facts && facts.length > 0 && (
            <div className="ds-kpi-facts">
              {facts.map((f) => {
                const c = f.tone ? toneColors(t, f.tone) : null;
                return (
                  <span
                    key={f.label}
                    className="ds-fact"
                    style={c ? { color: c.solid, background: c.soft } : { color: t.text, background: t.bgSubtle }}
                  >
                    <b>{f.value}</b> {f.label}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="ds-kpi-foot">
        {onClick ? (
          <span className="ds-kpi-link">
            View students <IconArrow />
          </span>
        ) : (
          <span />
        )}
        {meta && !loading && <span className="ds-kpi-meta" style={{ color: t.textSubtle }}>{meta}</span>}
      </div>
    </div>
  );
};

/* ============================================================
   OVERVIEW CARDS — async, one endpoint per card
   ============================================================ */
type CardState = { loading: boolean; error: string | null; data: OverviewCard | null };
type CardStates = Record<OverviewCardKey, CardState>;

const emptyCardStates = (loading: boolean): CardStates =>
  OVERVIEW_CARD_KEYS.reduce((acc, k) => {
    acc[k] = { loading, error: null, data: null };
    return acc;
  }, {} as CardStates);

const errMessage = (e: any): string => {
  const status = e?.response?.status;
  return status ? `HTTP ${status}` : e?.message || "request failed";
};

/**
 * Fires one request per card (all at once) and tracks each card's own
 * loading / error / data. A new query or a bumped nonce aborts whatever is
 * still in flight and starts over; a single card can be retried on its own.
 */
function useOverviewCards(query: OverviewQuery | null, nonce: number) {
  const [states, setStates] = useState<CardStates>(() => emptyCardStates(false));
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback((key: OverviewCardKey, q: OverviewQuery, signal: AbortSignal) => {
    setStates((s) => ({ ...s, [key]: { ...s[key], loading: true, error: null } }));
    fetchOverviewCard(key, q, signal)
      .then((data) => {
        if (signal.aborted) return;
        setStates((s) => ({ ...s, [key]: { loading: false, error: null, data } }));
      })
      .catch((e: any) => {
        if (signal.aborted) return;
        setStates((s) => ({ ...s, [key]: { loading: false, error: errMessage(e), data: s[key].data } }));
        // eslint-disable-next-line no-console
        console.error(`[admin dashboard] overview card "${key}" failed:`, e?.response?.status, e?.response?.data || e);
      });
  }, []);

  useEffect(() => {
    controllerRef.current?.abort();
    if (!query) {
      setStates(emptyCardStates(false));
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    OVERVIEW_CARD_KEYS.forEach((key) => load(key, query, controller.signal));
    return () => controller.abort();
  }, [query, nonce, load]);

  const retry = useCallback(
    (key: OverviewCardKey) => {
      if (!query) return;
      let controller = controllerRef.current;
      if (!controller || controller.signal.aborted) {
        controller = new AbortController();
        controllerRef.current = controller;
      }
      load(key, query, controller.signal);
    },
    [query, load]
  );

  const busy = useMemo(() => OVERVIEW_CARD_KEYS.some((k) => states[k]?.loading), [states]);
  return { states, busy, retry };
}

const num = (v: any) => fmtNum(v == null ? undefined : Number(v));
const n = (v: any) => (v == null ? 0 : Number(v));
const fact = (value: any, label: string, tone?: Tone): Fact => ({ label, value: num(value), tone });
const rupees = (v: any) => `₹${n(v).toLocaleString()}`;

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
const IconDownload = () => (
  <svg {...svgBase} width={16} height={16}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
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

const IconCreditCard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="15" x2="10" y2="15" />
  </svg>
);

const IconGlobe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

type CardDef = {
  key: OverviewCardKey;
  title: string;
  tone: Tone;
  icon: ReactNode;
  /** "range" honours the date filter; "state" is a live snapshot of current status. */
  mode: "range" | "state";
  /** What the headline number is, in one short line. */
  note?: (c: OverviewCard) => string;
  /** Secondary numbers for the fact chips. */
  facts?: (c: OverviewCard) => Fact[];
  /** Composition of the headline number for the stacked meter. */
  meter?: (c: OverviewCard) => MeterSeg[];
  /** Mini stat tiles inside the card (one per group), for the wide layout. */
  tiles?: (c: OverviewCard) => Tile[];
  /** Span two grid columns. */
  wide?: boolean;
};

type CardSection = {
  title: string;
  subtitle: string;
  tone: Tone;
  rangeInTitle?: boolean;
  /** auto-fill grid: a lone card keeps normal width instead of stretching. */
  compact?: boolean;
  cards: CardDef[];
};

const CARD_SECTIONS: CardSection[] = [
  {
    title: "Registrations & assessments",
    subtitle: "Students who registered in the selected range, followed through: not started \u2192 in progress \u2192 completed \u2192 report.",
    tone: "primary",
    cards: [
      {
        key: "signups",
        title: "New sign-ups / registrations",
        tone: "primary",
        icon: <IconUsers />,
        mode: "range",
        note: (c) => c.basis,
      },
      {
        key: "active-assessments",
        title: "Active assessments",
        tone: "purple",
        icon: <IconClipboard />,
        mode: "state",
        note: (c) => `of ${num(c.extra.total)} assessments in total`,
        facts: (c) => [fact(c.extra.withCompletions, "completed by students in this range", "success")],
      },
      {
        key: "assessments-completed",
        title: "Completed fully",
        tone: "success",
        icon: <IconFileCheck />,
        mode: "range",
        note: (c) => `of ${num(c.extra.signups)} sign-ups completed an assessment`,
        facts: (c) => [fact(c.extra.attempts, "completed attempts", "success")],
      },
      {
        key: "assessments-in-progress",
        title: "Partially completed / in progress",
        tone: "warning",
        icon: <IconActivity />,
        mode: "range",
        note: (c) => `of ${num(c.extra.signups)} sign-ups started but have not submitted`,
        facts: (c) => [
          fact(c.extra.withDraft, "with answers saved", "warning"),
          fact(c.extra.ongoingOnly, "started, nothing saved yet", "info"),
          ...(c.extra.redisAvailable === false ? [{ label: "saved answers could not be checked", value: "!", tone: "danger" as Tone }] : []),
        ],
      },
      {
        key: "assessments-not-started",
        title: "Not started",
        tone: "info",
        icon: <IconClock />,
        mode: "range",
        note: (c) => `of ${num(c.extra.signups)} sign-ups have not opened an assessment`,
        facts: (c) => [fact(c.extra.assigned, "assigned, never opened", "info"), fact(c.extra.unassigned, "nothing assigned yet", "warning")],
      },
      {
        key: "reports-generated",
        title: "Reports generated",
        tone: "success",
        icon: <IconFileCheck />,
        mode: "range",
        note: (c) => `of ${num(c.extra.completed)} completions have a report`,
        facts: (c) => [
          fact(c.extra.reports, "reports", "success"),
          ...(n(c.extra.awaitingReport) > 0 ? [fact(c.extra.awaitingReport, "completed, report pending", "warning")] : []),
          ...(n(c.extra.failed) > 0 ? [fact(c.extra.failed, "failed", "danger")] : []),
        ],
        meter: (c) => [
          { label: "with report", value: n(c.extra.completed) - n(c.extra.awaitingReport), tone: "success" },
          { label: "report pending", value: n(c.extra.awaitingReport), tone: "warning" },
        ],
      },
    ],
  },
  {
    title: "Counselling",
    subtitle: "Bookings made and sessions on the calendar in the selected range.",
    tone: "purple",
    rangeInTitle: true,
    cards: [
      {
        key: "counselling-booked",
        title: "Scheduled by students",
        tone: "primary",
        icon: <IconCalendar />,
        mode: "range",
        note: () => "sessions booked by students",
        facts: (c) => [fact(c.extra.students, "students", "primary"), fact(c.extra.forFuture, "upcoming sessions", "info")],
      },
      {
        key: "counselling-sessions",
        title: "Sessions to be conducted",
        tone: "purple",
        icon: <IconHeadset />,
        mode: "range",
        note: (c) => `${num(c.extra.counsellors)} counsellors on the calendar`,
        meter: (c) => [
          { label: "done", value: n(c.extra.completed), tone: "success" },
          { label: "live", value: n(c.extra.inProgress), tone: "warning" },
          { label: "scheduled", value: n(c.extra.scheduled), tone: "purple" },
        ],
      },
    ],
  },
  {
    title: "Counselling outcomes",
    subtitle: "By session date. Absences are the attributed no-shows.",
    tone: "danger",
    cards: [
      {
        key: "counselling-completed",
        title: "Sessions completed",
        tone: "success",
        icon: <IconHeadset />,
        mode: "range",
        note: () => "sessions marked completed",
        facts: (c) => [fact(c.extra.students, "students", "success"), fact(c.extra.counsellors, "counsellors", "info")],
      },
      {
        key: "students-absent",
        title: "Students absent",
        tone: "danger",
        icon: <IconUsers />,
        mode: "range",
        note: () => "sessions the student did not attend",
        facts: (c) => [
          fact(c.extra.students, "students", "danger"),
          ...(n(c.extra.disputed) > 0 ? [fact(c.extra.disputed, "under dispute", "warning")] : []),
        ],
      },
      {
        key: "counsellors-absent",
        title: "Counsellors absent",
        tone: "warning",
        icon: <IconAlert />,
        mode: "range",
        note: () => "sessions the counsellor did not attend",
        facts: (c) => [fact(c.extra.counsellors, "counsellors", "warning"), fact(c.extra.awaitingReschedule, "awaiting reschedule", "danger")],
      },
    ],
  },
  {
    title: "Payments",
    subtitle: "Successful assessment and counselling payments in the selected range.",
    tone: "success",
    compact: true,
    cards: [
      {
        key: "payments-completed",
        title: "Payments completed",
        tone: "success",
        icon: <IconCreditCard />,
        mode: "range",
        note: (c) => `${rupees(c.extra.amount)} collected`,
        meter: (c) => [
          { label: "assessment", value: n(c.extra.assessmentPayments), tone: "success" },
          { label: "counselling", value: n(c.extra.counsellingPayments), tone: "purple" },
        ],
      },
    ],
  },
  {
    title: "Website",
    subtitle: "Registrations captured on career-9.com (Login / Register form and the pop-up) — these also land in Leads.",
    tone: "info",
    compact: true,
    cards: [
      {
        key: "website-registrations",
        title: "Website registrations",
        tone: "purple",
        icon: <IconGlobe />,
        mode: "range",
        wide: true,
        note: () => "sign-ups captured on the website, by who registered",
        tiles: (c) => [
          { label: "Students", value: n(c.extra.students), tone: "primary", hint: "Registered as a student" },
          { label: "Parents", value: n(c.extra.parents), tone: "purple", hint: "Registered as a parent" },
          { label: "Schools", value: n(c.extra.schools), tone: "success", hint: "Registered as a school" },
        ],
        facts: (c) => [fact(c.extra.signupForm, "via sign-up form", "info"), fact(c.extra.popup, "via pop-up", "warning")],
      },
    ],
  },
];

/* ============================================================
   DRILL-DOWN MODAL — the students behind a card
   ============================================================ */
/** Everything in one scrollable list; the server caps a page at 5000 rows. */
const DETAIL_PAGE_SIZE = 5000;

const fmtCell = (key: string, value: any): string => {
  if (value == null || value === "") return "—";
  const s = String(value);
  // ISO date-times from the API ("2026-09-14T10:15:30" / "...Z")
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  // Plain dates ("2026-09-14")
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  // Times ("10:15" / "10:15:00")
  if (key.toLowerCase().includes("time") && /^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  if (key === "status" || key === "reportStatus" || key === "leadType") return s.replace(/_/g, " ").toLowerCase();
  if (key === "amount" && /^-?\d+(\.\d+)?$/.test(s)) return `₹${Number(s).toLocaleString()}`;
  return s;
};

/** Which colour a status-like value wears in the table. */
const statusTone = (value: any): Tone => {
  const v = String(value ?? "").toLowerCase();
  if (/completed|generated|paid|confirmed|synced|attended/.test(v)) return "success";
  if (/ongoing|pending|assigned|in_progress|in progress|created|scheduled/.test(v)) return "warning";
  if (/missed|failed|cancel|absent|awaiting|under_review|under review|declined|disput|locked/.test(v)) return "danger";
  if (/notstarted|not started/.test(v)) return "info";
  return "info";
};

/** Colour for identity-like chips (who registered, where it came from, what was paid for). */
const chipTone = (key: string, value: any): Tone => {
  const v = String(value ?? "").toLowerCase();
  if (key === "leadType") return v === "student" ? "primary" : v === "parent" ? "purple" : "success";
  if (key === "purpose") return v.startsWith("counselling") ? "purple" : "success";
  if (key === "source") return v.includes("popup") || v.includes("saved") ? "warning" : "info";
  if (key === "mode") return v === "online" ? "primary" : "info";
  if (key === "activity") return v.startsWith("completed") ? "success" : "info";
  return "info";
};

const CHIP_COLUMNS = new Set(["status", "reportStatus", "leadType", "purpose", "source", "mode", "typeOfReport", "activity"]);

const AVATAR_TONES: Tone[] = ["primary", "purple", "success", "warning", "info", "danger"];
const avatarTone = (name: string): Tone => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const OverviewDetailModal: FC<{
  t: Theme;
  def: CardDef;
  card: OverviewCard | null;
  query: OverviewQuery;
  rangeText: string;
  exportContext: OverviewExportContext;
  onClose: () => void;
}> = ({ t, def, card, query, rangeText, exportContext, onClose }) => {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [detail, setDetail] = useState<OverviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchOverviewStudents(def.key, query, { page: 0, size: DETAIL_PAGE_SIZE, search: debounced }, controller.signal)
      .then((d) => {
        if (controller.signal.aborted) return;
        setDetail(d);
      })
      .catch((e: any) => {
        if (controller.signal.aborted) return;
        setError(errMessage(e));
        // eslint-disable-next-line no-console
        console.error(`[admin dashboard] students for "${def.key}" failed:`, e?.response?.status, e?.response?.data || e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [def.key, query, debounced]);

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const total = detail?.total ?? 0;
  const shown = detail?.rows.length ?? 0;
  const tone = toneColors(t, def.tone);
  const columns = detail?.columns ?? [];
  const facts = card && def.facts ? def.facts(card) : [];
  const meter = card && def.meter ? def.meter(card) : [];
  const meterTotal = meter.reduce((a, s) => a + Math.max(0, s.value), 0);

  const scopeBits: string[] = [rangeText];
  if (query.instituteCodes.length === 1) scopeBits.push(`Institute ${query.instituteCodes[0]}`);
  else if (query.instituteCodes.length > 1) scopeBits.push(`${query.instituteCodes.length} institutes`);
  if (query.assessmentIds.length > 0) scopeBits.push(`${query.assessmentIds.length} ${query.assessmentIds.length === 1 ? "assessment" : "assessments"}`);

  // Excel of every row currently in the list (the modal loads the whole list),
  // using the same columns and the same date/status formatting as the table.
  const canExport = !!detail && detail.rows.length > 0 && !loading;
  const handleExport = () => {
    if (!detail || detail.rows.length === 0) return;
    const cols: OverviewDetailColumn[] = [...detail.columns];
    if (!cols.some((c) => c.key === "phone") && detail.rows.some((r) => r.phone != null)) {
      cols.splice(Math.min(2, cols.length), 0, { key: "phone", label: "Phone" });
    }
    const header = [SNO_HEADER, ...cols.map((c) => c.label)];
    const body = detail.rows.map((row, i) => [
      i + 1,
      ...cols.map((c) => {
        const v = row[c.key];
        if (v == null || v === "") return "";
        if (typeof v === "number") return v;
        return fmtCell(c.key, v);
      }),
    ]);
    // Row 1: "CAREER-9 <assessment> - <school>, <region>" in bold caps. The
    // assessment is the applied filter; with none chosen the card title stands in.
    const exportedAt = new Date();
    const ws = XLSX.utils.aoa_to_sheet([[overviewExportTitle(exportContext, def.title, exportedAt)], header, ...body]);
    styleOverviewSheet(
      ws,
      header,
      body.length,
      header.map((h, i) => ({
        wch: Math.min(60, Math.max(String(h).length, ...body.map((r) => String(r[i] ?? "").length)) + 2),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, overviewSheetName(def.title));
    // "Class N" leads the file name only when every exported row is in the same class.
    const classes = new Set(detail.rows.map((r) => String(r.studentClass ?? "").trim()).filter(Boolean));
    const className = classes.size === 1 ? Array.from(classes)[0] : "";
    XLSX.writeFile(wb, overviewExportFileName(exportContext, className, exportedAt));
  };

  const renderCell = (c: OverviewDetailColumn, row: Record<string, any>) => {
    const v = row[c.key];
    if (c.key === "name") {
      const name = v == null || v === "" ? "" : String(v);
      const at = toneColors(t, avatarTone(name || String(row.email ?? "")));
      return (
        <span className="ds-cell-name">
          <span className="ds-avatar" style={{ background: at.soft, color: at.solid }}>{initialsOf(name || String(row.email ?? "?"))}</span>
          <span style={{ fontWeight: 600, color: t.text }}>{name || "—"}</span>
        </span>
      );
    }
    if (CHIP_COLUMNS.has(c.key) && v != null && v !== "") {
      const ct = toneColors(t, c.key === "status" || c.key === "reportStatus" ? statusTone(v) : chipTone(c.key, v));
      return (
        <span className="ds-chip ds-chip-cell" style={{ color: ct.solid, background: ct.soft }}>
          {fmtCell(c.key, v)}
        </span>
      );
    }
    if (c.key === "amount" && v != null) {
      return <span style={{ fontWeight: 600, color: t.text, fontVariantNumeric: "tabular-nums" }}>{fmtCell(c.key, v)}</span>;
    }
    return fmtCell(c.key, v);
  };

  return createPortal(
    <div className="ds-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="ds-modal"
        role="dialog"
        aria-modal="true"
        aria-label={def.title}
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          color: t.text,
          // @ts-ignore — CSS custom props for the tint
          ["--modal-tone" as any]: tone.solid,
          ["--modal-soft" as any]: tone.soft,
        }}
      >
        <div className="ds-modal-head" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="ds-modal-head-wash" aria-hidden />
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <div className="ds-modal-icon">{def.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div className="ds-modal-eyebrow" style={{ color: tone.solid }}>Students behind this number</div>
              <div className="ds-modal-title" style={{ color: t.text }}>{def.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {scopeBits.map((b) => (
                  <Pill key={b} t={t} tone="info">{b}</Pill>
                ))}
                {debounced && <Pill t={t} tone="warning">search: {debounced}</Pill>}
              </div>
            </div>
          </div>
          <div className="ds-modal-head-right">
            <div className="ds-modal-hero">
              <div className="ds-modal-hero-value" style={{ color: tone.solid }}>
                {loading && !detail ? <Spinner color={tone.solid} size={22} /> : fmtNum(total)}
              </div>
              <div className="ds-modal-hero-label" style={{ color: t.textMuted }}>{total === 1 ? "row" : "rows"}</div>
            </div>
            <div className="ds-search-wrap">
              <IconSearch />
              <input
                className="ds-search-input"
                placeholder="Search name, email, roll no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <button className="ds-icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
              <IconClose />
            </button>
          </div>
        </div>

        {(facts.length > 0 || meterTotal > 0 || card) && (
          <div className="ds-modal-stats" style={{ borderBottom: `1px solid ${t.border}`, background: t.bgSubtle }}>
            {card && def.note && <span className="ds-modal-stat-note" style={{ color: t.textMuted }}>{def.note(card)}</span>}
            {meterTotal > 0 && (
              <div className="ds-kpi-meter" style={{ margin: 0, minWidth: 220, flex: "1 1 260px" }}>
                <div className="ds-kpi-meter-bar" style={{ background: t.card }}>
                  {meter.filter((s) => s.value > 0).map((s) => (
                    <span key={s.label} title={`${s.label}: ${fmtNum(s.value)}`} style={{ width: `${(s.value / meterTotal) * 100}%`, background: toneColors(t, s.tone).solid }} />
                  ))}
                </div>
                <div className="ds-kpi-meter-legend">
                  {meter.map((s) => (
                    <span key={s.label} style={{ color: t.textMuted }}>
                      <i style={{ background: toneColors(t, s.tone).solid }} />
                      <b style={{ color: t.text }}>{fmtNum(s.value)}</b> {s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {facts.map((f) => {
              const c = f.tone ? toneColors(t, f.tone) : null;
              return (
                <span key={f.label} className="ds-fact" style={c ? { color: c.solid, background: c.soft } : { color: t.text, background: t.card }}>
                  <b>{f.value}</b> {f.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="ds-modal-body">
          {error ? (
            <div style={{ padding: 40, textAlign: "center", color: t.danger, fontSize: 13 }}>
              Failed to load: {error}
              <button className="ds-retry-link" onClick={() => setDebounced((s) => s + "")}>Retry</button>
            </div>
          ) : loading && !detail ? (
            <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
              <Spinner color={tone.solid} size={28} />
            </div>
          ) : total === 0 ? (
            <div className="ds-modal-empty" style={{ color: t.textMuted }}>
              <span className="ds-modal-empty-icon" style={{ background: tone.soft, color: tone.solid }}>{def.icon}</span>
              {debounced ? `No students match “${debounced}”.` : "No students behind this number for the applied filters."}
            </div>
          ) : (
            <div className="ds-table-wrap" style={{ opacity: loading ? 0.55 : 1 }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    {columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detail?.rows ?? []).map((row, i) => (
                    <tr key={String(row.appointmentId ?? row.leadId ?? row.userStudentId ?? i) + "-" + i} className={`ds-row ${row.highlight ? "ds-row-hot" : ""}`}>
                      <td className="ds-td-index">{i + 1}</td>
                      {columns.map((c) => (
                        <td key={c.key} title={row[c.key] == null ? undefined : String(row[c.key])}>
                          {renderCell(c, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ds-modal-foot" style={{ borderTop: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>
            {total > 0
              ? shown < total
                ? `Showing the first ${fmtNum(shown)} of ${fmtNum(total)} rows — narrow with search to see the rest`
                : `${fmtNum(total)} ${total === 1 ? "row" : "rows"} · scroll to see all`
              : ""}
            {detail && !loading ? ` · ${detail.tookMs} ms · ${detail.thread}` : ""}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <button
              className="ds-export-btn"
              style={{ background: tone.solid }}
              disabled={!canExport}
              onClick={handleExport}
              title={canExport ? `Download all ${fmtNum(shown)} rows as an Excel file` : "Nothing to download yet"}
            >
              <IconDownload />
              Download Excel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const OverviewSection: FC<{
  t: Theme;
  states: CardStates;
  retry: (key: OverviewCardKey) => void;
  appliedRangeKey: RangeKey;
  appliedRange: DateRange;
  denied: boolean;
  /** The applied query (null while scope resolves) — reused verbatim by the drill-down. */
  query: OverviewQuery | null;
  /** Institute / assessment names behind `query`, for the drill-down's Excel title and file name. */
  exportContext: OverviewExportContext;
}> = ({ t, states, retry, appliedRangeKey, appliedRange, denied, query, exportContext }) => {
  const rangeText = rangeLabel(appliedRangeKey, appliedRange);
  const [openCard, setOpenCard] = useState<CardDef | null>(null);
  const closeModal = useCallback(() => setOpenCard(null), []);
  const rangeBounded = !!(appliedRange.start && appliedRange.end);

  return (
    <>
      {CARD_SECTIONS.map((section) => {
        const st = toneColors(t, section.tone);
        const loaded = section.cards.filter((d) => states[d.key].data && !states[d.key].loading).length;
        const failed = section.cards.filter((d) => states[d.key].error).length;
        return (
          <div key={section.title} style={{ marginTop: 28 }}>
            <div className="ds-section-head">
              <span className="ds-section-accent" style={{ background: st.solid }} />
              <div style={{ minWidth: 0 }}>
                <div className="ds-section-title" style={{ color: t.text }}>
                  {section.rangeInTitle ? `${section.title} · ${rangeText}` : section.title}
                </div>
                <div className="ds-section-sub" style={{ color: t.textMuted }}>{section.subtitle}</div>
              </div>
              {(failed > 0 || loaded < section.cards.length) && (
                <div className="ds-section-right">
                  {failed > 0 ? (
                    <Pill t={t} tone="danger">{failed} failed</Pill>
                  ) : (
                    <Pill t={t} tone="info">Loading…</Pill>
                  )}
                </div>
              )}
            </div>
            <div className={`ds-grid ${section.compact ? "ds-grid-compact" : ""}`}>
              {section.cards.map((def) => {
                const s = states[def.key];
                const data = s.data;
                return (
                  <KpiCard
                    key={def.key}
                    t={t}
                    tone={toneColors(t, def.tone)}
                    icon={def.icon}
                    title={def.title}
                    value={denied ? "0" : data ? fmtNum(data.value) : "—"}
                    note={data && !denied && def.note ? def.note(data) : undefined}
                    facts={data && !denied && def.facts ? def.facts(data) : undefined}
                    meter={data && !denied && def.meter ? def.meter(data) : undefined}
                    tiles={data && !denied && def.tiles ? def.tiles(data) : undefined}
                    wide={def.wide}
                    caption={
                      s.error
                        ? `Failed: ${s.error}`
                        : denied
                        ? "No institute mapped to your account"
                        : data
                        ? undefined
                        : s.loading
                        ? "Counting…"
                        : "Press Search to load"
                    }
                    loading={s.loading}
                    errored={!!s.error}
                    dateFiltered={def.mode === "range" && rangeBounded && !!data?.rangeApplied}
                    badge={
                      def.mode === "state"
                        ? { label: "LIVE", tone: "info", title: "Current state — nothing records when an attempt began, so the date range does not apply", icon: <IconActivity /> }
                        : undefined
                    }
                    meta={data ? `${data.tookMs} ms · ${data.thread}` : undefined}
                    onRetry={s.error ? () => retry(def.key) : undefined}
                    onClick={query && data && !s.error ? () => setOpenCard(def) : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {openCard && query && (
        <OverviewDetailModal
          t={t}
          def={openCard}
          card={states[openCard.key].data}
          query={query}
          rangeText={rangeText}
          exportContext={exportContext}
          onClose={closeModal}
        />
      )}
    </>
  );
};

/* ============================================================
   PRIMITIVES
   ============================================================ */


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
      padding: 22px 30px;
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
      gap: 24px;
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
    .ds-hero-stats-wrap { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
    .ds-hero-stats-caption {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: rgba(255,255,255,0.6);
    }
    .ds-hero-stats-caption svg { width: 12px; height: 12px; }
    .ds-hero-stats {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(80px, max-content);
      gap: 8px;
      min-width: 0;
    }
    @media (max-width: 900px) { .ds-hero-stats { grid-auto-flow: row; grid-template-columns: repeat(3, 1fr); grid-auto-columns: auto; width: 100%; } }
    .ds-hero-stat {
      padding: 7px 11px;
      border-radius: 10px;
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

    .ds-grid-compact {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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

    .ds-export-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 9px;
      border: none;
      background: ${t.primary};
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: all 200ms ease;
    }
    .ds-export-btn:hover:not(:disabled) { background: ${t.primaryHover}; }
    .ds-export-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* --------------------- SEARCH / APPLY --------------------- */
    .ds-search-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 9px;
      border: none;
      background: ${t.primary};
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: all 200ms ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }
    .ds-search-btn:hover:not(:disabled) { background: ${t.primaryHover}; transform: translateY(-1px); }
    .ds-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ds-search-btn.dirty { box-shadow: 0 0 0 3px ${t.primarySoft}, 0 1px 2px rgba(0,0,0,0.08); }

    .ds-dirty-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 100px;
      background: ${t.warningSoft};
      color: ${t.warning};
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .ds-dirty-pill::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${t.warning};
      animation: ds-dirty-blink 1.4s ease-in-out infinite;
    }
    @keyframes ds-dirty-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }

    /* --------------------- OVERVIEW SECTIONS --------------------- */
    /* --------------------- SECTION HEADS --------------------- */
    .ds-section-head {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .ds-section-accent {
      width: 5px;
      height: 34px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .ds-section-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .ds-section-sub { font-size: 12px; margin-top: 3px; }
    .ds-section-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

    /* --------------------- KPI CARD --------------------- */
    .ds-kpi-card {
      border-radius: 18px;
      padding: 20px 22px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 200px;
      position: relative;
      overflow: hidden;
    }
    .ds-kpi-card.clickable { cursor: pointer; }
    .ds-kpi-card.clickable:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--kpi-soft, ${t.primarySoft}); }
    .ds-kpi-wash {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(420px 220px at 100% -10%, var(--kpi-soft, transparent) 0%, transparent 65%),
        radial-gradient(260px 160px at -10% 110%, var(--kpi-soft, transparent) 0%, transparent 60%);
      opacity: ${t.name === "dark" ? 0.9 : 0.75};
    }
    .ds-kpi-topline {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--kpi-tone), transparent 85%);
    }
    .ds-kpi-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      position: relative;
    }
    .ds-kpi-icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--kpi-tone);
      background: linear-gradient(135deg, color-mix(in srgb, var(--kpi-tone) 100%, #fff 10%), color-mix(in srgb, var(--kpi-tone) 82%, #000 18%));
      box-shadow: 0 8px 18px -8px var(--kpi-tone), inset 0 1px 0 rgba(255,255,255,0.25);
      transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ds-kpi-card:hover .ds-kpi-icon { transform: translateY(-2px) scale(1.04); }
    .ds-kpi-chips { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .ds-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 100px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .ds-chip svg { width: 11px; height: 11px; }
    .ds-chip-cell { font-size: 11px; letter-spacing: 0.01em; text-transform: capitalize; padding: 3px 9px; }
    .ds-kpi-title {
      position: relative;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${t.textMuted};
      margin-top: 2px;
    }
    .ds-kpi-value {
      position: relative;
      font-size: 40px;
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1;
      min-height: 42px;
      display: flex;
      align-items: center;
      font-variant-numeric: proportional-nums;
    }
    .ds-kpi-note { position: relative; font-size: 12.5px; line-height: 1.45; }
    .ds-kpi-meter { position: relative; display: flex; flex-direction: column; gap: 7px; margin-top: 2px; }
    .ds-kpi-meter-bar {
      display: flex;
      gap: 2px;
      height: 8px;
      border-radius: 100px;
      overflow: hidden;
    }
    .ds-kpi-meter-bar > span { display: block; height: 100%; min-width: 3px; border-radius: 100px; transition: width 400ms cubic-bezier(0.16, 1, 0.3, 1); }
    .ds-kpi-meter-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; }
    .ds-kpi-meter-legend > span { display: inline-flex; align-items: center; gap: 6px; }
    .ds-kpi-meter-legend i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .ds-kpi-meter-legend b { font-weight: 700; }
    .ds-kpi-wide { grid-column: span 2; }
    @media (max-width: 640px) { .ds-kpi-wide { grid-column: span 1; } }
    .ds-kpi-tiles {
      position: relative;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-top: 4px;
    }
    @media (max-width: 640px) { .ds-kpi-tiles { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); } }
    .ds-kpi-tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      min-width: 0;
      position: relative;
    }
    .ds-kpi-tile-dot { position: absolute; top: 12px; right: 12px; width: 8px; height: 8px; border-radius: 50%; }
    .ds-kpi-tile-value { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
    .ds-kpi-tile-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .ds-kpi-facts { position: relative; display: flex; flex-wrap: wrap; gap: 6px; }
    .ds-fact {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 9px;
      font-size: 11.5px;
      font-weight: 500;
      white-space: nowrap;
    }
    .ds-fact b { font-weight: 700; font-variant-numeric: tabular-nums; }
    .ds-kpi-foot {
      position: relative;
      margin-top: auto;
      padding-top: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-top: 1px dashed ${t.border};
    }
    .ds-kpi-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 700;
      color: var(--kpi-tone);
      transition: gap 200ms ease;
    }
    .ds-kpi-card.clickable:hover .ds-kpi-link { gap: 9px; }
    .ds-kpi-meta { font-size: 10.5px; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; white-space: nowrap; }

    /* --------------------- DRILL-DOWN MODAL --------------------- */
    .ds-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1090;
      box-sizing: border-box;
      background: rgba(15, 23, 42, ${t.name === "dark" ? "0.72" : "0.48"});
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: ds-fade-in 160ms ease both;
    }
    @keyframes ds-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .ds-modal {
      /* Grows with the table, never past the viewport; a narrow list gets a
         compact dialog, a wide one uses the full width and scrolls inside. */
      width: fit-content;
      min-width: min(820px, calc(100vw - 48px));
      max-width: calc(100vw - 48px);
      max-height: calc(100vh - 48px);
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 40px 90px -24px rgba(0,0,0,0.5), 0 0 0 1px var(--modal-soft);
      animation: ds-fade-up 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      box-sizing: border-box;
    }
    .ds-modal * { box-sizing: border-box; }
    .ds-modal-head {
      position: relative;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding: 22px 26px 18px;
      min-width: 0;
      overflow: hidden;
      /* never let the table squeeze the header (it clipped the title/icon) */
      flex: 0 0 auto;
    }
    .ds-modal-head-wash {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(600px 240px at 0% 0%, var(--modal-soft) 0%, transparent 70%),
        radial-gradient(400px 200px at 100% 100%, var(--modal-soft) 0%, transparent 65%);
      opacity: ${t.name === "dark" ? 0.9 : 0.8};
    }
    .ds-modal-head > * { position: relative; }
    .ds-modal-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--modal-tone);
      box-shadow: 0 10px 22px -10px var(--modal-tone), inset 0 1px 0 rgba(255,255,255,0.25);
    }
    .ds-modal-icon svg { width: 24px; height: 24px; }
    .ds-modal-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .ds-modal-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin-top: 3px; }
    .ds-modal-head-right { display: flex; align-items: center; gap: 12px; margin-left: auto; flex-wrap: wrap; }
    .ds-modal-hero { display: flex; flex-direction: column; align-items: flex-end; padding-right: 14px; margin-right: 2px; border-right: 1px solid ${t.border}; }
    .ds-modal-hero-value { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
    .ds-modal-hero-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 4px; }
    .ds-modal-stats {
      display: flex;
      align-items: center;
      gap: 10px 14px;
      flex-wrap: wrap;
      padding: 12px 26px;
      min-width: 0;
      flex: 0 0 auto;
    }
    .ds-modal-stat-note { font-size: 12.5px; font-weight: 500; margin-right: 6px; }
    .ds-modal-body {
      flex: 1 1 auto;
      min-height: 160px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .ds-modal-foot { min-width: 0; }
    .ds-modal-empty {
      padding: 56px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
      font-size: 13px;
    }
    .ds-modal-empty-icon { width: 56px; height: 56px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; }
    .ds-modal-empty-icon svg { width: 26px; height: 26px; }
    .ds-modal-foot {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 26px;
      flex: 0 0 auto;
    }
    .ds-search-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid ${t.border};
      background: ${t.card};
      color: ${t.textMuted};
      transition: all 200ms ease;
    }
    .ds-search-wrap:focus-within { border-color: var(--modal-tone); box-shadow: 0 0 0 3px var(--modal-soft); }
    .ds-search-input {
      border: none;
      background: transparent;
      outline: none;
      color: ${t.text};
      font-size: 13px;
      font-family: inherit;
      min-width: 220px;
    }
    .ds-search-input::placeholder { color: ${t.textSubtle}; }
    .ds-icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid ${t.border};
      background: ${t.card};
      color: ${t.textMuted};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 200ms ease;
    }
    .ds-icon-btn:hover { color: ${t.text}; border-color: ${t.borderStrong}; background: ${t.bgSubtle}; }
    .ds-table-wrap {
      flex: 1;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      transition: opacity 200ms ease;
    }
    .ds-table {
      min-width: 100%;
      width: max-content;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
      color: ${t.text};
    }
    .ds-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      text-align: left;
      padding: 11px 16px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--modal-tone);
      background: ${t.card};
      border-bottom: 2px solid var(--modal-soft);
      white-space: nowrap;
    }
    .ds-table td {
      padding: 9px 16px;
      border-bottom: 1px solid ${t.border};
      white-space: nowrap;
      overflow: visible;
      color: ${t.textMuted};
      vertical-align: middle;
    }
    .ds-table tbody tr:nth-child(even) td { background: ${t.name === "dark" ? "rgba(255,255,255,0.025)" : "rgba(15,23,42,0.02)"}; }
    .ds-table tbody tr:hover td { background: var(--modal-soft); }
    .ds-row-hot td { background: var(--modal-soft) !important; }
    .ds-row-hot td:first-child { box-shadow: inset 4px 0 0 var(--modal-tone); }
    .ds-td-index { color: ${t.textSubtle}; font-variant-numeric: tabular-nums; font-size: 11.5px; }
    .ds-cell-name { display: inline-flex; align-items: center; gap: 10px; }
    .ds-avatar {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .ds-status-chip {
      display: inline-flex;
      padding: 2px 9px;
      border-radius: 100px;
      background: ${t.infoSoft};
      color: ${t.text};
      font-size: 11px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .ds-page-btn {
      padding: 7px 14px;
      border-radius: 8px;
      border: 1px solid ${t.border};
      background: ${t.card};
      color: ${t.text};
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 200ms ease;
    }
    .ds-page-btn:hover:not(:disabled) { border-color: ${t.borderStrong}; background: ${t.bgSubtle}; }
    .ds-page-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .ds-retry-link {
      border: none;
      background: transparent;
      color: ${t.primary};
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      margin-left: 6px;
      font-family: inherit;
      text-decoration: underline;
    }

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
      opacity: ${t.name === "dark" ? 0.16 : 0.1};
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
