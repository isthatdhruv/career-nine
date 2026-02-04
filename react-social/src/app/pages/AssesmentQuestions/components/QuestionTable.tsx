import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { FaLightbulb, FaFileDownload } from "react-icons/fa"; // Added download icon
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import {
  AssignMeasuredQualityTypeToQuestion,
  DeleteQuestionData,
  GetMeasuredQualityTypesForQuestion,
  ReadMeasuredQualityTypes,
  RemoveMeasuredQualityTypeFromQuestion,
  ExportQuestionsToExcel // Import the new export function
} from "../API/Question_APIs";
import QuestionLanguageModal from "./QuestionLanguageModal";  // ✅ import modal

const QuestionTable = (props: {
  data: any;
  sections: any[];
  
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [selectedMeasuredQualityTypesByQuestion, setSelectedMeasuredQualityTypesByQuestion] = useState<{ [key: number]: any[] }>({});
  const [measuredQualityTypes, setMeasuredQualityTypes] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");

  // ✅ State for modal
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);

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
      // Show loading state (optional)
      props.setPageLoading(["true"]);

      // Call the API to get the Excel file
      await ExportQuestionsToExcel();

      // Hide loading state
      props.setPageLoading([]);
    } catch (error) {
      console.error("Error exporting questions to Excel:", error);
      alert("Failed to export questions. Please try again.");
      props.setPageLoading([]);
    }
  };

  const filteredData = props.data.filter((item: any) =>
    (item.questionText ?? "")
      .toString()
      .toLowerCase()
      .includes(searchText.trim().toLowerCase())
  );

  const datatable = {
    columns: [
      { label: "Question Text", field: "questionText", width: 300 , sort: "asc",},
      { label: "Question Type", field: "questionType", width: 150 },
      // { label: "Section", field: "sectionType", sort: "asc", width: 150 },
      { label: "Actions", field: "actions", sort: "disabled", width: 200 },
    ],

    rows: filteredData.map((data: any) => ({
      questionText: <div>{data.questionText}</div>,
      questionType: <div>{data.questionType}</div>,
      sectionType: (
        <div>
          {props.sections.find(section => section.sectionId === data.sectionId)?.sectionName ?? "Unknown"}
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
      {/* Header section with search and download button */}
      <div className="d-flex justify-content-end mb-2 gap-2">
        {/* Download Excel button - exports all questions with their details */}
        <button
          onClick={handleExportToExcel}
          className="btn btn-success d-flex align-items-center"
          title="Download all questions in Excel format"
        >
          <FaFileDownload size={18} className="me-2" />
          Download Excel
        </button>

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

      {/* ✅ Modal */}
      <QuestionLanguageModal
        show={showLanguageModal}
        onHide={() => setShowLanguageModal(false)}
        setPageLoading={props.setPageLoading}
        questionId={activeQuestionId}   // passing question ID
      />
    </>
  );
};

export default QuestionTable;
