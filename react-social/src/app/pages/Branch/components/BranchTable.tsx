import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { Link } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteBranchData } from "../API/Branch_APIs";
import BranchEditModal from "./BranchEditModal";

const BranchTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState({
    branchName: "",
    branchCode: "",
    abbreviation: "",
    shift: "",
    totalIntake: "",
    courseId: "",
  });

  const datatable = {
    columns: [
      {
        label: "Name",
        field: "branchName",
        width: 150,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Abbreviation",
        field: "abbreviation",
        sort: "asc",
        width: 50,
      },
      {
        label: "Shift",
        field: "shift",
        sort: "asc",
        width: 50,
      },
      {
        label: "Total Intake",
        field: "totalIntake",
        sort: "asc",
        width: 50,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 100,
      },
    ],

    rows: props.data.map((data) =>
      data.display === true
        ? {
            branchName: data.branchName,
            abbreviation: data.abbreviation,
            shift: data.shift,
            totalIntake: data.totalIntake,
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
                    DeleteBranchData(data.branchId).then(() => {
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
                  to="/batch"
                  state={{ branchId: data.branchId, branch: data.abbreviation }}
                  className="btn btn-sm btn-info"
                >
                  Add Batch
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
      <BranchEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default BranchTable;
