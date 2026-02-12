import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

// Institute endpoints
const readCollege = `${API_URL}/instituteDetail/get`;
const readCollegeById = `${API_URL}/instituteDetail/getbyid/`;
const updateCollege = `${API_URL}/instituteDetail/update`;
const deleteCollege = `${API_URL}/instituteDetail/delete/`;

// Session endpoints
const createSession = `${API_URL}/schoolSession/create`;
const getSessionsByInstitute = `${API_URL}/schoolSession/getByInstituteCode/`;
const updateSession = `${API_URL}/schoolSession/update/`;
const deleteSession = `${API_URL}/schoolSession/delete/`;

// Class endpoints
const createClass = `${API_URL}/schoolSession/class/create`;
const updateClass = `${API_URL}/schoolSession/class/update/`;
const deleteClass = `${API_URL}/schoolSession/class/delete/`;

// Section endpoints
const createSection = `${API_URL}/schoolSession/section/create`;
const updateSection = `${API_URL}/schoolSession/section/update/`;
const deleteSectionEndpoint = `${API_URL}/schoolSession/section/delete/`;

// ============ INSTITUTE FUNCTIONS ============

export function ReadCollegeData() {
  return axios.get(readCollege);
}

export function ReadCollegeByIdData(id: any) {
  return axios.get(readCollegeById + id);
}

export function UpdateCollegeData(values: any) {
  return axios.post(updateCollege, {
    values,
  });
}

export function DeleteCollegeData(id: any) {
  return axios.get(deleteCollege + id);
}

export function MapContactsAndBoards(instituteCode: number | string, contactPersonIds: number[], boardIds: number[]) {
  return axios.post(`${API_URL}/instituteDetail/map-contacts-boards`, {
    instituteCode: Number(instituteCode),
    contactPersonIds,
    boardIds,
  });
}

export function GetInstituteMappings(instituteCode: number | string) {
  return axios.get(`${API_URL}/instituteDetail/get-mappings/${instituteCode}`);
}

// ============ SESSION FUNCTIONS ============

export function CreateSessionData(values: any) {
  console.log("API Call - CreateSessionData with values:", values);
  return axios.post(createSession, values);
}

export function GetSessionsByInstituteCode(instituteCode: number | string) {
  return axios.get(getSessionsByInstitute + instituteCode);
}

export function UpdateSessionData(id: number, values: any) {
  return axios.put(updateSession + id, values);
}

export function DeleteSessionData(id: number) {
  return axios.delete(deleteSession + id);
}

// ============ CLASS FUNCTIONS ============

export function CreateClassData(values: any) {
  return axios.post(createClass, values);
}

export function UpdateClassData(id: number, values: any) {
  return axios.put(updateClass + id, values);
}

export function DeleteClassData(id: number) {
  return axios.delete(deleteClass + id);
}

// ============ SECTION FUNCTIONS ============

export function CreateSectionData(values: any) {
  return axios.post(createSection, values);
}

export function UpdateSectionData(id: number, values: any) {
  return axios.put(updateSection + id, values);
}

export function DeleteSectionData(id: number) {
  return axios.delete(deleteSectionEndpoint + id);
}
