import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL
const file_get_url = "http://192.168.146.239:8080/util/"
const ReadFaculty = `${API_URL}/faculty/get`;
const ReadFacultyById = `${API_URL}/faculty/getbyid/`;
const ReadGender = `${API_URL}/gender/get`;
const ReadCategory = `${API_URL}/category/get`;
const upsertFaculty = `${API_URL}/faculty/update`;
const FileUpload = `${API_URL}/util/file-upload`;
const FileFetch = `${file_get_url}/file-get/getbyname`;
const FileDelete = `${API_URL}/util/file-delete/deletebyname/`;
const EmailChecker = `${API_URL}/faculty/emailChecker`;
const sendFacultyIdEmailURL = `${API_URL}/generate_pdf_faculty`;

export interface crudApiModal {
  data?: any;
}

export function readFacultyData() {
  return axios.get(ReadFaculty);
}

export function upsertFacultyData(values: any) {
  return axios.post<crudApiModal>(upsertFaculty, {
    values,
  });
}


export function ReadGenderData() {
  return axios.get(ReadGender);
}
export function ReadCategoryData() {
  return axios.get(ReadCategory);
}

export function ReadFacultyByIdData(id: any) {
  return axios.get(ReadFacultyById + id);
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
export function emailChecker(values: any) {
  return axios.post(EmailChecker, {
    values,
  });
}

export function sendFacultyIdEmail(id, email) {
  return axios.get(sendFacultyIdEmailURL + "?id=" + id + "&email=" + email);
}
