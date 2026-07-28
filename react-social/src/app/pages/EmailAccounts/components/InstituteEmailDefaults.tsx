import { FC, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { EmailAccount, getEmailAccounts } from "../API/EmailAccount_APIs";
import {
  InstituteEmailSetting,
  clearInstituteEmailSetting,
  getInstituteEmailSettings,
  setInstituteEmailSetting,
} from "../API/InstituteEmailSetting_APIs";
import { ReadCollegeList } from "../../College/API/College_APIs";

interface InstituteOption {
  code: number;
  name: string;
}

/**
 * Per-institute default sending account (Phase 2 routing). Maps an institute to a specific
 * email account; automatic sends for that institute use it instead of the global default.
 * A row with no account falls back to the global default.
 */
const InstituteEmailDefaults: FC = () => {
  const [settings, setSettings] = useState<InstituteEmailSetting[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<number | null>(null);

  const [newInstitute, setNewInstitute] = useState<string>("");
  const [newAccount, setNewAccount] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const fetchAll = async () => {
    try {
      setError(null);
      const [s, a, i] = await Promise.all([
        getInstituteEmailSettings(),
        getEmailAccounts(),
        ReadCollegeList(),
      ]);
      setSettings(s.data || []);
      setAccounts(a.data || []);
      const rows = Array.isArray(i.data) ? i.data : [];
      const list: InstituteOption[] = rows
        .map((row: any) => ({
          code: Number(row.instituteCode),
          name: row.instituteName || `Institute ${row.instituteCode}`,
        }))
        .filter((o: InstituteOption) => !Number.isNaN(o.code));
      setInstitutes(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load institute defaults");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const nameByCode = useMemo(() => {
    const m = new Map<number, string>();
    institutes.forEach((i) => m.set(i.code, i.name));
    return m;
  }, [institutes]);

  const activeAccounts = accounts.filter((a) => a.active);
  const mappedCodes = new Set(settings.map((s) => s.instituteCode));
  const unmappedInstitutes = institutes.filter((i) => !mappedCodes.has(i.code));

  const handleAdd = async () => {
    if (!newInstitute) {
      showErrorToast("Pick an institute");
      return;
    }
    setAdding(true);
    try {
      await setInstituteEmailSetting(Number(newInstitute), newAccount ? Number(newAccount) : null);
      showSuccessToast("Institute default saved");
      setNewInstitute("");
      setNewAccount("");
      fetchAll();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Failed to save institute default");
    } finally {
      setAdding(false);
    }
  };

  const handleChange = async (code: number, accountId: string) => {
    setBusyCode(code);
    try {
      await setInstituteEmailSetting(code, accountId ? Number(accountId) : null);
      showSuccessToast("Updated");
      fetchAll();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Failed to update");
    } finally {
      setBusyCode(null);
    }
  };

  const handleClear = async (code: number) => {
    if (!window.confirm("Remove this institute's default account? It will fall back to the global default.")) {
      return;
    }
    setBusyCode(code);
    try {
      await clearInstituteEmailSetting(code);
      showSuccessToast("Cleared");
      fetchAll();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Failed to clear");
    } finally {
      setBusyCode(null);
    }
  };

  const selectStyle = {
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "0.85rem",
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", marginTop: "24px" }}>
      <div style={{ padding: "16px" }}>
        <div className="d-flex align-items-center mb-1">
          <i className="bi bi-building-fill-gear me-2" style={{ color: "#4f46e5" }}></i>
          <span style={{ fontWeight: 700, color: "#111827" }}>Per-institute default accounts</span>
        </div>
        <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "16px" }}>
          Automatic emails for an institute send from its default account. Institutes without a
          mapping use the global default. (Also editable from each institute's editor.)
        </p>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm" style={{ color: "#4f46e5" }} role="status"></div>
          </div>
        ) : (
          <>
            {/* Add a new mapping */}
            <div className="d-flex align-items-end gap-2 mb-3 flex-wrap">
              <div style={{ flex: "1 0 220px", maxWidth: "320px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>Institute</label>
                <select
                  className="form-select form-select-sm"
                  value={newInstitute}
                  onChange={(e) => setNewInstitute(e.target.value)}
                  style={selectStyle}
                  disabled={unmappedInstitutes.length === 0}
                >
                  <option value="">{unmappedInstitutes.length ? "Select institute…" : "All institutes mapped"}</option>
                  {unmappedInstitutes.map((i) => (
                    <option key={i.code} value={String(i.code)}>
                      {i.name} (#{i.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 0 220px", maxWidth: "320px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>Default account</label>
                <select
                  className="form-select form-select-sm"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Use global default</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} — {a.fromEmail}
                      {a.isGlobalDefault ? " (global default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-sm"
                onClick={handleAdd}
                disabled={adding || !newInstitute}
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 }}
              >
                {adding ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-plus-lg me-1"></i>Add</>}
              </button>
            </div>

            {settings.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-building d-block mb-2" style={{ fontSize: "1.6rem", color: "#d1d5db" }}></i>
                <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>No per-institute defaults yet.</span>
              </div>
            ) : (
              <table className="table table-hover align-middle mb-0" style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    {["Institute", "Default account", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", background: "#f9fafb" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settings.map((s) => (
                    <tr key={s.instituteCode} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {nameByCode.get(s.instituteCode) || `Institute #${s.instituteCode}`}
                        </span>
                        <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>#{s.instituteCode}</div>
                      </td>
                      <td style={{ padding: "8px 12px", minWidth: "240px" }}>
                        <select
                          className="form-select form-select-sm"
                          value={s.defaultAccountId != null ? String(s.defaultAccountId) : ""}
                          onChange={(e) => handleChange(s.instituteCode, e.target.value)}
                          disabled={busyCode === s.instituteCode}
                          style={selectStyle}
                        >
                          <option value="">Use global default</option>
                          {activeAccounts.map((a) => (
                            <option key={a.id} value={String(a.id)}>
                              {a.name} — {a.fromEmail}
                              {a.isGlobalDefault ? " (global default)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <button
                          className="btn btn-sm btn-light"
                          onClick={() => handleClear(s.instituteCode)}
                          disabled={busyCode === s.instituteCode}
                          style={{ borderRadius: "6px", color: "#dc2626", fontWeight: 600 }}
                        >
                          <i className="bi bi-x-circle me-1"></i>Clear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InstituteEmailDefaults;
