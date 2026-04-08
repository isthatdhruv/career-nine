import { Assessment } from '../../StudentInformation/StudentInfo_APIs';
import {
  generateBetReportData,
  getBetReportDataByAssessment,
  exportBetReportExcel,
  generateHtmlReports as generateBetHtmlReports,
  downloadBetReport,
  getBetReportUrls,
  exportGeneralAssessmentExcel,
  exportGeneralAssessmentExcelForStudent,
} from '../../ReportGeneration/API/BetReportData_APIs';
import {
  generateNavigatorReportData,
  getNavigatorReportDataByAssessment,
  exportNavigatorReportExcel,
  generateNavigatorHtmlReports,
  resetNavigatorForStudent,
  resetNavigatorForAssessment,
  downloadNavigatorReport,
  getNavigatorReportUrls,
  exportGeneralAssessmentExcel as exportNavGeneralAssessmentExcel,
  exportGeneralAssessmentExcelForStudent as exportNavGeneralAssessmentExcelForStudent,
} from '../../NavigatorReportGeneration/API/NavigatorReportData_APIs';

// ═══════════════════════ TYPE DETECTION ═══════════════════════

export type ReportType = 'bet' | 'navigator';

export function getReportType(assessment: Assessment): ReportType {
  return assessment.questionnaire?.type === true ? 'bet' : 'navigator';
}

// ═══════════════════════ API DISPATCHERS ═══════════════════════

export function generateDataForAssessment(assessment: Assessment, studentIds: number[]) {
  return getReportType(assessment) === 'bet'
    ? generateBetReportData(assessment.id, studentIds)
    : generateNavigatorReportData(assessment.id, studentIds);
}

export function getReportDataByAssessment(assessment: Assessment) {
  return getReportType(assessment) === 'bet'
    ? getBetReportDataByAssessment(assessment.id)
    : getNavigatorReportDataByAssessment(assessment.id);
}

export function exportReportExcel(assessment: Assessment) {
  return getReportType(assessment) === 'bet'
    ? exportBetReportExcel(assessment.id)
    : exportNavigatorReportExcel(assessment.id);
}

export function generateReportsForAssessment(assessment: Assessment, studentIds: number[]) {
  return getReportType(assessment) === 'bet'
    ? generateBetHtmlReports(assessment.id, studentIds)
    : generateNavigatorHtmlReports(assessment.id, studentIds);
}

export function downloadReport(assessment: Assessment, userStudentId: number) {
  return getReportType(assessment) === 'bet'
    ? downloadBetReport(userStudentId, assessment.id)
    : downloadNavigatorReport(userStudentId, assessment.id);
}

export function getReportUrls(assessment: Assessment, userStudentIds: number[]) {
  return getReportType(assessment) === 'bet'
    ? getBetReportUrls(assessment.id, userStudentIds)
    : getNavigatorReportUrls(assessment.id, userStudentIds);
}

export function exportOMR(assessmentId: number) {
  return exportGeneralAssessmentExcel(assessmentId);
}

export function exportOMRStudent(assessmentId: number, studentId: number) {
  return exportGeneralAssessmentExcelForStudent(assessmentId, studentId);
}

export function resetStudent(assessment: Assessment, studentId: number) {
  if (getReportType(assessment) === 'navigator') {
    return resetNavigatorForStudent(studentId, assessment.id);
  }
  return Promise.resolve();
}

export function resetAssessment(assessment: Assessment) {
  if (getReportType(assessment) === 'navigator') {
    return resetNavigatorForAssessment(assessment.id);
  }
  return Promise.resolve();
}
