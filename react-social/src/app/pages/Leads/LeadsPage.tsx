import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { getAllLeads, sendLeadsEmail, Lead } from "./API/Leads_APIs";

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
      alert("No leads to download.");
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
      alert("Failed to download. Please try again.");
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
      SCHOOL: { bg: "rgba(67, 97, 238, 0.1)", color: "#4361ee" },
      PARENT: { bg: "rgba(16, 185, 129, 0.1)", color: "#059669" },
      STUDENT: { bg: "rgba(245, 158, 11, 0.1)", color: "#d97706" },
    };
    const c = colors[type] || { bg: "#f0f0f0", color: "#666" };
    return (
      <span className="badge" style={{ background: c.bg, color: c.color, padding: "5px 10px", borderRadius: "6px", fontWeight: 600, fontSize: "0.8rem" }}>
        {type}
      </span>
    );
  };

  const syncStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      SYNCED: { bg: "rgba(16, 185, 129, 0.1)", color: "#059669" },
      PENDING: { bg: "rgba(245, 158, 11, 0.1)", color: "#d97706" },
      FAILED: { bg: "rgba(230, 57, 70, 0.1)", color: "#e63946" },
    };
    const c = colors[status] || { bg: "#f0f0f0", color: "#666" };
    return (
      <span className="badge" style={{ background: c.bg, color: c.color, padding: "5px 10px", borderRadius: "6px", fontWeight: 600, fontSize: "0.8rem" }}>
        {status}
      </span>
    );
  };

  return (
    <div className="container-fluid px-4 py-4">
      {/* Header */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "16px" }}>
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h4 className="mb-1" style={{ color: "#1a1a2e", fontWeight: 700 }}>
                <i className="bi bi-people-fill me-2" style={{ color: "#4361ee" }}></i>
                Leads Management
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                View and manage all captured leads
              </p>
            </div>
            <div className="d-flex gap-2">
              <button className="btn d-flex align-items-center gap-2" onClick={fetchLeads} disabled={loading} style={{ background: "#f0f0f0", border: "none", borderRadius: "10px", padding: "0.5rem 1rem", fontWeight: 600 }}>
                <i className={`bi bi-arrow-clockwise ${loading ? "spin" : ""}`}></i>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "16px" }}>
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-2">
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem", color: "#555" }}>Lead Type</label>
              <select className="form-select" value={filterLeadType} onChange={(e) => setFilterLeadType(e.target.value)} style={{ borderRadius: "10px", border: "2px solid #e0e0e0" }}>
                <option value="ALL">All Types</option>
                <option value="SCHOOL">School</option>
                <option value="PARENT">Parent</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem", color: "#555" }}>Odoo Status</label>
              <select className="form-select" value={filterSyncStatus} onChange={(e) => setFilterSyncStatus(e.target.value)} style={{ borderRadius: "10px", border: "2px solid #e0e0e0" }}>
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="SYNCED">Synced</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem", color: "#555" }}>Date From</label>
              <input type="date" className="form-control" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ borderRadius: "10px", border: "2px solid #e0e0e0" }} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem", color: "#555" }}>Date To</label>
              <input type="date" className="form-control" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ borderRadius: "10px", border: "2px solid #e0e0e0" }} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem", color: "#555" }}>Search</label>
              <input type="text" className="form-control" placeholder="Name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ borderRadius: "10px", border: "2px solid #e0e0e0" }} />
            </div>
            <div className="col-md-2 d-flex gap-2">
              {hasActiveFilters && (
                <button className="btn btn-outline-secondary d-flex align-items-center gap-1" onClick={clearFilters} style={{ borderRadius: "10px", fontWeight: 600, fontSize: "0.85rem" }}>
                  <i className="bi bi-x-circle"></i> Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary + Actions */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-3">
          <span className="badge" style={{ background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)", color: "#fff", padding: "8px 16px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 600 }}>
            {filteredLeads.length} Lead{filteredLeads.length !== 1 ? "s" : ""}
          </span>
          {hasActiveFilters && (
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
              (of {leads.length} total)
            </span>
          )}
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn d-flex align-items-center gap-2"
            onClick={handleDownloadExcel}
            disabled={filteredLeads.length === 0}
            style={{
              background: filteredLeads.length > 0 ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "#e0e0e0",
              border: "none",
              borderRadius: "10px",
              padding: "0.5rem 1.2rem",
              fontWeight: 600,
              color: filteredLeads.length > 0 ? "#fff" : "#9e9e9e",
              cursor: filteredLeads.length > 0 ? "pointer" : "not-allowed",
              boxShadow: filteredLeads.length > 0 ? "0 4px 15px rgba(16, 185, 129, 0.3)" : "none",
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
              background: filteredLeads.length > 0 ? "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)" : "#e0e0e0",
              border: "none",
              borderRadius: "10px",
              padding: "0.5rem 1.2rem",
              fontWeight: 600,
              color: filteredLeads.length > 0 ? "#fff" : "#9e9e9e",
              cursor: filteredLeads.length > 0 ? "pointer" : "not-allowed",
              boxShadow: filteredLeads.length > 0 ? "0 4px 15px rgba(67, 97, 238, 0.3)" : "none",
            }}
          >
            <i className="bi bi-envelope"></i>
            Email Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: "16px", overflow: "hidden" }}>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 text-muted">Loading leads...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger m-4" style={{ borderRadius: "10px" }}>
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }}></i>
              <p className="mt-3 text-muted">{leads.length === 0 ? "No leads captured yet." : "No leads match the current filters."}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ background: "#f8f9fa" }}>
                  <tr>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e", width: "60px" }}>S.No</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Full Name</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Email</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Phone</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Designation</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>School Name</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>City</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>CBSE Aff. No</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Total Students</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Classes Offered</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Type</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Source</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Odoo Status</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Extras</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600, color: "#1a1a2e" }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, index) => {
                    const extras = parseExtras(lead.extras);
                    const extrasEntries = Object.entries(extras);
                    return (
                      <tr key={lead.id}>
                        <td style={{ padding: "12px 16px" }}>
                          <span className="badge bg-light text-dark" style={{ fontSize: "0.85rem" }}>{index + 1}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#333" }}>{lead.fullName}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.email}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.phone || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.designation || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.schoolName || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.city || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.cbseAffiliationNo || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.totalStudents || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#555" }}>{lead.classesOffered || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>{leadTypeBadge(lead.leadType)}</td>
                        <td style={{ padding: "12px 16px", color: "#555", maxWidth: "150px" }} title={lead.source || ""}>
                          {lead.source ? (lead.source.length > 20 ? lead.source.substring(0, 20) + "..." : lead.source) : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {syncStatusBadge(lead.odooSyncStatus)}
                          {lead.odooLeadId && (
                            <small className="d-block text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                              ID: {lead.odooLeadId}
                            </small>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", maxWidth: "200px" }}>
                          {extrasEntries.length > 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>
                              {extrasEntries.slice(0, 3).map(([key, value]) => (
                                <div key={key} className="text-truncate" title={`${key}: ${value}`}>
                                  <strong>{key}:</strong> {String(value)}
                                </div>
                              ))}
                              {extrasEntries.length > 3 && (
                                <small className="text-muted">+{extrasEntries.length - 3} more</small>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: "0.8rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#555", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
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
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => !emailSending && setShowEmailModal(false)} style={{ zIndex: 10040 }}></div>
          <div className="modal fade show" style={{ display: "block", zIndex: 10050 }} tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "480px" }}>
              <div className="modal-content" style={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
                <div className="modal-header" style={{ borderBottom: "2px solid #f0f0f0", padding: "1.5rem" }}>
                  <h5 className="modal-title" style={{ color: "#1a1a2e", fontWeight: 700 }}>
                    <i className="bi bi-envelope me-2" style={{ color: "#4361ee" }}></i>
                    Email Leads Export
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowEmailModal(false)} disabled={emailSending} aria-label="Close"></button>
                </div>
                <div className="modal-body" style={{ padding: "2rem" }}>
                  <div className="mb-3">
                    <div className="card border-0" style={{ background: "#f8f9fa", borderRadius: "10px" }}>
                      <div className="card-body p-3 d-flex align-items-center gap-2">
                        <i className="bi bi-file-earmark-excel" style={{ color: "#059669", fontSize: "1.2rem" }}></i>
                        <div>
                          <strong style={{ fontSize: "0.9rem" }}>{filteredLeads.length} leads</strong>
                          <span className="text-muted" style={{ fontSize: "0.85rem" }}> will be included in the Excel attachment</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold" style={{ fontSize: "0.9rem", color: "#333" }}>Recipient Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="Enter email address"
                      value={emailTo}
                      onChange={(e) => { setEmailTo(e.target.value); setEmailError(""); }}
                      disabled={emailSending}
                      style={{ borderRadius: "10px", border: "2px solid #e0e0e0", padding: "0.7rem 1rem" }}
                    />
                    <small className="text-muted">For multiple recipients, separate with commas</small>
                  </div>
                  {emailError && (
                    <div className="alert alert-danger py-2" style={{ borderRadius: "10px", fontSize: "0.85rem" }}>
                      <i className="bi bi-exclamation-triangle me-2"></i>{emailError}
                    </div>
                  )}
                  {emailSuccess && (
                    <div className="alert alert-success py-2" style={{ borderRadius: "10px", fontSize: "0.85rem" }}>
                      <i className="bi bi-check-circle me-2"></i>{emailSuccess}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ borderTop: "2px solid #f0f0f0", padding: "1.5rem" }}>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEmailModal(false)} disabled={emailSending} style={{ borderRadius: "10px", padding: "0.5rem 1.5rem", fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleEmailExcel}
                    disabled={emailSending || !emailTo.trim()}
                    style={{
                      background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.5rem 1.5rem",
                      fontWeight: 600,
                      color: "#fff",
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
