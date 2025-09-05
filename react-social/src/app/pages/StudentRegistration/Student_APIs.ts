import axios from "axios";
import _ from "underscore";
const API_URL = process.env.REACT_APP_API_URL;
const file_get_url = "http://192.168.146.239:8080/util/";
const ReadStudent = `${API_URL}/student/get`;
const EmailChecker = `${API_URL}/student/emailChecker`;
const ReadStudentById = `${API_URL}/student/getbyid/`;
const ReadGender = `${API_URL}/gender/get`;
const ReadCategory = `${API_URL}/category/get`;
const ReadBranch = `${API_URL}/instituteBranch/get`;
const ReadBoard = `${API_URL}/board/get`;
const ReadCourse = `${API_URL}/instituteCourse/get`;
const ReadBatch = `${API_URL}/instituteBatch/get`;
const ReadBatchById = `${API_URL}/instituteBatch/getbyid/`;
const ReadBranchById = `${API_URL}/instituteBranch/getbybranchid/`;
const ReadBranchByCourseId = `instituteBranch/getbyCourseId/`;
const upsertStudent = `${API_URL}/student/update`;
const upsertStudentFinal = `${API_URL}/studnet-confirmation/update`;
const FileUpload = `${API_URL}/util/file-upload`;
const FileFetch = `${file_get_url}/file-get/getbyname`;
const FileDelete = `${API_URL}/util/file-delete/deletebyname/`;
const ShowDataByEmail = `${API_URL}/temporary-student/getbyEmail`;
const CollegeCourseData = `${API_URL}/instituteDetail/getbyid/492`;
const GetGroupName = `${API_URL}/google-api/groupemail/get`;
const sendStudnetIdEmailURL = `${API_URL}/generate_pdf`;
const sendStudnetIdEmailURLExisting = `${API_URL}/generate_pdf`;
const getgoogleEmailStatus = `${API_URL}/google-api/email/get`;
const VerifyEmail = `${API_URL}/email-validation-official`;
const VerifyOTP = `${API_URL}/email-validation-official-confermation`;
const updateEmailStatus = `${API_URL}/student/get-check`;

export interface crudApiModal {
  data?: any;
}

export function readStudentData() {
  return axios.get(ReadStudent);
}

export function ShowStudentByEmailData() {
  return axios.get(ShowDataByEmail);
}

export function upsertStudentData(values: any) {
  return axios.post<crudApiModal>(upsertStudent, {
    values,
  });
}

export function upsertStudentDataFinal(values: any) {
  return axios.post<crudApiModal>(upsertStudentFinal, {
    values,
  });
}

export function ReadGenderData() {
  return axios.get(ReadGender);
}
export function ReadCategoryData() {
  return axios.get(ReadCategory);
}

export function ReadBranchData() {
  return axios.get(ReadBranch);
}

export function ReadBranchDataByCouseId(id: any) {
  return axios.get(ReadBranchByCourseId + id);
}

export function ReadBoardData() {
  return axios.get(ReadBoard);
}

export function ReadBatchData() {
  return axios.get(ReadBatch);
}

export function ReadStudentByIdData(id: any) {
  return axios.get(ReadStudentById + id);
}

export function ReadBatchByIdData(id: any) {
  return axios.get(ReadBatchById + id);
}

export function ReadBranchByIdData(id: any) {
  return axios.get(ReadBranchById + id);
}

export function fileUpload(values: any) {
  return axios.post<crudApiModal>(FileUpload, {
    values,
  });
}

export async function fileFetch(id: any) {
  return axios.get(FileFetch + id);
}

export function fileDelete(id: any) {
  return axios.get(FileDelete + id);
}

export function ReadCourseData() {
  return axios.get(ReadCourse);
}

export function ReadCollegeCourseData() {
  return axios.get(CollegeCourseData);
}

export function emailChecker(values: any) {
  return axios.post(EmailChecker, {
    values,
  });
}

export function GetGroupNameData() {
  return axios.get(GetGroupName);
}

export function sendStudnetIdEmail(id) {
  return axios.get(sendStudnetIdEmailURL + "?id=" + id);
}

export function VerifyEmailOTP(email) {
  return axios.get(VerifyEmail + "?email=" + email);
}
// export function VerifyOTP2(email, otp) {
//   return axios.get(VerifyOTP + "?email=" + email + "&otp=" + otp);
// }

export function VerifyOTP2(email, otp) {
  return axios.get(VerifyOTP, {
    params: {
      email: email,
      otp: otp,
    },
  });
}

export function getAllBatchDataFromStudnet(batchArray) {
  return axios.all(
    _.map(batchArray, (item) => axios.get(ReadBatchById + item))
  );
}

export function getAllBranchDataFromStudnet(BranchArray) {
  return axios.all(
    _.map(BranchArray, (item) => axios.get(ReadBranchById + item))
  );
}
export function sendStudnetIdEmailExisting(id) {
  return axios.get(sendStudnetIdEmailURLExisting + "?id=" + id);
}

export function getGoogleEmailStatus(email) {
  return axios.get(getgoogleEmailStatus + "/" + email);
}

export function updateGoogleMailCheck() {
  return axios.get(updateEmailStatus);
}

// export function getAllCourseDataFromStudnet(CourseArray) {
//   return axios.all(
//     _.map(CourseArray, (item) => axios.get(ReadCourseById + item))
//   );
// }

// export function upsertRole_RoleGroupData(values: any) {
//   return axios.post<crudApiModal>(upsertRole_RoleGroup+""+values.id, {
//     values
//   })
// }

// export function deleteRole_RoleGroupData(id: any) {
//   return axios.get<crudApiModal>(deleteRole_RoleGroup + id)
// }
