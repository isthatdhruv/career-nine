import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateMeasuredQualitiesData, ReadMeasuredQualitiesData } from "../API/Measured_Qualities_APIs";

const validationSchema = Yup.object().shape({
  measuredQualityName: Yup.string().required("Quality name is required"),
  measuredQualityDescription: Yup.string().required("Quality description is required"),
  qualityDisplayName: Yup.string().required("Display name is required"),
});

const MeasuredQualitiesCreatePage = ({
  setPageLoading,
}: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    measuredQualityName: "",
    measuredQualityDescription: "",
    qualityDisplayName: "",
  };

  useEffect(() => {
   
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
              console.log(values);
              await CreateMeasuredQualitiesData(values);
              // resetForm();
              // navigate("/measured-qualities");
            } catch (error) {
              console.error(error);
              // window.location.replace("/error");
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
                    as="input"
                    name="measuredQualityName"
                    placeholder="Enter Quality Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.measuredQualityName && errors.measuredQualityName,
                      },
                      {
                        "is-valid": touched.measuredQualityName && !errors.measuredQualityName,
                      }
                    )}
                  />
                  {touched.measuredQualityName && errors.measuredQualityName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.measuredQualityName}</span>
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
                    name="measuredQualityDescription"
                    placeholder="Enter Quality Description"
                    rows={4}
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.measuredQualityDescription &&
                          errors.measuredQualityDescription,
                      },
                      {
                        "is-valid":
                          touched.measuredQualityDescription &&
                          !errors.measuredQualityDescription,
                      }
                    )}
                  />
                  {touched.measuredQualityDescription && errors.measuredQualityDescription && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.measuredQualityDescription}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Display Name :
                  </label>
                  <Field
                    as="input"
                    name="qualityDisplayName"
                    placeholder="Enter Display Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.qualityDisplayName && errors.qualityDisplayName,
                      },
                      {
                        "is-valid": touched.qualityDisplayName && !errors.qualityDisplayName,
                      }
                    )}
                  />
                  {touched.qualityDisplayName && errors.qualityDisplayName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.qualityDisplayName}</span>
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
