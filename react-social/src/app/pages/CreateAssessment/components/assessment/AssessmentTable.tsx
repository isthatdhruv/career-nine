import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteAssessmentData } from "../../API/Create_Assessment_APIs";

const AssessmentTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();

  // Debug log
  console.log("AssessmentTable received data:", props.data);

  const datatable = {
    columns: [
      {
        label: "Assessment Name",
        field: "assessmentName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Assessment Name",
        },
      },
      {
        label: "Start Date",
        field: "startDate",
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

    rows:props.data.map((data: any) => ({
      assessmentName: data.AssessmentName || data.assessmentName || "N/A",
      startDate: data.starDate || data.startDate || "N/A",
      actions: (
        <>
          <button
            onClick={() => {
              navigate(`/assessments/edit/${data.id || data.assessmentId}`, {
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
                await DeleteAssessmentData(data.id || data.toolId);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete assessment. Please try again.");
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

export default AssessmentTable;
