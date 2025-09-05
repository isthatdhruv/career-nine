import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteQuestionData } from "../API/Question_APIs";

const QuestionTable = (props: {
  data: any;
  sections: any[];
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();

  const datatable = {
    columns: [
      {
        label: "Question Text",
        field: "questionText",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Question Text",
        },
      },
      {
        label: "Question Type",
        field: "questionType",
        sort: "asc",
        width: 150,
      },
      {
        label: "Section",
        field: "sectionType",
        sort: "asc",
        width: 150,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],

    rows: props.data.map((data: any) => ({
      questionText: data.questionText,
      questionType: data.questionType,
      sectionType: props.sections.find(section => section.id === data.sectionId)?.sectionName ?? "un",
      actions: (
        <>
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
        </>
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
