import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MarksAccordion from "./MarksAccordion";
var _ = require("underscore");
const API_URL_OK = process.env.REACT_APP_API_URL;

const FinalResult: React.FC = () => {
  var [searchParams] = useSearchParams();
  var data = searchParams.get("rollno");
  const API_URL = API_URL_OK + "/getmarks/";
  var [data1, setData1] = useState({
    name: "",
    rollno: "",
    fname: "",
    gender: "",
    branch: "",
    course: "",
    enrollment: "",
    result: [],
  });
  var [semester, setSemester] = useState([]);

  useEffect(() => {
    fetch(API_URL + data, {
      method: "get",
    })
      .then((response: any) => {
        return response.json();
      })
      .then((responseJSON: any) => {
        setData1(responseJSON);
        // console.log(responseJSON.result, "semester")
        setSemester(
          _.pluck(_.sortBy(responseJSON.result, "semester"), "semester")
        );
        // console.log(_.pluck(_.sortBy(responseJSON.result, "semester"),"semester"))
      })

      .catch((error) => {
        console.error(error);
        window.location.replace("/error");
      });
  }, []);

  return (
    <div className="App container">
      <div className="row" style={{ width: "100%" }}>
        <div
          className="bg-primary"
          style={{ padding: "8px ", borderTopLeftRadius: "20px" }}
        >
          <span className="" style={{ fontSize: "15px", color: "white" }}>
            {data1.name}'s RESULT
          </span>
          {/* header */}
        </div>
        {/* header close */}
        <div
          className="d-flex"
          style={{
            border: "1px solid",
            marginBottom: "20px",
            borderBottomRightRadius: "20px",
          }}
        >
          <div className="col-md-9 p-2  ">
            {/* table start */}

            <div className="row p-2">
              <div className="col">
                <strong>Name: </strong>
                {data1.name}
              </div>
              <div className="col">
                {" "}
                <strong>Gender:</strong> {data1.gender}
              </div>
            </div>
            <div className="row p-2">
              <div className="col">
                <strong>Roll No: </strong>
                {data1.rollno}
              </div>
              <div className="col">
                {" "}
                <strong>Enrollment No.:</strong> {data1.enrollment}
              </div>
            </div>

            <div className="row p-2">
              <div className="col">
                <strong>Father's Name: </strong>
                {data1.fname}
              </div>
            </div>

            <div></div>
          </div>
          <div className="col-md-3 p-2 ">
            <div className="row p-2">
              <img
                src="/media/images.png"
                style={{ height: "100px", width: "100px" }}
              ></img>
            </div>
            {/* table end */}
          </div>
        </div>
        {/* result section */}
        <div
          className="bg-primary"
          style={{
            padding: "8px",
            marginBottom: "8px",
            borderTopLeftRadius: "20px",
          }}
        >
          <span className="" style={{ fontSize: "15px", color: "white" }}>
            ONE VIEW RESULT
          </span>
        </div>
        {/* accordian start */}
        {semester.map((d1: any, index: any) => (
          <MarksAccordion
            key={index}
            sem={d1}
            result={_.filter(data1.result, (finalresul: any) => {
              return finalresul.semester == d1;
            })}
          />
        ))}
      </div>
    </div>
  );
};

export default FinalResult;
