import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { FaLightbulb, FaFileDownload } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import {
  AssignMeasuredQualityTypeToQuestion,
  DeleteQuestionData,
  GetMeasuredQualityTypesForQuestion,
  ReadMeasuredQualityTypes,
  RemoveMeasuredQualityTypeFromQuestion,
  ExportQuestionsToExcel, // Import the new export function
  ImportQuestionsFromExcel
} from "../API/Question_APIs";
import QuestionLanguageModal from "./QuestionLanguageModal";  // ✅ import modal
import QuestionBulkUploadModal from "./QuestionBulkUploadModal";
import * as XLSX from "xlsx"; // For template generation

const QuestionTable = (props: {
  data: any;
  sections: any[];

  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [selectedMeasuredQualityTypesByQuestion, setSelectedMeasuredQualityTypesByQuestion] = useState<{ [key: number]: any[] }>({});
  const [measuredQualityTypes, setMeasuredQualityTypes] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>(
    () => sessionStorage.getItem("questionTableSectionFilter") || ""
  );

  // ✅ State for modals
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [exporting, setExporting] = useState(false); // Export loading state
  const [downloadingTemplate, setDownloadingTemplate] = useState(false); // Template download loading state

  // Fetch measured quality types
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

  // Load existing selections when component mounts
  // useEffect(() => {
  //   const loadExistingSelections = async () => {
  //     const newSelections: {[key: number]: any[]} = {};
      
  //     for (const question of props.data) {
  //       try {
  //         const response = await GetMeasuredQualityTypesForQuestion(question.id);
  //         newSelections[question.id] = response.data.map((type: any) => type.measuredQualityTypeId);
  //       } catch (error) {
  //         if ((error as any)?.response?.status === 404) {
  //           console.log(`Question ${question.id} not found, skipping...`);
  //         } else {
  //           console.error(`Error loading quality types for question ${question.id}:`, error);
  //         }
  //         newSelections[question.id] = [];
  //       }
  //     }
      
  //     setSelectedMeasuredQualityTypesByQuestion(newSelections);
  //   };
    
  //   if (props.data && props.data.length > 0) {
  //     loadExistingSelections();
  //   } else {
  //     setSelectedMeasuredQualityTypesByQuestion({});
  //   }
  // }, [props.data]);


  /**
   * Handle Excel export download
   * This function calls the API to download all assessment questions in Excel format
   * The Excel file includes questions, options, sections, and measured quality type scores
   */
  const handleExportToExcel = async () => {
    try {
      setExporting(true);

      // Call the API to get the Excel file
      await ExportQuestionsToExcel();
    } catch (error) {
      console.error("Error exporting questions to Excel:", error);
      alert("Failed to export questions. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  /**
   * Generate and download an Excel template for bulk question upload
   *
   * This creates a blank Excel file with:
   * - Proper column headers
   * - One sample question row
   * - Instructions for filling the template
   */
  const handleDownloadTemplate = () => {
    setDownloadingTemplate(true);
    try {
    // Create sample data with instructions
    const templateData = [
      {
        "Question Text": "What is 2+2?",
        "Question Type": "single-choice",
        "Section ID": props.sections[0]?.sectionId || 1,
        "Max Options Allowed": 1,
        "Option 1 Text": "4",
        "Option 1 Description": "Correct answer",
        "Option 1 MQTs": "Analytical:10,Problem Solving:8",
        "Option 2 Text": "5",
        "Option 2 Description": "Wrong answer",
        "Option 2 MQTs": "Analytical:2",
        "Option 3 Text": "",
        "Option 3 Description": "",
        "Option 3 MQTs": "",
        "Option 4 Text": "",
        "Option 4 Description": "",
        "Option 4 MQTs": "",
        "Option 5 Text": "",
        "Option 5 Description": "",
        "Option 5 MQTs": "",
        "Option 6 Text": "",
        "Option 6 Description": "",
        "Option 6 MQTs": "",
      },
    ];
    // Create workbook and worksheets
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions Template");

    // Build Legend sheet using aoa (array of arrays) for full layout control
    const legendData: any[][] = [];

    // --- Sections table ---
    legendData.push(["Section ID", "Section Name", "Section Description"]);
    if (props.sections && props.sections.length > 0) {
      props.sections.forEach((s: any) => {
        legendData.push([s.sectionId, s.sectionName || "", s.sectionDescription || ""]);
      });
    } else {
      legendData.push(["No sections available", "", ""]);
    }

    // 2-row gap
    legendData.push([]);
    legendData.push([]);

    // --- Question Types table ---
    const questionTypesStartRow = legendData.length;
    legendData.push(["Question Type", "Question Keyword"]);
    legendData.push(["Single Choice", "single-choice"]);
    legendData.push(["Multiple Choice", "multiple-choice"]);
    legendData.push(["Ranking", "ranking"]);

    const legendSheet = XLSX.utils.aoa_to_sheet(legendData);

    // Bold header styling for both table headers
    const boldStyle = { font: { bold: true } };
    const sectionHeaders = ["A1", "B1", "C1"];
    const qTypeHeaders = [
      `A${questionTypesStartRow + 1}`,
      `B${questionTypesStartRow + 1}`,
    ];
    [...sectionHeaders, ...qTypeHeaders].forEach((ref) => {
      if (legendSheet[ref]) {
        legendSheet[ref].s = boldStyle;
      }
    });

    // Column widths for Legend sheet
    legendSheet["!cols"] = [
      { wch: 14 }, // Section ID / Question Type
      { wch: 30 }, // Section Name / Question Keyword
      { wch: 40 }, // Section Description
    ];

    // AutoFilter on sections table (gives table-like header appearance)
    legendSheet["!autofilter"] = {
      ref: `A1:C${(props.sections?.length || 1) + 1}`,
    };

    XLSX.utils.book_append_sheet(workbook, legendSheet, "Legend");

    // Auto-size columns for Questions Template sheet
    const maxWidth = 50;
    const colWidths = Object.keys(templateData[0]).map((key) => ({
      wch: Math.min(key.length + 2, maxWidth),
    }));
    worksheet["!cols"] = colWidths;

    // Generate file and trigger download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(workbook, `questions_template_${timestamp}.xlsx`);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const filteredData = props.data.filter((item: any) => {
    const matchesText = (item.questionText ?? "")
      .toString()
      .toLowerCase()
      .includes(searchText.trim().toLowerCase());
    const itemSectionId = item.section?.sectionId ?? item.sectionId;
    const matchesSection = !selectedSection || String(itemSectionId) === selectedSection;
    return matchesText && matchesSection;
  });

  const datatable = {
    columns: [
      { label: "#", field: "serialNo", width: 50, sort: "disabled" },
      { label: "Question Text", field: "questionText", width: 300 , sort: "asc",},
      { label: "Question Type", field: "questionType", width: 150 },
      { label: "Section", field: "sectionType", width: 150 },
      // { label: "Section", field: "sectionType", sort: "asc", width: 150 },
      { label: "Actions", field: "actions", sort: "disabled", width: 200 },
    ],

    rows: filteredData.map((data: any, index: number) => ({
      serialNo: <div>{index + 1}</div>,
      questionText: <div>{data.questionText}</div>,
      questionType: <div>{data.questionType}</div>,
      sectionType: (
        <div>
          {props.sections.find(section => section.sectionId === (data.section?.sectionId ?? data.sectionId))?.sectionName ?? "Unknown"}
        </div>
      ),
      actions: (
        <div className="d-flex">
          {/* Edit button */}
          <button
            onClick={() => {
              navigate(`/assessment-questions/edit/${data.id}`, {
                state: { data },
              });
            }}
            className="btn btn-icon btn-primary btn-sm me-2"
          >
            <AiFillEdit size={16} />
          </button>

          {/* ✅ Green bulb button -> Opens modal */}
          <button
            onClick={() => {
              setActiveQuestionId(data.id);
              setShowLanguageModal(true);
            }}
            className="btn btn-icon btn-success btn-sm me-2"
          >
            <FaLightbulb size={16} />
          </button>

          {/* Delete button */}
          <button
            onClick={async () => { 
              // props.setLoading(true);
              try {
                setSelectedMeasuredQualityTypesByQuestion(prev => {
                  const newState = {...prev};
                  delete newState[data.id];
                  return newState;
                });
                await DeleteQuestionData(data.id);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete question. Please try again.");
              } finally {
                // props.setLoading(false);
              }
            }}
            className="btn btn-icon btn-danger btn-sm"
          >
            <UseAnimations animation={trash} size={22} strokeColor={"#EFF8FE"} />
          </button>
        </div>
      ),
    })),
  };
  
  return (
    <>
      {/* Header section with search, download, and upload buttons */}
      <div className="d-flex justify-content-end mb-2 gap-2">
        {/* Download Excel button - exports all questions with their details */}
        <button
          onClick={handleExportToExcel}
          className="btn btn-success d-flex align-items-center"
          title="Download all questions in Excel format"
          disabled={exporting}
        >
          {exporting ? (
            <span className="spinner-border spinner-border-sm me-2" role="status" />
          ) : (
            <FaFileDownload size={18} className="me-2" />
          )}
          {exporting ? "Downloading..." : "Download Excel"}
        </button>

        {/* Download Template button - downloads blank template for bulk upload */}
        <button
          onClick={handleDownloadTemplate}
          className="btn btn-info d-flex align-items-center"
          title="Download a blank template to fill with your questions"
          disabled={downloadingTemplate}
        >
          {downloadingTemplate ? (
            <span className="spinner-border spinner-border-sm me-2" role="status" />
          ) : (
            <FaFileDownload size={18} className="me-2" />
          )}
          {downloadingTemplate ? "Downloading..." : "Download Template"}
        </button>

        {/* Upload Excel button - opens modal for bulk question upload */}
        <button
          onClick={() => setShowBulkUploadModal(true)}
          className="btn btn-primary d-flex align-items-center"
          title="Upload Excel file to import questions (with preview)"
        >
          <FaFileDownload size={18} className="me-2" style={{ transform: 'rotate(180deg)' }} />
          Upload Excel
        </button>

        {/* Section filter dropdown */}
        <select
          className="form-select"
          value={selectedSection}
          onChange={(e) => {
            setSelectedSection(e.target.value);
            sessionStorage.setItem("questionTableSectionFilter", e.target.value);
          }}
          style={{ maxWidth: "200px" }}
        >
          <option value="">All Sections</option>
          {props.sections.map((section: any) => (
            <option key={section.sectionId} value={String(section.sectionId)}>
              {section.sectionName}
            </option>
          ))}
        </select>

        {/* Search input for filtering questions */}
        <input
          type="search"
          className="form-control"
          placeholder="Search question text..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          style={{ maxWidth: "360px" }}
        />
      </div>
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

      {/* ✅ Modals */}
      <QuestionLanguageModal
        show={showLanguageModal}
        onHide={() => setShowLanguageModal(false)}
        setPageLoading={props.setPageLoading}
        questionId={activeQuestionId}   // passing question ID
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
