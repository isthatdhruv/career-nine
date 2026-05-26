import { useEffect, useState } from "react";
import { listReminderConfigs, updateReminderConfig } from "../API/Reminder_APIs";
import {
  ALL_SERVICE_TYPES,
  CRON_PRESETS,
  ReminderConfig,
  ReminderServiceType,
  SERVICE_TYPE_LABEL,
} from "../types";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

interface Props {
  canEdit: boolean;
  onSaved?: () => void;
}

const ConfigSection = ({ canEdit, onSaved }: Props) => {
  const [configs, setConfigs] = useState<Record<ReminderServiceType, ReminderConfig | null>>({
    ASSESSMENT_INVITE_B2C: null,
    COUNSELLING_24H: null,
    COUNSELLING_1H: null,
    ASSESSMENT_MAPPING: null,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<ReminderServiceType | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listReminderConfigs();
      const next = { ...configs };
      (res.data || []).forEach((c) => {
        next[c.serviceType] = c;
      });
      setConfigs(next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLocal = (type: ReminderServiceType, patch: Partial<ReminderConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [type]: prev[type] ? { ...(prev[type] as ReminderConfig), ...patch } : prev[type],
    }));
  };

  const save = async (type: ReminderServiceType) => {
    const c = configs[type];
    if (!c) return;
    setSaving(type);
    try {
      const res = await updateReminderConfig(type, {
        enabled: c.enabled,
        cronExpression: c.cronExpression,
        leadTimeMinutes: c.leadTimeMinutes,
        maxSendsPerRecipient: c.maxSendsPerRecipient,
      });
      updateLocal(type, res.data);
      showSuccessToast(`${SERVICE_TYPE_LABEL[type]} updated`);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      showErrorToast("Failed to save");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><span className="spinner-border" /></div>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {ALL_SERVICE_TYPES.map((type) => {
        const c = configs[type];
        if (!c) return null;
        return (
          <div key={type} className="card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="mb-0">{SERVICE_TYPE_LABEL[type]}</h5>
                  <small className="text-muted">{type}</small>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    disabled={!canEdit}
                    checked={!!c.enabled}
                    onChange={(e) => updateLocal(type, { enabled: e.target.checked })}
                  />
                  <label className="form-check-label">{c.enabled ? "Enabled" : "Disabled"}</label>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Cron expression</label>
                  <input
                    type="text"
                    className="form-control"
                    disabled={!canEdit}
                    value={c.cronExpression || ""}
                    onChange={(e) => updateLocal(type, { cronExpression: e.target.value })}
                  />
                  <select
                    className="form-select mt-2"
                    disabled={!canEdit}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) updateLocal(type, { cronExpression: e.target.value });
                    }}
                  >
                    <option value="">Choose a preset…</option>
                    {CRON_PRESETS.map((p) => (
                      <option key={p.expr} value={p.expr}>
                        {p.label} ({p.expr})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">Lead time (minutes)</label>
                  <input
                    type="number"
                    className="form-control"
                    disabled={!canEdit}
                    value={c.leadTimeMinutes ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateLocal(type, {
                        leadTimeMinutes: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <small className="text-muted">For counselling/mapping: send N min ahead.</small>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">Max sends per recipient</label>
                  <input
                    type="number"
                    className="form-control"
                    disabled={!canEdit}
                    value={c.maxSendsPerRecipient ?? ""}
                    placeholder="∞"
                    onChange={(e) =>
                      updateLocal(type, {
                        maxSendsPerRecipient: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <small className="text-muted">Empty = no cap.</small>
                </div>
              </div>

              <div className="text-end mt-3">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!canEdit || saving === type}
                  onClick={() => save(type)}
                >
                  {saving === type ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConfigSection;
