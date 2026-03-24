import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

interface MqtTotal {
  mqtId: number;
  mqtName: string;
  mqId: number | null;
  mqName: string | null;
  calculatedTotal: number;
}

interface StoredScore {
  mqtId: number;
  mqtName: string;
  mqId: number | null;
  mqName: string | null;
  storedRawScore: number;
}

interface AnswerRow {
  qqId: number | null;
  questionId: number | null;
  questionText: string;
  sectionName: string;
  optionId: number | null;
  optionText: string | null;
  rankOrder: number | null;
  textResponse: string | null;
  mqtId: number | null;
  mqtName: string | null;
  mqId: number | null;
  mqName: string | null;
  score: number;
}

interface DebugData {
  userStudentId: number;
  assessmentId: number;
  studentName: string;
  assessmentName: string;
  totalAnswers: number;
  answerDetails: AnswerRow[];
  calculatedTotals: MqtTotal[];
  storedRawScores: StoredScore[];
}

interface Institute {
  id: number;
  name: string;
}

interface Student {
  userStudentId: number;
  studentInfo?: { name: string; studentClass?: number };
  userId?: { name: string };
}

interface Assessment {
  id: number;
  assessmentName: string;
}

const ScoreDebugPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [selectedStudent, setSelectedStudent] = useState<number | "">("");
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [filterMqt, setFilterMqt] = useState<string>("");
  const [filterSection, setFilterSection] = useState<string>("");
  const [filterQuestion, setFilterQuestion] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"details" | "totals" | "firebase">("totals");
  const [firebaseScores, setFirebaseScores] = useState<Record<string, Record<string, number>> | null>(null);
  const [loadingFirebase, setLoadingFirebase] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/instituteDetail/get/list`).then((res) => {
      setInstitutes(
        res.data.map((i: any) => ({
          id: i.instituteCode || i.id,
          name: i.instituteName || i.name,
        }))
      );
    });
    axios.get(`${API_URL}/assessments/get/list`).then((res) => {
      setAssessments(res.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedInstitute) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    setSelectedStudent("");
    setDebugData(null);
    axios
      .get(
        `${API_URL}/firebase-mapping/students-by-institute/${selectedInstitute}`
      )
      .then((res) => {
        setStudents(res.data || []);
      })
      .catch(() => {
        // Fallback: try getting user students by institute
        axios
          .get(`${API_URL}/student/get`)
          .then((res2) => {
            const filtered = (res2.data || []).filter(
              (s: any) =>
                s.institute?.instituteCode === selectedInstitute ||
                s.studentInfo?.instituteId === selectedInstitute
            );
            setStudents(filtered);
          })
          .catch(() => setStudents([]));
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedInstitute]);

  const fetchDebug = () => {
    if (!selectedStudent || !selectedAssessment) return;
    setLoading(true);
    setDebugData(null);
    setFirebaseScores(null);
    axios
      .get(
        `${API_URL}/assessment-answer/score-debug/${selectedStudent}/${selectedAssessment}`,
        { headers: { Accept: "application/json" } }
      )
      .then((res) => setDebugData(res.data))
      .catch((err) => alert("Error: " + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));

    // Also fetch Firebase scores
    setLoadingFirebase(true);
    axios
      .get(`${API_URL}/firebase-mapping/firebase-scores/${selectedStudent}`)
      .then((res) => {
        setFirebaseScores({
          ability: res.data.abilityScores || {},
          multipleIntelligence: res.data.multipleIntelligenceScores || {},
          personality: res.data.personalityScores || {},
        });
      })
      .catch(() => setFirebaseScores(null))
      .finally(() => setLoadingFirebase(false));
  };

  // Build comparison table
  const comparisonRows = useMemo(() => {
    if (!debugData) return [];
    const map = new Map<
      number,
      { mqtId: number; mqtName: string; mqName: string; calculated: number; stored: number }
    >();
    for (const t of debugData.calculatedTotals) {
      map.set(t.mqtId, {
        mqtId: t.mqtId,
        mqtName: t.mqtName,
        mqName: t.mqName || "",
        calculated: t.calculatedTotal,
        stored: 0,
      });
    }
    for (const s of debugData.storedRawScores) {
      if (map.has(s.mqtId)) {
        map.get(s.mqtId)!.stored = s.storedRawScore;
      } else {
        map.set(s.mqtId, {
          mqtId: s.mqtId,
          mqtName: s.mqtName,
          mqName: s.mqName || "",
          calculated: 0,
          stored: s.storedRawScore,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.mqtName.localeCompare(b.mqtName));
  }, [debugData]);

  // Unique sections and MQTs for filter dropdowns
  const uniqueSections = useMemo(() => {
    if (!debugData) return [];
    return Array.from(new Set(debugData.answerDetails.map((r) => r.sectionName).filter(Boolean))).sort();
  }, [debugData]);

  const uniqueMqts = useMemo(() => {
    if (!debugData) return [];
    return Array.from(new Set(debugData.answerDetails.map((r) => r.mqtName).filter(Boolean))).sort() as string[];
  }, [debugData]);

  // Filter answer details
  const filteredRows = useMemo(() => {
    if (!debugData) return [];
    return debugData.answerDetails.filter((r) => {
      if (filterMqt && r.mqtName !== filterMqt) return false;
      if (filterSection && r.sectionName !== filterSection) return false;
      if (filterQuestion && !r.questionText?.toLowerCase().includes(filterQuestion.toLowerCase()))
        return false;
      return true;
    });
  }, [debugData, filterMqt, filterSection, filterQuestion]);

  const mismatches = comparisonRows.filter((r) => r.calculated !== r.stored);

  // Build Firebase vs Our System comparison
  const firebaseComparison = useMemo(() => {
    if (!firebaseScores || !debugData) return [];

    // Name mappings: Firebase name → our MQT name
    const nameMap: Record<string, string> = {
      // Ability
      "Decision making & problem solving": "Decision making & problem solving",
      "Computational": "Computational",
      "Form perception": "Form perception",
      "Motor movement": "Motor movement",
      "Speed and accuracy": "Speed and accuracy",
      "Finger dexterity": "Finger dexterity",
      "Logical reasoning": "Logical reasoning",
      "Technical": "Technical",
      "Creativity / Artistic": "Creativity / Artistic",
      "Language/ Communication": "Language/ Communication",
      // MI
      "Interpersonal": "Interpersonal",
      "Intrapersonal": "Intrapersonal",
      "Linguistic": "Linguistic",
      "Musical": "Musical",
      "Naturalistic": "Naturalistic",
      "Logical-Mathematical": "Logical",
      "Bodily-Kinesthetic": "Bodily-Kinesthetic",
      "Spatial-Visual": "Spatial-Visual",
      // Personality (RIASEC)
      "R": "Doer",
      "I": "Thinker",
      "A": "Creator",
      "S": "Helper",
      "E": "Persuader",
      "C": "Organizer",
    };

    // Build our scores map by MQT name
    const ourScoresMap = new Map<string, number>();
    for (const t of debugData.calculatedTotals) {
      ourScoresMap.set(t.mqtName, t.calculatedTotal);
    }

    const rows: Array<{
      category: string;
      firebaseName: string;
      firebaseScore: number;
      ourName: string;
      ourScore: number | null;
      diff: number | null;
    }> = [];

    const categories: Array<{ key: string; label: string }> = [
      { key: "ability", label: "Ability" },
      { key: "multipleIntelligence", label: "Multiple Intelligence" },
      { key: "personality", label: "Personality" },
    ];

    for (const cat of categories) {
      const scores = firebaseScores[cat.key] || {};
      for (const [fbName, fbScore] of Object.entries(scores)) {
        const ourName = nameMap[fbName] || fbName;
        const ourScore = ourScoresMap.has(ourName) ? ourScoresMap.get(ourName)! : null;
        rows.push({
          category: cat.label,
          firebaseName: fbName,
          firebaseScore: fbScore as number,
          ourName,
          ourScore,
          diff: ourScore !== null ? (fbScore as number) - ourScore : null,
        });
      }
    }

    // Also add MQTs in our system that don't appear in Firebase
    const fbOurNames = new Set(rows.map((r) => r.ourName));
    for (const t of debugData.calculatedTotals) {
      if (!fbOurNames.has(t.mqtName)) {
        rows.push({
          category: "Our System Only",
          firebaseName: "—",
          firebaseScore: 0,
          ourName: t.mqtName,
          ourScore: t.calculatedTotal,
          diff: null,
        });
      }
    }

    return rows;
  }, [firebaseScores, debugData]);

  const firebaseMismatches = firebaseComparison.filter((r) => r.diff !== null && r.diff !== 0);

  return (
    <div className="card">
      <div className="card-header border-0 pt-5">
        <h3 className="card-title fw-bold">Score Debug & Backtracing</h3>
      </div>
      <div className="card-body">
        {/* Selectors */}
        <div className="row g-3 mb-5">
          <div className="col-md-3">
            <label className="form-label fw-semibold">Institute</label>
            <select
              className="form-select"
              value={selectedInstitute}
              onChange={(e) => setSelectedInstitute(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select Institute</option>
              {institutes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label fw-semibold">Student</label>
            <select
              className="form-select"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value ? Number(e.target.value) : "")}
              disabled={!selectedInstitute || loadingStudents}
            >
              <option value="">
                {loadingStudents ? "Loading..." : "Select Student"}
              </option>
              {students.map((s) => (
                <option key={s.userStudentId} value={s.userStudentId}>
                  {s.studentInfo?.name || s.userId?.name || `ID: ${s.userStudentId}`}
                  {s.studentInfo?.studentClass ? ` (Class ${s.studentInfo.studentClass})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label fw-semibold">Assessment</label>
            <select
              className="form-select"
              value={selectedAssessment}
              onChange={(e) => setSelectedAssessment(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select Assessment</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assessmentName}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button
              className="btn btn-primary w-100"
              onClick={fetchDebug}
              disabled={!selectedStudent || !selectedAssessment || loading}
            >
              {loading ? "Loading..." : "Fetch Score Breakdown"}
            </button>
          </div>
        </div>

        {debugData && (
          <>
            {/* Summary */}
            <div className="row g-3 mb-5">
              <div className="col-md-3">
                <div className="bg-light-primary rounded p-4 text-center">
                  <div className="text-gray-700 fw-semibold fs-7">Student</div>
                  <div className="fw-bold fs-5 text-primary">{debugData.studentName || "N/A"}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="bg-light-info rounded p-4 text-center">
                  <div className="text-gray-700 fw-semibold fs-7">Assessment</div>
                  <div className="fw-bold fs-5 text-info">{debugData.assessmentName}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="bg-light-success rounded p-4 text-center">
                  <div className="text-gray-700 fw-semibold fs-7">Total Answers</div>
                  <div className="fw-bold fs-3 text-success">{debugData.totalAnswers}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="bg-light-warning rounded p-4 text-center">
                  <div className="text-gray-700 fw-semibold fs-7">MQT Types</div>
                  <div className="fw-bold fs-3 text-warning">{comparisonRows.length}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div
                  className={`rounded p-4 text-center ${
                    mismatches.length > 0 ? "bg-light-danger" : "bg-light-success"
                  }`}
                >
                  <div className="text-gray-700 fw-semibold fs-7">Mismatches</div>
                  <div
                    className={`fw-bold fs-3 ${
                      mismatches.length > 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {mismatches.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <ul className="nav nav-tabs nav-line-tabs mb-5">
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "totals" ? "active" : ""}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("totals");
                  }}
                >
                  MQT Totals & Comparison
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "details" ? "active" : ""}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("details");
                  }}
                >
                  Per-Answer Breakdown ({debugData.answerDetails.length} rows)
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "firebase" ? "active" : ""}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("firebase");
                  }}
                >
                  Firebase vs Our Scores
                  {firebaseMismatches.length > 0 && (
                    <span className="badge badge-danger ms-2">{firebaseMismatches.length}</span>
                  )}
                </a>
              </li>
            </ul>

            {/* Totals Tab */}
            {activeTab === "totals" && (
              <div className="table-responsive">
                <table className="table table-bordered table-hover table-sm align-middle">
                  <thead className="table-primary">
                    <tr>
                      <th>MQT ID</th>
                      <th>MQT Name</th>
                      <th>MQ (Parent)</th>
                      <th className="text-center">Calculated from Answers</th>
                      <th className="text-center">Stored Raw Score</th>
                      <th className="text-center">Diff</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((r) => {
                      const diff = r.calculated - r.stored;
                      const match = diff === 0;
                      return (
                        <tr key={r.mqtId} className={!match ? "table-danger" : ""}>
                          <td>{r.mqtId}</td>
                          <td className="fw-semibold">{r.mqtName}</td>
                          <td className="text-muted">{r.mqName}</td>
                          <td className="text-center fw-bold">{r.calculated}</td>
                          <td className="text-center fw-bold">{r.stored}</td>
                          <td className="text-center">
                            {diff !== 0 && (
                              <span className={`badge ${diff > 0 ? "badge-warning" : "badge-info"}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            {match ? (
                              <span className="badge badge-light-success">OK</span>
                            ) : (
                              <span className="badge badge-light-danger">MISMATCH</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {comparisonRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-5">
                          No score data found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Details Tab */}
            {activeTab === "details" && (
              <>
                {/* Filters */}
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <input
                      className="form-control form-control-sm"
                      placeholder="Search question text..."
                      value={filterQuestion}
                      onChange={(e) => setFilterQuestion(e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                    >
                      <option value="">All Sections</option>
                      {uniqueSections.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={filterMqt}
                      onChange={(e) => setFilterMqt(e.target.value)}
                    >
                      <option value="">All MQTs</option>
                      {uniqueMqts.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3 text-muted small pt-2">
                    Showing {filteredRows.length} of {debugData.answerDetails.length} rows
                  </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
                  <table className="table table-bordered table-hover table-sm align-middle">
                    <thead className="table-primary" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th>#</th>
                        <th>Section</th>
                        <th>Question</th>
                        <th>Selected Option</th>
                        <th>Text Response</th>
                        <th>MQT</th>
                        <th>MQ (Parent)</th>
                        <th className="text-center">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r, i) => (
                        <tr key={i}>
                          <td className="text-muted">{i + 1}</td>
                          <td>
                            <small className="text-muted">{r.sectionName}</small>
                          </td>
                          <td style={{ maxWidth: 250 }}>
                            <small>{r.questionText}</small>
                            <br />
                            <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                              qId:{r.questionId} qqId:{r.qqId}
                            </span>
                          </td>
                          <td style={{ maxWidth: 200 }}>
                            <small>{r.optionText || "—"}</small>
                            <br />
                            <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                              optId:{r.optionId}
                            </span>
                          </td>
                          <td style={{ maxWidth: 150 }}>
                            <small className="text-muted">
                              {r.textResponse ? r.textResponse.substring(0, 40) : "—"}
                            </small>
                          </td>
                          <td>
                            {r.mqtName ? (
                              <span className="badge badge-light-primary">{r.mqtName}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <small className="text-muted">{r.mqName || "—"}</small>
                          </td>
                          <td className="text-center fw-bold">{r.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Firebase vs Our Scores Tab */}
            {activeTab === "firebase" && (
              <>
                {loadingFirebase ? (
                  <div className="text-center py-10 text-muted">Loading Firebase scores...</div>
                ) : !firebaseScores ? (
                  <div className="text-center py-10">
                    <div className="text-muted mb-3">
                      No Firebase mapping found for this student.
                    </div>
                    <small className="text-gray-500">
                      This student may not have been imported from Firebase.
                    </small>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover table-sm align-middle">
                      <thead className="table-primary">
                        <tr>
                          <th>Category</th>
                          <th>Firebase Name</th>
                          <th className="text-center">Firebase Score (Old)</th>
                          <th>Our MQT Name</th>
                          <th className="text-center">Our Score (Calculated)</th>
                          <th className="text-center">Diff</th>
                          <th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {firebaseComparison.map((r, i) => {
                          const match = r.diff === null || r.diff === 0;
                          return (
                            <tr key={i} className={!match ? "table-danger" : ""}>
                              <td>
                                <span className={`badge badge-light-${
                                  r.category === "Ability" ? "info" :
                                  r.category === "Multiple Intelligence" ? "success" :
                                  r.category === "Personality" ? "warning" : "secondary"
                                }`}>
                                  {r.category}
                                </span>
                              </td>
                              <td className="fw-semibold">{r.firebaseName}</td>
                              <td className="text-center fw-bold">{r.firebaseScore}</td>
                              <td>
                                {r.ourScore !== null ? (
                                  r.ourName
                                ) : (
                                  <span className="text-muted fst-italic">{r.ourName} (no match)</span>
                                )}
                              </td>
                              <td className="text-center fw-bold">
                                {r.ourScore !== null ? r.ourScore : "—"}
                              </td>
                              <td className="text-center">
                                {r.diff !== null && r.diff !== 0 && (
                                  <span className={`badge ${r.diff > 0 ? "badge-warning" : "badge-info"}`}>
                                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                                  </span>
                                )}
                              </td>
                              <td className="text-center">
                                {r.ourScore === null ? (
                                  <span className="badge badge-light-secondary">UNMAPPED</span>
                                ) : match ? (
                                  <span className="badge badge-light-success">OK</span>
                                ) : (
                                  <span className="badge badge-light-danger">MISMATCH</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {firebaseComparison.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-muted py-5">
                              No score data to compare
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Summary */}
                    {firebaseComparison.length > 0 && (
                      <div className="d-flex gap-4 mt-3">
                        <span className="badge badge-light-success p-3">
                          Matched: {firebaseComparison.filter((r) => r.diff === 0).length}
                        </span>
                        <span className="badge badge-light-danger p-3">
                          Mismatched: {firebaseMismatches.length}
                        </span>
                        <span className="badge badge-light-secondary p-3">
                          Unmapped: {firebaseComparison.filter((r) => r.ourScore === null).length}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScoreDebugPage;
