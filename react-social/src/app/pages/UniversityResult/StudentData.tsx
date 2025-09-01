import { MDBDataTableV5 } from "mdbreact";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
// var _ = require('underscore');
import _ from "underscore";
const API_URL_OK = process.env.REACT_APP_API_URL;

export default function Basic() {
  const [autorized, setAutorized] = useState(true);
  const location = useLocation();
  // const { currentUser } = useAuth();
  // const roles = currentUser?.authorityUrls;

  // if (_.contains(currentUser!.authorityUrls!, location.pathname)) {
    // setAutorized(true);
  // }

  const API_URL = API_URL_OK + "/getmarks";
  var [data1, setData1] = useState();
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
        label: "Course",
        field: "course",
        width: 270,
      },
      {
        label: "Branch",
        field: "branch",
        width: 200,
      },
      {
        label: "Roll No.",
        field: "rollno",
        sort: "asc",
        width: 100,
      },
      {
        label: "No. Of Semester",
        field: "semester",
        sort: "asc",
        width: 100,
      },
      {
        label: "Total Marks",
        field: "marks",
        sort: "asc",
        width: 100,
      },

      {
        label: "View Result",
        field: "result",
        sort: "disabled",
        width: 100,
      },
    ],

    rows: [
      {
        name: "Loading...",
        course: "Loading...",
        branch: "Loading...",
        rollno: "Loading...",
        semester: "Loading...",
        marks: "Loading...",
        result: <></>,
      },
    ],
  });
  useEffect(() => {
    fetch(API_URL, {
      method: "get",
    })
      .then((response) => {
        return response.json();
      })
      .then((responseJSON) => {
        console.log(responseJSON);
        setData1(responseJSON);
        setDatatable({
          ...datatable,
          rows: _.map(responseJSON, (d1: any) => {
            return {
              name: d1.name,
              course: d1.course.split(")")[1],
              branch: d1.branch.split(")")[1],
              rollno: d1.rollno,
              semester: d1.result.length,
              marks: "10",
              result: (
                <Link
                  to={{
                    pathname: "/student/university/result",
                    search: "?rollno=" + d1.rollno,
                  }}
                >
                  View Result
                </Link>
              ),
            };
          }),
        });
      });

    // .catch((error) => {
    //   console.error(error);
    //   window.location.replace("/error");
    // });
  }, []);

  // if (!autorized) {
  //   return <Error500 />;
  // }

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
