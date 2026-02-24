import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ReadCollegeData, GetSessionsByInstituteCode } from "../College/API/College_APIs";
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
  getBulkProctoringData,
} from "../StudentInformation/StudentInfo_APIs";
import * as XLSX from "xlsx";

type Student = {
  id: number;
  name: string;
  schoolRollNumber: string;
  selectedAssessment: string;
  userStudentId: number;
  assessmentName?: string;
  phoneNumber?: string;
  studentDob?: string;
  username?: string;
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

  // Modal state
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [studentAssessments, setStudentAssessments] = useState<
    StudentAssessmentInfo[]
  >([]);

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadStudent, setDownloadStudent] = useState<Student | null>(null);
  const [downloadAssessmentId, setDownloadAssessmentId] = useState<number | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadAnswers, setDownloadAnswers] = useState<StudentAnswerDetail[]>([]);
  const [downloadError, setDownloadError] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [showStudentUsernameDownload, setShowStudentUsernameDownload] = useState(false);

  // Bulk download all answers state
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false);
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false);
  const [bulkDownloadAnswers, setBulkDownloadAnswers] = useState<any[]>([]);
  const [bulkDownloadError, setBulkDownloadError] = useState<string>("");
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkGameResults, setBulkGameResults] = useState<Map<string, any>>(new Map());
  const [bulkDemographicData, setBulkDemographicData] = useState<any[]>([]);

  // Bulk download proctoring data state
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [proctoringLoading, setProctoringLoading] = useState(false);
  const [proctoringData, setProctoringData] = useState<any[]>([]);
  const [proctoringError, setProctoringError] = useState<string>("");
  const [proctoringDownloading, setProctoringDownloading] = useState(false);

  // Filter panel state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);

  // Pending filter selections (inside the panel, before "Apply")
  const [pendingAssessmentIds, setPendingAssessmentIds] = useState<Set<number>>(new Set());
  const [pendingSessions, setPendingSessions] = useState<Set<string>>(new Set());
  const [pendingGrades, setPendingGrades] = useState<Set<string>>(new Set());
  const [pendingSections, setPendingSections] = useState<Set<string>>(new Set());
  const [pendingStatuses, setPendingStatuses] = useState<Set<string>>(new Set());
  const [pendingEnabled, setPendingEnabled] = useState<Set<string>>(new Set());

  // Applied filter selections (what actually filters the data)
  const [appliedAssessmentIds, setAppliedAssessmentIds] = useState<Set<number>>(new Set());
  const [appliedSessions, setAppliedSessions] = useState<Set<string>>(new Set());
  const [appliedGrades, setAppliedGrades] = useState<Set<string>>(new Set());
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());
  const [appliedStatuses, setAppliedStatuses] = useState<Set<string>>(new Set());
  const [appliedEnabled, setAppliedEnabled] = useState<Set<string>>(new Set());

  // Which category is selected on the left to show its options on the right
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>("assessment");

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [resetAssessmentId, setResetAssessmentId] = useState<number | null>(null);
  const [resetAssessmentName, setResetAssessmentName] = useState<string>("");
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Demographics modal state
  const [showDemographicsModal, setShowDemographicsModal] = useState(false);
  const [demographicsStudent, setDemographicsStudent] = useState<Student | null>(null);
  const [demographicsAssessmentId, setDemographicsAssessmentId] = useState<number | null>(null);
  const [demographicsAssessmentName, setDemographicsAssessmentName] = useState<string>("");
  const [demographicsData, setDemographicsData] = useState<any[]>([]);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

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

        return {
          questionId: item.questionId ?? item.questionid ?? item.question_id,
          questionText,
          optionId: item.optionId ?? item.optionid ?? item.option_id,
          optionText,
          sectionName,
          excelQuestionHeader,
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
      alert("No new assessments to save.");
      return;
    }

    setSaving(true);
    try {
      await bulkAlotAssessment(assignments);
      alert(`${assignments.length} assessment(s) saved successfully!`);
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
            studentDob: student.studentDob || "",
            schoolRollNumber: student.schoolRollNumber || "",
            selectedAssessment: "",
            userStudentId: student.userStudentId,
            assessmentName: assessment?.assessmentName || "",
            username: student.username || "",
            schoolSectionId: student.schoolSectionId ?? undefined,
            assessments: student.assessments || [],
            assignedAssessmentIds: assignedIds,
          };
        });
        setStudents(studentData);
      }
    } catch (error) {
      console.error("Error saving assessments:", error);
      alert("Failed to save assessments. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadClick = async (student: Student, assessmentId: number) => {
    setDownloadStudent(student);
    setDownloadAssessmentId(assessmentId);
    setShowDownloadModal(true);
    setDownloadLoading(true);
    setDownloadError("");

    try {
      console.log("Fetching answers for:", {
        userStudentId: student.userStudentId,
        assessmentId: assessmentId,
      });

      const response = await getStudentAnswersWithDetails(
        student.userStudentId,
        assessmentId
      );

      console.log("API Response:", response);
      const normalized = normalizeAnswers(response.data);
      console.log("Normalized answers count:", normalized.length);
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
      const excelData = downloadAnswers.map((answer, index) => ({
        "S.No": index + 1,
        "Section Name": answer.sectionName || "",
        "Excel Header": answer.excelQuestionHeader || "",
        "Question Text": answer.questionText,
        "Opted Option Text": answer.optionText,
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

      alert(`Download successful for ${downloadStudent.name}!`);
      setShowDownloadModal(false);
      setDownloadStudent(null);
      setDownloadAssessmentId(null);
      setDownloadAnswers([]);
    } catch (error) {
      console.error("Error downloading:", error);
      alert("Failed to download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleResetClick = (student: Student, assessmentId: number, assessmentName: string) => {
    setResetStudent(student);
    setResetAssessmentId(assessmentId);
    setResetAssessmentName(assessmentName);
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    if (!resetStudent || !resetAssessmentId) return;

    setResetting(true);
    try {
      await resetAssessment(resetStudent.userStudentId, resetAssessmentId);
      alert("Assessment reset successfully!");
      setShowResetConfirm(false);
      setShowResetModal(false);

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
            studentDob: student.studentDob || "",
            schoolRollNumber: student.schoolRollNumber || "",
            selectedAssessment: "",
            userStudentId: student.userStudentId,
            assessmentName: assessment?.assessmentName || "",
            username: student.username || "",
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

      setResetStudent(null);
      setResetAssessmentId(null);
      setResetAssessmentName("");
    } catch (error: any) {
      console.error("Error resetting assessment:", error);
      alert(error.response?.data?.error || "Failed to reset assessment");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    ReadCollegeData()
      .then((res: any) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        console.log("Fetched Institutes:", list);
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
    setShowFilterPanel(false);
  }, [selectedInstitute]);

  useEffect(() => {
    if (selectedInstitute) {
      setLoading(true);
      getStudentsWithMappingByInstituteId(Number(selectedInstitute))
        .then((response) => {
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
              studentDob: student.studentDob || "",
              schoolRollNumber: student.schoolRollNumber || "",
              selectedAssessment: "",
              userStudentId: student.userStudentId,
              assessmentName: assessment?.assessmentName || "",
              username: student.username || "",
              schoolSectionId: student.schoolSectionId ?? undefined,
              assessments: student.assessments || [],
              assignedAssessmentIds: assignedIds,
            };
          });
          console.log("Loaded students:", studentData);
          setStudents(studentData);
        })
        .catch((error) => {
          console.error("Error fetching student info:", error);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedInstitute, assessments]);

  // Set of active assessment IDs — used to hide deactivated assessments everywhere
  const activeAssessmentIds = new Set(assessments.map((a) => a.id));

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Text search filter
      const matchesQuery =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.schoolRollNumber.toLowerCase().includes(query.toLowerCase()) ||
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

  const getSelectedInstituteName = () => {
    const institute = institutes.find(
      (inst) => inst.instituteCode === selectedInstitute
    );
    return institute?.instituteName || "";
  };

  const handleDownloadStudentList = () => {
    if (filteredStudents.length === 0) {
      alert("No students to download.");
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = filteredStudents.map((student, index) => ({
        "S.No": index + 1,
        "User ID": student.userStudentId,
        "Username": student.username || "N/A",
        "Student Name": student.name,
        // "Roll Number": student.schoolRollNumber || "N/A",
        // "Phone Number": student.phoneNumber || "N/A",
        "Date of Birth": student.studentDob ? formatDate(student.studentDob) : "N/A",
        "Institute": getSelectedInstituteName(),
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 },   // S.No
        { wch: 12 },  // User ID
        { wch: 20 },  // Username
        { wch: 30 },  // Student Name
        { wch: 18 },  // Roll Number
        { wch: 18 },  // Phone Number
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

      alert(`Student list downloaded successfully!`);
    } catch (error) {
      console.error("Error downloading student list:", error);
      alert("Failed to download student list. Please try again.");
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
        const displayValue = row.optionText || "";
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

      alert("Download successful!");
      setShowBulkDownloadModal(false);
      setBulkDownloadAnswers([]);
    } catch (error) {
      console.error("Error downloading:", error);
      alert("Failed to download. Please try again.");
    } finally {
      setBulkDownloading(false);
    }
  };

  // ── Download All Proctoring Data ──

  const handleProctoringDownloadClick = async () => {
    setShowProctoringModal(true);
    setProctoringLoading(true);
    setProctoringError("");
    setProctoringData([]);

    try {
      const hasAssessmentFilterApplied = appliedEnabled.has("assessment") && appliedAssessmentIds.size > 0;
      const pairs: { userStudentId: number; assessmentId: number }[] = [];
      for (const student of filteredStudents) {
        const studentAssessments = (student.assessments || []).filter(
          (a) => hasAssessmentFilterApplied
            ? appliedAssessmentIds.has(Number(a.assessmentId))
            : activeAssessmentIds.has(Number(a.assessmentId))
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
        setProctoringData([]);
        setProctoringLoading(false);
        return;
      }

      const response = await getBulkProctoringData(pairs);
      setProctoringData(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error("Error fetching bulk proctoring data:", err);
      setProctoringError("Failed to load proctoring data. Please try again.");
    } finally {
      setProctoringLoading(false);
    }
  };

  const proctoringColumns = [
    "Time Spent (ms)",
    "Mouse Clicks",
    "Max Faces",
    "Avg Faces",
    "Head Away Count",
    "Tab Switches",
    "Screen Width",
    "Screen Height",
    "Created At",
  ];

  const pivotedProctoringData = useMemo(() => {
    if (proctoringData.length === 0) return { rows: [] as any[], questionColumns: [] as string[] };

    // Collect unique question headers
    const questionColumnsSet = new Set<string>();
    for (const row of proctoringData) {
      const colKey = row.questionText || `Q${row.questionnaireQuestionId}`;
      if (colKey) questionColumnsSet.add(colKey);
    }
    const questionColumns = Array.from(questionColumnsSet);

    // Group by student + assessment — one row per student+assessment, each question's metrics as sub-columns
    type RowData = {
      studentName: string;
      userStudentId: string;
      assessmentName: string;
      metrics: Record<string, Record<string, any>>;
    };
    const groupMap = new Map<string, RowData>();

    for (const row of proctoringData) {
      const key = `${row.userStudentId}_${row.assessmentId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          studentName: row.studentName || "",
          userStudentId: String(row.userStudentId),
          assessmentName: row.assessmentName || "",
          metrics: {},
        });
      }
      const colKey = row.questionText || `Q${row.questionnaireQuestionId}`;
      // If there are multiple rows for the same question (re-submissions), keep latest
      groupMap.get(key)!.metrics[colKey] = {
        timeSpentMs: row.timeSpentMs ?? "",
        mouseClickCount: row.mouseClickCount ?? "",
        maxFacesDetected: row.maxFacesDetected ?? "",
        avgFacesDetected: row.avgFacesDetected ?? "",
        headAwayCount: row.headAwayCount ?? "",
        tabSwitchCount: row.tabSwitchCount ?? "",
        screenWidth: row.screenWidth ?? "",
        screenHeight: row.screenHeight ?? "",
        createdAt: row.createdAt ?? "",
      };
    }

    return { rows: Array.from(groupMap.values()), questionColumns };
  }, [proctoringData]);

  const handleProctoringDownloadExcel = () => {
    if (pivotedProctoringData.rows.length === 0) return;

    setProctoringDownloading(true);
    try {
      const { rows, questionColumns } = pivotedProctoringData;

      // Flat format: one row per student+assessment+question for easy analysis
      const excelRows: Record<string, any>[] = [];
      let sno = 1;
      for (const row of rows) {
        for (const qCol of questionColumns) {
          const m = row.metrics[qCol];
          if (!m) continue;
          excelRows.push({
            "S.No": sno++,
            "Student Name": row.studentName,
            "User ID": row.userStudentId,
            "Assessment": row.assessmentName,
            "Question": qCol.length > 80 ? qCol.substring(0, 80) + "..." : qCol,
            "Time Spent (ms)": m.timeSpentMs,
            "Mouse Clicks": m.mouseClickCount,
            "Max Faces": m.maxFacesDetected,
            "Avg Faces": m.avgFacesDetected,
            "Head Away Count": m.headAwayCount,
            "Tab Switches": m.tabSwitchCount,
            "Screen Width": m.screenWidth,
            "Screen Height": m.screenHeight,
            "Created At": m.createdAt,
          });
        }
      }

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      worksheet["!cols"] = [
        { wch: 8 },   // S.No
        { wch: 25 },  // Student Name
        { wch: 10 },  // User ID
        { wch: 25 },  // Assessment
        { wch: 40 },  // Question
        { wch: 15 },  // Time Spent
        { wch: 14 },  // Mouse Clicks
        { wch: 12 },  // Max Faces
        { wch: 12 },  // Avg Faces
        { wch: 16 },  // Head Away Count
        { wch: 14 },  // Tab Switches
        { wch: 14 },  // Screen Width
        { wch: 14 },  // Screen Height
        { wch: 22 },  // Created At
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Proctoring Data");

      const instituteName = getSelectedInstituteName().replace(/\s+/g, "_");
      const filename = `${instituteName}_Proctoring_Data_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, filename);

      alert("Download successful!");
      setShowProctoringModal(false);
      setProctoringData([]);
    } catch (error) {
      console.error("Error downloading proctoring data:", error);
      alert("Failed to download. Please try again.");
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

  const handleViewAssessments = (student: Student) => {
    setModalStudent(student);
    setShowAssessmentModal(true);
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
    setDemographicsStudent(student);
    setDemographicsAssessmentId(assessmentId);
    setDemographicsAssessmentName(assessmentName);
    setShowDemographicsModal(true);
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
        padding: "2rem",
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
          max-width: 350px;
          margin-bottom: 1.5rem;
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
            console.log("Selected value:", e.target.value);
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
            className="card border-0 shadow-sm mb-4"
            style={{ borderRadius: "16px" }}
          >
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ color: "#1a1a2e" }}>
                    <i
                      className="bi bi-people-fill me-2"
                      style={{ color: "#4361ee" }}
                    ></i>
                    Students List
                  </h2>
                  <p className="text-muted mb-0">
                    View all students enrolled in {getSelectedInstituteName()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Icon + Active Filter Tags */}
          <div className="d-flex align-items-center gap-3 flex-wrap mb-4">
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
              className="card border-0 shadow-sm mb-4"
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
            className="card border-0 shadow-sm mb-4"
            style={{ borderRadius: "16px" }}
          >
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 flex-wrap">
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
                    className="btn btn-success d-flex align-items-center gap-2"
                    onClick={handleDownloadStudentList}
                    disabled={filteredStudents.length === 0}
                    style={{
                      background: filteredStudents.length > 0
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        : "#e0e0e0",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.2rem",
                      fontWeight: 600,
                      color: filteredStudents.length > 0 ? "#fff" : "#9e9e9e",
                      cursor: filteredStudents.length > 0 ? "pointer" : "not-allowed",
                      transition: "all 0.3s ease",
                      boxShadow: filteredStudents.length > 0
                        ? "0 4px 15px rgba(16, 185, 129, 0.3)"
                        : "none",
                    }}
                  >
                    <i className="bi bi-download"></i>
                    Download List
                  </button>
                  <button
                    className="btn d-flex align-items-center gap-2"
                    onClick={handleBulkDownloadClick}
                    disabled={filteredStudents.length === 0}
                    style={{
                      background: filteredStudents.length > 0
                        ? "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)"
                        : "#e0e0e0",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.2rem",
                      fontWeight: 600,
                      color: filteredStudents.length > 0 ? "#fff" : "#9e9e9e",
                      cursor: filteredStudents.length > 0 ? "pointer" : "not-allowed",
                      transition: "all 0.3s ease",
                      boxShadow: filteredStudents.length > 0
                        ? "0 4px 15px rgba(67, 97, 238, 0.3)"
                        : "none",
                    }}
                  >
                    <i className="bi bi-file-earmark-spreadsheet"></i>
                    Download All Answers
                  </button>
                  <button
                    className="btn d-flex align-items-center gap-2"
                    onClick={handleProctoringDownloadClick}
                    disabled={filteredStudents.length === 0}
                    style={{
                      background: filteredStudents.length > 0
                        ? "linear-gradient(135deg, #e63946 0%, #a4133c 100%)"
                        : "#e0e0e0",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.2rem",
                      fontWeight: 600,
                      color: filteredStudents.length > 0 ? "#fff" : "#9e9e9e",
                      cursor: filteredStudents.length > 0 ? "pointer" : "not-allowed",
                      transition: "all 0.3s ease",
                      boxShadow: filteredStudents.length > 0
                        ? "0 4px 15px rgba(230, 57, 70, 0.3)"
                        : "none",
                    }}
                  >
                    <i className="bi bi-shield-exclamation"></i>
                    Download All Data
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "16px", overflow: "hidden" }}
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
                <div className="table-responsive" style={{ overflowX: "auto" }}>
                  <table className="table align-middle mb-0" style={{ minWidth: "1400px" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa" }}>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                            width: "60px",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={
                              selectedStudents.size ===
                              filteredStudents.length &&
                              filteredStudents.length > 0
                            }
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          User ID
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Username
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Roll Number
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Student Name
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Allotted Assessment
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Phone Number
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          DOB
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Assessments
                        </th>
                        <th
                          style={{
                            padding: "16px 24px",
                            fontWeight: 600,
                            color: "#1a1a2e",
                            borderBottom: "2px solid #e0e0e0",
                          }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, index) => (
                        <tr
                          key={student.userStudentId}
                          style={{
                            background: index % 2 === 0 ? "#fff" : "#fafbfc",
                            transition: "background 0.2s",
                          }}
                        >
                          <td
                            style={{
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <input
                              type="checkbox"
                              className="custom-checkbox"
                              checked={selectedStudents.has(
                                student.userStudentId
                              )}
                              onChange={() =>
                                handleCheckboxChange(student.userStudentId)
                              }
                            />
                          </td>
                          <td
                            style={{
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <span
                              className="badge"
                              style={{
                                background: "rgba(67, 97, 238, 0.1)",
                                color: "#4361ee",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                              }}
                            >
                              #{student.userStudentId}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
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
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <span style={{ fontWeight: 500, color: "#555" }}>
                              {student.schoolRollNumber || "-"}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
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
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <button
                              className="btn btn-sm d-flex align-items-center gap-1"
                              onClick={() => handleViewAssessments(student)}
                              style={{
                                background: "rgba(67, 97, 238, 0.1)",
                                color: "#4361ee",
                                border: "1px solid rgba(67, 97, 238, 0.3)",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontWeight: 500,
                                fontSize: "0.85rem",
                                transition: "all 0.2s",
                              }}
                            >
                              <i className="bi bi-list-ul"></i>
                              View ({new Set((student.assessments || []).filter(a => activeAssessmentIds.has(Number(a.assessmentId))).map(a => Number(a.assessmentId))).size})
                            </button>
                          </td>
                          <td
                            style={{
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
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
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            {student.studentDob ? (
                              <div className="d-flex align-items-center gap-2">
                                <i
                                  className="bi bi-calendar-event-fill"
                                  style={{ color: "#4361ee" }}
                                ></i>
                                <span
                                  style={{ fontWeight: 500, color: "#555" }}
                                >
                                  {formatDate(student.studentDob)}
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
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
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
                                minWidth: "200px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                border: "2px solid #e0e0e0",
                                background: student.selectedAssessment
                                  ? "rgba(67, 97, 238, 0.05)"
                                  : "#fff",
                                cursor: "pointer",
                                fontWeight: 500,
                                fontSize: "0.9rem",
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
                              padding: "16px 24px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <button
                              className="btn btn-sm d-flex align-items-center gap-1"
                              onClick={() => navigate(`/student-dashboard/${student.userStudentId}`)}
                              style={{
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                color: "#fff",
                                border: "none",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                transition: "all 0.2s",
                                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                              }}
                            >
                              <i className="bi bi-speedometer2"></i>
                              Dashboard
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              borderRadius: "20px",
              maxWidth: "600px",
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
                background:
                  "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                padding: "1rem 1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h5
                  className="mb-0 text-white fw-bold"
                  style={{ fontSize: "1.1rem" }}
                >
                  <i className="bi bi-journal-bookmark me-2"></i>
                  Assigned Assessments
                </h5>
                <p
                  className="mb-0 text-white mt-1"
                  style={{ fontSize: "0.85rem", opacity: 0.9 }}
                >
                  {modalStudent.name}
                </p>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setShowAssessmentModal(false)}
                style={{ marginTop: "2px" }}
              ></button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: "1rem",
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              {studentAssessments.length === 0 ? (
                <div className="text-center py-4">
                  <i
                    className="bi bi-inbox text-muted"
                    style={{ fontSize: "2.5rem", opacity: 0.5 }}
                  ></i>
                  <p className="mt-2 text-muted mb-0">
                    No assessments assigned
                  </p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {studentAssessments.map((assessment) => (
                    <div
                      key={assessment.assessmentId}
                      className="d-flex align-items-center justify-content-between p-3"
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h6
                          className="mb-1 fw-semibold"
                          style={{ color: "#1a1a2e", fontSize: "0.95rem" }}
                        >
                          {assessment.assessmentName}
                        </h6>
                        <div className="d-flex align-items-center gap-2">
                          {getStatusBadge(assessment.status)}
                          <span
                            className="text-muted"
                            style={{ fontSize: "0.75rem" }}
                          >
                            ID: {assessment.assessmentId}
                          </span>
                        </div>
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        <button
                          className="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
                          onClick={() =>
                            handleViewDemographics(
                              modalStudent,
                              assessment.assessmentId,
                              assessment.assessmentName
                            )
                          }
                          style={{
                            borderRadius: "8px",
                            padding: "6px 12px",
                            fontWeight: 500,
                            fontSize: "0.8rem",
                            transition: "all 0.2s",
                          }}
                        >
                          <i className="bi bi-person-lines-fill"></i>
                          Demographics
                        </button>
                        <button
                          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                          onClick={() =>
                            handleDownloadClick(
                              modalStudent,
                              assessment.assessmentId
                            )
                          }
                          style={{
                            borderRadius: "8px",
                            padding: "6px 12px",
                            fontWeight: 500,
                            fontSize: "0.8rem",
                            transition: "all 0.2s",
                          }}
                        >
                          <i className="bi bi-download"></i>
                          Download
                        </button>
                        <button
                          className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1"
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
                            borderRadius: "8px",
                            padding: "6px 12px",
                            fontWeight: 500,
                            fontSize: "0.8rem",
                            transition: "all 0.2s",
                          }}
                        >
                          <i className="bi bi-arrow-counterclockwise"></i>
                          Reset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "0.75rem 1rem",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                className="btn btn-secondary w-100"
                onClick={() => setShowAssessmentModal(false)}
                style={{ borderRadius: "10px" }}
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
              setDownloadStudent(null);
              setDownloadAssessmentId(null);
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
                      setDownloadStudent(null);
                      setDownloadAssessmentId(null);
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
                                    {answer.optionText}
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
                      setDownloadStudent(null);
                      setDownloadAssessmentId(null);
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

      {/* Bulk Download Proctoring Data Modal */}
      {showProctoringModal && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => {
              if (!proctoringDownloading) {
                setShowProctoringModal(false);
                setProctoringData([]);
                setProctoringError("");
              }
            }}
            style={{ zIndex: 10040 }}
          ></div>

          <div
            className="modal fade show"
            style={{ display: "block", zIndex: 10050 }}
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
                      className="bi bi-shield-exclamation me-2"
                      style={{ color: "#e63946" }}
                    ></i>
                    All Students Proctoring Data
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowProctoringModal(false);
                      setProctoringData([]);
                      setProctoringError("");
                    }}
                    disabled={proctoringDownloading}
                    aria-label="Close"
                  ></button>
                </div>

                {/* Body */}
                <div
                  className="modal-body"
                  style={{ padding: "2rem", maxHeight: "70vh", overflowY: "auto" }}
                >
                  {/* Summary */}
                  <div className="mb-4">
                    <div
                      className="card border-0"
                      style={{ background: "#f8f9fa", borderRadius: "12px" }}
                    >
                      <div className="card-body p-3">
                        <div className="row g-3">
                          <div className="col-md-4">
                            <div className="d-flex align-items-center gap-2">
                              <i className="bi bi-people-fill" style={{ color: "#e63946" }}></i>
                              <div>
                                <small className="text-muted d-block">Filtered Students</small>
                                <strong style={{ color: "#1a1a2e", fontSize: "0.9rem" }}>
                                  {filteredStudents.length}
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="d-flex align-items-center gap-2">
                              <i className="bi bi-clipboard-data" style={{ color: "#e63946" }}></i>
                              <div>
                                <small className="text-muted d-block">Data Rows</small>
                                <strong style={{ color: "#1a1a2e", fontSize: "0.9rem" }}>
                                  {pivotedProctoringData.rows.length} students ({proctoringData.length} records)
                                </strong>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="d-flex align-items-center gap-2">
                              <i className="bi bi-building" style={{ color: "#e63946" }}></i>
                              <div>
                                <small className="text-muted d-block">Institute</small>
                                <strong style={{ color: "#1a1a2e", fontSize: "0.9rem" }}>
                                  {getSelectedInstituteName()}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proctoring Table */}
                  <div className="mb-3">
                    <h6 className="mb-3" style={{ color: "#1a1a2e", fontWeight: 600 }}>
                      <i className="bi bi-table me-2"></i>
                      Proctoring Data Preview
                    </h6>

                    {proctoringLoading ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-danger" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3 text-muted">
                          Loading proctoring data for all students... This may take a moment.
                        </p>
                      </div>
                    ) : proctoringError ? (
                      <div className="alert alert-danger" style={{ borderRadius: "10px" }}>
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {proctoringError}
                      </div>
                    ) : proctoringData.length === 0 ? (
                      <div className="alert alert-info" style={{ borderRadius: "10px" }}>
                        <i className="bi bi-info-circle me-2"></i>
                        No proctoring data found for the filtered students.
                      </div>
                    ) : (
                      <div
                        className="table-responsive"
                        style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}
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
                              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#1a1a2e", width: "60px" }}>S.No</th>
                              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#1a1a2e", width: "160px" }}>Student Name</th>
                              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#1a1a2e", width: "80px" }}>User ID</th>
                              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#1a1a2e", width: "160px" }}>Assessment</th>
                              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#1a1a2e", width: "200px" }}>Question</th>
                              {proctoringColumns.slice(0, 4).map((col) => (
                                <th key={col} style={{ padding: "12px 16px", fontWeight: 600, color: "#1a1a2e", minWidth: "120px" }}>
                                  {col}
                                </th>
                              ))}
                              {proctoringColumns.length > 4 && (
                                <th style={{ padding: "12px 16px", fontWeight: 600, color: "#999", fontStyle: "italic" }}>
                                  +{proctoringColumns.length - 4} more
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {proctoringData.slice(0, 50).map((row, index) => (
                              <tr key={index}>
                                <td style={{ padding: "12px 16px" }}>
                                  <span className="badge bg-light text-dark" style={{ fontSize: "0.85rem" }}>{index + 1}</span>
                                </td>
                                <td style={{ padding: "12px 16px", color: "#333", fontWeight: 500 }}>
                                  {row.studentName || "N/A"}
                                </td>
                                <td style={{ padding: "12px 16px", color: "#333" }}>
                                  #{row.userStudentId || "N/A"}
                                </td>
                                <td style={{ padding: "12px 16px", color: "#333" }}>
                                  <span className="badge" style={{ background: "rgba(230, 57, 70, 0.1)", color: "#e63946", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem" }}>
                                    {row.assessmentName || "N/A"}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", color: "#333", maxWidth: "200px" }} title={row.questionText}>
                                  {row.questionText ? (row.questionText.length > 30 ? row.questionText.substring(0, 30) + "..." : row.questionText) : "N/A"}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span className="badge" style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", padding: "6px 12px", borderRadius: "6px", fontWeight: 500, fontSize: "0.85rem" }}>
                                    {row.timeSpentMs ?? "-"}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px" }}>{row.mouseClickCount ?? "-"}</td>
                                <td style={{ padding: "12px 16px" }}>{row.maxFacesDetected ?? "-"}</td>
                                <td style={{ padding: "12px 16px" }}>{row.avgFacesDetected ?? "-"}</td>
                                {proctoringColumns.length > 4 && (
                                  <td style={{ padding: "12px 16px", color: "#999", fontSize: "0.8rem" }}>...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {proctoringData.length > 50 && (
                          <div
                            className="text-center py-3"
                            style={{ background: "#f8f9fa", borderTop: "1px solid #e0e0e0", color: "#666", fontSize: "0.9rem" }}
                          >
                            <i className="bi bi-info-circle me-2"></i>
                            Showing first 50 of {proctoringData.length} rows. All rows will be included in the Excel download.
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
                      setShowProctoringModal(false);
                      setProctoringData([]);
                      setProctoringError("");
                    }}
                    disabled={proctoringDownloading}
                    style={{ borderRadius: "10px", padding: "0.6rem 1.5rem", fontWeight: 600 }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleProctoringDownloadExcel}
                    disabled={proctoringDownloading || proctoringLoading || proctoringData.length === 0}
                    style={{
                      background: "linear-gradient(135deg, #e63946 0%, #a4133c 100%)",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.5rem",
                      fontWeight: 600,
                    }}
                  >
                    {proctoringDownloading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-download me-2"></i>
                        Download Excel ({proctoringData.length} records)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
                setResetStudent(null);
                setResetAssessmentId(null);
                setResetAssessmentName("");
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
                          setResetStudent(null);
                          setResetAssessmentId(null);
                          setResetAssessmentName("");
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
    </div>
  );
}