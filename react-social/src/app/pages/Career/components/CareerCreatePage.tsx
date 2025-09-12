<<<<<<< HEAD
import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateCareerData, ReadCareerData } from "../API/Career_APIs";

const validationSchema = Yup.object().shape({
  careerName: Yup.string().required("Career name is required"),
  careerDescription: Yup.string().required("Career description is required"),
  // displayName: Yup.string().required("Display name is required"),
});

const CareerCreatePage = ({
  setPageLoading,
}: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    careerName: "",
    careerDescription: "",
    // displayName: "",
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadCareerData();
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };
    fetchSections();
  }, []);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Career</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              await CreateCareerData(values);
              resetForm();
              navigate("/careers");
            } catch (error) {
              console.error(error);
              window.location.replace("/error");
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ errors, touched }) => (
            <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
              <div className="card-body">
                {/* Career Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Career Name :
                  </label>
                  <Field
                    as="input"
                    name="careerName"
                    placeholder="Enter Career Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.careerName && errors.careerName,
                      },
                      {
                        "is-valid": touched.careerName && !errors.careerName,
                      }
                    )}
                  />
                  {touched.careerName && errors.careerName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.careerName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Career Description */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Career Description :
                  </label>
                  <Field
                    as="textarea"
                    name="careerDescription"
                    placeholder="Enter Career Description"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.careerDescription &&
                          errors.careerDescription,
                      },
                      {
                        "is-valid":
                          touched.careerDescription &&
                          !errors.careerDescription,
                      }
                    )}
                  />
                  {touched.careerDescription && errors.careerDescription && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.careerDescription}</span>
                      </div>
                    </div>
                  )}
                </div>
{/* 
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Display Name :
                  </label>
                  <Field
                    as="input"
                    name="displayName"
                    placeholder="Enter Display Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.displayName && errors.displayName,
                      },
                      {
                        "is-valid": touched.displayName && !errors.displayName,
                      }
                    )}
                  />
                  {touched.displayName && errors.displayName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.displayName}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div> */}
              </div>

              <div className="card-footer d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-light me-2"
                  onClick={() => navigate("/careers")}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {!loading && <span className="indicator-label">Submit</span>}
                  {loading && (
                    <span
                      className="indicator-progress"
                      style={{ display: "block" }}
                    >
                      Please wait...
                      <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                    </span>
                  )}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
=======
import { useFormik } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateCareerData } from "../API/Career_APIs";

const validationSchema = Yup.object().shape({
  title: Yup.string().required("Title is required"),
  description: Yup.string().required("Description is required"),
});

const CareerCreatePage = (props?: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      title: "",
      description: "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const response = await CreateCareerData(values);
        navigate("/career");
        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }
      } catch (error) {
        alert("Failed to create career. Please try again.");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="container py-5">
      <form onSubmit={formik.handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Title</label>
          <input
            type="text"
            className="form-control"
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.title && formik.errors.title && (
            <div className="text-danger">{formik.errors.title}</div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label">Description</label>
          <input
            type="text"
            className="form-control"
            name="description"
            value={formik.values.description}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.description && formik.errors.description && (
            <div className="text-danger">{formik.errors.description}</div>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Create Career"}
        </button>
      </form>
>>>>>>> origin/palak
    </div>
  );
};

export default CareerCreatePage;
