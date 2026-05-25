import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  sendingEmail: boolean;
  sendingWhatsApp: boolean;
  onBulkEmail: () => void;
  onBulkWhatsApp: () => void;
};

const BulkSendModal: React.FC<Props> = ({
  open, onClose, selectedCount, sendingEmail, sendingWhatsApp,
  onBulkEmail, onBulkWhatsApp,
}) => {
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1050,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.45)",
    }} onClick={onClose}>
      <div
        style={{
          background: "#fff", borderRadius: 16, padding: 0,
          width: 400, maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid #e5e7eb",
        }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
            Bulk Send ({selectedCount} students)
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

        {/* Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            className="btn"
            onClick={() => { onBulkEmail(); onClose(); }}
            disabled={sendingEmail}
            style={{
              background: sendingEmail
                ? "#6c757d"
                : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
              border: "none", borderRadius: 10, padding: "14px 20px",
              fontWeight: 600, color: "white", fontSize: "0.9rem",
              boxShadow: sendingEmail ? "none" : "0 4px 12px rgba(67, 97, 238, 0.3)",
              width: "100%", display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {sendingEmail ? "Sending..." : `Bulk Send Email (${selectedCount})`}
          </button>

          <button
            className="btn"
            onClick={() => { onBulkWhatsApp(); onClose(); }}
            disabled={sendingWhatsApp}
            style={{
              background: sendingWhatsApp
                ? "#6c757d"
                : "linear-gradient(135deg, #059669 0%, #047857 100%)",
              border: "none", borderRadius: 10, padding: "14px 20px",
              fontWeight: 600, color: "white", fontSize: "0.9rem",
              boxShadow: sendingWhatsApp ? "none" : "0 4px 12px rgba(5, 150, 105, 0.3)",
              width: "100%", display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {sendingWhatsApp ? "Sending..." : `Bulk Send WhatsApp (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkSendModal;
