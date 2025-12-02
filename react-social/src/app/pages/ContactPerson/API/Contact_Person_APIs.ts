import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readContactInformation = `${API_URL}/contact-person/getAll`;
const readContactInformationById = `${API_URL}/contact-person/get/`;
const createContactInformation = `${API_URL}/contact-person/create`;
const updateContactInformation = `${API_URL}/contact-person/update`;
const deleteContactInformation = `${API_URL}/contact-person/delete/`;

export function ReadContactInformationData() {
  return axios.get(readContactInformation);
}

export function ReadContactInformationByIdData(id: any) {
  return axios.get(readContactInformationById + id);
}

export function CreateContactInformationData(values: any) {
  return axios.post(createContactInformation, values);
}

export function UpdateContactInformationData(id: any, values: any) {
  return axios.put(`${updateContactInformation}/${id}`, values);
}

export function DeleteContactInformationData(id: any) {
  return axios.delete(deleteContactInformation + id);
}
