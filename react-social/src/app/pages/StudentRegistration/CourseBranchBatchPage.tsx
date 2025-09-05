import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import * as Yup from "yup";
import { ReadCategoryData, ReadStudentByIdData } from "./Student_APIs";

const studnetSchema = Yup.object().shape({
  batch: Yup.string().required("Batch is required"),
  branch: Yup.string().required("Branch is required"),
  Course: Yup.string().required("Course is required"),
});

const StudentDetails = () => {
  const [genderData, setGenderData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [courseData, setCourseData] = useState({
    instituteCode: 492,
    display: true,
    instituteAddress: "Greator Noida",
    instituteName: "KCC Institute of Technology & Management",
    instituteCourse: [
      {
        courseCode: 1,
        courseName: "Bachelor of Technology",
        abbreviation: "B.Tech",
        instituteId: 492,
        instituteIdDetail: null,
        instituteBranchs: [
          {
            branchId: 1,
            branchName: "Computer Science and Engineering",
            courseId: 1,
            abbreviation: "CSE",
            shift: "Shift I",
            totalIntake: "120",
            instituteBranchBatchMapping: [
              {
                mapId: 1,
                display: false,
                batchId: 1,
                branchId: 1,
                instituteBatch: {
                  batchId: 1,
                  batchDuration: 4,
                  batchDurationType: "year",
                  batchEnd: "2023",
                  batchStart: "2019",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 13,
                display: null,
                batchId: 11,
                branchId: 1,
                instituteBatch: {
                  batchId: 11,
                  batchDuration: 4,
                  batchDurationType: "",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: false,
                },
              },
              {
                mapId: 14,
                display: null,
                batchId: 11,
                branchId: 1,
                instituteBatch: {
                  batchId: 11,
                  batchDuration: 4,
                  batchDurationType: "",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: false,
                },
              },
              {
                mapId: 15,
                display: null,
                batchId: 12,
                branchId: 1,
                instituteBatch: {
                  batchId: 12,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 16,
                display: null,
                batchId: 13,
                branchId: 1,
                instituteBatch: {
                  batchId: 13,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
          {
            branchId: 5,
            branchName:
              "Computer Science And Engineering(Artificial Intelligence & Machine Learning) ",
            courseId: 1,
            abbreviation: "CSE-AI/ML",
            shift: "Shift I",
            totalIntake: "120",
            instituteBranchBatchMapping: [
              {
                mapId: 30,
                display: null,
                batchId: 27,
                branchId: 5,
                instituteBatch: {
                  batchId: 27,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 31,
                display: null,
                batchId: 28,
                branchId: 5,
                instituteBatch: {
                  batchId: 28,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
          {
            branchId: 6,
            branchName: "Computer Science And Engineering(Data Science)",
            courseId: 1,
            abbreviation: "CSE-DS",
            shift: "Shift I",
            totalIntake: "120",
            instituteBranchBatchMapping: [
              {
                mapId: 28,
                display: null,
                batchId: 25,
                branchId: 6,
                instituteBatch: {
                  batchId: 25,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 29,
                display: null,
                batchId: 26,
                branchId: 6,
                instituteBatch: {
                  batchId: 26,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
          {
            branchId: 7,
            branchName: "Computer Science And Engineering(Internet Of Things)",
            courseId: 1,
            abbreviation: "CSE-IOT",
            shift: "Shift I",
            totalIntake: "60",
            instituteBranchBatchMapping: [
              {
                mapId: 26,
                display: null,
                batchId: 23,
                branchId: 7,
                instituteBatch: {
                  batchId: 23,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 27,
                display: null,
                batchId: 24,
                branchId: 7,
                instituteBatch: {
                  batchId: 24,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
          {
            branchId: 8,
            branchName: "Information Technology",
            courseId: 1,
            abbreviation: "IT",
            shift: "Shift I",
            totalIntake: "60",
            instituteBranchBatchMapping: [
              {
                mapId: 20,
                display: null,
                batchId: 17,
                branchId: 8,
                instituteBatch: {
                  batchId: 17,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2023",
                  batchStart: "2019",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 21,
                display: null,
                batchId: 18,
                branchId: 8,
                instituteBatch: {
                  batchId: 18,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 22,
                display: null,
                batchId: 19,
                branchId: 8,
                instituteBatch: {
                  batchId: 19,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
          {
            branchId: 9,
            branchName: "Civil Engineering",
            courseId: 1,
            abbreviation: "CE",
            shift: "Shift I",
            totalIntake: "60",
            instituteBranchBatchMapping: [],
            display: true,
          },
          {
            branchId: 10,
            branchName: "Electrical Engineering",
            courseId: 1,
            abbreviation: "EE",
            shift: "Shift I",
            totalIntake: "30",
            instituteBranchBatchMapping: [],
            display: true,
          },
          {
            branchId: 11,
            branchName: "Electronics and Communication Engineering",
            courseId: 1,
            abbreviation: "ECE",
            shift: "Shift I",
            totalIntake: "80",
            instituteBranchBatchMapping: [
              {
                mapId: 23,
                display: null,
                batchId: 20,
                branchId: 11,
                instituteBatch: {
                  batchId: 20,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2023",
                  batchStart: "2019",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 24,
                display: null,
                batchId: 21,
                branchId: 11,
                instituteBatch: {
                  batchId: 21,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 25,
                display: null,
                batchId: 22,
                branchId: 11,
                instituteBatch: {
                  batchId: 22,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
          {
            branchId: 12,
            branchName: "Mechanical Engineering",
            courseId: 1,
            abbreviation: "ME",
            shift: "Shift I",
            totalIntake: "60",
            instituteBranchBatchMapping: [
              {
                mapId: 17,
                display: null,
                batchId: 14,
                branchId: 12,
                instituteBatch: {
                  batchId: 14,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2023",
                  batchStart: "2019",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 18,
                display: null,
                batchId: 15,
                branchId: 12,
                instituteBatch: {
                  batchId: 15,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2024",
                  batchStart: "2020",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
              {
                mapId: 19,
                display: null,
                batchId: 16,
                branchId: 12,
                instituteBatch: {
                  batchId: 16,
                  batchDuration: 4,
                  batchDurationType: "Year",
                  batchEnd: "2025",
                  batchStart: "2021",
                  instituteBranchIdDetails: null,
                  instituteSessions: null,
                  display: true,
                },
              },
            ],
            display: true,
          },
        ],
        display: true,
      },
    ],
  });
  const [courseDataOptions, setCourseDataOptions] = useState([]);
  const [courseValue, setCourseValue] = useState(0);
  const [branchData, setBranchData] = useState([]);
  const [branchDataOptions, setBranchDataOptions] = useState([]);
  const [branchValue, setBranchValue] = useState(0);
  const [BatchDataOptions, setBatchDataOptions] = useState([]);
  const [boardData, setBoardData] = useState([]);
  const [batchData, setBatchData] = useState([]);
  const [BatchOptionsNull, setBatchOptionsNull] = useState(false);

  const loc = useLocation();
  var [searchParams] = useSearchParams();
  var studnet_id = searchParams.get("collegeEnrollmentNumber");

  var initialValues: any = {
    branch: "",
    batch: "",
    Course: "",
    courseData: { courseName: "", courseCode: "" },
    branchData: { branchName: "", branchId: "" },
  };

  const [loading, setloading] = useState(false);
  const [isRegrstrar, setIsRegistrar] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    // validationSchema: studnetSchema,

    onSubmit: (values, { setStatus, setSubmitting }) => {
      // try {
      //   upsertStudentData(values).then((data) => {
      //     console.log(data);
      //     window.location.replace("/thankyou");z
      //   });
      // } catch (error) {
      //   console.log("error");
      //   window.location.replace("/error");
      // }

      // formik.resetForm();
    },
  });

  useEffect(() => {
    if (loc.pathname == "/registrar/page") {
      setIsRegistrar(true);
      setloading(true);
      ReadStudentByIdData(studnet_id).then((data1) => {
        formik.setValues(data1.data);

        setloading(false);
      });
    }

    ReadCategoryData().then((data) => {
      setCategoryData(data.data);
    });
  }, []);

  const optionsCategory = categoryData.map((data: any) => {
    return { label: data.name, value: data.id };
  });

  const optionsbranch = branchData.map((data: any) => {
    return { label: data.name, value: data.id };
  });

  const optionsBoard = boardData.map((data: any) => {
    return { label: data.name, value: data.id };
  });

  return (
    <div className="container">
      <div className="card p-8 mb-10 mt-5">
        <div className="text-center border-0 mt-5 mb-3 pt-5">
          <h3
            className="card-title align-items-center flex-column"
            style={{ margin: "0px auto" }}
          >
            <span
              className="card-label fw-bolder m-3"
              style={{ fontSize: "3vmax" }}
            >
              <strong>Student Details</strong>
            </span>
          </h3>
        </div>

        <form
          style={{ color: "rgb(126, 30, 30)" }}
          className="form fv-plugins-bootstrap5 fv-plugins-framework"
          onSubmit={formik.handleSubmit}
        >
          <div className="row g-9 mb-8 mt-1">
            <div className="col-md-4 fv-row fv-plugins-icon-container">
              <label className="required fs-6 fw-bold mb-2">
                <strong>Course : </strong>
              </label>
              <div className="jhg h" style={{ width: "100%" }}>
                <select
                  value={formik.values.courseData.courseCode}
                  onChange={(data: any) => {
                    setBranchDataOptions([]);
                    setCourseValue(data.value);
                    formik.setFieldValue("Course", data.value);
                    var t: any = courseData.instituteCourse.filter((c) => {
                      return c.courseCode == data.target.value;
                    });
                    setBranchDataOptions(t[0].instituteBranchs);
                  }}
                  onClick={(data: any) => {
                    setBranchDataOptions([]);
                    setCourseValue(data.target.value);
                    formik.setFieldValue("Course", data.target.value);
                    var t: any = courseData.instituteCourse.filter((c) => {
                      return c.courseCode == data.target.value;
                    });
                    setBranchDataOptions(t[0].instituteBranchs);
                  }}
                  className={clsx(
                    "form-select form-select-solid form-select-lg",
                    {
                      "is-invalid text-danger": formik.errors.Course,
                    },
                    {
                      "is-valid": !formik.errors.Course,
                    }
                  )}
                >
                  {/* <option value={formik.values.courseData.courseCode} disabled>{formik.values.courseData.courseName}</option> */}
                  {courseData.instituteCourse.map((course: any) => (
                    <>
                      <option value={course.courseCode}>
                        {course.courseName}
                      </option>
                    </>
                  ))}
                </select>

                {formik.touched.Course && formik.errors.Course && (
                  <>{formik.errors.Course}</>
                )}
              </div>
            </div>

            <div className="col-md-4 fv-row fv-plugins-icon-container">
              <label className="required fs-6 fw-bold mb-2">
                <strong>Branch :</strong>
              </label>
              <div className="jhg h" style={{ width: "100%" }}>
                <select
                  value={formik.values.branchData.branchId}
                  onChange={(data: any) => {
                    setBranchValue(data.value);
                    formik.setFieldValue("branch", data.value);
                  }}
                  onClick={(data: any) => {
                    var t: any = courseData.instituteCourse.filter((c) => {
                      return formik.values.Course == c.courseCode;
                    });

                    var g: any = t[0].instituteBranchs.filter(
                      (c) => c.branchId == data.target.value
                    );
                    setBatchDataOptions(g[0].instituteBranchBatchMapping);
                  }}
                  className={clsx(
                    "form-select form-select-solid form-select-lg",
                    {
                      "is-invalid text-danger": formik.errors.branch,
                    },
                    {
                      "is-valid": !formik.errors.branch,
                    }
                  )}
                >
                  {/* <option value={formik.values.courseData.courseCode} disabled>{formik.values.courseData.courseName}</option> */}
                  {branchDataOptions.map((branch: any) => (
                    <>
                      <option value={branch.branchId}>
                        {branch.branchName}
                      </option>
                    </>
                  ))}
                </select>
                {formik.touched.branch && formik.errors.branch && (
                  <>{formik.errors.branch}</>
                )}
              </div>
            </div>

            <div className="col-md-4 fv-row fv-plugins-icon-container">
              <label className="required fs-6 fw-bold mb-2">
                <strong>Batch : </strong>
              </label>
              <div className="jhg h" style={{ width: "250px" }}>
                {/* {isRegrstrar && !BatchOptionsNull && (
                  <Select
                    closeMenuOnSelect={true}
                    options={BatchDataOptions}
                    defaultValue={batchOption}
                    placeholder="Select Batch"
                    loadingMessage={() => "Fetching Batch"}
                    noOptionsMessage={() => "No Batch Available"}
                    onChange={(data: any) => {
                      formik.setFieldValue("batch", data.value);
                    }}
                  />
                )} */}
                {formik.touched.batch && formik.errors.batch && (
                  <>{formik.errors.batch}</>
                )}
                {/* {!isRegrstrar && BatchOptionsNull && ( */}
                <select
                  // value={formik.values.batchData.batchId}
                  onChange={(data: any) => {
                    formik.setFieldValue("batch", data.value);
                  }}
                  className={clsx(
                    "form-select form-select-solid form-select-lg",
                    {
                      "is-invalid text-danger": formik.errors.batch,
                    },
                    {
                      "is-valid": !formik.errors.batch,
                    }
                  )}
                >
                  {/* <option value={formik.values.courseData.courseCode} disabled>{formik.values.courseData.courseName}</option> */}
                  {BatchDataOptions.map((batch: any) => (
                    <>
                      <option value={batch.batchId}>
                        {batch.instituteBatch.batchEnd}
                      </option>
                    </>
                  ))}
                </select>
                {/* )} */}
              </div>
            </div>
          </div>

          {formik.isSubmitting ||
            (!formik.isValid &&
              Object.values(formik.errors).map((error) => (
                <div>{error?.toString()}</div>
              )))}
          <div className="text-center mt-8 mb-5">
            <button
              type="submit"
              className="btn btn-sm btn-primary btn-active-light-secoundary"
              // disabled={formik.isSubmitting || !formik.isValid}
            >
              {<span className="indicator-label">Submit</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentDetails;
