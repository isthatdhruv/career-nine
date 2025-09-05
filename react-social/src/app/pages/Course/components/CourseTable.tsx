import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { Link } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteCourseData } from "../API/Course_APIs";
import CourseEditModal from "./CourseEditModal";

const CourseTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState({
    courseName: "",
    courseCode: "",
    abbreviation: "",
    instituteId: "",
  });

  const datatable = {
    columns: [
      {
        label: "Name",
        field: "name",
        width: 100,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Abbreviation",
        field: "abbreviation",
        sort: "asc",
        width: 100,
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
            name: data.courseName,
            abbreviation: data.abbreviation,
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
                    DeleteCourseData(data.courseCode).then(() => {
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
                  to="/branch"
                  state={{
                    courseId: data.courseCode,
                    course: data.abbreviation,
                  }}
                  className="btn btn-sm btn-info"
                >
                  Add Branch
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
      <CourseEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default CourseTable;
