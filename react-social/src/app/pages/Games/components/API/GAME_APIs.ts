import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const ListGames = `${API_URL}/game-table/getAll`;
const AddGames = `${API_URL}/game-table/add`;
const DeleteGames = `${API_URL}/game-table/delete`;
const UpdateGames = `${API_URL}/game-table/update`;

export function ListGamesData() {
  return axios.get(ListGames);
}

export function AddGamesData(values: any) {
  return axios.post(AddGames, values);
}

export function DeleteGameTableData(id: number) {
  return axios.delete(`${DeleteGames}/${id}`);
}
export function UpdateGameTableData(id: number, values: any) {
  return axios.post(`${UpdateGames}/${id}`, values);
}
