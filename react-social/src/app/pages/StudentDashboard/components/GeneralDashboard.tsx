import React, { useState, useEffect } from "react";
import {
  fetchGeneralDashboardData,
  processGeneralAssessment,
  ParsedGeneralAssessmentData,
  PersonalityScore,
} from "../API/Dashboard_APIs";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";

interface Props {
  studentId: number;
  assessmentId: number;
}

const RIASEC_COLORS: Record<string, string> = {
  Realistic: "#e74c3c", Investigative: "#3498db", Artistic: "#9b59b6",
  Social: "#2ecc71", Enterprising: "#f39c12", Conventional: "#1abc9c",
};

const GeneralDashboard: React.FC<Props> = ({ studentId, assessmentId }) => {
  const [data, setData] = useState<ParsedGeneralAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "personality" | "intelligence" | "career" | "abilities">("overview");

  useEffect(() => {
    loadData();
  }, [studentId, assessmentId]);

  const loadData = async () => {
    setLoading(true);
    const result = await fetchGeneralDashboardData(studentId, assessmentId);
    setData(result);
    setLoading(false);
  };

  const handleProcess = async () => {
    setProcessing(true);
    await processGeneralAssessment(studentId, assessmentId);
    await loadData();
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">Loading general assessment dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-content" style={{ padding: "2rem" }}>
        <div className="alert alert-info text-center">
          <i className="bi bi-gear me-2" style={{ fontSize: "1.5rem" }}></i>
          <h4>General Assessment Dashboard</h4>
          <p>Assessment results have not been processed yet.</p>
          <button
            className="btn btn-primary"
            onClick={handleProcess}
            disabled={processing}
          >
            {processing ? (
              <><span className="spinner-border spinner-border-sm me-2" /> Processing...</>
            ) : (
              <><i className="bi bi-play-circle me-2" /> Process Results</>
            )}
          </button>
        </div>
      </div>
    );
  }

  const { personalityScores, personalityProfiles, intelligenceScores, intelligenceProfiles,
    abilityScores, learningStyles, suitabilityPathways, subjectsOfInterest,
    careerAspirations, studentValues, futureSuggestions, raw } = data;

  // Prepare chart data
  const radarData = Object.entries(personalityScores).map(([name, scores]: [string, PersonalityScore]) => ({
    trait: name,
    stanine: scores.stanine,
    raw: scores.raw,
  }));

  const intelBarData = Object.entries(intelligenceScores)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name, score]) => ({ name: name.replace("-", "\n"), score, fullName: name }));

  const abilityBarData = Object.entries(abilityScores)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name, score]) => ({ name, score }));

  const top5AbilityNames = [raw.abilityTop1, raw.abilityTop2, raw.abilityTop3, raw.abilityTop4, raw.abilityTop5].filter(Boolean);

  const tabs = [
    { key: "overview", label: "Overview", icon: "bi-grid-3x3-gap" },
    { key: "personality", label: "Personality", icon: "bi-person-badge" },
    { key: "intelligence", label: "Intelligence & Learning", icon: "bi-lightbulb" },
    { key: "career", label: "Career Pathways", icon: "bi-signpost-split" },
    { key: "abilities", label: "Abilities & Values", icon: "bi-bar-chart-line" },
  ];

  return (
    <div className="dashboard-content">
      {/* Tab Navigation */}
      <div className="dashboard-tabs" style={{ display: "flex", gap: "0.5rem", padding: "0 1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            <i className={`bi ${tab.icon} me-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div style={{ padding: "0 1.5rem" }}>
          <div className="charts-grid">
            {/* RIASEC Personality */}
            {(radarData.length > 0 || raw.personalityTop1) && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title"><i className="bi bi-hexagon me-2"></i>Personality Profile (RIASEC)</h3>
                  <button className="btn-link" onClick={() => setActiveTab("personality")}>View Details <i className="bi bi-arrow-right"></i></button>
                </div>
                <div className="card-body">
                  {radarData.length > 0 && radarData.some(d => d.raw > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e0e0e0" />
                        {/* @ts-ignore */}
                        <PolarAngleAxis dataKey="trait" style={{ fontSize: "12px", fontWeight: 600 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 20]} tick={{ fontSize: 10 }} />
                        <Radar name="Score" dataKey="raw" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                        <Tooltip formatter={(v: any) => `Score: ${v}`} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    /* Fallback: show top 3 as text if radar has no data */
                    <div>
                      {personalityProfiles.map((profile, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.6rem 0", borderBottom: idx < personalityProfiles.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: RIASEC_COLORS[profile.name] || "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>
                            {idx + 1}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1a202c" }}>{profile.name}</div>
                            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>"{profile.title}"</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top 3 Intelligence */}
            {(raw.intelligenceTop1 || raw.intelligenceTop2 || raw.intelligenceTop3) && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title"><i className="bi bi-lightbulb me-2"></i>Top Intelligence Types</h3>
                  <button className="btn-link" onClick={() => setActiveTab("intelligence")}>View Details <i className="bi bi-arrow-right"></i></button>
                </div>
                <div className="card-body">
                  {intelligenceProfiles.map((profile, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 0", borderBottom: idx < intelligenceProfiles.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: ["#8b5cf6", "#06b6d4", "#f59e0b"][idx], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1a202c" }}>{profile.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{profile.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 3 Career Pathways */}
            {suitabilityPathways.length > 0 && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title"><i className="bi bi-signpost-split me-2"></i>Recommended Career Pathways</h3>
                  <button className="btn-link" onClick={() => setActiveTab("career")}>View Details <i className="bi bi-arrow-right"></i></button>
                </div>
                <div className="card-body">
                  {suitabilityPathways.slice(0, 3).map((pw, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 0", borderBottom: idx < 2 ? "1px solid #f0f0f0" : "none" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: ["#3b82f6", "#10b981", "#f59e0b"][idx], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "1.1rem", flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1a202c" }}>{pw.name}</div>
                        {pw.description && <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 2 }}>{pw.description.substring(0, 120)}...</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Abilities Overview */}
            {abilityBarData.length > 0 && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title"><i className="bi bi-bar-chart-line me-2"></i>Top Abilities</h3>
                  <button className="btn-link" onClick={() => setActiveTab("abilities")}>View Details <i className="bi bi-arrow-right"></i></button>
                </div>
                <div className="card-body">
                  {top5AbilityNames.map((name, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
                      <span style={{ fontWeight: 700, color: ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#6b7280"][idx], fontSize: "1.1rem" }}>
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <span style={{ fontWeight: 500 }}>{name}</span>
                      <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.85rem" }}>
                        Score: {abilityScores[name!] ?? "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary (if available) */}
            {raw.aiSummary && (
              <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-header">
                  <h3 className="card-title"><i className="bi bi-stars me-2"></i>AI-Generated Summary</h3>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#374151" }}>{raw.aiSummary}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERSONALITY TAB */}
      {activeTab === "personality" && (
        <div style={{ padding: "0 1.5rem" }}>
          <div className="view-header">
            <h2 className="view-title"><i className="bi bi-person-badge me-2"></i>Personality Profile</h2>
            <p className="view-description">Your RIASEC personality type analysis with stanine scores</p>
          </div>

          {/* RIASEC Radar Chart */}
          {radarData.length > 0 && radarData.some(d => d.raw > 0) && (
            <div className="chart-container">
              <h3 className="chart-title">RIASEC Personality Scores</h3>
              <ResponsiveContainer width="100%" height={380}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e0e0e0" />
                  {/* @ts-ignore */}
                  <PolarAngleAxis dataKey="trait" style={{ fontSize: "13px", fontWeight: 600 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 20]} tick={{ fontSize: 10 }} />
                  <Radar name="Score" dataKey="raw" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                  <Tooltip formatter={(v: any) => `Score: ${v}`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Personality Profile Cards */}
          {personalityProfiles.map((profile, idx) => (
            <div key={idx} className="result-card">
              <div className="result-header">
                <h3 className="result-title">
                  <span style={{ fontSize: "1.2rem", marginRight: 8 }}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                  </span>
                  #{idx + 1} {profile.name} — "{profile.title}"
                </h3>
              </div>
              <div className="result-body">
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#374151" }}>{profile.description}</p>
              </div>
            </div>
          ))}

          {/* Future Suggestions */}
          {(futureSuggestions.atSchool || futureSuggestions.atHome) && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-lightbulb me-2"></i>Future Suggestions</h3>
              </div>
              <div className="result-body">
                {futureSuggestions.atSchool && (
                  <div style={{ marginBottom: "1rem" }}>
                    <strong>At School:</strong>
                    <ul style={{ marginTop: "0.5rem" }}>
                      {futureSuggestions.atSchool.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i} style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {futureSuggestions.atHome && (
                  <div>
                    <strong>At Home:</strong>
                    <ul style={{ marginTop: "0.5rem" }}>
                      {futureSuggestions.atHome.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i} style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTELLIGENCE & LEARNING TAB */}
      {activeTab === "intelligence" && (
        <div style={{ padding: "0 1.5rem" }}>
          <div className="view-header">
            <h2 className="view-title"><i className="bi bi-lightbulb me-2"></i>Intelligence & Learning Styles</h2>
            <p className="view-description">Multiple intelligence profile and personalized learning preferences</p>
          </div>

          {/* All 8 Intelligence Types Chart */}
          {intelBarData.length > 0 && intelBarData.some(d => (d.score as number) > 0) && (
            <div className="chart-container">
              <h3 className="chart-title">Multiple Intelligence Scores</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={intelBarData} layout="vertical" margin={{ left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="fullName" type="category" style={{ fontSize: "12px" }} width={130} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {intelBarData.map((entry, i) => {
                      const isTop3 = [raw.intelligenceTop1, raw.intelligenceTop2, raw.intelligenceTop3].includes(entry.fullName);
                      return <Cell key={i} fill={isTop3 ? "#8b5cf6" : "#d1d5db"} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", fontSize: "0.8rem", color: "#6b7280", marginTop: 8 }}>
                <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: "#8b5cf6", marginRight: 4 }}></span>Top 3</span>
                <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: "#d1d5db", marginRight: 4 }}></span>Other</span>
              </div>
            </div>
          )}

          {/* Intelligence Profiles */}
          {intelligenceProfiles.map((profile, idx) => (
            <div key={idx} className="result-card">
              <div className="result-header">
                <h3 className="result-title">#{idx + 1} {profile.name} — "{profile.title}"</h3>
              </div>
              <div className="result-body">
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>{profile.description}</p>
              </div>
            </div>
          ))}

          {/* Learning Styles */}
          {learningStyles.length > 0 && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-book me-2"></i>Learning Styles</h3>
              </div>
              <div className="result-body">
                {learningStyles.map((ls, idx) => (
                  <div key={idx} style={{ padding: "0.75rem 0", borderBottom: idx < learningStyles.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{ls.style} <span style={{ color: "#6b7280", fontWeight: 400 }}>({ls.intelligence})</span></div>
                    <div style={{ fontSize: "0.85rem", color: "#059669" }}>Enjoys: {ls.enjoys}</div>
                    <div style={{ fontSize: "0.85rem", color: "#dc2626" }}>Struggles with: {ls.struggles}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {raw.learningSummary && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-stars me-2"></i>Learning Style Summary</h3>
              </div>
              <div className="result-body">
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>{raw.learningSummary}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAREER PATHWAYS TAB */}
      {activeTab === "career" && (
        <div style={{ padding: "0 1.5rem" }}>
          <div className="view-header">
            <h2 className="view-title"><i className="bi bi-signpost-split me-2"></i>Career Pathways</h2>
            <p className="view-description">Recommended career pathways based on your personality, abilities, and interests</p>
          </div>

          {/* Top 3 Detailed Pathway Cards */}
          {suitabilityPathways.slice(0, 3).map((pw, idx) => (
            <div key={idx} className="result-card">
              <div className="result-header">
                <h3 className="result-title">
                  <span style={{ background: ["#3b82f6", "#10b981", "#f59e0b"][idx], color: "white", borderRadius: "50%", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700, marginRight: 10 }}>
                    {idx + 1}
                  </span>
                  {pw.name}
                </h3>
              </div>
              <div className="result-body">
                {pw.description && <p style={{ fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1rem" }}>{pw.description}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                  {pw.subjects && (
                    <div><strong style={{ fontSize: "0.8rem", color: "#6b7280" }}>SUBJECTS</strong><p style={{ fontSize: "0.85rem", marginTop: 4 }}>{pw.subjects}</p></div>
                  )}
                  {pw.skills && (
                    <div><strong style={{ fontSize: "0.8rem", color: "#6b7280" }}>SKILLS</strong><p style={{ fontSize: "0.85rem", marginTop: 4 }}>{pw.skills}</p></div>
                  )}
                  {pw.courses && (
                    <div><strong style={{ fontSize: "0.8rem", color: "#6b7280" }}>COURSES</strong><p style={{ fontSize: "0.85rem", marginTop: 4 }}>{pw.courses}</p></div>
                  )}
                  {pw.exams && (
                    <div><strong style={{ fontSize: "0.8rem", color: "#6b7280" }}>EXAMS</strong><p style={{ fontSize: "0.85rem", marginTop: 4 }}>{pw.exams}</p></div>
                  )}
                </div>

                {/* Has/Lacks */}
                {pw.hasLacks && (
                  <div style={{ background: "#f9fafb", borderRadius: 8, padding: "1rem" }}>
                    <strong style={{ fontSize: "0.85rem" }}>Attribute Match Analysis</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
                      {(["personality", "intelligence", "soi", "abilities", "values"] as const).map((attr) => {
                        const hl = pw.hasLacks![attr];
                        if (!hl) return null;
                        return (
                          <div key={attr} style={{ fontSize: "0.8rem" }}>
                            <div style={{ fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>{attr}</div>
                            {hl.has.length > 0 && (
                              <div style={{ color: "#059669" }}>Has: {hl.has.join(", ")}</div>
                            )}
                            {hl.lacks.length > 0 && (
                              <div style={{ color: "#dc2626" }}>Lacks: {hl.lacks.join(", ")}</div>
                            )}
                            {hl.has.length === 0 && hl.lacks.length === 0 && (
                              <div style={{ color: "#9ca3af" }}>No data</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Remaining pathways (4-9) as compact list */}
          {suitabilityPathways.length > 3 && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title">Other Recommended Pathways</h3>
              </div>
              <div className="result-body">
                {suitabilityPathways.slice(3).map((pw, idx) => (
                  <div key={idx} style={{ padding: "0.4rem 0", fontSize: "0.9rem" }}>
                    <span style={{ color: "#6b7280", marginRight: 8 }}>#{idx + 4}</span>
                    {pw.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Career Match */}
          {raw.careerMatchResult && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-check2-circle me-2"></i>Career Aspiration Match</h3>
              </div>
              <div className="result-body">
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>{raw.careerMatchResult}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABILITIES & VALUES TAB */}
      {activeTab === "abilities" && (
        <div style={{ padding: "0 1.5rem" }}>
          <div className="view-header">
            <h2 className="view-title"><i className="bi bi-bar-chart-line me-2"></i>Abilities & Values</h2>
            <p className="view-description">Skill strengths, areas for growth, and personal values</p>
          </div>

          {/* Top 5 Abilities */}
          {top5AbilityNames.length > 0 && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-trophy me-2"></i>Top 5 Abilities</h3>
              </div>
              <div className="result-body">
                {top5AbilityNames.map((name, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderBottom: idx < top5AbilityNames.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <span style={{ fontSize: "1.2rem" }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{name}</span>
                    <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.85rem" }}>
                      Score: {abilityScores[name!] ?? "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak Ability */}
          {raw.weakAbility && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-exclamation-triangle me-2"></i>Area for Growth: {raw.weakAbility}</h3>
              </div>
              <div className="result-body">
                {raw.weakAbilityRecommendations && (
                  <ul>
                    {raw.weakAbilityRecommendations.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} style={{ fontSize: "0.85rem", marginBottom: "0.3rem" }}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Values */}
          {studentValues.length > 0 && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-compass me-2"></i>Personal Values</h3>
              </div>
              <div className="result-body">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {studentValues.map((val, idx) => (
                    <span key={idx} style={{ background: "#eff6ff", color: "#1e40af", padding: "0.4rem 1rem", borderRadius: 20, fontSize: "0.85rem", fontWeight: 500 }}>
                      {val}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subjects of Interest */}
          {subjectsOfInterest.length > 0 && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-book me-2"></i>Subjects of Interest</h3>
              </div>
              <div className="result-body">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {subjectsOfInterest.map((soi, idx) => (
                    <span key={idx} style={{ background: "#ecfdf5", color: "#065f46", padding: "0.4rem 1rem", borderRadius: 20, fontSize: "0.85rem", fontWeight: 500 }}>
                      {soi}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Career Aspirations */}
          {careerAspirations.length > 0 && (
            <div className="result-card">
              <div className="result-header">
                <h3 className="result-title"><i className="bi bi-star me-2"></i>Career Aspirations</h3>
              </div>
              <div className="result-body">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {careerAspirations.map((asp, idx) => (
                    <span key={idx} style={{ background: "#fef3c7", color: "#92400e", padding: "0.4rem 1rem", borderRadius: 20, fontSize: "0.85rem", fontWeight: 500 }}>
                      {asp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneralDashboard;
