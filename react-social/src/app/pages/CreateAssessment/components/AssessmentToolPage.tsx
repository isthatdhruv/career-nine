import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadToolData } from "../../Tool/API/Tool_APIs";
import ToolCreateModal from "../../Tool/components/ToolCreateModal";

const validationSchema = Yup.object().shape({
  toolId: Yup.string().required("Tool is required"),
});

const AssessmentToolPage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [tools, setTools] = useState<any[]>([]);
  const [showToolModal, setShowToolModal] = useState(false);
  const [initialValues, setInitialValues] = useState({ toolId: "" });

  // Load saved step1 data
  useEffect(() => {
    const savedStep1 = localStorage.getItem("assessmentStep1");
    if (savedStep1) {
      const parsed = JSON.parse(savedStep1);
      setInitialValues({ toolId: "" }); // only step 2 field; step1 data stays in localStorage
    }
  }, []);

  useEffect(() => {
    const fetchTool = async () => {
      try {
        const response = await ReadToolData();
        setTools(response.data || []);
      } catch (error) {
        console.error("Error fetching tool:", error);
      }
    };

    fetchTool();
  }, []);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0 mt-5">Select Tool For This Assessment</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              // Retrieve previous step1 data
              const savedStep1 = localStorage.getItem("assessmentStep1");
              const step1Data = savedStep1 ? JSON.parse(savedStep1) : {};

              // Combine step1 + step2 data
              const payload = {
                ...step1Data,
                toolId: values.toolId,
              };

              // Save payload for step2
              localStorage.setItem("assessmentStep2", JSON.stringify(payload));

              // Navigate to step 3
              navigate("/assessments/create/step-3");
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

                {/* Select Tool */}
                <div className="fv-row mb-7">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="required fs-6 fw-bold">Select Tool</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-light-primary"
                      onClick={() => setShowToolModal(true)}
                    >
                      Add New Tool
                    </button>
                  </div>

                  {/* Tool Modal */}
                  <ToolCreateModal
                    setPageLoading={setPageLoading ?? (() => {})}
                    show={showToolModal}
                    onHide={() => setShowToolModal(false)}
                  />

                  <Field
                    as="select"
                    name="toolId"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": touched.toolId && errors.toolId,
                      },
                      {
                        "is-valid": touched.toolId && !errors.toolId,
                      }
                    )}
                  >
                    <option value="">Select Tool</option>
                    {tools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name}
                      </option>
                    ))}
                  </Field>

                  {touched.toolId && errors.toolId && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.toolId}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="card-footer d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate(-1)} // Go back to step 1
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {!loading && <span className="indicator-label">Next</span>}
                    {loading && (
                      <span
                        className="indicator-progress"
                        style={{ display: "block" }}
                      >
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

export default AssessmentToolPage;
