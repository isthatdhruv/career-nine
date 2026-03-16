import { useState } from "react";
import OnlineMappingWizard from "./OnlineMappingWizard";

const OldDataMappingPage = () => {
  const [mode, setMode] = useState<"select" | "online" | "offline">("select");

  if (mode === "online") {
    return <OnlineMappingWizard onBack={() => setMode("select")} />;
  }

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8">
          <div className="card shadow-sm mb-8">
            <div className="card-body p-8 text-center">
              <h2 className="fw-bold text-dark mb-2">Old Assessment Data Mapping</h2>
              <p className="text-muted fs-5">
                Map your old Firebase data (schools, sessions, grades, sections) to the new system architecture.
              </p>
            </div>
          </div>

          <div className="row g-6">
            {/* Online Option */}
            <div className="col-12 col-md-6">
              <div
                className="card card-hover border border-primary border-2 h-100 cursor-pointer"
                style={{ cursor: "pointer" }}
                onClick={() => setMode("online")}
              >
                <div className="card-body p-8 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-70px mb-5 bg-light-primary rounded">
                    <span className="symbol-label">
                      <i className="bi bi-cloud-arrow-down fs-2x text-primary"></i>
                    </span>
                  </div>
                  <h3 className="fw-bold text-dark mb-3">Online</h3>
                  <p className="text-muted">
                    Pull data directly from Firebase and map schools, sessions, grades, and sections one by one to the new system.
                  </p>
                  <button className="btn btn-primary mt-auto">
                    Start Online Mapping
                  </button>
                </div>
              </div>
            </div>

            {/* Offline Option */}
            <div className="col-12 col-md-6">
              <div
                className="card h-100 border border-secondary border-2"
                style={{ opacity: 0.6 }}
              >
                <div className="card-body p-8 d-flex flex-column align-items-center text-center">
                  <div className="symbol symbol-70px mb-5 bg-light-secondary rounded">
                    <span className="symbol-label">
                      <i className="bi bi-file-earmark-arrow-up fs-2x text-secondary"></i>
                    </span>
                  </div>
                  <h3 className="fw-bold text-dark mb-3">Offline</h3>
                  <p className="text-muted">
                    Upload a file or manually enter old data for mapping without a live Firebase connection.
                  </p>
                  <button className="btn btn-secondary mt-auto" disabled>
                    Coming Soon
                  </button>
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
