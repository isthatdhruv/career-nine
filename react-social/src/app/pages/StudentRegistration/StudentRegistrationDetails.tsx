// import { MDBDataTableV5 } from "mdbreact";
import MUIDataTable from "mui-datatables";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import _ from "underscore";
import {
  ReadBatchByIdData,
  ReadBranchByIdData,
  readStudentData,
  sendStudnetIdEmail,
  getAllBatchDataFromStudnet,
  getAllBranchDataFromStudnet,
  sendStudnetIdEmailExisting,
  getGoogleEmailStatus,
  updateGoogleMailCheck,
} from "./Student_APIs";
import { Button } from "react-bootstrap";

const API_URL = process.env.REACT_APP_API_URL;

const columns = [
  {
    name: "google",
    label: "Google",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "googleData",
    label: "Google Email :",
    options: {
      filter: true,
      sort: false,
      display: false,
    },
  },
  {
    name: "name",
    label: "Name",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "rollno",
    label: "Roll No.",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "fathername",
    label: "Father Name",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "branch",
    label: "Branch :",
    options: {
      filter: true,
      sort: true,
    },
  },
  {
    name: "batch",
    label: "Batch :",
    options: {
      filter: true,
      sort: false,
    },
  },
  {
    name: "officialEmailAddress",
    label: "Official Email",
    options: {
      filter: false,
      sort: false,
    },
  },
  {
    name: "details",
    label: "Details",
    options: {
      filter: false,
      sort: false,
    },
  },
  {
    name: "statusData",
    label: "Status :",
    options: {
      filter: true,
      sort: false,
      display: false,
    },
  },
  {
    name: "status",
    label: "Status",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "email",
    label: "Email",
    options: {
      filter: false,
      sort: true,
    },
  },
];

export default function Basic() {
  const [loading, setloading] = useState(false);
  var [studentData, setStudentData] = useState([]);
  const [mailButtonLoading, setMailButtonLoading] = useState(false);
  var [mailButtonLoadingId, setMailButtonLoadingId] = useState([]);
  const [officialEmailAddressValue, setOfficialEmailAddressValue] =
    useState("");

  useEffect(() => {
    setloading(true);
    try {
      readStudentData()
        .then(async (data) => {
          console.log(data);
          var course = _.unique(
            _.map(data.data, (data) => {
              return data.course;
            })
          );

          var batch = _.unique(
            _.map(data.data, (data) => {
              return data.batch_id;
            })
          );

          var branch = _.unique(
            _.map(data.data, (data) => {
              return data.branch_id;
            })
          );

          const responses_batch = await getAllBatchDataFromStudnet(batch);
          const results_batch = _.map(
            responses_batch,
            (response) => response.data
          );

          const responses_branch = await getAllBranchDataFromStudnet(branch);
          const results_branch = _.map(
            responses_branch,
            (response) => response.data
          );

          _.each(data.data, (data) => {
            // console.log(results_batch);
            data.batchData = _.find(results_batch, (data_batch) => {
              if (data_batch.batchId == data.batch_id) return data_batch;
            }).batchEnd;
            data.branchData = _.find(results_branch, (data_branch) => {
              if (data_branch.branchId == data.branch_id) return data_branch;
            }).branchName;
            // console.log(data.officialEmailAddress);
          });

          setStudentData(data.data);

          setloading(false);
          // var tempData: [any] = [data.data[0]];
          // for (var tempDatao in tempData) {
          //   if (
          //     tempDatao.officialEmailAddress !== "" ||
          //     tempDatao.officialEmailAddress !== null ||
          //     tempDatao.officialEmailAddress !== "null"
          //   ) {
          //     getGoogleEmailStatus(tempDatao.officialEmailAddress)
          //       .then((data1) => {
          //         if (data1.data.length > 0) {
          //           tempDatao.google = "true";
          //         } else {
          //           tempDatao.google = "false";
          //           // setStudentData(data.data);
          //         }
          //       })
          //       .catch(() => {
          //         tempDatao.google = "false";
          //         // setStudentData(data.data);
          //       });
          //   }
          // }
          // var t = _.each(tempData, (data) => {});
          // setStudentData(t);
        })
        .catch((error) => {
          console.error(error);
          window.location.replace("/error");
        });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  const tableData = _.map(studentData, (data: any) => {
    return {
      google: !data.google ? (
        <>
          <span className="indicator-progress" style={{ display: "block" }}>
            Email Not Genrated <span className="error align-middle ms-2"></span>
          </span>
        </>
      ) : "" || data.google ? (
        <>
          <>
            <span className="indicator-progress" style={{ display: "block" }}>
              Email Genrated <span className="right align-middle ms-2"></span>
            </span>
          </>
        </>
      ) : (
        ""
      ),
      googleData: data.google ? "Genrated" : "Not Genrated",
      name: data.firstName,
      rollno: data.collegeEnrollmentNumber,
      fathername: data.fatherName,
      branch: data.branchData,
      batch: data.batchData,
      details: (
        <>
          <Link
            to={{
              pathname: "/registrar/verification",
              search:
                "?collegeEnrollmentNumber=" + data.collegeEnrollmentNumber,
            }}
          >
            View Details
          </Link>
        </>
      ),
      officialEmailAddress: (
        <input
          type="text"
          className="form-control form-control-solid"
          defaultValue={data.officialEmailAddress}
          onChange={(data) => setOfficialEmailAddressValue(data.target.value)}
          id={data.college_identification_number}
        />
      ),
      // statusData: data.generate,
      statusData:
        data.generate == "SI"
          ? "Initial Registrations"
          : "" || data.generate == "RA"
          ? "Registrar Accepted"
          : "" || data.generate == "RR"
          ? "Registrar Rejected"
          : "" || data.generate == "MS"
          ? "Mail Sent"
          : "" || data.generate == "SU"
          ? "Student Updated"
          : "",
      status: (
        <>
          {data.generate == "RA" && (
            <span className="badge badge-light-success">Accepted</span>
          )}
          {data.generate == "MS" && (
            <span className="badge badge-light-success">Mail Sent</span>
          )}
          {data.generate == "SU" && (
            <span className="badge badge-light-warning">Student Updated</span>
          )}
          {data.generate == "RR" && (
            <span className="badge badge-light-danger">Rejected</span>
          )}
        </>
      ),
      email: (
        <>
          {_.contains(mailButtonLoadingId, data.collegeEnrollmentNumber) && (
            <button
              className="btn btn-primary btn-lg btn-block"
              type="button"
              disabled
            >
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
              Loading...
            </button>
          )}
          {!_.contains(mailButtonLoadingId, data.collegeEnrollmentNumber) &&
            data.generate == "RA" &&
            data.officialEmailAddress == null && (
              <Button
                type="submit"
                onClick={() => {
                  // setMailButtonLoading(true);
                  const dataLoading: any = [
                    ...mailButtonLoadingId,
                    data.collegeEnrollmentNumber,
                  ];
                  setMailButtonLoadingId(dataLoading);
                  sendStudnetIdEmail(data.collegeEnrollmentNumber).then(
                    (data1) => {
                      const newArray = mailButtonLoadingId.filter(
                        (item) => item !== data.collegeEnrollmentNumber
                      );
                      setMailButtonLoadingId(newArray);
                      console.log(mailButtonLoadingId);
                    }
                  );
                }}
                className="btn btn-sm btn-primary p-2"
              >
                {" "}
                Send Welcome Mail
              </Button>
            )}
          {!_.contains(mailButtonLoadingId, data.collegeEnrollmentNumber) &&
            data.officialEmailAddress != null &&
            data.generate != "RR" && (
              <Button
                type="submit"
                onClick={() => {
                  // setMailButtonLoading(true);
                  const dataLoading: any = [
                    ...mailButtonLoadingId,
                    data.collegeEnrollmentNumber,
                  ];
                  setMailButtonLoadingId(dataLoading);
                  sendStudnetIdEmailExisting(data.collegeEnrollmentNumber).then(
                    () => {
                      const newArray = mailButtonLoadingId.filter(
                        (item) => item !== data.collegeEnrollmentNumber
                      );
                      setMailButtonLoadingId(newArray);
                      console.log(mailButtonLoadingId);
                    }
                  );
                }}
                className="btn btn-sm btn-primary p-2"
              >
                {" "}
                Send ID Again
              </Button>
            )}

          {!_.contains(mailButtonLoadingId, data.collegeEnrollmentNumber) &&
            data.officialEmailAddress != null &&
            data.generate == "RR" && (
              <Button
                type="submit"
                onClick={() => {
                  // setMailButtonLoading(true);
                  const dataLoading: any = [
                    ...mailButtonLoadingId,
                    data.collegeEnrollmentNumber,
                  ];
                  setMailButtonLoadingId(dataLoading);
                  sendStudnetIdEmailExisting(data.collegeEnrollmentNumber).then(
                    () => {
                      const newArray = mailButtonLoadingId.filter(
                        (item) => item !== data.collegeEnrollmentNumber
                      );
                      setMailButtonLoadingId(newArray);
                    }
                  );
                }}
                className="btn btn-sm btn-primary p-2"
              >
                {" "}
                Send Reminder
              </Button>
            )}
        </>
      ),
    };
  });

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
      <Button
        onClick={() => {
          updateGoogleMailCheck().then((data) => {
            console.log(data);
          });
        }}
      >
        Click Me
      </Button>
      {/* {mailButtonLoading && (
        <div className="card p-8 mb-10 mt-5">
          <span className="indicator-progress" style={{ display: "block" }}>
            Sending mail please wait...{" "}
            <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
          </span>
        </div>
      )} */}
      {!loading && (
        <MUIDataTable
          className="p-8 mb-10 mt-5"
          title={"Registrations List"}
          data={tableData}
          columns={columns}
          options={options}
        />
      )}
    </>
  );
}
