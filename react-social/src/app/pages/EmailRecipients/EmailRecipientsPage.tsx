import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import {
  EmailRecipient,
  EmailRecipientPayload,
  RecipientOptions,
  createEmailRecipient,
  deleteEmailRecipient,
  getEmailRecipients,
  getRecipientOptions,
  updateEmailRecipient,
} from "./API/EmailRecipient_APIs";
import EmailRecipientModal from "./components/EmailRecipientModal";

/**
 * Who gets told, automatically, when something happens.
 *
 * Every other email in Career-9 is addressed by the code that sends it. This page is the
 * one place an address is configured instead — which is what lets the new-lead alert be
 * re-pointed at a different desk without a deploy.
 *
 * Scenario-scoped rather than one flat list: the filters below (lead type, source) only
 * mean anything for the lead scenarios, and a single table mixing scenarios would show
 * columns that are blank for most rows.
 */

/** The send-scenarios that read a configured recipient list. */
const SCENARIOS = [
  {
    key: "LEAD_NOTIFICATION",
    label: "New lead alert",
    blurb:
      "Sent to your team the moment an enquiry is submitted on career-9.com. Nothing is sent while this list is empty.",
    leadFilters: true,
  },
] as const;

const KIND_COLORS: Record<string, { bg: string; ink: string }> = {
  TO: { bg: "#eef2ff", ink: "#4f46e5" },
  CC: { bg: "#f0fdf4", ink: "#15803d" },
  BCC: { bg: "#f3f4f6", ink: "#4b5563" },
};

const EmailRecipientsPage = () => {
  const [scenario, setScenario] = useState<string>(SCENARIOS[0].key);
  const [rows, setRows] = useState<EmailRecipient[]>([]);
  const [options, setOptions] = useState<RecipientOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailRecipient | null>(null);

  const active = useMemo(
    () => SCENARIOS.find((s) => s.key === scenario) ?? SCENARIOS[0],
    [scenario]
  );

  const fetchRows = async (type: string) => {
    try {
      setError(null);
      const { data } = await getEmailRecipients(type);
      setRows(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Could not load recipients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRows(scenario);
  }, [scenario]);

  useEffect(() => {
    getRecipientOptions()
      .then(({ data }) => setOptions(data))
      // The modal falls back to sensible defaults, so this is not worth an error banner.
      .catch(() => setOptions(null));
  }, []);

  const save = async (payload: EmailRecipientPayload) => {
    if (editing) {
      await updateEmailRecipient(editing.id, payload);
      showSuccessToast(`${payload.email} updated`);
    } else {
      await createEmailRecipient(payload);
      showSuccessToast(`${payload.email} will now be notified`);
    }
    fetchRows(scenario);
  };

  const toggleActive = async (row: EmailRecipient) => {
    setBusyId(row.id);
    try {
      await updateEmailRecipient(row.id, { active: !row.active });
      showSuccessToast(`${row.email} ${row.active ? "muted" : "reactivated"}`);
      fetchRows(scenario);
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Could not update the recipient.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: EmailRecipient) => {
    if (!window.confirm(`Stop notifying ${row.email}? This removes the row entirely.`)) return;
    setBusyId(row.id);
    try {
      await deleteEmailRecipient(row.id);
      showSuccessToast(`${row.email} removed`);
      fetchRows(scenario);
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Could not remove the recipient.");
    } finally {
      setBusyId(null);
    }
  };

  const liveCount = rows.filter((r) => r.active).length;

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-bell-fill" />}
        title="Notification Recipients"
        subtitle="Who gets emailed automatically when a new lead arrives"
      />

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: 16 }}>
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 16,
                color: "#b91c1c",
                fontSize: "0.85rem",
              }}
            >
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}

          {/* Scenario picker. One entry today; it is a select rather than a heading so the
              second trigger to use this table does not need the page rebuilt. */}
          {SCENARIOS.length > 1 && (
            <div className="mb-3" style={{ maxWidth: 320 }}>
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                Notification
              </label>
              <select
                className="form-select form-select-sm"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                {SCENARIOS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "12px 16px",
              marginBottom: 16,
              fontSize: "0.85rem",
              color: "#4b5563",
            }}
          >
            <strong style={{ color: "#111827" }}>{active.label}.</strong> {active.blurb}{" "}
            The wording of the email itself is edited under{" "}
            <strong>Email &rsaquo; Email Templates</strong>, and every send is recorded in{" "}
            <strong>Email &rsaquo; Email Log</strong>.
          </div>

          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              {liveCount} active {liveCount === 1 ? "recipient" : "recipients"}
              {rows.length !== liveCount && ` · ${rows.length - liveCount} muted`}
            </span>
            <button
              className="btn btn-sm ms-auto"
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              <i className="bi bi-plus-lg me-1"></i>Add Recipient
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
              <p className="mt-3" style={{ color: "#6b7280" }}>Loading recipients…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-bell-slash d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Nobody is being notified yet</div>
              <div style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: 4 }}>
                Leads are still captured and pushed to Odoo — no alert email is sent until you
                add an address here.
              </div>
            </div>
          ) : (
            <table
              className="table table-hover align-middle mb-0"
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  {["#", "Email", "Send as", "Only for", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        fontWeight: 700,
                        color: "#374151",
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.3px",
                        whiteSpace: "nowrap",
                        background: "#f9fafb",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const kind = KIND_COLORS[row.recipientKind] ?? KIND_COLORS.TO;
                  const filters = [
                    row.leadType ? `${row.leadType.toLowerCase()} leads` : null,
                    row.source ? `source “${row.source}”` : null,
                  ].filter(Boolean);
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{i + 1}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{row.email}</span>
                        {row.label && (
                          <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>{row.label}</div>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: kind.bg,
                            color: kind.ink,
                          }}
                        >
                          {row.recipientKind}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#4b5563" }}>
                        {filters.length === 0 ? (
                          <span style={{ color: "#6b7280" }}>Every lead</span>
                        ) : (
                          filters.join(" · ")
                        )}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            padding: "5px 12px",
                            borderRadius: 4,
                            display: "inline-block",
                            background: row.active ? "#059669" : "#9ca3af",
                            color: "#fff",
                          }}
                        >
                          {row.active ? "Active" : "Muted"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-sm btn-light me-1"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setEditing(row);
                            setShowModal(true);
                          }}
                          title="Edit"
                        >
                          <i className="bi bi-pencil-square" style={{ color: "#2563eb" }}></i>
                        </button>
                        <button
                          className="btn btn-sm btn-light me-1"
                          disabled={busyId === row.id}
                          onClick={() => toggleActive(row)}
                          title={row.active ? "Mute" : "Reactivate"}
                        >
                          <i
                            className={`bi ${row.active ? "bi-bell-slash" : "bi-bell"}`}
                            style={{ color: "#d97706" }}
                          ></i>
                        </button>
                        <button
                          className="btn btn-sm btn-light"
                          disabled={busyId === row.id}
                          onClick={() => remove(row)}
                          title="Remove"
                        >
                          <i className="bi bi-trash3" style={{ color: "#dc2626" }}></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <EmailRecipientModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onSave={save}
        editing={editing}
        emailType={scenario}
        options={options}
        showLeadFilters={active.leadFilters}
      />
    </div>
  );
};

export default EmailRecipientsPage;
