import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readTool = `${API_URL}/tools/getAll`;
const readToolById = `${API_URL}/tools/get/`;
const createTool = `${API_URL}/tools/create`;
const updateTool = `${API_URL}/tools/update`;
const deleteTool = `${API_URL}/tools/delete/`;

export function ReadToolData() {
  return axios.get(readTool);
} 

export function ReadToolByIdData(id: any) {
  return axios.get(readToolById + id);
}

export function CreateToolData(values: any) {
  return axios.post(createTool, values);
}

export function UpdateToolData(id: any, values: any) {
  return axios.put(`${updateTool}/${id}`, values);
}

export function DeleteToolData(id: any) {
  return axios.delete(deleteTool + id);
}
