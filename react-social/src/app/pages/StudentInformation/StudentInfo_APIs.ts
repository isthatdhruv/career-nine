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
    studentDob?: string;
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

export interface AssessmentDetail {
    assessmentId: number;
    assessmentName: string;
    status: string; // 'notstarted' | 'inprogress' | 'completed'
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
    studentDob?: string;
    username?: string;
    assessments?: AssessmentDetail[];
    assignedAssessmentIds?: number[];
}

export interface StudentAnswerDetail {
    questionId: number;
    questionText: string;
    optionId: number;
    optionText: string;
    sectionName?: string | null;
    excelQuestionHeader?: string | null;
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

export function getAssessmentIdNameMap() {
    return axios.get<Record<string, string>>(`${ASSESSMENTS_BASE}/get/list-ids`);
}

export function bulkAlotAssessment(assignments: BulkAssessmentAssignment[]) {
    return axios.post(`${STUDENT_INFO_BASE}/bulkAlotAssessment`, assignments);
}

export function bulkRemoveAssessment(removals: BulkAssessmentAssignment[]) {
    return axios.post(`${STUDENT_INFO_BASE}/bulkRemoveAssessment`, removals);
}

// New API to get student answers with question and option details
export function getStudentAnswersWithDetails(userStudentId: number, assessmentId: number) {
    console.log("API Call - Endpoint:", `${STUDENT_INFO_BASE}/getStudentAnswersWithDetails`);
    console.log("API Call - Params:", { userStudentId, assessmentId });

    return axios.get<StudentAnswerDetail[]>(`${STUDENT_INFO_BASE}/getStudentAnswersWithDetails`, {
        params: {
            userStudentId,
            assessmentId
        }
    }).then(response => {
        console.log("API Success:", response);
        return response;
    }).catch(error => {
        console.error("API Error:", error.response?.data || error.message);
        throw error;
    });
}

// Reset assessment - sets status to 'notstarted' and deletes raw scores
export function resetAssessment(userStudentId: number, assessmentId: number) {
    return axios.post(`${STUDENT_INFO_BASE}/resetAssessment`, {
        userStudentId,
        assessmentId
    });
}
