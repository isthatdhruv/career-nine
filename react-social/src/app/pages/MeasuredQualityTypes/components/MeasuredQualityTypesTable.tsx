import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteMeasuredQualityTypesData } from "../API/Measured_Quality_Types_APIs";

const MeasuredQualityTypesTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();

  const datatable = {
    columns: [
      {
        label: "Quality Type Name",
        field: "qualityTypeName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Quality Type Name",
        },
      },
      {
        label: "Quality Type Description",
        field: "qualityTypeDescription",
        sort: "asc",
        width: 150,
      },
      {
        label: "Quality Type Display Name",
        field: "qualityTypeDisplayName",
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
      qualityTypeName: data.qualityTypeName,
      qualityTypeDescription: data.qualityTypeDescription,
      qualityTypeDisplayName: data.qualityTypeDisplayName,
      actions: (
        <>
          <button
            onClick={() => {
              navigate(`/measured-quality-types/edit/${data.id}`, {
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
                await DeleteMeasuredQualityTypesData(data.id);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete measured quality type. Please try again.");
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

export default MeasuredQualityTypesTable;
