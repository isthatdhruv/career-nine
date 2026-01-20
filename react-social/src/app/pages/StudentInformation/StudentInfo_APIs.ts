import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const STUDENT_INFO_BASE = `${API_URL}/student-info`;
const ASSESSMENTS_BASE = `${API_URL}/assessments`;

export interface StudentInfo {
    id?: number;
    name: string;
    schoolRollNumber: string;
    phoneNumber?: number;
    email?: string;
    address?: string;
    institute_id?: number;
    instituteId?: number;
    assesment_id?: string;
}

export interface Assessment {
    id: number;
    assessmentName: string;
    isActive?: boolean;
    starDate?: string;
    endDate?: string;
}

export interface BulkAssessmentAssignment {
    userStudentId: number;
    assessmentId: number;
}

export interface StudentWithMapping {
    id: number;
    name: string;
    schoolRollNumber: string;
    phoneNumber?: string;
    email?: string;
    instituteId?: number;
    userStudentId: number;
    assessmentId?: number;
}

export function getStudentInfoByInstituteId(instituteId: number) {
    return axios.get<StudentInfo[]>(`${STUDENT_INFO_BASE}/getByInstituteId/${instituteId}`);
}

export function getStudentsWithMappingByInstituteId(instituteId: number) {
    return axios.get<StudentWithMapping[]>(`${STUDENT_INFO_BASE}/getStudentsWithMappingByInstituteId/${instituteId}`);
}

export function getAllStudentInfo() {
    return axios.get<StudentInfo[]>(`${STUDENT_INFO_BASE}/getAll`);
}

export function addStudentInfo(student: StudentInfo) {
    return axios.post<StudentInfo>(`${STUDENT_INFO_BASE}/add`, student);
}

export function updateStudentInfo(student: StudentInfo) {
    return axios.post<StudentInfo>(`${STUDENT_INFO_BASE}/update`, student);
}

export function deleteStudentInfo(id: number) {
    return axios.post<void>(`${STUDENT_INFO_BASE}/delete/${id}`);
}

// Assessment APIs
export function getAllAssessments() {
    return axios.get<Assessment[]>(`${ASSESSMENTS_BASE}/getAll`);
}

export function bulkAlotAssessment(assignments: BulkAssessmentAssignment[]) {
    return axios.post(`${STUDENT_INFO_BASE}/bulkAlotAssessment`, assignments);
}
