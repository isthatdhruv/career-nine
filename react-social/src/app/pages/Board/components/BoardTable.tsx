import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { Link } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import BoardEditModal from "./BoardEditModal";
import { DeleteBoardData } from "../API/Board_APIs";

const BoardTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState({ name: "", id: "" });

  const datatable = {
    columns: [
      {
        label: "Board Name",
        field: "name",
        width: 150,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },

      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 100,
      },
    ],

    rows: props.data.map((data: any) =>
      data.display === true
        ? {
            name: data.name,
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
                    DeleteBoardData(data.id).then(() => {
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

                {/* <Link to="/course" state={{collegeId: data.id, college: data.instituteName}} className='btn btn-sm btn-info'>
                Add Course
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
      <BoardEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default BoardTable;
