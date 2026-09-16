import { AdminDashboardSnapshot } from "./dashboard-admin.api";

/**
 * Super-admin view filter for the admin dashboard: narrow the already-loaded
 * snapshot to one institute and/or a set of assessments. Pure — the component
 * applies it in a memo between the raw payload and the derived metrics so the
 * existing KPI/drill-down code keeps reading the same field names.
 *
 * Mirrors the id-resolution rules of `applyScopeToSnapshot` in the page:
 * student rows carry `instituteId` (which may hold either the institute's
 * code or its row id, depending on the onboarding path), reports and
 * appointments only reference the student.
 */
export interface InstituteAssessmentFilter {
  /** Keys a student's `instituteId` may match (code and id of the chosen institute). null = all. */
  instituteKeys: Set<string> | null;
  /** Assessment ids (as strings) to keep. null = all. */
  assessmentIds: Set<string> | null;
}

const pick = (obj: any, keys: string[]): any => {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
};

const str = (v: any): string => (v == null ? "" : String(v));

/** Both identifiers an institute row can be referenced by, as strings. */
export const instituteKeysOf = (inst: any): Set<string> => {
  const keys = new Set<string>();
  if (!inst) return keys;
  const code = pick(inst, ["instituteCode", "code"]);
  const id = pick(inst, ["id", "instituteId"]);
  if (code != null) keys.add(str(code));
  if (id != null) keys.add(str(id));
  return keys;
};

/** Distinct assessment ids assigned to any of the given student mapping rows. */
export const assessmentIdsAssignedTo = (mappings: any[]): Set<string> => {
  const ids = new Set<string>();
  mappings.forEach((m) => {
    const assigned = Array.isArray(m?.assessments) ? m.assessments : [];
    assigned.forEach((a: any) => {
      const aid = pick(a, ["assessmentId", "assessment_id"]);
      if (aid != null) ids.add(str(aid));
    });
  });
  return ids;
};

const studentInstituteKey = (s: any): string => str(pick(s, ["instituteId", "institute_id"]));

const mappingStudentId = (m: any): string => str(pick(m, ["userStudentId", "user_student_id", "id"]));

const reportStudentId = (r: any): string =>
  str(
    (r?.userStudent && (r.userStudent.userStudentId ?? r.userStudent.id ?? r.userStudent.studentId)) ??
      pick(r, ["userStudentId", "user_student_id", "studentId", "student_id"])
  );

const appointmentStudentId = (a: any): string =>
  str((a?.student && (a.student.userStudentId ?? a.student.id)) ?? pick(a, ["userStudentId", "studentId"]));

const reportAssessmentId = (r: any): string => str(pick(r, ["assessmentId", "assessment_id"]));

// ───────────────────────── test-data exclusion ─────────────────────────

/** True when any of the values contains "test" (case-insensitive) — the marker for test data. */
export const hasTestMarker = (...values: any[]): boolean =>
  values.some((v) => v != null && v !== "" && /test/i.test(String(v)));

/** A student-like row (StudentInfo, mapping row, nested studentInfo) with "test" in its identity. */
const studentTextIsTest = (s: any): boolean =>
  !!s &&
  hasTestMarker(
    pick(s, ["name", "studentName"]),
    s.email,
    s.username,
    s.schoolName,
    s.instituteName,
    s.user?.username,
    s.user?.email,
    s.user?.name
  );

/**
 * Drop every test record from the snapshot BEFORE anything is counted or
 * exported: institutes / assessments / counsellors whose name (or email) has
 * "test" in it, students with "test" in their name, email, login, school or
 * institute, and every mapping / report / appointment / rating that points at
 * one of those. Mirrors the server-side rule in OverviewQuery#notTestStudent.
 */
export const stripTestEntities = (snap: AdminDashboardSnapshot): AdminDashboardSnapshot => {
  const droppedInstituteKeys = new Set<string>();
  const institutes = snap.institutes.filter((i) => {
    if (!hasTestMarker(pick(i, ["instituteName", "name"]))) return true;
    instituteKeysOf(i).forEach((k) => droppedInstituteKeys.add(k));
    return false;
  });

  const droppedAssessmentIds = new Set<string>();
  const assessments = snap.assessments.filter((a) => {
    if (!hasTestMarker(pick(a, ["assessmentName", "name", "title"]))) return true;
    const id = str(pick(a, ["id", "assessmentId"]));
    if (id) droppedAssessmentIds.add(id);
    return false;
  });

  const droppedCounsellorIds = new Set<string>();
  const counsellors = snap.counsellors.filter((c) => {
    if (!hasTestMarker(c?.name, c?.email, c?.user?.username, c?.user?.email)) return true;
    const id = str(pick(c, ["id", "counsellorId"]));
    if (id) droppedCounsellorIds.add(id);
    return false;
  });

  const droppedStudentIds = new Set<string>();
  const isTestStudent = (s: any) => studentTextIsTest(s) || droppedInstituteKeys.has(studentInstituteKey(s));
  const students = snap.students.filter((s) => {
    if (!isTestStudent(s)) return true;
    const id = mappingStudentId(s);
    if (id) droppedStudentIds.add(id);
    return false;
  });
  const studentMappings = snap.studentMappings
    .filter((m) => {
      const id = mappingStudentId(m);
      if (!isTestStudent(m) && !(id && droppedStudentIds.has(id))) return true;
      if (id) droppedStudentIds.add(id);
      return false;
    })
    .map((m) => {
      if (droppedAssessmentIds.size === 0) return m;
      const assigned = Array.isArray(m?.assessments) ? m.assessments : [];
      return {
        ...m,
        assessments: assigned.filter((a: any) => !droppedAssessmentIds.has(str(pick(a, ["assessmentId", "assessment_id"])))),
      };
    });

  const reports = snap.reports.filter((r) => {
    const sid = reportStudentId(r);
    return (
      !(sid && droppedStudentIds.has(sid)) &&
      !droppedAssessmentIds.has(reportAssessmentId(r)) &&
      !studentTextIsTest(r?.userStudent?.studentInfo)
    );
  });
  const appointments = snap.appointments.filter((a) => {
    const sid = appointmentStudentId(a);
    const cid = str(a?.counsellor?.id ?? a?.counsellorId);
    return (
      !(sid && droppedStudentIds.has(sid)) &&
      !studentTextIsTest(a?.student?.studentInfo) &&
      !(cid && droppedCounsellorIds.has(cid)) &&
      !hasTestMarker(a?.counsellor?.name, a?.counsellor?.email)
    );
  });
  const ratingSummary = snap.ratingSummary.filter((r) => !droppedCounsellorIds.has(str(r?.counsellorId)));

  return { ...snap, students, studentMappings, institutes, assessments, counsellors, reports, appointments, ratingSummary };
};

export const applyInstituteAssessmentFilter = (
  snap: AdminDashboardSnapshot,
  filter: InstituteAssessmentFilter
): AdminDashboardSnapshot => {
  const { instituteKeys, assessmentIds } = filter;
  if (!instituteKeys && !assessmentIds) return snap;

  let students = snap.students;
  let studentMappings = snap.studentMappings;
  let institutes = snap.institutes;
  let reports = snap.reports;
  let appointments = snap.appointments;
  let assessments = snap.assessments;

  if (instituteKeys) {
    students = students.filter((s) => instituteKeys.has(studentInstituteKey(s)));
    studentMappings = studentMappings.filter((m) => instituteKeys.has(studentInstituteKey(m)));
    institutes = institutes.filter((i) => {
      const keys = instituteKeysOf(i);
      return Array.from(keys).some((k) => instituteKeys.has(k));
    });
    const keptStudentIds = new Set<string>();
    studentMappings.forEach((m) => {
      const sid = mappingStudentId(m);
      if (sid) keptStudentIds.add(sid);
    });
    students.forEach((s) => {
      const sid = mappingStudentId(s);
      if (sid) keptStudentIds.add(sid);
    });
    reports = reports.filter((r) => {
      const sid = reportStudentId(r);
      return !!sid && keptStudentIds.has(sid);
    });
    appointments = appointments.filter((a) => {
      const sid = appointmentStudentId(a);
      return !!sid && keptStudentIds.has(sid);
    });
  }

  if (assessmentIds) {
    assessments = assessments.filter((a) => assessmentIds.has(str(pick(a, ["id", "assessmentId"]))));
    reports = reports.filter((r) => assessmentIds.has(reportAssessmentId(r)));
    studentMappings = studentMappings.map((m) => {
      const assigned = Array.isArray(m?.assessments) ? m.assessments : [];
      return {
        ...m,
        assessments: assigned.filter((a: any) => assessmentIds.has(str(pick(a, ["assessmentId", "assessment_id"])))),
      };
    });
  }

  return { ...snap, students, studentMappings, institutes, reports, appointments, assessments };
};
