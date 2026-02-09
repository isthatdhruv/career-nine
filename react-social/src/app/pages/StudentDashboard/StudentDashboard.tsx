import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchAllDashboardData, getDashboardDataFromCache, getStudentAssessments, exportBetAssessmentToExcel, DashboardData, DashboardApiResponse } from "./API/Dashboard_APIs";
import "./StudentDashboard.css";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";

const StudentDashboard: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"overview" | "cognitive" | "social" | "self-management">("overview");
  const [cachedApiResponse, setCachedApiResponse] = useState<DashboardApiResponse | null>(null);
  const [isBetAssessment, setIsBetAssessment] = useState<boolean>(true);

  useEffect(() => {
    if (studentId) {
      fetchAssessments();
    }
  }, [studentId]);

  // Re-process dashboard data when selectedAssessmentId or cached data changes
  useEffect(() => {
    if (studentId && selectedAssessmentId !== null && cachedApiResponse) {
      fetchDashboardData();
    }
  }, [studentId, selectedAssessmentId, cachedApiResponse]);

  const fetchDashboardData = async () => {
    if (!cachedApiResponse || selectedAssessmentId === null) return;

    setLoading(true);
    try {
      const result = await getDashboardDataFromCache(
        Number(studentId),
        cachedApiResponse,
        selectedAssessmentId
      );
      setDashboardData(result.data);
      setIsBetAssessment(result.isBetAssessment);
      setError("");
    } catch (err: any) {
      console.error("Error processing dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessments = async () => {
    try {
      const assessmentsData = await getStudentAssessments(Number(studentId));
      setAssessments(assessmentsData);

      // Fetch all assessment data from single endpoint
      const allData = await fetchAllDashboardData(Number(studentId));
      if (allData) {
        setCachedApiResponse(allData);
      }

      // Set first assessment as default if not already selected
      if (assessmentsData.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(assessmentsData[0].assessmentId);
      }
    } catch (err: any) {
      console.error("Error fetching assessments:", err);
    }
  };

  const handleDownloadReport = () => {
    // Navigate to report view
    navigate(`/student-dashboard/${studentId}/report`);
  };

  const handleViewResults = () => {
    if (!cachedApiResponse || selectedAssessmentId === null || !dashboardData) return;
    const assessmentData = cachedApiResponse.assessments.find(
      (a) => a.assessmentId === selectedAssessmentId
    );
    if (!assessmentData) return;
    exportBetAssessmentToExcel(assessmentData, dashboardData.student);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading student dashboard...</p>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="dashboard-error">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error || "No data available"}
        </div>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  const { student, cognitive, social, selfManagement } = dashboardData;

  // Calculate metrics from real assessment data
  const totalAssessments = assessments.length;
  const completedAssessments = assessments.filter((a: any) => a.status === "completed").length;
  const pendingAssessments = assessments.filter((a: any) => a.status === "ongoing" || a.status === "notstarted").length;
  const completionRate = totalAssessments > 0 ? Math.round((completedAssessments / totalAssessments) * 100) : 0;

  return (
    <div className="student-dashboard-container">
      {/* Dashboard Header */}
      <div className="dashboard-header-modern">
        <div className="header-content">
          <div className="header-left">
            <img src="/media/logos/kcc.jpg" alt="Career-9" className="header-logo bg-white px-5 py-2" />
            <div className="header-text">
              <h1 className="dashboard-title text-white">Student Insight Dashboard</h1>
              <p className="dashboard-subtitle">Comprehensive performance and development tracking</p>
            </div>
          </div>
          <div className="header-right">
            <button className="btn btn-light" onClick={() => navigate(-1)}>
              <i className="bi bi-arrow-left me-2"></i>
              Back
            </button>
            <button className="btn btn-primary" onClick={handleDownloadReport}>
              <i className="bi bi-file-earmark-text me-2"></i>
              View Report
            </button>
            {isBetAssessment && dashboardData && (
              <button className="btn btn-success" onClick={handleViewResults}>
                <i className="bi bi-file-earmark-spreadsheet me-2"></i>
                View Results
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="dashboard-tabs">
          <button
            className={`tab-button ${activeView === "overview" ? "active" : ""}`}
            onClick={() => setActiveView("overview")}
          >
            <i className="bi bi-grid-3x3-gap me-2"></i>
            Overview
          </button>
          <button
            className={`tab-button ${activeView === "cognitive" ? "active" : ""}`}
            onClick={() => setActiveView("cognitive")}
          >
            <i className="bi bi-brain me-2"></i>
            Cognitive Development
          </button>
          <button
            className={`tab-button ${activeView === "social" ? "active" : ""}`}
            onClick={() => setActiveView("social")}
          >
            <i className="bi bi-people me-2"></i>
            Social Development
          </button>
          <button
            className={`tab-button ${activeView === "self-management" ? "active" : ""}`}
            onClick={() => setActiveView("self-management")}
          >
            <i className="bi bi-person-check me-2"></i>
            Self Management
          </button>
        </div>
      </div>

      {/* Student Info Bar */}
      <div className="student-info-bar">
        <div className="student-name-section">
          <div className="student-avatar">
            {student.name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div>
            <h3 className="student-name">{student.name}</h3>
            <p className="student-meta">Grade {student.grade} • {student.schoolBoard} • ID: #{student.userStudentId}</p>
          </div>
        </div>
        <div className="student-details-grid">
          <div className="detail-item">
            <span className="detail-label">Family Type</span>
            <span className="detail-value">{student.familyType || "N/A"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Siblings</span>
            <span className="detail-value">{student.siblingsCount || 0}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Assessment</span>
            <select
              className="form-select form-select-sm"
              style={{ minWidth: "200px", fontWeight: 600, color: "#1a202c" }}
              value={selectedAssessmentId || ""}
              onChange={(e) => setSelectedAssessmentId(Number(e.target.value))}
            >
              {assessments.length === 0 ? (
                <option value="">No Assessments</option>
              ) : (
                assessments.map((assessment) => (
                  <option key={assessment.assessmentId} value={assessment.assessmentId}>
                    {assessment.assessmentName || `Assessment #${assessment.assessmentId}`}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* General Assessment Placeholder */}
      {!isBetAssessment && (
        <div className="dashboard-content">
          <div className="alert alert-info" style={{ margin: '2rem', padding: '2rem', textAlign: 'center' }}>
            <i className="bi bi-info-circle me-2" style={{ fontSize: '1.5rem' }}></i>
            <h4>General Assessment Dashboard</h4>
            <p>Dashboard visualization for general assessments is coming soon.</p>
          </div>
        </div>
      )}

      {/* OVERVIEW VIEW */}
      {isBetAssessment && activeView === "overview" && (
        <div className="dashboard-content">
         
          {/* Overview Charts Grid */}
          <div className="charts-grid">
            {/* Cognitive Skills Chart */}
            {(cognitive.attention || cognitive.workingMemory || cognitive.cognitiveFlexibility) && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-brain me-2"></i>
                    Cognitive Skills Overview
                  </h3>
                  <button className="btn-link" onClick={() => setActiveView("cognitive")}>
                    View Details <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={[
                      {
                        subject: 'Attention',
                        score: cognitive.attention
                          ? ((cognitive.attention.dPrimeScore + 4.6) / 9.2) * 100
                          : 0,
                      },
                      {
                        subject: 'Working Memory',
                        score: cognitive.workingMemory
                          ? (cognitive.workingMemory.levelReached / 6) * 100
                          : 0,
                      },
                      {
                        subject: 'Problem Solving',
                        score: cognitive.cognitiveFlexibility
                          ? Math.max(0, 100 - (cognitive.cognitiveFlexibility.aimlessClicks * 10))
                          : 0,
                      },
                    ]}>
                      <PolarGrid stroke="#e0e0e0" />
                      {/* @ts-ignore */}
                      <PolarAngleAxis dataKey="subject" style={{ fontSize: '14px', fontWeight: 600 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Radar
                        name="Cognitive Skills"
                        dataKey="score"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                      />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Social Insight Card */}
            {social.socialInsight && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-lightbulb me-2"></i>
                    Social Insight
                  </h3>
                  <button className="btn-link" onClick={() => setActiveView("social")}>
                    View Details <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
                <div className="card-body">
                  <div className="text-center mb-3">
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e40af' }}>
                      {social.socialInsight.score}/18
                    </div>
                    <span className={`badge category-badge ${social.socialInsight.category.toLowerCase().replace(/ /g, '-')}`}>
                      {social.socialInsight.category}
                    </span>
                  </div>
                  <div className="progress-bar-container" style={{ marginBottom: '1rem' }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(social.socialInsight.score / 18) * 100}%` }}
                    ></div>
                  </div>
                  {social.socialInsight.traits && (
                    <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                      {social.socialInsight.traits.map((trait, idx) => (
                        <li key={idx} style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.25rem' }}>{trait}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Social Development Chart */}
            {(social.values && social.values.length > 0) && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-people me-2"></i>
                    Top Character Values
                  </h3>
                  <button className="btn-link" onClick={() => setActiveView("social")}>
                    View Details <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(social.values || []).map((value, idx) => ({
                        name: value.name,
                        importance: (social.values || []).length - idx,
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" style={{ fontSize: '13px' }} />
                      <Tooltip />
                      <Bar dataKey="importance" fill="#10b981" radius={[0, 8, 8, 0]}>
                        {social.values.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#8b5cf6'][index] || '#6b7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Self-Management Chart */}
            {(selfManagement.selfEfficacy || selfManagement.emotionalRegulation || selfManagement.selfRegulation) && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-person-check me-2"></i>
                    Self-Management Skills
                  </h3>
                  <button className="btn-link" onClick={() => setActiveView("self-management")}>
                    View Details <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="20%"
                      outerRadius="90%"
                      barSize={25}
                      data={[
                        {
                          name: 'Self-Efficacy',
                          value: selfManagement.selfEfficacy
                            ? selfManagement.selfEfficacy.level === 'High' ? 85 : selfManagement.selfEfficacy.level === 'Moderate' ? 60 : 35
                            : 0,
                          fill: '#3b82f6',
                        },
                        {
                          name: 'Emotional Regulation',
                          value: selfManagement.emotionalRegulation
                            ? selfManagement.emotionalRegulation.level === 'High' ? 85 : selfManagement.emotionalRegulation.level === 'Moderate' ? 60 : 35
                            : 0,
                          fill: '#10b981',
                        },
                        {
                          name: 'Self-Regulation',
                          value: selfManagement.selfRegulation
                            ? selfManagement.selfRegulation.level === 'High' ? 85 : selfManagement.selfRegulation.level === 'Moderate' ? 60 : 35
                            : 0,
                          fill: '#f59e0b',
                        },
                      ]}
                    >
                      <PolarGrid gridType="circle" />
                      {/* @ts-ignore */}
                      <PolarAngleAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                      <RadialBar background dataKey="value" cornerRadius={10} />
                      <Tooltip formatter={(value: any) => [`${value}%`, 'Level']} />
                      <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Environmental Awareness Chart */}
            {social.environmentalAwareness && (
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="bi bi-tree me-2"></i>
                    Environmental Awareness
                  </h3>
                  <button className="btn-link" onClick={() => setActiveView("social")}>
                    View Details <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Eco-Friendly Choices', value: social.environmentalAwareness.friendlyChoices },
                          { name: 'Unfriendly Choices', value: social.environmentalAwareness.unfriendlyChoices },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-3">
                    <span className="badge" style={{
                      backgroundColor: social.environmentalAwareness.netScore >= 2 ? '#d1fae5' : social.environmentalAwareness.netScore >= 0 ? '#fef3c7' : '#fee2e2',
                      color: social.environmentalAwareness.netScore >= 2 ? '#059669' : social.environmentalAwareness.netScore >= 0 ? '#d97706' : '#dc2626',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}>
                      {social.environmentalAwareness.icon} {social.environmentalAwareness.category}
                    </span>
                    <p className="mt-2 mb-0" style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                      Net Score: {social.environmentalAwareness.netScore > 0 ? '+' : ''}{social.environmentalAwareness.netScore}/+4
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COGNITIVE DEVELOPMENT VIEW */}
      {isBetAssessment && activeView === "cognitive" && (
        <div className="dashboard-content">
          <div className="view-header">
            <h2 className="view-title">
              <i className="bi bi-brain me-2"></i>
              Cognitive Development
            </h2>
            <p className="view-description">
              Explore detailed insights into attention, working memory, and problem-solving capabilities
            </p>
          </div>

        {/* Show message if no cognitive data */}
        {!cognitive.attention && !cognitive.workingMemory && !cognitive.cognitiveFlexibility && (
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            No cognitive assessment data available yet. Complete the cognitive games to see results here.
          </div>
        )}

        {/* Cognitive Overview Chart - only show if at least one metric exists */}
        {(cognitive.attention || cognitive.workingMemory || cognitive.cognitiveFlexibility) && (
          <div className="chart-container">
            <h3 className="chart-title">Cognitive Skills Overview</h3>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={[
                {
                  subject: 'Attention',
                  score: cognitive.attention
                    ? ((cognitive.attention.dPrimeScore + 4.6) / 9.2) * 100
                    : 0,
                  fullMark: 100,
                },
                {
                  subject: 'Working Memory',
                  score: cognitive.workingMemory
                    ? (cognitive.workingMemory.levelReached / 6) * 100
                    : 0,
                  fullMark: 100,
                },
                {
                  subject: 'Problem Solving',
                  score: cognitive.cognitiveFlexibility
                    ? Math.max(0, 100 - (cognitive.cognitiveFlexibility.aimlessClicks * 10))
                    : 0,
                  fullMark: 100,
                },
              ]}>
                <PolarGrid stroke="#e0e0e0" />
                {/* @ts-ignore */}
                <PolarAngleAxis dataKey="subject" style={{ fontSize: '14px', fontWeight: 600 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Radar
                  name="Cognitive Skills"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Tooltip
                  formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Attention (Sustained Attention) */}
        {cognitive.attention && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-eye-fill me-2"></i>
                Sustained Attention
              </h3>
              <span className={`badge category-badge ${cognitive.attention.category.toLowerCase()}`}>
                {cognitive.attention.category}
              </span>
            </div>
            <div className="result-body">
              <div className="score-display">
                <div className="score-label">d-prime Score:</div>
                <div className="score-value">{cognitive.attention.dPrimeScore.toFixed(2)}</div>
                <div className="score-range">(Range: -4.60 to 4.60)</div>
              </div>
              <div className="interpretation">
                <strong>Interpretation:</strong>
                <p>{cognitive.attention.interpretation}</p>
              </div>
              <div className="action-tip">
                <strong>🎯 Action Tip for Parents:</strong>
                <p>{cognitive.attention.actionTip}</p>
              </div>
            </div>
          </div>
        )}

        {/* Working Memory */}
        {cognitive.workingMemory && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-collection-fill me-2"></i>
                Working Memory
              </h3>
              <span className={`badge category-badge ${cognitive.workingMemory.category.toLowerCase().replace(' ', '-')}`}>
                {cognitive.workingMemory.category}
              </span>
            </div>
            <div className="result-body">
              <div className="score-display">
                <div className="score-label">Level Reached:</div>
                <div className="score-value">Level {cognitive.workingMemory.levelReached}</div>
                <div className="score-range">Score: {cognitive.workingMemory.rawScore}/12</div>
              </div>
              <div className="interpretation">
                <strong>Interpretation:</strong>
                <p>{cognitive.workingMemory.interpretation}</p>
              </div>
              <div className="action-tip">
                <strong>🎯 Action Tip for Parents:</strong>
                <p>{cognitive.workingMemory.actionTip}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cognitive Flexibility */}
        {cognitive.cognitiveFlexibility && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-puzzle-fill me-2"></i>
                Problem-Solving Style
              </h3>
              <span className={`badge category-badge ${cognitive.cognitiveFlexibility.style.toLowerCase().replace(' ', '-')}`}>
                {cognitive.cognitiveFlexibility.style}
              </span>
            </div>
            <div className="result-body">
              <div className="score-display">
                <div className="metrics-grid">
                  <div>
                    <div className="metric-label">Time Taken:</div>
                    <div className="metric-value">{cognitive.cognitiveFlexibility.time} sec</div>
                  </div>
                  <div>
                    <div className="metric-label">Aimless Clicks:</div>
                    <div className="metric-value">{cognitive.cognitiveFlexibility.aimlessClicks}</div>
                  </div>
                  <div>
                    <div className="metric-label">Puzzles Completed:</div>
                    <div className="metric-value">{cognitive.cognitiveFlexibility.puzzlesCompleted}</div>
                  </div>
                </div>
              </div>
              <div className="interpretation">
                <strong>Interpretation:</strong>
                <p>{cognitive.cognitiveFlexibility.interpretation}</p>
              </div>
              <div className="action-tip">
                <strong>🎯 Action Tip for Parents:</strong>
                <p>{cognitive.cognitiveFlexibility.actionTip}</p>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* SOCIAL DEVELOPMENT VIEW */}
      {isBetAssessment && activeView === "social" && (
        <div className="dashboard-content">
          <div className="view-header">
            <h2 className="view-title">
              <i className="bi bi-people me-2"></i>
              Social Development
            </h2>
            <p className="view-description">
              Discover character values, social insights, and environmental awareness
            </p>
          </div>

        {/* Show message if no social data */}
        {!social.socialInsight && !social.values && !social.environmentalAwareness && (
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            No social assessment data available yet. Complete the social development assessments to see results here.
          </div>
        )}

        {/* Social Insight */}
        {social.socialInsight && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-lightbulb-fill me-2"></i>
                Social Insight
              </h3>
              <span className={`badge category-badge ${social.socialInsight.category.toLowerCase().replace(' ', '-')}`}>
                {social.socialInsight.category}
              </span>
            </div>
            <div className="result-body">
              <div className="score-display">
                <div className="score-label">Score:</div>
                <div className="score-value">{social.socialInsight.score}/18</div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{width: `${(social.socialInsight.score / 18) * 100}%`}}
                  ></div>
                </div>
              </div>
              <div className="cultural-context">
                <strong>Cultural Context:</strong>
                <p>
                  In our Indian cultural context, social "politeness" often involves indirect speech.
                  We use these results to help your child navigate these subtle social rules with confidence.
                </p>
              </div>
              <div className="interpretation">
                <strong>Your Child is a "{social.socialInsight.category}"</strong>
                <p>{social.socialInsight.interpretation}</p>
              </div>
              {social.socialInsight.traits && social.socialInsight.traits.length > 0 && (
                <div className="traits-section">
                  <strong>Your child:</strong>
                  <ul>
                    {social.socialInsight.traits.map((trait, idx) => (
                      <li key={idx}>{trait}</li>
                    ))}
                  </ul>
                </div>
              )}
              {social.socialInsight.topDomains && social.socialInsight.topDomains.length > 0 && (
                <>
                  <div className="superpowers-section">
                    <strong>✨ Superpowers:</strong>
                    <ul>
                      {social.socialInsight.topDomains.map((domain, idx) => (
                        <li key={idx}>{domain.name}: You scored {domain.score}/2 on these questions</li>
                      ))}
                    </ul>
                  </div>

                  {/* Domains Distribution Chart */}
                  <div className="chart-container">
                    <h4 className="chart-subtitle">Top Domains Distribution</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={social.socialInsight.topDomains.map((domain) => ({
                            name: domain.name,
                            value: domain.score,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {social.socialInsight.topDomains.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Values Checklist */}
        {social.values && social.values.length > 0 && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-compass-fill me-2"></i>
                Your Character Compass
              </h3>
            </div>
            <div className="result-body">
              <p className="values-intro">
                Your top values show what kind of person you want to be. As primary motivators,
                supporting these values nurtures your child's confidence, emotional growth, and
                ability to build empathetic connections.
              </p>
              <div className="values-list">
                {social.values.map((value, idx) => (
                  <div key={idx} className="value-item">
                    <div className="value-rank">
                      {idx === 0 && "🥇"}
                      {idx === 1 && "🥈"}
                      {idx === 2 && "🥉"}
                      <span className="rank-label">Rank {idx + 1}</span>
                    </div>
                    <div className="value-content">
                      <div className="value-name">{value.name}</div>
                      <div className="value-phrase">"{value.phrase}"</div>
                      <div className="value-meaning">{value.meaning}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Values Ranking Chart */}
              <div className="chart-container">
                <h4 className="chart-subtitle">Character Values Priority</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={(social.values || []).map((value, idx) => ({
                      name: value.name,
                      importance: (social.values || []).length - idx,
                      rank: idx + 1,
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, social.values.length]} />
                    <YAxis dataKey="name" type="category" style={{ fontSize: '13px' }} />
                    <Tooltip
                      formatter={(value: any, name: string | undefined, props: any) => [
                        `Rank ${props.payload.rank}`,
                        'Priority Level'
                      ]}
                    />
                    <Bar dataKey="importance" fill="#10b981" radius={[0, 8, 8, 0]}>
                      {social.values.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#8b5cf6'][index] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Environmental Awareness */}
        {social.environmentalAwareness && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-tree-fill me-2"></i>
                Environmental Awareness
              </h3>
              <span className={`badge category-badge environmental`}>
                {social.environmentalAwareness.category}
              </span>
            </div>
            <div className="result-body">
              <div className="score-display">
                <div className="score-label">Net Score:</div>
                <div className="score-value">{social.environmentalAwareness.netScore}/+4</div>
                <div className="progress-bar-container environmental">
                  <div className="progress-markers">
                    <span>-4</span>
                    <span>0</span>
                    <span>+4</span>
                  </div>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${((social.environmentalAwareness.netScore + 4) / 8) * 100}%`,
                      backgroundColor: social.environmentalAwareness.netScore >= 2 ? '#10b981' : social.environmentalAwareness.netScore >= 0 ? '#fbbf24' : '#f87171'
                    }}
                  ></div>
                </div>
              </div>
              <div className="interpretation">
                <strong>Category: {social.environmentalAwareness.icon} {social.environmentalAwareness.category}</strong>
                <p>{social.environmentalAwareness.interpretation}</p>
              </div>

              {/* Environmental Choices Chart */}
              <div className="chart-container">
                <h4 className="chart-subtitle">Environmental Choices Breakdown</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Eco-Friendly Choices', value: social.environmentalAwareness.friendlyChoices },
                        { name: 'Unfriendly Choices', value: social.environmentalAwareness.unfriendlyChoices },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* SELF-MANAGEMENT VIEW */}
      {isBetAssessment && activeView === "self-management" && (
        <div className="dashboard-content">
          <div className="view-header">
            <h2 className="view-title">
              <i className="bi bi-person-check me-2"></i>
              Self-Management
            </h2>
            <p className="view-description">
              Understand self-efficacy, emotional regulation, and self-regulation capabilities
            </p>
          </div>

        {/* Show message if no self-management data */}
        {!selfManagement.selfEfficacy && !selfManagement.emotionalRegulation && !selfManagement.selfRegulation && (
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            No self-management assessment data available yet. Complete the self-management assessments to see results here.
          </div>
        )}

        {/* Self-Management Overview Chart - only show if at least one metric exists */}
        {(selfManagement.selfEfficacy || selfManagement.emotionalRegulation || selfManagement.selfRegulation) && (
        <div className="chart-container">
          <h3 className="chart-title">Self-Management Skills Overview</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="10%"
              outerRadius="90%"
              barSize={30}
              data={[
                {
                  name: 'Self-Efficacy',
                  value: selfManagement.selfEfficacy
                    ? selfManagement.selfEfficacy.level === 'High'
                      ? 85
                      : selfManagement.selfEfficacy.level === 'Moderate'
                      ? 60
                      : 35
                    : 0,
                  fill: '#3b82f6',
                },
                {
                  name: 'Emotional Regulation',
                  value: selfManagement.emotionalRegulation
                    ? selfManagement.emotionalRegulation.level === 'High'
                      ? 85
                      : selfManagement.emotionalRegulation.level === 'Moderate'
                      ? 60
                      : 35
                    : 0,
                  fill: '#10b981',
                },
                {
                  name: 'Self-Regulation',
                  value: selfManagement.selfRegulation
                    ? selfManagement.selfRegulation.level === 'High'
                      ? 85
                      : selfManagement.selfRegulation.level === 'Moderate'
                      ? 60
                      : 35
                    : 0,
                  fill: '#f59e0b',
                },
              ]}
            >
              <PolarGrid gridType="circle" />
              {/* @ts-ignore */}
              <PolarAngleAxis type="category" dataKey="name" tick={{ fontSize: 13, fontWeight: 600 }} />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={10}
                label={{ position: 'insideStart', fill: '#fff', fontSize: 14, fontWeight: 'bold' }}
              />
              <Tooltip formatter={(value: any) => [`${value}%`, 'Level']} />
              <Legend
                iconSize={10}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: '20px' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Self-Efficacy */}
        {selfManagement.selfEfficacy && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-shield-check me-2"></i>
                Self-Efficacy
              </h3>
              <span className={`badge category-badge ${selfManagement.selfEfficacy.level.toLowerCase().replace(' ', '-')}`}>
                {selfManagement.selfEfficacy.level}
              </span>
            </div>
            <div className="result-body">
              <div className="interpretation">
                <p>{selfManagement.selfEfficacy.interpretation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Emotional Regulation */}
        {selfManagement.emotionalRegulation && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-heart-fill me-2"></i>
                Emotional Regulation
              </h3>
              <span className={`badge category-badge ${selfManagement.emotionalRegulation.level.toLowerCase().replace(' ', '-')}`}>
                {selfManagement.emotionalRegulation.level}
              </span>
            </div>
            <div className="result-body">
              <div className="interpretation">
                <p>{selfManagement.emotionalRegulation.interpretation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Self-Regulation */}
        {selfManagement.selfRegulation && (
          <div className="result-card">
            <div className="result-header">
              <h3 className="result-title">
                <i className="bi bi-check2-circle me-2"></i>
                Self-Regulation
              </h3>
              <span className={`badge category-badge ${selfManagement.selfRegulation.level.toLowerCase().replace(' ', '-')}`}>
                {selfManagement.selfRegulation.level}
              </span>
            </div>
            <div className="result-body">
              <div className="interpretation">
                <p>{selfManagement.selfRegulation.interpretation}</p>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
