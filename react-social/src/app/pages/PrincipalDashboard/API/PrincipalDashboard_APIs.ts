import axios from "axios";

const API_BASE_URL = "http://localhost:8080/api/principal/dashboard";

export interface PrincipalDashboardData {
  overview: {
    totalStudents: number;
    totalTeachers: number;
    totalAssessments: number;
    activeAssessments: number;
    totalClasses: number;
    overallCompletionRate: number;
    averagePerformance: number;
    studentsNeedingAttention: number;
  };
  assessmentPerformance: {
    assessmentName?: string;
    statistics?: {
      averageScore: number;
      highestScore: number;
      lowestScore: number;
      medianScore: number;
    };
    completedCount?: number;
    inProgressCount?: number;
    notStartedCount?: number;
    totalStudents?: number;
    distribution?: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    message?: string;
    error?: string;
  };
  classwisePerformance: {
    classes: Array<{
      className: string;
      totalStudents: number;
      averageScore: number;
      attendanceRate: number;
      completionRate: number;
    }>;
    totalClasses: number;
  };
  teacherActivity: {
    teachers: Array<{
      teacherName: string;
      classes: string;
      assessmentsCreated: number;
      engagementRate: number;
      classAverage: number;
    }>;
    totalTeachers: number;
    averageEngagement: number;
  };
  enrollmentTrends: {
    currentTotal: number;
    monthlyTrends: Array<{
      month: string;
      totalStudents: number;
      newEnrollments: number;
    }>;
    growthRate: number;
    projectedNextMonth: number;
  };
}

/**
 * Fetch complete principal dashboard data
 */
export async function getPrincipalDashboardData(
  principalId: number,
  assessmentId: number | null
): Promise<PrincipalDashboardData> {
  try {
    const url = assessmentId
      ? `${API_BASE_URL}/data/${principalId}?assessmentId=${assessmentId}`
      : `${API_BASE_URL}/data/${principalId}`;

    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching principal dashboard data:", error);
    throw error;
  }
}

/**
 * Fetch institute overview
 */
export async function getInstituteOverview(principalId: number): Promise<any> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/overview/${principalId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching institute overview:", error);
    throw error;
  }
}

/**
 * Fetch assessment performance
 */
export async function getAssessmentPerformance(
  principalId: number,
  assessmentId: number | null
): Promise<any> {
  try {
    const url = assessmentId
      ? `${API_BASE_URL}/assessment-performance/${principalId}?assessmentId=${assessmentId}`
      : `${API_BASE_URL}/assessment-performance/${principalId}`;

    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching assessment performance:", error);
    throw error;
  }
}

/**
 * Fetch classwise performance
 */
export async function getClasswisePerformance(principalId: number): Promise<any> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/classwise-performance/${principalId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching classwise performance:", error);
    throw error;
  }
}

/**
 * Fetch teacher activity
 */
export async function getTeacherActivity(principalId: number): Promise<any> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/teacher-activity/${principalId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching teacher activity:", error);
    throw error;
  }
}

/**
 * Fetch enrollment trends
 */
export async function getEnrollmentTrends(principalId: number): Promise<any> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/enrollment-trends/${principalId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching enrollment trends:", error);
    throw error;
  }
}

/**
 * Fetch all assessments for dropdown
 */
export async function getAllAssessments(): Promise<any[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/assessments`);
    return response.data;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return [];
  }
}
