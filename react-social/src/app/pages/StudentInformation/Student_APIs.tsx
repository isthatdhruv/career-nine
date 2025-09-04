

import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL  
const file_get_url = "http://192.168.146.239:8080/util/"
const ReadStudent = `${API_URL}/student/get`;
const ReadStudentById = `${API_URL}/student/getbyid/`;
const ReadGender = `${API_URL}/gender/get`;
const ReadCategory = `${API_URL}/category/get`;
const ReadBranch = `${API_URL}/branch/get`;
const ReadBoard = `${API_URL}/board/get`;
const ReadBatch = `${API_URL}/batch/get`;
const upsertStudent = `${API_URL}/student/update`;
const upsertStudentFinal = `${API_URL}/studnet-confirmation/update`;
const FileUpload = `${API_URL}/util/file-upload`;
const FileFetch = `${file_get_url}/file-get/getbyname`;
const FileDelete = `${API_URL}/util/file-get/getbyname/`;
const ShowDataByEmail = `${API_URL}/temporary-student/getbyEmail`;

// export const readRole_RoleGroup = `${API_URL}/rolegroup/get`
// export const upsertRole_RoleGroup = `${API_URL}/rolerolegroupmapping/update/`
// export const deleteRole_RoleGroup = `${API_URL}/rolegroup/delete/`

export interface crudApiModal {
  data?: any;
}

export function readStudentData() {
  return axios.get(ReadStudent);
}

export function ShowStudentByEmailData() {
  return axios.get(ShowDataByEmail);
  // console.log("bhavya",id)
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

export function ReadBoardData() {
  return axios.get(ReadBoard);
}

export function ReadBatchData() {
  return axios.get(ReadBatch);
}

export function ReadStudentByIdData(id: any) {
  return axios.get(ReadStudentById + id);
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
  return null;
  //return axios.get(FileDelete+id)
}

// export function readRole_RoleGroupData() {
//   return axios.get(readRole_RoleGroup)
// }

// export function upsertRole_RoleGroupData(values: any) {
//   return axios.post<crudApiModal>(upsertRole_RoleGroup+""+values.id, {
//     values
//   })
// }

// export function deleteRole_RoleGroupData(id: any) {
//   return axios.get<crudApiModal>(deleteRole_RoleGroup + id)
// }
