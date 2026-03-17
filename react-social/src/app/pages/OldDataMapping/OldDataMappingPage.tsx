import { useState } from "react";
import StudentImportWizard from "./StudentImportWizard";
import QuestionMappingWizard from "./QuestionMappingWizard";

const OldDataMappingPage = () => {
  const [mode, setMode] = useState<"select" | "student-import" | "question-mapping">("select");

  if (mode === "student-import") {
    return <StudentImportWizard onBack={() => setMode("select")} />;
  }

  if (mode === "question-mapping") {
    return <QuestionMappingWizard onBack={() => setMode("select")} />;
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
            <div className="col-12 col-md-4">
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
                    and import scores &amp; additional data.
                  </p>
                  <button className="btn btn-success mt-auto">Start Import</button>
                </div>
              </div>
            </div>

            {/* Question & Response Mapping */}
            <div className="col-12 col-md-4">
              <div
                className="card card-hover border border-primary border-2 h-100"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("question-mapping")}
              >
                <div className="card-body p-6 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-60px mb-4 bg-light-primary rounded">
                    <span className="symbol-label">
                      <i className="bi bi-chat-left-text fs-2x text-primary"></i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">Question & Response Mapping</h4>
                  <p className="text-muted fs-7">
                    Select a student, view their Firebase responses, and map questions &amp; answers
                    to system assessment questions.
                  </p>
                  <button className="btn btn-primary mt-auto">Start Mapping</button>
                </div>
              </div>
            </div>

            {/* Offline (Coming Soon) */}
            <div className="col-12 col-md-4">
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
