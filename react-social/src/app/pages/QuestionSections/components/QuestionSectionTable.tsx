import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteQuestionSectionData } from "../API/Question_Section_APIs";

const QuestionSectionTable = (props: {
  data: any;
  setLoading: any;
  // setPageLoading: ;
}) => {
  const navigate = useNavigate();

  const datatable = {
    columns: [
      {
        label: "Section Name",
        field: "sectionName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Section Name",
        },
      },
      {
        label: "Section Description",
        field: "sectionDescription",
        sort: "asc",
        width: 150,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 200,
      },
    ],

    rows: props.data.map((data: any) => ({
      sectionName: data.sectionName,
      sectionDescription: data.sectionDescription,
      actions: (
        <>
          <button
            onClick={() => {
              navigate(`/question-sections/edit/${data.sectionId}`, {
                state: { data }
              });
            }}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <AiFillEdit size={16} />
          </button>

          <button
            onClick={() => {
              props.setLoading(true);
              DeleteQuestionSectionData(data.sectionId).then(() => {
                // props.setPageLoading(["true"]);
              });
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

export default QuestionSectionTable;
