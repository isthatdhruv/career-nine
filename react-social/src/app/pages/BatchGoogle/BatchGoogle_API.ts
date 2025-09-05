import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const ReadBranch = `${API_URL}/instituteBranch/get`;
const readBranchById = `${API_URL}/google-api/group/get/`;

export function ReadBranchData() {
  return axios.get(ReadBranch);
}

export function ReadBranchByIdData(name: any) {
  return axios.get(readBranchById + name);
  // console.log(name)
}
