import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AllStudnetUniversityResultTable from "./AllStudnetUniversityResultTable";
import { initDataTable, InitFilterData } from "./initalizeDataTable";
import SubjectUniversityResultTable from "./SubjectUniversityResult";

// var _ = require('underscore');
import _ from "underscore";
import { useAuth } from "../../modules/auth";
import {
  boxes_data,
  branches,
  courses,
  data_end,
  semesters,
  session,
} from "./data";
import DataBoxes from "./DataBoxes";
// import UniversityResultBoxes from "./UniversityResultBoxes";
const API_URL_OK = process.env.REACT_APP_API_URL;

export default function Basic() {
  const [autorized, setAutorized] = useState(true);
  const location = useLocation();
  const { currentUser } = useAuth();
  // const roles = currentUser?.authorityUrls;

  // if (_.contains(currentUser!.authorityUrls!, location.pathname)) {
  //   setAutorized(true);
  // }

  const API_URL = API_URL_OK + "/getmarks";
  var [data1, setData1] = useState();
  var [filterData, setFilterData] = useState(InitFilterData);
  var [finalFilter, setFinalFilter] = useState({});
  var [filterCourseSelected, setfilterCourseSelected] = useState(-1);
  var [filterBranchSelected, setfilterBranchSelected] = useState(-1);
  var [filterSessionSelected, setFilterSessionSelected] = useState(-1);
  var [filterSemester, setFilterSemester] = useState(-1);
  var [studentResult, setStudentResult] = useState({});

  var [finalBoxData, setFinalBoxData] = React.useState({
    boxs_data: [
      {
        heading: "Over All Result",
        box_data: [
          {
            header: "All Cleared %tage",
            body: "",
            footer: 0 + "/" + 0,
          },
          {
            header: "Fail %tage",
            body: "",
            footer: 0 + "/" + 0,
          },
          {
            header: "> 3 backs %tage",
            body: "",
            footer: 0 + "/" + 0,
          },
          {
            header: "Mean",
            body: "",
            footer: "",
          },
          {
            header: "Median",
            body: "",
            footer: "",
          },
          {
            header: "Mode",
            body: "",
            footer: "",
          },
          {
            header: "Highest SGPA",
            body: "",
            footer: "",
          },
          {
            header: "Lowest SGPA",
            body: "",
            footer: "",
          },
        ],
      },
    ],
    data: [{}],
    col_data: [
      {
        name:
          "Loading"
            .toLowerCase()
            .replace(/[^\w\s\d]/g, "-")
            .replace(" ", "-") + "-total",
        label: "Loading total Makrs",
        options: {
          filter: false,
          sort: true,
        },
      },
    ],
  });
  const [datatable, setDatatable] = React.useState(initDataTable);

  const [resultDatatable, setResultDatatable] = React.useState({
    columns: [
      {
        label: "No of Backs",
        field: "number_of_backs",
        width: 150,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Total Number of Students",
        field: "total_number_of_students",
        width: 270,
      },
      {
        label: "Total Number of Pass Students",
        field: "total_number_of_pass_students",
        width: 200,
      },
      {
        label: "Total Number of Failed Students",
        field: "total_number_of_failed_students",
        width: 200,
      },
      {
        label: "Total Number of Pass% Students",
        field: "total_number_of_pass_persetage_students",
        width: 200,
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
        setFilterData(
          data_end(
            courses(responseJSON),
            branches(responseJSON),
            session(responseJSON),
            semesters(responseJSON)
          )
        );
        setData1(responseJSON);
      });
  }, []);
  var resultData = (data, filter1) => {
    // console.log(boxes_data(data, filter1))
    setFinalBoxData(boxes_data(data, filter1));

    // setResultDatatable({
    //   ...resultDatatable,
    //   rows: _.map(backs, (d1: any) => {
    //     var t = filter(data, filter_1, d1);
    //     console.log("This is Filter data 2");
    //     console.log(finalFilter);

    //     setDatatable({
    //       ...datatable,
    //       rows: _.map(t.studnet_data, (d1: any) => {
    //         return {
    //           name: d1.name,
    //           course: d1.course.split(")")[1],
    //           branch: d1.branch.split(")")[1],
    //           rollno: d1.rollno,
    //           semester: d1.semester,
    //           sgpa: d1.sgpa,
    //           result: (
    //             <Link
    //               to={{
    //                 pathname: "/student/university/result",
    //                 search: "?rollno=" + d1.rollno,
    //               }}
    //             >
    //               View Result
    //             </Link>
    //           ),
    //         };
    //       }),
    //     });
    //     return {
    //       number_of_backs: d1,
    //       total_number_of_students: t.total_students,
    //       total_number_of_pass_students: t.carry_paper,
    //       total_number_of_pass_persetage_students:
    //         t.total_pass_percentage.toFixed(2),
    //       total_number_of_failed_students: t.total_number_of_failed_students,
    //     };
    //   }),
    // });
  };
  // if (!autorized) {
  //   return <Error500 />;
  // }

  return (
    <>
      <div className="d-flex flex-column flex-column-fluid">
        <div id="kt_app_toolbar" className="app-toolbar py-3 py-lg-6">
          <div
            id="kt_app_toolbar_container"
            className="app-container d-flex flex-stack container-fluid"
          >
            <div
              id="kt_page_title"
              data-kt-swapper="true"
              data-kt-swapper-mode="prepend"
              data-kt-swapper-parent="{default: '#kt_content_container', 'lg': '#kt_toolbar_container'}"
              className="page-title d-flex flex-wrap me-3 flex-column justify-content-center"
            >
              <h1 className="page-heading d-flex text-dark fw-bold fs-3 my-0 flex-column justify-content-center">
                University Result Dashboard
              </h1>
              <ul className="breadcrumb breadcrumb-separatorless fw-semibold fs-7 my-0">
                <li className="breadcrumb-item">
                  <span className="bullet bg-gray-400 w-5px h-2px"></span>
                </li>
                {/* <li className="breadcrumb-item text-dark">
                  {filterData[filterCourseSelected].name +
                    "-" +
                    filterData[filterCourseSelected].branch[
                      filterBranchSelected
                    ].name +
                    "-" +
                    filterData[filterCourseSelected].branch[
                      filterBranchSelected
                    ].session[filterSessionSelected].name +
                    "-" +
                    filterData[filterCourseSelected].branch[
                      filterBranchSelected
                    ].session[filterSessionSelected].semester[filterSemester]
                      .name}
                </li> */}
              </ul>
            </div>

            <div className="d-flex align-items-center gap-2 gap-lg-3">
              <div className="m-0">
                <a
                  href="#"
                  className="btn btn-sm btn-flex fw-bold bg-body btn-color-gray-700 btn-active-color-primary"
                  data-kt-menu-trigger="click"
                  data-kt-menu-placement="bottom-end"
                >
                  <i className="ki-duotone ki-filter fs-6 text-muted me-1">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Filter
                </a>
                <div
                  className="menu menu-sub menu-sub-dropdown w-250px w-md-300px"
                  data-kt-menu="true"
                >
                  <div className="px-7 py-5">
                    <div className="fs-5 text-dark fw-bolder">
                      Filter Options
                    </div>
                  </div>
                  <div className="separator border-gray-200"></div>
                  <div className="px-7 py-5">
                    {/* //course */}
                    {filterData.length > 0 && (
                      <div className="mb-10">
                        <label className="form-label fw-bold">Courses:</label>
                        <div>
                          <select
                            className="form-select form-select-solid"
                            data-kt-select2="true"
                            data-placeholder="Select option"
                            data-allow-clear="true"
                            value={filterCourseSelected}
                            onChange={(data) => {
                              // console.log(data.target.value);
                              setfilterCourseSelected(
                                parseInt(data.target.value)
                              );
                              setfilterBranchSelected(-1);
                              setFilterSemester(-1);
                              setFilterSessionSelected(-1);
                            }}
                          >
                            <option value={-1}></option>
                            {filterData.map((data: any, key) => (
                              <>
                                <option value={key}>{data.name}</option>
                              </>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* //branch */}

                    {filterCourseSelected > -1 && (
                      <>
                        <div className="mb-10">
                          <label className="form-label fw-bold">
                            Branches:
                          </label>
                          <div>
                            <select
                              className="form-select form-select-solid"
                              data-kt-select2="true"
                              data-placeholder="Select option"
                              data-allow-clear="true"
                              value={filterBranchSelected}
                              onChange={(data) => {
                                // console.log(data.target.value);
                                setfilterBranchSelected(
                                  parseInt(data.target.value)
                                );
                                setFilterSemester(-1);
                                setFilterSessionSelected(-1);
                              }}
                            >
                              <option value={-1}></option>
                              {filterData[filterCourseSelected].branch.map(
                                (data: any, key) => (
                                  <>
                                    <option value={key}>{data.name}</option>
                                  </>
                                )
                              )}
                              {/* <option value={100}>All CSE Branches</option> */}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Session */}
                    {filterBranchSelected > -1 && (
                      <div className="mb-10">
                        <label className="form-label fw-bold">Session:</label>
                        <div>
                          <select
                            className="form-select form-select-solid"
                            data-kt-select2="true"
                            data-placeholder="Select option"
                            data-allow-clear="true"
                            value={filterSessionSelected}
                            onChange={(data) => {
                              // console.log(data.target.value);
                              setFilterSessionSelected(
                                parseInt(data.target.value)
                              );
                              setFilterSemester(-1);
                            }}
                          >
                            <option value={-1}></option>
                            {filterData[filterCourseSelected].branch[
                              filterBranchSelected
                            ].session.map((data: any, key) => (
                              <>
                                <option value={key}>{data.name}</option>
                              </>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Semester */}
                    {filterSessionSelected > -1 && (
                      <div className="mb-10">
                        <label className="form-label fw-bold">Semester:</label>
                        <div>
                          <select
                            className="form-select form-select-solid"
                            data-kt-select2="true"
                            data-placeholder="Select option"
                            data-allow-clear="true"
                            value={filterSemester}
                            onChange={(data) => {
                              // console.log(data.target.value);
                              setFilterSemester(parseInt(data.target.value));
                            }}
                          >
                            <option value={-1}></option>
                            {filterData[filterCourseSelected].branch[
                              filterBranchSelected
                            ].session[filterBranchSelected].semester.map(
                              (data: any, key) => (
                                <>
                                  <option value={key}>{data.name}</option>
                                </>
                              )
                            )}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="d-flex justify-content-end">
                      <button
                        type="reset"
                        className="btn btn-sm btn-light btn-active-light-primary me-2"
                        data-kt-menu-dismiss="true"
                        onClick={() => {
                          setfilterCourseSelected(-1);
                          setfilterBranchSelected(-1);
                          setFilterSemester(-1);
                          setFilterSessionSelected(-1);
                        }}
                      >
                        Reset
                      </button>
                      <button
                        type="submit"
                        className="btn btn-sm btn-primary"
                        data-kt-menu-dismiss="true"
                        onClick={() => {
                          var branch_filter = {};

                          var t: any = {
                            course: filterData[filterCourseSelected].name,
                            branch:
                              filterData[filterCourseSelected].branch[
                                filterBranchSelected
                              ].name,
                            session:
                              filterData[filterCourseSelected].branch[
                                filterBranchSelected
                              ].session[filterSessionSelected].name,
                            semester:
                              filterData[filterCourseSelected].branch[
                                filterBranchSelected
                              ].session[filterSessionSelected].semester[
                                filterSemester
                              ].name,
                          };
                          if (
                            filterData[filterCourseSelected].branch[
                              filterBranchSelected
                            ].name.match("All")
                          ) {
                            var filter: any[] = [];
                            _.each(
                              filterData[filterCourseSelected].branch,
                              (data) => {
                                if (data.name !== "All") filter.push(data.name);
                              }
                            );
                            t.branch_many = filter;
                          }
                          setFinalFilter(t);

                          resultData(data1, t);

                          // console.log();
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* <UniversityResultBoxes data=>


                  </UniversityResultBoxes> */}
        <div id="kt_app_content" className="app-content  flex-column-fluid ">
          <div
            id="kt_app_content_container"
            className="app-container  container-xxxl "
          >
            <SubjectUniversityResultTable
              tableData={finalBoxData.boxs_data}
            ></SubjectUniversityResultTable>
            <AllStudnetUniversityResultTable
              tableData={finalBoxData.data}
              tableCol={finalBoxData.col_data}
            ></AllStudnetUniversityResultTable>
            {/* <div className="card mb-8">
              <div className="card-header border-0 pt-6">
                <div className="card-title">Number of Student Pass</div>
              </div>
              <div className="card-body pt-2 pb-0">
                <MDBDataTableV5
                  className=" mb-10 mt-5"
                  title={"University Result"}
                  data={resultDatatable}
                />
              </div>
            </div>
            <div className="card mb-8">
              <div className="card-header border-0 pt-6">
                <div className="card-title">Total Student Data</div>
              </div>
              <div className="card-body pt-9 pb-0">
                <MDBDataTableV5
                  hover
                  entriesOptions={[5, 20, 25]}
                  entries={25}
                  pagesAmount={4}
                  data={datatable}
                />
              </div>
            </div> */}
            {finalBoxData.boxs_data.map((box, index) => (
              <div className="row gy-5 g-xl-10 mb-8">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title align-items-start flex-column">
                      <span className="card-label fw-bold text-dark">
                        {box.heading}
                      </span>
                    </h3>
                  </div>
                  <div className="card-body row">
                    {box.box_data.map((boxInfo, index) =>
                      boxInfo.body == "NaN" ? (
                        <></>
                      ) : (
                        //
                        <DataBoxes key={index} data={boxInfo}></DataBoxes>
                      )
                      //
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
