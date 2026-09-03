import { useState } from "react";
import PageHeader from "../../components/PageHeader";
import EmailTemplatesTable from "./components/EmailTemplatesTable";
import MailCatalogue from "./components/MailCatalogue";

type TabKey = "catalogue" | "templates";

const TABS: { key: TabKey; label: string; icon: string; subtitle: string }[] = [
  {
    key: "catalogue",
    label: "Mail catalogue",
    icon: "bi-collection",
    subtitle: "Every mail the system sends, as it reads today. Review each one and mark what needs to change.",
  },
  {
    key: "templates",
    label: "Templates",
    icon: "bi-envelope-paper",
    subtitle: "Reusable subjects + HTML bodies with placeholders, one default per send-scenario",
  },
];

const EmailTemplatesPage = () => {
  const [tab, setTab] = useState<TabKey>("catalogue");
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-envelope-paper-fill" />}
        title="Email Templates"
        subtitle={current.subtitle}
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

      {tab === "catalogue" ? <MailCatalogue /> : <EmailTemplatesTable />}
    </div>
  );
};

export default EmailTemplatesPage;
