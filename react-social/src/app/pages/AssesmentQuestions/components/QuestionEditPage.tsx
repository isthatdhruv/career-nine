import clsx from "clsx";
import { useFormik } from "formik";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateQuestionData } from "../API/Question_APIs";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  sectionType: Yup.string().required("Section is required"),
  questionOptions: Yup.array()
    .of(Yup.string().required("Option cannot be empty"))
    .min(1, "At least one option is required"),
});

const QuestionEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  
  const questionData = (location.state as any)?.data || {
    questionText: "",
    questionType: "",
    sectionType: "",
    questionOptions: [""],
    id: "",
  };

  // ✅ Keep using useFormik but with enhanced initial values
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: questionData.id,
      questionText: questionData.questionText || "",
      questionType: questionData.questionType || "",
      sectionType: questionData.sectionType || questionData.section?.sectionName || "",
      questionOptions: questionData.questionOptions && questionData.questionOptions.length > 0 
        ? questionData.questionOptions 
        : [""],
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update question:");
        console.log("Question ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert("No question ID found. Please try navigating back and selecting the question again.");
          return;
        }

        const response = await UpdateQuestionData(values.id, values);
        console.log("Update successful:", response);

        navigate("/assessment-questions");

        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }

      } catch (error) {
        console.error("Full error object:", error);
        if (typeof error === "object" && error !== null) {
          console.error("Error response:", (error as any).response);
          console.error("Error message:", (error as any).message);
          console.error("Error status:", (error as any).response?.status);
          console.error("Error data:", (error as any).response?.data);

          const errorMessage = (error as any).response?.data?.message || (error as any).message || "Unknown error occurred";
          alert(`Failed to update question: ${errorMessage}`);
        } else {
          alert("Failed to update question: Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
  });

  // ✅ Fetch sections data
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };
    fetchSections();
  }, []);

  // ✅ Helper functions for managing options array (since we can't use FieldArray)
  const addOption = () => {
    const currentOptions = formik.values.questionOptions;
    const lastOption = currentOptions[currentOptions.length - 1];
    
    if (lastOption && lastOption.trim() !== "") {
      formik.setFieldValue("questionOptions", [...currentOptions, ""]);
    } else {
      alert("Please fill the current option before adding a new one.");
    }
  };

  const removeOption = (index: number) => {
    const currentOptions = formik.values.questionOptions;
    if (currentOptions.length > 1) {
      const newOptions = currentOptions.filter((_, i) => i !== index);
      formik.setFieldValue("questionOptions", newOptions);
    }
  };

  const updateOption = (index: number, value: string) => {
    const currentOptions = [...formik.values.questionOptions];
    currentOptions[index] = value;
    formik.setFieldValue("questionOptions", currentOptions);
  };

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h1 className="mb-0">Edit Assessment Question</h1>
          <button
            className="btn btn-sm btn-icon btn-active-color-primary"
            onClick={() => navigate(-1)}
            aria-label="Close"
          >
            <UseAnimations
              animation={menu2}
              size={28}
              strokeColor={"#181C32"}
              reverse={true}
            />
          </button>
        </div>

        <form
          className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
          onSubmit={formik.handleSubmit}
        >
          <div className="card-body">

            {/* Question Text */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Question Text:
              </label>
              <textarea
                placeholder="Enter Question Text"
                rows={4}
                {...formik.getFieldProps("questionText")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.questionText && formik.errors.questionText,
                  },
                  {
                    "is-valid":
                      formik.touched.questionText && !formik.errors.questionText,
                  }
                )}
              />
              {formik.touched.questionText && formik.errors.questionText && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.questionText)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Question Type */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Question Type:
              </label>
              <select
                {...formik.getFieldProps("questionType")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.questionType && formik.errors.questionType,
                  },
                  {
                    "is-valid":
                      formik.touched.questionType && !formik.errors.questionType,
                  }
                )}
              >
                <option value="">Select Question Type</option>
                <option value="multiple-choice">Multiple Choice</option>
              </select>
              {formik.touched.questionType && formik.errors.questionType && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.questionType)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section Type */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Section
              </label>
              <select
                {...formik.getFieldProps("sectionType")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.sectionType && formik.errors.sectionType,
                  },
                  {
                    "is-valid":
                      formik.touched.sectionType && !formik.errors.sectionType,
                  }
                )}
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.sectionName}>
                    {section.sectionName}
                  </option>
                ))}
              </select>
              {formik.touched.sectionType && formik.errors.sectionType && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.sectionType)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Options - Manual implementation since FieldArray won't work with useFormik */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Options:</label>
              
              {formik.values.questionOptions.map((option, index) => (
                <div
                  key={index}
                  className="d-flex align-items-center gap-2 mb-2"
                >
                  <input
                    type="text"
                    placeholder={`Enter option ${index + 1}`}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    onBlur={() => formik.setFieldTouched(`questionOptions.${index}`, true)}
                    className={clsx(
                      "form-control form-control-lg form-control-solid w-50",
                      {
                        "is-invalid text-danger":
                          formik.touched.questionOptions?.[index] &&
                          (formik.errors.questionOptions as any)?.[index],
                      },
                      {
                        "is-valid":
                          formik.touched.questionOptions?.[index] &&
                          !(formik.errors.questionOptions as any)?.[index],
                      }
                    )}
                  />

                  {index === formik.values.questionOptions.length - 1 ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={addOption}
                    >
                      +
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeOption(index)}
                    >
                      -
                    </button>
                  )}
                </div>
              ))}

              {typeof formik.errors.questionOptions === "string" && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{formik.errors.questionOptions}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
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
              {!loading && <span className="indicator-label">Update</span>}
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
        </form>
      </div>
    </div>
  );
};

export default QuestionEditPage;
