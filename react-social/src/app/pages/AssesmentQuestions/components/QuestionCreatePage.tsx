import clsx from "clsx";
import { useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes } from "../API/Question_APIs";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  sectionId: Yup.string().required("Section is required"),
  maxOptionsAllowed: Yup.number()
});

const QuestionCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {

  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [mqt, setMqt] = useState<any[]>([]); // Measured Quality Types
  const [optionMeasuredQualities, setOptionMeasuredQualities] = useState<any>({});
  const navigate = useNavigate();

  const initialValues = {
    questionText: "",
    questionType: "",
    maxOptionsAllowed: "",
    questionOptions: [""],
    sectionId: ""
  };


  // Helper: toggle measured quality type for an option
  const handleQualityToggle = (optionIdx: number, typeId: number) => {
    setOptionMeasuredQualities((prev: any) => {
      const prevForOption = prev[optionIdx] || {};
      const current = prevForOption[typeId];
      if (current && current.checked) {
        // Uncheck
        const { [typeId]: _, ...rest } = prevForOption;
        return { ...prev, [optionIdx]: rest };
      } else {
        // Check with default score 0
        return {
          ...prev,
          [optionIdx]: {
            ...prevForOption,
            [typeId]: { checked: true, score: 0 },
          },
        };
      }
    });
  };

  // Helper: change score for a measured quality type for an option
  const handleQualityScoreChange = (optionIdx: number, typeId: number, score: number) => {
    setOptionMeasuredQualities((prev: any) => ({
      ...prev,
      [optionIdx]: {
        ...prev[optionIdx],
        [typeId]: { checked: true, score },
      },
    }));
  };

  // Add option
  const addOption = () => {
    setFormikValues((prev: any) => {
      const newOptions = [...prev.questionOptions, ""];
      return { ...prev, questionOptions: newOptions };
    });
  };

  // Remove option
  const removeOption = (index: number) => {
    setFormikValues((prev: any) => {
      const newOptions = prev.questionOptions.filter((_: any, i: number) => i !== index);
      // Remove measured qualities for this option
      const newMeasured = { ...optionMeasuredQualities };
      delete newMeasured[index];
      setOptionMeasuredQualities(newMeasured);
      return { ...prev, questionOptions: newOptions };
    });
  };

  // Update option text
  const updateOption = (index: number, value: string) => {
    setFormikValues((prev: any) => {
      const newOptions = [...prev.questionOptions];
      newOptions[index] = value;
      return { ...prev, questionOptions: newOptions };
    });
  };

  // Formik state management for manual option array
  const [formikValues, setFormikValues] = useState(initialValues);



  // Fetch sections and measured quality types on mount (but do not fetch scores)
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch (error) {
        setSections([]);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    const fetchMQT = async () => {
      try {
        const response = await ReadMeasuredQualityTypes();
        setMqt(response.data);
      } catch (error) {
        setMqt([]);
      }
    };
    fetchMQT();
  }, []);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Assessment Question</h1>
        </div>

        <form
          className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              // Build options array with optionScores
              const options = formikValues.questionOptions.map((optionText: string, index: number) => {
                // Build optionScores for this option
                const optionScores: any[] = [];
                if (optionMeasuredQualities[index]) {
                  Object.entries(optionMeasuredQualities[index]).forEach(([typeId, val]: any) => {
                    if (val.checked) {
                      optionScores.push({
                        score: val.score,
                        question_option: {}, // leave empty as per your payload
                        measuredQualityType: { measuredQualityTypeId: Number(typeId) }
                      });
                    }
                  });
                }
                return {
                  optionText,
                  optionScores,
                  correct: false // or set as needed
                };
              });

              // Compose payload
              const payload = {
                questionText: formikValues.questionText,
                questionType: formikValues.questionType,
                maxOptionsAllowed: Number(formikValues.maxOptionsAllowed) || 0,
                options,
                section: { sectionId: Number(formikValues.sectionId) }
              };

              console.log("Payload to submit:", payload);
              await CreateQuestionData(payload);
              setFormikValues(initialValues);
              setOptionMeasuredQualities({});
              navigate("/assessment-questions");
            } catch (error) {
              console.error("Error creating question:", error);
              window.location.replace("/error");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="card-body">
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Question Text:</label>
              <textarea
                name="questionText"
                placeholder="Enter Question Text"
                rows={4}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger": !formikValues.questionText,
                    "is-valid": !!formikValues.questionText,
                  }
                )}
                value={formikValues.questionText}
                onChange={e => setFormikValues(v => ({ ...v, questionText: e.target.value }))}
              />
            </div>
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Question Type:</label>
              <select
                name="questionType"
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger": !formikValues.questionType,
                    "is-valid": !!formikValues.questionType,
                  }
                )}
                value={formikValues.questionType}
                onChange={e => setFormikValues(v => ({ ...v, questionType: e.target.value }))}
              >
                <option value="">Select Question Type</option>
                <option value="multiple-choice">Multiple Choice</option>
              </select>
            </div>
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Section</label>
              <select
                name="sectionId"
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger": !formikValues.sectionId,
                    "is-valid": !!formikValues.sectionId,
                  }
                )}
                value={formikValues.sectionId}
                onChange={e => setFormikValues(v => ({ ...v, sectionId: e.target.value }))}
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.sectionId} value={section.sectionId}>
                    {section.sectionName}
                  </option>
                ))}
              </select>
            </div>
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Options:</label>
              {formikValues.questionOptions.map((option, index) => (
                <div key={index} className="d-flex align-items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={`Enter option ${index + 1}`}
                    value={option}
                    onChange={e => updateOption(index, e.target.value)}
                    className={clsx(
                      "form-control form-control-lg form-control-solid w-50",
                      {
                        "is-invalid text-danger": !option,
                        "is-valid": !!option,
                      }
                    )}
                  />
                  <Dropdown>
                    <Dropdown.Toggle
                      variant="secondary"
                      id={`dropdown-option-${index}`}
                      size="sm"
                    >
                      Measured Quality Types
                    </Dropdown.Toggle>
                    <Dropdown.Menu style={{ minWidth: 250 }}>
                      <Dropdown.Header>Measured Quality Types</Dropdown.Header>
                      <div style={{ maxHeight: 250, overflowY: "auto", padding: 8 }}>
                        {mqt.map((type: any, i: number) => (
                          <>
                            <div key={type.measuredQualityTypeId} className="d-flex align-items-center mb-2">
                              <input
                                type="checkbox"
                                checked={!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked}
                                onChange={() => handleQualityToggle(index, type.measuredQualityTypeId)}
                                className="form-check-input me-2"
                                id={`option-${index}-type-${type.measuredQualityTypeId}`}
                              />
                              <label htmlFor={`option-${index}-type-${type.measuredQualityTypeId}`} className="me-2 mb-0">
                                {type.measuredQualityTypeName}
                              </label>
                              {!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked && (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={optionMeasuredQualities[index][type.measuredQualityTypeId]?.score ?? 0}
                                  onChange={e =>
                                    handleQualityScoreChange(index, type.measuredQualityTypeId, Number(e.target.value))
                                  }
                                  placeholder="Score"
                                  className="form-control form-control-sm ms-2"
                                  style={{ width: 70 }}
                                />
                              )}
                            </div>
                            {i < mqt.length - 1 && <hr style={{ margin: '4px 0' }} />}
                          </>
                        ))}
                      </div>
                    </Dropdown.Menu>
                  </Dropdown>
                  {formikValues.questionOptions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger ms-2"
                      onClick={() => removeOption(index)}
                    >
                      -
                    </button>
                  )}
                  {index === formikValues.questionOptions.length - 1 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary ms-2"
                      onClick={addOption}
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="fv-row mb-7">
              <label className="fs-6 fw-bold mb-2">Max Options Allowed</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formikValues.maxOptionsAllowed}
                onChange={e =>
                  setFormikValues(v => ({
                    ...v,
                    maxOptionsAllowed: e.target.value
                  }))
                }
                placeholder="Max Options Allowed"
                className="form-control form-control-lg form-control-solid w-25"
                style={{ width: 200 }}
              />
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
        </form>
      </div>
    </div>
  );
};

export default QuestionCreatePage;

