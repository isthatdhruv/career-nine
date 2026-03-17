import { useEffect, useState, useMemo } from "react";
import {
  getAllInstitutes,
  getStudentsByInstitute,
  fetchFirebaseUserData,
  getAllAssessmentQuestions,
} from "./API/OldDataMapping_APIs";

// ── Types ────────────────────────────────────────────────────────────────

interface DBStudent {
  userStudentId: number;
  name: string;
  email: string;
  phone: string;
  grade: string;
  firebaseDocId: string | null;
}

interface FirebaseResponse {
  question: string;
  selectedOption?: string;
  selectedAnswer?: string;
  answer?: string;
  selected?: string;
  [key: string]: any;
}

interface Institute {
  instituteCode: number;
  instituteName: string;
}

interface SystemOption {
  optionId: number;
  optionText: string;
  optionDescription?: string;
}

interface SystemQuestion {
  questionId: number;
  questionText: string;
  questionType?: string;
  options?: SystemOption[];
  section?: { sectionId: number; sectionName: string } | null;
}

interface QuestionMapping {
  firebaseQuestion: string;
  firebaseAnswer: string;
  systemQuestionId: number | null;
  systemQuestionText: string;
  systemOptionId: number | null;
  systemOptionText: string;
  category: string;
}

interface Props {
  onBack: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

const QuestionMappingWizard = ({ onBack }: Props) => {
  const [step, setStep] = useState<"select-student" | "map-questions">("select-student");

  // Data
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [systemQuestions, setSystemQuestions] = useState<SystemQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // School selection
  const [selectedInstituteCode, setSelectedInstituteCode] = useState<number | null>(null);
  const [instituteSearch, setInstituteSearch] = useState("");

  // Student list (from DB)
  const [students, setStudents] = useState<DBStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Selected student + firebase data
  const [selectedStudent, setSelectedStudent] = useState<DBStudent | null>(null);
  const [firebaseData, setFirebaseData] = useState<any>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(false);

  // Mapping state
  const [mappings, setMappings] = useState<QuestionMapping[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("ability");
  const [questionSearchSystem, setQuestionSearchSystem] = useState("");

  // Fetch institutes + system questions on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAllInstitutes(),
      getAllAssessmentQuestions(),
    ])
      .then(([instRes, questionsRes]) => {
        const instList = (instRes.data || []).map((i: any) => ({
          instituteCode: Number(i.instituteCode ?? i.id),
          instituteName: i.instituteName ?? i.name ?? "",
        })).sort((a: Institute, b: Institute) => a.instituteName.localeCompare(b.instituteName));
        setInstitutes(instList);
        setSystemQuestions(questionsRes.data || []);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch students when institute changes
  useEffect(() => {
    if (!selectedInstituteCode) {
      setStudents([]);
      return;
    }
    setStudentsLoading(true);
    getStudentsByInstitute(selectedInstituteCode)
      .then((res) => setStudents(res.data || []))
      .catch(() => setError("Failed to load students"))
      .finally(() => setStudentsLoading(false));
  }, [selectedInstituteCode]);

  const filteredInstitutes = useMemo(() => {
    if (!instituteSearch.trim()) return institutes;
    return institutes.filter((i) =>
      i.instituteName.toLowerCase().includes(instituteSearch.toLowerCase())
    );
  }, [institutes, instituteSearch]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const term = studentSearch.toLowerCase();
    return students.filter((s) =>
      (s.name || "").toLowerCase().includes(term) ||
      (s.email || "").toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  // When a student is selected, fetch their Firebase data
  const handleSelectStudent = async (student: DBStudent) => {
    if (!student.firebaseDocId) {
      setError("This student has no linked Firebase data.");
      return;
    }
    setSelectedStudent(student);
    setFirebaseLoading(true);
    setError("");

    try {
      // Fetch all firebase users and find this student
      const res = await fetchFirebaseUserData();
      const users = res.data?.users || res.data || [];
      const fbUser = users.find((u: any) => u.docId === student.firebaseDocId);

      if (!fbUser) {
        setError("Firebase data not found for this student.");
        setFirebaseLoading(false);
        return;
      }

      setFirebaseData(fbUser);

      // Build mappings from responses
      const newMappings: QuestionMapping[] = [];
      const addResponses = (responses: FirebaseResponse[] | undefined, category: string) => {
        if (!responses || !Array.isArray(responses)) return;
        responses.forEach((r) => {
          const answer = r.selectedOption || r.selectedAnswer || r.answer || r.selected || "";
          newMappings.push({
            firebaseQuestion: r.question || "",
            firebaseAnswer: answer,
            systemQuestionId: null,
            systemQuestionText: "",
            systemOptionId: null,
            systemOptionText: "",
            category,
          });
        });
      };

      addResponses(fbUser.abilityDetailedResponses, "ability");
      addResponses(fbUser.multipleIntelligenceResponses, "multipleIntelligence");
      addResponses(fbUser.personalityDetailedResponses, "personality");

      setMappings(newMappings);
      setActiveCategory(newMappings.length > 0 ? newMappings[0].category : "ability");
      setStep("map-questions");
    } catch (err) {
      setError("Failed to fetch Firebase data.");
    } finally {
      setFirebaseLoading(false);
    }
  };

  // Filtered system questions
  const filteredSystemQuestions = useMemo(() => {
    if (!questionSearchSystem.trim()) return systemQuestions;
    const term = questionSearchSystem.toLowerCase();
    return systemQuestions.filter((q) =>
      (q.questionText || "").toLowerCase().includes(term)
    );
  }, [systemQuestions, questionSearchSystem]);

  // Category mappings
  const categoryMappings = useMemo(() => {
    return mappings.filter((m) => m.category === activeCategory);
  }, [mappings, activeCategory]);

  const categoryLabels: Record<string, string> = {
    ability: "Ability",
    multipleIntelligence: "Multiple Intelligence",
    personality: "Personality",
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; mapped: number }> = {};
    mappings.forEach((m) => {
      if (!counts[m.category]) counts[m.category] = { total: 0, mapped: 0 };
      counts[m.category].total++;
      if (m.systemQuestionId) counts[m.category].mapped++;
    });
    return counts;
  }, [mappings]);

  // Map handlers
  const handleMapQuestion = (fbIndex: number, sysQuestion: SystemQuestion) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      updated[fbIndex] = {
        ...updated[fbIndex],
        systemQuestionId: sysQuestion.questionId,
        systemQuestionText: sysQuestion.questionText,
        systemOptionId: null,
        systemOptionText: "",
      };
      return [...otherMappings, ...updated];
    });
  };

  const handleMapOption = (fbIndex: number, option: SystemOption) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      updated[fbIndex] = {
        ...updated[fbIndex],
        systemOptionId: option.optionId,
        systemOptionText: option.optionText,
      };
      return [...otherMappings, ...updated];
    });
  };

  const handleClearMapping = (fbIndex: number) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      updated[fbIndex] = {
        ...updated[fbIndex],
        systemQuestionId: null,
        systemQuestionText: "",
        systemOptionId: null,
        systemOptionText: "",
      };
      return [...otherMappings, ...updated];
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container mt-8 text-center py-10">
        <span className="spinner-border spinner-border-sm me-2" />
        Loading data...
      </div>
    );
  }

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-11">
          {/* Header */}
          <div className="d-flex align-items-center mb-6">
            <button
              className="btn btn-light-primary btn-sm me-4"
              onClick={() => {
                if (step === "map-questions") {
                  setStep("select-student");
                  setSelectedStudent(null);
                  setFirebaseData(null);
                  setMappings([]);
                } else {
                  onBack();
                }
              }}
            >
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
            <h2 className="fw-bold text-dark mb-0">Question & Response Mapping</h2>
          </div>

          {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

          {/* ── Step 1: Select Student ──────────────────────────────── */}
          {step === "select-student" && (
            <div className="row g-4">
              {/* School selection */}
              <div className="col-12 col-md-4">
                <div className="card shadow-sm h-100">
                  <div className="card-header bg-light py-3">
                    <h6 className="fw-bold mb-0">
                      <i className="bi bi-building me-2"></i>Select School
                    </h6>
                  </div>
                  <div className="card-body p-0">
                    <div className="p-3 border-bottom">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search schools..."
                        value={instituteSearch}
                        onChange={(e) => setInstituteSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ maxHeight: 500, overflowY: "auto" }}>
                      {filteredInstitutes.map((inst) => (
                        <div
                          key={inst.instituteCode}
                          className={`px-4 py-3 border-bottom d-flex align-items-center justify-content-between ${
                            selectedInstituteCode === inst.instituteCode ? "bg-light-primary" : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedInstituteCode(inst.instituteCode);
                            setStudentSearch("");
                          }}
                          onMouseOver={(e) => {
                            if (selectedInstituteCode !== inst.instituteCode)
                              e.currentTarget.style.backgroundColor = "#f5f8fa";
                          }}
                          onMouseOut={(e) => {
                            if (selectedInstituteCode !== inst.instituteCode)
                              e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <span className="fs-7 fw-semibold text-truncate">{inst.instituteName}</span>
                          {selectedInstituteCode === inst.instituteCode && (
                            <i className="bi bi-check-circle-fill text-primary"></i>
                          )}
                        </div>
                      ))}
                      {filteredInstitutes.length === 0 && (
                        <div className="text-muted text-center py-6 fs-7">No schools found</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Student list */}
              <div className="col-12 col-md-8">
                <div className="card shadow-sm h-100">
                  <div className="card-header bg-light py-3 d-flex align-items-center justify-content-between">
                    <h6 className="fw-bold mb-0">
                      <i className="bi bi-person-lines-fill me-2"></i>
                      Students
                      {selectedInstituteCode && !studentsLoading && (
                        <span className="badge badge-light-primary ms-2 fs-9">
                          {students.length} found
                        </span>
                      )}
                    </h6>
                  </div>
                  <div className="card-body p-0">
                    {!selectedInstituteCode ? (
                      <div className="text-center text-muted py-10 fs-7">
                        <i className="bi bi-arrow-left-circle fs-2x d-block mb-3 text-muted"></i>
                        Select a school to see its students
                      </div>
                    ) : studentsLoading ? (
                      <div className="text-center py-10">
                        <span className="spinner-border spinner-border-sm me-2" />
                        Loading students...
                      </div>
                    ) : (
                      <>
                        <div className="p-3 border-bottom">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Search by name or email..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                          />
                        </div>
                        <div style={{ maxHeight: 500, overflowY: "auto" }}>
                          {filteredStudents.length === 0 ? (
                            <div className="text-center text-muted py-6 fs-7">
                              No students found
                            </div>
                          ) : (
                            filteredStudents.map((student) => (
                              <div
                                key={student.userStudentId}
                                className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between"
                                style={{ cursor: student.firebaseDocId ? "pointer" : "default", opacity: student.firebaseDocId ? 1 : 0.5 }}
                                onClick={() => student.firebaseDocId && handleSelectStudent(student)}
                                onMouseOver={(e) => {
                                  if (student.firebaseDocId) e.currentTarget.style.backgroundColor = "#f5f8fa";
                                }}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <div>
                                  <span className="fw-semibold fs-7 d-block">
                                    {student.name || "Unnamed"}
                                  </span>
                                  <span className="text-muted fs-8">
                                    {student.email || "—"}
                                  </span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <span className="badge badge-light fs-9">#{student.userStudentId}</span>
                                  {student.grade && (
                                    <span className="badge badge-light fs-9">Grade {student.grade}</span>
                                  )}
                                  {student.firebaseDocId ? (
                                    <span className="badge badge-light-success fs-9">Firebase linked</span>
                                  ) : (
                                    <span className="badge badge-light-warning fs-9">No Firebase</span>
                                  )}
                                  {student.firebaseDocId && (
                                    <i className="bi bi-chevron-right text-muted fs-8"></i>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading firebase data */}
          {firebaseLoading && (
            <div className="text-center py-10">
              <span className="spinner-border spinner-border-sm me-2" />
              Fetching Firebase data for {selectedStudent?.name}...
            </div>
          )}

          {/* ── Step 2: Map Questions ──────────────────────────────── */}
          {step === "map-questions" && selectedStudent && !firebaseLoading && (
            <div>
              {/* Student info bar */}
              <div className="card shadow-sm mb-4">
                <div className="card-body py-3 d-flex align-items-center gap-4">
                  <div className="symbol symbol-45px bg-light-primary rounded-circle">
                    <span className="symbol-label fw-bold text-primary fs-5">
                      {(selectedStudent.name || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="fw-bold fs-6">{selectedStudent.name || "Unnamed"}</div>
                    <div className="text-muted fs-8">
                      {selectedStudent.email || "—"} | Grade {selectedStudent.grade || "?"} | ID #{selectedStudent.userStudentId}
                    </div>
                  </div>
                  <div className="ms-auto d-flex gap-2">
                    {Object.entries(categoryCounts).map(([cat, counts]) => (
                      <span key={cat} className="badge badge-light fs-9">
                        {categoryLabels[cat] || cat}: {counts.mapped}/{counts.total}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category tabs */}
              <div className="d-flex gap-2 mb-4">
                {Object.entries(categoryLabels).map(([key, label]) => {
                  const counts = categoryCounts[key];
                  if (!counts) return null;
                  return (
                    <button
                      key={key}
                      className={`btn btn-sm ${activeCategory === key ? "btn-primary" : "btn-light"}`}
                      onClick={() => { setActiveCategory(key); setQuestionSearchSystem(""); }}
                    >
                      {label}
                      <span className={`badge ms-2 ${activeCategory === key ? "badge-light" : "badge-light-primary"} fs-9`}>
                        {counts.mapped}/{counts.total}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mapping cards */}
              <div className="card shadow-sm">
                <div className="card-body p-0">
                  <div style={{ maxHeight: 600, overflowY: "auto" }}>
                    {categoryMappings.length === 0 ? (
                      <div className="text-center text-muted py-10 fs-7">
                        No responses in this category
                      </div>
                    ) : (
                      categoryMappings.map((mapping, idx) => {
                        const mappedSysQuestion = mapping.systemQuestionId
                          ? systemQuestions.find((q) => q.questionId === mapping.systemQuestionId)
                          : null;

                        return (
                          <div key={idx} className="border-bottom p-4">
                            <div className="row g-3">
                              {/* Firebase side */}
                              <div className="col-md-5">
                                <div className="fs-9 fw-semibold text-muted mb-1">
                                  <i className="bi bi-cloud me-1"></i>FIREBASE QUESTION #{idx + 1}
                                </div>
                                <div className="bg-light rounded p-3 mb-2">
                                  <div className="fs-7">{mapping.firebaseQuestion || "—"}</div>
                                </div>
                                <div className="fs-9 fw-semibold text-muted mb-1">STUDENT'S ANSWER</div>
                                <div className="bg-light-warning rounded p-2">
                                  <span className="fs-8 fw-semibold">{mapping.firebaseAnswer || "—"}</span>
                                </div>
                              </div>

                              {/* Arrow */}
                              <div className="col-md-1 d-flex align-items-center justify-content-center">
                                <i className={`bi bi-arrow-right fs-4 ${mapping.systemQuestionId ? "text-success" : "text-muted"}`}></i>
                              </div>

                              {/* System side */}
                              <div className="col-md-6">
                                {mapping.systemQuestionId ? (
                                  <div>
                                    <div className="d-flex align-items-start justify-content-between mb-2">
                                      <div className="fs-9 fw-semibold text-success">
                                        <i className="bi bi-check-circle me-1"></i>MAPPED TO SYSTEM QUESTION
                                      </div>
                                      <button
                                        className="btn btn-sm btn-icon btn-light-danger"
                                        onClick={() => handleClearMapping(idx)}
                                        title="Clear mapping"
                                      >
                                        <i className="bi bi-x fs-7"></i>
                                      </button>
                                    </div>
                                    <div className="bg-light-success rounded p-3 mb-2">
                                      <div className="fs-7">{mapping.systemQuestionText}</div>
                                    </div>

                                    {/* Option mapping */}
                                    <div className="fs-9 fw-semibold text-muted mb-1">MAP ANSWER TO OPTION</div>
                                    <div className="d-flex flex-wrap gap-1">
                                      {mappedSysQuestion?.options?.map((opt) => (
                                        <button
                                          key={opt.optionId}
                                          className={`btn btn-sm ${
                                            mapping.systemOptionId === opt.optionId
                                              ? "btn-success"
                                              : "btn-outline-secondary"
                                          }`}
                                          onClick={() => handleMapOption(idx, opt)}
                                          title={opt.optionDescription || opt.optionText}
                                        >
                                          {opt.optionText}
                                        </button>
                                      )) || (
                                        <span className="text-muted fs-8">No options available</span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="fs-9 fw-semibold text-muted mb-1">
                                      <i className="bi bi-search me-1"></i>SELECT SYSTEM QUESTION
                                    </div>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm mb-2"
                                      placeholder="Search questions..."
                                      value={questionSearchSystem}
                                      onChange={(e) => setQuestionSearchSystem(e.target.value)}
                                    />
                                    <div className="border rounded" style={{ maxHeight: 200, overflowY: "auto" }}>
                                      {filteredSystemQuestions.slice(0, 50).map((sq) => (
                                        <div
                                          key={sq.questionId}
                                          className="px-3 py-2 border-bottom fs-8 d-flex align-items-center justify-content-between"
                                          style={{ cursor: "pointer" }}
                                          onClick={() => handleMapQuestion(idx, sq)}
                                          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f8fa")}
                                          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        >
                                          <span className="text-truncate" style={{ maxWidth: "85%" }}>
                                            {sq.questionText}
                                          </span>
                                          <span className="badge badge-light fs-9">#{sq.questionId}</span>
                                        </div>
                                      ))}
                                      {filteredSystemQuestions.length === 0 && (
                                        <div className="text-muted text-center py-3 fs-8">No questions match</div>
                                      )}
                                      {filteredSystemQuestions.length > 50 && (
                                        <div className="text-muted text-center py-2 fs-9">
                                          Showing 50 of {filteredSystemQuestions.length} — refine search
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionMappingWizard;
