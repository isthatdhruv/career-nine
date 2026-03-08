import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export interface Lead {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  leadType: "SCHOOL" | "PARENT" | "STUDENT";
  source: string | null;
  designation: string | null;
  schoolName: string | null;
  city: string | null;
  cbseAffiliationNo: string | null;
  totalStudents: string | null;
  classesOffered: string | null;
  extras: string | null;
  odooSyncStatus: "PENDING" | "SYNCED" | "FAILED";
  odooLeadId: number | null;
  odooSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getAllLeads() {
  return axios.get<Lead[]>(`${API_URL}/leads/getAll`);
}

export function sendLeadsEmail(formData: FormData) {
  return axios.post(`${API_URL}/leads/email-export`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
