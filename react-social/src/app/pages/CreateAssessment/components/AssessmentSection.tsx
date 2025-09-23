import clsx from "clsx";
import { Field, Form, Formik, FieldArray } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import QuestionSectionCreateModal from "../../QuestionSections/components/QuestionSectionCreateModal";

const validationSchema = Yup.object().shape({
  sectionIds: Yup.array().min(1, "At least one section must be selected"),
});

const AssessmentSection = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [sections, setSections] = useState<any[]>([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [initialValues, setInitialValues] = useState({ sectionIds: [] as string[] });

  // Load saved step1 data
  useEffect(() => {
    const savedStep1 = localStorage.getItem("assessmentStep1");
    if (savedStep1) {
      setInitialValues({ sectionIds: [] });
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
  }, [!showSectionModal]);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0 mt-5">Select Sections For This Assessment</h1>
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
                sectionIds: values.sectionIds,
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
          {({ errors, touched, values }) => (
            <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
              <div className="card-body">
                {/* Select Sections */}
                <div className="fv-row mb-7">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="required fs-6 fw-bold">Select Sections</label>
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

                  <FieldArray name="sectionIds">
                    {({ push, remove }) => (
                      <div className={clsx(
                        "border rounded p-3",
                        {
                          "border-danger": touched.sectionIds && errors.sectionIds,
                          "border-success": touched.sectionIds && !errors.sectionIds && values.sectionIds.length > 0,
                        }
                      )}>
                        {sections.length > 0 ? (
                          <div className="row">
                            {sections.map((section) => {
                              const isChecked = values.sectionIds.includes(section.sectionId);
                              return (
                                <div key={section.sectionId} className="col-md-6 col-lg-4 mb-3">
                                  <div className="form-check">
                                    <Field
                                      type="checkbox"
                                      name="sectionIds"
                                      value={section.sectionId}
                                      className="form-check-input"
                                      id={`section-${section.sectionId}`}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        if (e.target.checked) {
                                          push(section.sectionId);
                                        } else {
                                          const index = values.sectionIds.indexOf(section.sectionId);
                                          if (index > -1) {
                                            remove(index);
                                          }
                                        }
                                      }}
                                    />
                                    <label 
                                      className="form-check-label fw-semibold"
                                      htmlFor={`section-${section.sectionId}`}
                                    >
                                      {section.sectionName}
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-muted text-center py-3">
                            No sections available. Please create a new section.
                          </div>
                        )}
                      </div>
                    )}
                  </FieldArray>

                  {touched.sectionIds && errors.sectionIds && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.sectionIds}</span>
                      </div>
                    </div>
                  )}

                  {values.sectionIds.length > 0 && (
                    <div className="mt-3">
                      <small className="text-muted">
                        Selected: {values.sectionIds.length} section{values.sectionIds.length !== 1 ? 's' : ''}
                      </small>
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
