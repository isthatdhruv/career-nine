import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import QuestionSectionCreateModal from "../../QuestionSections/components/QuestionSectionCreateModal";

const validationSchema = Yup.object().shape({
  sectionId: Yup.string().required("Section is required"),
});

const AssessmentSection = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [sections, setSections] = useState<any[]>([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [initialValues, setInitialValues] = useState({ sectionId: "" });

  // Load saved step1 data
  useEffect(() => {
    const savedStep1 = localStorage.getItem("assessmentStep1");
    if (savedStep1) {
      setInitialValues({ sectionId: "" });
    }
  }, []);

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data || []);
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
          <h1 className="mb-0 mt-5">Select Section For This Assessment</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              const savedStep1 = localStorage.getItem("assessmentStep1");
              const step1Data = savedStep1 ? JSON.parse(savedStep1) : {};

              const payload = {
                ...step1Data,
                sectionId: values.sectionId,
              };

              localStorage.setItem("assessmentStep2", JSON.stringify(payload));
              navigate("/assessments/create/step-5");
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
                {/* Select Section */}
                <div className="fv-row mb-7">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="required fs-6 fw-bold">Select Section</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-light-primary"
                      onClick={() => setShowSectionModal(true)}
                    >
                      Add New Section
                    </button>
                  </div>

                  {/* Section Modal */}
                  <QuestionSectionCreateModal
                    show={showSectionModal}
                    onHide={() => setShowSectionModal(false)}
                  />

                  <Field
                    as="select"
                    name="sectionId"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": touched.sectionId && errors.sectionId,
                        "is-valid": touched.sectionId && !errors.sectionId,
                      }
                    )}
                  >
                    <option value="">Select Section</option>
                    {sections.map((section) => (
                      <option key={section.sectionId} value={section.sectionId}>
                        {section.sectionName}
                      </option>
                    ))}
                  </Field>

                  {touched.sectionId && errors.sectionId && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.sectionId}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="card-footer d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate(-1)}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {!loading && <span className="indicator-label">Next</span>}
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

export default AssessmentSection;
