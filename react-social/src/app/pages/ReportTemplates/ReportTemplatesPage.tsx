import { useEffect, useRef, useState } from "react";
import {
  BootstrapClasspathTemplates,
  CreateReportTemplate,
  DeleteReportTemplate,
  ReadReportTemplates,
  ReportTemplateDto,
  UploadReportTemplateHtml,
} from "./API/Report_Templates_APIs";
import { getAllAssessments } from "../StudentInformation/StudentInfo_APIs";
import AssessmentReportTemplateConfig from "./components/AssessmentReportTemplateConfig";

const ENGINES = ["bet", "pager", "legacy"];

interface AssessmentOption {
  id: number;
  assessmentName: string;
}

const ReportTemplatesPage = () => {
  const [templates, setTemplates] = useState<ReportTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const uploadRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: "", displayName: "", engineCode: "bet", spacesRenderFolder: "" });

  // mapping panel
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [assessmentId, setAssessmentId] = useState<string>("");

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await ReadReportTemplates();
      setTemplates(res.data);
    } catch (e) {
      console.error("Failed to fetch report templates:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessments = async () => {
    try {
      const res = await getAllAssessments();
      setAssessments((res.data || []).map((a: any) => ({ id: a.id, assessmentName: a.assessmentName })));
    } catch (e) {
      console.error("Failed to fetch assessments:", e);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchAssessments();
  }, []);

  const onCreate = async () => {
    if (!form.code || !form.displayName || !form.engineCode || !form.spacesRenderFolder) {
      setMsg("All fields are required to create a template.");
      return;
    }
    try {
      await CreateReportTemplate(form);
      setShowCreate(false);
      setForm({ code: "", displayName: "", engineCode: "bet", spacesRenderFolder: "" });
      setMsg("Template created.");
      fetchTemplates();
    } catch (e: any) {
      setMsg("Create failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onUpload = async (id: number, file: File) => {
    try {
      await UploadReportTemplateHtml(id, file);
      setMsg("Template HTML uploaded.");
      fetchTemplates();
    } catch (e: any) {
      setMsg("Upload failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await DeleteReportTemplate(id);
      fetchTemplates();
    } catch (e: any) {
      setMsg("Delete failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onBootstrap = async () => {
    if (!window.confirm("Upload the 7 classpath templates to Spaces (one-time seed)?")) return;
    try {
      const res = await BootstrapClasspathTemplates();
      setMsg(`Bootstrapped ${res.data.uploadedCount}. Failed: ${res.data.failed.length}.`);
      fetchTemplates();
    } catch (e: any) {
      setMsg("Bootstrap failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  return (
    <div className="container py-5">
      <div className="card shadow-sm mb-5">
        <div className="card-header d-flex align-items-center">
          <h1 className="mb-0 flex-grow-1">Report Templates</h1>
          <button className="btn btn-sm btn-light-warning me-2" onClick={onBootstrap}>
            Bootstrap from classpath
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? "Cancel" : "+ Add Template"}
          </button>
        </div>

        {msg && <div className="alert alert-info m-3 mb-0">{msg}</div>}

        {showCreate && (
          <div className="card-body border-bottom">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Code (unique)</label>
                <input
                  className="form-control"
                  placeholder="e.g. pager_insight"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Display name</label>
                <input
                  className="form-control"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Engine</label>
                <select
                  className="form-select"
                  value={form.engineCode}
                  onChange={(e) => setForm({ ...form, engineCode: e.target.value })}
                >
                  {ENGINES.map((en) => (
                    <option key={en} value={en}>{en}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Render folder</label>
                <input
                  className="form-control"
                  placeholder="e.g. pager-reports/insight"
                  value={form.spacesRenderFolder}
                  onChange={(e) => setForm({ ...form, spacesRenderFolder: e.target.value })}
                />
              </div>
              <div className="col-md-1 d-flex align-items-end">
                <button className="btn btn-success w-100" onClick={onCreate}>Save</button>
              </div>
            </div>
          </div>
        )}

        <div className="card-body">
          {loading ? (
            <div>Loading…</div>
          ) : (
            <table className="table table-row-bordered align-middle">
              <thead>
                <tr className="fw-bold text-muted">
                  <th>Code</th>
                  <th>Display name</th>
                  <th>Engine</th>
                  <th>Template</th>
                  <th>Render folder</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.reportTemplateId}>
                    <td><code>{t.code}</code></td>
                    <td>{t.displayName}</td>
                    <td><span className="badge badge-light-primary">{t.engineCode}</span></td>
                    <td>
                      {t.hasTemplate ? (
                        <a href={t.templateSpacesUrl ?? "#"} target="_blank" rel="noreferrer">
                          uploaded
                        </a>
                      ) : (
                        <span className="text-danger">none</span>
                      )}
                    </td>
                    <td>{t.spacesRenderFolder}</td>
                    <td className="text-end">
                      <input
                        type="file"
                        accept=".html,text/html"
                        style={{ display: "none" }}
                        ref={(el) => (uploadRefs.current[t.reportTemplateId] = el)}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUpload(t.reportTemplateId, f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        className="btn btn-sm btn-light-primary me-2"
                        onClick={() => uploadRefs.current[t.reportTemplateId]?.click()}
                      >
                        {t.hasTemplate ? "Replace HTML" : "Upload HTML"}
                      </button>
                      <button className="btn btn-sm btn-light-danger" onClick={() => onDelete(t.reportTemplateId)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted">No templates yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assessment ↔ template mapping */}
      <div className="card shadow-sm">
        <div className="card-header">
          <h2 className="mb-0">Assessment mapping</h2>
        </div>
        <div className="card-body">
          <div className="d-flex align-items-end gap-3 mb-4">
            <div style={{ minWidth: 360 }}>
              <label className="form-label">Assessment</label>
              <select
                className="form-select"
                value={assessmentId}
                onChange={(e) => setAssessmentId(e.target.value)}
              >
                <option value="">— select an assessment —</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assessmentName ? `${a.assessmentName} (#${a.id})` : `Assessment #${a.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {assessmentId && <AssessmentReportTemplateConfig assessmentId={Number(assessmentId)} />}
        </div>
      </div>
    </div>
  );
};

export default ReportTemplatesPage;
