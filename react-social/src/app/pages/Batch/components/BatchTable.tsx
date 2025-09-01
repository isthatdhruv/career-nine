import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { Link } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteBatchData } from "../API/Batch_APIs";
import BatchEditModal from "./BatchEditModal";

const BatchTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState({
    instituteBatch: {
      batchStart: "",
      batchEnd: "",
      batchDuration: "",
      batchDurationType: "",
      batchId: "",
      branchId: "",
    },
    instituteBranch: "",
  });

  const datatable = {
    columns: [
      {
        label: "Start",
        field: "batchStart",
        width: 100,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "End",
        field: "batchEnd",
        sort: "asc",
        width: 100,
      },
      {
        label: "Duration",
        field: "batchDuration",
        sort: "asc",
        width: 100,
      },
      {
        label: "Duration Type",
        field: "batchDurationType",
        sort: "asc",
        width: 100,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],

    rows: props.data.map((data) =>
      data.instituteBatch.display === true
        ? {
            batchStart: data.instituteBatch.batchStart,
            batchEnd: data.instituteBatch.batchEnd,
            batchDuration: data.instituteBatch.batchDuration,
            batchDurationType: data.instituteBatch.batchDurationType,
            actions: (
              <>
                <button
                  onClick={() => {
                    setEditModalData(data);
                    setModalShowEdit(true);
                  }}
                  className="btn btn-icon btn-primary btn-sm me-3"
                >
                  <AiFillEdit size={16} />
                </button>

                <button
                  onClick={() => {
                    props.setLoading(true);
                    DeleteBatchData(data.instituteBatch.batchId).then(() => {
                      props.setPageLoading(["true"]);
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

                <Link
                  to="/session"
                  state={{
                    batchId: data.instituteBatch.batchId,
                    batchStart: data.instituteBatch.batchStart,
                    batchEnd: data.instituteBatch.batchEnd,
                  }}
                  className="btn btn-sm btn-info"
                >
                  Add Session
                </Link>
              </>
            ),
          }
        : {}
    ),
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
      <BatchEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default BatchTable;
