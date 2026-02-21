import http from '../api/http';

export function getMappingInfoByToken(token: string) {
  return http.get(`/assessment-mapping/public/info/${token}`);
}

export function registerStudentByToken(
  token: string,
  studentData: {
    name: string;
    email: string;
    dob: string;
    phone: string;
    gender: string;
    classId?: number;
    schoolSectionId?: number;
  }
) {
  return http.post(`/assessment-mapping/public/register/${token}`, studentData);
}
