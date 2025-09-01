import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readTool = `${API_URL}/api/tools/getAll`;
const readToolById = `${API_URL}/api/tools/get/`;
const createTool = `${API_URL}/api/tools/create`;
const updateTool = `${API_URL}/api/tools/update`;
const deleteTool = `${API_URL}/api/tools/delete/`;

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
