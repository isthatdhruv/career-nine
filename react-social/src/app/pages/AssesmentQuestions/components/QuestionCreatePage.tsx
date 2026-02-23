import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes } from "../API/Question_APIs";
import { MQT } from "./MeasuredQualityTypesAsOptionComponent"; // Adjust the import based on your file structure
import { ListGamesData } from "../../Games/components/API/GAME_APIs";

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
  const [useMQTAsOptions, setUseMQTAsOptions] = React.useState(false);
  const navigate = useNavigate();

  // NEW: State for tracking option type (text vs image) per option index
  const [optionTypes, setOptionTypes] = useState<{ [key: number]: 'text' | 'image' }>({});
  // NEW: State for storing Base64 image data per option index
  const [optionImages, setOptionImages] = useState<{ [key: number]: string }>({});

  // NEW: Game as option states
  const [useGameAsOption, setUseGameAsOption] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  const [isMQT, setIsMQT] = useState(false);

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
      
      // Shift keys for optionMeasuredQualities
      setOptionMeasuredQualities((prevMQ: any) => {
        const newMQ: any = {};
        Object.keys(prevMQ).forEach(key => {
          const k = Number(key);
          if (k < index) newMQ[k] = prevMQ[k];
          else if (k > index) newMQ[k - 1] = prevMQ[k];
        });
        return newMQ;
      });

      // Shift keys for optionTypes
      setOptionTypes((prevTypes: any) => {
        const newTypes: any = {};
        Object.keys(prevTypes).forEach(key => {
          const k = Number(key);
          if (k < index) newTypes[k] = prevTypes[k];
          else if (k > index) newTypes[k - 1] = prevTypes[k];
        });
        return newTypes;
      });

      // Shift keys for optionImages
      setOptionImages((prevImages: any) => {
        const newImages: any = {};
        Object.keys(prevImages).forEach(key => {
          const k = Number(key);
          if (k < index) newImages[k] = prevImages[k];
          else if (k > index) newImages[k - 1] = prevImages[k];
        });
        return newImages;
      });

      return { ...prev, questionOptions: newOptions };
    });
  };

  // NEW: Toggle option type between text and image
  const toggleOptionType = (index: number) => {
    setOptionTypes(prev => ({
      ...prev,
      [index]: prev[index] === 'image' ? 'text' : 'image'
    }));
  };

  // NEW: Handle image file selection and convert to Base64
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

  // Update option text
  const updateOption = (index: number, value: string) => {
    setFormikValues((prev: any) => {
      const newOptions = [...prev.questionOptions];
      // Handle both string and object types
      if (typeof newOptions[index] === 'string') {
        newOptions[index] = value;
      } else {
        // If it's an object (MQT or has description), update the optionText property
        newOptions[index] = { ...newOptions[index], optionText: value };
      }
      return { ...prev, questionOptions: newOptions };
    });
  };

  // NEW: Update option description
  const updateOptionDescription = (index: number, value: string) => {
    setFormikValues((prev: any) => {
      const newOptions = [...prev.questionOptions];
      const current = newOptions[index];
      if (typeof current === 'string') {
         // Convert string to object
         newOptions[index] = { optionText: current, optionDescription: value };
      } else {
         newOptions[index] = { ...current, optionDescription: value };
      }
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

  // NEW: Fetch games on mount
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await ListGamesData();
        setGames(response.data);
      } catch (error) {
        setGames([]);
      }
    };
    fetchGames();
  }, []);

  // Reset form when useGameAsOption changes
  useEffect(() => {
    if (useGameAsOption) {
      // When switching to game mode, reset options and other states
      setFormikValues(v => ({ ...v, questionOptions: [] }));
      setOptionMeasuredQualities({});
      setUseMQTAsOptions(false);
    } else {
      setSelectedGameId("");
    }
  }, [useGameAsOption]);

  useEffect(() => {
    if (!useMQTAsOptions && !useGameAsOption) {
      setFormikValues(v => ({
        ...v,
        questionOptions: [""], // or your preferred default
      }));
      setOptionMeasuredQualities({});
    }
  }, [useMQTAsOptions]);

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
              console.log("Submitting form. optionMeasuredQualities state:", optionMeasuredQualities);
              // Build options array with optionScores
              let options: any[] = [];
              
              if (useGameAsOption && selectedGameId) {
                // Game as option mode - single option with game reference
                options = [{
                  optionText: null,
                  optionImageBase64: null,
                  optionScores: [],
                  correct: false,
                  isGame: true,
                  game: { gameId: Number(selectedGameId) }
                }];
              } else {
                // Regular options mode
                options = formikValues.questionOptions.map((option: any, index: number) => {
                  // Check if this option is in image mode
                  const isImageMode = optionTypes[index] === 'image';
                  
                  // Handle both string options (manual) and object options (MQT)
                  const optionText = isImageMode ? null : (typeof option === 'string' ? option : option.optionText);
                  const optionImageBase64 = isImageMode ? (optionImages[index] || null) : null;
                  const isCorrect = typeof option === 'string' ? false : (option.correct || false);
                  const optionDescription = typeof option === 'string' ? null : (option.optionDescription || null);
                  
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
                    optionImageBase64,
                    optionScores,
                    correct: isCorrect,
                    isGame: false,
                    game: null,
                    optionDescription
                  };
                });
              }

              // Compose payload
              const payload = {
                questionText: formikValues.questionText,
                questionType: formikValues.questionType,
                maxOptionsAllowed: Number(formikValues.maxOptionsAllowed) || 0,
                isMQT: isMQT,
                options,
                section: { sectionId: Number(formikValues.sectionId) },
                flag: useMQTAsOptions ? 1 : 0
              };

              console.log("Payload to submit:", payload);
              await CreateQuestionData(payload);
              setFormikValues(initialValues);
              setOptionMeasuredQualities({});
              setOptionTypes({});
              setOptionImages({});
              setSelectedGameId("");
              setUseGameAsOption(false);
              navigate("/assessment-questions");
            } catch (error) {
              console.error("Error creating question:", error);
              // window.location.replace("/error");
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
                <option value="single-choice">Single Choice</option>
                <option value="ranking">Ranking</option>

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
              
              {/* Game as Option Mode */}
              {useGameAsOption ? (
                <div className="p-3 border rounded bg-light">
                  <div className="d-flex align-items-center mb-2">
                    <span className="me-2 fw-bold">🎮 Select Game:</span>
                  </div>
                  <select
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": !selectedGameId,
                        "is-valid": !!selectedGameId,
                      }
                    )}
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                  >
                    <option value="">Select a Game</option>
                    {games.map((game) => (
                      <option key={game.gameId} value={game.gameId}>
                        {game.gameName} (Code: {game.gameCode})
                      </option>
                    ))}
                  </select>
                  {selectedGameId && (
                    <div className="mt-2 text-success">
                      ✅ Game selected. This question will launch the selected game as an option.
                    </div>
                  )}
                </div>
              ) : useMQTAsOptions ? (
                <MQT
                  mqt={mqt}
                  formikValues={formikValues}
                  setFormikValues={setFormikValues}
                />
              ) : (
                formikValues.questionOptions.map((option: any, index: number) => {
                  const optionText = typeof option === 'string' ? option : option.optionText;
                  const isImageMode = optionTypes[index] === 'image';
                  return (
                  <div key={index} className="mb-3 p-3 border rounded bg-light">
                    {/* Toggle Switch for Text/Image */}
                    <div className="d-flex align-items-center mb-2">
                      <span className="me-2 fw-bold">Option {index + 1}:</span>
                      <div className="form-check form-switch ms-auto">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id={`option-type-switch-${index}`}
                          checked={isImageMode}
                          onChange={() => toggleOptionType(index)}
                        />
                        <label className="form-check-label" htmlFor={`option-type-switch-${index}`}>
                          {isImageMode ? '📷 Image' : '📝 Text'}
                        </label>
                      </div>
                    </div>

                    <div className="d-flex align-items-start gap-2">
                      {/* Conditionally render Text Input OR Image Upload */}
                      {isImageMode ? (
                        <div className="flex-grow-1">
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
                                alt={`Option ${index + 1}`}
                                style={{ maxWidth: 150, maxHeight: 100, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-danger position-absolute"
                                style={{ top: -8, right: -8, padding: '2px 8px', fontSize: 12 }}
                                onClick={() => handleImageSelect(index, null)}
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder={`Enter option ${index + 1}`}
                          value={optionText}
                          onChange={e => updateOption(index, e.target.value)}
                          className={clsx(
                            "form-control form-control-lg form-control-solid flex-grow-1",
                            {
                              "is-invalid text-danger": !optionText,
                              "is-valid": !!optionText,
                            }
                          )}
                        />
                      )}
                      
                      <Dropdown>
                        <Dropdown.Toggle
                          variant="secondary"
                          id={`dropdown-option-${index}`}
                          size="sm"
                        >
                          MQT
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

                      {/* Display Selected Measured Qualities */}
                      {optionMeasuredQualities[index] && Object.keys(optionMeasuredQualities[index]).length > 0 && (
                        <div className="mt-2" style={{ width: '100%' }}>
                          <div className="small text-muted mb-1">Selected:</div>
                          <div className="d-flex flex-wrap gap-1">
                            {Object.entries(optionMeasuredQualities[index])
                              .filter(([_, value]: any) => value.checked)
                              .map(([typeId, value]: any) => {
                                const qualityType = mqt.find((q: any) => q.measuredQualityTypeId === Number(typeId));
                                return qualityType ? (
                                  <div
                                    key={typeId}
                                    className="badge bg-primary d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                                  >
                                    <span>{qualityType.measuredQualityTypeName}</span>
                                    <span className="badge bg-light text-dark ms-1">{value.score}</span>
                                    <button
                                      type="button"
                                      className="btn-close btn-close-white"
                                      style={{ fontSize: '0.5rem', padding: 0, width: '0.6rem', height: '0.6rem' }}
                                      onClick={() => handleQualityToggle(index, Number(typeId))}
                                      aria-label="Remove"
                                    />
                                  </div>
                                ) : null;
                              })}
                          </div>
                        </div>
                      )}

                      {formikValues.questionOptions.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeOption(index)}
                        >
                          -
                        </button>
                      )}
                      {index === formikValues.questionOptions.length - 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={addOption}
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* NEW: Option Description Field */}
                    <div className="mt-2">
                       <label className="fs-7 fw-semibold mb-1 text-muted">Option Description:</label>
                       <textarea
                         className="form-control form-control-sm"
                         rows={2}
                         placeholder="Enter description for this option (optional)"
                         value={(typeof option === 'string' ? '' : option.optionDescription) || ''}
                         onChange={(e) => updateOptionDescription(index, e.target.value)}
                       />
                    </div>
                  </div>
                  );
                })
              )}
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
            <div className="fv-row mb-7">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="isMQTToggle"
                  checked={isMQT}
                  onChange={() => setIsMQT(v => !v)}
                />
                <label className="form-check-label fs-6 fw-bold" htmlFor="isMQTToggle">
                  isMQT
                </label>
              </div>
            </div>
            <div className="mb-4 d-flex gap-4">
              <label>
                <input
                  type="checkbox"
                  checked={useMQTAsOptions}
                  onChange={() => {
                    setUseMQTAsOptions(v => !v);
                    if (!useMQTAsOptions) setUseGameAsOption(false);
                  }}
                  className="me-2"
                  disabled={useGameAsOption}
                />
                Use Measured Quality Types as Options
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={useGameAsOption}
                  onChange={() => {
                    setUseGameAsOption(v => !v);
                    if (!useGameAsOption) setUseMQTAsOptions(false);
                  }}
                  className="me-2"
                  disabled={useMQTAsOptions}
                />
                🎮 Use Game as Option
              </label>
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

