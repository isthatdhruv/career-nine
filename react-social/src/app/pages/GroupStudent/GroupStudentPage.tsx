import React, { useState, useEffect, useMemo, useReducer, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
import {
  getStudentsWithMappingByInstituteId,
  getAllAssessments,
  bulkAlotAssessment,
  Assessment,
  getStudentAnswersWithDetails,
  getBulkStudentAnswersWithDetails,
  StudentAnswerDetail,
  resetAssessment,
  getAllGameResults,
  getDemographicFieldsForStudent,
  getBulkDemographicData,
  exportProctoringExcel,
  generateBetReportOneClick,
  generateNavigatorReportOneClick,
  updateStudentBasicInfo,
} from "../StudentInformation/StudentInfo_APIs";
import { getEmailRecipientsForStudent, sendReportEmail, EmailRecipient } from "../ReportGeneration/API/BetReportData_APIs";
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
  assessments?: StudentAssessmentInfo[];
  assignedAssessmentIds: number[];
};

type StudentAssessmentInfo = {
  assessmentId: number;
  assessmentName: string;
  status: string;
};

export default function GroupStudentPage() {
  const navigate = useNavigate();
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(
    new Set(),
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Modal manager (consolidates 5 modals into one state object) ──
  type ModalState = {
    type: "none" | "assessment" | "download" | "bulkDownload" | "reset" | "demographics" | "edit";
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

  // Download modal data
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadAnswers, setDownloadAnswers] = useState<StudentAnswerDetail[]>([]);
  const [downloadError, setDownloadError] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [showStudentUsernameDownload, setShowStudentUsernameDownload] = useState(false);

  // Bulk download data
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false);
  const [bulkDownloadAnswers, setBulkDownloadAnswers] = useState<any[]>([]);
  const [bulkDownloadError, setBulkDownloadError] = useState<string>("");
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkGameResults, setBulkGameResults] = useState<Map<string, any>>(new Map());
  const [bulkDemographicData, setBulkDemographicData] = useState<any[]>([]);

  // Demographics data
  const [demographicsData, setDemographicsData] = useState<any[]>([]);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  // Reset state
  const [resetting, setResetting] = useState(false);

  // Proctoring
  const [proctoringDownloading, setProctoringDownloading] = useState(false);

  // Report generation (one-click)
  const [reportGeneratingFor, setReportGeneratingFor] = useState<number | null>(null); // assessmentId being generated
  const [generatedReportUrls, setGeneratedReportUrls] = useState<Map<string, string>>(new Map()); // key: "userStudentId-assessmentId" -> reportUrl

  // ── Send Email modal state ──
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalStudent, setEmailModalStudent] = useState<Student | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);
  const [emailRecipientsLoading, setEmailRecipientsLoading] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [extraEmailInput, setExtraEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailAssessmentName, setEmailAssessmentName] = useState("");
  const [emailReportUrl, setEmailReportUrl] = useState<string | null>(null);

  // ── Convenience aliases for backward compatibility ──
  const showAssessmentModal = modal.type === "assessment";
  const modalStudent = modal.student;
  const showDownloadModal = modal.type === "download";
  const downloadStudent = modal.student;
  const downloadAssessmentId = modal.assessmentId;
  const showBulkDownloadModal = modal.type === "bulkDownload";
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
  const setShowDownloadModal = (v: boolean) => v ? undefined : closeModal();
  const setShowBulkDownloadModal = (v: boolean) => v ? setModal({ type: "bulkDownload", student: null, assessmentId: null, assessmentName: "", showConfirm: false }) : closeModal();
  const setShowResetModal = (v: boolean) => v ? undefined : closeModal();
  const setShowResetConfirm = (v: boolean) => setModal((m) => ({ ...m, showConfirm: v }));
  const setShowDemographicsModal = (v: boolean) => v ? undefined : closeModal();

  // ── Filter state (consolidated into one object) ──
  type FilterSet = { assessmentIds: Set<number>; sessions: Set<string>; grades: Set<string>; sections: Set<string>; statuses: Set<string>; enabled: Set<string>; };
  const emptyFilters = (): FilterSet => ({ assessmentIds: new Set(), sessions: new Set(), grades: new Set(), sections: new Set(), statuses: new Set(), enabled: new Set() });
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
  const pendingEnabled = pending.enabled;
  const appliedAssessmentIds = applied.assessmentIds;
  const appliedSessions = applied.sessions;
  const appliedGrades = applied.grades;
  const appliedSections = applied.sections;
  const appliedStatuses = applied.statuses;
  const appliedEnabled = applied.enabled;

  // Setter helpers for filters
  const setPendingAssessmentIds = (v: Set<number> | ((p: Set<number>) => Set<number>)) => setPending((p) => ({ ...p, assessmentIds: typeof v === "function" ? v(p.assessmentIds) : v }));
  const setPendingSessions = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, sessions: typeof v === "function" ? v(p.sessions) : v }));
  const setPendingGrades = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, grades: typeof v === "function" ? v(p.grades) : v }));
  const setPendingSections = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, sections: typeof v === "function" ? v(p.sections) : v }));
  const setPendingStatuses = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, statuses: typeof v === "function" ? v(p.statuses) : v }));
  const setPendingEnabled = (v: Set<string> | ((p: Set<string>) => Set<string>)) => setPending((p) => ({ ...p, enabled: typeof v === "function" ? v(p.enabled) : v }));
  const setAppliedAssessmentIds = (v: Set<number>) => setApplied((a) => ({ ...a, assessmentIds: v }));
  const setAppliedSessions = (v: Set<string>) => setApplied((a) => ({ ...a, sessions: v }));
  const setAppliedGrades = (v: Set<string>) => setApplied((a) => ({ ...a, grades: v }));
  const setAppliedSections = (v: Set<string>) => setApplied((a) => ({ ...a, sections: v }));
  const setAppliedStatuses = (v: Set<string>) => setApplied((a) => ({ ...a, statuses: v }));
  const setAppliedEnabled = (v: Set<string>) => setApplied((a) => ({ ...a, enabled: v }));

  const normalizeAnswers = (data: any): StudentAnswerDetail[] => {
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : data && typeof data === "object"
          ? Object.values(data)
          : [];

    return rawList
      .map((item: any) => {
        const questionText =
          item.questionText?.questionText ??
          item.questionText?.text ??
          item.question?.questionText ??
          item.question?.text ??
          item.questionText ??
          item.questiontext ??
          item.question_text;

        const optionText =
          item.optionText?.optionText ??
          item.optionText?.text ??
          item.option?.optionText ??
          item.option?.text ??
          item.optionText ??
          item.optiontext ??
          item.option_text;

        const sectionName =
          item.sectionName?.sectionName ??
          item.sectionName?.text ??
          item.section?.sectionName ??
          item.section?.name ??
          item.sectionName ??
          item.sectionname ??
          item.section_name;

        const excelQuestionHeader =
          item.excelQuestionHeader?.excelQuestionHeader ??
          item.excelQuestionHeader?.text ??
          item.excelQuestionHeader ??
          item.excelquestionheader ??
          item.excel_question_header;

        const optionNumber = item.optionNumber ?? item.option_number ?? 0;
        const isImageOption = item.isImageOption ?? item.is_image_option ?? false;

        return {
          questionId: item.questionId ?? item.questionid ?? item.question_id,
          questionText,
          optionId: item.optionId ?? item.optionid ?? item.option_id,
          optionText,
          sectionName,
          excelQuestionHeader,
          optionNumber,
          isImageOption,
        };
      })
      .filter((item) => item.questionText || item.optionText || item.sectionName || item.excelQuestionHeader);
  };

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
    return parts.join(', ');
  }, [hasAssessmentFilter, appliedAssessmentIds, appliedEnabled, appliedSessions, appliedGrades, appliedSections, hasStatusFilter, appliedStatuses, assessments]);

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
    try {
      await bulkAlotAssessment(assignments);
      showSuccessToast(`${assignments.length} assessment(s) saved successfully!`);
      setHasChanges(false);

      // Refresh data
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
            assessments: student.assessments || [],
            assignedAssessmentIds: assignedIds,
          };
        });
        setStudents(studentData);
      }
    } catch (error) {
      console.error("Error saving assessments:", error);
      showErrorToast("Failed to save assessments. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadClick = async (student: Student, assessmentId: number) => {
    setModal({ type: "download", student, assessmentId, assessmentName: "", showConfirm: false });
    setDownloadLoading(true);
    setDownloadError("");

    try {
      const response = await getStudentAnswersWithDetails(
        student.userStudentId,
        assessmentId
      );

      const normalized = normalizeAnswers(response.data);
      setDownloadAnswers(normalized);
    } catch (err: any) {
      console.error("Error fetching answers:", err);
      console.error("Error details:", err.response?.data);
      setDownloadError("Failed to load student answers. Please try again.");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!downloadStudent) return;

    setDownloading(true);
    try {
      // Prepare data for Excel
      const excelData = downloadAnswers.map((answer: any, index: number) => ({
        "S.No": index + 1,
        "Section Name": answer.sectionName || "",
        "Excel Header": answer.excelQuestionHeader || "",
        "Question Text": answer.questionText,
        "Opted Option Text": answer.optionText || (answer.isImageOption && answer.optionNumber ? `Option ${answer.optionNumber} (Image)` : answer.optionText || ""),
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 25 }, // Section Name
        { wch: 30 }, // Excel Header
        { wch: 60 }, // Question Text
        { wch: 35 }, // Opted Option Text
      ];

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Student Answers");

      // Generate filename
      const filename = `${downloadStudent.name.replace(/\s+/g, "_")}_Answers_${Date.now()}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      showSuccessToast(`Download successful for ${downloadStudent.name}!`);
      closeModal();
      setDownloadAnswers([]);
    } catch (error) {
      console.error("Error downloading:", error);
      showErrorToast("Failed to download. Please try again.");
    } finally {
      setDownloading(false);
    }
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

    // Fetch assessments (only active ones)
    getAllAssessments()
      .then((response) => {
        const activeOnly = (response.data || []).filter((a: any) => a.isActive !== false);
        setAssessments(activeOnly);
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

      return matchesQuery && matchesSection && matchesAssessment && matchesStatus;
    });
  }, [students, query, filteredSectionIds, hasAssessmentFilter, appliedAssessmentIds, hasStatusFilter, appliedStatuses, activeAssessmentIds]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, safeCurrentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filteredSectionIds, appliedAssessmentIds, appliedStatuses]);

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
          "User Student ID": student.userStudentId,
          "Control Number": student.controlNumber ?? "N/A",
          "Username": student.username && !isNaN(Number(student.username)) ? Number(student.username) : (student.username || "N/A"),
          "Student Name": student.name,
          "Class": secInfo?.className || "N/A",
          "Section": secInfo?.sectionName || "N/A",
          // "Roll Number": student.schoolRollNumber || "N/A",
          // "Phone Number": student.phoneNumber || "N/A",
          "Date of Birth": student.studentDob ? formatDate(student.studentDob) : "N/A",
          "Institute": getSelectedInstituteName(),
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 },   // S.No
        { wch: 18 },  // User Student ID
        { wch: 18 },  // Control Number
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

  const handleBulkDownloadClick = async () => {
    setShowBulkDownloadModal(true);
    setBulkDownloadLoading(true);
    setBulkDownloadError("");
    setBulkDownloadAnswers([]);
    setBulkGameResults(new Map());
    setBulkDemographicData([]);

    try {
      // Build pairs: for each filtered student, include selected assessments (or all if no filter)
      const hasAssessmentFilterApplied = appliedEnabled.has("assessment") && appliedAssessmentIds.size > 0;
      const pairs: { userStudentId: number; assessmentId: number }[] = [];
      for (const student of filteredStudents) {
        const studentAssessments = (student.assessments || []).filter(
          (a) => hasAssessmentFilterApplied
            ? appliedAssessmentIds.has(Number(a.assessmentId))
            : activeAssessmentIds.has(Number(a.assessmentId))
        );
        // Deduplicate by assessmentId
        const seen = new Set<number>();
        for (const a of studentAssessments) {
          const id = Number(a.assessmentId);
          if (!seen.has(id)) {
            seen.add(id);
            pairs.push({ userStudentId: student.userStudentId, assessmentId: id });
          }
        }
      }

      if (pairs.length === 0) {
        setBulkDownloadAnswers([]);
        setBulkDownloadLoading(false);
        return;
      }

      // Fetch answers, game results, and demographic data in parallel
      const [answersResponse, gameResponse, demoResponse] = await Promise.all([
        getBulkStudentAnswersWithDetails(pairs),
        getAllGameResults().catch(() => ({ data: [] })),
        getBulkDemographicData(pairs).catch(() => ({ data: [] })),
      ]);

      setBulkDownloadAnswers(Array.isArray(answersResponse.data) ? answersResponse.data : []);

      // Index game results by userStudentId for quick lookup
      const gameMap = new Map<string, any>();
      const gameList = Array.isArray(gameResponse.data) ? gameResponse.data : [];
      for (const doc of gameList) {
        const id = String(doc.userStudentId || doc.id || "");
        if (id) gameMap.set(id, doc);
      }
      setBulkGameResults(gameMap);
      setBulkDemographicData(Array.isArray(demoResponse.data) ? demoResponse.data : []);
    } catch (err: any) {
      console.error("Error fetching bulk answers:", err);
      setBulkDownloadError("Failed to load student answers. Please try again.");
    } finally {
      setBulkDownloadLoading(false);
    }
  };

  // Game data column definitions
  const gameColumns = [
    "Jungle Spot - Hits",
    "Jungle Spot - Misses",
    "Jungle Spot - False Positives",
    "Jungle Spot - Targets Shown",
    "Rabbit Path - Score",
    "Rabbit Path - Total Rounds",
    "Rabbit Path - Rounds Played",
    "Hydro Tube - Patterns Completed",
    "Hydro Tube - Total Patterns",
    "Hydro Tube - Aimless Rotations",
    "Hydro Tube - Curious Clicks",
    "Hydro Tube - Tiles Correct",
    "Hydro Tube - Total Tiles",
    "Hydro Tube - Time (sec)",
  ];

  // Extract game data for a student into a flat record
  const extractGameData = (gameDoc: any): Record<string, any> => {
    const data: Record<string, any> = {};
    if (!gameDoc) return data;

    const ar = gameDoc.animal_reaction;
    if (ar) {
      data["Jungle Spot - Hits"] = ar.hits ?? "";
      data["Jungle Spot - Misses"] = ar.misses ?? "";
      data["Jungle Spot - False Positives"] = ar.falsePositives ?? "";
      data["Jungle Spot - Targets Shown"] = ar.targetsShown ?? "";
    }

    const rp = gameDoc.rabbit_path;
    if (rp) {
      data["Rabbit Path - Score"] = rp.score ?? "";
      data["Rabbit Path - Total Rounds"] = rp.totalRounds ?? "";
      data["Rabbit Path - Rounds Played"] = rp.roundsPlayed ?? "";
    }

    const ht = gameDoc.hydro_tube;
    if (ht) {
      data["Hydro Tube - Patterns Completed"] = ht.patternsCompleted ?? "";
      data["Hydro Tube - Total Patterns"] = ht.totalPatterns ?? "";
      data["Hydro Tube - Aimless Rotations"] = ht.aimlessRotations ?? "";
      data["Hydro Tube - Curious Clicks"] = ht.curiousClicks ?? "";
      data["Hydro Tube - Tiles Correct"] = ht.tilesCorrect ?? "";
      data["Hydro Tube - Total Tiles"] = ht.totalTiles ?? "";
      data["Hydro Tube - Time (sec)"] = ht.timeSpentSeconds ?? "";
    }

    return data;
  };

  // Pivot bulk answers: one row per student+assessment, each question as a column
  const pivotedBulkData = useMemo(() => {
    if (bulkDownloadAnswers.length === 0 && bulkGameResults.size === 0 && bulkDemographicData.length === 0) return { rows: [] as any[], questionColumns: [] as string[], hasGameData: false, demographicColumns: [] as string[], unmappedCount: 0 };

    // Collect all unique question column headers in order of first appearance
    const questionColumnsSet = new Set<string>();
    for (const row of bulkDownloadAnswers) {
      const colKey = row.excelQuestionHeader || row.questionText || "";
      if (colKey) questionColumnsSet.add(colKey);
    }
    const questionColumns = Array.from(questionColumnsSet);

    // Build demographic lookup: key = "userStudentId_assessmentId" -> { label: value }
    const demoColumnsSet = new Set<string>();
    const demoLookup = new Map<string, Record<string, string>>();
    for (const d of bulkDemographicData) {
      const key = `${d.userStudentId}_${d.assessmentId}`;
      const label = d.displayLabel || d.fieldName || "";
      if (label) {
        demoColumnsSet.add(label);
        if (!demoLookup.has(key)) demoLookup.set(key, {});
        demoLookup.get(key)![label] = d.value || "";
      }
    }
    const demographicColumns = Array.from(demoColumnsSet);

    // Build a lookup for assessment names by ID from filtered students
    const assessmentNameById = new Map<number, string>();
    for (const student of filteredStudents) {
      for (const a of (student.assessments || [])) {
        assessmentNameById.set(Number(a.assessmentId), a.assessmentName);
      }
    }

    // Group by student + assessment
    type RowData = { studentName: string; userStudentId: string; assessmentName: string; assessmentId: string; answers: Record<string, string>; gameData: Record<string, any>; demographics: Record<string, string> };
    const groupMap = new Map<string, RowData>();

    // First pass: populate from answers
    for (const row of bulkDownloadAnswers) {
      const key = `${row.userStudentId}_${row.assessmentName}`;
      if (!groupMap.has(key)) {
        const gameDoc = bulkGameResults.get(String(row.userStudentId));
        const demoKey = `${row.userStudentId}_${row.assessmentId}`;
        groupMap.set(key, {
          studentName: row.studentName || "",
          userStudentId: row.userStudentId || "",
          assessmentName: row.assessmentName || "",
          assessmentId: row.assessmentId || "",
          answers: {},
          gameData: extractGameData(gameDoc),
          demographics: demoLookup.get(demoKey) || {},
        });
      }
      const colKey = row.excelQuestionHeader || row.questionText || "";
      if (colKey) {
        const displayValue = row.optionText || (row.isImageOption && row.optionNumber ? `Option ${row.optionNumber} (Image)` : "");
        const existing = groupMap.get(key)!.answers[colKey];
        // For text answers, append multiple responses with semicolons
        groupMap.get(key)!.answers[colKey] = existing ? `${existing}; ${displayValue}` : displayValue;
      }
    }

    // Second pass: ensure students with demographics but no answers are included
    // Group demographic data by unique student+assessment combos
    const demoStudentAssessments = new Map<string, { userStudentId: string; assessmentId: string }>();
    for (const d of bulkDemographicData) {
      const key = `${d.userStudentId}_${d.assessmentId}`;
      if (!demoStudentAssessments.has(key)) {
        demoStudentAssessments.set(key, { userStudentId: String(d.userStudentId), assessmentId: String(d.assessmentId) });
      }
    }
    Array.from(demoStudentAssessments.entries()).forEach(([demoKey, info]) => {
      const aName = assessmentNameById.get(Number(info.assessmentId)) || "";
      const rowKey = `${info.userStudentId}_${aName}`;
      if (!groupMap.has(rowKey)) {
        // Find student name from filteredStudents
        const student = filteredStudents.find(s => String(s.userStudentId) === info.userStudentId);
        const gameDoc = bulkGameResults.get(info.userStudentId);
        groupMap.set(rowKey, {
          studentName: student?.name || "",
          userStudentId: info.userStudentId,
          assessmentName: aName,
          assessmentId: info.assessmentId,
          answers: {},
          gameData: extractGameData(gameDoc),
          demographics: demoLookup.get(demoKey) || {},
        });
      }
    });

    const rows = Array.from(groupMap.values());
    const hasGameData = bulkGameResults.size > 0;

    // Count unmapped text responses (have textResponse but no optionText/optionId)
    const unmappedCount = bulkDownloadAnswers.filter(
      (row: any) => row.textResponse && !row.optionText && !row.optionId
    ).length;

    return { rows, questionColumns, hasGameData, demographicColumns, unmappedCount };
  }, [bulkDownloadAnswers, bulkGameResults, bulkDemographicData, filteredStudents]);

  const handleBulkDownloadExcel = () => {
    if (pivotedBulkData.rows.length === 0) return;

    setBulkDownloading(true);
    try {
      const { rows, questionColumns, hasGameData, demographicColumns } = pivotedBulkData;

      const excelData = rows.map((row, index) => {
        const base: Record<string, any> = {
          "S.No": index + 1,
          "Student Name": row.studentName,
          "User ID": row.userStudentId,
          "Assessment": row.assessmentName,
        };
        // Add demographic columns after base info
        for (const col of demographicColumns) {
          base[col] = row.demographics[col] || "";
        }
        for (const col of questionColumns) {
          base[col] = row.answers[col] || "";
        }
        // Add game data columns
        if (hasGameData) {
          for (const col of gameColumns) {
            base[col] = row.gameData[col] ?? "";
          }
        }
        return base;
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 25 }, // Student Name
        { wch: 10 }, // User ID
        { wch: 25 }, // Assessment
        ...demographicColumns.map(() => ({ wch: 20 })),
        ...questionColumns.map(() => ({ wch: 20 })),
        ...(hasGameData ? gameColumns.map(() => ({ wch: 18 })) : []),
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "All Student Answers");

      const instituteName = getSelectedInstituteName().replace(/\s+/g, "_");
      const filename = `${instituteName}_All_Answers_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, filename);

      showSuccessToast("Download successful!");
      setShowBulkDownloadModal(false);
      setBulkDownloadAnswers([]);
    } catch (error) {
      console.error("Error downloading:", error);
      showErrorToast("Failed to download. Please try again.");
    } finally {
      setBulkDownloading(false);
    }
  };

  // ── Download All Proctoring Data (single backend call, no preview) ──

  const handleProctoringDownloadClick = async () => {
    setProctoringDownloading(true);
    try {
      // Build pairs from filtered students — include ALL assessments (active or not)
      const hasAssessmentFilterApplied = appliedEnabled.has("assessment") && appliedAssessmentIds.size > 0;
      const pairs: { userStudentId: number; assessmentId: number }[] = [];
      for (const student of filteredStudents) {
        if (!student.userStudentId) continue;
        const studentAssessments = (student.assessments || []).filter(
          (a: any) => {
            const aid = Number(a.assessmentId);
            if (isNaN(aid) || aid <= 0) return false;
            return hasAssessmentFilterApplied
              ? appliedAssessmentIds.has(aid)
              : true; // include all assessments when no filter is applied
          }
        );
        const seen = new Set<number>();
        for (const a of studentAssessments) {
          const id = Number(a.assessmentId);
          if (!seen.has(id)) {
            seen.add(id);
            pairs.push({ userStudentId: student.userStudentId, assessmentId: id });
          }
        }
      }

      if (pairs.length === 0) {
        showErrorToast("No student-assessment pairs to export. Make sure students have assessments assigned.");
        return;
      }

      // Single backend call — generates Excel server-side
      const response = await exportProctoringExcel(pairs);

      // Verify we got actual data back
      if (!response.data || (response.data instanceof Blob && response.data.size === 0)) {
        showErrorToast("No proctoring data found for the selected students.");
        return;
      }

      // Download the blob as .xlsx file
      const instituteName = getSelectedInstituteName().replace(/\s+/g, "_");
      const ts = Date.now();
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${instituteName}_Proctoring_Data_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showSuccessToast("Proctoring data downloaded successfully!");

    } catch (error: any) {
      console.error("Error downloading proctoring Excel:", error);
      let msg = error?.message || String(error);
      if (error?.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.error) msg = parsed.error;
        } catch (_) {}
      } else if (error?.response?.data?.message) {
        msg = error.response.data.message;
      }
      showErrorToast(`Failed to download proctoring data: ${msg}`);
    } finally {
      setProctoringDownloading(false);
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
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        padding: "1rem 1.25rem",
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
          <option value="">🏫 Select Institute</option>
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
              <i className="bi bi-funnel-fill"></i>
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
                    + (hasStatusFilter ? 1 : 0)}
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
                    setPendingEnabled(new Set());
                    setPendingAssessmentIds(new Set());
                    setPendingSessions(new Set());
                    setPendingGrades(new Set());
                    setPendingSections(new Set());
                    setPendingStatuses(new Set());
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
                  <i className="bi bi-x-circle"></i>
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
                  <i className="bi bi-x fs-5"></i>
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
                            : pendingStatuses.size}
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
                    <i className="bi bi-download"></i>
                    Student List
                  </button>
                  <button
                    className="btn btn-sm d-flex align-items-center gap-1"
                    onClick={handleBulkDownloadClick}
                    disabled={filteredStudents.length === 0}
                    style={{
                      background: filteredStudents.length > 0
                        ? "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)"
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
                    <i className="bi bi-file-earmark-spreadsheet"></i>
                    Download All Answers
                  </button>
                  <button
                    className="btn btn-sm d-flex align-items-center gap-1"
                    onClick={handleProctoringDownloadClick}
                    disabled={filteredStudents.length === 0 || proctoringDownloading}
                    style={{
                      background: filteredStudents.length > 0 && !proctoringDownloading
                        ? "linear-gradient(135deg, #e63946 0%, #a4133c 100%)"
                        : "#e0e0e0",
                      border: "none",
                      borderRadius: "8px",
                      padding: "0.45rem 0.8rem",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      color: filteredStudents.length > 0 && !proctoringDownloading ? "#fff" : "#9e9e9e",
                      cursor: filteredStudents.length > 0 && !proctoringDownloading ? "pointer" : "not-allowed",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {proctoringDownloading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-shield-exclamation"></i>
                        Download Proctored Data
                      </>
                    )}
                  </button>
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
                                background: "rgba(67, 97, 238, 0.1)",
                                color: "#4361ee",
                                border: "1px solid rgba(67, 97, 238, 0.3)",
                                padding: "4px 8px",
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
                                  background: "rgba(67, 97, 238, 0.1)",
                                  color: "#4361ee",
                                  border: "1px solid rgba(67, 97, 238, 0.3)",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "0.78rem",
                                  transition: "all 0.2s",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <i className="bi bi-pencil-square"></i>
                                Edit
                              </button>
                              <button
                                className="btn btn-sm d-flex align-items-center gap-1"
                                onClick={() => navigate(`/student-dashboard/${student.userStudentId}`)}
                                style={{
                                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                  color: "#fff",
                                  border: "none",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "0.78rem",
                                  transition: "all 0.2s",
                                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <i className="bi bi-speedometer2"></i>
                                Dashboard
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
                        <i className="bi bi-check2-circle"></i>
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
                    const reportKey = `${modalStudent.userStudentId}-${assessment.assessmentId}`;
                    const hasReport = generatedReportUrls.has(reportKey);
                    const isGenerating = reportGeneratingFor === assessment.assessmentId;

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
                        {/* Data actions group */}
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "2px" }}>Data</span>
                        <button
                          className="btn btn-sm d-flex align-items-center gap-1"
                          onClick={() =>
                            handleDownloadClick(
                              modalStudent,
                              assessment.assessmentId
                            )
                          }
                          style={{
                            borderRadius: "6px",
                            padding: "5px 10px",
                            fontWeight: 500,
                            fontSize: "0.78rem",
                            background: "rgba(67, 97, 238, 0.1)",
                            color: "#4361ee",
                            border: "1px solid rgba(67, 97, 238, 0.2)",
                          }}
                        >
                          <i className="bi bi-download"></i>
                          Answers
                        </button>
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
                          <i className="bi bi-arrow-counterclockwise"></i>
                          Reset
                        </button>

                        {/* Report actions group — only for completed */}
                        {isCompleted && (
                          <>
                            <div style={{ width: "100%", height: 0 }}></div>
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "2px" }}>Report</span>

                            {hasReport ? (
                              <button
                                className="btn btn-sm d-flex align-items-center gap-1"
                                onClick={() => {
                                  const url = generatedReportUrls.get(reportKey);
                                  if (url) window.open(url, "_blank");
                                }}
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
                                <i className="bi bi-eye"></i>
                                View Report
                              </button>
                            ) : (
                              <button
                                className="btn btn-sm d-flex align-items-center gap-1"
                                disabled={isGenerating}
                                onClick={async () => {
                                  if (!modalStudent) return;
                                  setReportGeneratingFor(assessment.assessmentId);
                                  try {
                                    const fullAssessment = assessments.find((a: any) => a.id === assessment.assessmentId) as any;
                                    const isBet = fullAssessment?.questionnaire?.type === true
                                      || (fullAssessment?.questionnaire?.type == null && (assessment.assessmentName || '').toUpperCase().includes('BET'));

                                    const res = isBet
                                      ? await generateBetReportOneClick(assessment.assessmentId, modalStudent.userStudentId)
                                      : await generateNavigatorReportOneClick(assessment.assessmentId, modalStudent.userStudentId);

                                    const reportUrl = res.data.reportUrl;
                                    if (reportUrl) {
                                      setGeneratedReportUrls(prev => new Map(prev).set(reportKey, reportUrl));
                                    }
                                  } catch (err: any) {
                                    showErrorToast("Report generation failed: " + (err?.response?.data?.error || err.message));
                                  } finally {
                                    setReportGeneratingFor(null);
                                  }
                                }}
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
                                <i className={isGenerating ? "bi bi-hourglass-split" : "bi bi-file-earmark-arrow-down"}></i>
                                {isGenerating ? "Generating..." : "Generate"}
                              </button>
                            )}

                            <button
                              className="btn btn-sm d-flex align-items-center gap-1"
                              disabled={isGenerating}
                              title="Force regenerate report from latest data"
                              onClick={async () => {
                                if (!modalStudent) return;
                                setReportGeneratingFor(assessment.assessmentId);
                                try {
                                  const fullAssessment = assessments.find((a: any) => a.id === assessment.assessmentId) as any;
                                  const isBet = fullAssessment?.questionnaire?.type === true
                                    || (fullAssessment?.questionnaire?.type == null && (assessment.assessmentName || '').toUpperCase().includes('BET'));

                                  const res = isBet
                                    ? await generateBetReportOneClick(assessment.assessmentId, modalStudent.userStudentId, true)
                                    : await generateNavigatorReportOneClick(assessment.assessmentId, modalStudent.userStudentId, true);

                                  const reportUrl = res.data.reportUrl;
                                  if (reportUrl) {
                                    setGeneratedReportUrls(prev => new Map(prev).set(reportKey, reportUrl));
                                  }
                                } catch (err: any) {
                                  showErrorToast("Report generation failed: " + (err?.response?.data?.error || err.message));
                                } finally {
                                  setReportGeneratingFor(null);
                                }
                              }}
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
                              <i className="bi bi-arrow-clockwise"></i>
                              Regenerate
                            </button>

                            {hasReport && (
                              <>
                              <div style={{ width: "100%", height: 0 }}></div>
                              <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "2px" }}>Share</span>
                              <button
                                className="btn btn-sm d-flex align-items-center gap-1"
                                title="Send report via email"
                                onClick={async () => {
                                  if (!modalStudent) return;
                                  setEmailModalStudent(modalStudent);
                                  setEmailAssessmentName(assessment.assessmentName);
                                  setEmailReportUrl(generatedReportUrls.get(reportKey) || null);
                                  setSelectedEmails(new Set());
                                  setExtraEmails([]);
                                  setExtraEmailInput("");
                                  setShowEmailModal(true);
                                  setEmailRecipientsLoading(true);

                                  try {
                                    const res = await getEmailRecipientsForStudent(modalStudent.userStudentId);
                                    setEmailRecipients(res.data || []);
                                  } catch {
                                    setEmailRecipients([]);
                                  } finally {
                                    setEmailRecipientsLoading(false);
                                  }
                                }}
                                style={{
                                  borderRadius: "6px",
                                  padding: "5px 10px",
                                  fontWeight: 500,
                                  fontSize: "0.78rem",
                                  background: "rgba(100, 116, 139, 0.1)",
                                  color: "#475569",
                                  border: "1px solid rgba(100, 116, 139, 0.2)",
                                }}
                              >
                                <i className="bi bi-envelope"></i>
                                Email
                              </button>
                              </>
                            )}
                          </>
                        )}
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
                  {demographicsData.map((field: any) => (
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
                            style={{ fontSize: "0.95rem", color: field.currentValue ? "#1a1a2e" : "#a0aec0" }}
                          >
                            {field.currentValue || "Not provided"}
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
                  ))}
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

      {/* Download Modal */}
      {showDownloadModal && downloadStudent && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => {
              setShowDownloadModal(false);
              closeModal();
              setDownloadAnswers([]);
            }}
            style={{ zIndex: 10040 }}
          ></div>

          <div
            className="modal fade show"
            style={{
              display: "block",
              zIndex: 10050,
            }}
            tabIndex={-1}
            role="dialog"
          >
            <div
              className="modal-dialog modal-dialog-centered modal-xl"
              role="document"
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                }}
              >
                {/* Header */}
                <div
                  className="modal-header"
                  style={{ borderBottom: "2px solid #f0f0f0", padding: "1.5rem" }}
                >
                  <h5
                    className="modal-title"
                    style={{ color: "#1a1a2e", fontWeight: 700 }}
                  >
                    <i
                      className="bi bi-file-earmark-excel me-2"
                      style={{ color: "#4361ee" }}
                    ></i>
                    Student Answer Sheet
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowDownloadModal(false);
                      closeModal();
                      setDownloadAnswers([]);
                    }}
                    disabled={downloading}
                    aria-label="Close"
                  ></button>
                </div>

                {/* Body */}
                <div
                  className="modal-body"
                  style={{
                    padding: "2rem",
                    maxHeight: "70vh",
                    overflowY: "auto",
                  }}
                >
                  {/* Student Details */}
                  <div className="mb-4">
                    <h6
                      className="mb-3"
                      style={{ color: "#1a1a2e", fontWeight: 600 }}
                    >
                      Student Details
                    </h6>
                    <div
                      className="card border-0"
                      style={{ background: "#f8f9fa", borderRadius: "12px" }}
                    >
                      <div className="card-body p-3">
                        <div className="row g-3">
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-person-fill"
                                style={{ color: "#4361ee" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Student Name
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {downloadStudent.name}
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-card-text"
                                style={{ color: "#4361ee" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Roll Number
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {downloadStudent.schoolRollNumber || "N/A"}
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-hash"
                                style={{ color: "#4361ee" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  User ID
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  #{downloadStudent.userStudentId}
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-clipboard-check"
                                style={{ color: "#4361ee" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Total Answers
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {downloadAnswers.length}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Answers Table */}
                  <div className="mb-3">
                    <h6
                      className="mb-3"
                      style={{ color: "#1a1a2e", fontWeight: 600 }}
                    >
                      <i className="bi bi-table me-2"></i>
                      Student Answers
                    </h6>

                    {downloadLoading ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3 text-muted">Loading answers...</p>
                      </div>
                    ) : downloadError ? (
                      <div
                        className="alert alert-danger"
                        style={{ borderRadius: "10px" }}
                      >
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {downloadError}
                      </div>
                    ) : downloadAnswers.length === 0 ? (
                      <div
                        className="alert alert-info"
                        style={{ borderRadius: "10px" }}
                      >
                        <i className="bi bi-info-circle me-2"></i>
                        No answers found for this student.
                      </div>
                    ) : (
                      <div
                        className="table-responsive"
                        style={{
                          borderRadius: "12px",
                          border: "1px solid #e0e0e0",
                        }}
                      >
                        <table className="table table-hover mb-0">
                          <thead
                            style={{
                              background: "#f8f9fa",
                              position: "sticky",
                              top: 0,
                              zIndex: 1,
                            }}
                          >
                            <tr>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "60px",
                                }}
                              >
                                S.No
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "200px",
                                }}
                              >
                                Section Name
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "220px",
                                }}
                              >
                                Excel Header
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                }}
                              >
                                Question Text
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "280px",
                                }}
                              >
                                Opted Option Text
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {downloadAnswers.map((answer, index) => (
                              <tr key={`${answer.questionId}-${answer.optionId}`}>
                                <td
                                  style={{
                                    padding: "12px 16px",
                                    verticalAlign: "top",
                                  }}
                                >
                                  <span
                                    className="badge bg-light text-dark"
                                    style={{ fontSize: "0.85rem" }}
                                  >
                                    {index + 1}
                                  </span>
                                </td>
                                <td
                                  style={{ padding: "12px 16px", color: "#333" }}
                                >
                                  <span
                                    className="badge bg-light text-dark"
                                    style={{ fontSize: "0.85rem" }}
                                  >
                                    {answer.sectionName || "N/A"}
                                  </span>
                                </td>
                                <td
                                  style={{ padding: "12px 16px", color: "#333" }}
                                >
                                  {answer.excelQuestionHeader || "N/A"}
                                </td>
                                <td
                                  style={{ padding: "12px 16px", color: "#333" }}
                                >
                                  {answer.questionText}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(67, 97, 238, 0.1)",
                                      color: "#4361ee",
                                      padding: "6px 12px",
                                      borderRadius: "6px",
                                      fontWeight: 500,
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    {answer.optionText || ((answer as any).isImageOption && (answer as any).optionNumber ? `Option ${(answer as any).optionNumber} (Image)` : "")}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="modal-footer"
                  style={{ borderTop: "2px solid #f0f0f0", padding: "1.5rem" }}
                >
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setShowDownloadModal(false);
                      closeModal();
                      setDownloadAnswers([]);
                    }}
                    disabled={downloading}
                    style={{
                      borderRadius: "10px",
                      padding: "0.6rem 1.5rem",
                      fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownloadExcel}
                    disabled={
                      downloading || downloadLoading || downloadAnswers.length === 0
                    }
                    style={{
                      background:
                        "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.5rem",
                      fontWeight: 600,
                    }}
                  >
                    {downloading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-download me-2"></i>
                        Download Excel
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bulk Download All Answers Modal */}
      {showBulkDownloadModal && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => {
              if (!bulkDownloading) {
                setShowBulkDownloadModal(false);
                setBulkDownloadAnswers([]);
                setBulkDownloadError("");
              }
            }}
            style={{ zIndex: 10040 }}
          ></div>

          <div
            className="modal fade show"
            style={{
              display: "block",
              zIndex: 10050,
            }}
            tabIndex={-1}
            role="dialog"
          >
            <div
              className="modal-dialog modal-dialog-centered modal-xl"
              role="document"
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                }}
              >
                {/* Header */}
                <div
                  className="modal-header"
                  style={{ borderBottom: "2px solid #f0f0f0", padding: "1.5rem" }}
                >
                  <h5
                    className="modal-title"
                    style={{ color: "#1a1a2e", fontWeight: 700 }}
                  >
                    <i
                      className="bi bi-file-earmark-excel me-2"
                      style={{ color: "#7209b7" }}
                    ></i>
                    All Students Answer Sheet
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowBulkDownloadModal(false);
                      setBulkDownloadAnswers([]);
                      setBulkDownloadError("");
                    }}
                    disabled={bulkDownloading}
                    aria-label="Close"
                  ></button>
                </div>

                {/* Body */}
                <div
                  className="modal-body"
                  style={{
                    padding: "2rem",
                    maxHeight: "70vh",
                    overflowY: "auto",
                  }}
                >
                  {/* Summary */}
                  <div className="mb-4">
                    <div
                      className="card border-0"
                      style={{ background: "#f8f9fa", borderRadius: "12px" }}
                    >
                      <div className="card-body p-3">
                        <div className="row g-3">
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-people-fill"
                                style={{ color: "#7209b7" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Filtered Students
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {filteredStudents.length}
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-clipboard-check"
                                style={{ color: "#7209b7" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Students x Assessments
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {pivotedBulkData.rows.length} rows ({pivotedBulkData.questionColumns.length} questions)
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-building"
                                style={{ color: "#7209b7" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Institute
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {getSelectedInstituteName()}
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className="bi bi-controller"
                                style={{ color: pivotedBulkData.hasGameData ? "#059669" : "#999" }}
                              ></i>
                              <div>
                                <small className="text-muted d-block">
                                  Game Data
                                </small>
                                <strong
                                  style={{ color: "#1a1a2e", fontSize: "0.9rem" }}
                                >
                                  {pivotedBulkData.hasGameData
                                    ? `${bulkGameResults.size} students`
                                    : "Not available"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Unmapped Text Responses Warning */}
                  {!bulkDownloadLoading && !bulkDownloadError && pivotedBulkData.unmappedCount > 0 && (
                    <div
                      className="mb-4 p-3 d-flex align-items-center justify-content-between flex-wrap gap-3"
                      style={{
                        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.08) 100%)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "12px",
                      }}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "50%",
                            background: "rgba(245, 158, 11, 0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i className="bi bi-exclamation-triangle-fill" style={{ color: "#d97706", fontSize: "1.2rem" }}></i>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.95rem" }}>
                            {pivotedBulkData.unmappedCount} Unmapped Text Response{pivotedBulkData.unmappedCount > 1 ? "s" : ""} Found
                          </div>
                          <div style={{ color: "#a16207", fontSize: "0.85rem" }}>
                            Some student answers contain free-text responses that haven't been mapped to existing options. Map them first for accurate scoring.
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-sm d-flex align-items-center gap-2"
                        onClick={() => navigate("/text-response-mapping")}
                        style={{
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "10px",
                          padding: "8px 20px",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <i className="bi bi-arrow-right-circle-fill"></i>
                        Map Text Responses
                      </button>
                    </div>
                  )}

                  {/* Answers Table */}
                  <div className="mb-3">
                    <h6
                      className="mb-3"
                      style={{ color: "#1a1a2e", fontWeight: 600 }}
                    >
                      <i className="bi bi-table me-2"></i>
                      All Student Answers Preview
                    </h6>

                    {bulkDownloadLoading ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3 text-muted">
                          Loading answers for all students... This may take a moment.
                        </p>
                      </div>
                    ) : bulkDownloadError ? (
                      <div
                        className="alert alert-danger"
                        style={{ borderRadius: "10px" }}
                      >
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {bulkDownloadError}
                      </div>
                    ) : bulkDownloadAnswers.length === 0 ? (
                      <div
                        className="alert alert-info"
                        style={{ borderRadius: "10px" }}
                      >
                        <i className="bi bi-info-circle me-2"></i>
                        No answers found for the filtered students.
                      </div>
                    ) : (
                      <div
                        className="table-responsive"
                        style={{
                          borderRadius: "12px",
                          border: "1px solid #e0e0e0",
                        }}
                      >
                        <table className="table table-hover mb-0">
                          <thead
                            style={{
                              background: "#f8f9fa",
                              position: "sticky",
                              top: 0,
                              zIndex: 1,
                            }}
                          >
                            <tr>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "60px",
                                }}
                              >
                                S.No
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "160px",
                                }}
                              >
                                Student Name
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "80px",
                                }}
                              >
                                User ID
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: 600,
                                  color: "#1a1a2e",
                                  width: "160px",
                                }}
                              >
                                Assessment
                              </th>
                              {pivotedBulkData.questionColumns.slice(0, 5).map((col) => (
                                <th
                                  key={col}
                                  style={{
                                    padding: "12px 16px",
                                    fontWeight: 600,
                                    color: "#1a1a2e",
                                    minWidth: "150px",
                                    maxWidth: "200px",
                                  }}
                                  title={col}
                                >
                                  {col.length > 25 ? col.substring(0, 25) + "..." : col}
                                </th>
                              ))}
                              {pivotedBulkData.questionColumns.length > 5 && (
                                <th
                                  style={{
                                    padding: "12px 16px",
                                    fontWeight: 600,
                                    color: "#999",
                                    fontStyle: "italic",
                                  }}
                                >
                                  +{pivotedBulkData.questionColumns.length - 5} more
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {pivotedBulkData.rows.slice(0, 50).map((row, index) => (
                              <tr key={index}>
                                <td
                                  style={{
                                    padding: "12px 16px",
                                    verticalAlign: "top",
                                  }}
                                >
                                  <span
                                    className="badge bg-light text-dark"
                                    style={{ fontSize: "0.85rem" }}
                                  >
                                    {index + 1}
                                  </span>
                                </td>
                                <td
                                  style={{ padding: "12px 16px", color: "#333", fontWeight: 500 }}
                                >
                                  {row.studentName || "N/A"}
                                </td>
                                <td
                                  style={{ padding: "12px 16px", color: "#333" }}
                                >
                                  #{row.userStudentId || "N/A"}
                                </td>
                                <td
                                  style={{ padding: "12px 16px", color: "#333" }}
                                >
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(114, 9, 183, 0.1)",
                                      color: "#7209b7",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    {row.assessmentName || "N/A"}
                                  </span>
                                </td>
                                {pivotedBulkData.questionColumns.slice(0, 5).map((col) => (
                                  <td
                                    key={col}
                                    style={{ padding: "12px 16px" }}
                                  >
                                    {row.answers[col] ? (
                                      <span
                                        className="badge"
                                        style={{
                                          background: "rgba(67, 97, 238, 0.1)",
                                          color: "#4361ee",
                                          padding: "6px 12px",
                                          borderRadius: "6px",
                                          fontWeight: 500,
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        {row.answers[col]}
                                      </span>
                                    ) : (
                                      <span className="text-muted" style={{ fontSize: "0.8rem" }}>-</span>
                                    )}
                                  </td>
                                ))}
                                {pivotedBulkData.questionColumns.length > 5 && (
                                  <td style={{ padding: "12px 16px", color: "#999", fontSize: "0.8rem" }}>...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {pivotedBulkData.rows.length > 50 && (
                          <div
                            className="text-center py-3"
                            style={{
                              background: "#f8f9fa",
                              borderTop: "1px solid #e0e0e0",
                              color: "#666",
                              fontSize: "0.9rem",
                            }}
                          >
                            <i className="bi bi-info-circle me-2"></i>
                            Showing first 50 of {pivotedBulkData.rows.length} rows. All rows will be included in the Excel download.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="modal-footer"
                  style={{ borderTop: "2px solid #f0f0f0", padding: "1.5rem" }}
                >
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setShowBulkDownloadModal(false);
                      setBulkDownloadAnswers([]);
                      setBulkDownloadError("");
                    }}
                    disabled={bulkDownloading}
                    style={{
                      borderRadius: "10px",
                      padding: "0.6rem 1.5rem",
                      fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleBulkDownloadExcel}
                    disabled={
                      bulkDownloading || bulkDownloadLoading || pivotedBulkData.rows.length === 0
                    }
                    style={{
                      background:
                        "linear-gradient(135deg, #7209b7 0%, #3a0ca3 100%)",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.5rem",
                      fontWeight: 600,
                    }}
                  >
                    {bulkDownloading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-download me-2"></i>
                        Download Excel ({pivotedBulkData.rows.length} students)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Proctoring modal removed — download now handled directly by backend */}

      {/* Reset Confirmation Modal */}
      {showResetModal && resetStudent && resetAssessmentId && (
        <>
          {showResetConfirm ? (
            // Second confirmation dialog
            <div
              className="modal show d-block"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 10060 }}
            >
              <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "400px" }}
              >
                <div
                  className="modal-content border-0 shadow-lg"
                  style={{ borderRadius: "16px" }}
                >
                  <div className="modal-body text-center p-4">
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        background:
                          "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1rem",
                      }}
                    >
                      <i className="bi bi-exclamation-triangle-fill text-white fs-4"></i>
                    </div>
                    <h5 className="mb-2 fw-bold">Confirm Reset</h5>
                    <p className="text-muted mb-4">
                      Are you sure you want to reset{" "}
                      <strong>{resetAssessmentName}</strong>? This will delete
                      all saved answers and scores.
                    </p>
                    <div className="d-flex gap-2 justify-content-center">
                      <button
                        className="btn btn-outline-secondary px-4"
                        onClick={() => setShowResetConfirm(false)}
                        disabled={resetting}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-danger px-4"
                        onClick={handleConfirmReset}
                        disabled={resetting}
                      >
                        {resetting ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                            ></span>
                            Resetting...
                          </>
                        ) : (
                          "Reset Assessment"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // First modal - just close it and show confirmation
            <div
              className="modal show d-block"
              style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10050 }}
              onClick={() => {
                setShowResetModal(false);
                closeModal();
              }}
            >
              <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "400px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="modal-content border-0 shadow-lg"
                  style={{ borderRadius: "16px" }}
                >
                  <div className="modal-body text-center p-4">
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        background:
                          "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1rem",
                      }}
                    >
                      <i className="bi bi-arrow-counterclockwise text-white fs-4"></i>
                    </div>
                    <h5 className="mb-2 fw-bold">Reset Assessment</h5>
                    <p className="text-muted mb-4">
                      You are about to reset{" "}
                      <strong>{resetAssessmentName}</strong> for{" "}
                      <strong>{resetStudent.name}</strong>. Do you want to
                      continue?
                    </p>
                    <div className="d-flex gap-2 justify-content-center">
                      <button
                        className="btn btn-outline-secondary px-4"
                        onClick={() => {
                          setShowResetModal(false);
                          closeModal();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-warning px-4"
                        onClick={() => setShowResetConfirm(true)}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #4361ee 0%, #1a1a2e 100%)", padding: "1.25rem 1.5rem", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h5 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>
                  <i className="bi bi-envelope me-2"></i>Send Report via Email
                </h5>
                {emailModalStudent && (
                  <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.85)", fontSize: "0.82rem" }}>
                    {emailModalStudent.name}{emailAssessmentName ? ` — ${emailAssessmentName}` : ""}
                  </p>
                )}
              </div>
              <button type="button" style={{ background: "none", border: "none", color: "#fff", fontSize: "1.4rem", cursor: "pointer", padding: 4, lineHeight: 1 }} onClick={() => setShowEmailModal(false)}>&times;</button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
              {emailRecipientsLoading ? (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                  <p style={{ marginTop: 8, color: "#6b7280", fontSize: "0.85rem" }}>Loading recipients...</p>
                </div>
              ) : (
                <>
                  {/* Select All */}
                  {emailRecipients.length > 0 && (
                    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #e5e7eb" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", color: "#374151" }}>
                        <input
                          type="checkbox"
                          checked={emailRecipients.length > 0 && emailRecipients.every((r) => selectedEmails.has(r.email))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmails(new Set([...selectedEmails, ...emailRecipients.map((r) => r.email)]));
                            } else {
                              const recipientEmails = new Set(emailRecipients.map((r) => r.email));
                              setSelectedEmails(new Set([...selectedEmails].filter((em) => !recipientEmails.has(em))));
                            }
                          }}
                          style={{ width: 16, height: 16, accentColor: "#4361ee" }}
                        />
                        Select All
                      </label>
                    </div>
                  )}

                  {/* Recipient list */}
                  {emailRecipients.length === 0 && (
                    <p style={{ color: "#9ca3af", fontSize: "0.85rem", textAlign: "center", padding: "1rem 0" }}>No recipients found for this student.</p>
                  )}
                  {emailRecipients.map((r, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "8px 0", borderBottom: i < emailRecipients.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(r.email)}
                        onChange={(e) => {
                          const next = new Set(selectedEmails);
                          if (e.target.checked) next.add(r.email);
                          else next.delete(r.email);
                          setSelectedEmails(next);
                        }}
                        style={{ width: 16, height: 16, marginTop: 2, accentColor: "#4361ee" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1f2937" }}>{r.name}</div>
                        <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>{r.email}</div>
                        <span style={{
                          display: "inline-block", marginTop: 2, padding: "1px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600,
                          background: r.role === "Student" ? "#dbeafe" : r.role === "Assigned Contact Person" ? "#dcfce7" : "#f3e8ff",
                          color: r.role === "Student" ? "#2563eb" : r.role === "Assigned Contact Person" ? "#059669" : "#7c3aed",
                        }}>
                          {r.role}{r.designation ? ` — ${r.designation}` : ""}
                        </span>
                      </div>
                    </label>
                  ))}

                  {/* Extra emails input */}
                  <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 8 }}>Add extra email addresses</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="email"
                        placeholder="Enter email and press Enter or Add"
                        value={extraEmailInput}
                        onChange={(e) => setExtraEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            const email = extraEmailInput.trim().replace(/,$/,"");
                            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !extraEmails.includes(email)) {
                              setExtraEmails([...extraEmails, email]);
                              setSelectedEmails(new Set([...selectedEmails, email]));
                              setExtraEmailInput("");
                            }
                          }
                        }}
                        style={{ flex: 1, padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.85rem", outline: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const email = extraEmailInput.trim();
                          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !extraEmails.includes(email)) {
                            setExtraEmails([...extraEmails, email]);
                            setSelectedEmails(new Set([...selectedEmails, email]));
                            setExtraEmailInput("");
                          }
                        }}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#4361ee", color: "#fff", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
                      >
                        Add
                      </button>
                    </div>
                    {/* Extra email chips */}
                    {extraEmails.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {extraEmails.map((email, i) => (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "#f3f4f6", fontSize: "0.78rem", color: "#374151" }}>
                            {email}
                            <button
                              type="button"
                              onClick={() => {
                                setExtraEmails(extraEmails.filter((_, j) => j !== i));
                                const next = new Set(selectedEmails);
                                next.delete(email);
                                setSelectedEmails(next);
                              }}
                              style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0, fontSize: "0.9rem", lineHeight: 1 }}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid #e0e0e0", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{selectedEmails.size} recipient(s) selected</span>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-sm" onClick={() => setShowEmailModal(false)} style={{ borderRadius: 8, padding: "8px 20px" }}>Cancel</button>
                <button
                  className="btn btn-sm"
                  disabled={selectedEmails.size === 0 || sendingEmail}
                  onClick={async () => {
                    if (selectedEmails.size === 0 || !emailModalStudent) return;
                    setSendingEmail(true);
                    try {
                      const studentName = emailModalStudent.name || "Student";
                      const reportLink = emailReportUrl || "";
                      const subject = `Assessment Report – ${studentName}${emailAssessmentName ? ` (${emailAssessmentName})` : ""}`;
                      const assessmentLabel = emailAssessmentName || "assessment";
                      const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>`
                        + `<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">`
                        + `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 0;"><tr><td align="center">`
                        + `<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">`
                        // Header
                        + `<tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px 40px;text-align:center;">`
                        + `<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Career-9</h1>`
                        + `<p style="margin:6px 0 0;color:#a8b5cc;font-size:13px;">Ensuring Career Success</p>`
                        + `</td></tr>`
                        // Body
                        + `<tr><td style="padding:36px 40px;">`
                        + `<p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;">Dear <strong>${studentName}</strong>,</p>`
                        + `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">Greetings from Career-9!</p>`
                        + `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">Thank you for completing the <strong>${assessmentLabel}</strong> assessment. Your report has been generated and is ready for you to view.</p>`
                        // Report details card
                        + `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px;">`
                        + `<p style="margin:0 0 12px;font-size:14px;color:#6b7280;">Report Details</p>`
                        + `<table cellpadding="4" cellspacing="0" style="font-size:14px;color:#1a1a2e;">`
                        + `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;">Student:</td><td style="font-weight:600;">${studentName}</td></tr>`
                        + `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-weight:600;">Assessment:</td><td style="font-weight:600;">${assessmentLabel}</td></tr>`
                        + `</table></div>`
                        // View report button
                        + `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Please click the button below to access your report:</p>`
                        + (reportLink
                          ? `<p style="margin:0 0 16px;"><a href="${reportLink}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4361ee 0%,#3a0ca3 100%);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View Report</a></p>`
                            + `<p style="margin:0 0 24px;font-size:13px;color:#6b7280;">You can also access your report using this link:<br/><a href="${reportLink}" style="color:#4361ee;text-decoration:none;">${reportLink}</a></p>`
                          : "")
                        // Counselling note
                        + `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Our team will be in touch with you shortly to guide you through the next steps, including your personalised counselling session.</p>`
                        // Divider
                        + `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">`
                        // Contact
                        + `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">For any queries or assistance, feel free to reach us:</p>`
                        + `<table cellpadding="2" cellspacing="0" style="font-size:14px;color:#374151;">`
                        + `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Email:</td><td><a href="mailto:support@career-9.com" style="color:#4361ee;text-decoration:none;font-weight:500;">support@career-9.com</a></td></tr>`
                        + `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Phone:</td><td style="font-weight:500;">+91 70000 70256</td></tr>`
                        + `</table>`
                        // Sign-off
                        + `<div style="margin-top:28px;">`
                        + `<p style="margin:0 0 4px;font-size:14px;color:#374151;">Warm Regards,</p>`
                        + `<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#1a1a2e;">Career-9 Team</p>`
                        + `<p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">Ensuring Career Success</p>`
                        + `</div>`
                        + `</td></tr>`
                        // Footer
                        + `<tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">`
                        + `<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">This is an automated email from Career-9.</p>`
                        + `<p style="margin:0;font-size:12px;color:#9ca3af;">Please do not reply directly to this email.</p>`
                        + `</td></tr>`
                        + `</table></td></tr></table></body></html>`;
                      await sendReportEmail({
                        emails: Array.from(selectedEmails),
                        subject,
                        htmlContent,
                        fromName: "Career-9",
                      });
                      showSuccessToast(`Email sent to ${selectedEmails.size} recipient(s)`);
                      setShowEmailModal(false);
                    } catch (err: any) {
                      showErrorToast("Failed to send email: " + (err?.response?.data?.message || err?.response?.data || err?.message || "Unknown error"));
                    } finally {
                      setSendingEmail(false);
                    }
                  }}
                  style={{
                    background: selectedEmails.size > 0 ? "#4361ee" : "#e0e0e0",
                    color: selectedEmails.size > 0 ? "#fff" : "#999",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 24px",
                    fontWeight: 600,
                  }}
                >
                  {sendingEmail ? <><span className="spinner-border spinner-border-sm me-2" />Sending...</> : <><i className="bi bi-send me-1"></i>Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {modal.type === "edit" && modal.student && (
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
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "20px",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                padding: "1rem 1.25rem",
                borderRadius: "20px 20px 0 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "1.1rem" }}>
                <i className="bi bi-pencil-square me-2"></i>
                Edit Student Info
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={closeModal}
              ></button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.25rem" }}>
              <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                Editing: <strong>#{modal.student.userStudentId}</strong> &mdash; {modal.student.name || "Unnamed"}
              </p>

              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Student name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Email address"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="Phone number"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>Date of Birth</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="dd-MM-yyyy"
                  value={editForm.studentDob}
                  onChange={(e) => setEditForm((f) => ({ ...f, studentDob: e.target.value }))}
                  style={{ borderRadius: "10px" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "0.75rem 1.25rem",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={closeModal}
                style={{ borderRadius: "10px" }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleSaveEdit}
                disabled={editSaving}
                style={{
                  background: "#4361ee",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 600,
                }}
              >
                {editSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}