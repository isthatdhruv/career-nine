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
                <div className="text-center py-8">
                  <i className="bi bi-check-circle fs-3x text-success d-block mb-4"></i>
                  <h3 className="fw-bold mb-3">Import Complete!</h3>
                  {importResults && (
                    <div className="mb-6">
                      <div className="row g-4 justify-content-center">
                        <div className="col-auto">
                          <div className="bg-light-success rounded p-4 text-center" style={{ minWidth: 120 }}>
                            <div className="fs-2x fw-bold text-success">{importResults.studentsCreated || 0}</div>
                            <div className="fs-7 text-muted">Students Created</div>
                          </div>
                        </div>
                        <div className="col-auto">
                          <div className="bg-light-primary rounded p-4 text-center" style={{ minWidth: 120 }}>
                            <div className="fs-2x fw-bold text-primary">{importResults.scoresImported || 0}</div>
                            <div className="fs-7 text-muted">Scores Imported</div>
                          </div>
                        </div>
                        <div className="col-auto">
                          <div className="bg-light-info rounded p-4 text-center" style={{ minWidth: 120 }}>
                            <div className="fs-2x fw-bold text-info">{importResults.extraDataImported || 0}</div>
                            <div className="fs-7 text-muted">Extra Data Items</div>
                          </div>
                        </div>
                        {(importResults.studentsSkipped || 0) > 0 && (
                          <div className="col-auto">
                            <div className="bg-light-warning rounded p-4 text-center" style={{ minWidth: 120 }}>
                              <div className="fs-2x fw-bold text-warning">{importResults.studentsSkipped}</div>
                              <div className="fs-7 text-muted">Skipped</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={onBack}>
                    Back to Main Menu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentImportWizard;
