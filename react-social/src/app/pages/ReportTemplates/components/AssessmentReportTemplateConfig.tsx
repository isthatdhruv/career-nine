import { useEffect, useState } from "react";
import {
  MapTemplateToAssessment,
  ReadAssessmentTemplates,
  ReadReportTemplates,
  ReportTemplateDto,
  SetDefaultAssessmentTemplate,
  TemplateMappingDto,
  UnmapTemplateFromAssessment,
} from "../API/Report_Templates_APIs";

/**
 * Self-contained editor for one assessment's report-template mappings:
 * add a template from the catalog, pick the single default (radio), unmap.
 * Reused by the Report Templates page and the Assessment edit form, so all
 * buttons are {@code type="button"} to stay inert inside a surrounding <form>.
 */
const AssessmentReportTemplateConfig = ({ assessmentId }: { assessmentId: number }) => {
  const [catalog, setCatalog] = useState<ReportTemplateDto[]>([]);
  const [mappings, setMappings] = useState<TemplateMappingDto[]>([]);
  const [mapTemplateId, setMapTemplateId] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await ReadReportTemplates();
        setCatalog(res.data);
      } catch {
        /* non-fatal: the picker just shows no options */
      }
    })();
  }, []);

  const loadMappings = async () => {
    try {
      const res = await ReadAssessmentTemplates(assessmentId);
      setMappings(res.data);
    } catch (e: any) {
      setMsg("Failed to load mappings: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  useEffect(() => {
    setMapTemplateId("");
    setMsg(null);
    if (assessmentId) loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  const onMap = async () => {
    if (!assessmentId || !mapTemplateId) return;
    try {
      await MapTemplateToAssessment(assessmentId, Number(mapTemplateId));
      setMapTemplateId("");
      loadMappings();
    } catch (e: any) {
      setMsg("Map failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onUnmap = async (templateId: number) => {
    try {
      await UnmapTemplateFromAssessment(assessmentId, templateId);
      loadMappings();
    } catch (e: any) {
      setMsg("Unmap failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  const onSetDefault = async (templateId: number) => {
    try {
      await SetDefaultAssessmentTemplate(assessmentId, templateId);
      loadMappings();
    } catch (e: any) {
      setMsg("Set default failed: " + (e?.response?.data ?? e?.message ?? "unknown"));
    }
  };

  return (
    <div>
      {msg && <div className="alert alert-info">{msg}</div>}

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
            {catalog.map((t) => (
              <option key={t.reportTemplateId} value={t.reportTemplateId}>
                {t.displayName} ({t.code})
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={onMap} disabled={!mapTemplateId}>
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
                  name={`defaultTemplate-${assessmentId}`}
                  checked={m.isDefault}
                  onChange={() => onSetDefault(m.template.reportTemplateId)}
                />
              </td>
              <td>
                {m.template.displayName} (<code>{m.template.code}</code>)
              </td>
              <td>
                <span className="badge badge-light-primary">{m.template.engineCode}</span>
              </td>
              <td className="text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-light-danger"
                  onClick={() => onUnmap(m.template.reportTemplateId)}
                >
                  Unmap
                </button>
              </td>
            </tr>
          ))}
          {mappings.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-muted">
                No templates mapped.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AssessmentReportTemplateConfig;
