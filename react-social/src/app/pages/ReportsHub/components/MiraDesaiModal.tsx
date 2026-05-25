import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  isNavigator: boolean;
  generating: boolean;
  exportingMQT: boolean;
  onGenerateDataExcel: () => void;
  onExportBetCoreData: () => void;
  onSchoolReport: () => void;
  visibleSelectedCount: number;
  displayedCount: number;
};

const MiraDesaiModal: React.FC<Props> = ({
  open, onClose, isNavigator, generating, exportingMQT,
  onGenerateDataExcel, onExportBetCoreData, onSchoolReport,
  visibleSelectedCount, displayedCount,
}) => {
  if (!open) return null;

  const countLabel = visibleSelectedCount > 0
    ? ` (${visibleSelectedCount} selected)`
    : ` (All ${displayedCount})`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1050,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.45)",
    }} onClick={onClose}>
      <div
        style={{
          background: "#fff", borderRadius: 16, padding: 0,
          width: 440, maxWidth: "90vw",
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
            Mira Desai
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
          {isNavigator && (
            <button
              className="btn"
              onClick={onGenerateDataExcel}
              disabled={generating}
              style={{
                background: generating
                  ? "#6c757d"
                  : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                border: "none", borderRadius: 10, padding: "12px 20px",
                fontWeight: 600, color: "white", fontSize: "0.9rem",
                boxShadow: generating ? "none" : "0 4px 12px rgba(67, 97, 238, 0.3)",
                width: "100%", textAlign: "left",
              }}
            >
              {generating ? "Generating..." : `Generate Data Excel${countLabel}`}
            </button>
          )}

          <button
            className="btn"
            onClick={onExportBetCoreData}
            disabled={exportingMQT}
            style={{
              background: exportingMQT
                ? "#6c757d"
                : "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
              border: "none", borderRadius: 10, padding: "12px 20px",
              fontWeight: 600, color: "white", fontSize: "0.9rem",
              boxShadow: exportingMQT ? "none" : "0 4px 12px rgba(124, 58, 237, 0.3)",
              width: "100%", textAlign: "left",
            }}
          >
            {exportingMQT ? "Exporting..." : `BET Core Data${countLabel}`}
          </button>

          <button
            className="btn"
            onClick={() => { onSchoolReport(); onClose(); }}
            style={{
              background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
              border: "none", borderRadius: 10, padding: "12px 20px",
              fontWeight: 600, color: "white", fontSize: "0.9rem",
              boxShadow: "0 4px 12px rgba(30, 58, 95, 0.3)",
              width: "100%", textAlign: "left",
            }}
          >
            School Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiraDesaiModal;
