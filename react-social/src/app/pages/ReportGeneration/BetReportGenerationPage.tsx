import React from "react";
import ReportGenerationPage, { ReportGenerationConfig } from "./components/ReportGenerationPage";
import {
  generateBetReportData,
  exportBetReportExcel,
  getBetReportDataByAssessment,
  generateHtmlReports,
  exportGeneralAssessmentExcel,
  exportGeneralAssessmentExcelForStudent,
} from "./API/BetReportData_APIs";

const betConfig: ReportGenerationConfig = {
  title: "BET Report Generation",
  subtitle: "Generate report data, export, and create HTML reports for BET assessments",
  accentColor: "#4361ee",
  placeholderIcon: "&#x1F4CB;",
  reportFilePrefix: "bet_report",

  hasEligibility: false,
  hasReset: false,

  api: {
    generateData: (assessmentId, ids) => generateBetReportData(assessmentId, ids),
    getByAssessment: (assessmentId) => getBetReportDataByAssessment(assessmentId),
    exportExcel: (assessmentId) => exportBetReportExcel(assessmentId),
    generateReports: (assessmentId, ids) => generateHtmlReports(assessmentId, ids),
    exportOMR: (assessmentId) => exportGeneralAssessmentExcel(assessmentId),
    exportOMRStudent: (assessmentId, studentId) => exportGeneralAssessmentExcelForStudent(assessmentId, studentId),
  },
};

const BetReportGenerationPage: React.FC = () => <ReportGenerationPage config={betConfig} />;

export default BetReportGenerationPage;
