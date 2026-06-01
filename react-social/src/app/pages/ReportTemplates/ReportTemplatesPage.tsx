import { useEffect, useRef, useState } from "react";
import {
  BootstrapClasspathTemplates,
  CreateReportTemplate,
  DeleteReportTemplate,
  MapTemplateToQuestionnaire,
  QuestionnaireOption,
  QuestionnaireTemplateMappingDto,
  ReadAllQuestionnaires,
  ReadQuestionnaireTemplates,
  ReadReportTemplates,
  ReportTemplateDto,
  SetDefaultTemplate,
  UnmapTemplateFromQuestionnaire,
  UploadReportTemplateHtml,
} from "./API/Report_Templates_APIs";

const ENGINES = ["bet", "pager", "legacy"];

const ReportTemplatesPage = () => {
  const [templates, setTemplates] = useState<ReportTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const uploadRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: "", displayName: "", engineCode: "bet", spacesRenderFolder: "" });

  // mapping panel
  const [qId, setQId] = useState<string>("");
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireOption[]>([]);
  const [mappings, setMappings] = useState<QuestionnaireTemplateMappingDto[]>([]);
  const [mapTemplateId, setMapTemplateId] = useState<string>("");

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

  const fetchQuestionnaires = async () => {
    try {
      const res = await ReadAllQuestionnaires();
      setQuestionnaires(res.data);
    } catch (e) {
      console.error("Failed to fetch questionnaires:", e);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchQuestionnaires();
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

  // ── mapping ──
  const loadMappings = async (id?: string) => {
    const target = id ?? qId;
    if (!target) {
      setMappings([]);
      return;
    }
    try {
      const res = await ReadQuestionnaireTemplates(Number(target));
      setMappings(res.data);
    } catch (e: any) {
      setMsg("Failed to load mappings: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onSelectQuestionnaire = (value: string) => {
    setQId(value);
    setMapTemplateId("");
    loadMappings(value);
  };

  const onMap = async () => {
    if (!qId || !mapTemplateId) return;
    try {
      await MapTemplateToQuestionnaire(Number(qId), Number(mapTemplateId));
      setMapTemplateId("");
      loadMappings();
    } catch (e: any) {
      setMsg("Map failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onUnmap = async (templateId: number) => {
    try {
      await UnmapTemplateFromQuestionnaire(Number(qId), templateId);
      loadMappings();
    } catch (e: any) {
      setMsg("Unmap failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onSetDefault = async (templateId: number) => {
    try {
      await SetDefaultTemplate(Number(qId), templateId);
      loadMappings();
    } catch (e: any) {
      setMsg("Set default failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
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

      {/* Questionnaire ↔ template mapping */}
      <div className="card shadow-sm">
        <div className="card-header">
          <h2 className="mb-0">Questionnaire mapping</h2>
        </div>
        <div className="card-body">
          <div className="d-flex align-items-end gap-3 mb-4">
            <div style={{ minWidth: 360 }}>
              <label className="form-label">Questionnaire</label>
              <select
                className="form-select"
                value={qId}
                onChange={(e) => onSelectQuestionnaire(e.target.value)}
              >
                <option value="">— select a questionnaire —</option>
                {questionnaires.map((q) => (
                  <option key={q.questionnaireId} value={q.questionnaireId}>
                    {q.name ? `${q.name} (#${q.questionnaireId})` : `Questionnaire #${q.questionnaireId}`}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary" onClick={() => loadMappings()} disabled={!qId}>
              Refresh
            </button>
          </div>

          {qId && (
            <>
              <div className="d-flex align-items-end gap-3 mb-4">
                <div>
                  <label className="form-label">Add template</label>
                  <select
                    className="form-select"
                    style={{ maxWidth: 320 }}
                    value={mapTemplateId}
                    onChange={(e) => setMapTemplateId(e.target.value)}
                  >
                    <option value="">— select —</option>
                    {templates.map((t) => (
                      <option key={t.reportTemplateId} value={t.reportTemplateId}>
                        {t.displayName} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={onMap} disabled={!mapTemplateId}>
                  Map
                </button>
              </div>

              <table className="table table-row-bordered align-middle">
                <thead>
                  <tr className="fw-bold text-muted">
                    <th>Default</th>
                    <th>Template</th>
                    <th>Engine</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.mappingId}>
                      <td>
                        <input
                          type="radio"
                          name="defaultTemplate"
                          checked={m.isDefault}
                          onChange={() => onSetDefault(m.template.reportTemplateId)}
                        />
                      </td>
                      <td>{m.template.displayName} (<code>{m.template.code}</code>)</td>
                      <td><span className="badge badge-light-primary">{m.template.engineCode}</span></td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-light-danger"
                          onClick={() => onUnmap(m.template.reportTemplateId)}
                        >
                          Unmap
                        </button>
                      </td>
                    </tr>
                  ))}
                  {mappings.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted">No templates mapped.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportTemplatesPage;
