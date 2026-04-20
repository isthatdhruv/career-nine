import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counsellor-institute`

export interface CounsellorInstituteMapping {
  id: number
  counsellor: {
    id: number
    name: string
    email: string
    phone?: string
    specializations?: string
    isActive: boolean
  }
  institute: {
    instituteCode: number
    instituteName: string
  }
  isActive: boolean
  assignedBy?: number
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export function getAllMappings() {
  return axios.get<CounsellorInstituteMapping[]>(`${BASE}/getAll`)
}

export function getMappingsByInstitute(instituteCode: number) {
  return axios.get<CounsellorInstituteMapping[]>(`${BASE}/by-institute/${instituteCode}`)
}

export function getMappingsByCounsellor(counsellorId: number) {
  return axios.get<CounsellorInstituteMapping[]>(`${BASE}/by-counsellor/${counsellorId}`)
}

export function allocateCounsellor(counsellorId: number, instituteCode: number, assignedBy?: number, notes?: string) {
  return axios.post<CounsellorInstituteMapping>(`${BASE}/allocate`, {
    counsellorId,
    instituteCode,
    assignedBy,
    notes,
  })
}

export function deallocateCounsellor(mappingId: number) {
  return axios.delete<CounsellorInstituteMapping>(`${BASE}/deallocate/${mappingId}`)
}
