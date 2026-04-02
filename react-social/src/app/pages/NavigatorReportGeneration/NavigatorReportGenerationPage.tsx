import React from "react";
import ReportGenerationPage, { ReportGenerationConfig, ReportData } from "../ReportGeneration/components/ReportGenerationPage";
import {
  generateNavigatorReportData,
  exportNavigatorReportExcel,
  getNavigatorReportDataByAssessment,
  generateNavigatorHtmlReports,
  resetNavigatorForStudent,
  resetNavigatorForAssessment,
  downloadNavigatorReport,
  getNavigatorReportUrls,
  exportGeneralAssessmentExcel,
  exportGeneralAssessmentExcelForStudent,
} from "./API/NavigatorReportData_APIs";

const navigatorConfig: ReportGenerationConfig = {
  title: "Navigator Report Generation",
  subtitle: "Generate career navigator reports for general assessments (Classes 6-12)",
  accentColor: "#0d9488",
  placeholderIcon: "&#x1F9ED;",
  reportFilePrefix: "navigator_report",

  hasEligibility: true,
  hasReset: true,

  dataTabExtraColumns: (rd: ReportData | undefined) => (
    <span style={{ fontSize: "0.8rem", color: "#374151" }}>
      {rd?.pathway1 || "-"}
    </span>
  ),

  filterForReportGeneration: (rd: ReportData) => rd.eligible === true,

  api: {
    generateData: (assessmentId, ids) => generateNavigatorReportData(assessmentId, ids),
    getByAssessment: (assessmentId) => getNavigatorReportDataByAssessment(assessmentId),
    exportExcel: (assessmentId) => exportNavigatorReportExcel(assessmentId),
    generateReports: (assessmentId, ids) => generateNavigatorHtmlReports(assessmentId, ids),
    exportOMR: (assessmentId) => exportGeneralAssessmentExcel(assessmentId),
    exportOMRStudent: (assessmentId, studentId) => exportGeneralAssessmentExcelForStudent(assessmentId, studentId),
    downloadReport: (userStudentId, assessmentId) => downloadNavigatorReport(userStudentId, assessmentId),
    getReportUrls: (assessmentId, userStudentIds) => getNavigatorReportUrls(assessmentId, userStudentIds),
    resetStudent: (studentId, assessmentId) => resetNavigatorForStudent(studentId, assessmentId),
    resetAssessment: (assessmentId) => resetNavigatorForAssessment(assessmentId),
  },
};

const NavigatorReportGenerationPage: React.FC = () => <ReportGenerationPage config={navigatorConfig} />;

export default NavigatorReportGenerationPage;
