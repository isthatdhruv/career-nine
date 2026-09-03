import { FC, Fragment, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  MailAudience,
  MailAutomation,
  MailEventInfo,
  deleteMailAutomation,
  getMailAudiences,
  getMailAutomations,
  getMailEvents,
  setMailAutomationEnabled,
  setMailAutomationPaused,
} from "../API/MailAutomation_APIs";
import AutomationEditorModal from "./AutomationEditorModal";
import AutomationRow from "./AutomationRow";
import { StatTile } from "./Chips";
import { SCHEDULED_GROUP, apiError, card, control, groupAutomations, primaryBtn, th } from "./automationHelpers";

interface Props {
  canEdit: boolean;
}

type StateFilter = "" | "enabled" | "disabled" | "paused";

const COLUMNS = ["Name", "Trigger", "Timing", "Conditions", "Template", "Recipients", "Cancel on", "State", "Stats", "Warnings", "Actions"];

interface EditorState {
  show: boolean;
  automation: MailAutomation | null;
  duplicate: boolean;
}

const AutomationsList: FC<Props> = ({ canEdit }) => {
  const [automations, setAutomations] = useState<MailAutomation[]>([]);
  const [events, setEvents] = useState<MailEventInfo[]>([]);
  const [audiences, setAudiences] = useState<MailAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("");
  const [openWarnings, setOpenWarnings] = useState<Record<number, boolean>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>({ show: false, automation: null, duplicate: false });

  const fetchAll = async () => {
    try {
      setError(null);
      const [a, e, au] = await Promise.all([
        getMailAutomations(),
        getMailEvents(),
        getMailAudiences().catch(() => ({ data: [] as MailAudience[] })),
      ]);
      setAutomations(a.data || []);
      setEvents(e.data || []);
      setAudiences(au.data || []);
    } catch (err: any) {
      setError(apiError(err, "Failed to load automations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const audienceLabel = (key: string) => audiences.find((x) => x.key === key)?.label || key;

  const summary = useMemo(() => ({
    total: automations.length,
    enabled: automations.filter((a) => a.enabled).length,
    paused: automations.filter((a) => a.enabled && a.paused).length,
    last7d: automations.reduce((n, a) => n + (a.stats?.last7dSent || 0), 0),
    warnings: automations.filter((a) => (a.warnings?.length || 0) > 0).length,
  }), [automations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return automations.filter((a) => {
      if (q) {
        const hay = [a.name, a.description, a.automationKey, a.templateName, a.templateMailKey, a.cron].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (eventFilter === SCHEDULED_GROUP) {
        if (!a.cron) return false;
      } else if (eventFilter && !a.triggerEvents.includes(eventFilter)) return false;
      if (stateFilter === "enabled" && !(a.enabled && !a.paused)) return false;
      if (stateFilter === "disabled" && a.enabled) return false;
      if (stateFilter === "paused" && !(a.enabled && a.paused)) return false;
      return true;
    });
  }, [automations, search, eventFilter, stateFilter]);

  const groups = useMemo(() => groupAutomations(filtered, events), [filtered, events]);

  const patchRow = (updated: MailAutomation) => setAutomations((list) => list.map((a) => (a.id === updated.id ? updated : a)));

  const handleEnabled = async (a: MailAutomation, enabled: boolean) => {
    setBusyId(a.id);
    try {
      const { data } = await setMailAutomationEnabled(a.id, enabled);
      patchRow(data);
      showSuccessToast(`"${a.name}" ${enabled ? "enabled" : "disabled"}`);
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to update automation"));
    } finally {
      setBusyId(null);
    }
  };

  const handlePaused = async (a: MailAutomation, paused: boolean) => {
    setBusyId(a.id);
    try {
      const { data } = await setMailAutomationPaused(a.id, paused);
      patchRow(data);
      showSuccessToast(`"${a.name}" ${paused ? "paused" : "resumed"}`);
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to update automation"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (a: MailAutomation) => {
    if (!window.confirm(`Delete automation "${a.name}"? Pending jobs it queued are not sent. This cannot be undone.`)) return;
    setBusyId(a.id);
    try {
      await deleteMailAutomation(a.id);
      showSuccessToast("Automation deleted");
      fetchAll();
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to delete automation"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ ...card, padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading automations…</p>
      </div>
    );
  }

  const sel: React.CSSProperties = { ...control, width: "auto", maxWidth: "220px" };

  return (
    <>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i><span>{error}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "16px" }}>
        <StatTile label="Automations" value={summary.total} />
        <StatTile label="Enabled" value={summary.enabled} color="#059669" hint={`${summary.total - summary.enabled} disabled`} />
        <StatTile label="Paused" value={summary.paused} color={summary.paused ? "#b45309" : undefined} />
        <StatTile label="Sent last 7 days" value={summary.last7d} color="#4f46e5" />
        <StatTile label="With warnings" value={summary.warnings} color={summary.warnings ? "#b45309" : undefined} />
      </div>

      <div style={card}>
        <div style={{ padding: "16px" }}>
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <input className="form-control form-control-sm" style={{ ...control, maxWidth: "240px" }} placeholder="Search name, key or template…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-select form-select-sm" style={sel} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="">All triggers</option>
              {events.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
              <option value={SCHEDULED_GROUP}>Scheduled (cron)</option>
            </select>
            <select className="form-select form-select-sm" style={sel} value={stateFilter} onChange={(e) => setStateFilter(e.target.value as StateFilter)}>
              <option value="">Any state</option>
              <option value="enabled">Enabled</option>
              <option value="paused">Paused</option>
              <option value="disabled">Disabled</option>
            </select>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{filtered.length} of {automations.length}</span>
            <button className="btn btn-sm btn-light ms-auto" onClick={fetchAll} style={{ borderRadius: "6px" }} title="Refresh"><i className="bi bi-arrow-clockwise"></i></button>
            {canEdit && (
              <button className="btn btn-sm" onClick={() => setEditor({ show: true, automation: null, duplicate: false })} style={primaryBtn}>
                <i className="bi bi-plus-lg me-1"></i>New automation
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-diagram-3 d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span style={{ color: "#6b7280" }}>{automations.length === 0 ? "No automations yet. Create one to start sending on events." : "Nothing matches these filters."}</span>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-hover align-middle mb-0" style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    {COLUMNS.map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.key}>
                      <tr style={{ background: "#f9fafb" }}>
                        <td colSpan={COLUMNS.length} style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>
                          <i className={`bi ${g.key === SCHEDULED_GROUP ? "bi-clock-history" : "bi-lightning-charge-fill"} me-2`} style={{ color: "#4f46e5" }}></i>
                          <span style={{ fontWeight: 700, color: "#111827" }}>{g.label}</span>
                          {g.key !== SCHEDULED_GROUP && <code style={{ fontFamily: "'Courier New', monospace", fontSize: "0.72rem", color: "#9ca3af", marginLeft: 8 }}>{g.key}</code>}
                          <span style={{ fontSize: "0.76rem", color: "#6b7280", marginLeft: 10 }}>{g.description}</span>
                          <span style={{ fontSize: "0.74rem", color: "#9ca3af", marginLeft: 10 }}>{g.rows.length} automation{g.rows.length === 1 ? "" : "s"}</span>
                        </td>
                      </tr>
                      {g.rows.map((a) => (
                        <AutomationRow
                          key={a.id}
                          a={a}
                          events={events}
                          audienceLabel={audienceLabel}
                          canEdit={canEdit}
                          busy={busyId === a.id}
                          warningsOpen={!!openWarnings[a.id]}
                          columnCount={COLUMNS.length}
                          onToggleWarnings={() => setOpenWarnings((s) => ({ ...s, [a.id]: !s[a.id] }))}
                          onEnabled={(v) => handleEnabled(a, v)}
                          onPaused={(v) => handlePaused(a, v)}
                          onEdit={() => setEditor({ show: true, automation: a, duplicate: false })}
                          onDuplicate={() => setEditor({ show: true, automation: a, duplicate: true })}
                          onDelete={() => handleDelete(a)}
                        />
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AutomationEditorModal
        show={editor.show}
        onHide={() => setEditor({ show: false, automation: null, duplicate: false })}
        automation={editor.automation}
        duplicate={editor.duplicate}
        events={events}
        audiences={audiences}
        canEdit={canEdit}
        onSaved={fetchAll}
      />
    </>
  );
};

export default AutomationsList;
