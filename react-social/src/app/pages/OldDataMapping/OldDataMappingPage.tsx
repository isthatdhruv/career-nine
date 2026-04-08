import { useState, useEffect } from "react";
import StudentImportWizard from "./StudentImportWizard";
import ExistingMappingView from "./ExistingMappingView";
import FirebaseMappingOverview from "./FirebaseMappingOverview";
import UnmappedQuestionsTool from "./UnmappedQuestionsTool";
import { deleteFirebaseStudents } from "./API/OldDataMapping_APIs";
import { ReadCollegeList } from "../College/API/College_APIs";

// ── Delete Firebase Students Panel ──
const DeleteFirebaseStudentsPanel = ({ onBack }: { onBack: () => void }) => {
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [loadingInstitutes, setLoadingInstitutes] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showOrphanPrompt, setShowOrphanPrompt] = useState(false);
  const [orphanCount, setOrphanCount] = useState(0);

  useEffect(() => {
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setLoadingInstitutes(false));
  }, []);

  const selectedName = institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";

  // Step 1: Delete firebase-tagged students only
  const handleDelete = async () => {
    if (!selectedInstitute || confirmText !== "DELETE") return;
    setLoading(true);
    setResult(null);
    setShowOrphanPrompt(false);
    try {
      const res = await deleteFirebaseStudents(Number(selectedInstitute), false);
      const data = res.data;

      if (data.deleted === 0 && (data.remainingStudents > 0 || (data.message && data.message.includes("still exist")))) {
        // No firebase students found, but orphans exist — prompt user
        setOrphanCount(data.remainingStudents || 0);
        setShowOrphanPrompt(true);
      } else if (data.deleted > 0) {
        setResult(data);
      } else {
        setResult({ deleted: 0, message: data.message || "No students found for this institute." });
      }
    } catch (err: any) {
      setResult({ error: err?.response?.data?.error || err.message });
    } finally {
      setLoading(false);
      setConfirmText("");
    }
  };

  // Step 2: Force delete all remaining (orphan) students
  const handleForceDeleteOrphans = async () => {
    setLoading(true);
    setShowOrphanPrompt(false);
    setResult(null);
    try {
      const res = await deleteFirebaseStudents(Number(selectedInstitute), true);
      setResult(res.data);
    } catch (err: any) {
      setResult({ error: err?.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8">
          <div className="d-flex align-items-center mb-6">
            <button className="btn btn-light-primary btn-sm me-4" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
            <h2 className="fw-bold text-dark mb-0">Delete Firebase-Imported Students</h2>
          </div>

          <div className="card shadow-sm">
            <div className="card-body p-6">
              <div className="alert alert-danger d-flex align-items-center mb-6">
                <i className="bi bi-exclamation-triangle-fill fs-3 text-danger me-3"></i>
                <div>
                  <strong>Warning:</strong> This will permanently delete all Firebase-imported students
                  for the selected institute, including their assessment answers, scores, report data,
                  and user accounts. This cannot be undone.
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">Select Institute</label>
                {loadingInstitutes ? (
                  <div className="text-muted">Loading institutes...</div>
                ) : (
                  <select
                    className="form-select form-select-solid"
                    value={selectedInstitute}
                    onChange={(e) => {
                      setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value));
                      setResult(null);
                      setShowOrphanPrompt(false);
                    }}
                  >
                    <option value="">-- Select an institute --</option>
                    {institutes.map((inst) => (
                      <option key={inst.instituteCode} value={inst.instituteCode}>
                        {inst.instituteName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedInstitute !== "" && !showOrphanPrompt && (
                <div className="mb-4">
                  <label className="form-label fw-bold">
                    Type <span className="text-danger">DELETE</span> to confirm deletion for <strong>{selectedName}</strong>
                  </label>
                  <input
                    className="form-control form-control-solid"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                  />
                </div>
              )}

              {!showOrphanPrompt && (
                <button
                  className="btn btn-danger"
                  disabled={!selectedInstitute || confirmText !== "DELETE" || loading}
                  onClick={handleDelete}
                >
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Deleting...</>
                  ) : (
                    <><i className="bi bi-trash me-2"></i>Delete All Firebase Students</>
                  )}
                </button>
              )}

              {/* Orphan students prompt */}
              {showOrphanPrompt && (
                <div className="alert alert-warning mt-4">
                  <div className="d-flex align-items-start gap-3">
                    <i className="bi bi-exclamation-triangle-fill fs-3 text-warning mt-1"></i>
                    <div style={{ flex: 1 }}>
                      <h6 className="fw-bold mb-2">No Firebase-tagged students found</h6>
                      <p className="mb-3">
                        There are <strong>{orphanCount} students</strong> still in <strong>{selectedName}</strong> that
                        don't have Firebase mapping records (likely orphans from a previous failed delete).
                      </p>
                      <p className="mb-3 text-muted" style={{ fontSize: "0.85rem" }}>
                        Do you want to delete all remaining students for this institute?
                      </p>
                      <div className="d-flex gap-3">
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={loading}
                          onClick={handleForceDeleteOrphans}
                        >
                          {loading ? (
                            <><span className="spinner-border spinner-border-sm me-2"></span>Deleting...</>
                          ) : (
                            <><i className="bi bi-trash me-1"></i>Yes, Delete All {orphanCount} Students</>
                          )}
                        </button>
                        <button
                          className="btn btn-light btn-sm"
                          onClick={() => setShowOrphanPrompt(false)}
                        >
                          No, Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Result display */}
              {result && (
                <div className={`alert mt-4 ${result.error ? "alert-danger" : "alert-success"}`}>
                  {result.error ? (
                    <><i className="bi bi-x-circle me-2"></i>{result.error}</>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Deleted <strong>{result.deleted}</strong> of {result.total} students.
                      {result.errors?.length > 0 && (
                        <div className="mt-2">
                          <strong>{result.errors.length} errors:</strong>
                          <ul className="mb-0 mt-1">
                            {result.errors.map((e: any, i: number) => (
                              <li key={i}>Student {e.userStudentId}: {e.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OldDataMappingPage = () => {
  const [mode, setMode] = useState<"select" | "student-import" | "existing-mapping" | "mapping-overview" | "unmapped-tool" | "delete-firebase">("select");

  if (mode === "student-import") {
    return <StudentImportWizard onBack={() => setMode("select")} />;
  }

  if (mode === "existing-mapping") {
    return <ExistingMappingView onBack={() => setMode("select")} />;
  }

  if (mode === "mapping-overview") {
    return <FirebaseMappingOverview onBack={() => setMode("select")} />;
  }

  if (mode === "unmapped-tool") {
    return <UnmappedQuestionsTool onBack={() => setMode("select")} />;
  }

  if (mode === "delete-firebase") {
    return <DeleteFirebaseStudentsPanel onBack={() => setMode("select")} />;
  }

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10">
          <div className="card shadow-sm mb-8">
            <div className="card-body p-8 text-center">
              <h2 className="fw-bold text-dark mb-2">Old Assessment Data Mapping</h2>
              <p className="text-muted fs-5">
                Migrate your old Firebase data to the new system architecture.
              </p>
            </div>
          </div>

          <div className="row g-6 justify-content-center">
            {/* Student & Score Import */}
            <div className="col-12 col-md-3">
              <div
                className="card card-hover border border-success border-2 h-100"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("student-import")}
              >
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-success rounded">
                    <span className="symbol-label">
                      <i className="bi bi-people fs-2x text-success"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Student & Score Import</h4>
                  <p className="text-muted fs-7">
                    Map Firebase schools to system schools, select students, assign assessments,
                    map questions &amp; options, and import scores &amp; additional data.
                  </p>
                  <button className="btn btn-success mt-auto">Start Import</button>
                </div>
              </div>
            </div>

            {/* Edit Mappings */}
            <div className="col-12 col-md-3">
              <div
                className="card card-hover border border-primary border-2 h-100"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("existing-mapping")}
              >
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-primary rounded">
                    <span className="symbol-label">
                      <i className="bi bi-pencil-square fs-2x text-primary"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Edit Mappings</h4>
                  <p className="text-muted fs-7">
                    Create, edit, or update question &amp; option mappings per assessment.
                    Copy mappings to similar assessments.
                  </p>
                  <button className="btn btn-primary mt-auto">Edit Mappings</button>
                </div>
              </div>
            </div>

            {/* View Mapping Report */}
            <div className="col-12 col-md-3">
              <div
                className="card card-hover border border-info border-2 h-100"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("mapping-overview")}
              >
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-info rounded">
                    <span className="symbol-label">
                      <i className="bi bi-file-earmark-bar-graph fs-2x text-info"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Mapping Report</h4>
                  <p className="text-muted fs-7">
                    Read-only overview of all Firebase-to-system question mappings
                    by questionnaire. Download as Excel.
                  </p>
                  <button className="btn btn-info mt-auto">View Report</button>
                </div>
              </div>
            </div>

            {/* Detect Unmapped Questions */}
            <div className="col-12 col-md-3">
              <div
                className="card card-hover border border-warning border-2 h-100"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("unmapped-tool")}
              >
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-warning rounded">
                    <span className="symbol-label">
                      <i className="bi bi-search fs-2x text-warning"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Detect Unmapped</h4>
                  <p className="text-muted fs-7">
                    Find Firebase questions not yet mapped in an assessment
                    and map them to system questions.
                  </p>
                  <button className="btn btn-warning mt-auto">Detect & Map</button>
                </div>
              </div>
            </div>

            {/* Delete Firebase Students */}
            <div className="col-12 col-md-3">
              <div
                className="card card-hover border border-danger border-2 h-100"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("delete-firebase")}
              >
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-danger rounded">
                    <span className="symbol-label">
                      <i className="bi bi-trash fs-2x text-danger"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Delete Firebase Students</h4>
                  <p className="text-muted fs-7">
                    Remove all Firebase-imported students from an institute,
                    including their answers, scores, and report data.
                  </p>
                  <button className="btn btn-danger mt-auto">Delete Students</button>
                </div>
              </div>
            </div>

            {/* Offline (Coming Soon) */}
            <div className="col-12 col-md-3">
              <div className="card h-100 border border-secondary border-2" style={{ opacity: 0.6 }}>
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-secondary rounded">
                    <span className="symbol-label">
                      <i className="bi bi-file-earmark-arrow-up fs-2x text-secondary"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Offline Import</h4>
                  <p className="text-muted fs-7">
                    Upload a file or manually enter old data without a live Firebase connection.
                  </p>
                  <button className="btn btn-secondary mt-auto" disabled>Coming Soon</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OldDataMappingPage;
