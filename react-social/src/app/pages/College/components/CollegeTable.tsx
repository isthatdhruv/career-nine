import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit, AiOutlineInfoCircle } from "react-icons/ai";
import { Link } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteCollegeData } from "../API/College_APIs";
import CollegeEditModal from "./CollegeEditModal";
import CollegeInfoModal from "./CollegeInfoModal ";

const CollegeTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [modalShowInfo, setModalShowInfo] = useState(false);
  const [editModalData, setEditModalData] = useState({
    instituteName: "",
    instituteAddress: "",
    instituteCode: "",
  });

  const datatable = {
    columns: [
      {
        label: "Name",
        field: "name",
        width: 150,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Code",
        field: "code",
        sort: "asc",
        width: 100,
      },
      {
        label: "Address",
        field: "address",
        width: 100,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],

    rows: props.data.map((data: any) =>
      data.display === true
        ? {
            name: data.instituteName,
            code: data.instituteCode,
            address: data.instituteAddress,
            actions: (
              <>
                {/* Edit Button */}
                <button
                  onClick={() => {
                    setEditModalData(data);
                    setModalShowEdit(true);
                  }}
                  className="btn btn-icon btn-primary btn-sm me-3"
                >
                  <AiFillEdit size={16} />
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => {
                    props.setLoading(true);
                    DeleteCollegeData(data.instituteCode).then(() => {
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

                {/* Add Course Button */}
                <Link
                  to="/course"
                  state={{
                    collegeId: data.instituteCode,
                    college: data.instituteName,
                  }}
                  className="btn btn-sm btn-info me-3"
                >
                  Add Course
                </Link>

                {/* NEW Info Button */}
                <button
                  className="btn btn-icon btn-secondary btn-sm"
                  onClick={() => {
                    setModalShowInfo(true);
                  }}
                >
                  <AiOutlineInfoCircle size={18} />
                </button>
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
      <CollegeEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
      <CollegeInfoModal
        show={modalShowInfo}
        onHide={() => setModalShowInfo(false)}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default CollegeTable;
