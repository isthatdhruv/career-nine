import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { getAllLeads, sendLeadsEmail, Lead } from "./API/Leads_APIs";
import { showErrorToast } from '../../utils/toast';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLeadType, setFilterLeadType] = useState<string>("ALL");
  const [filterSyncStatus, setFilterSyncStatus] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAllLeads();
      setLeads(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError("Failed to load leads. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Lead type filter
    if (filterLeadType !== "ALL") {
      result = result.filter((l) => l.leadType === filterLeadType);
    }

    // Sync status filter
    if (filterSyncStatus !== "ALL") {
      result = result.filter((l) => l.odooSyncStatus === filterSyncStatus);
    }

    // Date from
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((l) => new Date(l.createdAt) >= from);
    }

    // Date to
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.createdAt) <= to);
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          (l.fullName || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q) ||
          (l.source || "").toLowerCase().includes(q) ||
          (l.designation || "").toLowerCase().includes(q) ||
          (l.schoolName || "").toLowerCase().includes(q) ||
          (l.city || "").toLowerCase().includes(q) ||
          (l.cbseAffiliationNo || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [leads, filterLeadType, filterSyncStatus, filterDateFrom, filterDateTo, searchQuery]);

  // Collect all unique extras keys across all filtered leads
  const allExtrasKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const lead of filteredLeads) {
      if (lead.extras) {
        try {
          const parsed = JSON.parse(lead.extras);
          Object.keys(parsed).forEach((k) => keys.add(k));
        } catch {}
      }
    }
    return Array.from(keys);
  }, [filteredLeads]);

  const parseExtras = (extras: string | null): Record<string, any> => {
    if (!extras) return {};
    try {
      return JSON.parse(extras);
    } catch {
      return {};
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${mins}`;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterLeadType("ALL");
    setFilterSyncStatus("ALL");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters =
    searchQuery || filterLeadType !== "ALL" || filterSyncStatus !== "ALL" || filterDateFrom || filterDateTo;

  // Build Excel data from filtered leads
  const buildExcelData = () => {
    return filteredLeads.map((lead, index) => {
      const extras = parseExtras(lead.extras);
      const base: Record<string, any> = {
        "S.No": index + 1,
        "Full Name": lead.fullName,
        Email: lead.email,
        Phone: lead.phone || "",
        Designation: lead.designation || "",
        "School Name": lead.schoolName || "",
        City: lead.city || "",
        "CBSE Affiliation No": lead.cbseAffiliationNo || "",
        "Total Students": lead.totalStudents || "",
        "Classes Offered": lead.classesOffered || "",
        "Lead Type": lead.leadType,
        Source: lead.source || "",
        "Odoo Status": lead.odooSyncStatus,
        "Odoo Lead ID": lead.odooLeadId || "",
        "Created At": formatDate(lead.createdAt),
      };
      // Flatten extras into columns
      for (const key of allExtrasKeys) {
        base[key] = extras[key] ?? "";
      }
      return base;
    });
  };

  const handleDownloadExcel = () => {
    if (filteredLeads.length === 0) {
      showErrorToast("No leads to download.");
      return;
    }

    try {
      const excelData = buildExcelData();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet["!cols"] = [
        { wch: 6 },   // S.No
        { wch: 25 },  // Full Name
        { wch: 28 },  // Email
        { wch: 16 },  // Phone
        { wch: 18 },  // Designation
        { wch: 30 },  // School Name
        { wch: 16 },  // City
        { wch: 20 },  // CBSE Affiliation No
        { wch: 16 },  // Total Students
        { wch: 16 },  // Classes Offered
        { wch: 12 },  // Lead Type
        { wch: 20 },  // Source
        { wch: 12 },  // Odoo Status
        { wch: 14 },  // Odoo Lead ID
        { wch: 20 },  // Created At
        ...allExtrasKeys.map(() => ({ wch: 20 })),
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

      const filename = `Leads_Export_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error("Error downloading leads:", err);
      showErrorToast("Failed to download. Please try again.");
    }
  };

  const handleEmailExcel = async () => {
    if (!emailTo.trim()) {
      setEmailError("Please enter an email address.");
      return;
    }
    if (filteredLeads.length === 0) {
      setEmailError("No leads data to send.");
      return;
    }

    setEmailSending(true);
    setEmailError("");
    setEmailSuccess("");

    try {
      // Generate Excel blob
      const excelData = buildExcelData();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

      const wbOut = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbOut], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const filename = `Leads_Export_${Date.now()}.xlsx`;
      const file = new File([blob], filename, { type: blob.type });

      // Send via existing email endpoint
      const formData = new FormData();
      formData.append("to", emailTo.trim());
      formData.append("subject", `Career-9 Leads Export — ${filteredLeads.length} leads`);
      formData.append(
        "body",
        `Please find attached the leads export containing ${filteredLeads.length} leads.\n\nFilters applied: Lead Type: ${filterLeadType}, Sync Status: ${filterSyncStatus}${filterDateFrom ? ", From: " + filterDateFrom : ""}${filterDateTo ? ", To: " + filterDateTo : ""}${searchQuery ? ", Search: " + searchQuery : ""}`
      );
      formData.append("file", file);

      await sendLeadsEmail(formData);
      setEmailSuccess("Email sent successfully!");
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailTo("");
        setEmailSuccess("");
      }, 2000);
    } catch (err: any) {
      console.error("Error sending email:", err);
      setEmailError(err.response?.data || "Failed to send email. Please try again.");
    } finally {
      setEmailSending(false);
    }
  };

  const leadTypeBadge = (type: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      SCHOOL: { bg: "#2563eb", color: "#fff" },
      PARENT: { bg: "#059669", color: "#fff" },
      STUDENT: { bg: "#d97706", color: "#fff" },
    };
    const c = colors[type] || { bg: "#6b7280", color: "#fff" };
    return (
      <span style={{ background: c.bg, color: c.color, padding: "5px 12px", borderRadius: "4px", fontWeight: 700, fontSize: "0.8rem", display: "inline-block" }}>
        {type}
      </span>
    );
  };

  const syncStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      SYNCED: { bg: "#059669", color: "#fff" },
      PENDING: { bg: "#d97706", color: "#fff" },
      FAILED: { bg: "#dc2626", color: "#fff" },
    };
    const c = colors[status] || { bg: "#6b7280", color: "#fff" };
    return (
      <span style={{ background: c.bg, color: c.color, padding: "5px 12px", borderRadius: "4px", fontWeight: 700, fontSize: "0.8rem", display: "inline-block" }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "24px" }}>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <h4 style={{ color: "#111827", fontWeight: 700, marginBottom: "4px", fontSize: "1.4rem" }}>
              Leads Management
            </h4>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: 0 }}>
              View, filter, and export all captured leads
            </p>
          </div>
          <button
            className="btn d-flex align-items-center gap-2"
            onClick={fetchLeads}
            disabled={loading}
            style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px 16px", fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? "spin" : ""}`}></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
          Filters
        </div>
        <div className="row g-3 align-items-end">
          <div className="col-md-2">
            <label className="form-label" style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 600, marginBottom: "4px" }}>Lead Type</label>
            <select className="form-select" value={filterLeadType} onChange={(e) => setFilterLeadType(e.target.value)} style={{ borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}>
              <option value="ALL">All Types</option>
              <option value="SCHOOL">School</option>
              <option value="PARENT">Parent</option>
              <option value="STUDENT">Student</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label" style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 600, marginBottom: "4px" }}>Odoo Status</label>
            <select className="form-select" value={filterSyncStatus} onChange={(e) => setFilterSyncStatus(e.target.value)} style={{ borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}>
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="SYNCED">Synced</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label" style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 600, marginBottom: "4px" }}>From Date</label>
            <input type="date" className="form-control" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }} />
          </div>
          <div className="col-md-2">
            <label className="form-label" style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 600, marginBottom: "4px" }}>To Date</label>
            <input type="date" className="form-control" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }} />
          </div>
          <div className="col-md-3">
            <label className="form-label" style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 600, marginBottom: "4px" }}>Search</label>
            <div className="position-relative">
              <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
              <input type="text" className="form-control" placeholder="Name, email, phone, school..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem", paddingLeft: "32px" }} />
            </div>
          </div>
          <div className="col-md-1 d-flex align-items-end">
            {hasActiveFilters && (
              <button className="btn d-flex align-items-center gap-1" onClick={clearFilters} style={{ background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: "6px", fontWeight: 600, fontSize: "0.82rem", padding: "8px 12px", whiteSpace: "nowrap" }}>
                <i className="bi bi-x-lg" style={{ fontSize: "0.7rem" }}></i> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: "16px" }}>
        <div className="d-flex align-items-center gap-3">
          <span style={{ background: "#2563eb", color: "#fff", padding: "6px 14px", borderRadius: "4px", fontSize: "0.82rem", fontWeight: 700 }}>
            {filteredLeads.length} Lead{filteredLeads.length !== 1 ? "s" : ""}
          </span>
          {hasActiveFilters && (
            <span style={{ color: "#6b7280", fontSize: "0.82rem" }}>
              of {leads.length} total
            </span>
          )}
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn d-flex align-items-center gap-2"
            onClick={handleDownloadExcel}
            disabled={filteredLeads.length === 0}
            style={{
              background: filteredLeads.length > 0 ? "#059669" : "#e5e7eb",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: filteredLeads.length > 0 ? "#fff" : "#9ca3af",
            }}
          >
            <i className="bi bi-download"></i>
            Download Excel
          </button>
          <button
            className="btn d-flex align-items-center gap-2"
            onClick={() => {
              setShowEmailModal(true);
              setEmailError("");
              setEmailSuccess("");
              setEmailTo("");
            }}
            disabled={filteredLeads.length === 0}
            style={{
              background: filteredLeads.length > 0 ? "#2563eb" : "#e5e7eb",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: filteredLeads.length > 0 ? "#fff" : "#9ca3af",
            }}
          >
            <i className="bi bi-envelope"></i>
            Email Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#2563eb" }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3" style={{ color: "#6b7280" }}>Loading leads...</p>
          </div>
        ) : error ? (
          <div style={{ margin: "20px", padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#b91c1c", fontSize: "0.9rem" }}>
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-inbox" style={{ fontSize: "2.5rem", color: "#d1d5db" }}></i>
            <p className="mt-2" style={{ color: "#6b7280" }}>{leads.length === 0 ? "No leads captured yet." : "No leads match the current filters."}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0" style={{ fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>S.No</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Full Name</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Email</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Phone</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Designation</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>School Name</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>City</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>CBSE Aff. No</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Students</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Classes</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Type</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Source</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Odoo Status</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Extras</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, index) => {
                  const extras = parseExtras(lead.extras);
                  const extrasEntries = Object.entries(extras);
                  return (
                    <tr key={lead.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 14px", color: "#9ca3af", fontWeight: 500 }}>{index + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111827" }}>{lead.fullName}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.email}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.phone || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.designation || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.schoolName || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.city || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.cbseAffiliationNo || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.totalStudents || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{lead.classesOffered || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{leadTypeBadge(lead.leadType)}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563", maxWidth: "150px" }} title={lead.source || ""}>
                        {lead.source ? (lead.source.length > 20 ? lead.source.substring(0, 20) + "..." : lead.source) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {syncStatusBadge(lead.odooSyncStatus)}
                        {lead.odooLeadId && (
                          <small className="d-block" style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: "2px" }}>
                            ID: {lead.odooLeadId}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: "200px" }}>
                        {extrasEntries.length > 0 ? (
                          <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                            {extrasEntries.slice(0, 3).map(([key, value]) => (
                              <div key={key} className="text-truncate" title={`${key}: ${value}`}>
                                <strong>{key}:</strong> {String(value)}
                              </div>
                            ))}
                            {extrasEntries.length > 3 && (
                              <small style={{ color: "#9ca3af" }}>+{extrasEntries.length - 3} more</small>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#d1d5db" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#4b5563", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => !emailSending && setShowEmailModal(false)} style={{ zIndex: 10040 }}></div>
          <div className="modal fade show" style={{ display: "block", zIndex: 10050 }} tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "460px" }}>
              <div className="modal-content" style={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
                <div className="modal-header" style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 20px" }}>
                  <h6 className="modal-title" style={{ color: "#111827", fontWeight: 700 }}>
                    <i className="bi bi-envelope me-2" style={{ color: "#2563eb" }}></i>
                    Email Leads Export
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowEmailModal(false)} disabled={emailSending} aria-label="Close"></button>
                </div>
                <div className="modal-body" style={{ padding: "20px" }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px" }} className="d-flex align-items-center gap-2">
                    <i className="bi bi-file-earmark-excel" style={{ color: "#059669", fontSize: "1.1rem" }}></i>
                    <span style={{ fontSize: "0.85rem", color: "#374151" }}>
                      <strong>{filteredLeads.length} leads</strong> will be attached as Excel
                    </span>
                  </div>
                  <div className="mb-3">
                    <label className="form-label" style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>Recipient Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="Enter email address"
                      value={emailTo}
                      onChange={(e) => { setEmailTo(e.target.value); setEmailError(""); }}
                      disabled={emailSending}
                      style={{ borderRadius: "6px", border: "1px solid #d1d5db", padding: "8px 12px" }}
                    />
                    <small style={{ color: "#9ca3af", fontSize: "0.78rem" }}>For multiple recipients, separate with commas</small>
                  </div>
                  {emailError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "8px 12px", fontSize: "0.85rem", color: "#b91c1c" }}>
                      <i className="bi bi-exclamation-triangle me-2"></i>{emailError}
                    </div>
                  )}
                  {emailSuccess && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "8px 12px", fontSize: "0.85rem", color: "#047857" }}>
                      <i className="bi bi-check-circle me-2"></i>{emailSuccess}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px" }}>
                  <button type="button" className="btn" onClick={() => setShowEmailModal(false)} disabled={emailSending} style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px 20px", fontWeight: 600, color: "#374151", fontSize: "0.85rem" }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleEmailExcel}
                    disabled={emailSending || !emailTo.trim()}
                    style={{
                      background: "#2563eb",
                      border: "none",
                      borderRadius: "6px",
                      padding: "8px 20px",
                      fontWeight: 600,
                      color: "#fff",
                      fontSize: "0.85rem",
                    }}
                  >
                    {emailSending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send me-2"></i>
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
