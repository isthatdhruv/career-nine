import clsx from "clsx";
import { Field, FieldArray, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData } from "../API/Question_APIs";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  sectionId: Yup.string().required("Section is required"),
  questionOptions: Yup.array()
    .of(Yup.string().required("Option cannot be empty"))
    .min(1, "At least one option is required"),
  maxoptionsAllowed: Yup.number().when("questionOptions", {
    is: (questionOptions: any[], schema: any) => {
      const maxOptionsAllowed = schema.parent?.maxOptionsAllowed;
      return questionOptions && typeof maxOptionsAllowed === "number" && maxOptionsAllowed <= questionOptions.length;
    },
    then: Yup.number()
      .required("Maximum options allowed is required and Should be a positive number"),
  }),
});

const QuestionCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
    const [loading, setLoading] = useState(false);
    const [sections, setSections] = useState<any[]>([]);
    const navigate = useNavigate();

    const initialValues = {
      questionText: "",
      questionType: "",
      sectionId: "",
      questionOptions: [""],
    };


    useEffect(() => {
      const fetchSections = async () => {
        try {
          const response = await ReadQuestionSectionData();
          console.log("Fetched sections data:", response.data);
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
            <h1 className="mb-0">Add Assessment Question</h1>
          </div>

          <Formik
            enableReinitialize
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={async (values, { resetForm }) => {
              setLoading(true);
              try {
                console.log("Creating question with values:", values);
                console.log("Section ID being sent:", values.sectionId);
                await CreateQuestionData(values);
                resetForm();
                navigate("/assessment-questions");
              } catch (error) {
                console.error("Error creating question:", error);
                window.location.replace("/error");
              } finally {
                setLoading(false);
              }
            }}

          >
            {({ values, errors, touched }) => (
              <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
                <div className="card-body">


                  <div className="fv-row mb-7">
                    <label className="required fs-6 fw-bold mb-2">
                      Question Text:
                    </label>
                    <Field
                      as="textarea"
                      name="questionText"
                      placeholder="Enter Question Text"
                      rows={4}
                      className={clsx(
                        "form-control form-control-lg form-control-solid",
                        {
                          "is-invalid text-danger":
                            touched.questionText && errors.questionText,
                        },
                        {
                          "is-valid":
                            touched.questionText && !errors.questionText,
                        }
                      )}
                    />
                    {touched.questionText && errors.questionText && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{errors.questionText}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="fv-row mb-7">
                    <label className="required fs-6 fw-bold mb-2">
                      Question Type:
                    </label>
                    <Field
                      as="select"
                      name="questionType"
                      className={clsx(
                        "form-control form-control-lg form-control-solid",
                        {
                          "is-invalid text-danger":
                            touched.questionType && errors.questionType,
                        },
                        {
                          "is-valid":
                            touched.questionType && !errors.questionType,
                        }
                      )}
                    >
                      <option value="">Select Question Type</option>
                      <option value="multiple-choice">Multiple Choice</option>
                      {/* <option value="true-false">True/False</option>
                    <option value="short-answer">Short Answer</option>
                    <option value="essay">Essay</option>
                    <option value="fill-in-blank">Fill in the Blank</option> */}
                    </Field>
                    {touched.questionType && errors.questionType && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{errors.questionType}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="fv-row mb-7">
                    <label className="required fs-6 fw-bold mb-2">
                      Section
                    </label>
                    <Field
                      as="select"
                      name="sectionId"
                      className={clsx(
                        "form-control form-control-lg form-control-solid",
                        {
                          "is-invalid text-danger":
                            touched.sectionId && errors.sectionId,
                        },
                        {
                          "is-valid":
                            touched.sectionId && !errors.sectionId,
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

                  <div className="fv-row mb-7">
                    <label className="required fs-6 fw-bold mb-2">Options:</label>

                    <FieldArray name="questionOptions">
                      {({ push, remove }) => (
                        <div>
                          {values.questionOptions.map((_, index) => (
                            <div
                              key={index}
                              className="d-flex align-items-center gap-2 mb-2"
                            >
                              <Field
                                name={`questionOptions.${index}`}
                                placeholder={`Enter option ${index + 1}`}
                                className={clsx(
                                  "form-control form-control-lg form-control-solid w-50",
                                  {
                                    "is-invalid text-danger":
                                      touched.questionOptions?.[index] &&
                                      (errors.questionOptions as any)?.[index],
                                  },
                                  {
                                    "is-valid":
                                      touched.questionOptions?.[index] &&
                                      !(errors.questionOptions as any)?.[index],
                                  }
                                )}
                              />

                              {index === values.questionOptions.length - 1 ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    const last =
                                      values.questionOptions[
                                      values.questionOptions.length - 1
                                      ];
                                    if (last && last.trim() !== "") {
                                      push("");
                                    } else {
                                      alert(
                                        "Please fill the current option before adding a new one."
                                      );
                                    }
                                  }}
                                >
                                  +
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => remove(index)}
                                >
                                  -
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </FieldArray>

                    {typeof errors.questionOptions === "string" && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{errors.questionOptions}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="fv-row mb-7">
                    <Field>
                      <label className="fs-6 fw-bold mb-2">
                        Set Maximum Number Of Options Allowed To Be Selected For This Question.
                        <input
                          type="number"
                          name="maxOptionsAllowed"
                          className="form-control form-control-lg form-control-solid mt-2"
                          min={1}
                          placeholder="Enter maximum options allowed"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value > 0) {
                              (values as any).maxOptionsAllowed = value;
                            } else {

                            }
                          }}
                        />
                      </label>
                    </Field>
                  </div>
                </div>

                <div className="card-footer d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate("/assessment-questions")}
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
                        Please wait...{" "}
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

  export default QuestionCreatePage;
