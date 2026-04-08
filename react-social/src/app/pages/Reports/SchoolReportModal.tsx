import React, { useState, useEffect } from "react";
import {
  getSchoolReport,
  SchoolReportData,
  SchoolReportMqGroup,
} from "../ReportGeneration/API/BetReportData_APIs";
import { showErrorToast } from "../../utils/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  assessmentId: number;
  assessmentName: string;
  instituteName: string;
  userStudentIds?: number[];
}

const SchoolReportModal: React.FC<Props> = ({
  open,
  onClose,
  assessmentId,
  assessmentName,
  instituteName,
  userStudentIds,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SchoolReportData | null>(null);
  const [expandedMq, setExpandedMq] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    getSchoolReport(assessmentId, userStudentIds)
      .then((res) => {
        setData(res.data);
        // Expand all MQ groups by default
        setExpandedMq(new Set((res.data.mqGroups || []).map((g) => g.mqName)));
      })
      .catch((err) => {
        showErrorToast(
          "Failed to load school report: " +
            (err?.response?.data?.error || err.message)
        );
      })
      .finally(() => setLoading(false));
  }, [open, assessmentId, userStudentIds]);

  if (!open) return null;

  const toggleMq = (name: string) => {
    setExpandedMq((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const getScoreColor = (avg: number, max: number) => {
    if (max === 0) return "#6b7280";
    const pct = avg / max;
    if (pct >= 0.7) return "#059669";
    if (pct >= 0.4) return "#d97706";
    return "#dc2626";
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 960,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 28px",
            borderBottom: "1px solid #e5e7eb",
            background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
            color: "#fff",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>
                School Report
              </h2>
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.85rem",
                  opacity: 0.9,
                }}
              >
                {instituteName} &mdash; {assessmentName}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                width: 32,
                height: 32,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "1.1rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              X
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 28px" }}>
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                color: "#9ca3af",
              }}
            >
              Loading school report...
            </div>
          )}

          {!loading && !data && (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                color: "#9ca3af",
              }}
            >
              No data available.
            </div>
          )}

          {!loading && data && (
            <>
              {/* Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <SummaryCard
                  label="Total Students"
                  value={data.totalStudents}
                  color="#4361ee"
                />
                <SummaryCard
                  label="With Scores"
                  value={data.studentsWithScores}
                  color="#059669"
                />
                <SummaryCard
                  label="Grades"
                  value={data.grades.length}
                  color="#7c3aed"
                />
              </div>

              {/* Grade Breakdown */}
              {data.grades.length > 0 && (
                <div
                  style={{
                    marginBottom: 24,
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 10px",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    Students by Grade
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {data.grades.map((grade) => (
                      <span
                        key={grade}
                        style={{
                          background: "#e0e7ff",
                          color: "#3730a3",
                          padding: "4px 14px",
                          borderRadius: 20,
                          fontSize: "0.8rem",
                          fontWeight: 600,
                        }}
                      >
                        {grade}: {data.gradeStudentCounts[grade] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* MQ/MQT Groups */}
              {data.mqGroups.map((mqGroup) => (
                <MqGroupSection
                  key={mqGroup.mqName}
                  group={mqGroup}
                  expanded={expandedMq.has(mqGroup.mqName)}
                  onToggle={() => toggleMq(mqGroup.mqName)}
                  grades={data.grades}
                  getScoreColor={getScoreColor}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => (
  <div
    style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "14px 18px",
      borderLeft: `4px solid ${color}`,
    }}
  >
    <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>
      {label}
    </div>
    <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>
      {value}
    </div>
  </div>
);

const MqGroupSection: React.FC<{
  group: SchoolReportMqGroup;
  expanded: boolean;
  onToggle: () => void;
  grades: string[];
  getScoreColor: (avg: number, max: number) => string;
}> = ({ group, expanded, onToggle, grades, getScoreColor }) => {
  // Compute overall MQ average across all MQTs
  const mqAvg =
    group.mqts.length > 0
      ? group.mqts.reduce((sum, m) => sum + m.average, 0) / group.mqts.length
      : 0;

  return (
    <div
      style={{
        marginBottom: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* MQ Header */}
      <div
        onClick={onToggle}
        style={{
          padding: "14px 20px",
          background: expanded ? "#f0f4ff" : "#f8fafc",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "background 0.2s",
        }}
      >
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" }}>
            {group.mqName}
          </span>
          <span
            style={{
              marginLeft: 12,
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            {group.mqts.length} dimension{group.mqts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#4361ee",
            }}
          >
            Avg: {mqAvg.toFixed(1)}
          </span>
          <span
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            &#9660;
          </span>
        </div>
      </div>

      {/* MQT Table */}
      {expanded && (
        <div style={{ padding: "0 20px 16px", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
            }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={tblThStyle}>Dimension (MQT)</th>
                <th style={{ ...tblThStyle, textAlign: "center" }}>Avg</th>
                <th style={{ ...tblThStyle, textAlign: "center" }}>Min</th>
                <th style={{ ...tblThStyle, textAlign: "center" }}>Max</th>
                <th style={{ ...tblThStyle, textAlign: "center" }}>Responses</th>
                {grades.map((g) => (
                  <th key={g} style={{ ...tblThStyle, textAlign: "center" }}>
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.mqts.map((mqt) => (
                <tr key={mqt.mqtId}>
                  <td style={tblTdStyle}>
                    <span style={{ fontWeight: 600 }}>{mqt.mqtName}</span>
                  </td>
                  <td style={{ ...tblTdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: getScoreColor(mqt.average, mqt.max),
                      }}
                    >
                      {mqt.average.toFixed(1)}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tblTdStyle,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    {mqt.min}
                  </td>
                  <td
                    style={{
                      ...tblTdStyle,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    {mqt.max}
                  </td>
                  <td
                    style={{
                      ...tblTdStyle,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    {mqt.count}
                  </td>
                  {grades.map((g) => {
                    const gw = mqt.gradeWise[g];
                    return (
                      <td
                        key={g}
                        style={{
                          ...tblTdStyle,
                          textAlign: "center",
                        }}
                      >
                        {gw ? (
                          <span style={{ fontWeight: 600 }}>
                            {gw.average.toFixed(1)}
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "#9ca3af",
                                marginLeft: 2,
                              }}
                            >
                              ({gw.count})
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: "#d1d5db" }}>&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const tblThStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: "0.78rem",
  color: "#374151",
  borderBottom: "2px solid #e0e0e0",
  whiteSpace: "nowrap",
};

const tblTdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "0.82rem",
  borderBottom: "1px solid #f0f0f0",
  whiteSpace: "nowrap",
};

export default SchoolReportModal;
