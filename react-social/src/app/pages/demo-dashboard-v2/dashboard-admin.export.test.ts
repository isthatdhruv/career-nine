import * as XLSX from "xlsx";
import {
  buildSchoolReportWorkbook,
  buildStudentRows,
  computeSchoolSummary,
  formatDob,
  schoolReportFileName,
  SectionLookup,
  STUDENT_SHEET_COLUMNS,
} from "./dashboard-admin.export";

const assessments = [
  { id: 5, assessmentName: "Navigator" },
  { id: 6, assessmentName: "BET" },
  { id: 7, assessmentName: "Not at this school" },
];

const studentMappings = [
  {
    id: 1, userStudentId: 11, name: "Asha", username: "1001", studentDob: "16-07-2010", gender: "Female",
    schoolSectionId: 1, studentClass: "10",
    assessments: [
      { assessmentId: 5, status: "completed", completedAt: "2026-08-01T09:30:00.000+00:00", assessmentName: "Navigator" },
      { assessmentId: 6, status: "ongoing", completedAt: null, assessmentName: "BET" },
    ],
  },
  {
    id: 2, userStudentId: 22, name: "Ravi", username: "1002", studentDob: null, loginDob: "02-01-2011", gender: "Male",
    schoolSectionId: 1, studentClass: "10",
    assessments: [{ assessmentId: 5, status: "submitted", completedAt: null, assessmentName: "Navigator" }],
  },
  {
    id: 3, userStudentId: 33, name: "Meera", username: "1003", studentDob: "20-03-2010", gender: "Female",
    schoolSectionId: 2, studentClass: "10",
    assessments: [
      { assessmentId: 5, status: "ongoing", completedAt: null, assessmentName: "Navigator" },
      { assessmentId: 6, status: "completed", completedAt: null, assessmentName: "BET" },
    ],
  },
  {
    id: 4, userStudentId: 44, name: "Dev", username: "1004", studentDob: null, gender: null,
    schoolSectionId: null, studentClass: "9",
    assessments: [],
  },
];

const reports = [
  { generatedReportId: 1, assessmentId: 5, reportStatus: "generated", userStudent: { userStudentId: 11 } },
  { generatedReportId: 2, assessmentId: 6, reportStatus: "failed", userStudent: { userStudentId: 11 } },
  { generatedReportId: 3, assessmentId: 6, reportStatus: "notGenerated", userStudent: { userStudentId: 33 } },
];

const sectionLookup: SectionLookup = new Map([
  [1, { className: "10", sectionName: "A" }],
  [2, { className: "10", sectionName: "B" }],
]);

const input = { assessments, studentMappings, reports, sectionLookup };

describe("formatDob", () => {
  it("passes an already formatted dd-MM-yyyy string through", () => {
    expect(formatDob("16-07-2010")).toBe("16-07-2010");
  });
  it("formats an ISO timestamp as dd-MM-yyyy", () => {
    expect(formatDob("2010-07-16T12:00:00.000+00:00")).toBe("16-07-2010");
  });
  it("formats an epoch number as dd-MM-yyyy", () => {
    expect(formatDob(Date.UTC(2011, 0, 2, 12))).toBe("02-01-2011");
  });
  it("returns an empty string for null or garbage", () => {
    expect(formatDob(null)).toBe("");
    expect(formatDob("not a date")).toBe("");
  });
});

describe("schoolReportFileName", () => {
  it("builds a safe file name from the institute and the export date", () => {
    expect(schoolReportFileName("Alpha School / Main", new Date(2026, 8, 11))).toBe(
      "Alpha_School_Main_Assessment_Report_2026-09-11.xlsx"
    );
  });
});

describe("computeSchoolSummary", () => {
  const summary = computeSchoolSummary(input);

  it("counts overall students, completions and report holders once each", () => {
    expect(summary.overall).toEqual({
      totalStudents: 4,
      studentsCompleted: 3,
      studentsWithReport: 2,
      studentsWithGeneratedReport: 1,
    });
  });

  it("breaks the numbers down per assessment, skipping assessments nobody at the school is assigned to", () => {
    expect(summary.perAssessment).toEqual([
      {
        assessmentId: "5", assessmentName: "Navigator",
        assigned: 3, completed: 2, completionPct: 67, withReport: 1, generated: 1, failed: 0,
      },
      {
        assessmentId: "6", assessmentName: "BET",
        assigned: 2, completed: 1, completionPct: 50, withReport: 2, generated: 0, failed: 1,
      },
    ]);
  });

  it("breaks the numbers down per class and section, falling back to the flat class string", () => {
    expect(summary.byClassSection).toEqual([
      { className: "9", sectionName: "", students: 1, completed: 0, withReport: 0, generated: 0 },
      { className: "10", sectionName: "A", students: 2, completed: 2, withReport: 1, generated: 1 },
      { className: "10", sectionName: "B", students: 1, completed: 1, withReport: 1, generated: 0 },
    ]);
  });
});

describe("buildStudentRows", () => {
  const rows = buildStudentRows(input);

  it("emits one row per student per assessment, students sorted by name, and a single blank row for an unassigned student", () => {
    expect(rows.map((r) => [r["S.No"], r["Student name"], r["Assessment"]])).toEqual([
      [1, "Asha", "Navigator"],
      [2, "Asha", "BET"],
      [3, "Dev", ""],
      [4, "Meera", "Navigator"],
      [5, "Meera", "BET"],
      [6, "Ravi", "Navigator"],
    ]);
  });

  it("fills identity columns from the mapping row and the section lookup", () => {
    expect(rows[0]).toMatchObject({
      Username: "1001", DOB: "16-07-2010", Class: "10", Section: "A", Gender: "Female",
    });
    // DOB falls back to the login DOB; class falls back to the flat string
    expect(rows[5]).toMatchObject({ DOB: "02-01-2011", Class: "10", Section: "A" });
    expect(rows[2]).toMatchObject({ DOB: "", Class: "9", Section: "", Gender: "" });
  });

  it("labels assessment and report status per row", () => {
    expect(rows[0]).toMatchObject({
      "Assessment status": "Completed", "Completed on": "01-08-2026", "Report status": "Generated",
    });
    expect(rows[1]).toMatchObject({ "Assessment status": "In progress", "Completed on": "", "Report status": "Failed" });
    expect(rows[4]).toMatchObject({ "Assessment status": "Completed", "Report status": "Not generated" });
    expect(rows[5]).toMatchObject({ "Assessment status": "Completed", "Report status": "No report" });
    expect(rows[2]).toMatchObject({ "Assessment status": "", "Completed on": "", "Report status": "" });
  });

  it("uses the shared column order", () => {
    expect(Object.keys(rows[0])).toEqual(STUDENT_SHEET_COLUMNS);
  });
});

describe("buildSchoolReportWorkbook", () => {
  const wb = buildSchoolReportWorkbook({
    ...input,
    instituteName: "Alpha School",
    exportedAt: new Date(2026, 8, 11, 10, 30),
    assessmentFilterLabel: "All assessments",
  });

  it("has a Summary sheet followed by a Students sheet", () => {
    expect(wb.SheetNames).toEqual(["Summary", "Students"]);
  });

  it("writes the header block and the overall totals on the Summary sheet", () => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Summary"], { header: 1 });
    expect(aoa[0]).toEqual(["Institute", "Alpha School"]);
    expect(aoa[1]).toEqual(["Exported on", "11-09-2026"]);
    expect(aoa[2]).toEqual(["Assessments included", "All assessments"]);
    const find = (label: string) => aoa.find((r) => r[0] === label);
    expect(find("Total students")).toEqual(["Total students", 4]);
    expect(find("Students completed at least one assessment")).toEqual(["Students completed at least one assessment", 3]);
    expect(find("Students with a report")).toEqual(["Students with a report", 2]);
    expect(find("Students with a generated report")).toEqual(["Students with a generated report", 1]);
  });

  it("writes the per-assessment and per-class tables on the Summary sheet", () => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Summary"], { header: 1 });
    const headerIdx = aoa.findIndex((r) => r[0] === "Assessment" && r[1] === "Students assigned");
    expect(headerIdx).toBeGreaterThan(0);
    expect(aoa[headerIdx + 1]).toEqual(["Navigator", 3, 2, 67, 1, 1, 0]);
    expect(aoa[headerIdx + 2]).toEqual(["BET", 2, 1, 50, 2, 0, 1]);
    const classIdx = aoa.findIndex((r) => r[0] === "Class" && r[1] === "Section");
    expect(aoa[classIdx + 1]).toEqual(["9", "", 1, 0, 0, 0]);
    expect(aoa[classIdx + 2]).toEqual(["10", "A", 2, 2, 1, 1]);
  });

  it("writes the Students sheet with an autofilter over every column and row", () => {
    const sheet = wb.Sheets["Students"];
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    expect(aoa[0]).toEqual(STUDENT_SHEET_COLUMNS);
    expect(aoa).toHaveLength(7);
    expect(sheet["!autofilter"]).toEqual({ ref: "A1:K7" });
  });
});
