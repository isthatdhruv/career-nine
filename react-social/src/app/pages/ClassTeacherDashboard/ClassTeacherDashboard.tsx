import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getClassTeacherDashboardData, getAllAssessments, ClassTeacherDashboardData } from "./API/ClassTeacherDashboard_APIs";
import "./ClassTeacherDashboard.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const ClassTeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<ClassTeacherDashboardData | null>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"overview" | "performance" | "completion" | "cognitive">("overview");

  // Using teacherId = 1 as default (can be made dynamic later)
  const teacherId = 1;

  useEffect(() => {
    fetchAssessments();
  }, []);

  // Re-fetch dashboard data when selectedAssessmentId changes
  useEffect(() => {
    if (selectedAssessmentId !== null) {
      fetchDashboardData();
    }
  }, [selectedAssessmentId]);

  const fetchAssessments = async () => {
    try {
      const assessmentsData = await getAllAssessments();
      const activeOnly = assessmentsData.filter((a: any) => a.isActive !== false);
      setAssessments(activeOnly);
      // Set first assessment as default if not already selected
      if (assessmentsData.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(assessmentsData[0].assessmentId);
      } else if (assessmentsData.length === 0) {
        // If no assessments, fetch dashboard with null assessmentId
        fetchDashboardData();
      }
    } catch (err: any) {
      console.error("Error fetching assessments:", err);
      // Even if fetching assessments fails, load dashboard with null assessmentId
      fetchDashboardData();
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const data = await getClassTeacherDashboardData(teacherId, selectedAssessmentId);
      setDashboardData(data);
      setError("");
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to load dashboard data";
      setError(`Error: ${errorMessage}. Please ensure the backend is running on port 8080.`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="teacher-dashboard-container">
        <div className="dashboard-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading class dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="teacher-dashboard-container">
        <div className="dashboard-error">
          <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "4rem" }}></i>
          <h3 className="mt-3">{error || "No data available"}</h3>
          <button className="btn btn-primary mt-3" onClick={fetchDashboardData}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, studentPerformance, assessmentCompletion, cognitiveTrends } = dashboardData;

  // Color schemes
  const COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#43e97b", "#fa709a"];
  const PERFORMANCE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="teacher-dashboard-container">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <img src="/media/logos/kcc.jpg" alt="Career-9" className="header-logo" />
          <div className="header-text">
            <h1 className="dashboard-title">Class Teacher Dashboard</h1>
            <p className="dashboard-subtitle">{overview.className} - {overview.teacherName}</p>
          </div>
        </div>
        <button className="btn btn-light" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2"></i>
          Back
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeView === "overview" ? "active" : ""}`}
          onClick={() => setActiveView("overview")}
        >
          <i className="bi bi-speedometer2 me-2"></i>
          Overview
        </button>
        <button
          className={`tab-button ${activeView === "performance" ? "active" : ""}`}
          onClick={() => setActiveView("performance")}
        >
          <i className="bi bi-graph-up me-2"></i>
          Student Performance
        </button>
        <button
          className={`tab-button ${activeView === "completion" ? "active" : ""}`}
          onClick={() => setActiveView("completion")}
        >
          <i className="bi bi-clipboard-check me-2"></i>
          Assessment Completion
        </button>
        <button
          className={`tab-button ${activeView === "cognitive" ? "active" : ""}`}
          onClick={() => setActiveView("cognitive")}
        >
          <i className="bi bi-brain me-2"></i>
          Cognitive Trends
        </button>
      </div>

      {/* Class Info Bar */}
      <div className="class-info-bar">
        <div className="info-card">
          <i className="bi bi-people-fill info-icon" style={{ color: "#667eea" }}></i>
          <div>
            <div className="info-label">Total Students</div>
            <div className="info-value">{overview.totalStudents}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-check-circle-fill info-icon" style={{ color: "#10b981" }}></i>
          <div>
            <div className="info-label">Present Today</div>
            <div className="info-value">{overview.presentToday}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-x-circle-fill info-icon" style={{ color: "#ef4444" }}></i>
          <div>
            <div className="info-label">Absent Today</div>
            <div className="info-value">{overview.absentToday}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-calendar-check info-icon" style={{ color: "#f59e0b" }}></i>
          <div>
            <div className="info-label">Average Attendance</div>
            <div className="info-value">{overview.averageAttendance}%</div>
          </div>
        </div>
        <div className="info-card" style={{ minWidth: "250px" }}>
          <i className="bi bi-clipboard-data info-icon" style={{ color: "#8b5cf6" }}></i>
          <div style={{ width: "100%" }}>
            <div className="info-label">Assessment Filter</div>
            <select
              className="form-select form-select-sm mt-2"
              style={{ fontWeight: 600, color: "#1a202c" }}
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

      {/* OVERVIEW VIEW */}
      {activeView === "overview" && (
        <div className="dashboard-content">
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#e0e7ff", color: "#667eea" }}>
                <i className="bi bi-clipboard-data"></i>
              </div>
              <div className="metric-content">
                <div className="metric-label">Assessments This Month</div>
                <div className="metric-value">{overview.recentActivity.assessmentsThisMonth}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="metric-content">
                <div className="metric-label">Pending Grading</div>
                <div className="metric-value">{overview.recentActivity.pendingGrading}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fee2e2", color: "#ef4444" }}>
                <i className="bi bi-bell"></i>
              </div>
              <div className="metric-content">
                <div className="metric-label">New Alerts</div>
                <div className="metric-value">{overview.recentActivity.newAlerts}</div>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            {/* Class Performance Overview */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-bar-chart-fill me-2"></i>
                  Class Performance Overview
                </h3>
              </div>
              <div className="card-body">
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-label">Average Score</div>
                    <div className="stat-value" style={{ color: "#667eea" }}>
                      {studentPerformance.classStats.averageScore}%
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Highest Score</div>
                    <div className="stat-value" style={{ color: "#10b981" }}>
                      {studentPerformance.classStats.highestScore}%
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Lowest Score</div>
                    <div className="stat-value" style={{ color: "#ef4444" }}>
                      {studentPerformance.classStats.lowestScore}%
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Median Score</div>
                    <div className="stat-value" style={{ color: "#f59e0b" }}>
                      {studentPerformance.classStats.medianScore}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Completion Rate Trend */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-graph-up me-2"></i>
                  Completion Rate Trend
                </h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={assessmentCompletion.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                    <Line
                      type="monotone"
                      dataKey="completionRate"
                      stroke="#667eea"
                      strokeWidth={3}
                      dot={{ fill: "#667eea", r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT PERFORMANCE VIEW */}
      {activeView === "performance" && (
        <div className="dashboard-content">
          <div className="view-header">
            <h2 className="view-title">
              <i className="bi bi-graph-up me-2"></i>
              Student Performance Analysis
            </h2>
            <p className="view-description">Detailed insights into class performance distribution and trends</p>
          </div>

          <div className="charts-grid">
            {/* Performance Distribution */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">Performance Distribution</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={studentPerformance.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#667eea" radius={[8, 8, 0, 0]}>
                      {studentPerformance.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PERFORMANCE_COLORS[index % PERFORMANCE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Performers */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-trophy-fill me-2"></i>
                  Top Performers
                </h3>
              </div>
              <div className="card-body">
                <div className="student-list">
                  {studentPerformance.topPerformers.length > 0 ? (
                    studentPerformance.topPerformers.map((student, index) => (
                      <div key={index} className="student-item">
                        <div className="student-rank">
                          {index === 0 ? <i className="bi bi-trophy-fill"></i> : index + 1}
                        </div>
                        <div className="student-info">
                          <div className="student-name">{student.name}</div>
                          <div className="student-notes">{student.notes}</div>
                        </div>
                        <div className="student-score">{student.score}%</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <i className="bi bi-award"></i>
                      <p>No top performers yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Students Needing Attention */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Students Needing Attention
                </h3>
              </div>
              <div className="card-body">
                <div className="student-list">
                  {studentPerformance.needsAttention.length > 0 ? (
                    studentPerformance.needsAttention.map((student, index) => (
                      <div key={index} className="student-item alert-item">
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.5rem",
                            flexShrink: 0,
                            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                          }}
                        >
                          <i className="bi bi-exclamation-triangle-fill"></i>
                        </div>
                        <div className="student-info">
                          <div className="student-name">{student.name}</div>
                          <div className="student-notes">{student.notes}</div>
                        </div>
                        <div className="student-score alert-score">{student.score}%</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <i className="bi bi-check-circle"></i>
                      <p>All students are performing well</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSESSMENT COMPLETION VIEW */}
      {activeView === "completion" && (
        <div className="dashboard-content">
          <div className="view-header">
            <h2 className="view-title">
              <i className="bi bi-clipboard-check me-2"></i>
              Assessment Completion Status
            </h2>
            <p className="view-description">Track assignment completion rates and pending work</p>
          </div>

          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                <i className="bi bi-check-circle-fill"></i>
              </div>
              <div className="metric-content">
                <div className="metric-label">Overall Completion Rate</div>
                <div className="metric-value">{assessmentCompletion.overallCompletionRate}%</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#e0e7ff", color: "#667eea" }}>
                <i className="bi bi-clipboard-data"></i>
              </div>
              <div className="metric-content">
                <div className="metric-label">Total Assignments</div>
                <div className="metric-value">{assessmentCompletion.totalAssignments}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="metric-content">
                <div className="metric-label">Pending Assignments</div>
                <div className="metric-value">{assessmentCompletion.pendingAssignments}</div>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-header">
              <h3 className="card-title">
                <i className="bi bi-table me-2"></i>
                Assessment-wise Completion
              </h3>
            </div>
            <div className="card-body">
              {assessmentCompletion.assessments.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Assessment Name</th>
                        <th className="text-center">Total Students</th>
                        <th className="text-center">Completed</th>
                        <th className="text-center">Completion Rate</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessmentCompletion.assessments.map((assessment, index) => (
                        <tr key={index}>
                          <td><strong>{assessment.name}</strong></td>
                          <td className="text-center">{assessment.totalStudents}</td>
                          <td className="text-center">{assessment.completed}</td>
                          <td className="text-center">
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor:
                                    assessment.completionRate >= 90
                                      ? "#d1fae5"
                                      : assessment.completionRate >= 75
                                      ? "#fef3c7"
                                      : "#fee2e2",
                                  color:
                                    assessment.completionRate >= 90
                                      ? "#059669"
                                      : assessment.completionRate >= 75
                                      ? "#d97706"
                                      : "#dc2626",
                                  padding: "8px 16px",
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  minWidth: "70px",
                                }}
                              >
                                {assessment.completionRate}%
                              </span>
                              <div
                                style={{
                                  width: "100%",
                                  maxWidth: "150px",
                                  height: "4px",
                                  backgroundColor: "#e9ecef",
                                  borderRadius: "2px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${assessment.completionRate}%`,
                                    height: "100%",
                                    backgroundColor:
                                      assessment.completionRate >= 90
                                        ? "#10b981"
                                        : assessment.completionRate >= 75
                                        ? "#f59e0b"
                                        : "#ef4444",
                                    borderRadius: "2px",
                                    transition: "width 0.5s ease",
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td>{assessment.dueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <i className="bi bi-clipboard-x"></i>
                  <p>No assessments available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COGNITIVE TRENDS VIEW */}
      {activeView === "cognitive" && (
        <div className="dashboard-content">
          <div className="view-header">
            <h2 className="view-title">
              <i className="bi bi-brain me-2"></i>
              Cognitive Development Trends
            </h2>
            <p className="view-description">Monitor class-wide cognitive and social-emotional development</p>
          </div>

          <div className="charts-grid">
            {/* Cognitive Skills Radar */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">Cognitive Skills Profile</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={[
                      { subject: "Attention", score: cognitiveTrends.averageScores.attention, fullMark: 100 },
                      { subject: "Working Memory", score: cognitiveTrends.averageScores.workingMemory, fullMark: 100 },
                      {
                        subject: "Cognitive Flexibility",
                        score: cognitiveTrends.averageScores.cognitiveFlexibility,
                        fullMark: 100,
                      },
                      { subject: "Problem Solving", score: cognitiveTrends.averageScores.problemSolving, fullMark: 100 },
                    ]}
                  >
                    <PolarGrid stroke="#e0e0e0" />
                    {/* @ts-ignore */}
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Class Average" dataKey="score" stroke="#667eea" fill="#667eea" fillOpacity={0.6} />
                    <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Social-Emotional Skills */}
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">Social-Emotional Skills</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { skill: "Social Insight", score: cognitiveTrends.socialScores.socialInsight },
                      { skill: "Emotional Regulation", score: cognitiveTrends.socialScores.emotionalRegulation },
                      { skill: "Self-Efficacy", score: cognitiveTrends.socialScores.selfEfficacy },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="skill" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                    <Bar dataKey="score" fill="#764ba2" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Progress Over Time */}
            <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
              <div className="card-header">
                <h3 className="card-title">Progress Over Time</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={cognitiveTrends.progressTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="cognitive" stroke="#667eea" strokeWidth={2} name="Cognitive" />
                    <Line type="monotone" dataKey="social" stroke="#764ba2" strokeWidth={2} name="Social-Emotional" />
                    <Line type="monotone" dataKey="overall" stroke="#10b981" strokeWidth={2} name="Overall" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassTeacherDashboard;
