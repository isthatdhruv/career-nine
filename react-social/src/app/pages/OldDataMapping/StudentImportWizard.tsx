import { useState } from "react";
import AssessmentMappingStep from "./steps/AssessmentMappingStep";
import type { StudentAssignment } from "./steps/AssessmentMappingStep";
import QuestionMappingStep from "./steps/QuestionMappingStep";
import StudentImportStep from "./steps/StudentImportStep";

interface Props {
  onBack: () => void;
}

const STEPS = [
  { key: "assessment", label: "Student & Assessment Mapping", icon: "bi-clipboard-data" },
  { key: "import", label: "Import Students", icon: "bi-people" },
  { key: "questionMapping", label: "Question & Option Mapping", icon: "bi-list-check" },
  { key: "done", label: "Done", icon: "bi-check-circle" },
];

// ── Done Screen with clickable detail cards ──────────────────────────────
const DoneScreen = ({ importResults, studentAssignments, onBack }: { importResults: any; studentAssignments: StudentAssignment[]; onBack: () => void }) => {
  const [activePanel, setActivePanel] = useState<"students" | "skipped" | null>(null);

  const studentsCreated = importResults?.studentsCreated || 0;
  const studentsSkipped = importResults?.studentsSkipped || 0;

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
        {studentsSkipped > 0 && (
          <div className="col-auto">
            <div
              className={`rounded p-4 text-center border-2 ${activePanel === "skipped" ? "border border-warning" : ""}`}
              style={{ minWidth: 140, cursor: "pointer", backgroundColor: activePanel === "skipped" ? "#fff8e1" : "#fff8dd" }}
              onClick={() => setActivePanel(activePanel === "skipped" ? null : "skipped")}
            >
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


      {/* Skipped detail */}
      {activePanel === "skipped" && (
        <div className="card border border-warning mb-4">
          <div className="card-header bg-light-warning py-3">
            <h6 className="fw-bold mb-0">
              <i className="bi bi-skip-forward me-2"></i>
              Skipped Students ({studentsSkipped})
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
                    <th className="py-2">Firebase Doc ID</th>
                    <th className="py-2 pe-4">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(importResults?.results || [])
                    .filter((r: any) => r.status === "skipped" || r.status === "error")
                    .map((r: any, i: number) => {
                      const sa = studentAssignments.find((s) => s.firebaseDocId === r.firebaseDocId);
                      return (
                        <tr key={r.firebaseDocId || i}>
                          <td className="ps-4 py-2 fs-8 text-muted">{i + 1}</td>
                          <td className="py-2 fs-7 fw-semibold">{r.name || sa?.name || "—"}</td>
                          <td className="py-2 fs-8 text-muted">{sa?.email || "—"}</td>
                          <td className="py-2 fs-8">
                            <code className="fs-9">{r.firebaseDocId || "—"}</code>
                          </td>
                          <td className="py-2 pe-4">
                            <span className={`badge fs-9 ${r.status === "error" ? "badge-light-danger" : "badge-light-warning"}`}>
                              {r.reason || r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {(importResults?.results || []).filter((r: any) => r.status === "skipped" || r.status === "error").length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted py-4 fs-8">No skip details available</td></tr>
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
  const [importResults, setImportResults] = useState<any>(null);

  const handleAssessmentMappingDone = (assignments: StudentAssignment[]) => {
    setStudentAssignments(assignments);
    setCurrentStep(1);
  };

  const handleImportDone = (results: any) => {
    setImportResults(results);
    setCurrentStep(2);
  };

  const handleQuestionMappingDone = () => {
    setCurrentStep(3);
  };

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12">
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
                <StudentImportStep
                  studentAssignments={studentAssignments}
                  scoreTypeMappings={[]}
                  onDone={handleImportDone}
                  onBack={() => setCurrentStep(0)}
                />
              )}

              {currentStep === 2 && (
                <QuestionMappingStep
                  studentAssignments={studentAssignments}
                  importResults={importResults}
                  onDone={handleQuestionMappingDone}
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
