import React, { useState, useEffect } from "react";
import axios from "axios";
import { ReadCollegeData } from "../College/API/College_APIs";
import {
  getStudentsWithMappingByInstituteId,
  getAllAssessments,
  bulkAlotAssessment,
  Assessment,
  getStudentAnswersWithDetails,
  StudentAnswerDetail,
  resetAssessment,
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
  assessments?: StudentAssessmentInfo[];
  assignedAssessmentIds: number[];
};

type StudentAssessmentInfo = {
  assessmentId: number;
  assessmentName: string;
  status: string;
};

export default function GroupStudentPage() {
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

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [resetAssessmentId, setResetAssessmentId] = useState<number | null>(null);
  const [resetAssessmentName, setResetAssessmentName] = useState<string>("");
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
        Section: answer.sectionName || "",
        "Excel Header": answer.excelQuestionHeader || "",
        Question: answer.questionText,
        "Selected Answer": answer.optionText,
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 }, // S.No
        { wch: 25 }, // Section
        { wch: 30 }, // Excel Header
        { wch: 60 }, // Question
        { wch: 30 }, // Selected Answer
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

    // Fetch assessments
    getAllAssessments()
      .then((response) => {
        setAssessments(response.data);
      })
      .catch((error) => {
        console.error("Error fetching assessments:", error);
      });
  }, []);

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

  const filteredStudents = students.filter((s) => {
    return (
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.schoolRollNumber.toLowerCase().includes(query.toLowerCase()) ||
      s.userStudentId.toString().includes(query)
    );
  });

  const getSelectedInstituteName = () => {
    const institute = institutes.find(
      (inst) => inst.instituteCode === selectedInstitute
    );
    return institute?.instituteName || "";
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
    // Use pre-loaded assessments from the student object
    setStudentAssessments(student.assessments || []);
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
                </div>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "16px" }}
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
                  <table className="table align-middle mb-0">
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
                              View ({student.assessments?.length || 0})
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
                      <div className="d-flex gap-2">
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
                                Section
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
                                  width: "250px",
                                }}
                              >
                                Selected Answer
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