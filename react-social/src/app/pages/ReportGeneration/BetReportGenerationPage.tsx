import React from "react";
import ReportGenerationPage, { ReportGenerationConfig, ReportData } from "./components/ReportGenerationPage";
import {
  generateBetReportData,
  exportBetReportExcel,
  getBetReportDataByAssessment,
  generateHtmlReports,
  downloadBetReport,
  getBetReportUrls,
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

  dataTabExtraColumnsHeader: "Data Generated",
  dataTabExtraColumns: (rd: ReportData | undefined) => {
    const hasData = !!rd;
    return (
      <span style={{
        background: hasData ? "#dcfce7" : "#fee2e2",
        color: hasData ? "#059669" : "#dc2626",
        padding: "3px 10px", borderRadius: 6,
        fontWeight: 600, fontSize: "0.75rem",
      }}>
        {hasData ? "Yes" : "No"}
      </span>
    );
  },

  api: {
    generateData: (assessmentId, ids) => generateBetReportData(assessmentId, ids),
    getByAssessment: (assessmentId) => getBetReportDataByAssessment(assessmentId),
    exportExcel: (assessmentId) => exportBetReportExcel(assessmentId),
    generateReports: (assessmentId, ids) => generateHtmlReports(assessmentId, ids),
    exportOMR: (assessmentId) => exportGeneralAssessmentExcel(assessmentId),
    exportOMRStudent: (assessmentId, studentId) => exportGeneralAssessmentExcelForStudent(assessmentId, studentId),
    downloadReport: (userStudentId, assessmentId) => downloadBetReport(userStudentId, assessmentId),
    getReportUrls: (assessmentId, userStudentIds) => getBetReportUrls(assessmentId, userStudentIds),
  },
};

const BetReportGenerationPage: React.FC = () => <ReportGenerationPage config={betConfig} />;

export default BetReportGenerationPage;
