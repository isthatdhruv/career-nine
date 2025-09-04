import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const readBoard = `${API_URL}/board/get`;
const updateBoard = `${API_URL}/board/update`;
const deleteBoard = `${API_URL}/board/delete/`;

export function ReadBoardData() {
  return axios.get(readBoard);
}

export function UpdateBoardData(values: any) {
  return axios.post(updateBoard, {
    values,
  });
}

export function DeleteBoardData(id: any) {
  return axios.get(deleteBoard + id);
}
