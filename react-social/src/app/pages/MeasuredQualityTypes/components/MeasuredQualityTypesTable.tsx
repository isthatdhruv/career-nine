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
        field: "measuredQualityTypeName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Quality Type Name",
        },
      },
      {
        label: "Quality Type Description",
        field: "measuredQualityTypeDescription",
        sort: "asc",
        width: 150,
      },
      {
        label: "Quality Type Display Name",
        field: "measuredQualityTypeDisplayName",
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
      measuredQualityTypeName: data.measuredQualityTypeName,
      measuredQualityTypeDescription: data.measuredQualityTypeDescription,
      measuredQualityTypeDisplayName: data.measuredQualityTypeDisplayName,
      actions: (
        <>
          <button
            onClick={() => {
              navigate(`/measured-quality-types/edit/${data.measuredQualityTypeId}`, {
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
                await DeleteMeasuredQualityTypesData(data.measuredQualityTypeId);
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
