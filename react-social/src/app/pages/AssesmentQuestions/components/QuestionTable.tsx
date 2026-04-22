import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { showErrorToast } from '../../../utils/toast';
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import {
  DeleteQuestionData,
  ReadMeasuredQualityTypes,
  ExportQuestionsToExcel,
  GetMqtCountsPerQuestion,
} from "../API/Question_APIs";
import QuestionLanguageModal from "./QuestionLanguageModal";
import QuestionBulkUploadModal from "./QuestionBulkUploadModal";
import * as XLSX from "xlsx";
import { ActionIcon } from "../../../components/ActionIcon";

const QuestionTable = (props: {
  data: any;
  sections: any[];
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [selectedMeasuredQualityTypesByQuestion, setSelectedMeasuredQualityTypesByQuestion] = useState<{ [key: number]: any[] }>({});
  const [measuredQualityTypes, setMeasuredQualityTypes] = useState<any[]>([]);
  const [mqtCounts, setMqtCounts] = useState<Record<number, number>>({});
  const [mqtSortDir, setMqtSortDir] = useState<"none" | "asc" | "desc">("none");
  const [searchText, setSearchText] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>(
    () => sessionStorage.getItem("questionTableSectionFilter") || ""
  );

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  useEffect(() => {
    const fetchMeasuredQualityTypes = async () => {
      try {
        const response = await ReadMeasuredQualityTypes();
        setMeasuredQualityTypes(response.data);
      } catch (error) {
        console.error("Error fetching MeasuredQualityTypes:", error);
      }
    };
    fetchMeasuredQualityTypes();
  }, []);

  useEffect(() => {
    GetMqtCountsPerQuestion()
      .then((res) => setMqtCounts(res.data || {}))
      .catch(() => {});
  }, [props.data]);

  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      await ExportQuestionsToExcel();
    } catch (error) {
      console.error("Error exporting questions to Excel:", error);
      showErrorToast("Failed to export questions. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    setDownloadingTemplate(true);
    try {
      const templateData = [
        {
          "Question Text": "What is 2+2?",
          "Question Type": "single-choice",
          "Section ID": props.sections[0]?.sectionId || 1,
          "Max Options Allowed": 1,
          "Option 1 Text": "4", "Option 1 Description": "Correct answer", "Option 1 MQTs": "Analytical:10,Problem Solving:8",
          "Option 2 Text": "5", "Option 2 Description": "Wrong answer", "Option 2 MQTs": "Analytical:2",
          "Option 3 Text": "", "Option 3 Description": "", "Option 3 MQTs": "",
          "Option 4 Text": "", "Option 4 Description": "", "Option 4 MQTs": "",
          "Option 5 Text": "", "Option 5 Description": "", "Option 5 MQTs": "",
          "Option 6 Text": "", "Option 6 Description": "", "Option 6 MQTs": "",
        },
      ];
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Questions Template");

      const legendData: any[][] = [];
      legendData.push(["Section ID", "Section Name", "Section Description"]);
      if (props.sections && props.sections.length > 0) {
        props.sections.forEach((s: any) => {
          legendData.push([s.sectionId, s.sectionName || "", s.sectionDescription || ""]);
        });
      } else {
        legendData.push(["No sections available", "", ""]);
      }
      legendData.push([]);
      legendData.push([]);
      const questionTypesStartRow = legendData.length;
      legendData.push(["Question Type", "Question Keyword"]);
      legendData.push(["Single Choice", "single-choice"]);
      legendData.push(["Multiple Choice", "multiple-choice"]);
      legendData.push(["Ranking", "ranking"]);

      const legendSheet = XLSX.utils.aoa_to_sheet(legendData);
      const boldStyle = { font: { bold: true } };
      const sectionHeaders = ["A1", "B1", "C1"];
      const qTypeHeaders = [`A${questionTypesStartRow + 1}`, `B${questionTypesStartRow + 1}`];
      [...sectionHeaders, ...qTypeHeaders].forEach((ref) => {
        if (legendSheet[ref]) legendSheet[ref].s = boldStyle;
      });
      legendSheet["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 40 }];
      legendSheet["!autofilter"] = { ref: `A1:C${(props.sections?.length || 1) + 1}` };
      XLSX.utils.book_append_sheet(workbook, legendSheet, "Legend");

      const maxWidth = 50;
      const colWidths = Object.keys(templateData[0]).map((key) => ({ wch: Math.min(key.length + 2, maxWidth) }));
      worksheet["!cols"] = colWidths;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      XLSX.writeFile(workbook, `questions_template_${timestamp}.xlsx`);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const filteredData = props.data.filter((item: any) => {
    const matchesText = (item.questionText ?? "").toString().toLowerCase().includes(searchText.trim().toLowerCase());
    const itemSectionId = item.section?.sectionId ?? item.sectionId;
    const matchesSection = !selectedSection || String(itemSectionId) === selectedSection;
    return matchesText && matchesSection;
  });

  const actionBtnStyle = (color: string) => ({
    width: "34px", height: "34px", padding: 0,
    display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    background: "transparent", color: color, border: "none", borderRadius: "8px",
    cursor: "pointer" as const,
    transition: "background-color 150ms ease",
  });

  const datatable = {
    columns: [
      { label: "#", field: "serialNo", width: 50, sort: "disabled" },
      { label: "Question Text", field: "questionText", width: 300, sort: "asc" },
      { label: "Type", field: "questionType", width: 120 },
      { label: "Section", field: "sectionType", width: 150 },
      { label: "MQTs", field: "mqtCount", sort: "disabled", width: 100 },
      { label: "Actions", field: "actions", sort: "disabled", width: 140 },
    ],

    rows: (mqtSortDir === "none" ? filteredData : [...filteredData].sort((a: any, b: any) => {
      const ca = mqtCounts[a.id] ?? 0;
      const cb = mqtCounts[b.id] ?? 0;
      return mqtSortDir === "asc" ? ca - cb : cb - ca;
    })).map((data: any, index: number) => {
      const mqtCount = mqtCounts[data.id] ?? 0;
      const typeColors: Record<string, { bg: string; color: string }> = {
        "single-choice": { bg: "#2563eb", color: "#fff" },
        "multiple-choice": { bg: "#7c3aed", color: "#fff" },
        "ranking": { bg: "#d97706", color: "#fff" },
      };
      const tc = typeColors[data.questionType] || { bg: "#f3f4f6", color: "#6b7280" };

      return {
        serialNo: (
          <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>{index + 1}</span>
        ),
        questionText: (
          <span style={{ fontSize: "0.85rem", color: "#111827", fontWeight: 500 }}>
            {data.questionText}
          </span>
        ),
        questionType: (
          <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", background: tc.bg, color: tc.color, display: "inline-block" }}>
            {data.questionType}
          </span>
        ),
        sectionType: (
          <span style={{ fontSize: "0.82rem", color: "#4b5563" }}>
            {props.sections.find((section: any) => section.sectionId === (data.section?.sectionId ?? data.sectionId))?.sectionName ?? "Unknown"}
          </span>
        ),
        mqtCount: (
          <span style={{
            fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", display: "inline-block",
            background: mqtCount > 0 ? "#059669" : "#dc2626",
            color: "#fff",
          }}>
            {mqtCount > 0 ? `${mqtCount} MQT${mqtCount !== 1 ? "s" : ""}` : "None"}
          </span>
        ),
        actions: (
          <div className="d-flex gap-1">
            <button
              onClick={() => navigate(`/assessment-questions/edit/${data.id}`, { state: { data } })}
              className="btn btn-sm" title="Edit"
              style={actionBtnStyle("#2563eb")}
            >
              <ActionIcon type="edit" size="sm" />
            </button>
            <button
              onClick={() => {
                setActiveQuestionId(data.id);
                setShowLanguageModal(true);
              }}
              className="btn btn-sm" title="Translate"
              style={actionBtnStyle("#059669")}
            >
              <i className="bi bi-translate" style={{ fontSize: "0.85rem" }}></i>
            </button>
            <button
              onClick={async () => {
                try {
                  setSelectedMeasuredQualityTypesByQuestion(prev => {
                    const newState = { ...prev };
                    delete newState[data.id];
                    return newState;
                  });
                  await DeleteQuestionData(data.id);
                  props.setPageLoading(["true"]);
                } catch (error) {
                  console.error("Delete failed:", error);
                  showErrorToast("Failed to delete question. Please try again.");
                }
              }}
              className="btn btn-sm" title="Delete"
              style={actionBtnStyle("#dc2626")}
            >
              <ActionIcon type="delete" size="sm" />
            </button>
          </div>
        ),
      };
    }),
  };

  const toolbarBtnStyle = (color: string) => ({
    background: "#fff", color: color, border: `2px solid ${color}`, borderRadius: "6px", padding: "6px 12px", fontWeight: 600 as const, fontSize: "0.82rem",
  });

  return (
    <>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        {/* Search */}
        <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
          <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search questions..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ paddingLeft: 32, borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
          />
        </div>

        {/* Section filter */}
        <select
          className="form-select form-select-sm"
          value={selectedSection}
          onChange={(e) => {
            setSelectedSection(e.target.value);
            sessionStorage.setItem("questionTableSectionFilter", e.target.value);
          }}
          style={{ maxWidth: "180px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.82rem" }}
        >
          <option value="">All Sections</option>
          {props.sections.map((section: any) => (
            <option key={section.sectionId} value={String(section.sectionId)}>
              {section.sectionName}
            </option>
          ))}
        </select>

        {/* MQT sort */}
        <button
          className="btn btn-sm d-flex align-items-center gap-1"
          onClick={() => setMqtSortDir(d => d === "none" ? "desc" : d === "desc" ? "asc" : "none")}
          style={{
            ...toolbarBtnStyle(mqtSortDir !== "none" ? "#2563eb" : "#6b7280"),
          }}
        >
          MQTs
          {mqtSortDir === "desc" && <i className="bi bi-sort-down"></i>}
          {mqtSortDir === "asc" && <i className="bi bi-sort-up"></i>}
          {mqtSortDir === "none" && <i className="bi bi-filter" style={{ opacity: 0.4 }}></i>}
        </button>

        {/* Spacer */}
        <div className="ms-auto"></div>

        {/* Action buttons */}
        <button
          onClick={handleExportToExcel}
          className="btn btn-sm d-flex align-items-center gap-1"
          disabled={exporting}
          style={toolbarBtnStyle("#059669")}
        >
          <ActionIcon type="excel" size="sm" />
          {exporting ? "Exporting..." : "Export Excel"}
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="btn btn-sm d-flex align-items-center gap-1"
          disabled={downloadingTemplate}
          style={toolbarBtnStyle("#0369a1")}
        >
          <ActionIcon type="download" size="sm" />
          {downloadingTemplate ? "Downloading..." : "Template"}
        </button>

        <button
          onClick={() => setShowBulkUploadModal(true)}
          className="btn btn-sm d-flex align-items-center gap-1"
          style={toolbarBtnStyle("#7c3aed")}
        >
          <ActionIcon type="upload" size="sm" />
          Upload Excel
        </button>
      </div>

      {/* Results count */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          Showing {filteredData.length} of {props.data.length} questions
          {selectedSection && " (filtered)"}
        </span>
      </div>

      {/* Data Table */}
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[100, 150, 200, 500]}
        entries={100}
        pagesAmount={4}
        searchTop={false}
        searchBottom={false}
        data={datatable}
      />

      {/* Modals */}
      <QuestionLanguageModal
        show={showLanguageModal}
        onHide={() => setShowLanguageModal(false)}
        setPageLoading={props.setPageLoading}
        questionId={activeQuestionId}
      />

      <QuestionBulkUploadModal
        show={showBulkUploadModal}
        onHide={() => setShowBulkUploadModal(false)}
        onUploadComplete={() => props.setPageLoading(["true"])}
        sections={props.sections}
      />
    </>
  );
};

export default QuestionTable;
