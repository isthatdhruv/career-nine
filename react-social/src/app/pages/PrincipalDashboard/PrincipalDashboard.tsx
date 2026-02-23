import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

// Workaround for recharts TypeScript compatibility
const PolarAngleAxisFixed = PolarAngleAxis as any;

// ==================== DUMMY DATA ====================

const participationData = [
  { gradeGroup: "6th-8th (Insight Navigator)", classroomSize: 60, studentsAttempted: 50, honestResponses: 90, missingData: 10, completionRate: 83 },
  { gradeGroup: "9th-10th (Stream Navigator)", classroomSize: 55, studentsAttempted: 48, honestResponses: 85, missingData: 15, completionRate: 87 },
  { gradeGroup: "11th-12th (Career Navigator)", classroomSize: 45, studentsAttempted: 40, honestResponses: 92, missingData: 8, completionRate: 89 },
];

const personalityData = {
  averageScores: [
    { gradeGroup: "6th-8th", Doer: 6.2, Thinker: 5.8, Creator: 5.5, Helper: 5.0, Persuader: 4.8, Organizer: 5.3 },
    { gradeGroup: "9th-10th", Doer: 6.8, Thinker: 6.0, Creator: 4.5, Helper: 4.8, Persuader: 4.2, Organizer: 6.5 },
    { gradeGroup: "11th-12th", Doer: 7.1, Thinker: 6.5, Creator: 4.0, Helper: 4.5, Persuader: 3.8, Organizer: 7.0 },
  ],
  dominantTrends: [
    { gradeGroup: "6th-8th", Doer: 25, Thinker: 20, Creator: 18, Helper: 15, Persuader: 12, Organizer: 10 },
    { gradeGroup: "9th-10th", Doer: 30, Thinker: 22, Creator: 10, Helper: 12, Persuader: 8, Organizer: 18 },
    { gradeGroup: "11th-12th", Doer: 32, Thinker: 25, Creator: 8, Helper: 10, Persuader: 5, Organizer: 20 },
  ],
  interpretations: [
    { type: "Doer", trend: "Rising", insight: "Students are practical and action-oriented, preferring hands-on tasks and structured assignments." },
    { type: "Creator", trend: "Declining", insight: "Creative expression declines with academic pressure. Creativity labs and open-ended projects recommended." },
    { type: "Organizer", trend: "Rising", insight: "Students show increasing preference for systematic planning, reflecting academic focus and exam preparation." },
    { type: "Persuader", trend: "Declining", insight: "Reduced risk-taking and persuasion skills. Debate clubs and public speaking programs can help." },
  ],
};

const intelligenceData = [
  { gradeGroup: "6th-8th", highestIntelligence: "Bodily-Kinesthetic", lowestIntelligence: "Linguistic", implication: "Students prefer hands-on learning but need language support." },
  { gradeGroup: "9th-10th", highestIntelligence: "Logical-Mathematical", lowestIntelligence: "Musical", implication: "Strong analytical skills, creativity less nurtured." },
  { gradeGroup: "11th-12th", highestIntelligence: "Intrapersonal", lowestIntelligence: "Spatial-Visual", implication: "Reflective learners but visual creativity less evident." },
];

const intelligenceRadarData = [
  { subject: "Logical-Math", "6th-8th": 6.5, "9th-10th": 7.8, "11th-12th": 7.2 },
  { subject: "Linguistic", "6th-8th": 4.2, "9th-10th": 5.0, "11th-12th": 5.5 },
  { subject: "Bodily-Kinesthetic", "6th-8th": 7.5, "9th-10th": 6.0, "11th-12th": 5.2 },
  { subject: "Musical", "6th-8th": 5.0, "9th-10th": 4.0, "11th-12th": 3.8 },
  { subject: "Spatial-Visual", "6th-8th": 5.8, "9th-10th": 5.5, "11th-12th": 4.5 },
  { subject: "Interpersonal", "6th-8th": 6.0, "9th-10th": 5.2, "11th-12th": 5.0 },
  { subject: "Intrapersonal", "6th-8th": 5.5, "9th-10th": 6.5, "11th-12th": 7.5 },
  { subject: "Naturalistic", "6th-8th": 6.2, "9th-10th": 5.8, "11th-12th": 5.5 },
];

const abilitiesData = [
  { ability: "Decision Making", "6th-8th": 5.5, "9th-10th": 6.8, "11th-12th": 7.2 },
  { ability: "Creativity", "6th-8th": 6.0, "9th-10th": 5.0, "11th-12th": 4.5 },
  { ability: "Computation", "6th-8th": 6.5, "9th-10th": 7.5, "11th-12th": 8.0 },
  { ability: "Speed & Accuracy", "6th-8th": 5.8, "9th-10th": 7.0, "11th-12th": 7.5 },
  { ability: "Communication", "6th-8th": 5.0, "9th-10th": 4.8, "11th-12th": 5.2 },
  { ability: "Motor Skills", "6th-8th": 6.8, "9th-10th": 5.5, "11th-12th": 4.8 },
  { ability: "Problem Solving", "6th-8th": 5.5, "9th-10th": 6.5, "11th-12th": 7.0 },
];

const careerTrendsData = [
  { gradeGroup: "6th-8th", aspirationSTEM: 60, suitabilitySTEM: 62, gap: "Low gap" },
  { gradeGroup: "9th-10th", aspirationSTEM: 70, suitabilitySTEM: 55, gap: "High gap" },
  { gradeGroup: "11th-12th", aspirationSTEM: 40, suitabilitySTEM: 60, gap: "Many capable students lose aspiration" },
];

const careerClarityData = [
  { gradeGroup: "9th-10th", totalStudents: 50, highClarity: 30, moderateClarity: 40, lowClarity: 30 },
  { gradeGroup: "11th-12th", totalStudents: 45, highClarity: 20, moderateClarity: 35, lowClarity: 45 },
];

const studentProfilesData = [
  { name: "A Sharma", personalityDominant: "Thinker", strongestIntelligence: "Logical-Math", weakestAbility: "Communication", careerClarity: "Low", supportLevel: "high" },
  { name: "B Patel", personalityDominant: "Doer", strongestIntelligence: "Kinesthetic", weakestAbility: "Creativity", careerClarity: "Moderate", supportLevel: "medium" },
  { name: "C Singh", personalityDominant: "Organizer", strongestIntelligence: "Intrapersonal", weakestAbility: "Motor Skills", careerClarity: "High", supportLevel: "low" },
  { name: "D Gupta", personalityDominant: "Helper", strongestIntelligence: "Interpersonal", weakestAbility: "Computation", careerClarity: "Low", supportLevel: "high" },
  { name: "E Verma", personalityDominant: "Creator", strongestIntelligence: "Spatial-Visual", weakestAbility: "Speed & Accuracy", careerClarity: "Moderate", supportLevel: "medium" },
  { name: "F Kumar", personalityDominant: "Persuader", strongestIntelligence: "Linguistic", weakestAbility: "Decision Making", careerClarity: "High", supportLevel: "low" },
  { name: "G Joshi", personalityDominant: "Thinker", strongestIntelligence: "Logical-Math", weakestAbility: "Motor Skills", careerClarity: "Low", supportLevel: "high" },
  { name: "H Reddy", personalityDominant: "Doer", strongestIntelligence: "Bodily-Kinesthetic", weakestAbility: "Communication", careerClarity: "Moderate", supportLevel: "medium" },
];

const interventionData = {
  humanSkillTraining: { studentsWeak: 45, totalStudents: 155, areas: ["Communication", "Empathy", "Teamwork"] },
  progressiveCounseling: { reassessed: 62, totalEligible: 95, touchpoints: 3 },
  lmsUsage: { completionPercent: 58, modulesAssigned: 12, modulesCompleted: 7 },
};

// Assessment Summary (from PDF page 3)
const assessmentSummary = {
  totalStudents: 766,
  totalValidData: 596,
  avgTimeMinutes: 50,
  modeOfAssessment: "Offline. Paper-Pencil test",
};

// Personality Profile Pie Data per Navigator (from PDF pages 9, 14, 20)
const personalityPiePerNavigator = {
  "6th-8th": [
    { name: "Doer", value: 28, color: "#667eea" },
    { name: "Thinker", value: 16, color: "#10b981" },
    { name: "Creator", value: 9, color: "#f59e0b" },
    { name: "Helper", value: 8, color: "#ec4899" },
    { name: "Persuader", value: 15, color: "#ef4444" },
    { name: "Organizer", value: 24, color: "#8b5cf6" },
  ],
  "9th-10th": [
    { name: "Doer", value: 26, color: "#667eea" },
    { name: "Thinker", value: 22, color: "#10b981" },
    { name: "Creator", value: 8, color: "#f59e0b" },
    { name: "Helper", value: 8, color: "#ec4899" },
    { name: "Persuader", value: 10, color: "#ef4444" },
    { name: "Organizer", value: 26, color: "#8b5cf6" },
  ],
  "11th-12th": [
    { name: "Doer", value: 25, color: "#667eea" },
    { name: "Thinker", value: 24, color: "#10b981" },
    { name: "Creator", value: 7, color: "#f59e0b" },
    { name: "Helper", value: 8, color: "#ec4899" },
    { name: "Persuader", value: 10, color: "#ef4444" },
    { name: "Organizer", value: 26, color: "#8b5cf6" },
  ],
};

// Intelligence Profile Pie Data per Navigator (from PDF pages 10, 15, 21)
const intelligencePiePerNavigator = {
  "6th-8th": [
    { name: "Bodily-Kinesthetic", value: 22, color: "#667eea" },
    { name: "Intrapersonal", value: 17, color: "#10b981" },
    { name: "Interpersonal", value: 14, color: "#f59e0b" },
    { name: "Naturalistic", value: 12, color: "#059669" },
    { name: "Logical", value: 11, color: "#8b5cf6" },
    { name: "Musical", value: 7, color: "#ec4899" },
    { name: "Visual-Spatial", value: 6, color: "#ef4444" },
    { name: "Linguistic", value: 11, color: "#6366f1" },
  ],
  "9th-10th": [
    { name: "Bodily-Kinesthetic", value: 23, color: "#667eea" },
    { name: "Intrapersonal", value: 17, color: "#10b981" },
    { name: "Interpersonal", value: 13, color: "#f59e0b" },
    { name: "Naturalistic", value: 11, color: "#059669" },
    { name: "Logical", value: 16, color: "#8b5cf6" },
    { name: "Musical", value: 7, color: "#ec4899" },
    { name: "Visual-Spatial", value: 6, color: "#ef4444" },
    { name: "Linguistic", value: 7, color: "#6366f1" },
  ],
  "11th-12th": [
    { name: "Bodily-Kinesthetic", value: 15, color: "#667eea" },
    { name: "Intrapersonal", value: 19, color: "#10b981" },
    { name: "Interpersonal", value: 14, color: "#f59e0b" },
    { name: "Naturalistic", value: 10, color: "#059669" },
    { name: "Logical", value: 16, color: "#8b5cf6" },
    { name: "Musical", value: 10, color: "#ec4899" },
    { name: "Visual-Spatial", value: 10, color: "#ef4444" },
    { name: "Linguistic", value: 6, color: "#6366f1" },
  ],
};

// Personality-Career Alignment (from PDF page 4)
const personalityCareerAlignment = [
  { trait: "Practical (Doer)", classroomBehaviour: "Likely to volunteer for physical tasks, construction-based projects, and problem-solving that involves tangible outputs.", careerImpact: "~1 in 3 STEM-suited students lose aspiration with age." },
  { trait: "Analytical (Thinker)", classroomBehaviour: "May engage deeply in science/math but could disengage if content is purely rote or memory-based. Stress on exam-based performance.", careerImpact: "Curiosity grows (28 → 74) then drops (45). Students avoid research/innovation careers." },
  { trait: "Creative (Creator)", classroomBehaviour: "Produces imaginative work in projects or writing but avoids risk-taking; creative expression often hidden.", careerImpact: "Personality drops to 0 in 11-12th, but aspiration for creative/social careers surges (16% → 38%)." },
  { trait: "Social (Helper)", classroomBehaviour: "Participates in teamwork, may mediate disputes, but rarely takes leadership in social/people-oriented activities.", careerImpact: "Stagnant low (10-16 → 12). Careers needing empathy (Teaching, Counselling, Social Work) remain under-chosen (<10%)." },
  { trait: "Risk-takers (Persuader)", classroomBehaviour: "Moderate confidence in communication; can speak up in debates. Initiative exists but is inconsistent and reduces with age.", careerImpact: "Declines from 14 → 5. Commerce aspiration 22-27% vs suitability ~10-12% (misalignment)." },
  { trait: "Detail-oriented (Organizer)", classroomBehaviour: "Maintains neat work, follows rules, good at structured tasks like note-taking and record-keeping, but less adaptable in open-ended tasks.", careerImpact: "Structure peaks in 9-10th (54), drops in 11-12th (34). Weakens persistence for Law, Civil Services, Accounting." },
];

// Intelligence with Learning Style & Career Impact (from PDF page 6)
const intelligenceCareerImpact = [
  { type: "Naturalistic", learningStyle: "Learns by connecting concepts to nature and real-world environments.", careerImpact: "Indicates strong interest in STEM + sustainability fields (environment, agriculture, green jobs)." },
  { type: "Logical", learningStyle: "Benefits from inquiry-based learning and problem scenarios.", careerImpact: "Earlier ability data shows exam-driven rote culture limits innovation." },
  { type: "Musical", learningStyle: "Enjoys musical connections but may not actively pursue them.", careerImpact: "Creative potential exists, but not reflected in personality/career choices → Music/Arts aspirations fade." },
  { type: "Bodily-Kinesthetic", learningStyle: "Learns best by doing and moving.", careerImpact: "Earlier ability reflects poor gross motor movement; hence sports careers are abandoned later." },
  { type: "Visual-Spatial", learningStyle: "Benefits from mind maps, charts, diagrams, and visual organizers.", careerImpact: "Potential for architecture, design, tech, but low Artistic personality prevents career uptake." },
  { type: "Intrapersonal", learningStyle: "Self-awareness exists but not deepened.", careerImpact: "Students struggle to align aspiration with suitability in senior years." },
  { type: "Linguistic", learningStyle: "May not be highly expressive without support. Poor reading.", careerImpact: "Undercuts careers in law, teaching, management, social sciences." },
  { type: "Interpersonal", learningStyle: "Poor empathy & teamwork.", careerImpact: "Limits leadership, counselling, social service, people-oriented roles." },
];

// Abilities with Classroom Reflection & Career Impact (from PDF page 5)
const abilitiesCareerImpact = [
  { area: "Decision Making & Problem Solving", classroomReflection: "Good at evaluating choices and solutions.", careerImpact: "Drives STEM dominance, but gets channelled into exam-solving instead of innovation." },
  { area: "Speed & Accuracy", classroomReflection: "Work efficiently under time pressure.", careerImpact: "Linked to typing/writing speed → fuels exam-oriented careers (Engineering, Medicine, Civil Services)." },
  { area: "Computational & Logical", classroomReflection: "Confident in math, structured problem-solving, and logical tasks.", careerImpact: "Explains STEM/Commerce aspirations, but poor reasoning weakens research and entrepreneurship." },
  { area: "Creativity", classroomReflection: "Present but not strong; limits innovation and persuasion.", careerImpact: "Explains why Arts/Media/Design careers are aspirational but rarely chosen." },
  { area: "Communication", classroomReflection: "Not expressive and avoid socialising.", careerImpact: "Weakens pursuit of people-oriented careers (Teaching, Counseling, Management)." },
  { area: "Finger Dexterity & Motor Skills", classroomReflection: "Less inclined toward sports-related tasks. But neat, precise in writing and lab work.", careerImpact: "Limits uptake of vocational, design, robotics, and paramedical fields." },
  { area: "Form Perception & Technical", classroomReflection: "Average interest in applied/visual learning.", careerImpact: "Restricts growth in design, architecture, and visual-tech careers." },
];

// Suitable Career vs Aspirations (STEM/Commerce/Other) (from PDF page 7)
const suitableVsAspirations = [
  { gradeGroup: "9th-10th (Suitable)", STEM: 63.74, Commerce: 11.58, Other: 24.69 },
  { gradeGroup: "9th-10th (Aspiration)", STEM: 57.00, Commerce: 27.00, Other: 15.90 },
  { gradeGroup: "11th-12th (Suitable)", STEM: 61.78, Commerce: 10.12, Other: 28.10 },
  { gradeGroup: "11th-12th (Aspiration)", STEM: 39.90, Commerce: 22.30, Other: 37.80 },
];

// Career Mismatch / Pressure Impact (from PDF page 7)
const careerMismatchData = [
  { aspiration: "STEM aspirations 57% → 40% by senior years", mismatch: "Many capable STEM students lose aspiration due to exam fear, narrow perception (doctor/engineer only), and lack of confidence.", navigatorFit: "Navigator restores alignment, including sustainability/green careers." },
  { aspiration: "Commerce aspirations 22-27%", mismatch: "Students get attracted by glamour of Finance/Management but may not have real aptitude.", navigatorFit: "Navigator identifies alternative analytical pathways." },
  { aspiration: "Creative/Social aspirations rise 16% → 38%", mismatch: "Students aspire late for Arts, Humanities, Media, Sports — but most drop these due to lack of exposure, parental pressure, or employability fears.", navigatorFit: "Navigator highlights structured creative/social career paths." },
];

// Challenges-Solutions-Outcomes (from PDF page 8)
const challengesSolutionsData = [
  { challenge: "Narrowing Aspirations: Students begin with curiosity but drift into 'safe' careers (STEM underutilized, Commerce overcrowded, Creative/Social abandoned).", solution: "Progressive Counselling: Multi-stage Navigator tools (Insight, Stream, Career) track growth and guide choices from middle school onwards.", outcome: "Students explore diverse pathways early, maintain confidence in STEM, and pursue creative/social fields with structured support." },
  { challenge: "Exam-Centric Abilities: Strong in computation & speed, but weak in logic, creativity, communication, and dexterity.", solution: "Compass LMS: Project-based learning, robotics/maker labs, and habit-forming tools.", outcome: "Decision-making is channelled into innovation; students build real-world problem-solving, creativity, and dexterity." },
  { challenge: "Personality Decline: Risk-taking, empathy, and creativity drop sharply in senior years.", solution: "Human Skills Development: Modules on communication, empathy, leadership, and resilience.", outcome: "Balanced personality growth; students become confident, empathetic, and adaptable leaders." },
  { challenge: "Intelligence Imbalance: Naturalistic & logical intelligence strong, but linguistic, interpersonal, and creative intelligences underdeveloped.", solution: "Targeted Activities: Debates, teamwork, arts, design, and community work.", outcome: "Students strengthen weaker intelligences, improving expression, teamwork, and creativity while leveraging STEM strengths." },
  { challenge: "Parental & Teacher Bias: Pressure toward 'safe' careers restricts exploration.", solution: "Parent-Teacher Engagement: Orientations, counselling, and CPD training for teachers.", outcome: "Parents support diverse careers; teachers guide beyond exams; schools build a reputation for holistic, future-ready education." },
];

const areaWiseGapsRadar = [
  { area: "Creativity", current: 4.5, target: 7.0 },
  { area: "Communication", current: 5.0, target: 7.5 },
  { area: "Empathy", current: 4.8, target: 7.0 },
  { area: "Motor Skills", current: 5.2, target: 7.0 },
  { area: "Computation", current: 7.5, target: 8.0 },
  { area: "Logical Reasoning", current: 7.0, target: 8.0 },
  { area: "Problem Solving", current: 6.5, target: 8.0 },
  { area: "Naturalistic", current: 5.8, target: 7.0 },
];

type TabType = "overview" | "participation" | "personality" | "intelligence" | "career" | "students" | "recommendations";

const PrincipalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<TabType>("overview");

  const COLORS = ["#667eea", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

  const totalStudents = participationData.reduce((sum, g) => sum + g.classroomSize, 0);
  const totalAttempted = participationData.reduce((sum, g) => sum + g.studentsAttempted, 0);
  const overallCompletion = ((totalAttempted / totalStudents) * 100).toFixed(1);
  const totalHighSupport = studentProfilesData.filter(s => s.supportLevel === "high").length;
  const totalMediumSupport = studentProfilesData.filter(s => s.supportLevel === "medium").length;
  const totalOnTrack = studentProfilesData.filter(s => s.supportLevel === "low").length;

  const cciPieData = [
    { name: "High Clarity", value: 25, color: "#10b981" },
    { name: "Moderate Clarity", value: 38, color: "#f59e0b" },
    { name: "Low Clarity", value: 37, color: "#ef4444" },
  ];

  const supportPieData = [
    { name: "High Support Needed", value: totalHighSupport, color: "#ef4444" },
    { name: "Medium Support", value: totalMediumSupport, color: "#f59e0b" },
    { name: "On Track", value: totalOnTrack, color: "#10b981" },
  ];

  const getSupportBadge = (level: string) => {
    switch (level) {
      case "high": return <span className="support-badge support-high">High Support</span>;
      case "medium": return <span className="support-badge support-medium">Medium Support</span>;
      case "low": return <span className="support-badge support-low">On Track</span>;
      default: return null;
    }
  };

  const getClarityBadge = (clarity: string) => {
    switch (clarity) {
      case "High": return <span className="badge bg-success">{clarity}</span>;
      case "Moderate": return <span className="badge bg-warning text-dark">{clarity}</span>;
      case "Low": return <span className="badge bg-danger">{clarity}</span>;
      default: return <span className="badge bg-secondary">{clarity}</span>;
    }
  };

  return (
    <div className="principal-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            <i className="bi bi-mortarboard-fill me-3"></i>
            Career-9 School Report
          </h1>
          <p className="dashboard-subtitle">Summarised Student Report - Principal's Dashboard</p>
        </div>
        <button className="btn btn-light" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2"></i>
          Back
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        {([
          { key: "overview", icon: "bi-speedometer2", label: "Overview" },
          { key: "participation", icon: "bi-clipboard-data", label: "Participation" },
          { key: "personality", icon: "bi-person-hearts", label: "Personality" },
          { key: "intelligence", icon: "bi-lightbulb", label: "Intelligence & Abilities" },
          { key: "career", icon: "bi-briefcase", label: "Career Trends & Clarity" },
          { key: "students", icon: "bi-people", label: "Student Profiles" },
          { key: "recommendations", icon: "bi-check2-square", label: "Recommendations" },
        ] as { key: TabType; icon: string; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeView === tab.key ? "active" : ""}`}
            onClick={() => setActiveView(tab.key)}
          >
            <i className={`bi ${tab.icon} me-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== OVERVIEW ==================== */}
      {activeView === "overview" && (
        <>
          {/* Top-Level Snapshot Cards */}
          <div className="overview-cards-grid">
            <div className="info-card">
              <i className="bi bi-people-fill info-icon" style={{ color: "#667eea" }}></i>
              <div>
                <div className="info-label">Total Students</div>
                <div className="info-value">{totalStudents}</div>
              </div>
            </div>
            <div className="info-card">
              <i className="bi bi-check-circle-fill info-icon" style={{ color: "#10b981" }}></i>
              <div>
                <div className="info-label">Assessed</div>
                <div className="info-value">{totalAttempted}</div>
              </div>
            </div>
            <div className="info-card">
              <i className="bi bi-percent info-icon" style={{ color: "#f59e0b" }}></i>
              <div>
                <div className="info-label">Completion Rate</div>
                <div className="info-value">{overallCompletion}%</div>
              </div>
            </div>
            <div className="info-card">
              <i className="bi bi-exclamation-triangle-fill info-icon" style={{ color: "#ef4444" }}></i>
              <div>
                <div className="info-label">Need High Support</div>
                <div className="info-value">{totalHighSupport}</div>
              </div>
            </div>
            <div className="info-card">
              <i className="bi bi-bullseye info-icon" style={{ color: "#8b5cf6" }}></i>
              <div>
                <div className="info-label">Avg Career Clarity</div>
                <div className="info-value">25%</div>
              </div>
            </div>
          </div>

          <div className="dashboard-content">
            <div className="two-column-grid">
              {/* Career Clarity Index Pie */}
              <div className="chart-container">
                <h3 className="chart-title">
                  <i className="bi bi-pie-chart me-2"></i>
                  Career Clarity Index (CCI)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={cciPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                      {cciPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend-custom">
                  {cciPieData.map((item, i) => (
                    <span key={i} className="legend-item">
                      <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                      {item.name}: {item.value}%
                    </span>
                  ))}
                </div>
              </div>

              {/* Student Support Distribution */}
              <div className="chart-container">
                <h3 className="chart-title">
                  <i className="bi bi-heart-pulse me-2"></i>
                  Student Support Needs
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={supportPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {supportPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend-custom">
                  {supportPieData.map((item, i) => (
                    <span key={i} className="legend-item">
                      <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                      {item.name}: {item.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Area-Wise Gaps Radar */}
            <div className="chart-container">
              <h3 className="chart-title">
                <i className="bi bi-diagram-3 me-2"></i>
                Area-Wise Competency Gaps (Current vs Target)
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={areaWiseGapsRadar}>
                  <PolarGrid stroke="#e0e0e0" />
                  <PolarAngleAxisFixed dataKey="area" tick={{ fontSize: 12, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 9]} tick={{ fontSize: 10 }} />
                  <Radar name="Current Level" dataKey="current" stroke="#667eea" fill="#667eea" fillOpacity={0.3} strokeWidth={2} />
                  <Radar name="Target Level" dataKey="target" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} strokeDasharray="5 5" />
                  <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Participation by Grade */}
            <div className="chart-container">
              <h3 className="chart-title">
                <i className="bi bi-bar-chart me-2"></i>
                Participation by Navigator Stage
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={participationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="gradeGroup" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                  <Bar dataKey="completionRate" fill="#667eea" name="Completion Rate %" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="honestResponses" fill="#10b981" name="Honest Responses %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ==================== SECTION 1: PARTICIPATION ==================== */}
      {activeView === "participation" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-clipboard-data me-2"></i>
            Section 1: Aggregate & Participation Trends
          </h3>
          <p className="section-description">
            Shows engagement and data quality for each Navigator stage. Helps the school see where student participation can be improved.
          </p>

          {/* Assessment Summary */}
          <div className="assessment-summary-grid">
            <div className="summary-stat-card">
              <i className="bi bi-people-fill"></i>
              <div className="summary-stat-value">{assessmentSummary.totalStudents}</div>
              <div className="summary-stat-label">Total Students</div>
            </div>
            <div className="summary-stat-card">
              <i className="bi bi-check2-all"></i>
              <div className="summary-stat-value">{assessmentSummary.totalValidData}</div>
              <div className="summary-stat-label">Total Valid Data</div>
            </div>
            <div className="summary-stat-card">
              <i className="bi bi-clock-history"></i>
              <div className="summary-stat-value">{assessmentSummary.avgTimeMinutes} mins</div>
              <div className="summary-stat-label">Avg Time for Assessment</div>
            </div>
            <div className="summary-stat-card">
              <i className="bi bi-pencil-square"></i>
              <div className="summary-stat-value" style={{ fontSize: "1rem" }}>{assessmentSummary.modeOfAssessment}</div>
              <div className="summary-stat-label">Mode of Assessment</div>
            </div>
          </div>

          <div className="table-container" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grade Group</th>
                  <th>Classroom Size</th>
                  <th>Students Attempted</th>
                  <th>Honest Responses (%)</th>
                  <th>Missing/Invalid Data (%)</th>
                  <th>Completion Rate (%)</th>
                </tr>
              </thead>
              <tbody>
                {participationData.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.gradeGroup}</strong></td>
                    <td>{row.classroomSize}</td>
                    <td>{row.studentsAttempted}</td>
                    <td>{row.honestResponses}%</td>
                    <td>{row.missingData}%</td>
                    <td>
                      <span className={`badge ${row.completionRate >= 85 ? "bg-success" : "bg-warning text-dark"}`}>
                        {row.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Interpretation:</strong> Overall participation stands at {overallCompletion}%. The 9th-10th grade group shows the highest completion rate at 87%, while 6th-8th grade needs improvement in reducing missing/invalid data (10%).
          </div>

          <div className="chart-container">
            <h4 className="chart-title">Participation Comparison</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={participationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="gradeGroup" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Bar dataKey="classroomSize" fill="#667eea" name="Classroom Size" radius={[8, 8, 0, 0]} />
                <Bar dataKey="studentsAttempted" fill="#10b981" name="Students Attempted" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ==================== SECTION 2: PERSONALITY ==================== */}
      {activeView === "personality" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-person-hearts me-2"></i>
            Section 2: Personality Trends
          </h3>

          {/* Average Stanine Scores by Grade */}
          <h4 className="chart-title" style={{ marginTop: "1rem" }}>Average Stanine Scores by Grade Group</h4>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={personalityData.averageScores}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="gradeGroup" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis domain={[0, 9]} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Bar dataKey="Doer" fill="#667eea" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Thinker" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Creator" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Helper" fill="#ec4899" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Persuader" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Organizer" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Dominant Personality Trend Line */}
          <div className="chart-container">
            <h4 className="chart-title">
              <i className="bi bi-graph-up me-2"></i>
              Dominant Personality Trend (% of students)
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={personalityData.dominantTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="gradeGroup" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Line type="monotone" dataKey="Doer" stroke="#667eea" strokeWidth={3} />
                <Line type="monotone" dataKey="Thinker" stroke="#10b981" strokeWidth={3} />
                <Line type="monotone" dataKey="Creator" stroke="#f59e0b" strokeWidth={3} />
                <Line type="monotone" dataKey="Helper" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="Persuader" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="Organizer" stroke="#8b5cf6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Classroom Behaviour Interpretations */}
          <h4 className="chart-title">
            <i className="bi bi-chat-left-text me-2"></i>
            Classroom Behaviour Interpretation
          </h4>
          <div className="interpretation-cards-grid">
            {personalityData.interpretations.map((item, index) => (
              <div key={index} className={`interpretation-card trend-${item.trend.toLowerCase()}`}>
                <div className="interpretation-header">
                  <strong>{item.type}</strong>
                  <span className={`trend-badge ${item.trend === "Rising" ? "trend-up" : "trend-down"}`}>
                    <i className={`bi ${item.trend === "Rising" ? "bi-arrow-up" : "bi-arrow-down"} me-1`}></i>
                    {item.trend}
                  </span>
                </div>
                <p className="interpretation-text">{item.insight}</p>
              </div>
            ))}
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Concluding Insight:</strong> In 6th-8th, diverse personalities are visible. By 9th-10th, Creator declines and Doer/Organizer rise due to academic focus. In 11th-12th, Persuader declines further, showing reduced risk-taking. These personality shifts directly connect to career aspirations in later sections.
          </div>

          {/* Personality Profile Pie Charts per Navigator */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-pie-chart me-2"></i>
            Personality Profile by Navigator Level
          </h4>
          <div className="three-column-grid">
            {(Object.entries(personalityPiePerNavigator) as [string, typeof personalityPiePerNavigator["6th-8th"]][]).map(([grade, data]) => (
              <div key={grade} className="chart-container" style={{ marginBottom: 0 }}>
                <h5 className="mini-chart-title">{grade === "6th-8th" ? "Insight Navigator (6th-8th)" : grade === "9th-10th" ? "Subject Navigator (9th-10th)" : "Career Navigator (11th-12th)"}</h5>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${value}%`}>
                      {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend-custom" style={{ fontSize: "0.75rem" }}>
                  {data.map((item, i) => (
                    <span key={i} className="legend-item">
                      <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                      {item.name}: {item.value}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Personality-Career Alignment Table */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-link-45deg me-2"></i>
            Alignment between Personality and Career Choices
          </h4>
          <p className="section-description">
            Students display a rich spectrum of personality traits that shape their career alignment and classroom behaviours. Understanding these patterns helps educators nurture strengths and guide students toward fulfilling career pathways.
          </p>
          <div className="table-container" style={{ marginTop: "0.5rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Personality Trait</th>
                  <th>Classroom Behaviour</th>
                  <th>Career Impact</th>
                </tr>
              </thead>
              <tbody>
                {personalityCareerAlignment.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.trait}</strong></td>
                    <td>{row.classroomBehaviour}</td>
                    <td>{row.careerImpact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SECTIONS 3 & 4: INTELLIGENCE & ABILITIES ==================== */}
      {activeView === "intelligence" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-lightbulb me-2"></i>
            Section 3: Intelligence (Learning Styles)
          </h3>

          {/* Intelligence Table */}
          <div className="table-container" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grade Group</th>
                  <th>Highest Intelligence</th>
                  <th>Lowest Intelligence</th>
                  <th>Classroom Implication</th>
                </tr>
              </thead>
              <tbody>
                {intelligenceData.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.gradeGroup}</strong></td>
                    <td><span className="badge bg-success">{row.highestIntelligence}</span></td>
                    <td><span className="badge bg-danger">{row.lowestIntelligence}</span></td>
                    <td>{row.implication}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Intelligence Radar Chart */}
          <div className="chart-container">
            <h4 className="chart-title">
              <i className="bi bi-diagram-3 me-2"></i>
              Intelligence Profile by Grade Group
            </h4>
            <ResponsiveContainer width="100%" height={380}>
              <RadarChart data={intelligenceRadarData}>
                <PolarGrid stroke="#e0e0e0" />
                <PolarAngleAxisFixed dataKey="subject" tick={{ fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 9]} tick={{ fontSize: 10 }} />
                <Radar name="6th-8th" dataKey="6th-8th" stroke="#667eea" fill="#667eea" fillOpacity={0.2} strokeWidth={2} />
                <Radar name="9th-10th" dataKey="9th-10th" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                <Radar name="11th-12th" dataKey="11th-12th" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Interpretation:</strong> Intelligence patterns link directly to learning styles and teaching strategies. Bodily-Kinesthetic dominance in 6th-8th suggests hands-on activities work best. Logical-Mathematical strength in 9th-10th supports analytical coursework. Intrapersonal strength in 11th-12th indicates reflective, self-paced learning is effective.
          </div>

          {/* Intelligence Profile Pie Charts per Navigator */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-pie-chart me-2"></i>
            Intelligence Profile by Navigator Level
          </h4>
          <div className="three-column-grid">
            {(Object.entries(intelligencePiePerNavigator) as [string, typeof intelligencePiePerNavigator["6th-8th"]][]).map(([grade, data]) => (
              <div key={grade} className="chart-container" style={{ marginBottom: 0 }}>
                <h5 className="mini-chart-title">{grade === "6th-8th" ? "Insight Navigator (6th-8th)" : grade === "9th-10th" ? "Subject Navigator (9th-10th)" : "Career Navigator (11th-12th)"}</h5>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${value}%`}>
                      {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend-custom" style={{ fontSize: "0.75rem" }}>
                  {data.map((item, i) => (
                    <span key={i} className="legend-item">
                      <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                      {item.name}: {item.value}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Intelligence Learning Style & Career Impact Table */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-book me-2"></i>
            Unlocking Intelligence for Career Readiness
          </h4>
          <p className="section-description">
            Students demonstrate multiple forms of intelligence that influence how they process information and approach learning. By identifying these patterns, schools can adapt teaching methods to match diverse learning styles.
          </p>
          <div className="table-container" style={{ marginTop: "0.5rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intelligence Type</th>
                  <th>Learning Style in Daily Life</th>
                  <th>Career Impact</th>
                </tr>
              </thead>
              <tbody>
                {intelligenceCareerImpact.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.type}</strong></td>
                    <td>{row.learningStyle}</td>
                    <td>{row.careerImpact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 4: Abilities */}
          <h3 className="section-title" style={{ marginTop: "2.5rem" }}>
            <i className="bi bi-lightning me-2"></i>
            Section 4: Abilities
          </h3>

          <div className="chart-container">
            <h4 className="chart-title">Average Ability Levels by Grade Group</h4>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={abilitiesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" domain={[0, 9]} tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis type="category" dataKey="ability" width={130} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Bar dataKey="6th-8th" fill="#667eea" name="6th-8th" radius={[0, 4, 4, 0]} />
                <Bar dataKey="9th-10th" fill="#10b981" name="9th-10th" radius={[0, 4, 4, 0]} />
                <Bar dataKey="11th-12th" fill="#f59e0b" name="11th-12th" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Interpretation:</strong> Strong in computation & speed — students perform well in exams. Low in creativity & motor skills — students may struggle with open-ended design or vocational tasks. Communication skills remain consistently weak across all grade groups, indicating a school-wide need for intervention.
          </div>

          {/* Abilities Classroom Reflection & Career Impact Table */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-signpost-2 me-2"></i>
            Turning Abilities into Career Readiness
          </h4>
          <p className="section-description">
            Students demonstrate specific ability patterns that directly impact their academic performance and career choices. By recognizing these patterns, schools can design targeted interventions to bridge ability gaps and expand career options.
          </p>
          <div className="table-container" style={{ marginTop: "0.5rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ability Area</th>
                  <th>Classroom Reflection</th>
                  <th>Career Impact</th>
                </tr>
              </thead>
              <tbody>
                {abilitiesCareerImpact.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.area}</strong></td>
                    <td>{row.classroomReflection}</td>
                    <td>{row.careerImpact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 5: Integrated Potential */}
          <h3 className="section-title" style={{ marginTop: "2.5rem" }}>
            <i className="bi bi-puzzle me-2"></i>
            Section 5: Integrated Potential (Personality + Intelligence + Ability)
          </h3>

          <div className="insight-cards-grid">
            <div className="insight-card">
              <div className="insight-icon" style={{ backgroundColor: "#e0e7ff", color: "#667eea" }}>
                <i className="bi bi-person-gear"></i>
              </div>
              <div>
                <strong>Thinker + Intrapersonal + Problem Solving</strong>
                <p>Students with Thinker personality prefer reflective learning (Intrapersonal), show strong problem-solving ability, but weak motor skills — hands-on STEM projects suit them, but vocational/manual careers may not.</p>
              </div>
            </div>
            <div className="insight-card">
              <div className="insight-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                <i className="bi bi-tools"></i>
              </div>
              <div>
                <strong>Doer + Bodily-Kinesthetic + Computation</strong>
                <p>Action-oriented students with kinesthetic intelligence and strong computation excel in structured, practical tasks. They thrive in engineering and technical fields but may need creative thinking support.</p>
              </div>
            </div>
            <div className="insight-card">
              <div className="insight-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                <i className="bi bi-phone"></i>
              </div>
              <div>
                <strong>External Influence: Screen Time</strong>
                <p>High screen use correlates with weaker linguistic & social skills across grade groups. Students show reduced interpersonal engagement and declining communication abilities.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SECTIONS 6 & 7: CAREER TRENDS & CLARITY ==================== */}
      {activeView === "career" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-briefcase me-2"></i>
            Section 6: Career Trends — Aspirations vs Suitability
          </h3>

          {/* Career Trends Table */}
          <div className="table-container" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grade Group</th>
                  <th>Aspiration (STEM %)</th>
                  <th>Suitability (STEM %)</th>
                  <th>Gap Analysis</th>
                </tr>
              </thead>
              <tbody>
                {careerTrendsData.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.gradeGroup}</strong></td>
                    <td>{row.aspirationSTEM}%</td>
                    <td>{row.suitabilitySTEM}%</td>
                    <td>
                      <span className={`badge ${row.gap.includes("Low") ? "bg-success" : row.gap.includes("High") ? "bg-danger" : "bg-warning text-dark"}`}>
                        {row.gap}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Aspiration vs Suitability Chart */}
          <div className="chart-container">
            <h4 className="chart-title">Aspiration vs Suitability (STEM)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={careerTrendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="gradeGroup" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Bar dataKey="aspirationSTEM" fill="#667eea" name="Aspiration %" radius={[8, 8, 0, 0]} />
                <Bar dataKey="suitabilitySTEM" fill="#10b981" name="Suitability %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Why gaps exist:</strong> Parental push, media glamour, and narrow perception lead to inflated STEM aspirations in 9th-10th. By 11th-12th, many capable students lose aspiration despite having suitable profiles — early career exposure and counseling are critical.
          </div>

          {/* Suitable Career vs Aspirations Stacked Bar */}
          <div className="chart-container">
            <h4 className="chart-title">
              <i className="bi bi-bar-chart-steps me-2"></i>
              Suitable Career vs Aspirations (STEM / Commerce / Other)
            </h4>
            <p className="section-description">
              Compares what students aspire to against what they are actually suited for, across STEM, Commerce, and Other career fields.
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={suitableVsAspirations} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="gradeGroup" tick={{ fontSize: 10, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} formatter={(value: any) => `${value}%`} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Bar dataKey="STEM" stackId="a" fill="#667eea" name="STEM %" />
                <Bar dataKey="Commerce" stackId="a" fill="#f59e0b" name="Commerce %" />
                <Bar dataKey="Other" stackId="a" fill="#10b981" name="Other %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Career Mismatch / Pressure Impact Table */}
          <h4 className="chart-title" style={{ marginTop: "1rem" }}>
            <i className="bi bi-exclamation-diamond me-2"></i>
            Career Mismatch & Pressure Impact
          </h4>
          <p className="section-description">
            Highlights key areas where student aspirations diverge from suitability, the underlying mismatch reasons, and how the Navigator system helps restore alignment.
          </p>
          <div className="table-container" style={{ marginTop: "0.5rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aspiration Trend</th>
                  <th>Mismatch / Pressure</th>
                  <th>Navigator Fit</th>
                </tr>
              </thead>
              <tbody>
                {careerMismatchData.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.aspiration}</strong></td>
                    <td>{row.mismatch}</td>
                    <td>{row.navigatorFit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 7: Career Clarity Index */}
          <h3 className="section-title" style={{ marginTop: "2.5rem" }}>
            <i className="bi bi-bullseye me-2"></i>
            Section 7: Career Clarity Index
          </h3>

          {/* CCI Definition */}
          <div className="cci-definitions">
            <div className="cci-def-item cci-perfect">
              <i className="bi bi-star-fill me-2"></i>
              <strong>Perfect Clarity:</strong> 2+ professions match with top 3 suitable options
            </div>
            <div className="cci-def-item cci-high">
              <i className="bi bi-check-circle-fill me-2"></i>
              <strong>High Clarity:</strong> 1 profession matches with top 3 suitable options
            </div>
            <div className="cci-def-item cci-moderate">
              <i className="bi bi-dash-circle-fill me-2"></i>
              <strong>Moderate Clarity:</strong> 1+ professions match with 4th-9th suitable options
            </div>
            <div className="cci-def-item cci-none">
              <i className="bi bi-x-circle-fill me-2"></i>
              <strong>No Clarity:</strong> No match between aspiration and suitability
            </div>
          </div>

          {/* CCI Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grade Group</th>
                  <th>Total Students</th>
                  <th>High Clarity (%)</th>
                  <th>Moderate Clarity (%)</th>
                  <th>Low Clarity (%)</th>
                </tr>
              </thead>
              <tbody>
                {careerClarityData.map((row, index) => (
                  <tr key={index}>
                    <td><strong>{row.gradeGroup}</strong></td>
                    <td>{row.totalStudents}</td>
                    <td><span className="badge bg-success">{row.highClarity}%</span></td>
                    <td><span className="badge bg-warning text-dark">{row.moderateClarity}%</span></td>
                    <td><span className="badge bg-danger">{row.lowClarity}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CCI Stacked Bar */}
          <div className="chart-container">
            <h4 className="chart-title">Career Clarity Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={careerClarityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="gradeGroup" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                <Bar dataKey="highClarity" stackId="a" fill="#10b981" name="High Clarity %" radius={[0, 0, 0, 0]} />
                <Bar dataKey="moderateClarity" stackId="a" fill="#f59e0b" name="Moderate Clarity %" />
                <Bar dataKey="lowClarity" stackId="a" fill="#ef4444" name="Low Clarity %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Interpretation:</strong> Only 20-30% of students have high career clarity. The 11th-12th group shows 45% low clarity — concerning for students about to make stream/career choices. This section helps schools see what % of students are truly career-ready vs confused.
          </div>
        </div>
      )}

      {/* ==================== STUDENT PROFILES (SEGMENTATION) ==================== */}
      {activeView === "students" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-people me-2"></i>
            Student Segmentation — Who Needs Investment
          </h3>

          {/* Support Level Summary */}
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fee2e2", color: "#ef4444" }}>
                <i className="bi bi-exclamation-octagon"></i>
              </div>
              <div>
                <div className="metric-value">{totalHighSupport}</div>
                <div className="metric-label">High Support Needed</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                <i className="bi bi-exclamation-triangle"></i>
              </div>
              <div>
                <div className="metric-value">{totalMediumSupport}</div>
                <div className="metric-label">Medium Support</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                <i className="bi bi-check-circle"></i>
              </div>
              <div>
                <div className="metric-value">{totalOnTrack}</div>
                <div className="metric-label">On Track</div>
              </div>
            </div>
          </div>

          {/* Student Profiles Table */}
          <div className="table-container" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Personality Dominant</th>
                  <th>Strongest Intelligence</th>
                  <th>Weakest Ability</th>
                  <th>Career Clarity</th>
                  <th>Support Level</th>
                </tr>
              </thead>
              <tbody>
                {studentProfilesData.map((student, index) => (
                  <tr key={index} className={`support-row-${student.supportLevel}`}>
                    <td><strong>{student.name}</strong></td>
                    <td>{student.personalityDominant}</td>
                    <td>{student.strongestIntelligence}</td>
                    <td>{student.weakestAbility}</td>
                    <td>{getClarityBadge(student.careerClarity)}</td>
                    <td>{getSupportBadge(student.supportLevel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="interpretation-box">
            <i className="bi bi-info-circle me-2"></i>
            <strong>At a glance:</strong> The traffic-light system helps the principal quickly identify which students need immediate attention. Students marked with High Support have low career clarity and weak human skills — they should be prioritized for progressive counseling and skill development programs.
          </div>
        </div>
      )}

      {/* ==================== SECTION 8: RECOMMENDATIONS ==================== */}
      {activeView === "recommendations" && (
        <div className="dashboard-content">
          <h3 className="section-title">
            <i className="bi bi-check2-square me-2"></i>
            Section 8: Final Summary & Recommendations
          </h3>

          {/* Strengths & Gaps */}
          <div className="two-column-grid">
            <div className="summary-card strengths-card">
              <h4>
                <i className="bi bi-hand-thumbs-up me-2"></i>
                School Strengths
              </h4>
              <ul>
                <li>Strong computation and speed/accuracy skills across all grades</li>
                <li>Good logical reasoning and problem-solving abilities</li>
                <li>High naturalistic awareness in lower grades</li>
                <li>83-89% participation rates across Navigator stages</li>
                <li>Rising Organizer personality indicates structured thinking</li>
              </ul>
            </div>
            <div className="summary-card gaps-card">
              <h4>
                <i className="bi bi-exclamation-diamond me-2"></i>
                Key Gaps
              </h4>
              <ul>
                <li>Creativity scores declining significantly (6.0 → 4.5)</li>
                <li>Communication skills consistently weak across all grades</li>
                <li>Empathy and interpersonal skills below target</li>
                <li>Motor skills declining with grade progression</li>
                <li>45% of 11th-12th students have low career clarity</li>
              </ul>
            </div>
          </div>

          {/* Intervention Tracker */}
          <h3 className="section-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-tools me-2"></i>
            Intervention Tracker
          </h3>

          <div className="metrics-row">
            <div className="intervention-card">
              <div className="intervention-header">
                <i className="bi bi-chat-heart me-2"></i>
                Human Skill Training
              </div>
              <div className="intervention-stat">
                {interventionData.humanSkillTraining.studentsWeak} / {interventionData.humanSkillTraining.totalStudents}
              </div>
              <div className="intervention-label">Students weak in human skills</div>
              <div className="progress-bar-custom">
                <div
                  className="progress-fill"
                  style={{ width: `${(interventionData.humanSkillTraining.studentsWeak / interventionData.humanSkillTraining.totalStudents * 100)}%`, backgroundColor: "#ef4444" }}
                ></div>
              </div>
              <div className="intervention-areas">
                Focus: {interventionData.humanSkillTraining.areas.join(", ")}
              </div>
            </div>

            <div className="intervention-card">
              <div className="intervention-header">
                <i className="bi bi-arrow-repeat me-2"></i>
                Progressive Counseling
              </div>
              <div className="intervention-stat">
                {interventionData.progressiveCounseling.reassessed} / {interventionData.progressiveCounseling.totalEligible}
              </div>
              <div className="intervention-label">Students re-assessed & guided</div>
              <div className="progress-bar-custom">
                <div
                  className="progress-fill"
                  style={{ width: `${(interventionData.progressiveCounseling.reassessed / interventionData.progressiveCounseling.totalEligible * 100)}%`, backgroundColor: "#f59e0b" }}
                ></div>
              </div>
              <div className="intervention-areas">
                Touchpoints: {interventionData.progressiveCounseling.touchpoints} stages
              </div>
            </div>

            <div className="intervention-card">
              <div className="intervention-header">
                <i className="bi bi-laptop me-2"></i>
                LMS Module Usage
              </div>
              <div className="intervention-stat">
                {interventionData.lmsUsage.completionPercent}%
              </div>
              <div className="intervention-label">Module completion rate</div>
              <div className="progress-bar-custom">
                <div
                  className="progress-fill"
                  style={{ width: `${interventionData.lmsUsage.completionPercent}%`, backgroundColor: "#10b981" }}
                ></div>
              </div>
              <div className="intervention-areas">
                {interventionData.lmsUsage.modulesCompleted} / {interventionData.lmsUsage.modulesAssigned} modules completed
              </div>
            </div>
          </div>

          {/* Challenges-Solutions-Outcomes Table */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-arrow-left-right me-2"></i>
            Key Challenges, Solutions & Expected Outcomes
          </h4>
          <p className="section-description">
            A comprehensive mapping of the school's major student development challenges to Career-9's targeted solutions and the expected outcomes for each.
          </p>
          <div className="table-container" style={{ marginTop: "0.5rem" }}>
            <table className="data-table challenges-table">
              <thead>
                <tr>
                  <th>Challenge</th>
                  <th>Career-9 Solution</th>
                  <th>Expected Outcome</th>
                </tr>
              </thead>
              <tbody>
                {challengesSolutionsData.map((row, index) => (
                  <tr key={index}>
                    <td className="challenge-cell">{row.challenge}</td>
                    <td className="solution-cell">{row.solution}</td>
                    <td className="outcome-cell">{row.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommended Actions */}
          <h4 className="chart-title" style={{ marginTop: "2rem" }}>
            <i className="bi bi-rocket-takeoff me-2"></i>
            Recommended Career-9 Interventions
          </h4>

          <div className="recommendations-grid">
            <div className="recommendation-card">
              <div className="rec-number">1</div>
              <div>
                <strong>Progressive Counselling</strong>
                <p>Multi-stage guidance program: Insight (6th-8th) → Stream (9th-10th) → Career (11th-12th). Re-assess and guide students at each transition.</p>
              </div>
            </div>
            <div className="recommendation-card">
              <div className="rec-number">2</div>
              <div>
                <strong>LMS Skill Modules</strong>
                <p>Deploy targeted modules: AI-literacy projects, creative thinking exercises, design challenges, and innovation workshops to address declining creativity.</p>
              </div>
            </div>
            <div className="recommendation-card">
              <div className="rec-number">3</div>
              <div>
                <strong>Human Skills Development</strong>
                <p>Focus on communication, empathy, and teamwork through debate clubs, peer mentoring programs, community service projects, and collaborative assignments.</p>
              </div>
            </div>
            <div className="recommendation-card">
              <div className="rec-number">4</div>
              <div>
                <strong>Career Exposure Programs</strong>
                <p>Organize career fairs, industry visits, alumni talks, and job-shadowing to bridge the aspiration-suitability gap, especially for 9th-10th graders.</p>
              </div>
            </div>
          </div>

          <div className="final-note">
            <i className="bi bi-check-circle-fill me-2"></i>
            This structure ensures the report is <strong>data-driven</strong>, <strong>trend-based</strong>, and <strong>school-actionable</strong>. The dashboard enables the principal to see school-wide readiness, spot at-risk students quickly, know exactly where to invest, and track interventions.
          </div>
        </div>
      )}
    </div>
  );
};

export default PrincipalDashboard;
