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

export type ReportType = 'bet' | 'navigator' | 'fourPager';

/**
 * Returns every report type this assessment produces.
 *   - BET (questionnaire.type === true): ['bet']
 *   - General / Navigator (anything else): ['navigator', 'fourPager']
 *
 * "General" assessments drive both the 18-page Navigator and the 4-Pager.
 * The same raw scores feed both — the 4-Pager is a second presentation layer.
 */
export function getReportTypes(assessment: Assessment): ReportType[] {
  if (assessment.questionnaire?.type === true) return ['bet'];
  return ['navigator', 'fourPager'];
}

/** Primary report type (first of the list). */
export function getReportType(assessment: Assessment): ReportType {
  return getReportTypes(assessment)[0];
}

export function hasReportType(assessment: Assessment, type: ReportType): boolean {
  return getReportTypes(assessment).includes(type);
}

// ═══════════════════════ API DISPATCHERS ═══════════════════════
//
// Each dispatcher takes an explicit `type` so the hub can drive per-type
// actions on general assessments (where both Navigator and 4-Pager apply).
// When `type` is omitted, the primary type is used — preserving the prior
// single-type behaviour for all existing call sites.

function resolve(assessment: Assessment, type?: ReportType): ReportType {
  return type ?? getReportType(assessment);
}

export function generateDataForAssessment(
  assessment: Assessment,
  studentIds: number[],
  type?: ReportType
) {
  const t = resolve(assessment, type);
  if (t === 'bet') return generateBetReportData(assessment.id, studentIds);
  // Navigator + 4-Pager share the same underlying data generation (raw scores).
  return generateNavigatorReportData(assessment.id, studentIds);
}

export function getReportDataByAssessment(assessment: Assessment, type?: ReportType) {
  const t = resolve(assessment, type);
  if (t === 'bet') return getBetReportDataByAssessment(assessment.id);
  return getNavigatorReportDataByAssessment(assessment.id);
}

export function exportReportExcel(assessment: Assessment, type?: ReportType) {
  const t = resolve(assessment, type);
  if (t === 'bet') return exportBetReportExcel(assessment.id);
  return exportNavigatorReportExcel(assessment.id);
}

export function generateReportsForAssessment(
  assessment: Assessment,
  studentIds: number[],
  type?: ReportType
) {
  const t = resolve(assessment, type);
  if (t === 'bet') return generateBetHtmlReports(assessment.id, studentIds);
  if (t === 'fourPager') {
    // 4-pager is frontend-rendered per student; the hub generates on demand via
    // FourPagerPreview/bulk flow. No backend HTML endpoint to call.
    return Promise.resolve({ data: { generated: studentIds.length } });
  }
  return generateNavigatorHtmlReports(assessment.id, studentIds);
}

export function downloadReport(assessment: Assessment, userStudentId: number, type?: ReportType) {
  const t = resolve(assessment, type);
  if (t === 'bet') return downloadBetReport(userStudentId, assessment.id);
  // 4-pager download is handled inline by FourPagerPreview (client-side PDF).
  // Navigator download is the only backend HTML fetch.
  return downloadNavigatorReport(userStudentId, assessment.id);
}

export function getReportUrls(assessment: Assessment, userStudentIds: number[], type?: ReportType) {
  const t = resolve(assessment, type);
  if (t === 'bet') return getBetReportUrls(assessment.id, userStudentIds);
  if (t === 'fourPager') {
    // No persisted URLs for 4-pager in MVP; return empty map so hub visibility
    // toggles and preview flow behave.
    return Promise.resolve({ data: {} as Record<string, string> });
  }
  return getNavigatorReportUrls(assessment.id, userStudentIds);
}

export function exportOMR(assessmentId: number) {
  return exportGeneralAssessmentExcel(assessmentId);
}

export function exportOMRStudent(assessmentId: number, studentId: number) {
  return exportGeneralAssessmentExcelForStudent(assessmentId, studentId);
}

export function resetStudent(assessment: Assessment, studentId: number, type?: ReportType) {
  const t = resolve(assessment, type);
  if (t === 'navigator' || t === 'fourPager') {
    return resetNavigatorForStudent(studentId, assessment.id);
  }
  return Promise.resolve();
}

export function resetAssessment(assessment: Assessment, type?: ReportType) {
  const t = resolve(assessment, type);
  if (t === 'navigator' || t === 'fourPager') {
    return resetNavigatorForAssessment(assessment.id);
  }
  return Promise.resolve();
}
