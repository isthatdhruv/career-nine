import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "react-bootstrap";

const SchoolDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="container py-4">
      <div className="card shadow-sm">
        <div className="card-body">
          <h3>School Dashboard</h3>
          <p>
            School ID: <strong>{id}</strong>
          </p>

          {/* TODO: Replace with real dashboard widgets */}
          <div className="row">
            <div className="col-12">
              <div className="mb-3">
                <Button variant="secondary" onClick={() => navigate(-1)}>
                  Back
                </Button>
              </div>
              <div className="card p-3">
                <p className="mb-0 text-muted">Placeholder for school metrics and actions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolDashboardPage;