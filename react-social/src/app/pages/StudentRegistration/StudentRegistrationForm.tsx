import clsx from "clsx";
import { useFormik } from "formik";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import * as Yup from "yup";
// import { list_of_Document } from "./StudentsConstant";
import {
  ReadBatchData,
  ReadBoardData,
  ReadBranchData,
  ReadCategoryData,
  ReadCourseData,
  ReadCollegeCourseData,
  ReadGenderData,
  ReadStudentByIdData,
  emailChecker,
  fileUpload,
  upsertStudentData,
} from "./Student_APIs";

import Alert from "@mui/material/Alert";
import _ from "lodash";
import moment from "moment";
import { Button } from "react-bootstrap";
import Webcam from "react-webcam";

const API_URL = process.env.REACT_APP_API_URL;

const Img_URL = API_URL + "/util/file-get/getbyname/";

Yup.addMethod(Yup.string, "dobTest", function (errorMessage) {
  return this.test(`test-card-type`, errorMessage, function (value) {
    const { path, createError } = this;

    return (
      moment().diff(moment(value), "years") >= 17 ||
      createError({ path, message: errorMessage })
    );
  });
});
const studnetSchema = Yup.object()
  .shape({
    webcamPhoto: Yup.string().required("Please Use Webcam"),
    firstName: Yup.string().required("First Name is required"),
    lastName: Yup.string().required("Last Name is required"),
    course: Yup.string().required("Course is required"),
    branch_id: Yup.string().required("Branch is required"),
    batch_id: Yup.string().required("Batch is required"),
    phoneNumber: Yup.string()
      .required("Phone Number is required")
      .length(10, "Phone Number must be of 10 digits"),
    dob: Yup.string().required("Date of Birth is required"),
    personalEmailAddress: Yup.string()
      .required("Personal Email Address is required")
      .notOneOf(["Invalid Email", null], "This Email Id is Already In Use"),
    fatherName: Yup.string().required(
      "Father Name is required / If not appicable enter Other Guardian Name"
    ),
    motherName: Yup.string().required(
      "Mother Name is required / If not appicable enter Other Guardian Name"
    ),
    category: Yup.string().required("Category is required"),
    gender: Yup.string().required("Gender is required"),
    aadharCardNo: Yup.string()
      .required("Aadhar Card Number is required")
      .length(12, "Aadhar Card Number must be of 12 digits"),
    fatherPhoneNumber: Yup.string()
      .required("Father Phone Number is required")
      .length(10, "Father Phone Number must be of 10 digits"),
    permanentAddress: Yup.string().required("Permanent Address is required"),
    currentAddress: Yup.string().required("Current Address is required"),
    _0thboard: Yup.string().required("10th Board Name is required"),
    _0thRollNo: Yup.string()
      .required("10th Roll No. is required")
      .max(20, "10th Roll No. must be at most 20 digits"),
    _0thMarks: Yup.string()
      .required("10th Marks is required")
      .max(3, "10th Marks must be at most 3 digits")
      .matches(
        /\b(0*(?:[1-9][0-9]?|100))\b/,
        "10th Marks must be less than 100"
      ),
    _2thboardSS: Yup.string().required("12th Board Name is required"),
    _2thRollNoss: Yup.string()
      .required("12th Roll No. is required")
      .max(20, "12th Roll No. must be at most 20 digits"),
    _2thMarksPhysics: Yup.string()
      .required("12th Physics Marks is required")
      .max(3, "12th Physics Marks must be at most 3 digits")
      .matches(
        /\b(0*(?:[1-9][0-9]?|100))\b/,
        "12th Physics Marks must be less than 100"
      ),
    _2thMarksMaths: Yup.string()
      .required("12th Maths Marks is required")
      .max(3, "12th Maths Marks must be at most 3 digits")
      .matches(
        /\b(0*(?:[1-9][0-9]?|100))\b/,
        "12th Maths Marks be less than 100"
      ),
    _2thMarksChemistry: Yup.string()
      .required("12th Chemistry Marks is required")
      .max(3, "12th Chemistry Marks must be at most 3 digits")
      .matches(
        /\b(0*(?:[1-9][0-9]?|100))\b/,
        "12th Chemistry Marks must be less than 100"
      ),
  })
  .when((values, schema) => {
    if (values._0thboard === "other") {
      return schema.shape({
        other10thBoard: Yup.string().required("Other 10th Board is required"),
      });
    }
  })
  .when((values, schema) => {
    if (values._2thboardSS === "other") {
      return schema.shape({
        other12thBoard: Yup.string().required("Other 12th Board is required"),
      });
    }
  });
const StudentDetails = () => {
  const [genderData, setGenderData] = useState([]);
  const [generate, setGenerate] = useState(true);
  const [categoryData, setCategoryData] = useState([]);
  const [collegeCourseData, setCollegeCourseData] = useState({
    instituteCode: 492,
    display: true,
    instituteAddress: "Knowledge park 3",
    instituteName: "KCC",
    instituteCourse: [
      {
        courseCode: 0,
        courseName: "Loading . . .",
        abbreviation: "",
        instituteId: 0,
        instituteIdDetail: "",
        instituteBranchs: [],
        display: true,
      },
    ],
  });

  const [courseValue, setCourseValue] = useState(0);
  const [courseData, setCourseData] = useState();
  const [branch_idData, setBranch_idData] = useState();
  const [branchData, setBranchData] = useState([]);
  const [branchDataOptions, setBranchDataOptions] = useState([]);
  const [branchValue, setBranchValue] = useState(0);
  const [BatchDataOptions, setBatchDataOptions] = useState([]);
  const [boardData, setBoardData] = useState([]);
  const [batchData, setBatchData] = useState([]);
  const [BatchOptionsNull, setBatchOptionsNull] = useState(false);
  const [groupNameData, setGroupNameData] = useState([]);
  const loc = useLocation();
  var [searchParams] = useSearchParams();
  var studnet_id = searchParams.get("collegeEnrollmentNumber");

  function formikCheck(values) {
    if (
      !values.webcam_photo ||
      !values.first_name ||
      !values.middle_name ||
      !values.last_name ||
      !values.batch ||
      !values.branch ||
      !values.email_address ||
      !values.phone_number ||
      !values.dob ||
      !values.course ||
      !values.father_name ||
      !values.mother_name ||
      !values.category ||
      !values.gender ||
      !values.aadhar_card_no ||
      !values.father_phone_number ||
      !values.permanent_address ||
      !values.current_address ||
      !values._0th_board ||
      !values._0th_roll_no ||
      !values._0th_marks ||
      !values._2th_board_SS ||
      !values._2th_roll_no_ss ||
      !values._2th_marks_chem ||
      !values._2th_marks_maths ||
      !values._2th_marks_physics ||
      !values.sub_category
    ) {
      return true;
    } else {
      return false;
    }
  }

  var initialValues: any = {
    firstName: "",
    middleName: "",
    lastName: "",
    personalEmailAddress: "",
    phoneNumber: "",
    dob: "",
    fatherName: "",
    motherName: "",
    gender: "",
    aadharCardNo: "",
    _0thboard: "",
    _0thRollNo: "",
    _0thMarks: "",
    _2thboardSS: "",
    _2thRollNoss: "",
    _2thMarksChemistry: "",
    _2thMarksMaths: "",
    _2thMarksPhysics: "",
    fatherPhoneNumber: "",
    permanentAddress: "",
    currentAddress: "",
    qualifiedRankLetter: "",
    webcamPhoto: "",
    typeOfStudent: "",
    branch_id: "",
    batch_id: "",
    googleGroup: "",
    course: "",
    counselling: "",
    ews: "",
    courseData: { courseName: "", courseCode: "" },
    branchData: { branchName: "", branchId: "" },
    batchData: { batchName: "", batchId: "" },
    homeBoard12th: "",
    other10thBoard: "",
    other12thBoard: "",
    subCategory: "",
    category: "",
    generate: "SI",
    qualifiedRankLetterPhysical: "",
    studentPhotographPhysical: "",
    aadharCardPhysical: "",
    studentSignaturePhysical: "",
    studentThumbImpressionPhysical: "",
    highSchoolMarksheetPhysical: "",
    highSchoolCertificatePhysical: "",
    intermediateMarksheetPhysical: "",
    intermediateCertificatePhysical: "",
    transferCertificatePhysical: "",
    migrationCertificatePhysical: "",
    allotmentLetterPhysical: "",
    affidavitForGapPhysical: "",
    domicileCertificateUpPhysical: "",
    casteCertificatePhysical: "",
    incomeCertificatePhysical: "",
    check: {
      webcam_photo: true,
      first_name: true,
      middle_name: true,
      last_name: true,
      batch: true,
      branch: true,
      email_address: true,
      phone_number: true,
      dob: true,
      course: true,
      mother_name: true,
      father_name: true,
      category: true,
      gender: true,
      generate: false,
      aadhar_card_no: true,
      father_phone_number: true,
      permanent_address: true,
      current_address: true,
      _0th_board: true,
      _0th_roll_no: true,
      _0th_marks: true,
      _2th_board_SS: true,
      _2th_roll_no_ss: true,
      _2th_marks_physics: true,
      _2th_marks_maths: true,
      _2th_marks_chem: true,

      // homeBoard12th: true,
      // other_10th_board: true,
      // other_12th_board: true,
      sub_category: true,
      qualifiedRankLetter: false,
      studentPhotograph: false,
      aadharCard: false,
      studentSignature: false,
      studentThumbImpression: false,
      highSchoolMarksheet: false,
      highSchoolCertificate: false,
      intermediateMarksheet: false,
      intermediateCertificate: false,
      transferCertificate: false,
      migrationCertificate: false,
      allotmentLetter: false,
      affidavitForGap: false,
      domicileCertificateUp: false,
      casteCertificate: false,
      incomeCertificate: false,
    },
  };

  const [loading, setloading] = useState(false);
  const [other10thBoard, setOther10thBoard] = useState(false);
  const [other12thBoard, setOther12thBoard] = useState(false);
  const [subCategory, setSubCategory] = useState(false);
  const [webcamUnmounted, setWebcamUnmounted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [webCamClicked, setWebCamClicked] = useState(false);
  const [isRegrstrar, setIsRegistrar] = useState(false);
  const [groupNameOptionsData, setGroupNameOptionsData] = useState([]);
  const [courseDataLoading, setCourseDataLoading] = useState(false);
  const search = useLocation().state;

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: studnetSchema,
    onSubmit: (values, { setStatus, setSubmitting }) => {
      setloading(true);

      if (values.officialemailid == null) {
        values.officialemailid = "";
      }

      if (isRegrstrar) {
        if (formikCheck(values.check)) values.generate = "RR";
        else values.generate = "RA";
      }

      try {
        upsertStudentData(values)
          .then(() => {
            if (isRegrstrar)
              window.location.replace("/student/registration-details");
            else window.location.replace("/thankyou");
          })
          .catch((error) => {
            console.error(error);
            setloading(false);
          });
      } catch (error) {
        console.error(error);
        setloading(false);
      }

      // formik.resetForm();
    },
  });

  // function Partial_Save(values: any) {
  //   try {
  //     console.log(values)
  //     upsertStudentData(values).then(() => {
  // alert("Please wait. Don't close the tab")
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     window.location.replace("/error");
  //   }
  // }

  useEffect(() => {
    if (loc.pathname == "/registrar/verification") {
      setIsRegistrar(true);
      setloading(true);
      try {
        ReadStudentByIdData(studnet_id)
          .then((data1) => {
            Object.entries(data1.data.check).forEach(([key, value]) => {
              if (value == false) setGenerate(false);
              else setGenerate(true);
            });
            if (data1.data.other10thBoard == null) {
              data1.data.other10thBoard = "";
            }
            if (data1.data.other12thBoard == null) {
              data1.data.other12thBoard = "";
            }

            if (data1.data.googleGroup != null)
              setGroupNameOptionsData(data1.data.googleGroup.split(","));

            formik.setValues(data1.data);

            setCourseData(data1.data.course);
            setBranch_idData(data1.data.branch_id);

            // if (formik.values._2thboardSS == 4) {
            //   list_of_Document[10].required = false;
            //   list_of_Document[9].required = true;
            // } else {
            //   list_of_Document[9].required = false;
            //   list_of_Document[10].required = true;
            // }

            // formik.values.homeBoard12th
            //   ? (list_of_Document[13].required = false)
            //   : (list_of_Document[13].required = true);

            if (data1.data.category != 1) {
              setSubCategory(true);
            } else {
              setSubCategory(false);
            }

            if (formik.values.other10thBoard != "") {
              setOther10thBoard(true);
            } else {
              setOther10thBoard(false);
            }

            if (formik.values.other12thBoard != "") {
              setOther12thBoard(true);
            } else {
              setOther12thBoard(false);
            }

            // formik.values.ews
            //   ? (list_of_Document[15].required = true)
            //   : (list_of_Document[15].required = false);

            // setlistofDocument(list_of_Document);

            setloading(false);
            // console.log(formik.errors);
          })
          .catch((error) => {
            console.error(error);
            setloading(false);
          });
      } catch (error) {
        console.error(error);
        setloading(false);
      }
    }

    try {
      ReadGenderData()
        .then((data) => {
          setGenderData(data.data);
        })
        .catch((error) => {
          console.error(error);
          setloading(false);
        });
    } catch (error) {
      console.error(error);
      setloading(false);
    }

    try {
      ReadBoardData()
        .then((data) => {
          setBoardData(data.data);
        })
        .catch((error) => {
          console.error(error);
          setloading(false);
        });
    } catch (error) {
      console.error(error);
      setloading(false);
    }

    try {
      ReadCategoryData()
        .then((data) => {
          setCategoryData(data.data);
        })
        .catch((error) => {
          console.error(error);
          setloading(false);
        });
    } catch (error) {
      console.error(error);
      setloading(false);
    }

    try {
      setCourseDataLoading(true);
      ReadCollegeCourseData()
        .then((data) => {
          setCollegeCourseData(data.data);
          setCourseDataLoading(false);
        })
        .catch((error) => {
          console.error(error);
          setCourseDataLoading(false);
          setloading(false);
        });
    } catch (error) {
      console.error(error);
      setCourseDataLoading(false);
      setloading(false);
    }

    // try {
    //   ReadBranchData()
    //     .then((data) => {
    //       setBranchData(data.data);
    //     })
    //     .catch((error) => {
    //       console.error(error);
    //       window.location.replace("/error");
    //     });
    // } catch (error) {
    //   console.error(error);
    //   window.location.replace("/error");
    // }

    // try {
    //   ReadBatchData()
    //     .then((data) => {
    //       setBatchData(data.data);
    //     })
    //     .catch((error) => {
    //       console.error(error);
    //       window.location.replace("/error");
    //     });
    // } catch (error) {
    //   console.error(error);
    //   window.location.replace("/error");
    // }
  }, []);

  const optionsGender = genderData.map((data: any, index: any) => {
    return { label: data.type, value: data.id };
  });

  const optionsCategory = categoryData.map((data: any, index: any) => {
    return { label: data.name, value: data.id };
  });

  const optionsTypeOfStudent = [
    {
      value: "Regular",
      label: "Regular",
    },
    {
      value: "Re-Admission",
      label: "Re-Admission",
    },
    {
      value: "Lateral Entry",
      label: "Lateral Entry",
    },
    {
      value: "Scholarship",
      label: "Scholarship",
    },
  ];

  const optionsbranch = branchData.map((data: any, index: any) => {
    return { label: data.name, value: data.id };
  });

  const optionsBoard = boardData.map((data: any, index: any) => {
    if (data.permanent) return { label: data.name, value: data.id };
    else return { label: data.name + " (Temporary)", value: data.id };
  });

  const optionsGroupName = groupNameData.map((data: any, index: any) => {
    return { label: data.groupName, value: index };
  });

  const optionsGroupNameData = groupNameOptionsData.map(
    (data: any, index: any) => {
      return { label: data, value: index };
    }
  );

  const webcamRef = useRef<any>(null);
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    setloading(true);
    fileUpload({
      data: imageSrc.split("base64,")[1],
      fileName: "",
      type: "image/jpeg",
    }).then((data) => {
      formik.setFieldValue("webcamPhoto", data.data);
      setWebCamClicked(true);
      setloading(false);
    });
  }, [webcamRef]);

  const videoConstraints = {
    width: 300,
    height: 360,
    facingMode: "user",
  };
  function validate() {
    // console.log(formik.errors);
    var ret = "";
    return formik.errors;
  }

  useEffect(() => {
    var t: any = collegeCourseData.instituteCourse.filter((c) => {
      return c.courseCode == courseData;
    });

    setBranchDataOptions(t.length > 0 ? t[0].instituteBranchs : []);
    if (t.length > 0) {
      var g: any = t[0].instituteBranchs.filter(
        (c) => c.branchId == branch_idData
      );
    }

    setBatchDataOptions(
      g && g.length > 0 ? g[0].instituteBranchBatchMapping : []
    );
  }, [collegeCourseData]);

  useEffect(() => {
    // adding listeners everytime props.x changes

    Object.entries(formik.values.check).forEach(([key, value]) => {
      if (value == false) setGenerate(false);
      else setGenerate(true);
    });
  }, [formik.values.check]);

  return (
    <div className="container">
      <div className="card p-8 mb-10 mt-5">
        {loading && (
          <span className="indicator-progress" style={{ display: "block" }}>
            Please wait...{" "}
            <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
          </span>
        )}

        {!loading && (
          <div className="text-center border-0 mt-5 mb-3 pt-5">
            <h3
              className="card-title align-items-center flex-column"
              style={{ fontSize: "3vmax", margin: "0px auto" }}
            >
              Student Details
            </h3>
          </div>
        )}

        {!loading && (
          <div className="card p-8 mb-10 mt-8 card-title align-items-center flex-column">
            {formik.errors.webcamPhoto || formik.values.webcamPhoto === "" ? (
              <>
                {!webcamUnmounted && (
                  <>
                    <Webcam
                      audio={false}
                      height={200}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      width={200}
                      videoConstraints={videoConstraints}
                      onUserMediaError={() => setWebcamUnmounted(true)}
                    />
                    <Button
                      onClick={capture}
                      style={{
                        width: "170px",
                        fontSize: "13px",
                        marginTop: "10px",
                      }}
                    >
                      {" "}
                      Capture Photo
                    </Button>
                  </>
                )}
                {webcamUnmounted && (
                  <div className="correct_solution mb-8">
                    <Alert
                      severity="warning"
                      style={{ fontSize: "16px" }}
                      onClose={() => setWebcamUnmounted(false)}
                    >
                      Please plugin a Webcam
                    </Alert>
                  </div>
                )}
              </>
            ) : (
              <>
                <img
                  src={Img_URL + formik.getFieldProps("webcamPhoto").value}
                  width="auto"
                  height="auto"
                  style={{ borderRadius: "3px" }}
                />
                <div className="d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 mt-8">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                        }}
                        defaultChecked={formik.values.check.webcam_photo}
                        onChange={(data) => {
                          formik.setFieldValue(
                            "check.webcam_photo",
                            data.target.checked
                          );
                        }}
                      />
                    </div>
                  )}
                  <Button
                    variant="outline-danger"
                    className="mt-8"
                    onClick={() => {
                      formik.setFieldValue("webcamPhoto", "");
                    }}
                  >
                    {" "}
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && (
          <form
            id="form1"
            style={{ color: "rgb(126, 30, 30)" }}
            className="form fv-plugins-bootstrap5 fv-plugins-framework"
            onSubmit={formik.handleSubmit}
          >
            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.first_name}
                        onChange={(data) => {
                          formik.setFieldValue(
                            "check.first_name",
                            data.target.checked
                          );
                        }}
                      />
                    </div>
                  )}
                  <strong>First Name : </strong>
                </label>

                <input
                  placeholder="Enter First Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("firstName")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.firstName && formik.errors.firstName,
                    },
                    {
                      "is-valid":
                        formik.touched.firstName && !formik.errors.firstName,
                    }
                  )}
                />
                {formik.touched.firstName && formik.errors.firstName && (
                  <>{formik.errors.firstName}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.middle_name}
                        onChange={(data) => {
                          formik.setFieldValue(
                            "check.middle_name",
                            data.target.checked
                          );
                        }}
                      />
                    </div>
                  )}
                  <strong>Middle Name : </strong>
                </label>

                <input
                  placeholder="Enter Middle Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("middleName")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.middleName && formik.errors.middleName,
                    }
                  )}
                />
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.last_name}
                        onChange={(data) => {
                          formik.setFieldValue(
                            "check.last_name",
                            data.target.checked
                          );
                        }}
                      />
                    </div>
                  )}
                  <strong>Last Name : </strong>
                </label>

                <input
                  placeholder="Enter Last Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("lastName")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.lastName && formik.errors.lastName,
                    },
                    {
                      "is-valid":
                        formik.touched.lastName && !formik.errors.lastName,
                    }
                  )}
                />
                {formik.touched.lastName && formik.errors.lastName && (
                  <>{formik.errors.lastName}</>
                )}
              </div>
            </div>

            {courseDataLoading && (
              <span
                className="indicator-progress text-center p-5"
                style={{
                  display: "block",
                  border: "1px dotted",
                  borderRadius: "5px",
                }}
              >
                Data Loading...{" "}
                <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
              </span>
            )}

            {!courseDataLoading && (
              <div className="row g-9 mb-8 mt-1">
                {/* course */}
                <div className="col-md-4 fv-row fv-plugins-icon-container">
                  <label className="required fs-6 fw-bold mb-2 d-flex">
                    {isRegrstrar && (
                      <div className="form-check form-check-custom form-check-solid mx-3 ">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            marginLeft: "-8px",
                          }}
                          defaultChecked={formik.values.check.course}
                          onChange={(data) => {
                            formik.setFieldValue(
                              "check.course",
                              data.target.checked
                            );
                          }}
                        />
                      </div>
                    )}
                    <strong>Course :</strong>
                  </label>
                  <div className="jhg h">
                    <select
                      placeholder="Select course"
                      value={formik.values.course}
                      onChange={(data: any) => {
                        setBranchDataOptions([]);
                        setCourseValue(data.target.value);
                        formik.setFieldValue("course", data.target.value);
                        formik.setFieldValue("branch_id", "");
                        formik.setFieldValue("batch_id", "");
                        formik.setTouched({
                          ...formik.touched,
                          ["course"]: true,
                        });
                        var t: any = collegeCourseData.instituteCourse.filter(
                          (c) => {
                            return c.courseCode == data.target.value;
                          }
                        );
                        setBranchDataOptions(
                          t.length > 0 ? t[0].instituteBranchs : []
                        );
                      }}
                      onClick={(data: any) => {
                        setBranchDataOptions([]);
                        setCourseValue(data.target.value);
                        formik.setFieldValue("course", data.target.value);
                        formik.setFieldValue("branch_id", "");
                        formik.setFieldValue("batch_id", "");
                        formik.setTouched({
                          ...formik.touched,
                          ["course"]: true,
                        });
                        var t: any = collegeCourseData.instituteCourse.filter(
                          (c) => {
                            return c.courseCode == data.target.value;
                          }
                        );
                        setBranchDataOptions(
                          t.length > 0 ? t[0].instituteBranchs : []
                        );
                      }}
                      className={clsx(
                        "form-select form-select-solid form-select-lg",
                        {
                          "is-invalid text-danger":
                            formik.touched.course && formik.errors.course,
                        },
                        {
                          "is-valid":
                            formik.touched.course && !formik.errors.course,
                        }
                      )}
                    >
                      <option value="">Select Course</option>
                      {collegeCourseData.instituteCourse.map(
                        (course: any, index: any) => (
                          <>
                            <option value={course.courseCode} key={index}>
                              {course.courseName}
                            </option>
                          </>
                        )
                      )}
                    </select>

                    {formik.touched.course && formik.errors.course && (
                      <>{formik.errors.course}</>
                    )}
                  </div>
                </div>
                {/* branch */}
                <div className="col-md-4 fv-row fv-plugins-icon-container">
                  <label className="required fs-6 fw-bold mb-2 d-flex">
                    {isRegrstrar && (
                      <div className="form-check form-check-custom form-check-solid mx-3 ">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            marginLeft: "-8px",
                          }}
                          defaultChecked={formik.values.check.branch}
                          {...formik.getFieldProps("check.branch")}
                        />
                      </div>
                    )}
                    <strong>Branch :</strong>
                  </label>
                  <div className="jhg h">
                    <select
                      value={formik.values.branch_id}
                      onChange={(data: any) => {
                        var t: any = collegeCourseData.instituteCourse.filter(
                          (c) => {
                            return formik.values.course == c.courseCode;
                          }
                        );

                        var g: any = t[0].instituteBranchs.filter(
                          (c) => c.branchId == data.target.value
                        );
                        setBranchValue(data.target.value);
                        formik.setFieldValue("branch_id", data.target.value);
                        formik.setFieldValue("batch_id", "");
                        formik.setTouched({
                          ...formik.touched,
                          ["branch_id"]: true,
                        });
                        setBatchDataOptions(
                          g.length > 0 ? g[0].instituteBranchBatchMapping : []
                        );
                      }}
                      onClick={(data: any) => {
                        var t: any = collegeCourseData.instituteCourse.filter(
                          (c) => {
                            return formik.values.course == c.courseCode;
                          }
                        );

                        var g: any = t[0].instituteBranchs.filter(
                          (c) => c.branchId == data.target.value
                        );
                        setBranchValue(data.target.value);
                        formik.setFieldValue("branch_id", data.target.value);
                        formik.setFieldValue("batch_id", "");
                        formik.setTouched({
                          ...formik.touched,
                          ["branch_id"]: true,
                        });
                        setBatchDataOptions(
                          g.length > 0 ? g[0].instituteBranchBatchMapping : []
                        );
                      }}
                      className={clsx(
                        "form-select form-select-solid form-select-lg",
                        {
                          "is-invalid text-danger":
                            formik.touched.branch_id && formik.errors.branch_id,
                        },
                        {
                          "is-valid":
                            formik.touched.branch_id &&
                            !formik.errors.branch_id,
                        }
                      )}
                    >
                      <option value="">Select Branch</option>
                      {/* <option value={formik.values.courseData.courseCode} disabled>{formik.values.courseData.courseName}</option> */}
                      {branchDataOptions.map((branch: any, index: any) => (
                        <>
                          <option value={branch.branchId} key={index}>
                            {branch.branchName}
                          </option>
                        </>
                      ))}
                    </select>
                    {formik.touched.branch_id && formik.errors.branch_id && (
                      <>{formik.errors.branch_id}</>
                    )}
                  </div>
                </div>

                {/* Session */}
                <div className="col-md-4 fv-row fv-plugins-icon-container">
                  <label className="required fs-6 fw-bold mb-2 d-flex">
                    {isRegrstrar && (
                      <div className="form-check form-check-custom form-check-solid mx-3 ">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            marginLeft: "-8px",
                          }}
                          defaultChecked={formik.values.check.batch}
                          {...formik.getFieldProps("check.batch")}
                        />
                      </div>
                    )}
                    <strong>Batch : </strong>
                  </label>
                  <div className="jhg h">
                    <select
                      value={formik.values.batch_id}
                      onChange={(data: any) => {
                        formik.setFieldValue("batch_id", data.target.value);
                        formik.setTouched({
                          ...formik.touched,
                          ["batch_id"]: true,
                        });
                      }}
                      onClick={(data: any) => {
                        formik.setFieldValue("batch_id", data.target.value);
                        formik.setTouched({
                          ...formik.touched,
                          ["batch_id"]: true,
                        });
                      }}
                      className={clsx(
                        "form-select form-select-solid form-select-lg",
                        {
                          "is-invalid text-danger":
                            formik.touched.batch_id && formik.errors.batch_id,
                        },
                        {
                          "is-valid":
                            formik.touched.batch_id && !formik.errors.batch_id,
                        }
                      )}
                    >
                      <option value="">Select Batch</option>
                      {/* <option value={formik.values.courseData.courseCode} disabled>{formik.values.courseData.courseName}</option> */}
                      {BatchDataOptions.map((batch: any, index: any) => (
                        <>
                          <option value={batch.batchId} key={index}>
                            {batch.instituteBatch.batchStart}-
                            {batch.instituteBatch.batchEnd}
                          </option>
                        </>
                      ))}
                    </select>
                    {formik.touched.batch_id && formik.errors.batch_id && (
                      <>{formik.errors.batch_id}</>
                    )}
                    {/* )} */}
                  </div>
                </div>

                {/* type of student
            <div className="col-md-4 fv-row fv-plugins-icon-container">
              <label className="required fs-6 fw-bold mb-2">
                <strong>Type Of Student</strong>
              </label>
              <div className="jhg h" style={{ width: "250px" }}>
                <Select
                  closeMenuOnSelect={true}
                  options={optionsTypeOfStudent}
                  placeholder="Type Of Student"
                  onChange={(data: any) => {
                    formik.setFieldValue("typeOfStudent", data.value);
                  }}
                />
              </div>
            </div> */}
              </div>
            )}

            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.phone_number}
                        {...formik.getFieldProps("check.phone_number")}
                      />
                    </div>
                  )}
                  <strong>Phone Number : </strong>
                </label>
                <input
                  placeholder="Enter Phone Number"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("phoneNumber")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.phoneNumber && formik.errors.phoneNumber,
                    },
                    {
                      "is-valid":
                        formik.touched.phoneNumber &&
                        !formik.errors.phoneNumber,
                    }
                  )}
                />
                {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                  <>{formik.errors.phoneNumber}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex ">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.dob}
                        {...formik.getFieldProps("check.dob")}
                      />
                    </div>
                  )}
                  <strong>DOB : </strong>
                </label>
                <input
                  placeholder="Enter DOB"
                  type="date"
                  max="2010-01-01"
                  autoComplete="off"
                  {...formik.getFieldProps("dob")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.dob && formik.errors.dob,
                    },
                    {
                      "is-valid": formik.touched.dob && !formik.errors.dob,
                    }
                  )}
                />
                {formik.touched.dob && formik.errors.dob && (
                  <>{formik.errors.dob}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.email_address}
                        {...formik.getFieldProps("check.email_address")}
                      />
                    </div>
                  )}
                  <strong>Email Address : </strong>
                </label>

                <input
                  placeholder="Enter Email Address"
                  type="email"
                  autoComplete="off"
                  {...formik.getFieldProps("personalEmailAddress")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.personalEmailAddress &&
                        formik.errors.personalEmailAddress,
                    },
                    {
                      "is-valid":
                        formik.touched.personalEmailAddress &&
                        !formik.errors.personalEmailAddress,
                    }
                  )}
                  // onBlur={() => {
                  //   if (loc.pathname != "/registrar/verification") {
                  //     try {
                  //       emailChecker(formik.values.personalEmailAddress)
                  //         .then((data: any) => {
                  //           if (data.data) {
                  //             formik.values.personalEmailAddress =
                  //               "Invalid Email";
                  //           }
                  //         })
                  //         .catch((error) => {
                  //           console.error(error);
                  //           window.location.replace("/error");
                  //         });
                  //     } catch (error) {
                  //       console.error(error);
                  //       window.location.replace("/error");
                  //     }
                  //   }
                  // }}
                />
                {formik.touched.personalEmailAddress &&
                  formik.errors.personalEmailAddress && (
                    <>{formik.errors.personalEmailAddress}</>
                  )}
              </div>
            </div>

            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.father_name}
                        {...formik.getFieldProps("check.father_name")}
                      />
                    </div>
                  )}
                  <strong>Father's Name : </strong>
                </label>
                <input
                  placeholder="Enter Father's Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("fatherName")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.fatherName && formik.errors.fatherName,
                    },
                    {
                      "is-valid":
                        formik.touched.fatherName && !formik.errors.fatherName,
                    }
                  )}
                />
                {formik.touched.fatherName && formik.errors.fatherName && (
                  <>{formik.errors.fatherName}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.mother_name}
                        {...formik.getFieldProps("check.mother_name")}
                      />
                    </div>
                  )}
                  <strong>Mother's Name : </strong>
                </label>
                <input
                  placeholder="Enter Mother's Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("motherName")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.motherName && formik.errors.motherName,
                    },
                    {
                      "is-valid":
                        formik.touched.motherName && !formik.errors.motherName,
                    }
                  )}
                />
                {formik.touched.motherName && formik.errors.motherName && (
                  <>{formik.errors.motherName}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex ">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.category}
                        {...formik.getFieldProps("check.category")}
                      />
                    </div>
                  )}
                  <strong>Category :</strong>
                </label>
                <div className="jhg h">
                  {true && (
                    <select
                      value={formik.values.category}
                      onChange={(data: any) => {
                        formik.setTouched({
                          ...formik.touched,
                          ["category"]: true,
                        });

                        if (data.target.value != 1) {
                          setSubCategory(true);
                          // list_of_Document[14].required = true;
                        } else {
                          setSubCategory(false);
                          // list_of_Document[14].required = false;
                        }

                        // setlistofDocument(list_of_Document);

                        formik.setFieldValue("category", data.target.value);
                        // formik.setFieldValue("categoryData", data.target.value);
                      }}
                      className={clsx(
                        "form-select form-select-solid form-select-lg",
                        {
                          "is-invalid text-danger":
                            formik.touched.category && formik.errors.category,
                        },
                        {
                          "is-valid":
                            formik.touched.category && !formik.errors.category,
                        }
                      )}
                    >
                      <option value="" disabled>
                        Select Category
                      </option>
                      {categoryData.map((category: any, index: any) => (
                        <>
                          <option value={category.id} key={index}>
                            {category.name}
                          </option>
                        </>
                      ))}
                    </select>
                  )}
                  {formik.touched.category && formik.errors.category && (
                    <>{formik.errors.category}</>
                  )}
                </div>
              </div>
              {subCategory && (
                <div className="col-md-4 fv-row fv-plugins-icon-container">
                  <label className=" fs-6 fw-bold mb-2 d-flex ">
                    {isRegrstrar && (
                      <div className="form-check form-check-custom form-check-solid mx-3 ">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            marginLeft: "-8px",
                          }}
                          defaultChecked={formik.values.check.sub_category}
                          {...formik.getFieldProps("check.sub_category")}
                        />
                      </div>
                    )}
                    <strong>Sub-Category :</strong>
                  </label>
                  <div className="jhg h">
                    {true && (
                      <input
                        placeholder="Enter Sub-Category"
                        type="text"
                        autoComplete="off"
                        {...formik.getFieldProps("subCategory")}
                        className={clsx(
                          "form-control form-control-lg form-control-solid",
                          {
                            "is-invalid text-danger":
                              formik.touched.subCategory &&
                              formik.errors.subCategory,
                          },
                          {
                            "is-valid":
                              formik.touched.subCategory &&
                              !formik.errors.subCategory,
                          }
                        )}
                      />
                    )}
                    {formik.touched.subCategory &&
                      formik.errors.subCategory && (
                        <>{formik.errors.subCategory}</>
                      )}
                  </div>
                </div>
              )}
            </div>

            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.gender}
                        {...formik.getFieldProps("check.gender")}
                      />
                    </div>
                  )}
                  <strong>Gender : </strong>
                </label>
                <div className="jhg h">
                  {true && (
                    <select
                      value={formik.values.gender}
                      onChange={(data: any) => {
                        formik.setTouched({
                          ...formik.touched,
                          ["gender"]: true,
                        });

                        formik.setFieldValue("gender", data.target.value);
                      }}
                      className={clsx(
                        "form-select form-select-solid form-select-lg",
                        {
                          "is-invalid text-danger":
                            formik.touched.gender && formik.errors.gender,
                        },
                        {
                          "is-valid":
                            formik.touched.gender && !formik.errors.gender,
                        }
                      )}
                    >
                      <option value="" disabled>
                        Select Gender
                      </option>
                      {genderData.map((gender: any, index: any) => (
                        <>
                          <option key={index} value={gender.id}>
                            {gender.type}
                          </option>
                        </>
                      ))}
                    </select>
                  )}
                  {formik.touched.gender && formik.errors.gender && (
                    <>{formik.errors.gender}</>
                  )}
                </div>
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.aadhar_card_no}
                        {...formik.getFieldProps("check.aadhar_card_no")}
                      />
                    </div>
                  )}
                  <strong>Aadhar Card No. : </strong>
                </label>
                <input
                  placeholder="Enter Aadhar Card No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("aadharCardNo")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.aadharCardNo &&
                        formik.errors.aadharCardNo,
                    },
                    {
                      "is-valid":
                        formik.touched.aadharCardNo &&
                        !formik.errors.aadharCardNo,
                    }
                  )}
                />
                {formik.touched.aadharCardNo && formik.errors.aadharCardNo && (
                  <>{formik.errors.aadharCardNo}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.father_phone_number}
                        {...formik.getFieldProps("check.father_phone_number")}
                      />
                    </div>
                  )}
                  <strong>Father's Phone No. : </strong>
                </label>
                <input
                  placeholder="Enter Father's Phone No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("fatherPhoneNumber")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.fatherPhoneNumber &&
                        formik.errors.fatherPhoneNumber,
                    },
                    {
                      "is-valid":
                        formik.touched.fatherPhoneNumber &&
                        !formik.errors.fatherPhoneNumber,
                    }
                  )}
                />
                {formik.touched.fatherPhoneNumber &&
                  formik.errors.fatherPhoneNumber && (
                    <>{formik.errors.fatherPhoneNumber}</>
                  )}
              </div>
            </div>
            <div className="row g-9 mb-4 mt-0 mx-auto">
              <div className="fv-row fv-plugins-icon-container">
                <label className=" fs-6 fw-bold mb-2">
                  <div className="form-check form-check-custom form-check-solid mx-3 ">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      style={{
                        borderColor: "black",
                        width: "20px",
                        height: "20px",
                        borderRadius: "5px",
                      }}
                      defaultChecked={formik.values.ews}
                      onChange={(data: any) => {
                        // data.target.checked
                        //   ? (list_of_Document[15].required = true)
                        //   : (list_of_Document[15].required = false);
                        formik.setFieldValue("ews", data.target.checked);
                      }}
                    />
                    <p
                      style={{
                        borderColor: "black",
                        marginLeft: "8px",
                      }}
                      className="pl-10 mt-5"
                    >
                      Do you come under EWS Category? (Check if yes)
                    </p>
                  </div>
                </label>
              </div>
            </div>
            <div className="row g-9 mb-4 mt-0 mx-auto">
              <div className="d-flex">
                <label
                  className="required fs-6 fw-bold me-5 d-flex"
                  style={{ marginLeft: "-8px" }}
                >
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check.permanent_address}
                        {...formik.getFieldProps("check.permanent_address")}
                      />
                    </div>
                  )}
                  <strong>Permanent Address : </strong>
                </label>
              </div>

              <textarea
                style={{ marginTop: "5px" }}
                placeholder="Enter Permanent Address"
                autoComplete="off"
                {...formik.getFieldProps("permanentAddress")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.permanentAddress &&
                      formik.errors.permanentAddress,
                  },
                  {
                    "is-valid":
                      formik.touched.permanentAddress &&
                      !formik.errors.permanentAddress,
                  }
                )}
              />
              {formik.touched.permanentAddress &&
                formik.errors.permanentAddress && (
                  <>{formik.errors.permanentAddress}</>
                )}
            </div>

            <div className="row g-9 mb-4 mt-0 mx-auto">
              <label
                className="required fs-6 mb-0 fw-bold d-flex"
                style={{ marginLeft: "-8px" }}
              >
                {isRegrstrar && (
                  <div className="form-check form-check-custom form-check-solid mx-3 ">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                        marginLeft: "-8px",
                      }}
                      defaultChecked={formik.values.check.current_address}
                      {...formik.getFieldProps("check.current_address")}
                    />
                  </div>
                )}
                <strong>Current Address : </strong>
              </label>

              <textarea
                style={{ marginTop: "5px" }}
                placeholder="Enter Current Address"
                autoComplete="off"
                {...formik.getFieldProps("currentAddress")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.currentAddress &&
                      formik.errors.currentAddress,
                  },
                  {
                    "is-valid":
                      formik.touched.currentAddress &&
                      !formik.errors.currentAddress,
                  }
                )}
              />
              {formik.touched.currentAddress &&
                formik.errors.currentAddress && (
                  <>{formik.errors.currentAddress}</>
                )}
            </div>

            <div className="row g-9 mb-8 mt-1">
              <h1>10th Board Details : *</h1>
            </div>
            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._0th_board}
                        {...formik.getFieldProps("check._0th_board")}
                      />
                    </div>
                  )}
                  <strong>10th Board : </strong>
                </label>
                <div className="jhg h">
                  <select
                    value={formik.values._0thboard}
                    onChange={(data: any) => {
                      formik.setTouched({
                        ...formik.touched,
                        ["_0thboard"]: true,
                      });

                      // Check if "Other Board" is selected
                      data.target.value === "other"
                        ? setOther10thBoard(true)
                        : setOther10thBoard(false);

                      formik.setFieldValue("_0thboard", data.target.value);
                    }}
                    className={clsx(
                      "form-select form-select-solid form-select-lg",
                      {
                        "is-invalid text-danger":
                          formik.touched._0thboard && formik.errors._0thboard,
                      },
                      {
                        "is-valid":
                          formik.touched._0thboard && !formik.errors._0thboard,
                      }
                    )}
                  >
                    <option value="" disabled>
                      Select 10th Board
                    </option>
                    {boardData.map((board: any, index: any) => (
                      <option value={board.id} key={index}>
                        {board.permanent ? board.name : board.name}
                      </option>
                    ))}
                    {/* Add Other Board option */}
                    <option value="other">Other Board</option>
                  </select>
                  {formik.touched._0thboard && formik.errors._0thboard && (
                    <>{formik.errors._0thboard}</>
                  )}
                </div>
              </div>
              {other10thBoard && (
                <div className="col-md-4 fv-row fv-plugins-icon-container">
                  <label className="required fs-6 fw-bold mb-2 d-flex">
                    {/* {isRegrstrar && (
                      <div className="form-check form-check-custom form-check-solid mx-3 ">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px"
                        }}
                          defaultChecked={formik.values.check.other_10th_board}
                          {...formik.getFieldProps("check.other_10th_board")}
                        />
                      </div>
                    )} */}
                    <strong>Other 10th Board : </strong>
                  </label>
                  <input
                    placeholder="Enter Other 10th Board"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("other10thBoard")}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          formik.touched.other10thBoard &&
                          formik.errors.other10thBoard,
                      },
                      {
                        "is-valid":
                          formik.touched.other10thBoard &&
                          !formik.errors.other10thBoard,
                      }
                    )}
                  />
                  {formik.touched.other10thBoard &&
                    formik.errors.other10thBoard && (
                      <>{formik.errors.other10thBoard}</>
                    )}
                </div>
              )}
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._0th_roll_no}
                        {...formik.getFieldProps("check._0th_roll_no")}
                      />
                    </div>
                  )}
                  <strong>10th Roll No. : </strong>
                </label>
                <input
                  placeholder="Enter 10th Roll No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("_0thRollNo")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched._0thRollNo && formik.errors._0thRollNo,
                    },
                    {
                      "is-valid":
                        formik.touched._0thRollNo && !formik.errors._0thRollNo,
                    }
                  )}
                />
                {formik.touched._0thRollNo && formik.errors._0thRollNo && (
                  <>{formik.errors._0thRollNo}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._0th_marks}
                        {...formik.getFieldProps("check._0th_marks")}
                      />
                    </div>
                  )}
                  <strong>10th Marks : </strong>
                </label>
                <input
                  placeholder="Enter 10th Marks"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("_0thMarks")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched._0thMarks && formik.errors._0thMarks,
                    },
                    {
                      "is-valid":
                        formik.touched._0thMarks && !formik.errors._0thMarks,
                    }
                  )}
                />
                {formik.touched._0thMarks && formik.errors._0thMarks && (
                  <>{formik.errors._0thMarks}</>
                )}
              </div>
            </div>

            <div className="row g-9 mb-8 mt-1">
              <h1>12th Board Details : *</h1>
            </div>
            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._2th_board_SS}
                        {...formik.getFieldProps("check._2th_board_SS")}
                      />
                    </div>
                  )}
                  <strong>12th Board : </strong>
                </label>
                <div className="jhg h">
                  <select
                    value={formik.values._2thboardSS}
                    onChange={(data: any) => {
                      formik.setTouched({
                        ...formik.touched,
                        ["_2thboardSS"]: true,
                      });

                      // Check if "Other Board" is selected
                      data.target.value === "other"
                        ? setOther12thBoard(true)
                        : setOther12thBoard(false);

                      formik.setFieldValue("_2thboardSS", data.target.value);
                    }}
                    className={clsx(
                      "form-select form-select-solid form-select-lg",
                      {
                        "is-invalid text-danger":
                          formik.touched._2thboardSS &&
                          formik.errors._2thboardSS,
                      },
                      {
                        "is-valid":
                          formik.touched._2thboardSS &&
                          !formik.errors._2thboardSS,
                      }
                    )}
                  >
                    <option value="" disabled>
                      Select 12th Board
                    </option>
                    {boardData.map((board: any, index: any) => (
                      <option value={board.id} key={index}>
                        {board.permanent ? board.name : board.name}
                      </option>
                    ))}
                    {/* Add Other Board option */}
                    <option value="other">Other Board</option>
                  </select>
                  {formik.touched._2thboardSS && formik.errors._2thboardSS && (
                    <>{formik.errors._2thboardSS}</>
                  )}
                </div>
              </div>
              {other12thBoard && (
                <div className="col-md-4 fv-row fv-plugins-icon-container">
                  <label className="required fs-6 fw-bold mb-2 d-flex">
                    {/* {isRegrstrar && (
                      <div className="form-check form-check-custom form-check-solid mx-3 ">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px"
                        }}
                          defaultChecked={formik.values.check.other_12th_board}
                          {...formik.getFieldProps("check.other_12th_board")}
                        />
                      </div>
                    )} */}
                    <strong>Other 12th Board : </strong>
                  </label>
                  <input
                    placeholder="Enter Other 12th Board"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("other12thBoard")}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          formik.touched.other12thBoard &&
                          formik.errors.other12thBoard,
                      },
                      {
                        "is-valid":
                          formik.touched.other12thBoard &&
                          !formik.errors.other12thBoard,
                      }
                    )}
                  />
                  {formik.touched.other12thBoard &&
                    formik.errors.other12thBoard && (
                      <>{formik.errors.other12thBoard}</>
                    )}
                </div>
              )}
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._2th_roll_no_ss}
                        {...formik.getFieldProps("check._2th_roll_no_ss")}
                      />
                    </div>
                  )}
                  <strong>12th Roll No. : </strong>
                </label>
                <input
                  placeholder="Enter 12th Roll No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("_2thRollNoss")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched._2thRollNoss &&
                        formik.errors._2thRollNoss,
                    },
                    {
                      "is-valid":
                        formik.touched._2thRollNoss &&
                        !formik.errors._2thRollNoss,
                    }
                  )}
                />
                {formik.touched._2thRollNoss && formik.errors._2thRollNoss && (
                  <>{formik.errors._2thRollNoss}</>
                )}
              </div>
            </div>
            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._2th_marks_physics}
                        {...formik.getFieldProps("check._2th_marks_physics")}
                      />
                    </div>
                  )}
                  <strong>12th Physics Marks : </strong>
                </label>
                <input
                  placeholder="Enter 12th Physics Marks"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("_2thMarksPhysics")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched._2thMarksPhysics &&
                        formik.errors._2thMarksPhysics,
                    },
                    {
                      "is-valid":
                        formik.touched._2thMarksPhysics &&
                        !formik.errors._2thMarksPhysics,
                    }
                  )}
                />
                {formik.touched._2thMarksPhysics &&
                  formik.errors._2thMarksPhysics && (
                    <>{formik.errors._2thMarksPhysics}</>
                  )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._2th_marks_maths}
                        {...formik.getFieldProps("check._2th_marks_maths")}
                      />
                    </div>
                  )}
                  <strong>12th Maths Marks : </strong>
                </label>
                <input
                  placeholder="Enter 12th Maths Marks"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("_2thMarksMaths")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched._2thMarksMaths &&
                        formik.errors._2thMarksMaths,
                    },
                    {
                      "is-valid":
                        formik.touched._2thMarksMaths &&
                        !formik.errors._2thMarksMaths,
                    }
                  )}
                />
                {formik.touched._2thMarksMaths &&
                  formik.errors._2thMarksMaths && (
                    <>{formik.errors._2thMarksMaths}</>
                  )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  {isRegrstrar && (
                    <div className="form-check form-check-custom form-check-solid mx-3 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          marginLeft: "-8px",
                        }}
                        defaultChecked={formik.values.check._2th_marks_chem}
                        {...formik.getFieldProps("check._2th_marks_chem")}
                      />
                    </div>
                  )}
                  <strong>12th Chemistry Marks : </strong>
                </label>
                <input
                  placeholder="Enter 12th Chemistry Marks"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("_2thMarksChemistry")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched._2thMarksChemistry &&
                        formik.errors._2thMarksChemistry,
                    },
                    {
                      "is-valid":
                        formik.touched._2thMarksChemistry &&
                        !formik.errors._2thMarksChemistry,
                    }
                  )}
                />
                {formik.touched._2thMarksChemistry &&
                  formik.errors._2thMarksChemistry && (
                    <>{formik.errors._2thMarksChemistry}</>
                  )}
              </div>
            </div>
            <div className="row g-9 mb-8 mt-1">
              <div className="fv-row fv-plugins-icon-container">
                <label className=" fs-6 fw-bold mb-2">
                  <div className="form-check form-check-custom form-check-solid mx-3 ">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      style={{
                        borderColor: "black",
                        width: "20px",
                        height: "20px",
                        borderRadius: "5px",
                      }}
                      defaultChecked={formik.values.homeBoard12th}
                      onChange={(data: any) => {
                        // data.target.checked
                        //   ? (list_of_Document[13].required = false)
                        //   : (list_of_Document[13].required = true);
                        formik.setFieldValue(
                          "homeBoard12th",
                          data.target.checked
                        );
                      }}
                    />
                    <p
                      style={{
                        borderColor: "black",
                        marginLeft: "8px",
                      }}
                      className="pl-10 mt-5"
                    >
                      Is your 12th School from Uttar Pradesh ?
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="row g-9 mb-8 ">
              <div className="fv-row fv-plugins-icon-container">
                <label className=" fs-6 fw-bold mb-2">
                  <div className="form-check form-check-custom form-check-solid mx-3 ">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      style={{
                        borderColor: "black",
                        width: "20px",
                        height: "20px",
                        borderRadius: "5px",
                      }}
                      defaultChecked={formik.values.counselling}
                      onChange={(data: any) => {
                        // data.target.checked
                        //   ? (list_of_Document[0].required = true)
                        //   : (list_of_Document[0].required = false);
                        // data.target.checked
                        //   ? (list_of_Document[11].required = true)
                        //   : (list_of_Document[11].required = false);
                        // setlistofDocument(list_of_Document);
                        formik.setFieldValue(
                          "counselling",
                          data.target.checked
                        );
                      }}
                    />
                    <p
                      style={{
                        borderColor: "black",
                        marginLeft: "8px",
                      }}
                      className="pl-10 mt-5"
                    >
                      Are you admitted through UPSEE counselling ?
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* <div className="row g-9 mb-8 mt-1">
              <h1>Upload Documents : {isRegrstrar}*</h1>
            </div>
            <VerticalTabs
              fileData={listofDocument}
              fileUserData={formik.values}
              fileUserDataSet={(variable: any, value: any) => {
                formik.setFieldValue(variable, value);
              }}
              setSubmitting={(data) => {
                formik.setSubmitting(data);
              }}
              errors={formik.errors}
              isregistrar={isRegrstrar}
            /> */}
            {formik.isSubmitting ||
              (!formik.isValid &&
                Object.values(formik.errors).map((error, index: any) => (
                  <div className="my-3" key={index}>
                    {error?.toString()}
                  </div>
                )))}
            <div className="mt-10 mb-5 d-flex" style={{ marginInline: "30vw" }}>
              <div>
                {isRegrstrar && !formikCheck(formik.values.check) && (
                  <div className="form-check form-check-custom form-check-solid my-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                        marginLeft: "-8px",
                      }}
                      defaultChecked={false}
                      onChange={(data) => {
                        if (data.target.checked) {
                          formik.setFieldValue("generate", "RA");
                        }
                        formik.setFieldValue(
                          "check.generate",
                          data.target.checked
                        );
                      }}
                    />{" "}
                    &nbsp; Generate
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  // disabled={formik.isSubmitting || !formik.isValid}
                >
                  {<span className="indicator-label">Submit</span>}
                </button>
              </div>
              {/* <div className="mt-12 mx-10">
              <button
                type="button"
                className="btn btn-sm btn-primary btn-active-light-secoundary"
                // disabled={formik.isSubmitting || !formik.isValid}
                onClick={()=>
                  Partial_Save(formik.values)
                }
              >
                {<span className="indicator-label">Partial Save</span>}
              </button>
              </div> */}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StudentDetails;
