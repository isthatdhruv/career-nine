import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteSessionData } from "../API/Session_APIs";
import SessionEditModal from "./SessionEditModal";

const SessionTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState({
    sessionStartDate: "",
    sessionEndDate: "",
    sessionDuration: "",
    sessionDurationType: "",
    batchId: "",
    sessionId: "",
  });

  const datatable = {
    columns: [
      {
        label: "Start",
        field: "sessionStartDate",
        width: 100,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "End",
        field: "sessionEndDate",
        sort: "asc",
        width: 100,
      },
      {
        label: "Duration",
        field: "sessionDuration",
        sort: "asc",
        width: 100,
      },
      {
        label: "Duration Type",
        field: "sessionDurationType",
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
      data.display === true
        ? {
            sessionStartDate: data.sessionStartDate,
            sessionEndDate: data.sessionEndDate,
            sessionDuration: data.sessionDuration,
            sessionDurationType: data.sessionDurationType,
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
                    DeleteSessionData(data.sessionId).then(() => {
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

                {/* <Link to={"/"} className='btn btn-sm btn-info'>
               Add Academic Type
             </Link> */}
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
      <SessionEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default SessionTable;
