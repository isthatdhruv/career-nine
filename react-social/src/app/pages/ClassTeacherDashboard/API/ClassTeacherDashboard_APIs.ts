import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export interface ClassOverview {
  teacherName: string;
  className: string;
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  averageAttendance: number;
  recentActivity: {
    lastAssessmentDate: string;
    assessmentsThisMonth: number;
    pendingGrading: number;
    newAlerts: number;
  };
}

export interface StudentPerformance {
  classStats: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    medianScore: number;
  };
  distribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  topPerformers: Array<{
    name: string;
    score: number;
    notes: string;
  }>;
  needsAttention: Array<{
    name: string;
    score: number;
    notes: string;
  }>;
}

export interface AssessmentCompletion {
  overallCompletionRate: number;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  assessments: Array<{
    name: string;
    totalStudents: number;
    completed: number;
    completionRate: number;
    dueDate: string;
  }>;
  trend: Array<{
    label: string;
    completionRate: number;
  }>;
}

export interface CognitiveTrends {
  averageScores: {
    attention: number;
    workingMemory: number;
    cognitiveFlexibility: number;
    problemSolving: number;
  };
  socialScores: {
    socialInsight: number;
    emotionalRegulation: number;
    selfEfficacy: number;
  };
  strengths: Array<{
    skill: string;
    score: number;
    level: string;
  }>;
  areasForImprovement: Array<{
    skill: string;
    score: number;
    level: string;
  }>;
  progressTrend: Array<{
    month: string;
    cognitive: number;
    social: number;
    overall: number;
  }>;
}

export interface ClassTeacherDashboardData {
  overview: ClassOverview;
  studentPerformance: StudentPerformance;
  assessmentCompletion: AssessmentCompletion;
  cognitiveTrends: CognitiveTrends;
}

/**
 * Fetch complete class teacher dashboard data
 * @param teacherId - Teacher ID
 * @param assessmentId - Optional assessment ID to filter by specific assessment
 */
export async function getClassTeacherDashboardData(
  teacherId: number,
  assessmentId?: number | null
): Promise<ClassTeacherDashboardData> {
  try {
    const params = assessmentId ? { assessmentId } : {};
    const response = await axios.get(
      `${API_BASE_URL}/teacher/dashboard/complete/${teacherId}`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching class teacher dashboard data:", error);
    throw error;
  }
}

/**
 * Fetch class overview
 */
export async function getClassOverview(
  teacherId: number
): Promise<ClassOverview> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/teacher/dashboard/class-overview/${teacherId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching class overview:", error);
    throw error;
  }
}

/**
 * Fetch student performance data
 */
export async function getStudentPerformance(
  teacherId: number,
  assessmentId?: number | null
): Promise<StudentPerformance> {
  try {
    const params = assessmentId ? { assessmentId } : {};
    const response = await axios.get(
      `${API_BASE_URL}/teacher/dashboard/student-performance/${teacherId}`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching student performance:", error);
    throw error;
  }
}

/**
 * Fetch assessment completion data
 */
export async function getAssessmentCompletion(
  teacherId: number
): Promise<AssessmentCompletion> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/teacher/dashboard/assessment-completion/${teacherId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching assessment completion:", error);
    throw error;
  }
}

/**
 * Fetch cognitive trends data
 */
export async function getCognitiveTrends(
  teacherId: number
): Promise<CognitiveTrends> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/teacher/dashboard/cognitive-trends/${teacherId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching cognitive trends:", error);
    throw error;
  }
}

/**
 * Fetch all assessments for dropdown
 */
export async function getAllAssessments(): Promise<any[]> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/teacher/dashboard/assessments`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return [];
  }
}
