import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function mapUserToCollege(userId: number, instituteCode: number) {
  return axios.post(`${API_URL}/contact-person/map-to-college`, {
    userId,
    instituteCode,
  });
}

export function getUserCollegeMappings(userId: number) {
  return axios.get(`${API_URL}/contact-person/by-user/${userId}`);
}

export function unmapUserFromCollege(contactPersonId: number) {
  return axios.delete(`${API_URL}/contact-person/unmap/${contactPersonId}`);
}

export function createAccessLevel(data: {
  contactPersonId: number;
  sessionId?: number;
  classId?: number;
  sectionId?: number;
}) {
  return axios.post(`${API_URL}/contact-person/access-level/create`, data);
}

export function getAccessLevelsByContact(contactPersonId: number) {
  return axios.get(
    `${API_URL}/contact-person/access-level/by-contact/${contactPersonId}`
  );
}

export function deleteAccessLevel(id: number) {
  return axios.delete(`${API_URL}/contact-person/access-level/delete/${id}`);
}
