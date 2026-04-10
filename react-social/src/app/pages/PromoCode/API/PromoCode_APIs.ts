import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function createPromoCode(data: {
  code: string;
  discountPercent: number;
  description?: string;
  maxUses?: number;
  expiresAt?: number;
}) {
  return axios.post(`${API_URL}/promo-codes/create`, data);
}

export function getAllPromoCodes() {
  return axios.get(`${API_URL}/promo-codes/getAll`);
}

export function updatePromoCode(id: number, data: any) {
  return axios.put(`${API_URL}/promo-codes/update/${id}`, data);
}

export function deletePromoCode(id: number) {
  return axios.delete(`${API_URL}/promo-codes/delete/${id}`);
}

export function validatePromoCode(code: string) {
  return axios.post(`${API_URL}/promo-codes/public/validate`, { code });
}
