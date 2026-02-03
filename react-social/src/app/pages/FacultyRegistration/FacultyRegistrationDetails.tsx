// import { MDBDataTableV5 } from "mdbreact";
import MUIDataTable from "mui-datatables";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import _ from "underscore";
import { ReadFacultyByIdData, readFacultyData } from "./Faculty_APIs";
import { Button } from "react-bootstrap";
import { sendFacultyIdEmail } from "./Faculty_APIs";
// import $ from 'jquery';

const API_URL = process.env.REACT_APP_API_URL;

const columns = [
  {
    name: "name",
    label: "Name",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "college_identification_number",
    label: "college Identification Number",
    options: {
      filter: false,
      sort: true,
    },
  },
  {
    name: "father_husband_name",
    label: "Father/Husband's Name",
    options: {
      filter: false,
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
    name: "designationData",
    label: "Designation :",
    options: {
      filter: true,
      sort: false,
      display: false,
    },
  },
  {
    name: "departmentData",
    label: "Department :",
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
      sort: false,
    },
  },
  {
    name: "email",
    label: "Email",
    options: {
      filter: false,
      sort: false,
    },
  },
];

export default function Basic() {
  const [loading, setloading] = useState(false);
  var [facultyData, setFacultyData] = useState([]);
  const [mailButtonLoading, setMailButtonLoading] = useState(false);
  const [officialEmailAddressValue, setOfficialEmailAddressValue] =
    useState("");

  useEffect(() => {
    setloading(true);
    try {
      readFacultyData().then(async (data) => {
        for (var i = 0; i < data.data.length; i++) {
          var facultyData = await ReadFacultyByIdData(
            data.data[i].collegeIdentificationNumber
          )
            .then((data) => {
              return data.data.faculty;
            })
            .catch((error) => {
              console.error(error);
              window.location.replace("/error");
            });

          data.data[i].facultyData = facultyData;
        }
        setFacultyData(data.data);

        setloading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  const tableData = _.map(facultyData, (data: any) => {
    return {
      name: data.firstName,
      college_identification_number: data.collegeIdentificationNumber,
      father_husband_name: data.father_husband_name,
      details: (
        <>
          <Link
            to={{
              pathname: "/registrar/verification/faculty",
              search:
                "?college_identification_number=" +
                data.collegeIdentificationNumber,
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
      statusData:
        data.generate == "FI"
          ? "Initial Registrations"
          :  data.generate == "RA"
          ? "Registrar Accepted"
          : data.generate == "RR"
          ? "Registrar Rejected"
          :  data.generate == "MS"
          ? "Mail Sent"
          : data.generate == "FU"
          ? "Faculty Updated"
          : "",
      designationData: data.designation,
      departmentData: data.department,
      status: (
        <>
          {data.generate == "RA" && (
            <span className="badge badge-light-success">Accepted</span>
          )}
          {data.generate == "MS" && (
            <span className="badge badge-light-success">Mail Sent</span>
          )}
          {data.generate == "FU" && (
            <span className="badge badge-light-warning">Faculty Updated</span>
          )}
          {data.generate == "RR" && (
            <span className="badge badge-light-danger">Rejected</span>
          )}
        </>
      ),
      email: (
        <>
          {
            <Button
              type="submit"
              onClick={() => {
                setMailButtonLoading(true);
                sendFacultyIdEmail(
                  data.collegeIdentificationNumber,
                  officialEmailAddressValue
                ).then((data) => {
                  console.log(data);
                  setMailButtonLoading(false);
                  setOfficialEmailAddressValue("");
                });
                $("." + data.college_identification_number + "").val();
              }}
              className="btn btn-sm btn-primary p-3"
            >
              {" "}
              {!mailButtonLoading && <span>Send Mail</span>}
              {mailButtonLoading && (
                <span
                  className="indicator-progress"
                  style={{ display: "block" }}
                >
                  Please wait...{" "}
                  <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                </span>
              )}
            </Button>
          }
        </>
      ),
    };
  });

  const options = {
    filterType: "checkbox",
    setRowProps: (rowData) => {
      return {
        style: {
          backgroundColor:
            rowData[4] === "Faculty Updated" ? "#FFF8DD" : "#ffffff",
        },
      };
    },
  };

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
          data={tableData}
          columns={columns}
          options={options}
        />
      )}
    </>
  );
}
