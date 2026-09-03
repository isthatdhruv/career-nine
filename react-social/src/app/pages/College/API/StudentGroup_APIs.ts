import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";
const BASE = `${API_URL}/student-groups`;

/**
 * Named groups of hand-picked students inside one institute, administered by
 * one or more contact persons.
 *
 * <p>Both attachments are many-to-many — a group holds many students and a
 * student belongs to many groups; a group has many contact persons and a
 * contact person administers many groups. That is why the member and
 * contact-person calls are deliberately identical in shape: bulk id lists,
 * idempotent on the server, differing only in which id they carry.
 *
 * Groups are independent of session / class / section by design.
 */

export interface StudentGroupSummary {
  id: number;
  instituteCode: number;
  instituteName: string | null;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string | null;
  /** Present on list responses; absent on single-group writes. */
  memberCount?: number;
  contactCount?: number;
}

export interface GroupStudentRow {
  userStudentId: number;
  instituteCode: number | null;
  name?: string;
  schoolRollNumber?: string;
  email?: string;
  phoneNumber?: string;
  studentClass?: string | null;
  gender?: string;
  username?: string;
  sectionName?: string;
  className?: string;
}

export interface GroupContactRow {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string;
  designation?: string;
  userId?: number | null;
}

export interface StudentGroupDetail extends StudentGroupSummary {
  students: GroupStudentRow[];
  contactPersons: GroupContactRow[];
}

/** Server counts what it actually changed, so the UI can report honestly. */
export interface BulkResult {
  added: number;
  alreadyPresent: number;
  removed: number;
  notPresent: number;
  total: number;
}

export function listGroups(instituteCode: number, includeInactive = false) {
  return axios.get<StudentGroupSummary[]>(BASE, {
    params: { instituteCode, includeInactive },
  });
}

export function getGroup(groupId: number) {
  return axios.get<StudentGroupDetail>(`${BASE}/${groupId}`);
}

export function createGroup(instituteCode: number, name: string, description?: string) {
  return axios.post<StudentGroupSummary>(BASE, { instituteCode, name, description });
}

export function updateGroup(
  groupId: number,
  patch: { name?: string; description?: string; active?: boolean }
) {
  return axios.put<StudentGroupSummary>(`${BASE}/${groupId}`, patch);
}

/** Soft delete — the group stays so scope grants referencing it do not dangle. */
export function deactivateGroup(groupId: number) {
  return axios.delete(`${BASE}/${groupId}`);
}

export function addMembers(groupId: number, userStudentIds: number[]) {
  return axios.post<BulkResult>(`${BASE}/${groupId}/members`, { userStudentIds });
}

// axios sends a DELETE body only under `data`, not as the second argument.
export function removeMembers(groupId: number, userStudentIds: number[]) {
  return axios.delete<BulkResult>(`${BASE}/${groupId}/members`, {
    data: { userStudentIds },
  });
}

export function addContactPersons(groupId: number, contactPersonIds: number[]) {
  return axios.post<BulkResult>(`${BASE}/${groupId}/contact-persons`, { contactPersonIds });
}

export function removeContactPersons(groupId: number, contactPersonIds: number[]) {
  return axios.delete<BulkResult>(`${BASE}/${groupId}/contact-persons`, {
    data: { contactPersonIds },
  });
}

export function groupsOfStudent(userStudentId: number) {
  return axios.get<StudentGroupSummary[]>(`${BASE}/by-student/${userStudentId}`);
}

export function groupsOfContactPerson(contactPersonId: number) {
  return axios.get<StudentGroupSummary[]>(`${BASE}/by-contact-person/${contactPersonId}`);
}

/** The endpoint answers with `{error}` JSON on 4xx; surface that, not "Request failed". */
export function groupErrorMessage(e: any, fallback: string): string {
  return e?.response?.data?.error || e?.message || fallback;
}
