import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const STUDENT_INFO_BASE = `${API_URL}/student-info`;

export interface StudentInfo {
    id?: number;
    name: string;
    schoolRollNumber: string;
    phoneNumber?: number;
    email?: string;
    address?: string;
    institue_id?: number;
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
