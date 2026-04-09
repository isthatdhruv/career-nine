import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  getSchoolReport,
  SchoolReportData,
  SchoolReportMqGroup,
  getSavedSchoolReport,
  saveSchoolReport,
} from "../ReportGeneration/API/BetReportData_APIs";
import { showErrorToast, showSuccessToast } from "../../utils/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  assessmentId: number;
  assessmentName: string;
  instituteName: string;
  instituteCode: number;
  userStudentIds?: number[];
}

// ── Cache to avoid redundant API calls ──
const reportCache = new Map<string, SchoolReportData>();
function cacheKey(assessmentId: number, ids?: number[]): string {
  const sorted = ids && ids.length > 0 ? [...ids].sort().join(",") : "all";
  return `${assessmentId}:${sorted}`;
}

// ── Personality (Holland RIASEC) friendly labels ──
const PERSONALITY_FRIENDLY: Record<string, string> = {
  realistic: "Doer",
  investigative: "Thinker",
  artistic: "Creator",
  social: "Helper",
  enterprising: "Persuader",
  conventional: "Organizer",
};

const PERSONALITY_INSIGHTS: Record<string, { theme: string; text: string }> = {
  organizer: {
    theme: "Need for stability",
    text: "The education system reinforces structured thinking and secure paths, making stable careers like administration, banking, or civil services attractive and socially acceptable.",
  },
  doer: {
    theme: "Need for Independence",
    text: "Students seek hands-on experiences and early financial independence. Careers in technical fields or skilled trades provide immediate gratification and a clear livelihood path.",
  },
  thinker: {
    theme: "Emphasis on logic",
    text: "With increasing cognitive abilities, students enjoy solving problems. Science and math-focused education systems and societal admiration for engineering guide their aspirations.",
  },
  creator: {
    theme: "Risk free career",
    text: "Students and families, especially from low- to middle-income backgrounds, often avoid artistic careers due to perceived instability, despite the student's true inclination.",
  },
  persuader: {
    theme: "Lack of role models",
    text: "Lack of visible success stories in arts, social service, or business-related fields limits student imagination and restricts their aspiration to community-approved paths.",
  },
  helper: {
    theme: "Empathy-driven",
    text: "Social intelligence is a huge asset. Students with high helper inclination thrive in counseling, healthcare, teaching, and community-oriented careers.",
  },
};

const INTELLIGENCE_INSIGHTS: Record<string, string> = {
  intrapersonal:
    "Students are internally strong and reflective\u2014ideal for self-paced learning, journaling, and emotional resilience programs. Tap into their silent strength.",
  logical:
    "High numbers indicate alignment with system priorities, but risk of mistaking exam skills for real-world reasoning. Use open-ended problems to test depth.",
  "logical-mathematical":
    "High numbers indicate alignment with system priorities, but risk of mistaking exam skills for real-world reasoning. Use open-ended problems to test depth.",
  "bodily-kinesthetic":
    "Students crave movement and hands-on tasks. Traditional lectures disengage them. Introduce physical models, field tasks, or roleplays.",
  interpersonal:
    "Social intelligence is a huge asset. Peer-to-peer learning and leadership roles can multiply engagement.",
  "visual-spatial":
    "Many have untapped creative thinking and visual memory. Encourage visual organizers, diagrams, and art-integrated learning.",
  musical:
    "Rhythmic and auditory intelligence is alive despite low formal exposure. Use music in memory tasks, storytelling, and cultural events.",
  naturalistic:
    "Despite limited green exposure, nature-oriented thinking survives. Schools can reignite this through eco clubs, nature-based assignments, and school gardens.",
  linguistic:
    "The least dominant. Language isn't the problem\u2014exposure is. Reading clubs, debate circles, and storytelling can rebuild this domain.",
};

const PIE_COLORS = [
  "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5",
  "#70AD47", "#264478", "#9B59B6", "#E74C3C", "#2ECC71",
];

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

const SchoolReportModal: React.FC<Props> = ({
  open,
  onClose,
  assessmentId,
  assessmentName,
  instituteName,
  instituteCode,
  userStudentIds,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SchoolReportData | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !assessmentId) return;

    // 1. Check in-memory cache first
    const key = cacheKey(assessmentId, userStudentIds);
    const cached = reportCache.get(key);
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    setData(null);
    setSavedToDb(false);

    // 2. Try loading from DB (only for full-school reports, not filtered by students)
    const isFullSchool = !userStudentIds || userStudentIds.length === 0;
    const dbPromise = isFullSchool && instituteCode
      ? getSavedSchoolReport(instituteCode, assessmentId)
          .then((res) => {
            if (res.data?.reportData) {
              const rd = res.data.reportData as SchoolReportData;
              setData(rd);
              reportCache.set(key, rd);
              setSavedToDb(true);
              return rd;
            }
            return null;
          })
          .catch(() => null)
      : Promise.resolve(null);

    dbPromise.then((dbData) => {
      if (dbData) {
        setLoading(false);
        return;
      }

      // 3. Fetch live data from aggregation endpoint
      getSchoolReport(assessmentId, userStudentIds)
        .then((res) => {
          setData(res.data);
          reportCache.set(key, res.data);

          // 4. Auto-save to DB for full-school reports
          if (isFullSchool && instituteCode) {
            saveSchoolReport({
              instituteCode,
              assessmentId,
              instituteName,
              assessmentName,
              reportData: res.data,
              totalStudents: res.data.totalStudents,
              studentsWithScores: res.data.studentsWithScores,
            })
              .then(() => setSavedToDb(true))
              .catch(() => {}); // Silent fail for save
          }
        })
        .catch((err) => {
          showErrorToast(
            "Failed to load school report: " +
              (err?.response?.data?.error || err.message)
          );
        })
        .finally(() => setLoading(false));
    });
  }, [open, assessmentId, userStudentIds, instituteCode, instituteName, assessmentName]);

  // Scroll to top when opened
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);

  if (!open) return null;

  // Identify personality & intelligence MQ groups by keyword matching
  const personalityGroup = data?.mqGroups.find((g) =>
    g.mqName.toLowerCase().includes("personality")
  );
  const intelligenceGroup = data?.mqGroups.find((g) =>
    g.mqName.toLowerCase().includes("intelligence")
  );
  const otherGroups = data?.mqGroups.filter(
    (g) => g !== personalityGroup && g !== intelligenceGroup
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 1100,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* ── HEADER (Cover Page style) ── */}
        <div
          style={{
            padding: "28px 36px",
            background: "linear-gradient(135deg, #1F4E79 0%, #2d6aa5 100%)",
            color: "#fff",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.7rem", letterSpacing: 2, textTransform: "uppercase", opacity: 0.7, marginBottom: 4 }}>
                NAVIGATOR 360
              </div>
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, fontFamily: "Georgia, serif" }}>
                Psychometric School Report
              </h2>
              <div style={{ marginTop: 8, fontSize: "0.95rem", opacity: 0.9, fontFamily: "Georgia, serif" }}>
                {instituteName}
              </div>
              <div style={{ marginTop: 2, fontSize: "0.8rem", opacity: 0.7 }}>
                Assessment: {assessmentName} &bull; www.Career-9.com
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {savedToDb && (
                <span style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: 12 }}>
                  Saved to DB
                </span>
              )}
              <button
                onClick={() => {
                  // Force refresh: clear cache and re-fetch live
                  const key = cacheKey(assessmentId, userStudentIds);
                  reportCache.delete(key);
                  setData(null);
                  setSavedToDb(false);
                  setLoading(true);
                  getSchoolReport(assessmentId, userStudentIds)
                    .then((res) => {
                      setData(res.data);
                      reportCache.set(key, res.data);
                      const isFullSchool = !userStudentIds || userStudentIds.length === 0;
                      if (isFullSchool && instituteCode) {
                        saveSchoolReport({
                          instituteCode,
                          assessmentId,
                          instituteName,
                          assessmentName,
                          reportData: res.data,
                          totalStudents: res.data.totalStudents,
                          studentsWithScores: res.data.studentsWithScores,
                        })
                          .then(() => { setSavedToDb(true); showSuccessToast("School report refreshed and saved."); })
                          .catch(() => {});
                      }
                    })
                    .catch((err) => {
                      showErrorToast("Refresh failed: " + (err?.response?.data?.error || err.message));
                    })
                    .finally(() => setLoading(false));
                }}
                disabled={loading}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: 8,
                  cursor: loading ? "default" : "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? "..." : "Refresh"}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#fff",
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                }}
              >
                X
              </button>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "28px 36px", fontFamily: "Georgia, serif" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 64, color: "#9ca3af" }}>
              <div style={{ fontSize: "1.1rem", marginBottom: 8 }}>Loading school report...</div>
            </div>
          )}

          {!loading && !data && (
            <div style={{ textAlign: "center", padding: 64, color: "#9ca3af" }}>
              No data available.
            </div>
          )}

          {!loading && data && (
            <>
              {/* ═══ SECTION: Assessment Summary ═══ */}
              <SectionHeading title="First Step Towards Brighter Future" />
              <h3 style={{ textAlign: "center", color: "#374151", fontSize: "1rem", fontWeight: 600, margin: "0 0 20px", textDecoration: "underline" }}>
                Assessment Summary
              </h3>

              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 28 }}>
                {/* Grade Table */}
                <div style={{ flex: 1, minWidth: 280 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
                    <thead>
                      <tr style={{ background: "#F2DBDB" }}>
                        <th style={pdfThStyle}>Navigator Type</th>
                        <th style={pdfThStyle}>Grade</th>
                        <th style={pdfThStyle}>Number of Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.grades.map((grade, i) => (
                        <tr key={grade} style={{ background: i % 2 === 1 ? "#F5F5F5" : "#fff" }}>
                          <td style={pdfTdStyle}><b>Career Navigator</b></td>
                          <td style={pdfTdStyle}>{grade}</td>
                          <td style={pdfTdStyle}><b>{data.gradeStudentCounts[grade] || 0}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 16, fontStyle: "italic", fontSize: "0.85rem" }}>
                    <b>Total Students: Career Navigator: {data.totalStudents}</b>
                  </div>
                  <div style={{ fontStyle: "italic", fontSize: "0.85rem", marginTop: 4 }}>
                    <b>Students with Score Data: {data.studentsWithScores}</b>
                  </div>
                </div>
              </div>

              {/* ═══ SECTION: Personality Profile ═══ */}
              {personalityGroup && (
                <PersonalitySection group={personalityGroup} totalStudents={data.totalStudents} />
              )}

              {/* ═══ SECTION: Intelligence Profile ═══ */}
              {intelligenceGroup && (
                <IntelligenceSection group={intelligenceGroup} totalStudents={data.totalStudents} />
              )}

              {/* ═══ SECTION: Other MQ Groups (Abilities, etc.) ═══ */}
              {otherGroups && otherGroups.length > 0 && otherGroups.map((group) => (
                <GenericMqSection key={group.mqName} group={group} grades={data.grades} />
              ))}

              {/* ═══ SECTION: Learning Assets ═══ */}
              <LearningAssetsSection />

              {/* ═══ SECTION: Strategic Guidance ═══ */}
              <StrategicGuidanceSection instituteName={instituteName} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// SECTION HEADING (matches PDF style)
// ══════════════════════════════════════════════════════════

const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <h2
    style={{
      fontFamily: "Georgia, serif",
      fontSize: "1.4rem",
      fontWeight: 700,
      color: "#1F4E79",
      textAlign: "center",
      margin: "32px 0 16px",
      paddingBottom: 8,
      borderBottom: "2px solid #1F4E79",
    }}
  >
    {title}
  </h2>
);

// ══════════════════════════════════════════════════════════
// PIE CHART (CSS conic-gradient)
// ══════════════════════════════════════════════════════════

const PieChart: React.FC<{
  segments: { label: string; value: number; color: string }[];
  size?: number;
}> = ({ segments, size = 240 }) => {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let cumPct = 0;
  const stops = segments
    .map((seg) => {
      const start = cumPct;
      cumPct += (seg.value / total) * 100;
      return `${seg.color} ${start.toFixed(2)}% ${cumPct.toFixed(2)}%`;
    })
    .join(", ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${stops})`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      />
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 14, justifyContent: "center" }}>
        {segments.map((seg) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(0) : "0";
          return (
            <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span>{seg.label} <b>{pct}%</b></span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// PERSONALITY SECTION (Page 4 of PDF)
// ══════════════════════════════════════════════════════════

const PersonalitySection: React.FC<{ group: SchoolReportMqGroup; totalStudents: number }> = ({ group, totalStudents }) => {
  const segments = useMemo(() => {
    return group.mqts.map((mqt, i) => {
      const key = mqt.mqtName.toLowerCase();
      const friendly = PERSONALITY_FRIENDLY[key];
      const label = friendly ? `${friendly}` : mqt.mqtName;
      return { label, value: mqt.average, color: PIE_COLORS[i % PIE_COLORS.length], mqt };
    });
  }, [group]);

  // Sort by value descending for the interpretation table
  const sorted = useMemo(() => [...segments].sort((a, b) => b.value - a.value), [segments]);

  return (
    <>
      <SectionHeading title="Building Foundations of Personality" />
      <p style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>
        At the age of 16-17, students are in a critical period of identity formation and are actively seeking to define their place in the world.
        Their career choices are a central part of this process and are heavily influenced by the psychological needs of their age group.
      </p>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 24 }}>
        {/* Interpretation Table */}
        <div style={{ flex: 1, minWidth: 340, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
            <thead>
              <tr style={{ background: "#F2DBDB" }}>
                <th style={pdfThStyle}>Domain</th>
                <th style={pdfThStyle}>Interpretation & Career Implication</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((seg, i) => {
                const key = seg.label.toLowerCase();
                const insight = PERSONALITY_INSIGHTS[key];
                return (
                  <tr key={seg.label} style={{ background: i % 2 === 1 ? "#F5F5F5" : "#fff" }}>
                    <td style={pdfTdStyle}>
                      <b>{seg.label}</b>
                      {insight && <div style={{ fontSize: "0.75rem", color: "#6b7280", fontStyle: "italic" }}>{insight.theme}</div>}
                    </td>
                    <td style={pdfTdStyle}>
                      {insight ? insight.text : <span style={{ color: "#9ca3af" }}>-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pie Chart */}
        <div style={{ flexShrink: 0 }}>
          <h4 style={{ textAlign: "center", color: "#374151", fontSize: "0.9rem", fontWeight: 600, margin: "0 0 12px" }}>
            Personality Profile
          </h4>
          <PieChart segments={segments} />
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════
// INTELLIGENCE SECTION (Page 5 of PDF)
// ══════════════════════════════════════════════════════════

const IntelligenceSection: React.FC<{ group: SchoolReportMqGroup; totalStudents: number }> = ({ group, totalStudents }) => {
  const segments = useMemo(() => {
    return group.mqts.map((mqt, i) => ({
      label: mqt.mqtName,
      value: mqt.average,
      color: PIE_COLORS[i % PIE_COLORS.length],
      mqt,
    }));
  }, [group]);

  const sorted = useMemo(() => [...segments].sort((a, b) => b.value - a.value), [segments]);

  return (
    <>
      <SectionHeading title="Unlocking Brilliance" />

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 24 }}>
        {/* Interpretation Table */}
        <div style={{ flex: 1, minWidth: 340, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
            <thead>
              <tr style={{ background: "#F2DBDB" }}>
                <th style={pdfThStyle}>Intelligence</th>
                <th style={pdfThStyle}>Insight</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((seg, i) => {
                const key = seg.label.toLowerCase().replace(/[\s_]+/g, "-");
                const insight =
                  INTELLIGENCE_INSIGHTS[key] ||
                  INTELLIGENCE_INSIGHTS[seg.label.toLowerCase()] ||
                  "";
                return (
                  <tr key={seg.label} style={{ background: i % 2 === 1 ? "#F5F5F5" : "#fff" }}>
                    <td style={pdfTdStyle}><b>{seg.label}</b></td>
                    <td style={pdfTdStyle}>
                      {insight || <span style={{ color: "#9ca3af" }}>-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pie Chart */}
        <div style={{ flexShrink: 0 }}>
          <h4 style={{ textAlign: "center", color: "#374151", fontSize: "0.9rem", fontWeight: 600, margin: "0 0 12px" }}>
            Intelligence Summary
          </h4>
          <PieChart segments={segments} />
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════
// GENERIC MQ SECTION (for Abilities and other groups)
// ══════════════════════════════════════════════════════════

const GenericMqSection: React.FC<{ group: SchoolReportMqGroup; grades: string[] }> = ({ group, grades }) => {
  const [expanded, setExpanded] = useState(true);
  const totalAvg = group.mqts.length > 0
    ? group.mqts.reduce((s, m) => s + m.average, 0) / group.mqts.length
    : 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeading title={group.mqName} />

      {/* Bar-style visualization */}
      <div style={{ marginBottom: 20 }}>
        {group.mqts.map((mqt, i) => {
          const maxVal = Math.max(...group.mqts.map((m) => m.max), 1);
          const pct = maxVal > 0 ? (mqt.average / maxVal) * 100 : 0;
          return (
            <div key={mqt.mqtId} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 180, fontSize: "0.8rem", fontWeight: 600, color: "#374151", textAlign: "right", flexShrink: 0 }}>
                {mqt.mqtName}
              </div>
              <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 4, height: 18, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(pct, 100)}%`,
                    background: PIE_COLORS[i % PIE_COLORS.length],
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <div style={{ width: 50, fontSize: "0.78rem", fontWeight: 700, color: "#374151" }}>
                {mqt.average.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable grade-wise table */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer", fontSize: "0.8rem", color: "#4361ee", fontWeight: 600, marginBottom: 8 }}
      >
        {expanded ? "\u25BC" : "\u25B6"} Grade-wise Breakdown
      </div>

      {expanded && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
            <thead>
              <tr style={{ background: "#F2DBDB" }}>
                <th style={pdfThStyle}>Dimension</th>
                <th style={{ ...pdfThStyle, textAlign: "center" }}>Avg</th>
                <th style={{ ...pdfThStyle, textAlign: "center" }}>Min</th>
                <th style={{ ...pdfThStyle, textAlign: "center" }}>Max</th>
                {grades.map((g) => (
                  <th key={g} style={{ ...pdfThStyle, textAlign: "center" }}>{g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.mqts.map((mqt, i) => (
                <tr key={mqt.mqtId} style={{ background: i % 2 === 1 ? "#F5F5F5" : "#fff" }}>
                  <td style={pdfTdStyle}><b>{mqt.mqtName}</b></td>
                  <td style={{ ...pdfTdStyle, textAlign: "center", fontWeight: 700 }}>{mqt.average.toFixed(1)}</td>
                  <td style={{ ...pdfTdStyle, textAlign: "center", color: "#6b7280" }}>{mqt.min}</td>
                  <td style={{ ...pdfTdStyle, textAlign: "center", color: "#6b7280" }}>{mqt.max}</td>
                  {grades.map((g) => {
                    const gw = mqt.gradeWise[g];
                    return (
                      <td key={g} style={{ ...pdfTdStyle, textAlign: "center" }}>
                        {gw ? (
                          <span>
                            <b>{gw.average.toFixed(1)}</b>
                            <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginLeft: 2 }}>({gw.count})</span>
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

// ══════════════════════════════════════════════════════════
// LEARNING ASSETS SECTION (Page 6 of PDF - static content)
// ══════════════════════════════════════════════════════════

const LearningAssetsSection: React.FC = () => (
  <>
    <SectionHeading title="Learning Assets: for Future Ready Students" />
    <p style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.6, fontStyle: "italic", marginBottom: 16 }}>
      Career-9 understands that the students here are full of potential&mdash;but often misaligned with traditional career paths due to systemic gaps.
      We bring a structured, science-backed system to close those gaps and unlock every student's future.
    </p>
    <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc", marginBottom: 24 }}>
      <thead>
        <tr style={{ background: "#F2DBDB" }}>
          <th style={pdfThStyle}>Dominant Combination</th>
          <th style={pdfThStyle}>Career-9's Insight</th>
          <th style={pdfThStyle}>Career-9's Solution</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={pdfTdStyle} rowSpan={3}><b>Learning Assets</b></td>
          <td style={pdfTdStyle}>Strong preference for structure, rules, and routine tasks. Reinforced by exam-focused education.</td>
          <td style={pdfTdStyle}>Use our <b>Career Library</b> and <b>Navigator 360&deg; reports</b> to introduce lesser-known but well-aligned careers matching students' personality and intelligence.</td>
        </tr>
        <tr style={{ background: "#F5F5F5" }}>
          <td style={pdfTdStyle}>Action-oriented learners with high physical engagement. Thrive on hands-on tasks.</td>
          <td style={pdfTdStyle}>Integrate <b>Career-9 LMS</b>, allowing students to explore more professions and latest career trends that incorporate true potential of the student.</td>
        </tr>
        <tr>
          <td style={pdfTdStyle}>Self-reflective and problem-solving; ideal candidates for STEM and research fields.</td>
          <td style={pdfTdStyle}>Provide <b>AI and STEM exposure modules</b>, live projects, and virtual labs within the LMS. Introduce <b>Career-9's AI training series</b> to align technical skills with real-world application.</td>
        </tr>
        <tr style={{ background: "#F5F5F5" }}>
          <td style={pdfTdStyle} rowSpan={4}><b style={{ color: "#dc2626" }}>Learning Gaps</b></td>
          <td style={{ ...pdfTdStyle, color: "#dc2626", fontStyle: "italic" }}>Students struggle with comprehension and articulation, especially in academic English.</td>
          <td style={pdfTdStyle}>Activate <b>Career Labs</b> in schools offering electives in <b>linguistic skill, reading abilities and Communication Skill development</b>.</td>
        </tr>
        <tr>
          <td style={{ ...pdfTdStyle, color: "#dc2626", fontStyle: "italic" }}>Creativity is undervalued, leading to suppressed aspirations.</td>
          <td style={pdfTdStyle}>Include dedicated modules on <b>Human Skill Development</b> and <b>Career-Focused Counseling</b> to channel students' passions into meaningful, purpose-driven career paths.</td>
        </tr>
        <tr style={{ background: "#F5F5F5" }}>
          <td style={{ ...pdfTdStyle, color: "#dc2626", fontStyle: "italic" }}>Social service roles are rarely promoted, despite strong interpersonal skills.</td>
          <td style={pdfTdStyle}>Introduce <b>eco-education content, school garden projects, upcycling initiatives</b>, and visits to sustainable businesses. Encourage <b>problem-solving linked to real environmental issues</b>.</td>
        </tr>
        <tr>
          <td style={{ ...pdfTdStyle, color: "#dc2626", fontStyle: "italic" }}>Disconnected from nature in urban environments, affecting sustainability awareness.</td>
          <td style={pdfTdStyle}>Use our <b>Career Library</b> and <b>Navigator 360&deg; reports</b> to introduce careers in design, psychology, media, and hospitality&mdash;matching students' personality and intelligence.</td>
        </tr>
      </tbody>
    </table>
  </>
);

// ══════════════════════════════════════════════════════════
// STRATEGIC GUIDANCE SECTION (Page 7 of PDF - static content)
// ══════════════════════════════════════════════════════════

const StrategicGuidanceSection: React.FC<{ instituteName: string }> = ({ instituteName }) => (
  <>
    <SectionHeading title="Strategic Guidance for Future Career Planning" />
    <p style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.6, fontStyle: "italic", marginBottom: 20 }}>
      With careers evolving rapidly, NEP 2020 and NCERT stress early, structured career guidance, skill development, and AI readiness.
      Career-9 brings this to life with a holistic, tech-enabled solution tailored for students.
    </p>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
      {[
        {
          title: "Grades 11\u201312: Career Alignment",
          items: [
            "Career Navigator tools for informed subject choices",
            "AI-powered dashboards to match student strengths with trending careers",
            "Counseling & Human Skill modules to give direction to student passion",
          ],
        },
        {
          title: "Structured Dashboards & Educator Insights",
          items: [
            "Real-time insights for teachers and principals",
            "Track learning gaps, personality profiles, and readiness levels",
            "Simplifies reporting and supports school planning",
          ],
        },
        {
          title: "Skill Building & GenAI Integration",
          items: [
            "NEP-aligned LMS content in communication, collaboration, and creativity",
            "GenAI Literacy modules to future-proof students",
            "Modular, bilingual design ensures accessibility and engagement",
          ],
        },
        {
          title: "Career Exposure & Mentoring",
          items: [
            "Virtual mentors, industry visits, and local project tie-ups",
            "Workshops in upcycling, sustainability, and social impact",
            "Bridges classroom learning with real-world relevance",
          ],
        },
      ].map((card) => (
        <div
          key={card.title}
          style={{
            padding: "16px 20px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f8fafc",
          }}
        >
          <h4 style={{ margin: "0 0 10px", fontSize: "0.85rem", fontWeight: 700, color: "#1F4E79" }}>
            {card.title}
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "#374151", lineHeight: 1.7 }}>
            {card.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    {/* Roadmap Steps */}
    <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      {[
        { title: "Subscribe to Career-9", text: "Kickstart the journey by subscribing to Career-9's platform for ongoing support.", color: "#70AD47" },
        { title: "Conduct Yearly Assessments", text: "Perform annual psychometric assessments to track students' evolving interests and skills.", color: "#5B9BD5" },
        { title: "Utilize LMS, Human Skills & GenAI Trainings", text: "Leverage the Career-9 LMS for AI-driven insights and enroll students in GenAI training programs.", color: "#7B4EA3" },
      ].map((step) => (
        <div
          key={step.title}
          style={{
            flex: 1,
            minWidth: 200,
            padding: 16,
            background: step.color,
            color: "#fff",
            borderRadius: 8,
            fontSize: "0.8rem",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
          <div style={{ opacity: 0.9, lineHeight: 1.5 }}>{step.text}</div>
        </div>
      ))}
    </div>
  </>
);

// ══════════════════════════════════════════════════════════
// SHARED STYLES (match PDF table formatting)
// ══════════════════════════════════════════════════════════

const pdfThStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: "0.8rem",
  color: "#1a1a2e",
  borderBottom: "2px solid #ccc",
  textAlign: "left",
  fontFamily: "Georgia, serif",
};

const pdfTdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "0.8rem",
  borderBottom: "1px solid #e0e0e0",
  verticalAlign: "top",
  lineHeight: 1.5,
  fontFamily: "Georgia, serif",
};

export default SchoolReportModal;
