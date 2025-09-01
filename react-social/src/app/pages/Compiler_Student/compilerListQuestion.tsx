// import { MDBDataTableV5 } from "mdbreact";
import MUIDataTable from "mui-datatables";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import _ from "underscore";
import { readAllCompilerQuestions } from "./compiler_APIs";

const API_URL = process.env.REACT_APP_API_URL ;

const columns = [
  {
    name: "id",
    label: "Id",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "codingQuestion",
    label: "Coding Question",
    options: {
      filter: true,
      sort: true,
    },
  },
  {
    name: "questionHeading",
    label: "Question Heading",
    options: {
      filter: true,
      sort: true,
    },
  },
  {
    name: "questionUrl",
    label: "Question Url",
    options: {
      filter: true,
      sort: false,
    },
  },
  {
    name: "action",
    label: "Action",
    options: {
      filter: false,
      sort: false,
    },
  },
];

export default function Basic() {
  var t:any[] = [];
  const [loading, setloading] = useState(false);
  var [questionData, setQuestionData] = useState(t);

  useEffect(() => {
    setloading(true);
    try {
      readAllCompilerQuestions().then((data:any) => {
        setQuestionData(
          _.map(data.data, (val) => {
            val.action = (
              <Link
                to={{
                  pathname: "/compiler/compiler-edit",
                  search: "?id=" + val.id,
                }}
              >
                View Details
              </Link>
            );
            return val;
          })
        );

        setloading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  const options = {
    filterType: "checkbox",
    setRowProps: (rowData) => {
      return {
        style: {
          backgroundColor: rowData[6] === "SU" ? "#FFF8DD" : "#ffffff",
        },
      };
    },
  };

  // useEffect(() => {

  //   fetch('https://kccitm.api.easylearning.guru/student/getmarks', {
  //     method: 'get'
  //   })
  //     .then((response) => {
  //       return response.json();
  //     }).then((responseJSON) => {
  //       console.log(responseJSON, "hey data")
  //       setData1(responseJSON)
  //       setDatatable({
  //         ...datatable, rows: _.map(responseJSON, (d1: any) => {

  //           return {
  //             name: d1.name,
  //             rollno: d1.rollno,
  //             branch: d1.branch.split(")")[1],
  //             batch: d1.result[0].session,
  //             result: <Link to={{ pathname: "/student-details", search: "?rollno=" + d1.rollno }} >View Details</Link>
  //           }
  //         })
  //       })

  //     })

  //     .catch((err) => {
  //       console.log(err)
  //     })
  // },
  //  [])

  return (
    <>
      {loading && (
        <div className="card p-8 mb-10 mt-5">
          <span className="indicator-progress" style={{ display: "block" }}>
            Please wait...{" "}
            <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
          </span>
        </div>
      )}
      {!loading && (
        <MUIDataTable
          className="p-8 mb-10 mt-5"
          title={"Registrations List"}
          data={questionData}
          columns={columns}
          options={options}
        />
      )}
    </>
  );
}
