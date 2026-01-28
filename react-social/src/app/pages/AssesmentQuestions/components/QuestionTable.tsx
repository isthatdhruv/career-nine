import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { FaLightbulb } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import {
  AssignMeasuredQualityTypeToQuestion,
  DeleteQuestionData,
  GetMeasuredQualityTypesForQuestion,
  ReadMeasuredQualityTypes,
  RemoveMeasuredQualityTypeFromQuestion
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
  useEffect(() => {
    const loadExistingSelections = async () => {
      const newSelections: {[key: number]: any[]} = {};
      
      for (const question of props.data) {
        try {
          const response = await GetMeasuredQualityTypesForQuestion(question.id);
          newSelections[question.id] = response.data.map((type: any) => type.measuredQualityTypeId);
        } catch (error) {
          if ((error as any)?.response?.status === 404) {
            console.log(`Question ${question.id} not found, skipping...`);
          } else {
            console.error(`Error loading quality types for question ${question.id}:`, error);
          }
          newSelections[question.id] = [];
        }
      }
      
      setSelectedMeasuredQualityTypesByQuestion(newSelections);
    };
    
    if (props.data && props.data.length > 0) {
      loadExistingSelections();
    } else {
      setSelectedMeasuredQualityTypesByQuestion({});
    }
  }, [props.data]);

  // Handle measured quality type selection changes with real-time API calls
  // const handleMeasuredQualityTypeSelectionChange = async (questionId: number, newValue: any[]) => {
  //   const currentValue = selectedMeasuredQualityTypesByQuestion[questionId] || [];
    
  //   // Find newly selected types
  //   const newlySelected = newValue.filter(typeId => !currentValue.includes(typeId));
    
  //   // Find deselected types
  //   const deselected = currentValue.filter(typeId => !newValue.includes(typeId));
    
  //   try {
  //     // Assign new types
  //     for (const typeId of newlySelected) {
  //       await AssignMeasuredQualityTypeToQuestion(typeId, questionId);
  //       console.log(`MeasuredQualityType ${typeId} assigned to Question ${questionId}`);
  //     }
      
  //     // Remove deselected types
  //     for (const typeId of deselected) {
  //       await RemoveMeasuredQualityTypeFromQuestion(typeId, questionId);
  //       console.log(`MeasuredQualityType ${typeId} removed from Question ${questionId}`);
  //     }
      
  //     // Update state only after successful API calls
  //     setSelectedMeasuredQualityTypesByQuestion(prev => ({
  //       ...prev,
  //       [questionId]: newValue
  //     }));
      
  //   } catch (error) {
  //     console.error('Error updating MeasuredQualityType assignments:', error);
  //     alert('Failed to update MeasuredQualityType assignments. Please try again.');
      
  //     // Revert to previous state on error
  //     setSelectedMeasuredQualityTypesByQuestion(prev => ({
  //       ...prev,
  //       [questionId]: currentValue
  //     }));
  //   }
  // };

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
      <div className="d-flex justify-content-end mb-2">
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
