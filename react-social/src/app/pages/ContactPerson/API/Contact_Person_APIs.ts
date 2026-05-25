import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readContactInformation = `${API_URL}/contact-person/getAll`;
const readContactInformationById = `${API_URL}/contact-person/get/`;
const createContactInformation = `${API_URL}/contact-person/create`;
const updateContactInformation = `${API_URL}/contact-person/update`;
const deleteContactInformation = `${API_URL}/contact-person/delete/`;

export function ReadContactInformationData() {
  return axios.get(readContactInformation);
}

export function ReadContactInformationByIdData(id: any) {
  return axios.get(readContactInformationById + id);
}

export function CreateContactInformationData(values: any, instituteCode?: number) {
  const url = instituteCode
    ? `${createContactInformation}?instituteCode=${instituteCode}`
    : createContactInformation;
  return axios.post(url, values);
}

export function UpdateContactInformationData(id: any, values: any) {
  return axios.put(`${updateContactInformation}/${id}`, values);
}

export function DeleteContactInformationData(id: any) {
  return axios.delete(deleteContactInformation + id);
}

export function GetReportStatus(contactPersonId: number, assessmentId: number, reportType: string) {
  return axios.get(
    `${API_URL}/contact-person/${contactPersonId}/report-status/${assessmentId}?reportType=${reportType}`
  );
}

export function SendReportsToContactPerson(
  contactPersonId: number,
  assessmentId: number,
  reportType: string
) {
  return axios.post(`${API_URL}/contact-person/send-reports`, {
    contactPersonId,
    assessmentId,
    reportType,
  });
}

export function GetReportStatusByInstitute(
  instituteCode: number,
  assessmentId: number,
  reportType: string
) {
  return axios.get(
    `${API_URL}/contact-person/report-status-by-institute/${instituteCode}/${assessmentId}?reportType=${reportType}`
  );
}

export function SendReportsByInstitute(
  contactPersonId: number,
  instituteCode: number,
  assessmentId: number,
  reportType: string,
  selectedStudentIds?: number[]
) {
  return axios.post(`${API_URL}/contact-person/send-reports-by-institute`, {
    contactPersonId,
    instituteCode,
    assessmentId,
    reportType,
    selectedStudentIds,
  });
}

export function SendReportEmail(
  emails: string[],
  subject: string,
  htmlContent: string,
  fromName?: string
) {
  return axios.post(`${API_URL}/contact-person/send-report-email`, {
    emails,
    subject,
    htmlContent,
    fromName,
  });
}

export function SendWhatsApp(
  phoneNumber: string,
  templateName: string,
  templateParams: string[]
) {
  return axios.post(`${API_URL}/contact-person/send-whatsapp`, {
    phoneNumber,
    templateName,
    templateParams,
  });
}

export function SendWhatsAppBulk(
  templateName: string,
  recipients: { phoneNumber: string; templateParams: string[] }[]
) {
  return axios.post(`${API_URL}/contact-person/send-whatsapp-bulk`, {
    templateName,
    recipients,
  });
}
