import { useState } from "react";
import PageHeader from "../../components/PageHeader";
import { useCan } from "../../modules/auth/core/useCan";
import AutomationsList from "./components/AutomationsList";
import QueueTab from "./components/QueueTab";
import SettingsTab from "./components/SettingsTab";

type TabKey = "automations" | "queue" | "settings";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "automations", label: "Automations", icon: "bi-diagram-3" },
  { key: "queue", label: "Queue", icon: "bi-hourglass-split" },
  { key: "settings", label: "Settings", icon: "bi-gear" },
];

const MailAutomationsPage = () => {
  const can = useCan();
  const canEdit = can("mail_automation.edit");
  const [tab, setTab] = useState<TabKey>("automations");

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-diagram-3-fill" />}
        title="Mail Automations"
        subtitle="What gets sent, when, to whom. Every automation is off until you enable it."
      />

      <ul className="nav nav-tabs mb-3" style={{ marginTop: "12px" }}>
        {TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <li key={t.key} className="nav-item">
              <button
                type="button"
                className={`nav-link ${isActive ? "active" : ""}`}
                onClick={() => setTab(t.key)}
                style={{ fontSize: "0.9rem", fontWeight: isActive ? 700 : 500, color: isActive ? "#4f46e5" : "#6b7280" }}
              >
                <i className={`bi ${t.icon} me-1`}></i>{t.label}
              </button>
            </li>
          );
        })}
      </ul>

      {tab === "automations" && <AutomationsList canEdit={canEdit} />}
      {tab === "queue" && <QueueTab canEdit={canEdit} />}
      {tab === "settings" && <SettingsTab canEdit={canEdit} />}
    </div>
  );
};

export default MailAutomationsPage;
