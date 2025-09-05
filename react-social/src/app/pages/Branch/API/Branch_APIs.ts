import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const ReadBranch = `${API_URL}/instituteBranch/get`;
const readBranchById = `${API_URL}/instituteBranch/getbyCourseId/`;
const updateBranch = `${API_URL}/instituteBranch/update`;
const deleteBranch = `${API_URL}/instituteBranch/delete/`;

export function readBranchData() {
  return axios.get(ReadBranch);
}

export function ReadBranchByCourseIdData(id: any) {
  return axios.get(readBranchById + id);
}

export function UpdateBranchData(values: any) {
  return axios.post(updateBranch, {
    values,
  });
}

export function DeleteBranchData(id: any) {
  return axios.get(deleteBranch + id);
}
