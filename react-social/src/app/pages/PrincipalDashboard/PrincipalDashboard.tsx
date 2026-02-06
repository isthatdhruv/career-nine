import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPrincipalDashboardData, getAllAssessments, PrincipalDashboardData } from "./API/PrincipalDashboard_APIs";
import "./PrincipalDashboard.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PrincipalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<PrincipalDashboardData | null>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"overview" | "assessment" | "classes" | "teachers" | "enrollment">("overview");

  const principalId = 1; // Default principal ID

  useEffect(() => {
    fetchAssessments();
  }, []);

  useEffect(() => {
    if (selectedAssessmentId !== null) {
      fetchDashboardData();
    }
  }, [selectedAssessmentId]);

  const fetchAssessments = async () => {
    try {
      const assessmentsData = await getAllAssessments();
      setAssessments(assessmentsData);
      if (assessmentsData.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(assessmentsData[0].assessmentId);
      } else if (assessmentsData.length === 0) {
        fetchDashboardData();
      }
    } catch (err: any) {
      console.error("Error fetching assessments:", err);
      fetchDashboardData();
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const data = await getPrincipalDashboardData(principalId, selectedAssessmentId);
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
      <div className="dashboard-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading Principal Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger m-5" role="alert">
        <h4 className="alert-heading">Error Loading Dashboard</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="alert alert-info m-5">No data available</div>;
  }

  const { overview, assessmentPerformance, classwisePerformance, teacherActivity, enrollmentTrends } = dashboardData;

  const COLORS = ["#667eea", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

  return (
    <div className="principal-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            <i className="bi bi-building me-3"></i>
            Principal Dashboard
          </h1>
          <p className="dashboard-subtitle">Institute-wide Performance & Analytics</p>
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
          className={`tab-button ${activeView === "assessment" ? "active" : ""}`}
          onClick={() => setActiveView("assessment")}
        >
          <i className="bi bi-clipboard-data me-2"></i>
          Assessment Performance
        </button>
        <button
          className={`tab-button ${activeView === "classes" ? "active" : ""}`}
          onClick={() => setActiveView("classes")}
        >
          <i className="bi bi-people me-2"></i>
          Class Performance
        </button>
        <button
          className={`tab-button ${activeView === "teachers" ? "active" : ""}`}
          onClick={() => setActiveView("teachers")}
        >
          <i className="bi bi-person-badge me-2"></i>
          Teacher Activity
        </button>
        <button
          className={`tab-button ${activeView === "enrollment" ? "active" : ""}`}
          onClick={() => setActiveView("enrollment")}
        >
          <i className="bi bi-graph-up me-2"></i>
          Enrollment Trends
        </button>
      </div>

      {/* Institute Overview Cards */}
      <div className="overview-cards-grid">
        <div className="info-card">
          <i className="bi bi-people-fill info-icon" style={{ color: "#667eea" }}></i>
          <div>
            <div className="info-label">Total Students</div>
            <div className="info-value">{overview.totalStudents}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-person-badge-fill info-icon" style={{ color: "#10b981" }}></i>
          <div>
            <div className="info-label">Total Teachers</div>
            <div className="info-value">{overview.totalTeachers}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-clipboard-check-fill info-icon" style={{ color: "#f59e0b" }}></i>
          <div>
            <div className="info-label">Total Assessments</div>
            <div className="info-value">{overview.totalAssessments}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-activity info-icon" style={{ color: "#ef4444" }}></i>
          <div>
            <div className="info-label">Active Assessments</div>
            <div className="info-value">{overview.activeAssessments}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-door-open-fill info-icon" style={{ color: "#8b5cf6" }}></i>
          <div>
            <div className="info-label">Total Classes</div>
            <div className="info-value">{overview.totalClasses}</div>
          </div>
        </div>
        <div className="info-card">
          <i className="bi bi-graph-up-arrow info-icon" style={{ color: "#667eea" }}></i>
          <div>
            <div className="info-label">Overall Completion</div>
            <div className="info-value">{overview.overallCompletionRate.toFixed(1)}%</div>
          </div>
        </div>
        {assessments.length > 0 && (
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
                {assessments.map((assessment) => (
                  <option key={assessment.assessmentId} value={assessment.assessmentId}>
                    {assessment.assessmentName || `Assessment #${assessment.assessmentId}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* OVERVIEW VIEW */}
      {activeView === "overview" && (
        <div className="dashboard-content">
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#e0e7ff", color: "#667eea" }}>
                <i className="bi bi-graph-up-arrow"></i>
              </div>
              <div>
                <div className="metric-value">{overview.averagePerformance}%</div>
                <div className="metric-label">Average Performance</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                <i className="bi bi-exclamation-triangle"></i>
              </div>
              <div>
                <div className="metric-value">{overview.studentsNeedingAttention}</div>
                <div className="metric-label">Students Need Attention</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                <i className="bi bi-check-circle"></i>
              </div>
              <div>
                <div className="metric-value">{overview.overallCompletionRate.toFixed(1)}%</div>
                <div className="metric-label">Completion Rate</div>
              </div>
            </div>
          </div>

          {/* Enrollment Trends Chart */}
          <div className="chart-container">
            <h3 className="chart-title">
              <i className="bi bi-graph-up me-2"></i>
              Enrollment Trends
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={enrollmentTrends.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                <Line type="monotone" dataKey="totalStudents" stroke="#667eea" strokeWidth={3} name="Total Students" />
                <Line type="monotone" dataKey="newEnrollments" stroke="#10b981" strokeWidth={3} name="New Enrollments" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ASSESSMENT PERFORMANCE VIEW */}
      {activeView === "assessment" && (
        <div className="dashboard-content">
          {assessmentPerformance.message && (
            <div className="alert alert-info">{assessmentPerformance.message}</div>
          )}
          {assessmentPerformance.error && (
            <div className="alert alert-danger">{assessmentPerformance.error}</div>
          )}
          {assessmentPerformance.statistics && (
            <>
              <h3 className="section-title">
                <i className="bi bi-clipboard-data me-2"></i>
                {assessmentPerformance.assessmentName}
              </h3>

              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                    <i className="bi bi-check-circle"></i>
                  </div>
                  <div>
                    <div className="metric-value">{assessmentPerformance.completedCount}</div>
                    <div className="metric-label">Completed</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <div>
                    <div className="metric-value">{assessmentPerformance.inProgressCount}</div>
                    <div className="metric-label">In Progress</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon" style={{ backgroundColor: "#fee2e2", color: "#ef4444" }}>
                    <i className="bi bi-x-circle"></i>
                  </div>
                  <div>
                    <div className="metric-value">{assessmentPerformance.notStartedCount}</div>
                    <div className="metric-label">Not Started</div>
                  </div>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Average Score</div>
                  <div className="stat-value">{assessmentPerformance.statistics.averageScore.toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Highest Score</div>
                  <div className="stat-value">{assessmentPerformance.statistics.highestScore}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Lowest Score</div>
                  <div className="stat-value">{assessmentPerformance.statistics.lowestScore}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Median Score</div>
                  <div className="stat-value">{assessmentPerformance.statistics.medianScore}%</div>
                </div>
              </div>

              {/* Performance Distribution */}
              {assessmentPerformance.distribution && assessmentPerformance.distribution.length > 0 && (
                <div className="chart-container">
                  <h3 className="chart-title">
                    <i className="bi bi-bar-chart me-2"></i>
                    Performance Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={assessmentPerformance.distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="count" fill="#667eea" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CLASS PERFORMANCE VIEW */}
      {activeView === "classes" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-people me-2"></i>
            Class-wise Performance Overview
          </h3>

          <div className="chart-container">
            <h4 className="chart-title">Average Scores by Class</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classwisePerformance.classes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="className" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                <Bar dataKey="averageScore" fill="#667eea" name="Average Score" radius={[8, 8, 0, 0]} />
                <Bar dataKey="completionRate" fill="#10b981" name="Completion Rate" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Class Details Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Students</th>
                  <th>Avg Score</th>
                  <th>Attendance</th>
                  <th>Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {classwisePerformance.classes.map((classData, index) => (
                  <tr key={index}>
                    <td><strong>{classData.className}</strong></td>
                    <td>{classData.totalStudents}</td>
                    <td>{classData.averageScore.toFixed(1)}%</td>
                    <td>{classData.attendanceRate}%</td>
                    <td>
                      <span className={`badge ${classData.completionRate >= 80 ? "bg-success" : "bg-warning"}`}>
                        {classData.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TEACHER ACTIVITY VIEW */}
      {activeView === "teachers" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-person-badge me-2"></i>
            Teacher Activity & Engagement
          </h3>

          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#e0e7ff", color: "#667eea" }}>
                <i className="bi bi-people"></i>
              </div>
              <div>
                <div className="metric-value">{teacherActivity.totalTeachers}</div>
                <div className="metric-label">Total Teachers</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                <i className="bi bi-graph-up"></i>
              </div>
              <div>
                <div className="metric-value">{teacherActivity.averageEngagement.toFixed(1)}%</div>
                <div className="metric-label">Average Engagement</div>
              </div>
            </div>
          </div>

          {/* Teacher Details Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Classes</th>
                  <th>Assessments Created</th>
                  <th>Engagement Rate</th>
                  <th>Class Average</th>
                </tr>
              </thead>
              <tbody>
                {teacherActivity.teachers.map((teacher, index) => (
                  <tr key={index}>
                    <td><strong>{teacher.teacherName}</strong></td>
                    <td>{teacher.classes}</td>
                    <td>{teacher.assessmentsCreated}</td>
                    <td>
                      <span className={`badge ${teacher.engagementRate >= 90 ? "bg-success" : "bg-warning"}`}>
                        {teacher.engagementRate.toFixed(1)}%
                      </span>
                    </td>
                    <td>{teacher.classAverage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ENROLLMENT TRENDS VIEW */}
      {activeView === "enrollment" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-graph-up me-2"></i>
            Student Enrollment Trends
          </h3>

          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#e0e7ff", color: "#667eea" }}>
                <i className="bi bi-people"></i>
              </div>
              <div>
                <div className="metric-value">{enrollmentTrends.currentTotal}</div>
                <div className="metric-label">Current Total</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                <i className="bi bi-graph-up-arrow"></i>
              </div>
              <div>
                <div className="metric-value">{enrollmentTrends.growthRate.toFixed(1)}%</div>
                <div className="metric-label">Growth Rate</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                <i className="bi bi-calendar-plus"></i>
              </div>
              <div>
                <div className="metric-value">{enrollmentTrends.projectedNextMonth}</div>
                <div className="metric-label">Projected Next Month</div>
              </div>
            </div>
          </div>

          {/* Enrollment Chart */}
          <div className="chart-container">
            <h4 className="chart-title">Monthly Enrollment Trends</h4>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={enrollmentTrends.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                <Line type="monotone" dataKey="totalStudents" stroke="#667eea" strokeWidth={3} name="Total Students" />
                <Line type="monotone" dataKey="newEnrollments" stroke="#10b981" strokeWidth={3} name="New Enrollments" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Enrollment Details Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Students</th>
                  <th>New Enrollments</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                {enrollmentTrends.monthlyTrends.map((trend, index) => {
                  const prevTotal = index > 0 ? enrollmentTrends.monthlyTrends[index - 1].totalStudents : trend.totalStudents;
                  const growth = index > 0 ? ((trend.totalStudents - prevTotal) / prevTotal * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={index}>
                      <td><strong>{trend.month}</strong></td>
                      <td>{trend.totalStudents}</td>
                      <td>{trend.newEnrollments}</td>
                      <td>
                        <span className={`badge ${parseFloat(growth) >= 0 ? "bg-success" : "bg-danger"}`}>
                          {growth}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrincipalDashboard;
