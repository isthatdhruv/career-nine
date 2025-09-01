import clsx from "clsx";
import { Formik, Form, Field } from "formik";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateMeasuredQualityTypesData } from "../API/Measured_Quality_Types_APIs";
import { ReadMeasuredQualityTypesData } from "../API/Measured_Quality_Types_APIs";

const validationSchema = Yup.object().shape({
  qualityTypeName: Yup.string().required("Quality Type name is required"),
  qualityTypeDescription: Yup.string().required("Quality Type description is required"),
  qualityTypeDisplayName: Yup.string().required("Quality Type display name is required"),
});

const MeasuredQualityTypesCreatePage = ({ setPageLoading }: { setPageLoading: any }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    qualityTypeName: "",
    qualityTypeDescription: "",
    qualityTypeDisplayName: "",
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadMeasuredQualityTypesData();
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
          <h1 className="mb-0">Add Measured Quality Types</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              await CreateMeasuredQualityTypesData(values);
              resetForm();
              navigate("/measured-quality-types");
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
                {/* Quality Type Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Quality Type Name :
                  </label>
                  <Field
                    as="textarea"
                    name="qualityTypeName"
                    placeholder="Enter Quality Type Name"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.qualityTypeName && errors.qualityTypeName,
                      },
                      {
                        "is-valid": touched.qualityTypeName && !errors.qualityTypeName,
                      }
                    )}
                  />
                  {touched.qualityTypeName && errors.qualityTypeName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.qualityTypeName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quality Type Description */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Quality Type Description :
                  </label>
                  <Field
                    as="textarea"
                    name="qualityTypeDescription"
                    placeholder="Enter Quality Type Description"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.qualityTypeDescription &&
                          errors.qualityTypeDescription,
                      },
                      {
                        "is-valid":
                          touched.qualityTypeDescription &&
                          !errors.qualityTypeDescription,
                      }
                    )}
                  />
                  {touched.qualityTypeDescription && errors.qualityTypeDescription && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.qualityTypeDescription}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Display Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Quality Type Display Name :
                  </label>
                  <Field
                    as="textarea"
                    name="qualityTypeDisplayName"
                    placeholder="Enter Display Name"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.qualityTypeDisplayName && errors.qualityTypeDisplayName,
                      },
                      {
                        "is-valid":
                          touched.qualityTypeDisplayName && !errors.qualityTypeDisplayName,
                      }
                    )}
                  />
                  {touched.qualityTypeDisplayName && errors.qualityTypeDisplayName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.qualityTypeDisplayName}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-footer d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-light me-2"
                  onClick={() => navigate("/measured-quality-types")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
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

export default MeasuredQualityTypesCreatePage;
