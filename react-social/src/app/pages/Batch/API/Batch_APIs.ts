import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const ReadBatch = `${API_URL}/instituteBatch/get`;
const readBatchById = `${API_URL}/instituteBranch/getbybranchid/`;
const updateBatch = `${API_URL}/instituteBranchBatchMapping/update`;
const deleteBatch = `${API_URL}/instituteBatch/delete/`;

export function readBatchData() {
  return axios.get(ReadBatch);
}

export function ReadBatchByBranchIdData(id: any) {
  return axios.get(readBatchById + id);
}

export function UpdateBatchData(values: any) {
  return axios.post(updateBatch, {
    values,
  });
}

export function DeleteBatchData(id: any) {
  return axios.get(deleteBatch + id);
}
