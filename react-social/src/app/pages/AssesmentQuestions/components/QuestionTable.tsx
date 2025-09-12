import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
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

const QuestionTable = (props: {
  data: any;
  sections: any[];
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [selectedMeasuredQualityTypesByQuestion, setSelectedMeasuredQualityTypesByQuestion] = useState<{ [key: number]: any[] }>({});
  const [measuredQualityTypes, setMeasuredQualityTypes] = useState<any[]>([]);

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
          // Handle 404 errors gracefully (question might have been deleted)
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
      // Clear selections if no data
      setSelectedMeasuredQualityTypesByQuestion({});
    }
  }, [props.data]);

  // Handle measured quality type selection changes with real-time API calls
  const handleMeasuredQualityTypeSelectionChange = async (questionId: number, newValue: any[]) => {
    const currentValue = selectedMeasuredQualityTypesByQuestion[questionId] || [];
    
    // Find newly selected types
    const newlySelected = newValue.filter(typeId => !currentValue.includes(typeId));
    
    // Find deselected types
    const deselected = currentValue.filter(typeId => !newValue.includes(typeId));
    
    try {
      // Assign new types
      for (const typeId of newlySelected) {
        await AssignMeasuredQualityTypeToQuestion(typeId, questionId);
        console.log(`MeasuredQualityType ${typeId} assigned to Question ${questionId}`);
      }
      
      // Remove deselected types
      for (const typeId of deselected) {
        await RemoveMeasuredQualityTypeFromQuestion(typeId, questionId);
        console.log(`MeasuredQualityType ${typeId} removed from Question ${questionId}`);
      }
      
      // Update state only after successful API calls
      setSelectedMeasuredQualityTypesByQuestion(prev => ({
        ...prev,
        [questionId]: newValue
      }));
      
    } catch (error) {
      console.error('Error updating MeasuredQualityType assignments:', error);
      alert('Failed to update MeasuredQualityType assignments. Please try again.');
      
      // Revert to previous state on error
      setSelectedMeasuredQualityTypesByQuestion(prev => ({
        ...prev,
        [questionId]: currentValue
      }));
    }
  };

  const datatable = {
    columns: [
      {
        label: "Question Text",
        field: "questionText",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Question Text",
          className: "",
        },
      },
      {
        label: "Question Type",
        field: "questionType",
        sort: "asc",
        width: 150,
        attributes: {
          className: "",
        },
      },
      {
        label: "Section",
        field: "sectionType",
        sort: "asc",
        width: 150,
        attributes: {
          className: "",
        },
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
        attributes: {
          className: "",
        },
      },
      {
        label: "MeasuredQualityTypes",
        field: "MeasuredQualityTypes",
        sort: "disabled",
        width: 150,
        attributes: {
          className: "",
        },
      },
    ],

    rows: props.data.map((data: any) => ({
      questionText: <div className="">{data.questionText}</div>,
      questionType: <div className="">{data.questionType}</div>,
      sectionType: <div className="">{props.sections.find(section => section.id === data.sectionId)?.sectionName ?? "Unknown"}</div>,
      actions: (
        <div className="">
          <button
            onClick={() => {
              navigate(`/assessment-questions/edit/${data.id}`, {
                state: { data },
              });
            }}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <AiFillEdit size={16} />
          </button>
          <button
            onClick={async () => { 
              props.setLoading(true);
              try {
                // Remove the question from local state immediately to prevent API calls
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
                props.setLoading(false);
              }
            }}
            className="btn btn-icon btn-danger btn-sm me-3"
          >
            <UseAnimations
              animation={trash}
              size={22}
              strokeColor={"#EFF8FE"}
            />
          </button>
        </div>
      ),
    })),
  };
  
  return (
    <>
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={datatable}
      />
    </>
  );
};

export default QuestionTable;