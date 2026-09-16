import * as XLSX from "xlsx-js-style";

/**
 * Pure builders for the super-admin "Export for school" workbook on the admin
 * dashboard. Everything here runs on the already-filtered snapshot sections
 * (see dashboard-admin.filter.ts) — no network, no DOM — so it is unit-tested
 * against a fixture and the component only wires the download.
 *
 * Definitions (same rules the dashboard KPIs use):
 *  - Completed       = mapping status is "completed" or "submitted"
 *  - With report     = at least one GeneratedReport row exists, any status
 *  - Generated report = GeneratedReport.reportStatus is "generated"
 */

export type SectionLookup = Map<number, { className: string; sectionName: string }>;

export interface SchoolReportInput {
  /** Assessments visible under the current filter — drives naming and ordering. */
  assessments: any[];
  /** Student mapping rows for the chosen institute (rich shape from the snapshot). */
  studentMappings: any[];
  /** GeneratedReport rows already narrowed to the same students/assessments. */
  reports: any[];
  /** schoolSectionId → class/section names for the institute. */
  sectionLookup: SectionLookup;
}

export interface SchoolSummary {
  overall: {
    totalStudents: number;
    studentsCompleted: number;
    studentsWithReport: number;
    studentsWithGeneratedReport: number;
  };
  perAssessment: {
    assessmentId: string;
    assessmentName: string;
    assigned: number;
    completed: number;
    completionPct: number;
    withReport: number;
    generated: number;
    failed: number;
  }[];
  byClassSection: {
    className: string;
    sectionName: string;
    students: number;
    completed: number;
    withReport: number;
    generated: number;
  }[];
}

export const STUDENT_SHEET_COLUMNS = [
  "S.No",
  "Student name",
  "Username",
  "DOB",
  "Class",
  "Section",
  "Gender",
  "Assessment",
  "Assessment status",
  "Completed on",
  "Report status",
] as const;

export type StudentRow = Record<(typeof STUDENT_SHEET_COLUMNS)[number], string | number>;

// ───────────────────────── small helpers ─────────────────────────

const pick = (obj: any, keys: string[]): any => {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
};

const str = (v: any): string => (v == null ? "" : String(v));

const pad2 = (n: number) => String(n).padStart(2, "0");

const DD_MM_YYYY = /^\d{2}-\d{2}-\d{4}$/;

/** dd-MM-yyyy for anything date-like; already-formatted strings pass through; garbage → "". */
export const formatDob = (v: any): string => {
  if (v == null || v === "") return "";
  if (typeof v === "string" && DD_MM_YYYY.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
};

const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const schoolReportFileName = (instituteName: string, exportedAt: Date): string => {
  const safe = (instituteName || "Institute")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${safe}_Assessment_Report_${isoDate(exportedAt)}.xlsx`;
};

const isCompleted = (status: any) => {
  const s = str(status).toLowerCase();
  return s === "completed" || s === "submitted";
};

const assessmentStatusLabel = (status: any): string => {
  const s = str(status).toLowerCase();
  if (!s) return "";
  if (s === "completed" || s === "submitted") return "Completed";
  if (s === "ongoing") return "In progress";
  if (s === "created") return "Not started";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** One label for a (student, assessment) pair that may have several report rows. */
const reportStatusLabel = (statuses: string[] | undefined): string => {
  if (!statuses || statuses.length === 0) return "No report";
  if (statuses.some((s) => s === "generated")) return "Generated";
  if (statuses.some((s) => s === "failed")) return "Failed";
  return "Not generated";
};

const mappingStudentId = (m: any): string => str(pick(m, ["userStudentId", "user_student_id"]));

const reportStudentId = (r: any): string =>
  str(
    (r?.userStudent && (r.userStudent.userStudentId ?? r.userStudent.id ?? r.userStudent.studentId)) ??
      pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"])
  );

const entryAssessmentId = (a: any): string => str(pick(a, ["assessmentId", "assessment_id"]));

const assessmentEntries = (m: any): any[] => (Array.isArray(m?.assessments) ? m.assessments : []);

const classSectionOf = (m: any, lookup: SectionLookup): { className: string; sectionName: string } => {
  const sid = pick(m, ["schoolSectionId", "school_section_id"]);
  const hit = sid != null ? lookup.get(Number(sid)) : undefined;
  return {
    className: str(hit?.className ?? pick(m, ["studentClass", "student_class"])),
    sectionName: str(hit?.sectionName),
  };
};

/** Report rows indexed two ways: by student, and by student+assessment. */
const indexReports = (reports: any[]) => {
  const byStudent = new Map<string, string[]>();
  const byPair = new Map<string, string[]>();
  reports.forEach((r) => {
    const sid = reportStudentId(r);
    if (!sid) return;
    const status = str(pick(r, ["reportStatus", "status"])).toLowerCase();
    const aid = entryAssessmentId(r);
    (byStudent.get(sid) ?? byStudent.set(sid, []).get(sid)!).push(status);
    const key = `${sid}:${aid}`;
    (byPair.get(key) ?? byPair.set(key, []).get(key)!).push(status);
  });
  return { byStudent, byPair };
};

/** Assessment ids in display order: the visible list first, then any extra ids only the rows know about. */
const orderedAssessments = (input: SchoolReportInput): { id: string; name: string }[] => {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  input.assessments.forEach((a) => {
    const id = str(pick(a, ["id", "assessmentId"]));
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: str(pick(a, ["assessmentName", "name", "title"])) || `Assessment #${id}` });
  });
  const extra = (id: string, name: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: name || `Assessment #${id}` });
  };
  input.studentMappings.forEach((m) =>
    assessmentEntries(m).forEach((a) => extra(entryAssessmentId(a), str(pick(a, ["assessmentName"]))))
  );
  input.reports.forEach((r) => extra(entryAssessmentId(r), ""));
  return out;
};

const byClassThenSection = (
  a: { className: string; sectionName: string },
  b: { className: string; sectionName: string }
) =>
  a.className.localeCompare(b.className, undefined, { numeric: true }) ||
  a.sectionName.localeCompare(b.sectionName, undefined, { numeric: true });

// ───────────────────────── summary ─────────────────────────

export const computeSchoolSummary = (input: SchoolReportInput): SchoolSummary => {
  const { studentMappings, reports, sectionLookup } = input;
  const { byStudent, byPair } = indexReports(reports);

  let studentsCompleted = 0;
  let studentsWithReport = 0;
  let studentsWithGeneratedReport = 0;

  type ClassAgg = SchoolSummary["byClassSection"][number];
  const classAgg = new Map<string, ClassAgg>();

  studentMappings.forEach((m) => {
    const sid = mappingStudentId(m);
    const completed = assessmentEntries(m).some((a) => isCompleted(a?.status));
    const statuses = sid ? byStudent.get(sid) : undefined;
    const withReport = !!statuses && statuses.length > 0;
    const generated = !!statuses && statuses.some((s) => s === "generated");
    if (completed) studentsCompleted++;
    if (withReport) studentsWithReport++;
    if (generated) studentsWithGeneratedReport++;

    const cs = classSectionOf(m, sectionLookup);
    const key = `${cs.className} ${cs.sectionName}`;
    const agg =
      classAgg.get(key) ??
      classAgg
        .set(key, { ...cs, students: 0, completed: 0, withReport: 0, generated: 0 })
        .get(key)!;
    agg.students++;
    if (completed) agg.completed++;
    if (withReport) agg.withReport++;
    if (generated) agg.generated++;
  });

  const perAssessment: SchoolSummary["perAssessment"] = [];
  orderedAssessments(input).forEach(({ id, name }) => {
    let assigned = 0;
    let completed = 0;
    let withReport = 0;
    let generated = 0;
    let failed = 0;
    studentMappings.forEach((m) => {
      const entry = assessmentEntries(m).find((a) => entryAssessmentId(a) === id);
      if (entry) {
        assigned++;
        if (isCompleted(entry.status)) completed++;
      }
      const sid = mappingStudentId(m);
      const statuses = sid ? byPair.get(`${sid}:${id}`) : undefined;
      if (statuses && statuses.length > 0) {
        withReport++;
        if (statuses.some((s) => s === "generated")) generated++;
        else if (statuses.some((s) => s === "failed")) failed++;
      }
    });
    if (assigned === 0 && withReport === 0) return;
    perAssessment.push({
      assessmentId: id,
      assessmentName: name,
      assigned,
      completed,
      completionPct: assigned === 0 ? 0 : Math.round((completed / assigned) * 100),
      withReport,
      generated,
      failed,
    });
  });

  return {
    overall: {
      totalStudents: studentMappings.length,
      studentsCompleted,
      studentsWithReport,
      studentsWithGeneratedReport,
    },
    perAssessment,
    byClassSection: Array.from(classAgg.values()).sort(byClassThenSection),
  };
};

// ───────────────────────── student rows (long format) ─────────────────────────

export const buildStudentRows = (input: SchoolReportInput): StudentRow[] => {
  const { studentMappings, reports, sectionLookup } = input;
  const { byPair } = indexReports(reports);
  const order = orderedAssessments(input);
  const nameById = new Map(order.map((a) => [a.id, a.name]));
  const rank = new Map(order.map((a, i) => [a.id, i]));

  const sorted = [...studentMappings].sort((a, b) =>
    str(a?.name).localeCompare(str(b?.name), undefined, { sensitivity: "base" })
  );

  const rows: StudentRow[] = [];
  let sno = 0;
  const row = (m: any, entry: any | null): StudentRow => {
    const cs = classSectionOf(m, sectionLookup);
    const sid = mappingStudentId(m);
    const aid = entry ? entryAssessmentId(entry) : "";
    return {
      "S.No": ++sno,
      "Student name": str(m?.name),
      Username: str(pick(m, ["username"])),
      DOB: formatDob(pick(m, ["studentDob", "loginDob"])),
      Class: cs.className,
      Section: cs.sectionName,
      Gender: str(pick(m, ["gender"])),
      Assessment: entry ? nameById.get(aid) ?? str(pick(entry, ["assessmentName"])) ?? "" : "",
      "Assessment status": entry ? assessmentStatusLabel(entry.status) : "",
      "Completed on": entry ? formatDob(pick(entry, ["completedAt", "completed_at"])) : "",
      "Report status": entry && sid ? reportStatusLabel(byPair.get(`${sid}:${aid}`)) : entry ? "No report" : "",
    };
  };

  sorted.forEach((m) => {
    const entries = [...assessmentEntries(m)].sort(
      (a, b) => (rank.get(entryAssessmentId(a)) ?? 1e9) - (rank.get(entryAssessmentId(b)) ?? 1e9)
    );
    if (entries.length === 0) rows.push(row(m, null));
    else entries.forEach((e) => rows.push(row(m, e)));
  });
  return rows;
};

// ───────────────────────── workbook ─────────────────────────

export interface SchoolReportWorkbookInput extends SchoolReportInput {
  instituteName: string;
  exportedAt: Date;
  /** Human label of the assessment filter, e.g. "All assessments" or "Navigator, BET". */
  assessmentFilterLabel: string;
}

const PER_ASSESSMENT_HEADER = [
  "Assessment",
  "Students assigned",
  "Completed",
  "Completion %",
  "With report",
  "Report generated",
  "Report failed",
];

const BY_CLASS_HEADER = ["Class", "Section", "Students", "Completed", "With report", "Report generated"];

export const buildSchoolReportWorkbook = (input: SchoolReportWorkbookInput): XLSX.WorkBook => {
  const summary = computeSchoolSummary(input);
  const rows = buildStudentRows(input);

  const aoa: (string | number)[][] = [
    ["Institute", input.instituteName],
    ["Exported on", formatDob(input.exportedAt)],
    ["Assessments included", input.assessmentFilterLabel],
    [],
    ["OVERALL"],
    ["Total students", summary.overall.totalStudents],
    ["Students completed at least one assessment", summary.overall.studentsCompleted],
    ["Students with a report", summary.overall.studentsWithReport],
    ["Students with a generated report", summary.overall.studentsWithGeneratedReport],
    [],
    ["PER ASSESSMENT"],
    PER_ASSESSMENT_HEADER,
    ...summary.perAssessment.map((a) => [
      a.assessmentName,
      a.assigned,
      a.completed,
      a.completionPct,
      a.withReport,
      a.generated,
      a.failed,
    ]),
    [],
    ["BY CLASS & SECTION"],
    BY_CLASS_HEADER,
    ...summary.byClassSection.map((c) => [
      c.className,
      c.sectionName,
      c.students,
      c.completed,
      c.withReport,
      c.generated,
    ]),
    [],
    ["DEFINITIONS"],
    ["Completed", "Assessment status is completed or submitted"],
    ["With report", "At least one report row exists for the student, any status"],
    ["Generated report", "Report status is generated"],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(aoa);
  summarySheet["!cols"] = [{ wch: 44 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];

  const studentsSheet = XLSX.utils.json_to_sheet(rows, { header: [...STUDENT_SHEET_COLUMNS] });
  studentsSheet["!cols"] = [
    { wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
    { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
  ];
  studentsSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: STUDENT_SHEET_COLUMNS.length - 1 },
    }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(wb, studentsSheet, "Students");
  return wb;
};

// ───────────────────────── card drill-down (modal) export ─────────────────────────

export interface OverviewExportContext {
  /** Names of the assessments chosen in the view filter (empty = no assessment filter). */
  assessmentNames: string[];
  /** Institute name under the applied filter; empty when the view spans every institute. */
  instituteName: string;
  /** Institute city (falls back to state); empty when unknown. */
  region: string;
}

const INVALID_FILE_CHARS = /[\\/:*?"<>|]+/g;
const cleanPart = (s: string) => str(s).replace(INVALID_FILE_CHARS, " ").replace(/\s+/g, " ").trim();
const underscored = (s: string) => cleanPart(s).replace(/\s+/g, "_");

/**
 * Row 1 of the modal's Excel, e.g.
 * "CAREER-9 SUBJECT NAVIGATOR - SILVER BELLS CONVENT SCHOOL, BHOPAL - 16-09-2026".
 * `fallbackSubject` (the card title) is used when no assessment is selected;
 * `exportedAt`, when given, appends the download date.
 */
export const overviewExportTitle = (
  ctx: OverviewExportContext,
  fallbackSubject: string,
  exportedAt?: Date
): string => {
  const subject = ctx.assessmentNames.length > 0 ? ctx.assessmentNames.join(" & ") : fallbackSubject;
  let title = `CAREER-9 ${cleanPart(subject)}`.trim();
  const school = cleanPart(ctx.instituteName);
  const region = cleanPart(ctx.region);
  if (school) title += ` - ${school}`;
  if (region) title += school ? `, ${region}` : ` - ${region}`;
  if (exportedAt) title += ` - ${formatDob(exportedAt)}`;
  return title.toUpperCase();
};

/**
 * Excel sheet name for a card drill-down: the card title with the characters
 * Excel forbids in a tab name (: \ / ? * [ ]) dropped, collapsed whitespace,
 * cut to Excel's 31-character limit, with "Sheet1" as the fallback. Without
 * this, a card such as "New sign-ups / registrations" throws
 * "Sheet name cannot contain : \ / ? * [ ]" from book_append_sheet.
 */
export const overviewSheetName = (title: string): string => {
  const cleaned = String(title ?? "")
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)
    .trim();
  return cleaned || "Sheet1";
};

/** First column of every drill-down / live-tracking sheet. */
export const SNO_HEADER = "S.No";

/**
 * Shared look of the drill-down / live-tracking sheets, applied after the
 * cells exist: a tall bold title merged across every column, a bold header
 * row, and a centred S.No column. Widths: the caller's, with Username capped.
 */
export const styleOverviewSheet = (
  ws: XLSX.WorkSheet,
  header: string[],
  rowCount: number,
  cols: { wch: number }[]
): void => {
  const at = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, header.length - 1) } }];
  ws["!rows"] = [{ hpt: 34 }, { hpt: 22 }];
  const title = at(0, 0);
  if (title) title.s = { font: { bold: true, sz: 13 }, alignment: { vertical: "center" } };
  header.forEach((_, c) => {
    const cell = at(1, c);
    if (cell) cell.s = { font: { bold: true }, alignment: { vertical: "center", horizontal: c === 0 ? "center" : "left" } };
  });
  for (let r = 2; r < 2 + rowCount; r++) {
    const cell = at(r, 0);
    if (cell) cell.s = { alignment: { horizontal: "center" } };
  }
  ws["!cols"] = cols.map((col, i) =>
    header[i] === "Username" ? { wch: Math.min(col.wch, 14) } : header[i] === SNO_HEADER ? { wch: 7 } : col
  );
};

const NAVIGATOR_KINDS = ["Subject Navigator", "Career Navigator", "Insight Navigator"] as const;

/**
 * "Sandesh Subject Navigator May 2026" → "Subject Navigator"; null when the
 * name is not one of the three navigator products.
 */
export const navigatorShortName = (assessmentName: string): string | null => {
  const flat = str(assessmentName).toLowerCase().replace(/[^a-z]+/g, " ");
  return NAVIGATOR_KINDS.find((k) => flat.includes(k.toLowerCase())) ?? null;
};

/**
 * "Class 10 Career-9_Subject_Navigator_Silver_Bells_Convent_School_2026-09-16.xlsx".
 *  - the assessment part appears only when exactly ONE assessment is selected,
 *    shortened to its navigator kind when it is a navigator;
 *  - "Class N " leads only when the exported rows all share one class;
 *  - empty parts are skipped.
 */
export const overviewExportFileName = (
  ctx: OverviewExportContext,
  className: string,
  exportedAt: Date
): string => {
  const single = ctx.assessmentNames.length === 1 ? ctx.assessmentNames[0] : "";
  const assessmentPart = single ? navigatorShortName(single) ?? single : "";
  const parts = ["Career-9", assessmentPart, ctx.instituteName].map(underscored).filter(Boolean);
  parts.push(isoDate(exportedAt));
  const cls = cleanPart(className);
  return `${cls ? `Class ${cls} ` : ""}${parts.join("_")}.xlsx`;
};
