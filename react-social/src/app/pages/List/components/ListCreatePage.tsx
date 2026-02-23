import React, { useState } from "react";
import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateListData } from "../API/List_APIs";

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Student name is required"),
  rollNo: Yup.number()
    .typeError("Roll Number must be a number")
    .transform((value, original) => (original === "" ? undefined : value))
    .required("Roll Number is required")
    .min(1, "Roll Number must be at least 1"),
  grade: Yup.string().required("Grade is required"),
  section: Yup.string().required("Section is required"),
  guardianName: Yup.string().required("Parent/Guardian name is required"),
  email: Yup.string().email("Invalid email format").required("Email is required"),
  phone: Yup.string()
    .matches(/^[0-9]{10}$/, "Phone number must be 10 digits")
    .required("Phone number is required"),
});

const ListCreatePage: React.FC<{ setPageLoading?: (v: boolean) => void }> = ({
  setPageLoading,
}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const initialValues = {
    rollNo: "",
    name: "",
    grade: "",
    section: "",
    guardianName: "",
    email: "",
    phone: "",
  };

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Student</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              const payload = {
                rollNo: Number(values.rollNo),
                name: values.name,
                grade: values.grade,
                section: values.section,
                guardianName: values.guardianName,
                email: values.email,
                phone: values.phone,
              };

              await CreateListData(payload);
              resetForm();

              // signal parent to refetch the list (if provided)
              if (typeof setPageLoading === "function") {
                setPageLoading(true);
              }

              // navigate back and instruct ListPage to refresh
              navigate("/list", { state: { refresh: true } });
            } catch (error) {
              console.error("CreateListData error:", error);
              window.location.replace("/error");
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ errors, touched }) => (
            <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
              <div className="card-body">
                {/* Roll No */}
                <div className="fv-row mb-4">
                  <label className="required fs-6 fw-bold mb-2">Roll No :</label>
                  <Field
                    name="rollNo"
                    placeholder="Enter Roll Number"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.rollNo && errors.rollNo,
                      "is-valid": touched.rollNo && !errors.rollNo,
                    })}
                  />
                  {touched.rollNo && errors.rollNo && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{String(errors.rollNo)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Student Name */}
                <div className="fv-row mb-4">
                  <label className="required fs-6 fw-bold mb-2">Name :</label>
                  <Field
                    name="name"
                    placeholder="Enter Student Name"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.name && errors.name,
                      "is-valid": touched.name && !errors.name,
                    })}
                  />
                  {touched.name && errors.name && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{String(errors.name)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grade & Section (inline) */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <label className="required fs-6 fw-bold mb-2">Grade :</label>
                    <Field
                      name="grade"
                      placeholder="Enter Grade"
                      className={clsx("form-control form-control-lg form-control-solid", {
                        "is-invalid text-danger": touched.grade && errors.grade,
                        "is-valid": touched.grade && !errors.grade,
                      })}
                    />
                    {touched.grade && errors.grade && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{String(errors.grade)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label className="required fs-6 fw-bold mb-2">Section :</label>
                    <Field
                      name="section"
                      placeholder="Enter Section"
                      className={clsx("form-control form-control-lg form-control-solid", {
                        "is-invalid text-danger": touched.section && errors.section,
                        "is-valid": touched.section && !errors.section,
                      })}
                    />
                    {touched.section && errors.section && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{String(errors.section)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Guardian Name */}
                <div className="fv-row mb-4">
                  <label className="required fs-6 fw-bold mb-2">Parent / Guardian Name :</label>
                  <Field
                    name="guardianName"
                    placeholder="Enter Parent/Guardian Name"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.guardianName && errors.guardianName,
                      "is-valid": touched.guardianName && !errors.guardianName,
                    })}
                  />
                  {touched.guardianName && errors.guardianName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{String(errors.guardianName)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="fv-row mb-4">
                  <label className="required fs-6 fw-bold mb-2">Email :</label>
                  <Field
                    name="email"
                    type="email"
                    placeholder="Enter Email"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.email && errors.email,
                      "is-valid": touched.email && !errors.email,
                    })}
                  />
                  {touched.email && errors.email && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{String(errors.email)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className="fv-row mb-4">
                  <label className="required fs-6 fw-bold mb-2">Phone Number :</label>
                  <Field
                    name="phone"
                    placeholder="Enter 10-digit Phone Number"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.phone && errors.phone,
                      "is-valid": touched.phone && !errors.phone,
                    })}
                  />
                  {touched.phone && errors.phone && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{String(errors.phone)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="card-footer d-flex justify-content-end mt-4">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate("/list")}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {!loading && <span className="indicator-label">Submit</span>}
                    {loading && (
                      <span className="indicator-progress" style={{ display: "block" }}>
                        Please wait...{" "}
                        <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default ListCreatePage;
