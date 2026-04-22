import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

const safeList = (data: any): any[] =>
  Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

export async function fetchStudents(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/student-info/getAll`);
  return safeList(data);
}

export async function fetchInstitutes(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/instituteDetail/get`);
  return safeList(data);
}

export async function fetchCounsellors(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/api/counsellor/getAll`);
  return safeList(data);
}

export async function fetchAssessments(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/assessments/getAll`);
  return safeList(data);
}

export async function fetchLogins(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/activity-log/logins`, {
    params: { startDate, endDate },
  });
  return safeList(data);
}

export async function fetchGeneratedReports(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/generated-reports/getAll`);
  return safeList(data);
}

export async function fetchStudentsWithMapping(instituteId: number | string): Promise<any[]> {
  const { data } = await axios.get(
    `${API_URL}/student-info/getStudentsWithMappingByInstituteId/${instituteId}`
  );
  return safeList(data);
}

export async function fetchCounsellingAppointments(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/api/counselling-appointment/getAll`);
  return safeList(data);
}

export async function fetchCounsellorRatingSummary(): Promise<any[]> {
  const { data } = await axios.get(`${API_URL}/api/counselling-rating/summary-by-counsellor`);
  return safeList(data);
}
