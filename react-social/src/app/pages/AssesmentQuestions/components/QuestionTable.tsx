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
      return {
        serialNo: (
          <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>{index + 1}</span>
        ),
        questionText: (
          <span style={{ fontSize: "0.85rem", color: "#1f2937", fontWeight: 500 }}>
            {data.questionText}
          </span>
        ),
        questionType: (
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "6px",
              background: data.questionType === "single-choice" ? "rgba(67, 97, 238, 0.1)" : data.questionType === "multiple-choice" ? "rgba(124, 58, 237, 0.1)" : "rgba(245, 158, 11, 0.1)",
              color: data.questionType === "single-choice" ? "#4361ee" : data.questionType === "multiple-choice" ? "#7c3aed" : "#d97706",
            }}
          >
            {data.questionType}
          </span>
        ),
        sectionType: (
          <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>
            {props.sections.find((section: any) => section.sectionId === (data.section?.sectionId ?? data.sectionId))?.sectionName ?? "Unknown"}
          </span>
        ),
        mqtCount: (
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "6px",
              background: mqtCount > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(220, 38, 38, 0.08)",
              color: mqtCount > 0 ? "#059669" : "#dc2626",
            }}
          >
            {mqtCount > 0 ? `${mqtCount} MQT${mqtCount !== 1 ? "s" : ""}` : "None"}
          </span>
        ),
        actions: (
          <div className="d-flex gap-1">
            <button
              onClick={() => navigate(`/assessment-questions/edit/${data.id}`, { state: { data } })}
              className="btn btn-sm"
              title="Edit"
              style={{
                width: "30px", height: "30px", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(67, 97, 238, 0.1)", color: "#4361ee",
                border: "1px solid rgba(67, 97, 238, 0.2)", borderRadius: "6px",
              }}
            >
              <i className="bi bi-pencil-fill" style={{ fontSize: "0.75rem" }}></i>
            </button>
            <button
              onClick={() => {
                setActiveQuestionId(data.id);
                setShowLanguageModal(true);
              }}
              className="btn btn-sm"
              title="Language"
              style={{
                width: "30px", height: "30px", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(16, 185, 129, 0.1)", color: "#059669",
                border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "6px",
              }}
            >
              <i className="bi bi-translate" style={{ fontSize: "0.75rem" }}></i>
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
              className="btn btn-sm"
              title="Delete"
              style={{
                width: "30px", height: "30px", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(220, 38, 38, 0.1)", color: "#dc2626",
                border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "6px",
              }}
            >
              <i className="bi bi-trash-fill" style={{ fontSize: "0.75rem" }}></i>
            </button>
          </div>
        ),
      };
    }),
  };

  return (
    <>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        {/* Search */}
        <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
          <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}></i>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search questions..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ paddingLeft: 36, borderRadius: "8px", border: "1.5px solid #e0e0e0", fontSize: "0.85rem" }}
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
          style={{ maxWidth: "180px", borderRadius: "8px", border: "1.5px solid #e0e0e0", fontSize: "0.82rem" }}
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
            borderRadius: "8px",
            padding: "5px 10px",
            fontWeight: 600,
            fontSize: "0.78rem",
            background: mqtSortDir !== "none" ? "rgba(67, 97, 238, 0.1)" : "#f1f5f9",
            color: mqtSortDir !== "none" ? "#4361ee" : "#6b7280",
            border: `1px solid ${mqtSortDir !== "none" ? "rgba(67, 97, 238, 0.2)" : "#e2e8f0"}`,
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
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            color: "#059669",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "8px",
            padding: "5px 10px",
            fontWeight: 600,
            fontSize: "0.78rem",
          }}
        >
          <i className="bi bi-download"></i>
          {exporting ? "Exporting..." : "Export Excel"}
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="btn btn-sm d-flex align-items-center gap-1"
          disabled={downloadingTemplate}
          style={{
            background: "rgba(8, 145, 178, 0.1)",
            color: "#0891b2",
            border: "1px solid rgba(8, 145, 178, 0.2)",
            borderRadius: "8px",
            padding: "5px 10px",
            fontWeight: 600,
            fontSize: "0.78rem",
          }}
        >
          <i className="bi bi-file-earmark-arrow-down"></i>
          {downloadingTemplate ? "Downloading..." : "Template"}
        </button>

        <button
          onClick={() => setShowBulkUploadModal(true)}
          className="btn btn-sm d-flex align-items-center gap-1"
          style={{
            background: "rgba(124, 58, 237, 0.1)",
            color: "#7c3aed",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: "8px",
            padding: "5px 10px",
            fontWeight: 600,
            fontSize: "0.78rem",
          }}
        >
          <i className="bi bi-upload"></i>
          Upload Excel
        </button>
      </div>

      {/* Results count */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
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
