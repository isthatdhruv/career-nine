import { useState } from "react";
import {
  importStudents,
  importScores,
} from "../API/OldDataMapping_APIs";
import type { StudentAssignment } from "./AssessmentMappingStep";

interface ScoreTypeMapping {
  firebaseKey: string;
  category: string;
  measuredQualityTypeId: number | null;
  measuredQualityTypeName: string;
}

interface Props {
  studentAssignments: StudentAssignment[];
  scoreTypeMappings: ScoreTypeMapping[];
  onDone: (results: any) => void;
  onBack: () => void;
}

const StudentImportStep = ({
  studentAssignments,
  scoreTypeMappings,
  onDone,
  onBack,
}: Props) => {
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [importComplete, setImportComplete] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Group students by school for display
  const schoolGroups = studentAssignments.reduce<
    Record<string, { instituteName: string; students: StudentAssignment[] }>
  >((acc, sa) => {
    const key = `${sa.instituteCode}`;
    if (!acc[key]) {
      acc[key] = { instituteName: sa.instituteName, students: [] };
    }
    acc[key].students.push(sa);
    return acc;
  }, {});

  const handleImport = async () => {
    if (studentAssignments.length === 0) return;

    setImporting(true);
    setProgress(0);
    setStatusMessage("Preparing import...");
    setError("");

    let studentsImported = 0;
    let scoresImported = 0;
    const errors: string[] = [];
    const importedStudentDetails: { name: string; email: string; grade: string; school: string; firebaseDocId: string }[] = [];
    const importedScoreDetails: { studentName: string; category: string; scoreCount: number }[] = [];

    try {
      // Step 1: Import Students
      setStatusMessage(`Importing ${studentAssignments.length} students...`);
      setProgress(10);

      const studentList = studentAssignments.map((sa) => ({
        firebaseDocId: sa.firebaseDocId,
        name: sa.name,
        email: sa.email,
        dob: sa.dob,
        gender: sa.gender,
        phone: sa.phone,
        instituteCode: sa.instituteCode,
        studentClass: sa.grade,
        assessmentId: sa.assessmentId,
      }));

      let studentResultsMap: Record<string, number> = {};
      let apiResults: any[] = [];

      try {
        const studentRes = await importStudents({ students: studentList });
        const resData = studentRes.data;
        studentsImported = resData?.created ?? 0;
        apiResults = resData?.results || [];
        if (resData?.results) {
          resData.results.forEach((r: any) => {
            if (r.userStudentId && r.firebaseDocId) {
              studentResultsMap[r.firebaseDocId] = r.userStudentId;
              const sa = studentAssignments.find((s) => s.firebaseDocId === r.firebaseDocId);
              if (sa) {
                importedStudentDetails.push({
                  name: sa.name,
                  email: sa.email,
                  grade: sa.grade,
                  school: sa.instituteName,
                  firebaseDocId: sa.firebaseDocId,
                });
              }
            }
          });
        }
      } catch (err: any) {
        errors.push(
          "Student import error: " +
            (err?.response?.data?.message || err?.message || "Unknown error")
        );
      }

      setProgress(40);

      // Step 2: Import Scores
      setStatusMessage("Importing assessment scores...");

      const validScoreMappings = scoreTypeMappings.filter(
        (m) => m.measuredQualityTypeId !== null
      );

      type ScoreField = "abilityScores" | "multipleIntelligenceScores" | "personalityScores";
      const categoryToScoreField: Record<string, ScoreField> = {
        ability: "abilityScores",
        multipleIntelligence: "multipleIntelligenceScores",
        personality: "personalityScores",
      };

      const scorePayloads: any[] = [];
      studentAssignments.forEach((sa) => {
        const userStudentId = studentResultsMap[sa.firebaseDocId];
        if (!userStudentId) return;

        // Single assessmentId for all score categories
        const assessmentId = sa.assessmentId;

        const categories = new Set(validScoreMappings.map((m) => m.category));
        categories.forEach((cat) => {
          const scoreFieldName = categoryToScoreField[cat];
          const userScores = scoreFieldName ? sa[scoreFieldName] : null;
          if (!userScores || typeof userScores !== "object") return;

          const scoreMap: Record<string, number> = {};
          validScoreMappings
            .filter((m) => m.category === cat)
            .forEach((mapping) => {
              const val = userScores[mapping.firebaseKey];
              if (val !== undefined && val !== null) {
                scoreMap[String(mapping.measuredQualityTypeId)] = Number(val);
              }
            });

          if (Object.keys(scoreMap).length > 0) {
            scorePayloads.push({ userStudentId, assessmentId, scoreMap });
            importedScoreDetails.push({
              studentName: sa.name,
              category: cat,
              scoreCount: Object.keys(scoreMap).length,
            });
          }
        });
      });

      if (scorePayloads.length > 0) {
        try {
          const scoreRes = await importScores({ scores: scorePayloads });
          scoresImported = scoreRes.data?.scoresImported ?? 0;
        } catch (err: any) {
          errors.push(
            "Score import error: " +
              (err?.response?.data?.message || err?.message || "Unknown error")
          );
        }
      }

      setProgress(100);
      setStatusMessage("Import complete!");

      const results = {
        studentsCreated: studentsImported,
        studentsSkipped: studentAssignments.length - studentsImported,
        scoresImported,
        totalUsers: studentAssignments.length,
        errors,
        results: apiResults,
        studentDetails: importedStudentDetails,
        scoreDetails: importedScoreDetails,
      };

      setImportResults(results);
      setImportComplete(true);

      if (errors.length === 0) {
        onDone(results);
      }
    } catch (err: any) {
      console.error("Import failed:", err);
      setError(
        "Import failed: " +
          (err?.response?.data?.message || err?.message || "Unknown error")
      );
      setImporting(false);
    }
  };

  return (
    <div>
      <h4 className="fw-bold text-dark mb-2">Import Students & Scores</h4>
      <p className="text-muted mb-4">
        Review the students below and click Import to create them in the new
        system with their scores and extra data.
      </p>

      {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

      {/* Import progress */}
      {importing && (
        <div className="card border border-info mb-4">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3">Import Progress</h6>
            <div className="progress mb-3" style={{ height: 20 }}>
              <div
                className={`progress-bar ${
                  progress === 100
                    ? "bg-success"
                    : "progress-bar-striped progress-bar-animated"
                }`}
                role="progressbar"
                style={{ width: `${progress}%` }}
              >
                {progress}%
              </div>
            </div>
            <div className="d-flex align-items-center">
              {progress < 100 && (
                <span className="spinner-border spinner-border-sm me-2" />
              )}
              {progress === 100 && (
                <i className="bi bi-check-circle-fill text-success me-2"></i>
              )}
              <span className="text-muted">{statusMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* Import results */}
      {importComplete && importResults && (
        <div
          className={`alert ${
            importResults.errors.length > 0 ? "alert-warning" : "alert-success"
          } mb-4`}
        >
          <h6 className="fw-bold mb-2">Import Summary</h6>
          <ul className="mb-2">
            <li>
              Students created:{" "}
              <strong>{importResults.studentsCreated}</strong>
            </li>
            <li>
              Score records imported:{" "}
              <strong>{importResults.scoresImported}</strong>
            </li>
            <li>
              Questionnaire answers (career, subjects, values):{" "}
              <em className="text-muted">will be saved in Step 3 via question mapping</em>
            </li>
          </ul>
          {importResults.errors.length > 0 && (
            <div>
              <strong>Errors:</strong>
              <ul className="mb-0">
                {importResults.errors.map((e: string, i: number) => (
                  <li key={i} className="text-danger">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {importResults.errors.length > 0 && (
            <button
              className="btn btn-sm btn-primary mt-2"
              onClick={() => onDone(importResults)}
            >
              Continue Anyway
            </button>
          )}
        </div>
      )}

      {/* Retry skipped students */}
      {importComplete && importResults && (() => {
        const skippedResults = (importResults.results || []).filter(
          (r: any) => r.status === "skipped" || r.status === "error"
        );
        if (skippedResults.length === 0) return null;
        return (
          <div className="card border border-warning mb-4">
            <div className="card-header bg-light-warning py-3 d-flex align-items-center justify-content-between">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {skippedResults.length} Student{skippedResults.length !== 1 ? "s" : ""} Skipped
              </h6>
              <button
                className="btn btn-sm btn-warning"
                onClick={handleImport}
                disabled={importing}
              >
                <i className="bi bi-arrow-repeat me-1"></i>
                Retry All ({skippedResults.length})
              </button>
            </div>
            <div className="card-body p-0">
              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                <table className="table table-row-bordered mb-0">
                  <thead className="bg-light">
                    <tr className="fw-semibold text-muted fs-8">
                      <th className="ps-4 py-2">#</th>
                      <th className="py-2">Name</th>
                      <th className="py-2">Email</th>
                      <th className="py-2 pe-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skippedResults.map((r: any, i: number) => {
                      const sa = studentAssignments.find((s) => s.firebaseDocId === r.firebaseDocId);
                      return (
                        <tr key={r.firebaseDocId || i}>
                          <td className="ps-4 py-2 fs-8 text-muted">{i + 1}</td>
                          <td className="py-2 fs-7">{r.name || sa?.name || "—"}</td>
                          <td className="py-2 fs-8 text-muted">{sa?.email || "—"}</td>
                          <td className="py-2 pe-4">
                            <span className={`badge fs-9 ${r.status === "error" ? "badge-light-danger" : "badge-light-warning"}`}>
                              {r.reason || r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Student summary */}
      {!importing && !importComplete && (
        <>
          <div className="alert alert-info py-2 mb-4">
            <i className="bi bi-info-circle me-2"></i>
            <strong>{studentAssignments.length}</strong> student
            {studentAssignments.length !== 1 ? "s" : ""} ready to import across{" "}
            <strong>{Object.keys(schoolGroups).length}</strong> school
            {Object.keys(schoolGroups).length !== 1 ? "s" : ""}.
          </div>

          <div
            style={{ maxHeight: 400, overflowY: "auto" }}
            className="mb-4"
          >
            {Object.entries(schoolGroups).map(
              ([key, { instituteName, students }]) => (
                <div key={key} className="card border mb-3">
                  <div className="card-header bg-light py-3 d-flex align-items-center justify-content-between">
                    <div>
                      <span className="fw-bold">{instituteName}</span>
                      <span className="text-muted ms-2 fs-7">
                        ({students.length} student
                        {students.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-row-bordered mb-0">
                      <thead>
                        <tr className="fw-semibold text-muted fs-8 bg-light">
                          <th className="ps-4 py-2">Name</th>
                          <th className="py-2">Grade</th>
                          <th className="py-2 pe-4">Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((sa) => (
                          <tr key={sa.firebaseDocId}>
                            <td className="ps-4 py-2 fs-7">
                              {sa.name || "Unnamed"}
                              {sa.email && (
                                <span className="text-muted fs-8 d-block">
                                  {sa.email}
                                </span>
                              )}
                            </td>
                            <td className="py-2">
                              <span className="badge badge-light fs-8">
                                {sa.grade}
                              </span>
                            </td>
                            <td className="py-2 pe-4 fs-8 text-muted">
                              {sa.assessmentName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="d-flex gap-3">
            <button className="btn btn-light" onClick={onBack}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <button className="btn btn-primary" onClick={handleImport}>
              <i className="bi bi-cloud-upload me-2"></i>
              Import {studentAssignments.length} Student
              {studentAssignments.length !== 1 ? "s" : ""}
            </button>
          </div>
        </>
      )}

      {importComplete && importResults?.errors?.length === 0 && (
        <div className="d-flex gap-3 mt-3">
          <button className="btn btn-light" onClick={onBack}>
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentImportStep;
