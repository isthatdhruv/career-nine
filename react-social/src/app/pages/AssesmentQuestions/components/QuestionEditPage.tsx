import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes, ReadQuestionByIdData } from "../API/Question_APIs";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  section: Yup.object().shape({
    sectionId: Yup.string().required("Section is required"),
  }).required("Section is required"),
  options: Yup.array()
    .of(Yup.object().shape({
      optionText: Yup.string().required("Option cannot be empty"),
      description: Yup.string().optional(),
    }))
    .min(1, "At least one option is required"),
});

interface Option {
  optionText: string;
  description?: string;
  correct: boolean;
  sequence: number;
  optionId?: string;
}

const QuestionEditPage = (props?: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [mqt, setMqt] = useState<any[]>([]);
  const [questionData, setQuestionData] = useState<any>({
    questionText: "",
    questionType: "",
    section: "",
    questionOptions: [""],
    id: "",
  });

  // State for measured qualities per option: { [optionIdx]: { [typeId]: { checked: boolean, score: number } } }
  const [optionMeasuredQualities, setOptionMeasuredQualities] = useState<Record<number, Record<number, { checked: boolean, score: number }>>>({});

  // State for tracking option type (text vs image) per option index
  const [optionTypes, setOptionTypes] = useState<{ [key: number]: 'text' | 'image' }>({});
  // State for storing Base64 image data per option index
  const [optionImages, setOptionImages] = useState<{ [key: number]: string }>({});

  // Always call this hook at the top level, not conditionally
  useEffect(() => {
    if (questionData.options && questionData.options.length > 0) {
      const qualities: Record<number, Record<number, { checked: boolean, score: number }>> = {};
      const types: { [key: number]: 'text' | 'image' } = {};
      const images: { [key: number]: string } = {};
      
      questionData.options.forEach((option: any, idx: number) => {
        // Load measured quality scores
        if (option.optionScores && Array.isArray(option.optionScores)) {
          qualities[idx] = {};
          option.optionScores.forEach((scoreObj: any) => {
            if (scoreObj.measuredQualityType && scoreObj.measuredQualityType.measuredQualityTypeId != null) {
              qualities[idx][scoreObj.measuredQualityType.measuredQualityTypeId] = {
                checked: true,
                score: scoreObj.score
              };
            }
          });
        }
        
        // Load existing images - check if optionImageBase64 exists
        if (option.optionImageBase64) {
          types[idx] = 'image';
          // If it's already a data URL, use as is; otherwise prepend the data URL prefix
          images[idx] = option.optionImageBase64.startsWith('data:') 
            ? option.optionImageBase64 
            : `data:image/png;base64,${option.optionImageBase64}`;
        } else {
          types[idx] = 'text';
        }
      });
      
      setOptionMeasuredQualities(qualities);
      setOptionTypes(types);
      setOptionImages(images);
    }
  }, [questionData]);

  // Generate sequence options for dropdown
  const generateSequenceOptions = (maxSequence: number) => {
    return Array.from({ length: maxSequence }, (_, i) => i + 1);
  };

  // Update option sequence
  const updateOptionSequence = (index: number, newSequence: number) => {
    const currentOptions = [...formik.values.options];
    const optionToMove = currentOptions[index];
    
    // Remove the option from current position
    const otherOptions = currentOptions.filter((_, i) => i !== index);
    
    // Insert at new position
    const updatedOptions = [...otherOptions];
    updatedOptions.splice(newSequence - 1, 0, optionToMove);
    
    // Reassign sequences
    const resequencedOptions = updatedOptions.map((opt, idx) => ({
      ...opt,
      sequence: idx + 1
    }));
    
    formik.setFieldValue("options", resequencedOptions);
    
    // Update measured qualities mapping to maintain proper indexing
    const newQualities: Record<number, Record<number, { checked: boolean; score: number }>> = {};
    resequencedOptions.forEach((_, newIdx) => {
      // Find which original index this option came from
      let originalIdx = newIdx;
      if (newIdx < newSequence - 1) {
        originalIdx = newIdx >= index ? newIdx + 1 : newIdx;
      } else if (newIdx === newSequence - 1) {
        originalIdx = index;
      } else {
        originalIdx = newIdx >= index ? newIdx : newIdx - 1;
      }
      
      if (optionMeasuredQualities[originalIdx]) {
        newQualities[newIdx] = optionMeasuredQualities[originalIdx];
      }
    });
    setOptionMeasuredQualities(newQualities);
  };

  // Helper: toggle measured quality type for an option
  const handleQualityToggle = (optionIdx: number, typeId: number) => {
    setOptionMeasuredQualities((prev) => {
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
    setOptionMeasuredQualities((prev) => ({
      ...prev,
      [optionIdx]: {
        ...prev[optionIdx],
        [typeId]: { checked: true, score },
      },
    }));
  };

  // Toggle option type between text and image
  const toggleOptionType = (index: number) => {
    setOptionTypes(prev => ({
      ...prev,
      [index]: prev[index] === 'image' ? 'text' : 'image'
    }));
  };

  // Handle image file selection and convert to Base64
  const handleImageSelect = (index: number, file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOptionImages(prev => ({ ...prev, [index]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setOptionImages(prev => { const n = {...prev}; delete n[index]; return n; });
    }
  };

  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Fetch question data and sections when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          setLoading(true);
          // Fetch question data by ID
          const questionResponse = await ReadQuestionByIdData(id);
          console.log("Fetched question data:", questionResponse.data);

          // Process the question data to extract section properly
          const fetchedQuestion = questionResponse.data;


          const processedData = {
            ...fetchedQuestion,
            section: fetchedQuestion.section?.section || "",
            questionOptions: fetchedQuestion.options
              ? fetchedQuestion.options.map((option: any) => option.optionText || option)
              : [""]
          };

          console.log("Processed data with section:", processedData.section);
          setQuestionData(processedData);
        } catch (error) {
          console.error("Error fetching question:", error);
          // Try to get data from location state as fallback
          const locationData = (location.state as any)?.data;
          if (locationData) {
            const processedLocationData = {
              ...locationData,
              section: locationData.section?.section || locationData.section || "",
              questionOptions: locationData.options
                ? locationData.options.map((option: any) => option.optionText || option)
                : locationData.questionOptions || [""]
            };
            setQuestionData(processedLocationData);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback to location state if no ID in URL
        const locationData = (location.state as any)?.data;
        if (locationData) {
          const processedLocationData = {
            ...locationData,
            section: locationData.section?.section || locationData.section || "",
            questionOptions: locationData.options
              ? locationData.options.map((option: any) => option.optionText || option)
              : locationData.questionOptions || [""]
          };
          setQuestionData(processedLocationData);
        }
      }
    };
    
    const fetchSections = async () => {
      try {
        const response = await ReadQuestionSectionData();
        console.log("Fetched sections for edit:", response.data);
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };

    fetchData();
    fetchSections();
  }, [id, location.state]);


useEffect(() => {
  const fetchMeasuredQualityTypes = async () => {
    try {
      const response = await ReadMeasuredQualityTypes();
      console.log("Fetched sections for edit:", response.data);
      setMqt(response.data);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
  };
  fetchMeasuredQualityTypes();
}, []);


// ✅ Keep using useFormik but with enhanced initial values
const formik = useFormik({
  enableReinitialize: true,
  initialValues: {
    id: questionData.id || id,
    questionId: questionData.questionId || questionData.id || id,
    questionText: questionData.questionText || "",
    questionType: questionData.questionType || "",
    maxOptionsAllowed: questionData.maxOptionsAllowed || 0,
    section: questionData.section && typeof questionData.section === "object" && "sectionId" in questionData.section
      ? { sectionId: String(questionData.section.sectionId) }
      : questionData.section
      ? { sectionId: String(questionData.section) }
      : { sectionId: "" },
    options:
      questionData.options && questionData.options.length > 0
        ? questionData.options.map((option: any, idx: number) => ({
            optionText: option.optionText || "",
            description: option.description || "",
            correct: option.correct ?? false,
            sequence: option.sequence || idx + 1,
            ...(option.optionId ? { optionId: option.optionId } : {}),
          }))
        : [
            {
              optionText: "",
              description: "",
              correct: false,
              sequence: 1,
            },
          ],
  },
  validationSchema: validationSchema,
  onSubmit: async (values) => {
    setLoading(true);
    try {
      // Sort options by sequence before processing
      const sortedOptions = [...values.options].sort((a, b) => a.sequence - b.sequence);
      
      // Build options array with optionScores from optionMeasuredQualities
      const options = sortedOptions.map((option: any, idx: number) => {
        // Check if this option is in image mode
        const isImageMode = optionTypes[idx] === 'image';
        
        const qualities = optionMeasuredQualities[idx] || {};
        const optionScores = Object.entries(qualities)
          .filter(([_, v]) => v && v.checked)
          .map(([typeId, v]) => ({
            score: v.score,
            question_option: option.optionId ? { optionId: option.optionId } : {},
            measuredQualityType: { measuredQualityTypeId: Number(typeId) },
          }));
        return {
          optionText: isImageMode ? null : option.optionText,
          optionImageBase64: isImageMode ? (optionImages[idx] || null) : null,
          description: option.description || "",
          optionScores,
          correct: option.correct ?? false,
          sequence: option.sequence,
          ...(option.optionId ? { optionId: option.optionId } : {}),
        };
      });

      const payload = {
        id: values.id,
        questionId: values.questionId,
        questionText: values.questionText,
        questionType: values.questionType,
        maxOptionsAllowed: Number(values.maxOptionsAllowed) || 0,
        options,
        section: { sectionId: values.section.sectionId },
      };
      
      console.log("Submitting payload:", payload);
      await CreateQuestionData(payload);
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

// Debug effect to log formik values
useEffect(() => {
  console.log("Current questionData:", questionData);
  console.log("Current formik section:", formik.values.section);
  console.log("Available sections:", sections);
}, [questionData, formik.values.section, sections]);

if (loading) {
  return (
    <div className="container py-5">
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading question...</p>
      </div>
    </div>
  );
}

// ✅ Helper functions for managing options array (since we can't use FieldArray)
const addOption = () => {
  const currentOptions = [...formik.values.options];
  const lastOption = currentOptions[currentOptions.length - 1];
  if (lastOption && lastOption.optionText.trim() !== "") {
    const newOption = {
      optionText: "",
      description: "",
      correct: false,
      sequence: currentOptions.length + 1, // Auto-increment sequence
    };
    formik.setFieldValue("options", [...currentOptions, newOption]);
    setOptionMeasuredQualities((prev) => ({
      ...prev,
      [currentOptions.length]: {},
    }));
  } else {
    alert("Please fill the current option before adding a new one.");
  }
};

const removeOption = (index: number) => {
  const currentOptions = [...formik.values.options];
  if (currentOptions.length > 1) {
    const newOptions = currentOptions.filter((_, i) => i !== index);
    // Reassign sequences after removal
    const resequencedOptions = newOptions.map((opt, idx) => ({
      ...opt,
      sequence: idx + 1
    }));
    formik.setFieldValue("options", resequencedOptions);
    
    // Update measured qualities mapping
    setOptionMeasuredQualities((prev) => {
      const newQualities: Record<number, Record<number, { checked: boolean; score: number }>> = {};
      Object.keys(prev).forEach((key) => {
        const k = Number(key);
        if (k < index) newQualities[k] = prev[k];
        else if (k > index) newQualities[k - 1] = prev[k];
      });
      return newQualities;
    });
    
    // Also remove option type and image data
    setOptionTypes(prev => { const n = {...prev}; delete n[index]; return n; });
    setOptionImages(prev => { const n = {...prev}; delete n[index]; return n; });
  }
};

const updateOption = (index: number, value: string) => {
  const currentOptions = [...formik.values.options];
  currentOptions[index].optionText = value;
  formik.setFieldValue("options", currentOptions);
};

const updateOptionDescription = (index: number, value: string) => {
  const currentOptions = [...formik.values.options];
  currentOptions[index].description = value;
  formik.setFieldValue("options", currentOptions);
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
              <option value="single-choice">Single Choice</option>
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
              value={formik.values.section?.sectionId || ""}
              onChange={e => {
                const selectedSection = sections.find(s => String(s.sectionId) === e.target.value);
                formik.setFieldValue("section", selectedSection ? { sectionId: String(selectedSection.sectionId) } : { sectionId: "" });
              }}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid text-danger":
                    formik.touched.section && formik.errors.section,
                },
                {
                  "is-valid":
                    formik.touched.section && !formik.errors.section,
                }
              )}
            >
              <option value="">Select Section</option>
              {sections.map(section => (
                <option key={section.sectionId} value={section.sectionId}>
                  {section.sectionName}
                  {section.sectionDescription && ` - ${section.sectionDescription}`}
                </option>
              ))}
            </select>
            {formik.touched.section && formik.errors.section && (
              <div className="fv-plugins-message-container">
                <div className="fv-help-block text-danger">
                  <span role="alert">{String(formik.errors.section)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Options - Manual implementation since FieldArray won't work with useFormik */}
            <div className="fv-row mb-7">
            <label className="required fs-6 fw-bold mb-2">Options:</label>

            {/* Options Table */}
            <div className="table-responsive">
              <table className="table table-row-bordered">
                <thead>
                  <tr className="fw-bold fs-6 text-gray-800">
                    <th style={{ minWidth: "80px" }}>Sequence</th>
                    <th>Option Text & Description</th>
                    <th style={{ minWidth: "200px" }}>Measured Quality Types</th>
                    <th style={{ minWidth: "100px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formik.values.options
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((option, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={option.sequence}
                          onChange={(e) => updateOptionSequence(index, parseInt(e.target.value))}
                        >
                          {generateSequenceOptions(formik.values.options.length).map(seq => (
                            <option key={seq} value={seq}>{seq}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {/* Toggle Switch for Text/Image */}
                        <div className="d-flex align-items-center mb-2">
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              id={`edit-option-type-${index}`}
                              checked={optionTypes[index] === 'image'}
                              onChange={() => toggleOptionType(index)}
                            />
                            <label className="form-check-label small" htmlFor={`edit-option-type-${index}`}>
                              {optionTypes[index] === 'image' ? '📷' : '📝'}
                            </label>
                          </div>
                        </div>
                        
                        {optionTypes[index] === 'image' ? (
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageSelect(index, e.target.files?.[0] || null)}
                              className="form-control form-control-sm mb-2"
                            />
                            {optionImages[index] && (
                              <div className="position-relative d-inline-block">
                                <img 
                                  src={optionImages[index]} 
                                  alt={`Option ${option.sequence}`}
                                  style={{ maxWidth: 100, maxHeight: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger position-absolute"
                                  style={{ top: -6, right: -6, padding: '1px 5px', fontSize: 10 }}
                                  onClick={() => handleImageSelect(index, null)}
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="mb-2">
                              <input
                                type="text"
                                placeholder={`Enter option ${option.sequence}`}
                                value={option.optionText}
                                onChange={e => updateOption(index, e.target.value)}
                                className={clsx(
                                  "form-control form-control-sm",
                                  {
                                    "is-invalid text-danger": !option.optionText,
                                    "is-valid": !!option.optionText,
                                  }
                                )}
                              />
                            </div>
                            <textarea
                              placeholder={`Description (optional)`}
                              value={option.description || ""}
                              onChange={e => updateOptionDescription(index, e.target.value)}
                              className="form-control form-control-sm"
                              rows={2}
                              style={{ resize: "vertical" }}
                            />
                          </>
                        )}
                      </td>
                      <td>
                        <Dropdown>
                          <Dropdown.Toggle
                            variant="secondary"
                            id={`dropdown-option-${index}`}
                            size="sm"
                          >
                            Quality Types
                          </Dropdown.Toggle>
                          <Dropdown.Menu style={{ minWidth: 250 }}>
                            <Dropdown.Header>Measured Quality Types</Dropdown.Header>
                            <div style={{ maxHeight: 250, overflowY: "auto", padding: 8 }}>
                              {mqt.map((type: any, i: number) => (
                                <div key={type.measuredQualityTypeId}>
                                  <div className="d-flex align-items-center mb-2">
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
                                </div>
                              ))}
                            </div>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {formik.values.options.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => removeOption(index)}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                          {index === formik.values.options.length - 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={addOption}
                            >
                              <i className="fas fa-plus"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {typeof formik.errors.options === "string" && (
              <div className="fv-plugins-message-container">
                <div className="fv-help-block text-danger">
                  <span role="alert">{formik.errors.options}</span>
                </div>
              </div>
            )}
          </div>

          {/* Max Options Allowed */}
          <div className="fv-row mb-7">
            <label className="fs-6 fw-bold mb-2">Max Options Allowed</label>
            <input
              type="number"
              min={0}
              max={100}
              value={formik.values.maxOptionsAllowed}
              onChange={e =>
                formik.setFieldValue("maxOptionsAllowed", e.target.value)
              }
              placeholder="Max Options Allowed"
              className="form-control form-control-lg form-control-solid"
              style={{ width: 200 }}
            />
          </div>
        </div> {/* Close card-body */}

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

