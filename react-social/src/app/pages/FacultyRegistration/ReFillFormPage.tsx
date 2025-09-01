import clsx from "clsx";
import { useFormik } from "formik";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import * as Yup from "yup";
import {
  ReadCategoryData,
  ReadGenderData,
  emailChecker,
  fileUpload,
  upsertFacultyData,
  ReadFacultyByIdData,
} from "./Faculty_APIs";

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
const facultySchema = Yup.object().shape({
  webcamPhoto: Yup.string().required("Please Use Webcam"),
  firstName: Yup.string().required("First Name is required"),
  lastName: Yup.string().required("Last Name is required"),
  phoneNumber: Yup.string()
    .required("Phone Number is required")
    .length(10, "Phone Number must be of 10 digits"),
  dob: Yup.string().required("Date of Birth is required"),
  personalEmailAddress: Yup.string()
    .required("Personal Email Address is required")
    .notOneOf(["Invalid Email", null], "This Email Id is Already In Use"),
  father_husband_name: Yup.string().required("Father/Husband's Name is required "),
  category: Yup.string().required("Category is required"),
  gender: Yup.string().required("Gender is required"),
  aadharCardNo: Yup.string()
    .required("Aadhar Card Number is required")
    .length(12, "Aadhar Card Number must be of 12 digits"),
  permanentAddress: Yup.string().required("Permanent Address is required"),
  currentAddress: Yup.string().required("Current Address is required"),
  educationalQualifications: Yup.string().required(
    "Educational Qualification is required"
  ),
  teachingExperience: Yup.string().required("Teaching Experience is required"),
  panCardNo: Yup.string().required("Pan Card Number is required"),
  bankAccountNo: Yup.string().required("Bank Account Number is required "),
  ifscCode: Yup.string().required(" IFSC Code is required"),
  bankName: Yup.string().required("Bank Name is required "),
  designation: Yup.string().required("Designation is required"),
  department: Yup.string().required("Department is required"),
});

const FacultyDetails = () => {
  const [genderData, setGenderData] = useState([]);
  const [generate, setGenerate] = useState(true);
  const [categoryData, setCategoryData] = useState([]);
  const loc = useLocation();
  var [searchParams] = useSearchParams();
  // var faculty_id = searchParams.get("college_identification_number");
  var faculty_id = window.location.search.substring(1);
  var decodedUrl = decodeURIComponent(faculty_id);
  var decodedId = decodedUrl.split("=");

  var initialValues: any = {
    firstName: "",
    middleName: "",
    lastName: "",
    personalEmailAddress: "",
    phoneNumber: "",
    dob: "",
    father_husband_name: "",
    educationalQualifications: "",
    gender: "",
    aadharCardNo: "",
    permanentAddress: "",
    currentAddress: "",
    webcamPhoto: "",
    category: "",
    generate: "FI",
    teachingExperience: "",
    panCardNo: "",
    bankAccountNo: "",
    ifscCode: "",
    bankName: "",
    designation: "",
    department: "",
    check: {
      webcamPhoto: true,
      firstName: true,
      middleName: true,
      lastName: true,
      personalEmailAddress: true,
      phoneNumber: true,
      dob: true,
      father_husband_name: true,
      educationalQualifications: true,
      category: true,
      gender: true,
      aadharCardNo: true,
      teachingExperience: true,
      permanentAddress: true,
      currentAddress: true,
      panCardNo: true,
      ifscCode: true,
      bankAccountNo: true,
      bankName: true,
      designation: true,
      department: true,
    },
  };

  const [loading, setloading] = useState(false);
  const [webcamUnmounted, setWebcamUnmounted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [webCamClicked, setWebCamClicked] = useState(false);
  const [groupNameOptionsData, setGroupNameOptionsData] = useState([]);
  const search = useLocation().state;
  const [initialData, setInitialData] = useState(initialValues);
  const [generateValue, setGenerateValue] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: facultySchema,
    onSubmit: (values, { setStatus, setSubmitting }) => {
      setloading(true);
      values.generate = "FU";

      try {
        upsertFacultyData(values)
          .then(() => {
            window.location.replace("/thankyou");
          })
          .catch((error) => {
            console.error(error);
            window.location.replace("/error");
          });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
    },
  });

  useEffect(() => {
    setloading(true);
    ReadFacultyByIdData(decodedId[1]).then((data) => {
      if (data.data.check == null || !data.data.check) {
        data.data.check = initialValues.check;
      } else {
        Object.entries(data.data.check).forEach(([key, value]) => {
          if (value == false) setGenerate(false);
          else setGenerate(true);
        });
      }

      formik.setValues(data.data);
      setInitialData(data.data);

      if (data.data.generate == "FU" || data.data.generate == "RA") {
        setGenerateValue(true);
      }

      setloading(false);
    });
    try {
      ReadGenderData()
        .then((data) => {
          setGenderData(data.data);
        })
        .catch((error) => {
          console.error(error);
          window.location.replace("/error");
        });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }

    try {
      ReadCategoryData()
        .then((data) => {
          setCategoryData(data.data);
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

  const optionsGender = genderData.map((data: any, index: any) => {
    return { label: data.type, value: data.id };
  });

  const optionsCategory = categoryData.map((data: any, index: any) => {
    return { label: data.name, value: data.id };
  });
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
    // adding listeners everytime props.x changes

    Object.entries(formik.values.check).forEach(([key, value]) => {
      if (!value) {
        setGenerate(false);
      } else {
        setGenerate(true);
      }
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

        {!loading && generateValue && (
          <span className="text-center p-1" style={{ fontSize: "20px" }}>
            Your faculty registration form has been{" "}
            <span style={{ color: "rgb(126, 30, 30)" }}>updated</span> and
            <span style={{ color: "rgb(126, 30, 30)" }}> submitted</span> to the
            registrar.<br></br> You will be{" "}
            <span style={{ color: "rgb(126, 30, 30)" }}>updated</span> about
            further processing.
          </span>
        )}

        {!loading && !generateValue && (
          <div className="text-center border-0 mt-5 mb-3 pt-5">
            <h3
              className="card-title align-items-center flex-column"
              style={{ fontSize: "3vmax", margin: "0px auto" }}
            >
              Faculty Details
            </h3>
          </div>
        )}

        {!loading && !generateValue && (
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
                  <Button
                    variant="outline-danger"
                    style={{ width: "170px" }}
                    className={clsx(
                      "form-control form-control-lg form-control-solid mt-8",
                      {
                        "is-invalid text-danger":
                          formik.touched.webcamPhoto &&
                          formik.errors.webcamPhoto,
                      },
                      {
                        "is-valid":
                          formik.touched.webcamPhoto &&
                          !formik.errors.webcamPhoto,
                      },
                      {
                        "is-invalid text-danger":
                          !formik.values.check.webcamPhoto &&
                          formik.values.webcamPhoto == initialData.webcamPhoto,
                      }
                    )}
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

        {!loading && !generateValue && (
          <form
            id="form1"
            style={{ color: "rgb(126, 30, 30)" }}
            className="form fv-plugins-bootstrap5 fv-plugins-framework"
            onSubmit={formik.handleSubmit}
          >
            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
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
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.firstName &&
                        formik.values.firstName == initialData.firstName,
                    }
                  )}
                />
                {formik.touched.firstName && formik.errors.firstName && (
                  <>{formik.errors.firstName}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="fs-6 fw-bold mb-2 d-flex">
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
                        !formik.values.check.middleName &&
                        formik.values.middleName == initialData.middleName,
                    }
                  )}
                />
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
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
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.lastName &&
                        formik.values.lastName == initialData.lastName,
                    }
                  )}
                />
                {formik.touched.lastName && formik.errors.lastName && (
                  <>{formik.errors.lastName}</>
                )}
              </div>
            </div>

            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
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
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.phoneNumber &&
                        formik.values.phoneNumber == initialData.phoneNumber,
                    }
                  )}
                />
                {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                  <>{formik.errors.phoneNumber}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex ">
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
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.dob &&
                        formik.values.dob == initialData.dob,
                    }
                  )}
                />
                {formik.touched.dob && formik.errors.dob && (
                  <>{formik.errors.dob}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
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
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.personalEmailAddress &&
                        formik.values.personalEmailAddress ==
                          initialData.personalEmailAddress,
                    }
                  )}
                  // onBlur={() => {
                  //   if (loc.pathname != "/registrar/verification/faculty") {
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
                  <strong>Father/Husband's Name: </strong>
                </label>
                <input
                  placeholder="Enter Father/Husband's Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("father_husband_name")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.father_husband_name &&
                        formik.errors.father_husband_name,
                    },
                    {
                      "is-valid":
                        formik.touched.father_husband_name &&
                        !formik.errors.father_husband_name,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.father_husband_name &&
                        formik.values.father_husband_name == initialData.father_husband_name,
                    }
                  )}
                />
                {formik.touched.father_husband_name && formik.errors.father_husband_name && (
                  <>{formik.errors.father_husband_name}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
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
                        },
                        {
                          "is-invalid text-danger":
                            !formik.values.check.gender &&
                            formik.values.gender == initialData.gender,
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
                <label className="required fs-6 fw-bold mb-2 d-flex ">
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

                        // if (data.target.value != 1) {
                        //   setSubCategory(true);
                        //   // list_of_Document[14].required = true;
                        // } else {
                        //   setSubCategory(false);
                        //   // list_of_Document[14].required = false;
                        // }

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
                        },
                        {
                          "is-invalid text-danger":
                            !formik.values.check.category &&
                            formik.values.category == initialData.category,
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
            </div>

            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
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
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.aadharCardNo &&
                        formik.values.aadharCardNo == initialData.aadharCardNo,
                    }
                  )}
                />
                {formik.touched.aadharCardNo && formik.errors.aadharCardNo && (
                  <>{formik.errors.aadharCardNo}</>
                )}
              </div>
              <div className="col-md-8 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>Educational Qualifications : </strong>
                </label>
                <input
                  placeholder="Enter Educational Qualifications"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("educationalQualifications")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.educationalQualifications &&
                        formik.errors.educationalQualifications,
                    },
                    {
                      "is-valid":
                        formik.touched.educationalQualifications &&
                        !formik.errors.educationalQualifications,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.educationalQualifications &&
                        formik.values.educationalQualifications ==
                          initialData.educationalQualifications,
                    }
                  )}
                />
                {formik.touched.educationalQualifications &&
                  formik.errors.educationalQualifications && (
                    <>{formik.errors.educationalQualifications}</>
                  )}
              </div>
            </div>

            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>Teaching Experience: </strong>
                </label>
                <input
                  placeholder="Enter Your Teaching Experience."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("teachingExperience")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.teachingExperience &&
                        formik.errors.teachingExperience,
                    },
                    {
                      "is-valid":
                        formik.touched.teachingExperience &&
                        !formik.errors.teachingExperience,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.teachingExperience &&
                        formik.values.teachingExperience ==
                          initialData.teachingExperience,
                    }
                  )}
                />
                {formik.touched.teachingExperience &&
                  formik.errors.teachingExperience && (
                    <>{formik.errors.teachingExperience}</>
                  )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>Designation : </strong>
                </label>
                <input
                  placeholder="Enter Designation"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("designation")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.designation &&
                        formik.errors.designation,
                    },
                    {
                      "is-valid":
                        formik.touched.designation &&
                        !formik.errors.designation,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.designation &&
                        formik.values.designation == initialData.designation,
                    }
                  )}
                />
                {formik.touched.designation && formik.errors.designation && (
                  <>{formik.errors.designation}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>Department : </strong>
                </label>
                <input
                  placeholder="Enter Department"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("department")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.department &&
                        formik.errors.department,
                    },
                    {
                      "is-valid":
                        formik.touched.department &&
                        !formik.errors.department,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.department &&
                        formik.values.department == initialData.department,
                    }
                  )}
                />
                {formik.touched.department && formik.errors.department && (
                  <>{formik.errors.department}</>
                )}
              </div>
            </div>

            <div className="row g-9 mb-4 mt-0 mx-auto">
              <div className="d-flex">
                <label
                  className="required fs-6 fw-bold me-5 d-flex"
                  style={{ marginLeft: "-8px" }}
                >
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
                  },
                  {
                    "is-invalid text-danger":
                      !formik.values.check.permanentAddress &&
                      formik.values.permanentAddress ==
                        initialData.permanentAddress,
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
                  },
                  {
                    "is-invalid text-danger":
                      !formik.values.check.currentAddress &&
                      formik.values.currentAddress ==
                        initialData.currentAddress,
                  }
                )}
              />
              {formik.touched.currentAddress &&
                formik.errors.currentAddress && (
                  <>{formik.errors.currentAddress}</>
                )}
            </div>

            <div className="row g-9 mb-8 mt-1">
              <h1>BANK DETAILS: *</h1>
            </div>
            <div className="row g-9 mb-8 mt-1">
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>Income Tax Pan No. : </strong>
                </label>
                <input
                  placeholder="Enter Pan Card No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("panCardNo")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.panCardNo && formik.errors.panCardNo,
                    },
                    {
                      "is-valid":
                        formik.touched.panCardNo && !formik.errors.panCardNo,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.panCardNo &&
                        formik.values.panCardNo == initialData.panCardNo,
                    }
                  )}
                />
                {formik.touched.panCardNo && formik.errors.panCardNo && (
                  <>{formik.errors.panCardNo}</>
                )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>Bank Account No: </strong>
                </label>
                <input
                  placeholder="Enter Bank Account No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("bankAccountNo")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.bankAccountNo &&
                        formik.errors.bankAccountNo,
                    },
                    {
                      "is-valid":
                        formik.touched.bankAccountNo &&
                        !formik.errors.bankAccountNo,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.bankAccountNo &&
                        formik.values.bankAccountNo ==
                          initialData.bankAccountNo,
                    }
                  )}
                />
                {formik.touched.bankAccountNo &&
                  formik.errors.bankAccountNo && (
                    <>{formik.errors.bankAccountNo}</>
                  )}
              </div>
              <div className="col-md-4 fv-row fv-plugins-icon-container">
                <label className="required fs-6 fw-bold mb-2 d-flex">
                  <strong>IFSC Code : </strong>
                </label>
                <input
                  placeholder="Enter IFSC Code"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("ifscCode")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.ifscCode && formik.errors.ifscCode,
                    },
                    {
                      "is-valid":
                        formik.touched.ifscCode && !formik.errors.ifscCode,
                    },
                    {
                      "is-invalid text-danger":
                        !formik.values.check.ifscCode &&
                        formik.values.ifscCode == initialData.ifscCode,
                    }
                  )}
                />
                {formik.touched.ifscCode && formik.errors.ifscCode && (
                  <>{formik.errors.ifscCode}</>
                )}
              </div>
            </div>

            <div className="row g-9 mb-4 mt-0 mx-auto">
              <label
                className="required fs-6 mb-0 fw-bold d-flex"
                style={{ marginLeft: "-8px" }}
              >
                <strong>Bank Name With Address : </strong>
              </label>

              <textarea
                style={{ marginTop: "5px" }}
                placeholder="Enter Bank Name With Address"
                autoComplete="off"
                {...formik.getFieldProps("bankName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.bankName && formik.errors.bankName,
                  },
                  {
                    "is-valid":
                      formik.touched.bankName && !formik.errors.bankName,
                  },
                  {
                    "is-invalid text-danger":
                      !formik.values.check.bankName &&
                      formik.values.bankName == initialData.bankName,
                  }
                )}
              />
              {formik.touched.bankName && formik.errors.bankName && (
                <>{formik.errors.bankName}</>
              )}
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

export default FacultyDetails;
