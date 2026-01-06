import { MDBDataTableV5 } from "mdbreact";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import _ from "underscore";
import { readStudentData } from "./Student_APIs";
import studentTable from 

export default function Basic() {
  const [datatable, setDatatable] = React.useState({
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
        label: "Roll No.",
        field: "rollno",
        sort: "asc",
        width: 100,
      },
      {
        label: "Branch",
        field: "branch",
        width: 200,
      },
      {
        label: "Batch",
        field: "batch",
        width: 200,
      },
      {
        label: "View Details",
        field: "result",
        sort: "disabled",
        width: 100,
      },
    ],

    rows: [
      {
        name: "Loading...",
        collegeEnrollmentNumber: "Loading...",
        branch: "Loading...",
        batch: "Loading...",
        result: <></>,
      },
    ],
  });

  var [studentData, setStudentData] = useState();
  useEffect(() => {
    try {
      readStudentData().then((data) => {
        setStudentData(data.data);
        setDatatable({
          ...datatable,
          rows: _.map(data.data, (d1: any) => {
            return {
              name: d1.firstName,
              collegeEnrollmentNumber: d1.collegeEnrollmentNumber,
              branch: d1.branch,
              batch: d1.batch,

              result: (
                <Link
                  to={{
                    pathname: "/studentprofile",
                    search:
                      "?collegeEnrollmentNumber=" + d1.collegeEnrollmentNumber,
                  }}
                >
                  View Student Profile
                </Link>
              ),
            };
          }),
        });
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

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
    <MDBDataTableV5
      hover
      entriesOptions={[5, 20, 25]}
      entries={25}
      pagesAmount={4}
      data={datatable}
    />
  );
}
