import { MDBDataTableV5 } from "mdbreact";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { ActionIcon } from "../../../components/ActionIcon";
import { DeleteToolData } from "../API/Tool_APIs";
import { showErrorToast } from '../../../utils/toast';

const ToolTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();

  const datatable = {
    columns: [
      {
        label: "Tool Name",
        field: "name",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Tool Name",
        },
      },
      {
        label: "Tool Price",
        field: "price",
        sort: "asc",
        width: 150,
      },
      {
        label: "Tool Type",
        field: "type",
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
      name: data.name,
      price: data.price,
      type: data.isFree ? "Free" : "Paid",
      actions: (
        <>
          <button
            onClick={() => {
              navigate(`/tools/edit/${data.toolId}`, {
                state: { data },
              });
            }}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <ActionIcon type="edit" size="sm" />
          </button>
          <button
            onClick={async () => { 
              props.setLoading(true);
              try {
                await DeleteToolData(data.toolId);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                showErrorToast("Failed to delete tool. Please try again.");
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

export default ToolTable;
