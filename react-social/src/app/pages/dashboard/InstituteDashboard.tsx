import { FC, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { PageTitle } from "../../../_metronic/layout/core";
import { getCSSVariableValue } from "../../../_metronic/assets/ts/_utils";
import { toAbsoluteUrl } from "../../../_metronic/helpers";
import { useThemeMode } from "../../../_metronic/partials/layout/theme-mode/ThemeModeProvider";
import { getStudentsWithMappingByInstituteId, StudentWithMapping } from "../StudentInformation/StudentInfo_APIs";

type DashboardRole = "principal" | "teacher" | "student";

type StatCard = {
  title: string;
  value: string;
  helper: string;
  tone: "primary" | "success" | "info" | "warning" | "danger";
};

type HeatmapSeries = { name: string; data: { x: string; y: number }[] };
type RadarSeries = { name: string; data: number[] };

type RoleData = {
  subtitle: string;
  stats: StatCard[];
  gradeDistribution: { labels: string[]; series: number[]; note: string };
  aspirationSuitability: HeatmapSeries[];
  personalities: { categories: string[]; series: RadarSeries[] };
  intelligence: { categories: string[]; series: RadarSeries[] };
  valuesAcrossCodes: HeatmapSeries[];
  studentHighlights?: {
    totalScore: number;
    percentile: number;
    focus: string;
    steps: string[];
    classCodeProgress: { label: string; score: number }[];
  };
};

const dashboards: Record<DashboardRole, RoleData> = {
  principal: {
    subtitle: "School-wide trendline for leadership visibility",
    stats: [
      {
        title: "Total students",
        value: "642",
        helper: "Across grades 8–12",
        tone: "primary",
      },
      {
        title: "Completed Assessment",
        value: "304",
        helper: "Finished Navigator Assessment",
        tone: "success",
      },
      {
        title: "Assessment Not Started",
        value: "338",
        helper: "Not Started Navigator Assessment",
        tone: "info",
      },
      {
        title: "Need attention",
        value: "24",
        helper: "Below 50 suitability score",
        tone: "danger",
      },
    ],
    gradeDistribution: {
      labels: ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
      series: [88, 120, 136, 142, 156],
      note: "2024-25 enrollment",
    },
    aspirationSuitability: [
      {
        name: "Architecture",
        data: [
          { x: "Aspiration", y: 8 },
          { x: "Suitability", y: 7 },
        ],
      },
      {
        name: "Business & Marketing",
        data: [
          { x: "Aspiration", y: 6 },
          { x: "Suitability", y: 8 },
        ],
      },
      {
        name: "Design & Communication",
        data: [
          { x: "Aspiration", y: 7 },
          { x: "Suitability", y: 7 },
        ],
      },
      {
        name: "Management & Admin",
        data: [
          { x: "Aspiration", y: 8 },
          { x: "Suitability", y: 9 },
        ],
      },
      {
        name: "Science & Mathematics",
        data: [
          { x: "Aspiration", y: 6 },
          { x: "Suitability", y: 7 },
        ],
      },
      {
        name: "Health & Life Sciences",
        data: [
          { x: "Aspiration", y: 5 },
          { x: "Suitability", y: 6 },
        ],
      },
      {
        name: "Hospitality & Tourism",
        data: [
          { x: "Aspiration", y: 5 },
          { x: "Suitability", y: 6 },
        ],
      },
    ],
    personalities: {
      categories: ["Social", "Enterprising", "Investigative", "Artistic", "Conventional"],
      series: [
        { name: "Top 3 dominant", data: [88, 83, 76, 68, 62] },
        { name: "School average", data: [72, 69, 70, 61, 58] },
      ],
    },
    intelligence: {
      categories: [
        "Logical",
        "Intrapersonal",
        "Interpersonal",
        "Visual-Spatial",
        "Naturalistic",
        "Linguistic",
        "Kinesthetic",
        "Musical",
      ],
      series: [
        { name: "Average score", data: [8.1, 7.4, 7.1, 6.8, 6.2, 7.0, 6.5, 5.9] },
        { name: "Benchmark", data: [7.0, 7.0, 6.8, 6.2, 6.0, 6.4, 6.1, 5.5] },
      ],
    },
    valuesAcrossCodes: [
      {
        name: "Autonomy",
        data: [
          { x: "Insight Navigator", y: 8 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 6 },
        ],
      },
      {
        name: "Building relationships",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 8 },
        ],
      },
      {
        name: "Creativity",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 6 },
          { x: "Career Navigator", y: 6 },
        ],
      },
      {
        name: "Helping society",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 6 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Leadership",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 9 },
        ],
      },
      {
        name: "Work-life harmony",
        data: [
          { x: "Insight Navigator", y: 5 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Variety & growth",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 8 },
        ],
      },
    ],
  },
  teacher: {
    subtitle: "Grade-wise growth snapshot for your sections",
    stats: [
      {
        title: "Completion this term",
        value: "91%",
        helper: "Students finished weekly milestones",
        tone: "success",
      },
      {
        title: "Avg suitability",
        value: "74",
        helper: "Across current classes",
        tone: "primary",
      },
      {
        title: "Students slipping",
        value: "12",
        helper: "Need 1:1 coaching",
        tone: "warning",
      },
      {
        title: "Parent connects",
        value: "9",
        helper: "Scheduled this week",
        tone: "info",
      },
    ],
    gradeDistribution: {
      labels: ["Grade 8", "Grade 9", "Grade 10", "Grade 11"],
      series: [52, 68, 72, 61],
      note: "Your advisory groups",
    },
    aspirationSuitability: [
      {
        name: "STEM pathways",
        data: [
          { x: "Aspiration", y: 7 },
          { x: "Suitability", y: 6 },
        ],
      },
      {
        name: "Commerce",
        data: [
          { x: "Aspiration", y: 6 },
          { x: "Suitability", y: 8 },
        ],
      },
      {
        name: "Arts & Media",
        data: [
          { x: "Aspiration", y: 5 },
          { x: "Suitability", y: 7 },
        ],
      },
      {
        name: "Healthcare",
        data: [
          { x: "Aspiration", y: 4 },
          { x: "Suitability", y: 6 },
        ],
      },
      {
        name: "Entrepreneurship",
        data: [
          { x: "Aspiration", y: 7 },
          { x: "Suitability", y: 7 },
        ],
      },
    ],
    personalities: {
      categories: ["Social", "Enterprising", "Investigative", "Artistic", "Conventional"],
      series: [
        { name: "Top 3 dominant", data: [81, 77, 74, 66, 59] },
        { name: "Class average", data: [70, 71, 69, 62, 55] },
      ],
    },
    intelligence: {
      categories: [
        "Logical",
        "Intrapersonal",
        "Interpersonal",
        "Visual-Spatial",
        "Naturalistic",
        "Linguistic",
        "Kinesthetic",
        "Musical",
      ],
      series: [
        { name: "Average score", data: [7.8, 7.1, 7.0, 6.5, 6.0, 6.6, 6.2, 5.7] },
        { name: "Benchmark", data: [7.0, 7.0, 6.8, 6.2, 6.0, 6.4, 6.1, 5.5] },
      ],
    },
    valuesAcrossCodes: [
      {
        name: "Autonomy",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 6 },
          { x: "Career Navigator", y: 6 },
        ],
      },
      {
        name: "Building relationships",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Creativity",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 6 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Helping society",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 8 },
        ],
      },
      {
        name: "Leadership",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 8 },
        ],
      },
      {
        name: "Work-life harmony",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Variety & growth",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 8 },
        ],
      },
    ],
  },
  student: {
    subtitle: "Your personalized insight snapshot",
    stats: [
      {
        title: "Suitability score",
        value: "82 / 100",
        helper: "Career Navigator",
        tone: "primary",
      },
      {
        title: "Top personality",
        value: "Enterprising",
        helper: "89% fit",
        tone: "success",
      },
      {
        title: "Top intelligence",
        value: "Logical",
        helper: "8.1 / 10",
        tone: "info",
      },
      {
        title: "Peer percentile",
        value: "86th",
        helper: "vs class code peers",
        tone: "warning",
      },
    ],
    gradeDistribution: {
      labels: ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
      series: [48, 92, 118, 126, 132],
      note: "Context: whole school",
    },
    aspirationSuitability: [
      {
        name: "Business Management",
        data: [
          { x: "Aspiration", y: 8 },
          { x: "Suitability", y: 9 },
        ],
      },
      {
        name: "Data & Analytics",
        data: [
          { x: "Aspiration", y: 7 },
          { x: "Suitability", y: 8 },
        ],
      },
      {
        name: "Marketing & Communication",
        data: [
          { x: "Aspiration", y: 6 },
          { x: "Suitability", y: 7 },
        ],
      },
      {
        name: "Product Design",
        data: [
          { x: "Aspiration", y: 5 },
          { x: "Suitability", y: 6 },
        ],
      },
    ],
    personalities: {
      categories: ["Social", "Enterprising", "Investigative", "Artistic", "Conventional"],
      series: [
        { name: "Your scores", data: [82, 89, 72, 64, 58] },
        { name: "Peer average", data: [74, 70, 67, 59, 55] },
      ],
    },
    intelligence: {
      categories: [
        "Logical",
        "Intrapersonal",
        "Interpersonal",
        "Visual-Spatial",
        "Naturalistic",
        "Linguistic",
        "Kinesthetic",
        "Musical",
      ],
      series: [
        { name: "Your score", data: [8.1, 7.6, 7.2, 6.8, 6.1, 7.2, 6.4, 5.8] },
        { name: "Peer average", data: [7.0, 7.0, 6.8, 6.2, 6.0, 6.4, 6.1, 5.5] },
      ],
    },
    valuesAcrossCodes: [
      {
        name: "Autonomy",
        data: [
          { x: "Insight Navigator", y: 9 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Building relationships",
        data: [
          { x: "Insight Navigator", y: 8 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Creativity",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 6 },
        ],
      },
      {
        name: "Helping society",
        data: [
          { x: "Insight Navigator", y: 6 },
          { x: "Stream Navigator", y: 6 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Leadership",
        data: [
          { x: "Insight Navigator", y: 8 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 9 },
        ],
      },
      {
        name: "Work-life harmony",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 7 },
          { x: "Career Navigator", y: 7 },
        ],
      },
      {
        name: "Variety & growth",
        data: [
          { x: "Insight Navigator", y: 7 },
          { x: "Stream Navigator", y: 8 },
          { x: "Career Navigator", y: 8 },
        ],
      },
    ],
    studentHighlights: {
      totalScore: 82,
      percentile: 86,
      focus:
        "You are strongest in Enterprising and Logical reasoning. Double down on communication practice and creative experimentation.",
      steps: [
        "Book a 1:1 guidance session this week",
        "Add two college programs to your watchlist",
        "Complete the Stream Navigator reflection",
      ],
      classCodeProgress: [
        { label: "Insight Navigator", score: 96 },
        { label: "Stream Navigator", score: 82 },
        { label: "Career Navigator", score: 78 },
      ],
    },
  },
};

const cssColor = (variable: string, fallback: string) =>
  (getCSSVariableValue(variable) || fallback).trim() || fallback;

// Modal types for student lists
type ModalType = 'total' | 'ongoing' | 'completed' | 'notstarted' | null;

// Student list modal component
const StudentListModal: FC<{
  show: boolean;
  onClose: () => void;
  title: string;
  students: StudentWithMapping[];
}> = ({ show, onClose, title, students }) => {
  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {students.length === 0 ? (
              <div className="text-center text-muted py-5">No students found</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-row-bordered table-row-gray-200 align-middle gs-0 gy-3">
                  <thead>
                    <tr className="fw-bold text-muted bg-light">
                      <th className="ps-4 min-w-50px">#</th>
                      <th className="min-w-150px">Name</th>
                      <th className="min-w-100px">Roll Number</th>
                      <th className="min-w-200px">Assessment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.userStudentId}>
                        <td className="ps-4">{index + 1}</td>
                        <td className="fw-semibold text-gray-800">{student.name || 'N/A'}</td>
                        <td className="text-gray-600">{student.schoolRollNumber || 'N/A'}</td>
                        <td>
                          {student.assessments && student.assessments.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {student.assessments.map((assessment, idx) => (
                                <span
                                  key={idx}
                                  className={`badge ${assessment.status === 'completed'
                                    ? 'badge-light-success'
                                    : assessment.status === 'inprogress'
                                      ? 'badge-light-warning'
                                      : 'badge-light-secondary'
                                    }`}
                                  title={assessment.assessmentName}
                                >
                                  {assessment.assessmentName}: {assessment.status}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="badge badge-light-secondary">No assessments</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <span className="text-muted me-auto">Total: {students.length} students</span>
            <button type="button" className="btn btn-light-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DashboardAdminContentProps {
  students: StudentWithMapping[];
  isLoading: boolean;
}

const DashboardAdminContent: FC<DashboardAdminContentProps> = ({ students, isLoading }) => {
  const { mode } = useThemeMode();
  const navigate = useNavigate();
  const [role, setRole] = useState<DashboardRole>("principal");
  const [now, setNow] = useState(new Date());
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Compute student stats from assessment data
  const studentStats = useMemo(() => {
    const total = students.length;

    // Not started: students with at least one assessment that has 'notstarted' status
    const notStarted = students.filter(student =>
      student.assessments?.some(a => a.status === 'notstarted')
    );

    // Ongoing (In Progress): students with at least one assessment that has 'inprogress' status
    const ongoing = students.filter(student =>
      student.assessments?.some(a => a.status === 'inprogress')
    );

    // Completed: students where ALL assessments have 'completed' status
    const completed = students.filter(student =>
      student.assessments && student.assessments.length > 0 &&
      student.assessments.every(a => a.status === 'completed')
    );

    return {
      total,
      notStartedCount: notStarted.length,
      ongoingCount: ongoing.length,
      completedCount: completed.length,
      notStartedStudents: notStarted,
      ongoingStudents: ongoing,
      completedStudents: completed,
      allStudents: students,
    };
  }, [students]);

  // Create a mutable copy of dashboards data with dynamic student count
  const data = useMemo(() => {
    const roleData = { ...dashboards[role] };

    // Update the stats with actual counts for principal view
    // Order: Total → Ongoing → Completed → Not Started
    if (role === "principal") {
      roleData.stats = [...roleData.stats];
      roleData.stats[0] = {
        ...roleData.stats[0],
        title: "Total students",
        value: isLoading ? "..." : studentStats.total.toString(),
        helper: "Across all grades",
        tone: "primary",
      };
      roleData.stats[1] = {
        ...roleData.stats[1],
        title: "Ongoing Assessment",
        value: isLoading ? "..." : studentStats.ongoingCount.toString(),
        helper: "Assessment in progress",
        tone: "warning",
      };
      roleData.stats[2] = {
        ...roleData.stats[2],
        title: "Completed Assessment",
        value: isLoading ? "..." : studentStats.completedCount.toString(),
        helper: "Finished all assessments",
        tone: "success",
      };
      roleData.stats[3] = {
        ...roleData.stats[3],
        title: "Not Started",
        value: isLoading ? "..." : studentStats.notStartedCount.toString(),
        helper: "Assessment not started",
        tone: "danger",
      };
    }

    return roleData;
  }, [role, isLoading, studentStats]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const palette = useMemo(
    () => ({
      primary: cssColor("--kt-primary", "#009ef7"),
      success: cssColor("--kt-success", "#50cd89"),
      warning: cssColor("--kt-warning", "#ffc700"),
      info: cssColor("--kt-info", "#7239ea"),
      danger: cssColor("--kt-danger", "#f1416c"),
      gray700: cssColor("--kt-gray-700", "#5e6278"),
      gray500: cssColor("--kt-gray-500", "#99a1b7"),
      border: cssColor("--kt-gray-200", "#eff2f5"),
    }),
    [mode]
  );

  const gradeDistributionOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "donut", fontFamily: "inherit", toolbar: { show: false } },
      labels: data.gradeDistribution.labels,
      legend: {
        position: "bottom",
        labels: { colors: palette.gray700 },
        fontSize: "13px",
      },
      colors: [
        palette.primary,
        palette.success,
        palette.info,
        palette.warning,
        palette.danger,
      ],
      stroke: { width: 0 },
      dataLabels: {
        enabled: true,
        style: { colors: ["#fff"], fontSize: "12px" },
        dropShadow: { enabled: false },
      },
      plotOptions: { pie: { donut: { size: "55%" } } },
      tooltip: {
        y: {
          formatter: (val: number) => `${val} students`,
        },
      },
    }),
    [data.gradeDistribution.labels, palette]
  );

  const aspirationOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "heatmap", fontFamily: "inherit", toolbar: { show: false } },
      dataLabels: { enabled: false },
      legend: { show: false },
      xaxis: {
        labels: {
          style: { colors: [palette.gray700, palette.gray700] },
        },
      },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.5,
          distributed: true,
          colorScale: {
            ranges: [
              { from: 0, to: 4, color: palette.border, name: "Low" },
              { from: 4.01, to: 6.5, color: palette.info, name: "Medium" },
              { from: 6.51, to: 10, color: palette.primary, name: "High" },
            ],
          },
        },
      },
      grid: {
        borderColor: palette.border,
        strokeDashArray: 4,
      },
    }),
    [palette]
  );

  const personalityOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "radar", fontFamily: "inherit", toolbar: { show: false } },
      legend: { position: "bottom", labels: { colors: palette.gray700 } },
      stroke: { width: 2 },
      markers: { size: 4 },
      colors: [palette.primary, palette.info],
      fill: { opacity: 0.15 },
      xaxis: {
        categories: data.personalities.categories,
        labels: { style: { colors: data.personalities.categories.map(() => palette.gray700) } },
      },
      yaxis: {
        show: false,
      },
    }),
    [data.personalities.categories, palette]
  );

  const intelligenceOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", fontFamily: "inherit", toolbar: { show: false } },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 6,
          barHeight: "70%",
        },
      },
      dataLabels: { enabled: false },
      legend: { position: "top", horizontalAlign: "right", labels: { colors: palette.gray700 } },
      xaxis: {
        categories: data.intelligence.categories,
        labels: { style: { colors: data.intelligence.categories.map(() => palette.gray700) } },
      },
      grid: { borderColor: palette.border, strokeDashArray: 4 },
      colors: [palette.success, palette.warning],
    }),
    [data.intelligence.categories, palette]
  );

  const valuesOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "heatmap", fontFamily: "inherit", toolbar: { show: false } },
      dataLabels: { enabled: false },
      legend: { show: false },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.5,
          colorScale: {
            ranges: [
              { from: 0, to: 4, color: palette.border, name: "Lower" },
              { from: 4.01, to: 6.5, color: palette.warning, name: "Balanced" },
              { from: 6.51, to: 10, color: palette.success, name: "Strong" },
            ],
          },
        },
      },
      xaxis: {
        labels: { style: { colors: ["#a1a5b7", "#a1a5b7", "#a1a5b7"] } },
      },
      grid: { borderColor: palette.border, strokeDashArray: 4 },
    }),
    [palette]
  );

  const dateDisplay = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [now]
  );
  const timeDisplay = useMemo(
    () => now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    [now]
  );

  const handleNavigateToStudentList = () => {
    // Optional: Verify instituteId exists before navigating
    const instituteId = localStorage.getItem('instituteId');

    if (!instituteId) {
      alert('Institute ID not found. Please reload the page.');
      return;
    }

    navigate("/school/dashboard/studentList");
  };

  return (
    <>
      <PageTitle breadcrumbs={[]}>Dashboard V2</PageTitle>
      <div className="d-flex flex-column gap-5">
        <div className="card shadow-sm">
          <div className="card-body py-5 px-5 d-flex flex-wrap align-items-center justify-content-between gap-4">
            <div className="d-flex align-items-center gap-4 flex-wrap">
              <div className="d-flex align-items-center gap-3">
                <img
                  src={toAbsoluteUrl("/media/logos/kcc.jpg")}
                  alt="School logo"
                  className="h-60px rounded shadow-sm"
                />
              </div>
              <div>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <span className="fw-bold fs-2 text-gray-800">Career-9 Insight Center</span>
                  <span className="badge badge-light-primary fw-semibold text-uppercase">
                    {role === "principal" && "Principal view"}
                    {role === "teacher" && "Teacher view"}
                    {role === "student" && "Student view"}
                  </span>
                </div>
                <div className="text-muted fw-semibold">
                  {data.subtitle}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <span className="badge badge-light-primary">Class code 1: Insight Navigator</span>
                  <span className="badge badge-light-info">Class code 2: Stream Navigator</span>
                  <span className="badge badge-light-success">Class code 3: Career Navigator</span>
                </div>
              </div>
            </div>
            <div className="text-end d-flex flex-column align-items-end gap-3">
              <div>
                <div className="text-muted text-uppercase fs-8">Today</div>
                <div className="fw-bold fs-4 text-gray-800">{dateDisplay}</div>
                <div className="fw-semibold text-primary">{timeDisplay}</div>
              </div>
              <div className="btn-group" role="group" aria-label="Select dashboard view">
                <button
                  className={`btn btn-sm ${role === "principal" ? "btn-primary" : "btn-light-primary"}`}
                  onClick={() => setRole("principal")}
                >
                  Principal
                </button>
                <button
                  className={`btn btn-sm ${role === "teacher" ? "btn-primary" : "btn-light-primary"}`}
                  onClick={() => setRole("teacher")}
                >
                  Teacher
                </button>
                <button
                  className={`btn btn-sm ${role === "student" ? "btn-primary" : "btn-light-primary"}`}
                  onClick={() => setRole("student")}
                >
                  Student
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 row-cols-1 row-cols-md-2 row-cols-xl-4">
          {data.stats.map((stat, index) => {
            // All 4 cards are clickable in principal view
            const isClickable = role === "principal";
            // Order: 0=total, 1=ongoing, 2=completed, 3=notstarted
            const modalType: ModalType = index === 0 ? 'total' : index === 1 ? 'ongoing' : index === 2 ? 'completed' : index === 3 ? 'notstarted' : null;

            return (
              <div className="col" key={stat.title}>
                <div
                  className={`card shadow-sm h-100 ${isClickable ? 'cursor-pointer' : ''}`}
                  onClick={isClickable ? () => setActiveModal(modalType) : undefined}
                  style={isClickable ? { cursor: 'pointer', transition: 'transform 0.2s' } : undefined}
                  onMouseEnter={isClickable ? (e) => (e.currentTarget.style.transform = 'scale(1.02)') : undefined}
                  onMouseLeave={isClickable ? (e) => (e.currentTarget.style.transform = 'scale(1)') : undefined}
                >
                  <div className="card-body py-4 d-flex flex-column gap-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="text-gray-600 fw-semibold text-uppercase fs-8">
                        {stat.title}
                      </span>
                      <span className={`badge badge-light-${stat.tone}`}>{stat.helper}</span>
                    </div>
                    <div className="d-flex align-items-end justify-content-between">
                      {isLoading && role === "principal" ? (
                        <div className="d-flex align-items-center gap-2">
                          <span className="spinner-border spinner-border-sm text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </span>
                          <span className="text-muted fs-6">Loading...</span>
                        </div>
                      ) : (
                        <span className="fw-bolder fs-2 text-gray-800">{stat.value}</span>
                      )}
                      {isClickable && !isLoading && (
                        <span className="text-muted fs-8">
                          <i className="bi bi-eye-fill me-1"></i>View
                        </span>
                      )}
                    </div>
                    {index === 0 && role === "principal" && (
                      <button
                        className="btn btn-sm btn-primary mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToStudentList();
                        }}
                      >
                        List of Students
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="row g-5">
          <div className="col-12 col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-header border-0">
                <div>
                  <div className="fw-bold fs-4 text-gray-800">Grade distribution</div>
                  <div className="text-muted fs-7">{data.gradeDistribution.note}</div>
                </div>
              </div>
              <div className="card-body pt-0">
                <Chart
                  options={gradeDistributionOptions}
                  series={data.gradeDistribution.series}
                  type="donut"
                  height={320}
                />
                <div className="mt-4 p-3 rounded border" style={{ borderColor: palette.border }}>
                  <div className="d-flex justify-content-between fw-semibold text-gray-700">
                    <span>Student distribution by grade</span>
                    <span className="text-primary">{data.gradeDistribution.series.reduce((a, b) => a + b, 0)} total</span>
                  </div>
                  <div className="text-muted fs-7 mt-2">
                    Insight Navigator keeps the view current as new students complete their profiles.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="card shadow-sm h-100">
              <div className="card-header border-0 d-flex flex-wrap justify-content-between align-items-center">
                <div>
                  <div className="fw-bold fs-4 text-gray-800">Career aspiration vs suitability</div>
                  <div className="text-muted fs-7">Aligned to recent Career Navigator completions</div>
                </div>
              </div>
              <div className="card-body pt-0">
                <Chart
                  key={`${role}-aspiration-${mode}`}
                  options={aspirationOptions}
                  series={data.aspirationSuitability as ApexOptions["series"]}
                  type="heatmap"
                  height={340}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="row g-5">
          <div className="col-12 col-xl-6">
            <div className="card shadow-sm h-100">
              <div className="card-header border-0 d-flex flex-wrap justify-content-between align-items-center">
                <div>
                  <div className="fw-bold fs-4 text-gray-800">Top personalities</div>
                  <div className="text-muted fs-7">Top 3 dominant personalities with average</div>
                </div>
                <span className="badge badge-light-primary">RIASEC blend</span>
              </div>
              <div className="card-body pt-0">
                <Chart
                  key={`${role}-personality-${mode}`}
                  options={personalityOptions}
                  series={data.personalities.series as ApexOptions["series"]}
                  type="radar"
                  height={340}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-6">
            <div className="card shadow-sm h-100">
              <div className="card-header border-0 d-flex flex-wrap justify-content-between align-items-center">
                <div>
                  <div className="fw-bold fs-4 text-gray-800">Top intelligences</div>
                  <div className="text-muted fs-7">Dominant intelligences with cohort benchmark</div>
                </div>
                <span className="badge badge-light-success">Average score</span>
              </div>
              <div className="card-body pt-0">
                <Chart
                  key={`${role}-intelligence-${mode}`}
                  options={intelligenceOptions}
                  series={data.intelligence.series as ApexOptions["series"]}
                  type="bar"
                  height={340}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="card-header border-0 d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <div className="fw-bold fs-4 text-gray-800">Values across class codes</div>
              <div className="text-muted fs-7">
                Insight Navigator, Stream Navigator, and Career Navigator responses
              </div>
            </div>
            <div className="d-flex gap-2">
              <span className="badge badge-light-primary">Insight Navigator</span>
              <span className="badge badge-light-info">Stream Navigator</span>
              <span className="badge badge-light-success">Career Navigator</span>
            </div>
          </div>
          <div className="card-body pt-0">
            <Chart
              key={`${role}-values-${mode}`}
              options={valuesOptions}
              series={data.valuesAcrossCodes as ApexOptions["series"]}
              type="heatmap"
              height={360}
            />
          </div>
        </div>

        {data.studentHighlights && (
          <div className="card shadow-sm border-dashed border-2" style={{ borderColor: palette.border }}>
            <div className="card-body py-5">
              <div className="row g-4">
                <div className="col-12 col-lg-4 d-flex flex-column gap-3">
                  <div className="fw-bold fs-3 text-gray-800">Your scorecard</div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="symbol symbol-50px symbol-circle bg-light-primary">
                      <span className="symbol-label text-primary fw-bold fs-2">
                        {data.studentHighlights.totalScore}
                      </span>
                    </div>
                    <div>
                      <div className="fw-semibold text-gray-700">Total suitability score</div>
                      <div className="text-muted fs-7">Percentile {data.studentHighlights.percentile} vs peers</div>
                    </div>
                  </div>
                  <div className="text-muted">{data.studentHighlights.focus}</div>
                  <div className="d-flex flex-column gap-2">
                    {data.studentHighlights.steps.map((step) => (
                      <div key={step} className="d-flex align-items-center gap-2">
                        <span className="bullet bullet-dot bg-primary w-10px h-10px"></span>
                        <span className="text-gray-700">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-12 col-lg-8">
                  <div className="fw-semibold text-gray-700 mb-3">Class code progress</div>
                  <div className="d-flex flex-column gap-3">
                    {data.studentHighlights.classCodeProgress.map((item) => (
                      <div key={item.label}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-gray-700 fw-semibold">{item.label}</span>
                          <span className="text-primary fw-bold">{item.score}%</span>
                        </div>
                        <div className="progress h-8px bg-light">
                          <div
                            className="progress-bar bg-primary"
                            role="progressbar"
                            style={{ width: `${item.score}%` }}
                            aria-valuenow={item.score}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Student List Modals */}
      <StudentListModal
        show={activeModal === 'total'}
        onClose={() => setActiveModal(null)}
        title="All Students"
        students={studentStats.allStudents}
      />
      <StudentListModal
        show={activeModal === 'ongoing'}
        onClose={() => setActiveModal(null)}
        title="Students with Ongoing Assessments"
        students={studentStats.ongoingStudents}
      />
      <StudentListModal
        show={activeModal === 'completed'}
        onClose={() => setActiveModal(null)}
        title="Students with Completed Assessments"
        students={studentStats.completedStudents}
      />
      <StudentListModal
        show={activeModal === 'notstarted'}
        onClose={() => setActiveModal(null)}
        title="Students with Not Started Assessments"
        students={studentStats.notStartedStudents}
      />
    </>
  );
};

const InstituteDashboard: FC = () => {
  const intl = useIntl();
  const { id } = useParams();
  const [students, setStudents] = useState<StudentWithMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Store instituteId in localStorage and fetch student data
  useEffect(() => {
    if (id) {
      localStorage.setItem('instituteId', id);
      localStorage.setItem('instituteName', ''); // Placeholder for institute name
      console.log('Institute ID saved to localStorage:', id);

      setIsLoading(true);
      // Fetch students with full data
      getStudentsWithMappingByInstituteId(Number(id))
        .then(response => {
          setStudents(response.data);
          console.log('Students fetched:', response.data.length);
        })
        .catch(error => {
          console.error('Error fetching students:', error);
          setStudents([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [id]);

  return (
    <>
      <PageTitle breadcrumbs={[]}>
        {intl.formatMessage({ id: "MENU.DASHBOARD" })}
      </PageTitle>
      <DashboardAdminContent students={students} isLoading={isLoading} />
    </>
  );
};

export { InstituteDashboard };
export default InstituteDashboard;