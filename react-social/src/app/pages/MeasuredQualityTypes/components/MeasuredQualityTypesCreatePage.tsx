import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateMeasuredQualityTypesData, ReadMeasuredQualityTypesData } from "../API/Measured_Quality_Types_APIs";

const validationSchema = Yup.object().shape({
  measuredQualityTypeName: Yup.string().required("Quality Type name is required"),
  measuredQualityTypeDescription: Yup.string().required("Quality Type description is required"),
  measuredQualityTypeDisplayName: Yup.string().required("Quality Type display name is required"),
});

const MeasuredQualityTypesCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    measuredQualityTypeName: "",
    measuredQualityTypeDescription: "",
    measuredQualityTypeDisplayName: "",
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
                    as="input"
                    name="measuredQualityTypeName"
                    placeholder="Enter Quality Type Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.measuredQualityTypeName && errors.measuredQualityTypeName,
                      },
                      {
                        "is-valid": touched.measuredQualityTypeName && !errors.measuredQualityTypeName,
                      }
                    )}
                  />
                  {touched.measuredQualityTypeName && errors.measuredQualityTypeName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.measuredQualityTypeName}</span>
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
                    name="measuredQualityTypeDescription"
                    placeholder="Enter Quality Type Description"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.measuredQualityTypeDescription &&
                          errors.measuredQualityTypeDescription,
                      },
                      {
                        "is-valid":
                          touched.measuredQualityTypeDescription &&
                          !errors.measuredQualityTypeDescription
                      }
                    )}
                  />
                  {touched.measuredQualityTypeDescription &&
                    errors.measuredQualityTypeDescription && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{errors.measuredQualityTypeDescription}</span>
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
                    as="input"
                    name="measuredQualityTypeDisplayName"
                    placeholder="Enter Display Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.measuredQualityTypeDisplayName && errors.measuredQualityTypeDisplayName,
                      },
                      {
                        "is-valid":
                          touched.measuredQualityTypeDisplayName && !errors.measuredQualityTypeDisplayName
                      }
                    )}
                  />
                  {touched.measuredQualityTypeDisplayName && errors.measuredQualityTypeDisplayName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.measuredQualityTypeDisplayName}</span>
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
