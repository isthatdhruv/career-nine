import clsx from "clsx";
import { Formik, Form, Field } from "formik";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateMeasuredQualitiesData } from "../API/Measured_Qualities_APIs";
import { ReadMeasuredQualitiesData } from "../API/Measured_Qualities_APIs";

const validationSchema = Yup.object().shape({
  qualityName: Yup.string().required("Quality name is required"),
  qualityDescription: Yup.string().required("Quality description is required"),
  displayName: Yup.string().required("Display name is required"),
});

const MeasuredQualitiesCreatePage = ({
  setPageLoading,
}: {
  setPageLoading: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    qualityName: "",
    qualityDescription: "",
    displayName: "",
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadMeasuredQualitiesData();
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
          <h1 className="mb-0">Add Measured Qualities</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              await CreateMeasuredQualitiesData(values);
              resetForm();
              navigate("/measured-qualities");
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
                {/* Quality Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Quality Name :
                  </label>
                  <Field
                    as="textarea"
                    name="qualityName"
                    placeholder="Enter Quality Name"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.qualityName && errors.qualityName,
                      },
                      {
                        "is-valid": touched.qualityName && !errors.qualityName,
                      }
                    )}
                  />
                  {touched.qualityName && errors.qualityName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.qualityName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quality Description */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Quality Description :
                  </label>
                  <Field
                    as="textarea"
                    name="qualityDescription"
                    placeholder="Enter Quality Description"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.qualityDescription &&
                          errors.qualityDescription,
                      },
                      {
                        "is-valid":
                          touched.qualityDescription &&
                          !errors.qualityDescription,
                      }
                    )}
                  />
                  {touched.qualityDescription && errors.qualityDescription && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.qualityDescription}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Display Name :
                  </label>
                  <Field
                    as="textarea"
                    name="displayName"
                    placeholder="Enter Display Name"
                    rows={4}
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
              </div>

              <div className="card-footer d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-light me-2"
                  onClick={() => navigate("/measured-qualities")}
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
    </div>
  );
};

export default MeasuredQualitiesCreatePage;
