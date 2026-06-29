import { useEffect, useState } from "react";
import { ActionIcon } from "../../../components/ActionIcon";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  EmailAccount,
  EmailAccountCredentials,
  EmailAccountPayload,
  EmailMode,
  EmailProvider,
  createEmailAccount,
  updateEmailAccount,
} from "../API/EmailAccount_APIs";

interface Props {
  show: boolean;
  onHide: () => void;
  account: EmailAccount | null; // null => create mode
  onSaved: () => void;
}

// Local credential form state — string-backed for inputs, coerced on submit.
interface CredentialForm {
  // GMAIL + API
  useClasspathDefault: boolean;
  serviceAccountJson: string;
  delegatedUser: string;
  // GMAIL + SMTP
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpStarttls: boolean;
  // ODOO
  odooUrl: string;
  odooDatabase: string;
  odooUsername: string;
  odooApiKey: string;
}

const EMPTY_CREDS: CredentialForm = {
  useClasspathDefault: false,
  serviceAccountJson: "",
  delegatedUser: "",
  smtpHost: "",
  smtpPort: "",
  smtpUsername: "",
  smtpPassword: "",
  smtpStarttls: true,
  odooUrl: "",
  odooDatabase: "",
  odooUsername: "",
  odooApiKey: "",
};

const EmailAccountModal = ({ show, onHide, account, onSaved }: Props) => {
  const isEdit = !!account;

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<EmailProvider>("GMAIL");
  const [mode, setMode] = useState<EmailMode>("API");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [isGlobalDefault, setIsGlobalDefault] = useState(false);
  const [active, setActive] = useState(true);
  const [creds, setCreds] = useState<CredentialForm>(EMPTY_CREDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (account) {
      setName(account.name || "");
      setProvider(account.provider);
      setMode(account.provider === "GMAIL" ? account.mode || "API" : null);
      setFromEmail(account.fromEmail || "");
      setFromName(account.fromName || "");
      setIsGlobalDefault(account.isGlobalDefault === true);
      setActive(account.active === true);
      // Secrets are write-only — never returned by the API. Always start blank on
      // edit; only send credentials if the admin actually types something.
      setCreds(EMPTY_CREDS);
    } else {
      setName("");
      setProvider("GMAIL");
      setMode("API");
      setFromEmail("");
      setFromName("");
      setIsGlobalDefault(false);
      setActive(true);
      setCreds(EMPTY_CREDS);
    }
  }, [show, account]);

  // Provider drives mode: ODOO has no mode; GMAIL defaults to API.
  const onProviderChange = (p: EmailProvider) => {
    setProvider(p);
    setMode(p === "GMAIL" ? "API" : null);
  };

  const setCred = <K extends keyof CredentialForm>(key: K, value: CredentialForm[K]) =>
    setCreds((prev) => ({ ...prev, [key]: value }));

  // Build the credentials object from whatever the admin filled in. Returns
  // undefined when nothing was entered (so on edit we keep existing secrets).
  const buildCredentials = (): EmailAccountCredentials | undefined => {
    if (provider === "GMAIL" && mode === "API") {
      const hasAny = creds.useClasspathDefault || creds.serviceAccountJson.trim() || creds.delegatedUser.trim();
      if (!hasAny && isEdit) return undefined;
      const c: EmailAccountCredentials = { useClasspathDefault: creds.useClasspathDefault };
      if (creds.serviceAccountJson.trim()) c.serviceAccountJson = creds.serviceAccountJson.trim();
      if (creds.delegatedUser.trim()) c.delegatedUser = creds.delegatedUser.trim();
      return c;
    }
    if (provider === "GMAIL" && mode === "SMTP") {
      const hasAny =
        creds.smtpHost.trim() || creds.smtpPort.trim() || creds.smtpUsername.trim() || creds.smtpPassword.trim();
      if (!hasAny && isEdit) return undefined;
      return {
        smtpHost: creds.smtpHost.trim(),
        smtpPort: Number(creds.smtpPort) || 0,
        smtpUsername: creds.smtpUsername.trim(),
        smtpPassword: creds.smtpPassword,
        smtpStarttls: creds.smtpStarttls,
      };
    }
    // ODOO
    const hasAny =
      creds.odooUrl.trim() || creds.odooDatabase.trim() || creds.odooUsername.trim() || creds.odooApiKey.trim();
    if (!hasAny && isEdit) return undefined;
    return {
      odooUrl: creds.odooUrl.trim(),
      odooDatabase: creds.odooDatabase.trim(),
      odooUsername: creds.odooUsername.trim(),
      odooApiKey: creds.odooApiKey,
    };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showErrorToast("Name is required");
      return;
    }
    if (!fromEmail.trim()) {
      showErrorToast("From email is required");
      return;
    }
    setSaving(true);
    try {
      const payload: EmailAccountPayload = {
        name: name.trim(),
        provider,
        mode: provider === "GMAIL" ? mode : null,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        isGlobalDefault,
        active,
      };
      const credentials = buildCredentials();
      if (credentials) payload.credentials = credentials;

      if (isEdit && account) {
        await updateEmailAccount(account.id, payload);
        showSuccessToast("Email account updated");
      } else {
        await createEmailAccount(payload);
        showSuccessToast("Email account created");
      }
      onSaved();
      onHide();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save email account";
      showErrorToast(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const labelStyle: React.CSSProperties = { fontSize: "0.85rem", fontWeight: 600 };
  const inputStyle: React.CSSProperties = { borderRadius: "8px", fontSize: "0.85rem" };
  const secretHint = isEdit ? " (leave blank to keep current)" : "";

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={onHide}
    >
      <div
        style={{
          backgroundColor: "#fff", borderRadius: "16px", maxWidth: "720px",
          width: "94%", maxHeight: "88vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 text-white fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-envelope-fill me-2"></i>{isEdit ? "Edit Email Account" : "Add Email Account"}
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {isEdit ? account?.name : "Configure a provider, sender identity and credentials"}
            </p>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" style={labelStyle}>Name</label>
              <input
                className="form-control form-control-sm"
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Default Gmail"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" style={labelStyle}>Provider</label>
              <select
                className="form-select form-select-sm"
                style={inputStyle}
                value={provider}
                onChange={(e) => onProviderChange(e.target.value as EmailProvider)}
              >
                <option value="GMAIL">Gmail</option>
                <option value="ODOO">Odoo</option>
              </select>
            </div>
            {provider === "GMAIL" && (
              <div className="col-md-3">
                <label className="form-label" style={labelStyle}>Mode</label>
                <select
                  className="form-select form-select-sm"
                  style={inputStyle}
                  value={mode ?? "API"}
                  onChange={(e) => setMode(e.target.value as EmailMode)}
                >
                  <option value="API">API</option>
                  <option value="SMTP">SMTP</option>
                </select>
              </div>
            )}

            <div className="col-md-6">
              <label className="form-label" style={labelStyle}>From Email</label>
              <input
                className="form-control form-control-sm"
                style={inputStyle}
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@example.com"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" style={labelStyle}>From Name</label>
              <input
                className="form-control form-control-sm"
                style={inputStyle}
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Career Nine"
              />
            </div>

            <div className="col-md-6 d-flex align-items-center">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="ea-global-default"
                  checked={isGlobalDefault}
                  onChange={(e) => setIsGlobalDefault(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="ea-global-default" style={{ fontSize: "0.85rem" }}>
                  Set as global default
                </label>
              </div>
            </div>
            <div className="col-md-6 d-flex align-items-center">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="ea-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="ea-active" style={{ fontSize: "0.85rem" }}>
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Credentials — driven by provider + mode */}
          <div className="mt-4">
            <div className="d-flex align-items-center mb-2">
              <i className="bi bi-key-fill me-2" style={{ color: "#4f46e5" }}></i>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Credentials{secretHint}
              </span>
            </div>

            {provider === "GMAIL" && mode === "API" && (
              <div className="row g-3">
                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="ea-classpath"
                      checked={creds.useClasspathDefault}
                      onChange={(e) => setCred("useClasspathDefault", e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="ea-classpath" style={{ fontSize: "0.85rem" }}>
                      Use classpath default service account
                    </label>
                  </div>
                </div>
                {!creds.useClasspathDefault && (
                  <div className="col-12">
                    <label className="form-label" style={labelStyle}>Service Account JSON{secretHint}</label>
                    <textarea
                      className="form-control form-control-sm"
                      style={{ ...inputStyle, fontFamily: "monospace", minHeight: "120px" }}
                      value={creds.serviceAccountJson}
                      onChange={(e) => setCred("serviceAccountJson", e.target.value)}
                      placeholder='{"type":"service_account", ...}'
                    />
                  </div>
                )}
                <div className="col-md-6">
                  <label className="form-label" style={labelStyle}>Delegated User</label>
                  <input
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.delegatedUser}
                    onChange={(e) => setCred("delegatedUser", e.target.value)}
                    placeholder="user@domain.com"
                  />
                </div>
              </div>
            )}

            {provider === "GMAIL" && mode === "SMTP" && (
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label" style={labelStyle}>SMTP Host</label>
                  <input
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.smtpHost}
                    onChange={(e) => setCred("smtpHost", e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" style={labelStyle}>SMTP Port</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.smtpPort}
                    onChange={(e) => setCred("smtpPort", e.target.value)}
                    placeholder="587"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" style={labelStyle}>SMTP Username</label>
                  <input
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.smtpUsername}
                    onChange={(e) => setCred("smtpUsername", e.target.value)}
                    placeholder="user@gmail.com"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" style={labelStyle}>SMTP Password{secretHint}</label>
                  <input
                    type="password"
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.smtpPassword}
                    onChange={(e) => setCred("smtpPassword", e.target.value)}
                    placeholder={isEdit ? "••••••••" : "App password"}
                    autoComplete="new-password"
                  />
                </div>
                <div className="col-12">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="ea-starttls"
                      checked={creds.smtpStarttls}
                      onChange={(e) => setCred("smtpStarttls", e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="ea-starttls" style={{ fontSize: "0.85rem" }}>
                      Use STARTTLS
                    </label>
                  </div>
                </div>
              </div>
            )}

            {provider === "ODOO" && (
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label" style={labelStyle}>Odoo URL</label>
                  <input
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.odooUrl}
                    onChange={(e) => setCred("odooUrl", e.target.value)}
                    placeholder="https://odoo.example.com"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" style={labelStyle}>Database</label>
                  <input
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.odooDatabase}
                    onChange={(e) => setCred("odooDatabase", e.target.value)}
                    placeholder="odoo-db"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" style={labelStyle}>Username</label>
                  <input
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.odooUsername}
                    onChange={(e) => setCred("odooUsername", e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" style={labelStyle}>API Key{secretHint}</label>
                  <input
                    type="password"
                    className="form-control form-control-sm"
                    style={inputStyle}
                    value={creds.odooApiKey}
                    onChange={(e) => setCred("odooApiKey", e.target.value)}
                    placeholder={isEdit ? "••••••••" : "API key"}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="btn btn-sm btn-light" onClick={onHide} style={{ borderRadius: "6px" }}>Cancel</button>
          <button
            className="btn btn-sm"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, padding: "6px 16px",
            }}
          >
            {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : <><ActionIcon type="approve" size="sm" className="me-1" />Save</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailAccountModal;
