import { useEffect, useState } from "react";
import {
  getReminderConfig,
  getTemplateTokens,
  sendTestReminder,
  updateReminderTemplate,
} from "../API/Reminder_APIs";
import {
  ALL_SERVICE_TYPES,
  ReminderConfig,
  ReminderServiceType,
  SERVICE_TYPE_LABEL,
} from "../types";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

interface Props {
  canEditTemplate: boolean;
  canTest: boolean;
}

const TemplatesSection = ({ canEditTemplate, canTest }: Props) => {
  const [type, setType] = useState<ReminderServiceType>("ASSESSMENT_INVITE_B2C");
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [tokens, setTokens] = useState<string[]>([]);
  const [sample, setSample] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async (t: ReminderServiceType) => {
    try {
      const [cfgRes, tokRes] = await Promise.all([getReminderConfig(t), getTemplateTokens(t)]);
      setConfig(cfgRes.data);
      setTokens(tokRes.data.tokens);
      setSample(tokRes.data.sample);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load(type);
  }, [type]);

  const insertToken = (token: string, target: "subject" | "body") => {
    if (!config) return;
    if (target === "subject") {
      setConfig({ ...config, subjectTemplate: (config.subjectTemplate || "") + " {{" + token + "}}" });
    } else {
      setConfig({ ...config, bodyTemplate: (config.bodyTemplate || "") + "{{" + token + "}}" });
    }
  };

  const render = (tpl: string) => {
    let out = tpl || "";
    Object.entries(sample).forEach(([k, v]) => {
      out = out.split("{{" + k + "}}").join(v);
    });
    return out;
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await updateReminderTemplate(type, {
        subject: config.subjectTemplate,
        body: config.bodyTemplate,
      });
      setConfig(res.data);
      showSuccessToast("Template saved");
    } catch (e) {
      console.error(e);
      showErrorToast("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!config) return;
    if (!testTo.trim()) {
      showErrorToast("Enter a test recipient");
      return;
    }
    setTesting(true);
    try {
      const res = await sendTestReminder(type, {
        to: testTo.trim(),
        subject: config.subjectTemplate,
        body: config.bodyTemplate,
      });
      showSuccessToast("Test rendered. Status: " + res.data.status);
    } catch (e) {
      console.error(e);
      showErrorToast("Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="row g-3">
      <div className="col-md-3">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h6 className="fw-semibold mb-2">Service</h6>
            <div className="list-group">
              {ALL_SERVICE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`list-group-item list-group-item-action ${type === t ? "active" : ""}`}
                  onClick={() => setType(t)}
                >
                  {SERVICE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <hr />
            <h6 className="fw-semibold mb-2">Available tokens</h6>
            <div className="d-flex flex-wrap gap-1">
              {tokens.map((tok) => (
                <div key={tok} className="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title={"Insert into subject"}
                    disabled={!canEditTemplate}
                    onClick={() => insertToken(tok, "subject")}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title={"Insert into body"}
                    disabled={!canEditTemplate}
                    onClick={() => insertToken(tok, "body")}
                  >
                    B
                  </button>
                  <button type="button" className="btn btn-light" disabled>
                    {"{{" + tok + "}}"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-9">
        {!config ? (
          <div className="text-center py-5"><span className="spinner-border" /></div>
        ) : (
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h5 className="mb-3">{SERVICE_TYPE_LABEL[type]}</h5>

              <label className="form-label fw-semibold">Subject</label>
              <input
                type="text"
                className="form-control mb-3"
                disabled={!canEditTemplate}
                value={config.subjectTemplate || ""}
                onChange={(e) => setConfig({ ...config, subjectTemplate: e.target.value })}
              />

              <label className="form-label fw-semibold">Body (HTML)</label>
              <textarea
                className="form-control mb-3"
                rows={10}
                disabled={!canEditTemplate}
                value={config.bodyTemplate || ""}
                onChange={(e) => setConfig({ ...config, bodyTemplate: e.target.value })}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />

              <div className="border rounded p-3 bg-light mb-3">
                <small className="text-muted fw-semibold d-block mb-2">Live preview</small>
                <div className="fw-semibold mb-2">{render(config.subjectTemplate || "")}</div>
                <div dangerouslySetInnerHTML={{ __html: render(config.bodyTemplate || "") }} />
              </div>

              <div className="d-flex justify-content-between gap-2">
                <div className="input-group" style={{ maxWidth: 420 }}>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="test recipient email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    disabled={!canTest}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={!canTest || testing}
                    onClick={test}
                  >
                    {testing ? "Sending…" : "Send test"}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canEditTemplate || saving}
                  onClick={save}
                >
                  {saving ? "Saving…" : "Save template"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesSection;
