import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { useCan } from "../../modules/auth/core/useCan";
import {
  getReminderStats,
  listReminderConfigs,
} from "./API/Reminder_APIs";
import ConfigSection from "./sections/ConfigSection";
import LogsSection from "./sections/LogsSection";
import ManualSendSection from "./sections/ManualSendSection";
import SuppressionsSection from "./sections/SuppressionsSection";
import TemplatesSection from "./sections/TemplatesSection";
import {
  ALL_SERVICE_TYPES,
  ReminderConfig,
  ReminderServiceType,
  SERVICE_TYPE_LABEL,
} from "./types";

type TabKey =
  | "overview"
  | "config"
  | "templates"
  | "manual"
  | "logs"
  | "suppressions"
  | "analytics";

const ReminderManagementPage = () => {
  const can = useCan();
  const canConfigEdit = can("reminders.config.edit");
  const canTemplateEdit = can("reminders.template.edit");
  const canTest = can("reminders.send.test");
  const canLogs = can("reminders.logs.view");
  const canSuppression = can("reminders.suppressions.manage");
  const canManual = can("reminders.send.manual");

  const allTabs: { key: TabKey; label: string; visible: boolean }[] = useMemo(
    () => [
      { key: "overview", label: "Overview", visible: true },
      { key: "config", label: "Configuration", visible: true },
      { key: "templates", label: "Templates", visible: true },
      { key: "manual", label: "Manual send", visible: canManual },
      { key: "logs", label: "Delivery log", visible: canLogs },
      { key: "suppressions", label: "Suppressions", visible: canSuppression },
      { key: "analytics", label: "Analytics", visible: canLogs },
    ],
    [canManual, canLogs, canSuppression]
  );
  const visibleTabs = allTabs.filter((t) => t.visible);
  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.key || "overview");

  const [overview, setOverview] = useState<ReminderConfig[]>([]);
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [cfgRes, statRes] = await Promise.all([listReminderConfigs(), getReminderStats({})]);
      setOverview(cfgRes.data || []);
      setStats(statRes.data || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-bell-fill" />}
        title="Reminder Management"
        subtitle={<>Manage scheduled reminders, templates, suppressions, manual sends and delivery logs</>}
      />

      <div className="card">
        <div className="card-body">
          <ul className="nav nav-tabs mb-3">
            {visibleTabs.map((t) => (
              <li key={t.key} className="nav-item">
                <button
                  className={`nav-link ${tab === t.key ? "active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>

          {tab === "overview" && (
            <div className="row g-3">
              {loading && (
                <div className="col-12 text-center py-5"><span className="spinner-border" /></div>
              )}
              {overview.map((c) => {
                const svcStats = stats[c.serviceType] || {};
                return (
                  <div key={c.serviceType} className="col-md-6 col-lg-3">
                    <div className="card shadow-sm h-100 border-0">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <h6 className="fw-semibold mb-1">{SERVICE_TYPE_LABEL[c.serviceType]}</h6>
                          <span className={`badge ${c.enabled ? "bg-success" : "bg-secondary"}`}>
                            {c.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <div className="text-muted small mb-3">{c.cronExpression}</div>

                        <div className="row text-center">
                          <div className="col">
                            <div className="fs-5 fw-bold">{c.sentLast24h ?? 0}</div>
                            <div className="small text-muted">sent in 24h</div>
                          </div>
                          <div className="col">
                            <div className="fs-5 fw-bold">{svcStats.FAILED ?? 0}</div>
                            <div className="small text-muted">failed</div>
                          </div>
                          <div className="col">
                            <div className="fs-5 fw-bold">{svcStats.SUPPRESSED ?? 0}</div>
                            <div className="small text-muted">suppressed</div>
                          </div>
                        </div>

                        <hr />
                        <div className="small text-muted">
                          Last sent: {c.lastSentAt ? new Date(c.lastSentAt).toLocaleString() : "never"}
                        </div>
                        <div className="small text-muted">
                          Cap per recipient: {c.maxSendsPerRecipient ?? "∞"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="col-12">
                <div className="alert alert-light border small d-flex justify-content-between align-items-center">
                  <div>
                    Toggle a system off in the <strong>Configuration</strong> tab — the change takes
                    effect within one scheduler tick.
                  </div>
                  <button className="btn btn-sm btn-light" onClick={loadOverview} disabled={loading}>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "config" && (
            <ConfigSection canEdit={canConfigEdit} onSaved={loadOverview} />
          )}

          {tab === "templates" && (
            <TemplatesSection canEditTemplate={canTemplateEdit} canTest={canTest} />
          )}

          {tab === "manual" && <ManualSendSection canSend={canManual} />}

          {tab === "logs" && <LogsSection />}

          {tab === "suppressions" && <SuppressionsSection canManage={canSuppression} />}

          {tab === "analytics" && (
            <div className="row g-3">
              {ALL_SERVICE_TYPES.map((t) => {
                const s = stats[t] || {};
                const sent = s.SENT || 0;
                const failed = s.FAILED || 0;
                const total = Object.values(s).reduce((a, b) => a + b, 0);
                const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
                return (
                  <div key={t} className="col-md-6">
                    <div className="card shadow-sm border-0 h-100">
                      <div className="card-body">
                        <h6 className="fw-semibold mb-3">{SERVICE_TYPE_LABEL[t]}</h6>
                        <div className="row text-center">
                          <div className="col">
                            <div className="fs-4 fw-bold">{sent}</div>
                            <div className="small text-muted">sent</div>
                          </div>
                          <div className="col">
                            <div className="fs-4 fw-bold text-danger">{failed}</div>
                            <div className="small text-muted">failed</div>
                          </div>
                          <div className="col">
                            <div className="fs-4 fw-bold text-warning">{s.CAPPED || 0}</div>
                            <div className="small text-muted">capped</div>
                          </div>
                          <div className="col">
                            <div className="fs-4 fw-bold">{rate}%</div>
                            <div className="small text-muted">success</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReminderManagementPage;
