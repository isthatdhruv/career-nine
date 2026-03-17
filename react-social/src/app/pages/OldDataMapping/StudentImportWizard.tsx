import { useState } from "react";
import AssessmentMappingStep from "./steps/AssessmentMappingStep";
import type { StudentAssignment } from "./steps/AssessmentMappingStep";
import ScoreTypeMappingStep from "./steps/ScoreTypeMappingStep";
import StudentImportStep from "./steps/StudentImportStep";

interface ScoreTypeMapping {
  firebaseKey: string;
  category: string;
  measuredQualityTypeId: number | null;
  measuredQualityTypeName: string;
}

interface Props {
  onBack: () => void;
}

const STEPS = [
  { key: "assessment", label: "Student & Assessment Mapping", icon: "bi-clipboard-data" },
  { key: "scoreType", label: "Score Type Mapping", icon: "bi-bar-chart" },
  { key: "import", label: "Import", icon: "bi-people" },
  { key: "done", label: "Done", icon: "bi-check-circle" },
];

// ── Done Screen with clickable detail cards ──────────────────────────────
const DoneScreen = ({ importResults, studentAssignments, onBack }: { importResults: any; studentAssignments: StudentAssignment[]; onBack: () => void }) => {
  const [activePanel, setActivePanel] = useState<"students" | "scores" | "extra" | null>(null);
  const [expandedScoreRow, setExpandedScoreRow] = useState<number | null>(null);

  const studentsCreated = importResults?.studentsCreated || 0;
  const scoresImported = importResults?.scoresImported || 0;
  const extraDataImported = importResults?.extraDataImported || 0;
  const studentsSkipped = importResults?.studentsSkipped || 0;

  // Build details from studentAssignments (always available)
  const scoreDetails: { name: string; category: string; count: number; scores: Record<string, number> }[] = [];
  const extraDetails: { name: string; type: string; value: string }[] = [];

  studentAssignments.forEach((sa) => {
    if (sa.abilityScores && Object.keys(sa.abilityScores).length > 0) {
      scoreDetails.push({ name: sa.name, category: "Ability", count: Object.keys(sa.abilityScores).length, scores: sa.abilityScores });
    }
    if (sa.multipleIntelligenceScores && Object.keys(sa.multipleIntelligenceScores).length > 0) {
      scoreDetails.push({ name: sa.name, category: "Multiple Intelligence", count: Object.keys(sa.multipleIntelligenceScores).length, scores: sa.multipleIntelligenceScores });
    }
    if (sa.personalityScores && Object.keys(sa.personalityScores).length > 0) {
      scoreDetails.push({ name: sa.name, category: "Personality", count: Object.keys(sa.personalityScores).length, scores: sa.personalityScores });
    }

    (sa.careerAspirations || []).forEach((v) => extraDetails.push({ name: sa.name, type: "Career Aspiration", value: v }));
    (sa.subjectsOfInterest || []).forEach((v) => extraDetails.push({ name: sa.name, type: "Subject of Interest", value: v }));
    (sa.values || []).forEach((v) => extraDetails.push({ name: sa.name, type: "Value", value: v }));
  });

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <i className="bi bi-check-circle fs-3x text-success d-block mb-3"></i>
        <h3 className="fw-bold mb-1">Import Complete!</h3>
        <p className="text-muted fs-7">Click on any card below to see details</p>
      </div>

      {/* Summary cards */}
      <div className="row g-4 justify-content-center mb-6">
        <div className="col-auto">
          <div
            className={`rounded p-4 text-center border-2 ${activePanel === "students" ? "border border-success" : ""}`}
            style={{ minWidth: 140, cursor: "pointer", backgroundColor: activePanel === "students" ? "#e8fff3" : "#f1faff" }}
            onClick={() => setActivePanel(activePanel === "students" ? null : "students")}
          >
            <div className="fs-2x fw-bold text-success">{studentsCreated}</div>
            <div className="fs-7 text-muted">Students Created</div>
          </div>
        </div>
        <div className="col-auto">
          <div
            className={`rounded p-4 text-center border-2 ${activePanel === "scores" ? "border border-primary" : ""}`}
            style={{ minWidth: 140, cursor: "pointer", backgroundColor: activePanel === "scores" ? "#eef6ff" : "#f1faff" }}
            onClick={() => setActivePanel(activePanel === "scores" ? null : "scores")}
          >
            <div className="fs-2x fw-bold text-primary">{scoresImported}</div>
            <div className="fs-7 text-muted">Scores Imported</div>
          </div>
        </div>
        <div className="col-auto">
          <div
            className={`rounded p-4 text-center border-2 ${activePanel === "extra" ? "border border-info" : ""}`}
            style={{ minWidth: 140, cursor: "pointer", backgroundColor: activePanel === "extra" ? "#e8f7ff" : "#f1faff" }}
            onClick={() => setActivePanel(activePanel === "extra" ? null : "extra")}
          >
            <div className="fs-2x fw-bold text-info">{extraDataImported}</div>
            <div className="fs-7 text-muted">Extra Data Items</div>
          </div>
        </div>
        {studentsSkipped > 0 && (
          <div className="col-auto">
            <div className="bg-light-warning rounded p-4 text-center" style={{ minWidth: 140 }}>
              <div className="fs-2x fw-bold text-warning">{studentsSkipped}</div>
              <div className="fs-7 text-muted">Skipped</div>
            </div>
          </div>
        )}
      </div>

      {/* Students detail */}
      {activePanel === "students" && (
        <div className="card border border-success mb-4">
          <div className="card-header bg-light-success py-3">
            <h6 className="fw-bold mb-0">
              <i className="bi bi-people me-2"></i>
              Students Created ({studentAssignments.length})
            </h6>
          </div>
          <div className="card-body p-0">
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              <table className="table table-row-bordered mb-0">
                <thead className="bg-light">
                  <tr className="fw-semibold text-muted fs-8">
                    <th className="ps-4 py-2">#</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Grade</th>
                    <th className="py-2">Firebase School</th>
                    <th className="py-2 pe-4">System School</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAssignments.map((sa, i) => (
                    <tr key={sa.firebaseDocId}>
                      <td className="ps-4 py-2 fs-8 text-muted">{i + 1}</td>
                      <td className="py-2 fs-7 fw-semibold">{sa.name || "—"}</td>
                      <td className="py-2 fs-8 text-muted">{sa.email || "—"}</td>
                      <td className="py-2"><span className="badge badge-light fs-9">Grade {sa.grade}</span></td>
                      <td className="py-2 fs-8">{sa.firebaseSchool || "—"}</td>
                      <td className="py-2 pe-4 fs-8">
                        <span className="badge badge-light-success fs-9">{sa.instituteName}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Scores detail */}
      {activePanel === "scores" && (
        <div className="card border border-primary mb-4">
          <div className="card-header bg-light-primary py-3">
            <h6 className="fw-bold mb-0">
              <i className="bi bi-bar-chart me-2"></i>
              Score Records ({scoreDetails.length})
            </h6>
          </div>
          <div className="card-body p-0">
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              <table className="table table-row-bordered mb-0">
                <thead className="bg-light">
                  <tr className="fw-semibold text-muted fs-8">
                    <th className="ps-4 py-2">#</th>
                    <th className="py-2">Student</th>
                    <th className="py-2">Category</th>
                    <th className="py-2 pe-4">Score Types</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreDetails.map((s, i) => (
                    <>
                      <tr
                        key={i}
                        style={{ cursor: "pointer" }}
                        className={expandedScoreRow === i ? "bg-light-primary" : ""}
                        onClick={() => setExpandedScoreRow(expandedScoreRow === i ? null : i)}
                      >
                        <td className="ps-4 py-2 fs-8 text-muted">{i + 1}</td>
                        <td className="py-2 fs-7 fw-semibold">{s.name || "—"}</td>
                        <td className="py-2">
                          <span className={`badge fs-9 ${
                            s.category === "Ability" ? "badge-light-success" :
                            s.category === "Multiple Intelligence" ? "badge-light-primary" :
                            "badge-light-info"
                          }`}>
                            {s.category}
                          </span>
                        </td>
                        <td className="py-2 pe-4 fs-8">
                          <span className="me-2">{s.count} types</span>
                          <i className={`bi ${expandedScoreRow === i ? "bi-chevron-up" : "bi-chevron-down"} fs-9 text-muted`}></i>
                        </td>
                      </tr>
                      {expandedScoreRow === i && (
                        <tr key={`${i}-detail`}>
                          <td colSpan={4} className="p-0">
                            <div className="bg-light px-5 py-3">
                              <div className="row g-2">
                                {Object.entries(s.scores).map(([key, val]) => (
                                  <div key={key} className="col-md-4 col-sm-6">
                                    <div className="d-flex justify-content-between align-items-center bg-white rounded px-3 py-2 border">
                                      <span className="fs-8 text-muted">{key}</span>
                                      <span className="fw-bold fs-7">{val}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {scoreDetails.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-4 fs-8">No score data found in selected students</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Extra data detail */}
      {activePanel === "extra" && (
        <div className="card border border-info mb-4">
          <div className="card-header bg-light-info py-3">
            <h6 className="fw-bold mb-0">
              <i className="bi bi-collection me-2"></i>
              Extra Data Items ({extraDetails.length})
            </h6>
          </div>
          <div className="card-body p-0">
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              <table className="table table-row-bordered mb-0">
                <thead className="bg-light">
                  <tr className="fw-semibold text-muted fs-8">
                    <th className="ps-4 py-2">#</th>
                    <th className="py-2">Student</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 pe-4">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {extraDetails.map((e, i) => (
                    <tr key={i}>
                      <td className="ps-4 py-2 fs-8 text-muted">{i + 1}</td>
                      <td className="py-2 fs-7 fw-semibold">{e.name || "—"}</td>
                      <td className="py-2">
                        <span className={`badge fs-9 ${
                          e.type === "Career Aspiration" ? "badge-light-warning" :
                          e.type === "Subject of Interest" ? "badge-light-primary" :
                          "badge-light-info"
                        }`}>
                          {e.type}
                        </span>
                      </td>
                      <td className="py-2 pe-4 fs-8">{e.value}</td>
                    </tr>
                  ))}
                  {extraDetails.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-4 fs-8">No extra data found in selected students</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mt-4">
        <button className="btn btn-primary" onClick={onBack}>
          Back to Main Menu
        </button>
      </div>
    </div>
  );
};

const StudentImportWizard = ({ onBack }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studentAssignments, setStudentAssignments] = useState<StudentAssignment[]>([]);
  const [scoreTypeMappings, setScoreTypeMappings] = useState<ScoreTypeMapping[]>([]);
  const [importResults, setImportResults] = useState<any>(null);

  const handleAssessmentMappingDone = (assignments: StudentAssignment[]) => {
    setStudentAssignments(assignments);
    setCurrentStep(1);
  };

  const handleScoreTypeMappingDone = (mappings: ScoreTypeMapping[]) => {
    setScoreTypeMappings(mappings);
    setCurrentStep(2);
  };

  const handleImportDone = (results: any) => {
    setImportResults(results);
    setCurrentStep(3);
  };

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10">
          {/* Header */}
          <div className="d-flex align-items-center mb-6">
            <button className="btn btn-light-primary btn-sm me-4" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
            <h2 className="fw-bold text-dark mb-0">Student & Score Import</h2>
          </div>

          {/* Step indicators */}
          <div className="card shadow-sm mb-6">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between">
                {STEPS.map((step, idx) => (
                  <div key={step.key} className="d-flex align-items-center flex-grow-1">
                    <div className="d-flex flex-column align-items-center" style={{ minWidth: 80 }}>
                      <div
                        className={`symbol symbol-40px rounded-circle mb-2 ${
                          idx < currentStep
                            ? "bg-success"
                            : idx === currentStep
                            ? "bg-primary"
                            : "bg-light"
                        }`}
                      >
                        <span className="symbol-label">
                          <i
                            className={`bi ${
                              idx < currentStep ? "bi-check-lg" : step.icon
                            } fs-4 ${
                              idx <= currentStep ? "text-white" : "text-muted"
                            }`}
                          ></i>
                        </span>
                      </div>
                      <span
                        className={`fs-8 fw-semibold ${
                          idx <= currentStep ? "text-dark" : "text-muted"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className="flex-grow-1 mx-2"
                        style={{
                          height: 2,
                          backgroundColor: idx < currentStep ? "#50cd89" : "#e4e6ef",
                          marginTop: -20,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="card shadow-sm">
            <div className="card-body p-6">
              {currentStep === 0 && (
                <AssessmentMappingStep
                  existingAssignments={studentAssignments}
                  onDone={handleAssessmentMappingDone}
                />
              )}

              {currentStep === 1 && (
                <ScoreTypeMappingStep
                  mappings={scoreTypeMappings}
                  onDone={handleScoreTypeMappingDone}
                  onBack={() => setCurrentStep(0)}
                />
              )}

              {currentStep === 2 && (
                <StudentImportStep
                  studentAssignments={studentAssignments}
                  scoreTypeMappings={scoreTypeMappings}
                  onDone={handleImportDone}
                  onBack={() => setCurrentStep(1)}
                />
              )}

              {currentStep === 3 && (
                <DoneScreen importResults={importResults} studentAssignments={studentAssignments} onBack={onBack} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentImportWizard;
