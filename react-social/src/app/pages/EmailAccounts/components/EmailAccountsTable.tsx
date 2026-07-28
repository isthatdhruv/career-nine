import { FC, useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  EmailAccount,
  deleteEmailAccount,
  getEmailAccounts,
  testEmailAccount,
  updateEmailAccount,
} from "../API/EmailAccount_APIs";
import EmailAccountModal from "./EmailAccountModal";

const EmailAccountsTable: FC = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);

  const fetchAccounts = async () => {
    try {
      setError(null);
      const { data } = await getEmailAccounts();
      setAccounts(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to fetch email accounts";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (account: EmailAccount) => {
    setEditing(account);
    setShowModal(true);
  };

  const handleSetDefault = async (account: EmailAccount) => {
    if (account.isGlobalDefault) return;
    setBusyId(account.id);
    try {
      // Re-send the current shape with isGlobalDefault flipped; credentials omitted
      // so existing secrets are preserved.
      await updateEmailAccount(account.id, {
        name: account.name,
        provider: account.provider,
        mode: account.provider === "GMAIL" ? account.mode : null,
        fromEmail: account.fromEmail,
        fromName: account.fromName,
        isGlobalDefault: true,
        active: account.active,
      });
      showSuccessToast(`"${account.name}" is now the global default`);
      fetchAccounts();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || "Failed to set global default");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (account: EmailAccount) => {
    setBusyId(account.id);
    try {
      await updateEmailAccount(account.id, {
        name: account.name,
        provider: account.provider,
        mode: account.provider === "GMAIL" ? account.mode : null,
        fromEmail: account.fromEmail,
        fromName: account.fromName,
        isGlobalDefault: account.isGlobalDefault,
        active: !account.active,
      });
      showSuccessToast(`"${account.name}" ${account.active ? "deactivated" : "activated"}`);
      fetchAccounts();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || "Failed to toggle active state");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (account: EmailAccount) => {
    if (!window.confirm(`Delete email account "${account.name}"? This cannot be undone.`)) return;
    setBusyId(account.id);
    try {
      const { data } = await deleteEmailAccount(account.id);
      showSuccessToast(data?.message || "Email account deleted");
      fetchAccounts();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || "Failed to delete email account");
    } finally {
      setBusyId(null);
    }
  };

  const handleSendTest = async (account: EmailAccount) => {
    const to = window.prompt(`Send a test email from "${account.name}" to which address?`);
    if (!to || !to.trim()) return;
    setBusyId(account.id);
    try {
      const { data } = await testEmailAccount(account.id, to.trim());
      if (data.success) {
        showSuccessToast(`Test email sent to ${to.trim()}${data.logId ? ` (log #${data.logId})` : ""}`);
      } else {
        showErrorToast(`Test failed${data.status ? ` [${data.status}]` : ""}: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || err?.message || "Failed to send test email");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = accounts.filter((a) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.fromEmail || "").toLowerCase().includes(q) ||
      (a.provider || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading email accounts...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "16px" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Toolbar */}
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
              <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Search by name, email or provider..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ paddingLeft: 32, borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
              />
            </div>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              {filtered.length} of {accounts.length} accounts
            </span>
            <button
              className="btn btn-sm ms-auto"
              onClick={openCreate}
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 }}
            >
              <i className="bi bi-plus-lg me-1"></i>Add Account
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-envelope-x d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span style={{ color: "#6b7280" }}>No email accounts found.</span>
            </div>
          ) : (
            <>
              <style>{`
                .ea-table tbody tr:has(.dropdown-menu.show) { z-index: 10; position: relative; }
                .ea-table .dropdown-menu.show { position: fixed !important; z-index: 1050 !important; }
              `}</style>
              <div className="ea-table" style={{ overflow: "visible" }}>
                <table className="table table-hover align-middle mb-0" style={{ width: "100%", tableLayout: "auto", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      {["#", "Name", "Provider / Mode", "From Email", "Default", "Credentials", "Status", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", whiteSpace: "nowrap", background: "#f9fafb" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((account, index) => {
                      const active = account.active === true;
                      return (
                        <tr key={account.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{index + 1}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ fontWeight: 600, color: "#111827" }}>{account.name || "-"}</span>
                            {account.fromName && (
                              <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>{account.fromName}</div>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px", color: "#4b5563" }}>
                            <span style={{ fontWeight: 600 }}>{account.provider}</span>
                            {account.provider === "GMAIL" && account.mode && (
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 6px", borderRadius: "3px", background: "#eef2ff", color: "#4f46e5", marginLeft: 6 }}>
                                {account.mode}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px", color: "#4b5563" }}>{account.fromEmail || "-"}</td>
                          <td style={{ padding: "8px 12px" }}>
                            {account.isGlobalDefault ? (
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: "#4f46e5", color: "#fff" }}>
                                <i className="bi bi-star-fill me-1"></i>Default
                              </span>
                            ) : (
                              <span style={{ color: "#d1d5db" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {account.hasCredentials ? (
                              <span title="Credentials configured" style={{ color: "#059669" }}>
                                <i className="bi bi-check-circle-fill"></i>
                              </span>
                            ) : (
                              <span title="No credentials set" style={{ color: "#dc2626" }}>
                                <i className="bi bi-x-circle-fill"></i>
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", display: "inline-block", background: active ? "#059669" : "#d97706", color: "#fff" }}>
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <Dropdown className="d-inline">
                              <Dropdown.Toggle variant="light" size="sm" id={`dd-ea-${account.id}`} disabled={busyId === account.id} style={{ borderRadius: "6px", background: "#fff", border: "2px solid #4f46e5", color: "#4f46e5", width: "36px", height: "36px", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                {busyId === account.id ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-three-dots-vertical" style={{ fontSize: "0.9rem" }}></i>}
                              </Dropdown.Toggle>
                              <Dropdown.Menu style={{ minWidth: "220px", zIndex: 1050, borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "6px" }} popperConfig={{ strategy: "fixed" }} renderOnMount>
                                <Dropdown.Item as="button" onClick={() => openEdit(account)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-pencil-square-fill me-2" style={{ color: "#2563eb", fontSize: "1rem" }}></i>Edit
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => handleSendTest(account)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-send-fill me-2" style={{ color: "#0891b2", fontSize: "1rem" }}></i>Send Test
                                </Dropdown.Item>
                                <Dropdown.Item as="button" disabled={account.isGlobalDefault} onClick={() => handleSetDefault(account)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-star-fill me-2" style={{ color: "#d97706", fontSize: "1rem" }}></i>Set as Global Default
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => handleToggleActive(account)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className={`bi bi-${active ? "x-circle-fill" : "check-circle-fill"} me-2`} style={{ color: active ? "#dc2626" : "#059669", fontSize: "1rem" }}></i>{active ? "Deactivate" : "Activate"}
                                </Dropdown.Item>
                                <div className="dropdown-divider my-1"></div>
                                <Dropdown.Item as="button" onClick={() => handleDelete(account)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px", color: "#dc2626" }}>
                                  <i className="bi bi-trash-fill me-2" style={{ color: "#dc2626", fontSize: "1rem" }}></i>Delete
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <EmailAccountModal
        show={showModal}
        onHide={() => { setShowModal(false); setEditing(null); }}
        account={editing}
        onSaved={fetchAccounts}
      />
    </>
  );
};

export default EmailAccountsTable;
