import React, { useState, useEffect, useMemo, useReducer, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import PageHeader from "../../components/PageHeader";
import { ActionIcon } from "../../components/ActionIcon";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
// Student Management — cloned from GroupStudentPage (the Data Download menu)
// and stripped of every data-export path. Allotment / reset / demographics-view
// / edit-basic-info / report-status visibility stay; CSV/Excel/PDF exports +
// proctoring downloads + one-click report generation + report emailing are
// intentionally removed. Keep that distinction when extending this file.
import {
  getStudentsWithMappingByInstituteId,
  getAllAssessments,
  bulkAlotAssessment,
  Assessment,
  resetAssessment,
  getAllGameResults,
  getDemographicFieldsForStudent,
  updateStudentBasicInfo,
  sendLoginCredentials,
  generateBetReportOneClick,
  generatePagerReportOneClick,
  getGeneratedReportsForStudent,
} from "../StudentInformation/StudentInfo_APIs";
import { useAssessmentsForInstitute } from "../../hooks/useScopedAssessments";
// XLSX retained ONLY for the Student List export (admin convenience for the
// roster view). Per-student answer dumps + bulk answer dumps + proctoring
// downloads are intentionally absent from this page.
import * as XLSX from "xlsx";

// Convert DOB from API (ISO timestamp or dd-MM-yyyy) to dd-MM-yyyy
function formatDobFromApi(dob: any): string {
  if (!dob) return "";
  const s = String(dob);
  // Already dd-MM-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  // ISO format like 2004-02-06T00:00:00.000+00:00
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

type Student = {
  id: number;
  name: string;
  schoolRollNumber: string;
  controlNumber?: number;
  selectedAssessment: string;
  userStudentId: number;
  assessmentName?: string;
  phoneNumber?: string;
  studentDob?: string;
  loginDob?: string;
  username?: string;
  email?: string;
  schoolSectionId?: number;
  gender?: string;
  assessments?: StudentAssessmentInfo[];
  assignedAssessmentIds: number[];
};

type StudentAssessmentInfo = {
  assessmentId: number;
  assessmentName: string;
  status: string;
};

export default function StudentManagementPage() {
  const navigate = useNavigate();
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [students, setStudents] = useState<Student[]>([]);
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  // Narrow to assessments mapped to the selected institute (falls back to all when
  // nothing is picked or the institute has no mappings).
  const { assessments } = useAssessmentsForInstitute(selectedInstitute, allAssessments);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(
    new Set(),
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Modal manager (consolidates active modals into one state object) ──
  // Download/bulkDownload modal types are intentionally absent here — see
  // file-level note above.
  type ModalState = {
    type: "none" | "assessment" | "reset" | "demographics" | "edit";
    student: Student | null;
    assessmentId: number | null;
    assessmentName: string;
    showConfirm: boolean;
  };
  const [modal, setModal] = useState<ModalState>({ type: "none", student: null, assessmentId: null, assessmentName: "", showConfirm: false });
  const closeModal = useCallback(() => setModal({ type: "none", student: null, assessmentId: null, assessmentName: "", showConfirm: false }), []);

  // Edit student modal data
  const [editForm, setEditForm] = useState({ name: "", email: "", phoneNumber: "", studentDob: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Assessment modal data
  const [studentAssessments, setStudentAssessments] = useState<StudentAssessmentInfo[]>([]);

  // Demographics data (view-only — no bulk export path)
  const [demographicsData, setDemographicsData] = useState<any[]>([]);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  // Reset state
  const [resetting, setResetting] = useState(false);

  // Credentials-email send-in-flight tracking. Set of userStudentIds currently
  // being processed. Lets us disable the button + show a spinner per-row.
  const [sendingCredentialsFor, setSendingCredentialsFor] = useState<Set<number>>(new Set());
  // Separate flag for the bulk-send button so a bulk run doesn't have to
  // populate the per-row set (and visa-versa).
  const [bulkSendingCredentials, setBulkSendingCredentials] = useState(false);

  // ── Report state (Generate / Download / Regenerate per assessment) ──
  // key = "userStudentId-assessmentId", value = DO Spaces report URL.
  // Hydrated on modal open from /generated-reports/by-student; populated
  // inline as Generate/Regenerate calls return.
  const [generatedReportUrls, setGeneratedReportUrls] = useState<Map<string, string>>(new Map());
  // "userStudentId-assessmentId" of the row currently in-flight, so we can
  // disable + spin the right Generate / Regenerate button per assessment.
  const [reportGeneratingFor, setReportGeneratingFor] = useState<string | null>(null);

  /** Build the Map key used by generatedReportUrls / reportGeneratingFor. */
  const reportKey = (userStudentId: number, assessmentId: number) =>
    `${userStudentId}-${assessmentId}`;

  /**
   * Picks the right one-click generator based on the assessment's type. BET
   * assessments (questionnaire.type === true) get the BET pipeline; everything
   * else (Navigator-type) gets the new pager 4-pager pipeline. Legacy
   * 18-pager Navigator is intentionally NOT reachable from here — kept in
   * ReportsHub only (per product decision).
   */
  const generateReportForAssessment = async (
    assessmentId: number,
    userStudentId: number,
    force: boolean,
  ): Promise<string | null> => {
    const fullAssessment = (assessments as any[]).find((a: any) => a.id === assessmentId);
    const isBet = fullAssessment?.questionnaire?.type === true;
    if (isBet) {
      const res = await generateBetReportOneClick(assessmentId, userStudentId, force);
      return (res.data as any)?.reportUrl || null;
    }
    const res = await generatePagerReportOneClick(assessmentId, userStudentId, force);
    return res.data?.reportUrl || null;
  };

  /**
   * Single entrypoint for the View modal + per-row chip + Regenerate buttons.
   * Writes the resolved URL into state on success; shows a toast on failure
   * or "not ready" (e.g. async persist hasn't landed yet).
   */
  const handleGenerateReport = async (
    assessmentId: number,
    userStudentId: number,
    force: boolean,
  ) => {
    const key = reportKey(userStudentId, assessmentId);
    if (reportGeneratingFor === key) return;
    setReportGeneratingFor(key);
    try {
      const url = await generateReportForAssessment(assessmentId, userStudentId, force);
      if (url) {
        setGeneratedReportUrls((prev) => {
          const next = new Map(prev);
          next.set(key, url);
          return next;
        });
        showSuccessToast(force ? "Report regenerated." : "Report ready.");
      } else {
        showErrorToast("Report generation returned no URL.");
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 503 || body?.status === "not_ready") {
        showErrorToast(body?.error || "Scores aren't ready yet. Try again in a moment.");
      } else {
        const msg = body?.error || body?.message || err?.message || "Report generation failed";
        showErrorToast(msg);
      }
    } finally {
      setReportGeneratingFor(null);
    }
  };

  // ── Convenience aliases for backward compatibility ──
  const showAssessmentModal = modal.type === "assessment";
  const modalStudent = modal.student;
  const showResetModal = modal.type === "reset";
  const resetStudent = modal.student;
  const resetAssessmentId = modal.assessmentId;
  const resetAssessmentName = modal.assessmentName;
  const showResetConfirm = modal.showConfirm;
  const showDemographicsModal = modal.type === "demographics";
  const demographicsStudent = modal.student;
  const demographicsAssessmentId = modal.assessmentId;
  const demographicsAssessmentName = modal.assessmentName;

  // ── Setter aliases (map old setters to new modal state) ──
  const setShowAssessmentModal = (v: boolean) => v ? undefined : closeModal();
  const setModalStudent = (s: Student | null) => setModal((m) => ({ ...m, student: s }));
  const setShowResetModal = (v: boolean) => v ? undefined : closeModal();
  const setShowResetConfirm = (v: boolean) => setModal((m) => ({ ...m, showConfirm: v }));
  const setShowDemographicsModal = (v: boolean) => v ? undefined : closeModal();

  // ── Filter state (consolidated into one object) ──
  type FilterSet = { assessmentIds: Set<number>; sessions: Set<string>; grades: Set<string>; sections: Set<string>; statuses: Set<string>; genders: Set<string>; enabled: Set<string>; };
  const emptyFilters = (): FilterSet => ({ assessmentIds: new Set(), sessions: new Set(), grades: new Set(), sections: new Set(), statuses: new Set(), genders: new Set(), enabled: new Set() });
  const [pending, setPending] = useState<FilterSet>(emptyFilters());
  const [applied, setApplied] = useState<FilterSet>(emptyFilters());
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>("assessment");

  // ── Filter aliases for backward compatibility ──
  const pendingAssessmentIds = pending.assessmentIds;
  const pendingSessions = pending.sessions;
  const pendingGrades = pending.grades;
  const pendingSections = pending.sections;
  const pendingStatuses = pending.statuses;
  const pendingGenders = pending.genders;
  const pendingEnabled = pending.enabled;
  const appliedAssessmentIds = applied.assessmentIds;
  const appliedSessions = applied.sessions;
  const appliedGrades = applied.grades;
  const appliedSections = applied.sections;
  const appliedStatuses = applied.statuses;
  const appliedGenders = applied.genders;
  const appliedEnabled = applied.enabled;

  // Setter helpers for filters
  const setPendingAssessmentIds = (v: Set<number> | ((p: Set<number>) => Set<number>)) => setPending((p) => ({ ...p, assessmentIds: typeof v === "function" ? v(p.assessmentIds) : v }));
  const setPendingSessions = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, sessions: typeof v === "function" ? v(p.sessions) : v }));
  const setPendingGrades = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, grades: typeof v === "function" ? v(p.grades) : v }));
  const setPendingSections = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, sections: typeof v === "function" ? v(p.sections) : v }));
  const setPendingStatuses = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, statuses: typeof v === "function" ? v(p.statuses) : v }));
  const setPendingGenders = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, genders: typeof v === "function" ? v(p.genders) : v }));
  const setPendingEnabled = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, enabled: typeof v === "function" ? v(p.enabled) : v }));
  const setAppliedAssessmentIds = (v: Set<number>) => setApplied((a) => ({ ...a, assessmentIds: v }));
  const setAppliedSessions = (v: Set<string>) => setApplied((a) => ({ ...a, sessions: v }));
  const setAppliedGrades = (v: Set<string>) => setApplied((a) => ({ ...a, grades: v }));
  const setAppliedSections = (v: Set<string>) => setApplied((a) => ({ ...a, sections: v }));
  const setAppliedStatuses = (v: Set<string>) => setApplied((a) => ({ ...a, statuses: v }));
  const setAppliedGenders = (v: Set<string>) => setApplied((a) => ({ ...a, genders: v }));
  const setAppliedEnabled = (v: Set<string>) => setApplied((a) => ({ ...a, enabled: v }));
  // All available sessions / grades / sections from hierarchy
  const allSessions = useMemo(() => hierarchyData, [hierarchyData]);

  const allGrades = useMemo(() => {
    const grades: { id: number; className: string; sessionYear: string }[] = [];
    const seen = new Set<string>();
    for (const session of hierarchyData) {
      for (const cls of session.schoolClasses || []) {
        if (!seen.has(cls.className)) {
          seen.add(cls.className);
          grades.push({ id: cls.id, className: cls.className, sessionYear: session.sessionYear });
        }
      }
    }
    return grades;
  }, [hierarchyData]);

  const allSectionsFlat = useMemo(() => {
    const sections: { id: number; sectionName: string; className: string }[] = [];
    const seen = new Set<string>();
    for (const session of hierarchyData) {
      for (const cls of session.schoolClasses || []) {
        for (const sec of cls.schoolSections || []) {
          if (!seen.has(sec.sectionName)) {
            seen.add(sec.sectionName);
            sections.push({ id: sec.id, sectionName: sec.sectionName, className: cls.className });
          }
        }
      }
    }
    return sections;
  }, [hierarchyData]);

  // Collect all section IDs that match applied hierarchy filters
  const filteredSectionIds = useMemo(() => {
    const hasSession = appliedEnabled.has("session") && appliedSessions.size > 0;
    const hasGrade = appliedEnabled.has("grade") && appliedGrades.size > 0;
    const hasSection = appliedEnabled.has("section") && appliedSections.size > 0;
    if (!hasSession && !hasGrade && !hasSection) return null; // no hierarchy filter

    let sessions = hierarchyData;
    if (hasSession) {
      sessions = sessions.filter((s: any) => appliedSessions.has(s.sessionYear));
    }

    let classes = sessions.flatMap((s: any) => s.schoolClasses || []);
    if (hasGrade) {
      classes = classes.filter((c: any) => appliedGrades.has(c.className));
    }

    const sectionIds = new Set<number>();
    for (const cls of classes) {
      let secs = cls.schoolSections || [];
      if (hasSection) {
        secs = secs.filter((s: any) => appliedSections.has(s.sectionName));
      }
      for (const sec of secs) {
        sectionIds.add(sec.id);
      }
    }
    return sectionIds;
  }, [hierarchyData, appliedEnabled, appliedSessions, appliedGrades, appliedSections]);

  // Whether assessment filter is active
  const hasAssessmentFilter = appliedEnabled.has("assessment") && appliedAssessmentIds.size > 0;
  // Whether status filter is active
  const hasStatusFilter = appliedEnabled.has("status") && appliedStatuses.size > 0;
  // Whether gender filter is active
  const hasGenderFilter = appliedEnabled.has("gender") && appliedGenders.size > 0;

  // Status filter options
  const statusOptions = [
    { key: "completed", label: "Completed" },
    { key: "ongoing", label: "In Progress" },
    { key: "notstarted", label: "Not Started" },
  ];

  // Build a short label describing what filters are active
  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (hasAssessmentFilter) {
      const names = assessments
        .filter(a => appliedAssessmentIds.has(a.id))
        .map(a => a.assessmentName);
      parts.push(names.length === 1 ? names[0] : `${names.length} assessments`);
    }
    if (appliedEnabled.has("session") && appliedSessions.size > 0) {
      parts.push(appliedSessions.size === 1 ? Array.from(appliedSessions)[0] : `${appliedSessions.size} sessions`);
    }
    if (appliedEnabled.has("grade") && appliedGrades.size > 0) {
      parts.push(appliedGrades.size === 1 ? Array.from(appliedGrades)[0] : `${appliedGrades.size} grades`);
    }
    if (appliedEnabled.has("section") && appliedSections.size > 0) {
      parts.push(appliedSections.size === 1 ? Array.from(appliedSections)[0] : `${appliedSections.size} sections`);
    }
    if (hasStatusFilter) {
      const labels = statusOptions
        .filter(so => appliedStatuses.has(so.key))
        .map(so => so.label);
      parts.push(labels.length === 1 ? labels[0] : `${labels.length} statuses`);
    }
    if (hasGenderFilter) {
      parts.push(appliedGenders.size === 1 ? Array.from(appliedGenders)[0] : `${appliedGenders.size} genders`);
    }
    return parts.join(', ');
  }, [hasAssessmentFilter, appliedAssessmentIds, appliedEnabled, appliedSessions, appliedGrades, appliedSections, hasStatusFilter, appliedStatuses, hasGenderFilter, appliedGenders, assessments]);

  const isFiltered = activeFilterLabel.length > 0;

  const handleAssessmentChange = (studentId: number, assessmentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, selectedAssessment: assessmentId } : s
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Collect all new assignments
    const assignments = students
      .filter(
        (s) =>
          s.selectedAssessment &&
          !s.assignedAssessmentIds.includes(Number(s.selectedAssessment))
      )
      .map((s) => ({
        userStudentId: s.userStudentId,
        assessmentId: Number(s.selectedAssessment),
      }));

    if (assignments.length === 0) {
      showErrorToast("No new assessments to save.");
      return;
    }

    setSaving(true);
    bulkAlotAssessment(assignments);
    // try {
    // await bulkAlotAssessment(assignments);
    // showSuccessToast(`${assignments.length} assessment(s) saved successfully!`);
    // setHasChanges(false);

    // Refresh data
    //   if (selectedInstitute) {
    //     const response = await getStudentsWithMappingByInstituteId(
    //       Number(selectedInstitute)
    //     );
    //     const studentData = response.data.map((student: any) => {
    //       const assessmentId = student.assessmentId
    //         ? String(student.assessmentId)
    //         : "";
    //       const assessment = assessments.find(
    //         (a) => a.id === Number(assessmentId)
    //       );
    //       const assignedIds = Array.isArray(student.assignedAssessmentIds)
    //         ? student.assignedAssessmentIds
    //         : [];

    //       return {
    //         id: student.id,
    //         name: student.name || "",
    //         phoneNumber: student.phoneNumber || "",
    //         studentDob: formatDobFromApi(student.studentDob),
    //         loginDob: formatDobFromApi(student.loginDob),
    //         schoolRollNumber: student.schoolRollNumber || "",
    //         controlNumber: student.controlNumber ?? undefined,
    //         selectedAssessment: "",
    //         userStudentId: student.userStudentId,
    //         assessmentName: assessment?.assessmentName || "",
    //         username: student.username || "",
    //         email: student.email || "",
    //         schoolSectionId: student.schoolSectionId ?? undefined,
    //         gender: student.gender || "",
    //         assessments: student.assessments || [],
    //         assignedAssessmentIds: assignedIds,
    //       };
    //     });
    //     setStudents(studentData);
    //   }
    // } catch (error) {
    //   console.error("Error saving assessments:", error);
    //   showErrorToast("Failed to save assessments. Please try again.");
    // } finally {
    //   setSaving(false);
    // }
  };

  const handleResetClick = (student: Student, assessmentId: number, assessmentName: string) => {
    setModal({ type: "reset", student, assessmentId, assessmentName, showConfirm: false });
  };

  const handleConfirmReset = async () => {
    if (!resetStudent || !resetAssessmentId) return;

    setResetting(true);
    try {
      await resetAssessment(resetStudent.userStudentId, resetAssessmentId);
      showSuccessToast("Assessment reset successfully!");
      closeModal();

      // Refresh student data
      if (selectedInstitute) {
        const response = await getStudentsWithMappingByInstituteId(
          Number(selectedInstitute)
        );
        const studentData = response.data.map((student: any) => {
          const assessmentId = student.assessmentId
            ? String(student.assessmentId)
            : "";
          const assessment = assessments.find(
            (a) => a.id === Number(assessmentId)
          );
          const assignedIds = Array.isArray(student.assignedAssessmentIds)
            ? student.assignedAssessmentIds
            : [];

          return {
            id: student.id,
            name: student.name || "",
            phoneNumber: student.phoneNumber || "",
            studentDob: formatDobFromApi(student.studentDob),
            loginDob: formatDobFromApi(student.loginDob),
            schoolRollNumber: student.schoolRollNumber || "",
            controlNumber: student.controlNumber ?? undefined,
            selectedAssessment: "",
            userStudentId: student.userStudentId,
            assessmentName: assessment?.assessmentName || "",
            username: student.username || "",
            email: student.email || "",
            schoolSectionId: student.schoolSectionId ?? undefined,
            gender: student.gender || "",
            assessments: student.assessments || [],
            assignedAssessmentIds: assignedIds,
          };
        });
        setStudents(studentData);
      }

      // Refresh modal student assessments if modal is open
      if (showAssessmentModal && modalStudent) {
        const updatedStudent = students.find(
          (s) => s.userStudentId === modalStudent.userStudentId
        );
        if (updatedStudent) {
          setModalStudent(updatedStudent);
          setStudentAssessments(updatedStudent.assessments || []);
        }
      }

      closeModal();
    } catch (error: any) {
      console.error("Error resetting assessment:", error);
      showErrorToast(error.response?.data?.error || "Failed to reset assessment");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    ReadCollegeList()
      .then((res: any) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setInstitutes(list);
      })
      .catch((err: any) => console.error("Failed to fetch institutes", err));

    // Fetch assessments (only active ones) — the hook narrows this down per institute.
    getAllAssessments()
      .then((response) => {
        const activeOnly = (response.data || []).filter((a: any) => a.isActive !== false);
        setAllAssessments(activeOnly);
      })
      .catch((error) => {
        console.error("Error fetching assessments:", error);
      });
  }, []);

  // Fetch hierarchy data when institute changes
  useEffect(() => {
    if (selectedInstitute) {
      GetSessionsByInstituteCode(selectedInstitute).then((res: any) => {
        setHierarchyData(res.data || []);
      }).catch(() => setHierarchyData([]));
    } else {
      setHierarchyData([]);
    }
    // Reset all filters when institute changes
    setApplied(emptyFilters());
    setPending(emptyFilters());
    setShowFilterPanel(false);
  }, [selectedInstitute]);

  useEffect(() => {
    if (selectedInstitute) {
      setLoading(true);
      getStudentsWithMappingByInstituteId(Number(selectedInstitute))
        .then((response) => {
          const studentData = response.data.map((student: any) => {
            const assignedIds = Array.isArray(student.assignedAssessmentIds)
              ? student.assignedAssessmentIds
              : [];

            return {
              id: student.id,
              name: student.name || "",
              phoneNumber: student.phoneNumber || "",
              studentDob: formatDobFromApi(student.studentDob),
              loginDob: formatDobFromApi(student.loginDob),
              schoolRollNumber: student.schoolRollNumber || "",
              controlNumber: student.controlNumber ?? undefined,
              selectedAssessment: "",
              userStudentId: student.userStudentId,
              assessmentName: "",
              username: student.username || "",
              email: student.email || "",
              schoolSectionId: student.schoolSectionId ?? undefined,
              gender: student.gender || "",
              assessments: student.assessments || [],
              assignedAssessmentIds: assignedIds,
            };
          });
          setStudents(studentData);
        })
        .catch((error) => {
          console.error("Error fetching student info:", error);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedInstitute]);

  // Distinct gender values present in the loaded students
  const allGenders = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      const g = (s.gender || "").trim();
      if (g) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  // Set of active assessment IDs — memoized
  const activeAssessmentIds = useMemo(() => new Set(assessments.map((a) => a.id)), [assessments]);

  // Pre-compute per-student active assessment count
  const studentAssessmentCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of students) {
      const count = new Set(
        (s.assessments || [])
          .filter(a => activeAssessmentIds.has(Number(a.assessmentId)))
          .map(a => Number(a.assessmentId))
      ).size;
      map.set(s.userStudentId, count);
    }
    return map;
  }, [students, activeAssessmentIds]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Text search filter
      const matchesQuery =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.schoolRollNumber.toLowerCase().includes(query.toLowerCase()) ||
        (s.controlNumber != null && s.controlNumber.toString().includes(query)) ||
        s.userStudentId.toString().includes(query);

      // Session/Grade/Section filter
      const matchesSection =
        filteredSectionIds === null ||
        (s.schoolSectionId != null && filteredSectionIds.has(s.schoolSectionId));

      // Assessment filter: student must have at least one of the selected assessments
      let matchesAssessment = true;
      if (hasAssessmentFilter) {
        const activeStudentAssessments = (s.assessments || []).filter(
          (a) => activeAssessmentIds.has(Number(a.assessmentId))
        );
        matchesAssessment = activeStudentAssessments.some(
          (a) => appliedAssessmentIds.has(Number(a.assessmentId))
        );
      }

      // Status filter: student must have at least one assessment matching the selected statuses
      let matchesStatus = true;
      if (hasStatusFilter) {
        const activeStudentAssessments = (s.assessments || []).filter(
          (a) => activeAssessmentIds.has(Number(a.assessmentId))
        );
        // If assessment filter is also active, only check statuses on those specific assessments
        const relevantAssessments = hasAssessmentFilter
          ? activeStudentAssessments.filter((a) => appliedAssessmentIds.has(Number(a.assessmentId)))
          : activeStudentAssessments;

        if (relevantAssessments.length === 0) {
          // No assessments at all — matches "notstarted" only
          matchesStatus = appliedStatuses.has("notstarted");
        } else {
          matchesStatus = relevantAssessments.some((a) => appliedStatuses.has(a.status));
        }
      }

      // Gender filter
      let matchesGender = true;
      if (hasGenderFilter) {
        const g = (s.gender || "").trim();
        matchesGender = g.length > 0 && appliedGenders.has(g);
      }

      return matchesQuery && matchesSection && matchesAssessment && matchesStatus && matchesGender;
    });
  }, [students, query, filteredSectionIds, hasAssessmentFilter, appliedAssessmentIds, hasStatusFilter, appliedStatuses, hasGenderFilter, appliedGenders, activeAssessmentIds]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, safeCurrentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filteredSectionIds, appliedAssessmentIds, appliedStatuses, appliedGenders]);

  const getSelectedInstituteName = () => {
    const institute = institutes.find(
      (inst) => inst.instituteCode === selectedInstitute
    );
    return institute?.instituteName || "";
  };

  const handleDownloadStudentList = () => {
    if (filteredStudents.length === 0) {
      showErrorToast("No students to download.");
      return;
    }

    try {
      // Build section ID → {className, sectionName} lookup from full hierarchy (not deduped)
      const sectionLookup = new Map<number, { className: string; sectionName: string }>();
      for (const session of hierarchyData) {
        for (const cls of session.schoolClasses || []) {
          for (const sec of cls.schoolSections || []) {
            if (!sectionLookup.has(sec.id)) {
              sectionLookup.set(sec.id, { className: cls.className, sectionName: sec.sectionName });
            }
          }
        }
      }

      // Prepare data for Excel
      const excelData = filteredStudents.map((student, index) => {
        const secInfo = student.schoolSectionId ? sectionLookup.get(student.schoolSectionId) : undefined;
        return {
          "S.No": index + 1,
          "Username": student.username && !isNaN(Number(student.username)) ? Number(student.username) : (student.username || "N/A"),
          "Student Name": student.name,
          "Class": secInfo?.className || "N/A",
          "Section": secInfo?.sectionName || "N/A",
          // "Roll Number": student.schoolRollNumber || "N/A",
          // "Phone Number": student.phoneNumber || "N/A",
          "Date of Birth": student.loginDob || "N/A",
          "Institute": getSelectedInstituteName(),
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 },   // S.No
        { wch: 20 },  // Username
        { wch: 30 },  // Student Name
        { wch: 15 },  // Class
        { wch: 15 },  // Section
        { wch: 15 },  // Date of Birth
        { wch: 30 },  // Institute
      ];

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

      // Generate filename
      const instituteName = getSelectedInstituteName().replace(/\s+/g, "_");
      const filename = `${instituteName}_Students_${Date.now()}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      showSuccessToast(`Student list downloaded successfully!`);
    } catch (error) {
      console.error("Error downloading student list:", error);
      showErrorToast("Failed to download student list. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";

    // Extract just the date part (YYYY-MM-DD) from the ISO string
    const datePart = dateString.split("T")[0];

    // Convert to a more readable format (DD-MM-YYYY)
    const date = new Date(datePart);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  };

  const handleCheckboxChange = (userStudentId: number) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userStudentId)) {
        newSet.delete(userStudentId);
      } else {
        newSet.add(userStudentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(
        new Set(filteredStudents.map((s) => s.userStudentId))
      );
    }
  };

  /**
   * Re-queue the styled "here are your login credentials" Odoo email for one
   * student. Backend looks up the username + DOB (as the initial password)
   * and validates that an email is on file; surfaced failures here are
   * "queued failed" (no email / no DOB / no username) — actual SMTP success
   * shows up only in backend logs.
   */
  const handleSendCredentials = async (student: Student) => {
    if (sendingCredentialsFor.has(student.userStudentId)) return;
    setSendingCredentialsFor((prev) => {
      const next = new Set(prev);
      next.add(student.userStudentId);
      return next;
    });
    try {
      const res = await sendLoginCredentials([student.userStudentId]);
      const row = (res.data?.results || [])[0];
      if (res.data?.sent > 0 && row?.status === "queued") {
        showSuccessToast(`Credentials email queued for ${student.name} (${row.email || "email on file"}).`);
      } else {
        const reason = row?.reason || "Unknown error";
        showErrorToast(`Could not send credentials to ${student.name}: ${reason}`);
      }
    } catch (err: any) {
      console.error("send-login-credentials failed:", err);
      const msg = err?.response?.data?.message || err?.message || "Request failed";
      showErrorToast(`Could not send credentials to ${student.name}: ${msg}`);
    } finally {
      setSendingCredentialsFor((prev) => {
        const next = new Set(prev);
        next.delete(student.userStudentId);
        return next;
      });
    }
  };

  /**
   * Bulk variant of {@link handleSendCredentials}. Targets the checkbox-
   * selected rows when any are selected; otherwise targets every row matching
   * the current filter (the same set the "Student List" Excel download uses).
   * Confirms before firing because the resulting Odoo dispatches are
   * irreversible from the admin's side.
   */
  const handleBulkSendCredentials = async () => {
    if (bulkSendingCredentials) return;
    const targetStudents = selectedStudents.size > 0
      ? filteredStudents.filter((s) => selectedStudents.has(s.userStudentId))
      : filteredStudents;
    if (targetStudents.length === 0) {
      showErrorToast("No students to send credentials to.");
      return;
    }
    const scopeLabel = selectedStudents.size > 0 ? "selected" : "filtered";
    const confirmed = window.confirm(
      `Send login credentials emails to ${targetStudents.length} ${scopeLabel} student${targetStudents.length === 1 ? "" : "s"}?\n\n`
      + "Each student must have an email on file, a username, and a date of birth — others will be skipped and reported as failures."
    );
    if (!confirmed) return;

    setBulkSendingCredentials(true);
    try {
      const ids = targetStudents.map((s) => s.userStudentId);
      const res = await sendLoginCredentials(ids);
      const sent = res.data?.sent ?? 0;
      const failed = res.data?.failed ?? 0;
      if (sent > 0 && failed === 0) {
        showSuccessToast(`Credentials emails queued for all ${sent} student${sent === 1 ? "" : "s"}.`);
      } else if (sent > 0 && failed > 0) {
        showSuccessToast(`Queued ${sent}, failed ${failed}. Check console for per-student reasons.`);
        console.warn("Bulk send-credentials partial failures:", res.data?.results);
      } else {
        showErrorToast(`Could not queue any credentials emails. ${failed} failed.`);
        console.warn("Bulk send-credentials all failed:", res.data?.results);
      }
    } catch (err: any) {
      console.error("bulk send-login-credentials failed:", err);
      const msg = err?.response?.data?.message || err?.message || "Request failed";
      showErrorToast(`Bulk send failed: ${msg}`);
    } finally {
      setBulkSendingCredentials(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditForm({
      name: student.name || "",
      email: student.email || "",
      phoneNumber: student.phoneNumber || "",
      studentDob: student.loginDob || "",
    });
    setModal({ type: "edit", student, assessmentId: null, assessmentName: "", showConfirm: false });
  };

  const handleSaveEdit = async () => {
    if (!modal.student) return;
    setEditSaving(true);
    try {
      const payload: any = { userStudentId: modal.student.userStudentId };
      if (editForm.name.trim()) payload.name = editForm.name.trim();
      if (editForm.email.trim()) payload.email = editForm.email.trim();
      if (editForm.phoneNumber.trim()) payload.phoneNumber = editForm.phoneNumber.trim();
      if (editForm.studentDob.trim()) payload.studentDob = editForm.studentDob.trim();
      await updateStudentBasicInfo(payload);
      // Update local state so table reflects changes without refetch
      setStudents((prev) =>
        prev.map((s) =>
          s.userStudentId === modal.student!.userStudentId
            ? {
              ...s,
              name: editForm.name.trim() || s.name,
              email: editForm.email.trim() || s.email,
              phoneNumber: editForm.phoneNumber.trim() || s.phoneNumber,
              studentDob: editForm.studentDob.trim() || s.studentDob,
              loginDob: editForm.studentDob.trim() || s.loginDob,
            }
            : s
        )
      );
      showSuccessToast("Student info updated successfully");
      closeModal();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || "Failed to update student info");
    } finally {
      setEditSaving(false);
    }
  };

  const handleViewAssessments = (student: Student) => {
    setModal({ type: "assessment", student, assessmentId: null, assessmentName: "", showConfirm: false });
    // Filter out deactivated assessments and deduplicate by assessmentId
    const activeOnly = (student.assessments || []).filter(
      (a) => activeAssessmentIds.has(Number(a.assessmentId))
    );
    const seen = new Set<number>();
    const deduplicated = activeOnly.filter((a) => {
      const id = Number(a.assessmentId);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    setStudentAssessments(deduplicated);

    // Hydrate the report-URL map for this student so Generate / Download /
    // Regenerate buttons start in the right state. Best-effort — on failure
    // we just default-to-Generate (the per-button flows still work).
    getGeneratedReportsForStudent(student.userStudentId)
      .then((res) => {
        const rows = res.data || [];
        setGeneratedReportUrls((prev) => {
          const next = new Map(prev);
          for (const r of rows) {
            if (r.reportStatus === "generated" && r.reportUrl) {
              next.set(reportKey(student.userStudentId, r.assessmentId), r.reportUrl);
            }
          }
          return next;
        });
      })
      .catch((err) => {
        console.warn("getGeneratedReportsForStudent failed (non-fatal):", err);
      });
  };

  const handleViewDemographics = async (student: Student, assessmentId: number, assessmentName: string) => {
    setModal({ type: "demographics", student, assessmentId, assessmentName, showConfirm: false });
    setDemographicsLoading(true);
    setDemographicsData([]);

    try {
      const response = await getDemographicFieldsForStudent(assessmentId, student.userStudentId);
      setDemographicsData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching demographics:", err);
      setDemographicsData([]);
    } finally {
      setDemographicsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      completed: { bg: "#d1fae5", text: "#059669" },
      ongoing: { bg: "#dbeafe", text: "#2563eb" },
      notstarted: { bg: "#fef3c7", text: "#d97706" },
    };
    const style = colors[status] || colors.notstarted;
    return (
      <span
        style={{
          backgroundColor: style.bg,
          color: style.text,
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "capitalize",
        }}
      >
        {status === "notstarted" ? "Not Started" : status}
      </span>
    );
  };

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-people" />}
        title="Student Management"
        subtitle={
          selectedInstitute ? (
            <>
              <strong>{students.length}</strong> student{students.length === 1 ? "" : "s"} ·{" "}
              {getSelectedInstituteName()}
            </>
          ) : (
            "Select an institute to manage student assessments"
          )
        }
      />
      <div
        style={{
          padding: "0",
        }}
      >
        <style>{`
        .form-select-custom {
          width: 100%;
          padding: 0.7rem 1rem;
          font-size: 0.95rem;
          font-weight: 500;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          transition: all 0.3s ease;
          background-color: white;
          cursor: pointer;
        }

        .form-select-custom:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 4px rgba(67, 97, 238, 0.1);
        }

        .form-select-custom:hover {
          border-color: #4361ee;
        }

        .custom-checkbox {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #4361ee;
        }

        .institute-dropdown-container {
          max-width: 320px;
          margin-bottom: 1rem;
        }
      `}</style>

        {/* Institute Dropdown - Always visible at top left */}
        <div className="institute-dropdown-container">
          <label
            className="form-label mb-2 d-flex align-items-center gap-2"
            style={{ fontWeight: 600, color: "#1a1a2e", fontSize: "0.95rem" }}
          >
            <i className="bi bi-building" style={{ color: "#4361ee" }}></i>
            Select Institute
          </label>
          <select
            className="form-select-custom"
            value={selectedInstitute}
            onChange={(e) => {
              const newValue = e.target.value ? Number(e.target.value) : "";
              setSelectedInstitute(newValue);
              if (!newValue) {
                setStudents([]);
                setQuery("");
                setSelectedStudents(new Set());
                setHasChanges(false);
              }
            }}
          >
            <option value="">Select Institute</option>
            {institutes.map((inst) => (
              <option key={inst.instituteCode} value={inst.instituteCode}>
                {inst.instituteName}
              </option>
            ))}
          </select>
        </div>

        {/* Students List Section - Only shown when institute is selected */}
        {selectedInstitute && (
          <>
            {/* Header Card */}
            <div
              className="card border-0 shadow-sm mb-3"
              style={{ borderRadius: "12px" }}
            >
              <div className="card-body p-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <h5 className="mb-1 fw-bold" style={{ color: "#1a1a2e" }}>
                      <i
                        className="bi bi-people-fill me-2"
                        style={{ color: "#4361ee" }}
                      ></i>
                      Students List
                    </h5>
                    <p className="text-muted mb-0">
                      View all students enrolled in {getSelectedInstituteName()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Icon + Active Filter Tags */}
            <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
              <button
                className="btn btn-sm d-flex align-items-center gap-2"
                onClick={() => {
                  if (!showFilterPanel) {
                    // Sync pending state from applied state when opening
                    setPendingEnabled(new Set(Array.from(appliedEnabled)));
                    setPendingAssessmentIds(new Set(Array.from(appliedAssessmentIds)));
                    setPendingSessions(new Set(Array.from(appliedSessions)));
                    setPendingGrades(new Set(Array.from(appliedGrades)));
                    setPendingSections(new Set(Array.from(appliedSections)));
                    setPendingStatuses(new Set(Array.from(appliedStatuses)));
                  }
                  setShowFilterPanel(!showFilterPanel);
                }}
                style={{
                  background: showFilterPanel
                    ? "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)"
                    : "rgba(67, 97, 238, 0.1)",
                  color: showFilterPanel ? "#fff" : "#4361ee",
                  border: showFilterPanel ? "none" : "1px solid rgba(67, 97, 238, 0.3)",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                <ActionIcon type="filter" size="sm" />
                Filters
                {isFiltered && (
                  <span
                    style={{
                      background: showFilterPanel ? "rgba(255,255,255,0.3)" : "#f1416c",
                      color: "#fff",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      marginLeft: "4px",
                    }}
                  >
                    {(hasAssessmentFilter ? 1 : 0)
                      + (appliedEnabled.has("session") && appliedSessions.size > 0 ? 1 : 0)
                      + (appliedEnabled.has("grade") && appliedGrades.size > 0 ? 1 : 0)
                      + (appliedEnabled.has("section") && appliedSections.size > 0 ? 1 : 0)
                      + (hasStatusFilter ? 1 : 0)
                      + (hasGenderFilter ? 1 : 0)}
                  </span>
                )}
              </button>
              {isFiltered && (
                <>
                  <div className="d-flex flex-wrap gap-2">
                    {hasAssessmentFilter && assessments.filter(a => appliedAssessmentIds.has(a.id)).map(a => (
                      <span key={a.id} style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", padding: "4px 12px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: 600 }}>
                        {a.assessmentName}
                      </span>
                    ))}
                    {appliedEnabled.has("session") && Array.from(appliedSessions).map(s => (
                      <span key={s} style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669", padding: "4px 12px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                    {appliedEnabled.has("grade") && Array.from(appliedGrades).map(g => (
                      <span key={g} style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706", padding: "4px 12px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: 600 }}>
                        {g}
                      </span>
                    ))}
                    {appliedEnabled.has("section") && Array.from(appliedSections).map(s => (
                      <span key={s} style={{ background: "rgba(139, 92, 246, 0.1)", color: "#7c3aed", padding: "4px 12px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                    {hasStatusFilter && Array.from(appliedStatuses).map(st => (
                      <span key={st} style={{
                        background: st === "completed" ? "rgba(16, 185, 129, 0.1)" : st === "ongoing" ? "rgba(37, 99, 235, 0.1)" : "rgba(245, 158, 11, 0.1)",
                        color: st === "completed" ? "#059669" : st === "ongoing" ? "#2563eb" : "#d97706",
                        padding: "4px 12px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: 600
                      }}>
                        {st === "notstarted" ? "Not Started" : st === "ongoing" ? "In Progress" : "Completed"}
                      </span>
                    ))}
                    {hasGenderFilter && Array.from(appliedGenders).map(g => (
                      <span key={g} style={{ background: "rgba(6, 182, 212, 0.1)", color: "#0891b2", padding: "4px 12px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: 600 }}>
                        {g}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn btn-sm d-flex align-items-center gap-1"
                    onClick={() => {
                      setAppliedEnabled(new Set());
                      setAppliedAssessmentIds(new Set());
                      setAppliedSessions(new Set());
                      setAppliedGrades(new Set());
                      setAppliedSections(new Set());
                      setAppliedStatuses(new Set());
                      setAppliedGenders(new Set());
                      setPendingEnabled(new Set());
                      setPendingAssessmentIds(new Set());
                      setPendingSessions(new Set());
                      setPendingGrades(new Set());
                      setPendingSections(new Set());
                      setPendingStatuses(new Set());
                      setPendingGenders(new Set());
                    }}
                    style={{
                      background: "rgba(241, 65, 108, 0.1)",
                      color: "#f1416c",
                      border: "1px solid rgba(241, 65, 108, 0.3)",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontWeight: 500,
                      fontSize: "0.85rem",
                    }}
                  >
                    <ActionIcon type="reject" size="sm" />
                    Clear All
                  </button>
                </>
              )}
            </div>

            {/* Filter Panel (toggleable) */}
            {showFilterPanel && (
              <div
                className="card border-0 shadow-sm mb-3"
                style={{ borderRadius: "16px", border: "2px solid rgba(67, 97, 238, 0.2)" }}
              >
                <div
                  style={{
                    background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                    padding: "12px 20px",
                    borderRadius: "16px 16px 0 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>
                    <i className="bi bi-sliders me-2"></i>Select Filters
                  </span>
                  <button
                    className="btn btn-sm"
                    onClick={() => setShowFilterPanel(false)}
                    style={{ color: "#fff", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", padding: "4px 10px" }}
                  >
                    <ActionIcon type="reject" size="sm" />
                  </button>
                </div>
                <div style={{ display: "flex", minHeight: "300px" }}>
                  {/* Left panel — filter categories */}
                  <div style={{ width: "240px", borderRight: "1px solid #e0e0e0", background: "#fafbfc" }}>
                    {[
                      { key: "assessment", label: "Assessment", icon: "bi-clipboard-data" },
                      { key: "session", label: "Session", icon: "bi-calendar3" },
                      { key: "grade", label: "Grade / Class", icon: "bi-mortarboard" },
                      { key: "section", label: "Section", icon: "bi-diagram-3" },
                      { key: "status", label: "Assessment Status", icon: "bi-check2-circle" },
                      { key: "gender", label: "Gender", icon: "bi-person-fill" },
                    ].map((cat) => (
                      <div
                        key={cat.key}
                        onClick={() => setActiveFilterCategory(cat.key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "14px 20px",
                          cursor: "pointer",
                          borderBottom: "1px solid #e0e0e0",
                          background: activeFilterCategory === cat.key ? "rgba(67, 97, 238, 0.08)" : "transparent",
                          borderLeft: activeFilterCategory === cat.key ? "3px solid #4361ee" : "3px solid transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          style={{ width: "18px", height: "18px" }}
                          checked={pendingEnabled.has(cat.key)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = new Set(Array.from(pendingEnabled));
                            if (next.has(cat.key)) {
                              next.delete(cat.key);
                            } else {
                              next.add(cat.key);
                            }
                            setPendingEnabled(next);
                            setActiveFilterCategory(cat.key);
                          }}
                        />
                        <i className={`bi ${cat.icon}`} style={{ color: activeFilterCategory === cat.key ? "#4361ee" : "#666", fontSize: "1.1rem" }}></i>
                        <span style={{ fontWeight: 600, color: activeFilterCategory === cat.key ? "#4361ee" : "#333", fontSize: "0.9rem" }}>
                          {cat.label}
                        </span>
                        {pendingEnabled.has(cat.key) && (
                          <span
                            style={{
                              marginLeft: "auto",
                              background: "#4361ee",
                              color: "#fff",
                              borderRadius: "50%",
                              width: "22px",
                              height: "22px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {cat.key === "assessment" ? pendingAssessmentIds.size
                              : cat.key === "session" ? pendingSessions.size
                                : cat.key === "grade" ? pendingGrades.size
                                  : cat.key === "section" ? pendingSections.size
                                    : cat.key === "status" ? pendingStatuses.size
                                      : pendingGenders.size}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Right panel — options for selected category */}
                  <div style={{ flex: 1, padding: "20px" }}>
                    {!pendingEnabled.has(activeFilterCategory) && (
                      <div style={{ textAlign: "center", color: "#999", paddingTop: "60px" }}>
                        <i className="bi bi-check2-square" style={{ fontSize: "2rem", color: "#ccc", display: "block", marginBottom: "12px" }}></i>
                        Tick the checkbox on the left to enable <strong>{activeFilterCategory}</strong> filter
                      </div>
                    )}

                    {/* Assessment options */}
                    {activeFilterCategory === "assessment" && pendingEnabled.has("assessment") && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>Select Assessments</span>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (pendingAssessmentIds.size === assessments.length) {
                                setPendingAssessmentIds(new Set());
                              } else {
                                setPendingAssessmentIds(new Set(assessments.map(a => a.id)));
                              }
                            }}
                            style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "none", borderRadius: "8px", padding: "4px 12px", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            {pendingAssessmentIds.size === assessments.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {assessments.map((a) => (
                            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: pendingAssessmentIds.has(a.id) ? "rgba(67, 97, 238, 0.05)" : "transparent" }}>
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                style={{ width: "18px", height: "18px" }}
                                checked={pendingAssessmentIds.has(a.id)}
                                onChange={() => {
                                  const next = new Set(Array.from(pendingAssessmentIds));
                                  if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                                  setPendingAssessmentIds(next);
                                }}
                              />
                              <span style={{ fontWeight: 500, color: "#333" }}>{a.assessmentName}</span>
                            </label>
                          ))}
                          {assessments.length === 0 && (
                            <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>No assessments available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Session options */}
                    {activeFilterCategory === "session" && pendingEnabled.has("session") && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>Select Sessions</span>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (pendingSessions.size === allSessions.length) {
                                setPendingSessions(new Set());
                              } else {
                                setPendingSessions(new Set(allSessions.map((s: any) => s.sessionYear)));
                              }
                            }}
                            style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "none", borderRadius: "8px", padding: "4px 12px", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            {pendingSessions.size === allSessions.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {allSessions.map((s: any) => (
                            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: pendingSessions.has(s.sessionYear) ? "rgba(67, 97, 238, 0.05)" : "transparent" }}>
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                style={{ width: "18px", height: "18px" }}
                                checked={pendingSessions.has(s.sessionYear)}
                                onChange={() => {
                                  const next = new Set(Array.from(pendingSessions));
                                  if (next.has(s.sessionYear)) next.delete(s.sessionYear); else next.add(s.sessionYear);
                                  setPendingSessions(next);
                                }}
                              />
                              <span style={{ fontWeight: 500, color: "#333" }}>{s.sessionYear}</span>
                            </label>
                          ))}
                          {allSessions.length === 0 && (
                            <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>No sessions available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Grade options */}
                    {activeFilterCategory === "grade" && pendingEnabled.has("grade") && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>Select Grades</span>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (pendingGrades.size === allGrades.length) {
                                setPendingGrades(new Set());
                              } else {
                                setPendingGrades(new Set(allGrades.map(g => g.className)));
                              }
                            }}
                            style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "none", borderRadius: "8px", padding: "4px 12px", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            {pendingGrades.size === allGrades.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {allGrades.map((g) => (
                            <label key={g.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: pendingGrades.has(g.className) ? "rgba(67, 97, 238, 0.05)" : "transparent" }}>
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                style={{ width: "18px", height: "18px" }}
                                checked={pendingGrades.has(g.className)}
                                onChange={() => {
                                  const next = new Set(Array.from(pendingGrades));
                                  if (next.has(g.className)) next.delete(g.className); else next.add(g.className);
                                  setPendingGrades(next);
                                }}
                              />
                              <span style={{ fontWeight: 500, color: "#333" }}>{g.className}</span>
                            </label>
                          ))}
                          {allGrades.length === 0 && (
                            <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>No grades available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section options */}
                    {activeFilterCategory === "section" && pendingEnabled.has("section") && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>Select Sections</span>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (pendingSections.size === allSectionsFlat.length) {
                                setPendingSections(new Set());
                              } else {
                                setPendingSections(new Set(allSectionsFlat.map(s => s.sectionName)));
                              }
                            }}
                            style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "none", borderRadius: "8px", padding: "4px 12px", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            {pendingSections.size === allSectionsFlat.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {allSectionsFlat.map((s) => (
                            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: pendingSections.has(s.sectionName) ? "rgba(67, 97, 238, 0.05)" : "transparent" }}>
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                style={{ width: "18px", height: "18px" }}
                                checked={pendingSections.has(s.sectionName)}
                                onChange={() => {
                                  const next = new Set(Array.from(pendingSections));
                                  if (next.has(s.sectionName)) next.delete(s.sectionName); else next.add(s.sectionName);
                                  setPendingSections(next);
                                }}
                              />
                              <span style={{ fontWeight: 500, color: "#333" }}>{s.sectionName}</span>
                              <span style={{ color: "#999", fontSize: "0.8rem" }}>({s.className})</span>
                            </label>
                          ))}
                          {allSectionsFlat.length === 0 && (
                            <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>No sections available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status options */}
                    {activeFilterCategory === "status" && pendingEnabled.has("status") && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>Select Assessment Status</span>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (pendingStatuses.size === statusOptions.length) {
                                setPendingStatuses(new Set());
                              } else {
                                setPendingStatuses(new Set(statusOptions.map(s => s.key)));
                              }
                            }}
                            style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "none", borderRadius: "8px", padding: "4px 12px", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            {pendingStatuses.size === statusOptions.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {statusOptions.map((opt) => {
                            const statusColors: Record<string, { bg: string; dot: string }> = {
                              completed: { bg: "rgba(16, 185, 129, 0.08)", dot: "#059669" },
                              ongoing: { bg: "rgba(37, 99, 235, 0.08)", dot: "#2563eb" },
                              notstarted: { bg: "rgba(245, 158, 11, 0.08)", dot: "#d97706" },
                            };
                            const sc = statusColors[opt.key] || statusColors.notstarted;
                            return (
                              <label
                                key={opt.key}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  padding: "10px 12px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  background: pendingStatuses.has(opt.key) ? sc.bg : "transparent",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="custom-checkbox"
                                  style={{ width: "18px", height: "18px" }}
                                  checked={pendingStatuses.has(opt.key)}
                                  onChange={() => {
                                    const next = new Set(Array.from(pendingStatuses));
                                    if (next.has(opt.key)) next.delete(opt.key); else next.add(opt.key);
                                    setPendingStatuses(next);
                                  }}
                                />
                                <span
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "50%",
                                    background: sc.dot,
                                    display: "inline-block",
                                  }}
                                ></span>
                                <span style={{ fontWeight: 500, color: "#333" }}>{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Gender options */}
                    {activeFilterCategory === "gender" && pendingEnabled.has("gender") && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>Select Gender</span>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (pendingGenders.size === allGenders.length) {
                                setPendingGenders(new Set());
                              } else {
                                setPendingGenders(new Set(allGenders));
                              }
                            }}
                            style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "none", borderRadius: "8px", padding: "4px 12px", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            {pendingGenders.size === allGenders.length && allGenders.length > 0 ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {allGenders.map((g) => (
                            <label key={g} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: pendingGenders.has(g) ? "rgba(6, 182, 212, 0.08)" : "transparent" }}>
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                style={{ width: "18px", height: "18px" }}
                                checked={pendingGenders.has(g)}
                                onChange={() => {
                                  const next = new Set(Array.from(pendingGenders));
                                  if (next.has(g)) next.delete(g); else next.add(g);
                                  setPendingGenders(next);
                                }}
                              />
                              <span style={{ fontWeight: 500, color: "#333" }}>{g}</span>
                            </label>
                          ))}
                          {allGenders.length === 0 && (
                            <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>
                              No gender data available for the loaded students
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with Apply / Reset */}
                <div
                  style={{
                    borderTop: "1px solid #e0e0e0",
                    padding: "12px 20px",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                    borderRadius: "0 0 16px 16px",
                  }}
                >
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setPendingEnabled(new Set());
                      setPendingAssessmentIds(new Set());
                      setPendingSessions(new Set());
                      setPendingGrades(new Set());
                      setPendingSections(new Set());
                      setPendingStatuses(new Set());
                      setPendingGenders(new Set());
                    }}
                    style={{
                      background: "#f5f5f5",
                      color: "#666",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      padding: "6px 20px",
                      fontWeight: 600,
                    }}
                  >
                    Reset
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setAppliedEnabled(new Set(Array.from(pendingEnabled)));
                      setAppliedAssessmentIds(new Set(Array.from(pendingAssessmentIds)));
                      setAppliedSessions(new Set(Array.from(pendingSessions)));
                      setAppliedGrades(new Set(Array.from(pendingGrades)));
                      setAppliedSections(new Set(Array.from(pendingSections)));
                      setAppliedStatuses(new Set(Array.from(pendingStatuses)));
                      setAppliedGenders(new Set(Array.from(pendingGenders)));
                      setShowFilterPanel(false);
                    }}
                    style={{
                      background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 20px",
                      fontWeight: 600,
                      boxShadow: "0 4px 12px rgba(67, 97, 238, 0.3)",
                    }}
                  >
                    <i className="bi bi-check2 me-1"></i>
                    Apply Filters
                  </button>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div
              className="card border-0 shadow-sm mb-3"
              style={{ borderRadius: "12px" }}
            >
              <div className="card-body p-3">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <div
                    className="position-relative flex-grow-1"
                    style={{ maxWidth: "400px" }}
                  >
                    <i
                      className="bi bi-search position-absolute"
                      style={{
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#9e9e9e",
                      }}
                    ></i>
                    <input
                      className="form-control"
                      placeholder="Search by name, roll number, or user ID..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{
                        paddingLeft: "42px",
                        borderRadius: "10px",
                        border: "2px solid #e0e0e0",
                        padding: "0.7rem 1rem 0.7rem 42px",
                      }}
                    />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="badge bg-primary px-3 py-2"
                      style={{ borderRadius: "20px", fontSize: "0.9rem" }}
                    >
                      {filteredStudents.length} Students
                    </span>
                    {selectedStudents.size > 0 && (
                      <span
                        className="badge bg-success px-3 py-2"
                        style={{ borderRadius: "20px", fontSize: "0.9rem" }}
                      >
                        {selectedStudents.size} Selected
                      </span>
                    )}
                    {hasChanges && (
                      <span
                        className="badge bg-warning text-dark px-3 py-2"
                        style={{ borderRadius: "20px", fontSize: "0.9rem" }}
                      >
                        <i className="bi bi-exclamation-circle me-1"></i>
                        Unsaved Changes
                      </span>
                    )}
                    <button
                      className="btn btn-sm d-flex align-items-center gap-1"
                      onClick={handleDownloadStudentList}
                      disabled={filteredStudents.length === 0}
                      style={{
                        background: filteredStudents.length > 0
                          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                          : "#e0e0e0",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.45rem 0.8rem",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        color: filteredStudents.length > 0 ? "#fff" : "#9e9e9e",
                        cursor: filteredStudents.length > 0 ? "pointer" : "not-allowed",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <ActionIcon type="download" size="sm" />
                      Student List
                    </button>
                    {/* Bulk send-credentials. Operates on selected rows when any
                      are selected, else on every filtered row. Disabled while
                      the request is in flight to prevent duplicate queueing. */}
                    {(() => {
                      const bulkCount = selectedStudents.size > 0
                        ? filteredStudents.filter((s) => selectedStudents.has(s.userStudentId)).length
                        : filteredStudents.length;
                      const bulkLabel = selectedStudents.size > 0 ? "Selected" : "All";
                      const bulkDisabled = bulkCount === 0 || bulkSendingCredentials;
                      return (
                        <button
                          className="btn btn-sm d-flex align-items-center gap-1"
                          onClick={handleBulkSendCredentials}
                          disabled={bulkDisabled}
                          title="Email login credentials to every student in scope"
                          style={{
                            background: bulkDisabled
                              ? "#e0e0e0"
                              : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                            border: "none",
                            borderRadius: "8px",
                            padding: "0.45rem 0.8rem",
                            fontWeight: 600,
                            fontSize: "0.82rem",
                            color: bulkDisabled ? "#9e9e9e" : "#fff",
                            cursor: bulkDisabled ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease",
                          }}
                        >
                          {bulkSendingCredentials ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <i className="bi bi-envelope-paper"></i>
                              Send Credentials ({bulkLabel}: {bulkCount})
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div
              className="card border-0 shadow-sm"
              style={{ borderRadius: "12px", overflow: "hidden" }}
            >
              <div className="card-body p-0">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Loading students...</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-5">
                    <div
                      className="mx-auto mb-3"
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        background: "#f0f0f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className="bi bi-inbox"
                        style={{ fontSize: "2rem", color: "#bdbdbd" }}
                      ></i>
                    </div>
                    <h5 className="text-muted">No Students Found</h5>
                    <p className="text-muted mb-0">
                      Try adjusting your search or add new students
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0" style={{ width: "100%", tableLayout: "auto", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ background: "#f8f9fa" }}>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            User ID
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Username
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Student Name
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Allotted Assessment
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Phone Number
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            DOB
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Assessments
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              borderBottom: "2px solid #e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedStudents.map((student, index) => (
                          <tr
                            key={student.userStudentId}
                            style={{
                              background: index % 2 === 0 ? "#fff" : "#fafbfc",
                              transition: "background 0.2s",
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              <span
                                className="badge"
                                style={{
                                  background: "rgba(67, 97, 238, 0.1)",
                                  color: "#4361ee",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "0.8rem",
                                }}
                              >
                                #{student.userStudentId}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              <span
                                className="fw-semibold"
                                style={{ color: "#1a1a2e" }}
                              >
                                {student.username}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              <span
                                className="fw-semibold"
                                style={{ color: "#1a1a2e" }}
                              >
                                {student.name}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              <button
                                className="btn btn-sm d-flex align-items-center gap-1"
                                onClick={() => handleViewAssessments(student)}
                                style={{
                                  background: "rgba(67, 97, 238, 0.08)",
                                  color: "#4361ee",
                                  border: "1px solid rgba(67, 97, 238, 0.18)",
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  fontWeight: 500,
                                  fontSize: "0.78rem",
                                  transition: "all 0.2s",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <i className="bi bi-list-ul"></i>
                                View ({studentAssessmentCounts.get(student.userStudentId) || 0})
                              </button>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              {student.phoneNumber ? (
                                <div className="d-flex align-items-center gap-2">
                                  <i
                                    className="bi bi-telephone-fill"
                                    style={{ color: "#4361ee" }}
                                  ></i>
                                  <span
                                    style={{ fontWeight: 500, color: "#555" }}
                                  >
                                    {student.phoneNumber}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted">
                                  <i className="bi bi-dash-circle me-1"></i>
                                  Not Available
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              {student.loginDob ? (
                                <div className="d-flex align-items-center gap-2">
                                  <i
                                    className="bi bi-calendar-event-fill"
                                    style={{ color: "#4361ee" }}
                                  ></i>
                                  <span
                                    style={{ fontWeight: 500, color: "#555" }}
                                  >
                                    {student.loginDob}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted">
                                  <i className="bi bi-dash-circle me-1"></i>
                                  Not Available
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              <select
                                value={student.selectedAssessment}
                                onChange={(e) =>
                                  handleAssessmentChange(
                                    student.id,
                                    e.target.value
                                  )
                                }
                                style={{
                                  width: "100%",
                                  minWidth: "150px",
                                  padding: "6px 8px",
                                  borderRadius: "8px",
                                  border: "2px solid #e0e0e0",
                                  background: student.selectedAssessment
                                    ? "rgba(67, 97, 238, 0.05)"
                                    : "#fff",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                  fontSize: "0.8rem",
                                }}
                              >
                                <option value="">-- Select Assessment --</option>
                                {assessments.map((assessment) => {
                                  const isAlreadyAssigned =
                                    student.assignedAssessmentIds.includes(
                                      assessment.id
                                    );
                                  return (
                                    <option
                                      key={assessment.id}
                                      value={assessment.id}
                                      disabled={isAlreadyAssigned}
                                      style={{
                                        color: isAlreadyAssigned
                                          ? "#999"
                                          : "#333",
                                      }}
                                    >
                                      {assessment.assessmentName}
                                      {isAlreadyAssigned ? " (Assigned)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.85rem",
                              }}
                            >
                              <div className="d-flex align-items-center gap-1">
                                <button
                                  className="btn btn-sm d-flex align-items-center gap-1"
                                  onClick={() => handleEditStudent(student)}
                                  style={{
                                    background: "#f8fafc",
                                    color: "#64748b",
                                    border: "1px solid #e2e8f0",
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    fontWeight: 400,
                                    fontSize: "0.78rem",
                                    transition: "all 0.2s",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <ActionIcon type="edit" size="sm" />
                                  Edit
                                </button>
                                {/* Resend login credentials via the styled Odoo
                                  email service. Disabled + spinner while a send
                                  for this student is in flight. */}
                                <button
                                  className="btn btn-sm d-flex align-items-center gap-1"
                                  onClick={() => handleSendCredentials(student)}
                                  disabled={sendingCredentialsFor.has(student.userStudentId)}
                                  title="Email login credentials to this student"
                                  style={{
                                    background: sendingCredentialsFor.has(student.userStudentId)
                                      ? "#f1f5f9"
                                      : "#f8fafc",
                                    color: sendingCredentialsFor.has(student.userStudentId)
                                      ? "#94a3b8"
                                      : "#64748b",
                                    border: `1px solid ${sendingCredentialsFor.has(student.userStudentId)
                                      ? "#e2e8f0"
                                      : "#e2e8f0"
                                      }`,
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    fontWeight: 400,
                                    fontSize: "0.78rem",
                                    transition: "all 0.2s",
                                    cursor: sendingCredentialsFor.has(student.userStudentId)
                                      ? "not-allowed"
                                      : "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {sendingCredentialsFor.has(student.userStudentId) ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                      Sending…
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-envelope-paper"></i>
                                      Send Credentials
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 24px", borderTop: "1px solid #e5e7eb", flexWrap: "wrap", gap: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                            {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, filteredStudents.length)} of {filteredStudents.length}
                          </span>
                          <select
                            className="form-select form-select-sm form-select-solid"
                            style={{ width: 72, fontSize: "0.85rem" }}
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                          >
                            {[25, 50, 100, 200].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1}
                            onClick={() => setCurrentPage(1)} style={{ padding: "4px 10px", fontSize: "0.85rem" }}>First</button>
                          <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} style={{ padding: "4px 10px", fontSize: "0.85rem" }}>Prev</button>
                          {(() => {
                            const pages: (number | string)[] = [];
                            const maxV = 5;
                            let start = Math.max(1, safeCurrentPage - Math.floor(maxV / 2));
                            let end = Math.min(totalPages, start + maxV - 1);
                            if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
                            if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
                            for (let i = start; i <= end; i++) pages.push(i);
                            if (end < totalPages) { if (end < totalPages - 1) pages.push("..."); pages.push(totalPages); }
                            return pages.map((p, i) =>
                              typeof p === "string" ? (
                                <span key={`e-${i}`} style={{ padding: "4px 6px", color: "#9ca3af", fontSize: "0.85rem" }}>...</span>
                              ) : (
                                <button key={p} className={`btn btn-sm ${p === safeCurrentPage ? "btn-primary" : "btn-light"}`}
                                  onClick={() => setCurrentPage(p)} style={{ padding: "4px 12px", fontSize: "0.85rem", minWidth: 36 }}>{p}</button>
                              )
                            );
                          })()}
                          <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} style={{ padding: "4px 10px", fontSize: "0.85rem" }}>Next</button>
                          <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages}
                            onClick={() => setCurrentPage(totalPages)} style={{ padding: "4px 10px", fontSize: "0.85rem" }}>Last</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save Button Footer */}
              {!loading && filteredStudents.length > 0 && (
                <div
                  className="card-footer bg-white border-top p-4"
                  style={{ borderRadius: "0 0 16px 16px" }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted">
                      <i className="bi bi-info-circle me-2"></i>
                      Select assessments for students and click save to apply
                      changes
                    </span>
                    <button
                      className="btn btn-lg d-flex align-items-center gap-2"
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      style={{
                        background:
                          hasChanges && !saving
                            ? "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)"
                            : "#e0e0e0",
                        color: hasChanges && !saving ? "#fff" : "#9e9e9e",
                        border: "none",
                        borderRadius: "12px",
                        padding: "0.8rem 2rem",
                        fontWeight: 600,
                        boxShadow:
                          hasChanges && !saving
                            ? "0 8px 20px rgba(76, 175, 80, 0.3)"
                            : "none",
                        transition: "all 0.3s ease",
                        cursor: hasChanges && !saving ? "pointer" : "not-allowed",
                      }}
                    >
                      {saving ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <ActionIcon type="approve" size="sm" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* No Institute Selected Message */}
        {!selectedInstitute && (
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "16px" }}
          >
            <div className="card-body text-center py-5">
              <div
                className="mx-auto mb-4"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 30px rgba(67, 97, 238, 0.3)",
                }}
              >
                <i
                  className="bi bi-buildings-fill text-white"
                  style={{ fontSize: "2.5rem" }}
                ></i>
              </div>
              <h4 className="mb-3 fw-semibold" style={{ color: "#1a1a2e" }}>
                Select an Institute
              </h4>
              <p className="text-muted mb-0">
                Please select an institute from the dropdown above to view
                students
              </p>
            </div>
          </div>
        )}

        {/* Assessment List Modal with Download and Reset Buttons */}
        {showAssessmentModal && modalStudent && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowAssessmentModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                maxWidth: "860px",
                width: "94%",
                maxHeight: "85vh",
                overflow: "hidden",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  padding: "1rem 1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="bi bi-journal-bookmark text-white" style={{ fontSize: "1.2rem" }}></i>
                  </div>
                  <div>
                    <h5
                      className="mb-0 text-white fw-bold"
                      style={{ fontSize: "1.05rem" }}
                    >
                      Assigned Assessments
                    </h5>
                    <p
                      className="mb-0 text-white"
                      style={{ fontSize: "0.82rem", opacity: 0.85 }}
                    >
                      {modalStudent.name} &middot; ID #{modalStudent.userStudentId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAssessmentModal(false)}
                ></button>
              </div>

              {/* Modal Body */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  maxHeight: "65vh",
                  overflowY: "auto",
                }}
              >
                {studentAssessments.length === 0 ? (
                  <div className="text-center py-5">
                    <i
                      className="bi bi-inbox text-muted"
                      style={{ fontSize: "2.5rem", opacity: 0.5 }}
                    ></i>
                    <p className="mt-2 text-muted mb-0">
                      No assessments assigned
                    </p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {studentAssessments.map((assessment) => {
                      const isCompleted = assessment.status === "completed";

                      return (
                        <div
                          key={assessment.assessmentId}
                          style={{
                            backgroundColor: "#f8fafc",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            overflow: "hidden",
                          }}
                        >
                          {/* Assessment info row */}
                          <div
                            className="d-flex align-items-center justify-content-between"
                            style={{ padding: "12px 16px" }}
                          >
                            <div className="d-flex align-items-center gap-3" style={{ flex: 1 }}>
                              <div>
                                <h6
                                  className="mb-0 fw-semibold"
                                  style={{ color: "#1a1a2e", fontSize: "0.92rem" }}
                                >
                                  {assessment.assessmentName}
                                </h6>
                                <span
                                  className="text-muted"
                                  style={{ fontSize: "0.72rem" }}
                                >
                                  Assessment ID: {assessment.assessmentId}
                                </span>
                              </div>
                            </div>
                            {getStatusBadge(assessment.status)}
                          </div>

                          {/* Actions row */}
                          <div
                            style={{
                              padding: "10px 16px",
                              borderTop: "1px solid #e9ecef",
                              background: "#fff",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            {/* Data actions group — answers download intentionally
                            absent on this page; the Data Download page keeps it */}
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "2px" }}>Data</span>
                            <button
                              className="btn btn-sm d-flex align-items-center gap-1"
                              onClick={() =>
                                handleViewDemographics(
                                  modalStudent,
                                  assessment.assessmentId,
                                  assessment.assessmentName
                                )
                              }
                              style={{
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontWeight: 500,
                                fontSize: "0.78rem",
                                background: "rgba(8, 145, 178, 0.1)",
                                color: "#0891b2",
                                border: "1px solid rgba(8, 145, 178, 0.2)",
                              }}
                            >
                              <i className="bi bi-person-lines-fill"></i>
                              Demographics
                            </button>
                            <button
                              className="btn btn-sm d-flex align-items-center gap-1"
                              onClick={() =>
                                handleResetClick(
                                  modalStudent,
                                  assessment.assessmentId,
                                  assessment.assessmentName
                                )
                              }
                              disabled={assessment.status === "notstarted"}
                              title={
                                assessment.status === "notstarted"
                                  ? "Already not started"
                                  : "Reset this assessment"
                              }
                              style={{
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontWeight: 500,
                                fontSize: "0.78rem",
                                background: assessment.status === "notstarted" ? "#f1f5f9" : "rgba(245, 158, 11, 0.1)",
                                color: assessment.status === "notstarted" ? "#94a3b8" : "#d97706",
                                border: `1px solid ${assessment.status === "notstarted" ? "#e2e8f0" : "rgba(245, 158, 11, 0.2)"}`,
                              }}
                            >
                              <ActionIcon type="refresh" size="sm" />
                              Reset
                            </button>

                            {/* Report group — only for completed assessments. The
                            generator (BET vs pager) is auto-picked by
                            generateReportForAssessment based on the assessment's
                            questionnaire type; admin doesn't choose the report
                            family. Legacy 18-pager Navigator is intentionally
                            absent here — it lives in ReportsHub only. */}
                            {isCompleted && (() => {
                              const key = reportKey(modalStudent!.userStudentId, assessment.assessmentId);
                              const url = generatedReportUrls.get(key);
                              const isGenerating = reportGeneratingFor === key;
                              return (
                                <>
                                  <div style={{ width: "100%", height: 0 }}></div>
                                  <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "2px" }}>Report</span>

                                  {url ? (
                                    <button
                                      className="btn btn-sm d-flex align-items-center gap-1"
                                      onClick={() => window.open(url, "_blank")}
                                      style={{
                                        borderRadius: "6px",
                                        padding: "5px 10px",
                                        fontWeight: 600,
                                        fontSize: "0.78rem",
                                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                        color: "#fff",
                                        border: "none",
                                      }}
                                    >
                                      <ActionIcon type="download" size="sm" />
                                      Download Report
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-sm d-flex align-items-center gap-1"
                                      disabled={isGenerating}
                                      onClick={() =>
                                        handleGenerateReport(
                                          assessment.assessmentId,
                                          modalStudent!.userStudentId,
                                          false,
                                        )
                                      }
                                      style={{
                                        borderRadius: "6px",
                                        padding: "5px 10px",
                                        fontWeight: 500,
                                        fontSize: "0.78rem",
                                        background: isGenerating ? "#f1f5f9" : "rgba(16, 185, 129, 0.1)",
                                        color: isGenerating ? "#94a3b8" : "#059669",
                                        border: `1px solid ${isGenerating ? "#e2e8f0" : "rgba(16, 185, 129, 0.2)"}`,
                                      }}
                                    >
                                      {isGenerating ? (
                                        <>
                                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                          Generating…
                                        </>
                                      ) : (
                                        <>
                                          <i className="bi bi-file-earmark-bar-graph"></i>
                                          Generate Report
                                        </>
                                      )}
                                    </button>
                                  )}

                                  <button
                                    className="btn btn-sm d-flex align-items-center gap-1"
                                    disabled={isGenerating}
                                    title="Force regenerate (overwrites the existing report at the same DO Spaces key)"
                                    onClick={() =>
                                      handleGenerateReport(
                                        assessment.assessmentId,
                                        modalStudent!.userStudentId,
                                        true,
                                      )
                                    }
                                    style={{
                                      borderRadius: "6px",
                                      padding: "5px 10px",
                                      fontWeight: 500,
                                      fontSize: "0.78rem",
                                      background: isGenerating ? "#f1f5f9" : "rgba(245, 158, 11, 0.1)",
                                      color: isGenerating ? "#94a3b8" : "#d97706",
                                      border: `1px solid ${isGenerating ? "#e2e8f0" : "rgba(245, 158, 11, 0.2)"}`,
                                    }}
                                  >
                                    <ActionIcon type="refresh" size="sm" />
                                    Regenerate
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "0.75rem 1.5rem",
                  borderTop: "1px solid #e2e8f0",
                  background: "#fafbfc",
                }}
              >
                <button
                  className="btn btn-secondary w-100"
                  onClick={() => setShowAssessmentModal(false)}
                  style={{ borderRadius: "8px", fontWeight: 500 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Demographics Modal */}
        {showDemographicsModal && demographicsStudent && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10060,
            }}
            onClick={() => setShowDemographicsModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "20px",
                maxWidth: "550px",
                width: "90%",
                maxHeight: "80vh",
                overflow: "hidden",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  background: "linear-gradient(135deg, #0891b2 0%, #065f73 100%)",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "1.1rem" }}>
                    <i className="bi bi-person-lines-fill me-2"></i>
                    Demographic Data
                  </h5>
                  <p className="mb-0 text-white mt-1" style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                    {demographicsStudent.name} - {demographicsAssessmentName}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDemographicsModal(false)}
                  style={{ marginTop: "2px" }}
                ></button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "1rem", maxHeight: "60vh", overflowY: "auto" }}>
                {demographicsLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span className="ms-2 text-muted">Loading demographics...</span>
                  </div>
                ) : demographicsData.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="bi bi-inbox text-muted" style={{ fontSize: "2.5rem", opacity: 0.5 }}></i>
                    <p className="mt-2 text-muted mb-0">No demographic fields configured for this assessment</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {demographicsData.map((field: any) => {
                      const opts = Array.isArray(field.options) ? field.options : [];
                      const matched = field.currentValue != null && field.currentValue !== ""
                        ? opts.find((o: any) => String(o.optionValue) === String(field.currentValue))
                        : null;
                      const displayValue = matched
                        ? (matched.optionLabel ?? matched.optionValue ?? field.currentValue)
                        : field.currentValue;
                      return (
                        <div
                          key={field.fieldId}
                          className="p-3"
                          style={{
                            backgroundColor: "#f8fafc",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <div style={{ flex: 1 }}>
                              <div
                                className="text-muted"
                                style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                              >
                                {field.customLabel || field.displayLabel}
                              </div>
                              <div
                                className="mt-1 fw-semibold"
                                style={{ fontSize: "0.95rem", color: displayValue ? "#1a1a2e" : "#a0aec0" }}
                              >
                                {displayValue || "Not provided"}
                              </div>
                            </div>
                            {field.isMandatory && (
                              <span
                                style={{
                                  backgroundColor: "#fef3c7",
                                  color: "#d97706",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                }}
                              >
                                Required
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #e2e8f0" }}>
                <button
                  className="btn btn-secondary w-100"
                  onClick={() => setShowDemographicsModal(false)}
                  style={{ borderRadius: "10px" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}