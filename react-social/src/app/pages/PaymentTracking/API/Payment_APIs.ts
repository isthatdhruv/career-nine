import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function generatePaymentLink(mappingId: number, amount: number) {
  return axios.post(`${API_URL}/payment/generate-link`, {
    mappingId,
    amount,
  });
}

export function getPaymentTransactions(params?: {
  status?: string;
  instituteCode?: number;
}) {
  return axios.get(`${API_URL}/payment/transactions`, { params });
}

export function getPaymentTransactionsByMapping(mappingId: number) {
  return axios.get(`${API_URL}/payment/transactions/by-mapping/${mappingId}`);
}

export function sendNudgeEmail(transactionId: number) {
  return axios.post(`${API_URL}/payment/${transactionId}/send-nudge`);
}

export function resendWelcomeEmail(transactionId: number) {
  return axios.post(`${API_URL}/payment/${transactionId}/resend-welcome`);
}

// Send payment link via email
export function sendPaymentLinkEmail(
  transactionId: number,
  email: string,
  studentName?: string
) {
  return axios.post(`${API_URL}/payment/${transactionId}/send-email`, {
    email,
    studentName: studentName || "Student",
  });
}

// Generate WhatsApp send URL for payment link
export function sendPaymentLinkWhatsApp(
  transactionId: number,
  phone: string,
  studentName?: string
) {
  return axios.post(`${API_URL}/payment/${transactionId}/send-whatsapp`, {
    phone,
    studentName: studentName || "Student",
  });
}

// Get notification logs for a transaction
export function getNotificationLogs(transactionId: number) {
  return axios.get(`${API_URL}/payment/${transactionId}/notifications`);
}
