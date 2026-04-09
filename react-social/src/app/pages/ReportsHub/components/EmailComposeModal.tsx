import React, { useState, useEffect } from "react";
import { getEmailRecipientsForStudent, EmailRecipient } from "../../ReportGeneration/API/BetReportData_APIs";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Student IDs used to fetch contact-person autofill */
  studentIds: number[];
  initialRecipients: { email: string; name: string }[];
  initialSubject: string;
  initialBody: string;
  sending: boolean;
  onSend: (recipients: string[], subject: string, body: string) => void;
};

const EmailComposeModal: React.FC<Props> = ({
  open, onClose, studentIds, initialRecipients, initialSubject, initialBody,
  sending, onSend,
}) => {
  const [recipients, setRecipients] = useState<{ email: string; name: string }[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [suggestedRecipients, setSuggestedRecipients] = useState<EmailRecipient[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Initialize when modal opens
  useEffect(() => {
    if (open) {
      setRecipients(initialRecipients);
      setSubject(initialSubject);
      setBody(initialBody);
      setNewEmail("");
      setSuggestedRecipients([]);
    }
  }, [open, initialRecipients, initialSubject, initialBody]);

  // Fetch contact person emails for autofill
  useEffect(() => {
    if (!open || studentIds.length === 0) return;
    setSuggestionsLoading(true);
    // For single student, fetch their contact persons
    // For multiple, fetch first student's contacts as representative
    const targetId = studentIds[0];
    getEmailRecipientsForStudent(targetId)
      .then((res) => {
        const contacts = (res.data || []).filter(
          (r) => r.role !== "student" // only contact persons, not the student themselves
        );
        setSuggestedRecipients(contacts);
      })
      .catch(() => setSuggestedRecipients([]))
      .finally(() => setSuggestionsLoading(false));
  }, [open, studentIds]);

  const addRecipient = (email: string, name?: string) => {
    const trimmed = email.trim();
    if (!trimmed || recipients.some((r) => r.email === trimmed)) return;
    setRecipients((prev) => [...prev, { email: trimmed, name: name || trimmed }]);
    setNewEmail("");
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1050,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.45)",
    }} onClick={onClose}>
      <div
        style={{
          background: "#fff", borderRadius: 16, width: 600, maxWidth: "95vw",
          maxHeight: "90vh", overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid #e5e7eb",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
            Compose Email
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "1.4rem", color: "#9ca3af", lineHeight: 1, padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Recipients */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", display: "block", marginBottom: 6 }}>
              To
            </label>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6, padding: 8,
              border: "1px solid #e5e7eb", borderRadius: 8, minHeight: 40, background: "#f9fafb",
            }}>
              {recipients.map((r) => (
                <span key={r.email} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#e0e7ff", color: "#4338ca", padding: "3px 10px",
                  borderRadius: 16, fontSize: "0.8rem", fontWeight: 500,
                }}>
                  {r.name !== r.email ? `${r.name} <${r.email}>` : r.email}
                  <button onClick={() => removeRecipient(r.email)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#6366f1", fontSize: "0.9rem", padding: 0, lineHeight: 1,
                  }}>&times;</button>
                </span>
              ))}
              <input
                type="email"
                placeholder="Add email..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addRecipient(newEmail);
                  }
                }}
                style={{
                  border: "none", outline: "none", background: "transparent",
                  flex: "1 1 180px", fontSize: "0.85rem", padding: "4px 0",
                }}
              />
            </div>

            {/* Contact person suggestions */}
            {suggestionsLoading && (
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 6 }}>
                Loading contact persons...
              </div>
            )}
            {suggestedRecipients.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>
                  Contact persons:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {suggestedRecipients.map((cp) => {
                    const alreadyAdded = recipients.some((r) => r.email === cp.email);
                    return (
                      <button
                        key={cp.email}
                        onClick={() => !alreadyAdded && addRecipient(cp.email, cp.name)}
                        disabled={alreadyAdded}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: alreadyAdded ? "#f3f4f6" : "#ecfdf5",
                          color: alreadyAdded ? "#9ca3af" : "#059669",
                          border: `1px solid ${alreadyAdded ? "#e5e7eb" : "#a7f3d0"}`,
                          borderRadius: 16, padding: "3px 10px", fontSize: "0.75rem",
                          fontWeight: 500, cursor: alreadyAdded ? "default" : "pointer",
                        }}
                      >
                        {!alreadyAdded && <span>+</span>}
                        {cp.name} ({cp.designation || cp.role})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", display: "block", marginBottom: 6 }}>
              Subject
            </label>
            <input
              type="text"
              className="form-control form-control-solid"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", display: "block", marginBottom: 6 }}>
              Body (HTML)
            </label>
            <textarea
              className="form-control form-control-solid"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
            />
            <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 4 }}>
              Template variables: {"{{student_name}}"}, {"{{report_link}}"}
            </div>
          </div>

          {/* Send */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-light" onClick={onClose} style={{ borderRadius: 8 }}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={sending || recipients.length === 0}
              onClick={() => onSend(recipients.map((r) => r.email), subject, body)}
              style={{
                background: sending ? "#6c757d" : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                border: "none", borderRadius: 8, padding: "10px 24px",
                fontWeight: 600, color: "white", fontSize: "0.9rem",
              }}
            >
              {sending ? "Sending..." : `Send (${recipients.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailComposeModal;
