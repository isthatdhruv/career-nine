import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readList = `${API_URL}/list/getAll`;
const readListById = `${API_URL}/list/get/`;
const createList = `${API_URL}/list/create`;
const updateList = `${API_URL}/list/update`;
const deleteList = `${API_URL}/list/delete/`;

export function ReadListData() {
  return axios.get(readList);
} 

export function ReadListByIdData(id: any) {
  return axios.get(readListById + id);
}

export function CreateListData(values: any) {
  return axios.post(createList , values);
}

export function UpdateListData(id: any, values: any) {
  return axios.put(`${updateList}/${id}`, values);
}

export function DeleteListData(id: any) {
  return axios.delete(deleteList + id);
}
