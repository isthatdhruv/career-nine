import {
  applyInstituteAssessmentFilter,
  assessmentIdsAssignedTo,
  hasTestMarker,
  instituteKeysOf,
  stripTestEntities,
} from "./dashboard-admin.filter";
import { AdminDashboardSnapshot } from "./dashboard-admin.api";

const snap = (): AdminDashboardSnapshot => ({
  students: [
    { id: 1, instituteId: 101, name: "Asha" },
    { id: 2, instituteId: 101, name: "Ravi" },
    { id: 3, instituteId: 202, name: "Meera" },
  ],
  institutes: [
    { instituteCode: 101, instituteName: "Alpha School" },
    { instituteCode: 202, instituteName: "Beta School" },
  ],
  counsellors: [{ id: 9 }],
  appointments: [
    { id: 1, student: { userStudentId: 11 } },
    { id: 2, student: { userStudentId: 33 } },
  ],
  ratingSummary: [{ counsellorId: 9, count: 2, average: 4.5 }],
  assessments: [
    { id: 5, assessmentName: "Navigator" },
    { id: 6, assessmentName: "BET" },
    { id: 7, assessmentName: "Unused" },
  ],
  reports: [
    { generatedReportId: 1, assessmentId: 5, reportStatus: "generated", userStudent: { userStudentId: 11 } },
    { generatedReportId: 2, assessmentId: 6, reportStatus: "failed", userStudent: { userStudentId: 11 } },
    { generatedReportId: 3, assessmentId: 5, reportStatus: "generated", userStudent: { userStudentId: 33 } },
  ],
  studentMappings: [
    {
      id: 1, userStudentId: 11, instituteId: 101, name: "Asha",
      assessments: [
        { assessmentId: 5, status: "completed" },
        { assessmentId: 6, status: "ongoing" },
      ],
    },
    { id: 2, userStudentId: 22, instituteId: 101, name: "Ravi", assessments: [] },
    {
      id: 3, userStudentId: 33, instituteId: 202, name: "Meera",
      assessments: [{ assessmentId: 5, status: "completed" }],
    },
  ],
});

describe("instituteKeysOf", () => {
  it("collects the institute's code and id as strings so either can match a student row", () => {
    expect(instituteKeysOf({ instituteCode: 101, id: 7 })).toEqual(new Set(["101", "7"]));
  });

  it("returns an empty set for a null institute", () => {
    expect(instituteKeysOf(null)).toEqual(new Set());
  });
});

describe("assessmentIdsAssignedTo", () => {
  it("returns the distinct assessment ids found on the given mapping rows", () => {
    const ids = assessmentIdsAssignedTo(snap().studentMappings.filter((m) => m.instituteId === 101));
    expect(Array.from(ids).sort()).toEqual(["5", "6"]);
  });
});

describe("applyInstituteAssessmentFilter", () => {
  it("returns the same snapshot object when no filter is active", () => {
    const s = snap();
    expect(applyInstituteAssessmentFilter(s, { instituteKeys: null, assessmentIds: null })).toBe(s);
  });

  it("narrows students, mappings, institutes, reports and appointments to the chosen institute", () => {
    const out = applyInstituteAssessmentFilter(snap(), {
      instituteKeys: new Set(["101"]),
      assessmentIds: null,
    });
    expect(out.students.map((s) => s.name)).toEqual(["Asha", "Ravi"]);
    expect(out.studentMappings.map((m) => m.name)).toEqual(["Asha", "Ravi"]);
    expect(out.institutes.map((i) => i.instituteName)).toEqual(["Alpha School"]);
    expect(out.reports.map((r) => r.generatedReportId)).toEqual([1, 2]);
    expect(out.appointments.map((a) => a.id)).toEqual([1]);
    // platform-wide sections are left alone
    expect(out.counsellors).toHaveLength(1);
    expect(out.ratingSummary).toHaveLength(1);
    expect(out.assessments).toHaveLength(3);
  });

  it("narrows the assessment list, each student's assessment entries and the reports to the chosen assessments", () => {
    const out = applyInstituteAssessmentFilter(snap(), {
      instituteKeys: null,
      assessmentIds: new Set(["5"]),
    });
    expect(out.assessments.map((a) => a.id)).toEqual([5]);
    expect(out.reports.map((r) => r.generatedReportId)).toEqual([1, 3]);
    // students are kept even when none of their assessments survive the filter
    expect(out.studentMappings).toHaveLength(3);
    expect(out.studentMappings[0].assessments).toEqual([{ assessmentId: 5, status: "completed" }]);
    expect(out.studentMappings[1].assessments).toEqual([]);
    expect(out.students).toHaveLength(3);
  });

  it("applies both filters together", () => {
    const out = applyInstituteAssessmentFilter(snap(), {
      instituteKeys: new Set(["202"]),
      assessmentIds: new Set(["6"]),
    });
    expect(out.students.map((s) => s.name)).toEqual(["Meera"]);
    expect(out.studentMappings[0].assessments).toEqual([]);
    expect(out.reports).toEqual([]);
    expect(out.assessments.map((a) => a.id)).toEqual([6]);
  });

  it("drops a report whose student cannot be resolved when an institute filter is active", () => {
    const s = snap();
    s.reports.push({ generatedReportId: 4, assessmentId: 5, reportStatus: "generated" });
    const out = applyInstituteAssessmentFilter(s, { instituteKeys: new Set(["101"]), assessmentIds: null });
    expect(out.reports.map((r) => r.generatedReportId)).toEqual([1, 2]);
  });
});

describe("hasTestMarker", () => {
  it("matches 'test' anywhere, any case, in any of the values", () => {
    expect(hasTestMarker("Asha", "asha@TEST.com")).toBe(true);
    expect(hasTestMarker("Contestant")).toBe(true);
    expect(hasTestMarker("Asha", null, undefined, "", "asha@gmail.com")).toBe(false);
  });
});

describe("stripTestEntities", () => {
  const raw: AdminDashboardSnapshot = {
    students: [
      { id: 1, userStudentId: 11, instituteId: 101, name: "Asha", email: "asha@x.com" },
      { id: 2, userStudentId: 22, instituteId: 101, name: "Test Student", email: "b@x.com" },
      { id: 3, userStudentId: 33, instituteId: 101, name: "Ravi", email: "ravi@x.com", user: { username: "tester1" } },
      { id: 4, userStudentId: 44, instituteId: 909, name: "Meera", email: "m@x.com" },
    ],
    institutes: [
      { instituteCode: 101, instituteName: "Alpha School" },
      { instituteCode: 909, instituteName: "Testing Academy" },
    ],
    counsellors: [
      { id: 9, name: "Dr. Rao" },
      { id: 8, name: "Test Counsellor" },
    ],
    appointments: [
      { id: 1, student: { userStudentId: 11 }, counsellor: { id: 9 } },
      { id: 2, student: { userStudentId: 22 }, counsellor: { id: 9 } },
      { id: 3, student: { userStudentId: 11 }, counsellor: { id: 8 } },
    ],
    ratingSummary: [
      { counsellorId: 9, count: 2, average: 4.5 },
      { counsellorId: 8, count: 1, average: 5 },
    ],
    assessments: [
      { id: 5, assessmentName: "Navigator" },
      { id: 6, assessmentName: "Career-9 Subject Navigator Testing" },
    ],
    reports: [
      { generatedReportId: 1, assessmentId: 5, userStudent: { userStudentId: 11 } },
      { generatedReportId: 2, assessmentId: 6, userStudent: { userStudentId: 11 } },
      { generatedReportId: 3, assessmentId: 5, userStudent: { userStudentId: 22 } },
      { generatedReportId: 4, assessmentId: 5, userStudent: { userStudentId: 44 } },
    ],
    studentMappings: [
      { userStudentId: 11, instituteId: 101, name: "Asha", assessments: [{ assessmentId: 5 }, { assessmentId: 6 }] },
      { userStudentId: 22, instituteId: 101, name: "Test Student", assessments: [{ assessmentId: 5 }] },
      { userStudentId: 33, instituteId: 101, name: "Ravi", username: "tester1", assessments: [] },
      { userStudentId: 44, instituteId: 909, name: "Meera", assessments: [{ assessmentId: 5 }] },
    ],
  };
  const out = stripTestEntities(raw);

  it("drops institutes, assessments and counsellors with 'test' in their name", () => {
    expect(out.institutes.map((i) => i.instituteCode)).toEqual([101]);
    expect(out.assessments.map((a) => a.id)).toEqual([5]);
    expect(out.counsellors.map((c) => c.id)).toEqual([9]);
    expect(out.ratingSummary.map((r) => r.counsellorId)).toEqual([9]);
  });

  it("drops students by name, login username, or a test institute", () => {
    expect(out.students.map((s) => s.name)).toEqual(["Asha"]);
    expect(out.studentMappings.map((m) => m.name)).toEqual(["Asha"]);
  });

  it("removes test assessments from the kept students' assignment lists", () => {
    expect(out.studentMappings[0].assessments).toEqual([{ assessmentId: 5 }]);
  });

  it("drops reports and appointments that point at a dropped student, assessment or counsellor", () => {
    expect(out.reports.map((r) => r.generatedReportId)).toEqual([1]);
    expect(out.appointments.map((a) => a.id)).toEqual([1]);
  });

  it("leaves a clean snapshot untouched", () => {
    const clean = { ...raw, students: [raw.students[0]], institutes: [raw.institutes[0]], counsellors: [raw.counsellors[0]],
      appointments: [raw.appointments[0]], ratingSummary: [raw.ratingSummary[0]], assessments: [raw.assessments[0]],
      reports: [raw.reports[0]], studentMappings: [{ ...raw.studentMappings[0], assessments: [{ assessmentId: 5 }] }] };
    expect(stripTestEntities(clean)).toEqual(clean);
  });
});
