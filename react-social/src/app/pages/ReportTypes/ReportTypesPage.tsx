import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BootstrapAllTemplates,
  ReadReportTypes,
  ReportTypeDto,
} from "./API/Report_Types_APIs";
import ReportTypesTable from "./components/ReportTypesTable";

const ReportTypesPage = () => {
  const [types, setTypes] = useState<ReportTypeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await ReadReportTypes();
      setTypes(res.data);
    } catch (e) {
      console.error("Failed to fetch report types:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const onBootstrap = async () => {
    if (
      !window.confirm(
        "Upload the 7 classpath templates to Spaces and overwrite every existing report_subtype.template_spaces_url? This is intended as a one-time post-migration step."
      )
    ) {
      return;
    }
    setBootstrapBusy(true);
    setBootstrapMsg(null);
    try {
      const res = await BootstrapAllTemplates();
      setBootstrapMsg(`Uploaded ${res.data.uploadedCount}. Failed: ${res.data.failed.length}.`);
    } catch (e: any) {
      setBootstrapMsg("Bootstrap failed: " + (e?.message ?? "unknown"));
    } finally {
      setBootstrapBusy(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="card shadow-sm">
        <div className="card-header d-flex align-items-center">
          <h1 className="mb-0 flex-grow-1">Report Types</h1>
          <button
            className="btn btn-sm btn-light-warning me-2"
            onClick={onBootstrap}
            disabled={bootstrapBusy}
          >
            {bootstrapBusy ? "Seeding…" : "Bootstrap from classpath"}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate("/admin/report-types/create")}
          >
            + Add Report Type
          </button>
        </div>
        {bootstrapMsg && (
          <div className="alert alert-info m-3 mb-0">{bootstrapMsg}</div>
        )}
        <div className="card-body">
          {loading ? <div>Loading…</div> : (
            <ReportTypesTable types={types} onChanged={fetchTypes} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportTypesPage;
