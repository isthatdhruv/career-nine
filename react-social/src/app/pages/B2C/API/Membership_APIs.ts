import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

export interface StudentMembership {
  instituteCode: number;
  instituteName?: string | null;
  campaignId?: number | null;
  source: string;
  addedAt?: string;
  isDropped: boolean;
  droppedAt?: string | null;
  droppedReason?: string | null;
  isPrimary: boolean;
}

export interface InstituteStudentRow {
  userStudentId: number;
  name?: string;
  email?: string;
  phone?: string;
  source: string;
  addedAt?: string;
  isDropped: boolean;
  droppedAt?: string | null;
  isPrimary: boolean;
}

export const getStudentMemberships = (userStudentId: number) =>
  axios.get<StudentMembership[]>(`${API_URL}/user-student/${userStudentId}/institutes`);

export const addStudentMembership = (userStudentId: number, instituteCode: number) =>
  axios.post(`${API_URL}/user-student/${userStudentId}/institute`, { instituteCode });

export const dropStudentMembership = (userStudentId: number, instituteCode: number, reason?: string) =>
  axios.post(`${API_URL}/user-student/${userStudentId}/institute/${instituteCode}/drop`, { reason });

export const undropStudentMembership = (userStudentId: number, instituteCode: number) =>
  axios.post(`${API_URL}/user-student/${userStudentId}/institute/${instituteCode}/undrop`);

export const setStudentPrimaryInstitute = (userStudentId: number, instituteCode: number) =>
  axios.post(`${API_URL}/user-student/${userStudentId}/institute/${instituteCode}/set-primary`);

export const getInstituteStudents = (instituteCode: number, includeDropped = false) =>
  axios.get<InstituteStudentRow[]>(
    `${API_URL}/institute-detail/${instituteCode}/students?includeDropped=${includeDropped}`
  );
