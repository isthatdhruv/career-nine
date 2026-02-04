import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { Modal, Dropdown, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes } from "../API/Question_APIs";
import { MQT } from "./MeasuredQualityTypesAsOptionComponent";
import { ListGamesData } from "../../games/components/API/GAME_APIs";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  sectionId: Yup.string().required("Section is required"),
  maxOptionsAllowed: Yup.number()
});

interface QuestionCreateModalProps {
  show: boolean;
  onHide: () => void;
  setPageLoading?: any;
}

const QuestionCreateModal: React.FC<QuestionCreateModalProps> = ({ show, onHide, setPageLoading }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [mqt, setMqt] = useState<any[]>([]);
  const [optionMeasuredQualities, setOptionMeasuredQualities] = useState<any>({});
  const [useMQTAsOptions, setUseMQTAsOptions] = useState(false);
  const navigate = useNavigate();

  // State for tracking option type (text vs image) per option index
  const [optionTypes, setOptionTypes] = useState<{ [key: number]: 'text' | 'image' }>({});
  // State for storing Base64 image data per option index
  const [optionImages, setOptionImages] = useState<{ [key: number]: string }>({});

  // Game as option states
  const [useGameAsOption, setUseGameAsOption] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  const initialValues = {
    questionText: "",
    questionType: "",
    maxOptionsAllowed: "",
    questionOptions: [""],
    sectionId: ""
  };

  const [formikValues, setFormikValues] = useState(initialValues);

  const handleQualityToggle = (optionIdx: number, typeId: number) => {
    setOptionMeasuredQualities((prev: any) => {
      const prevForOption = prev[optionIdx] || {};
      const current = prevForOption[typeId];
      if (current && current.checked) {
        const { [typeId]: _, ...rest } = prevForOption;
        return { ...prev, [optionIdx]: rest };
      } else {
        return {
          ...prev,
          [optionIdx]: { ...prevForOption, [typeId]: { checked: true, score: 0 } }
        };
      }
    });
  };

  const handleQualityScoreChange = (optionIdx: number, typeId: number, score: number) => {
    setOptionMeasuredQualities((prev: any) => ({
      ...prev,
      [optionIdx]: {
        ...prev[optionIdx],
        [typeId]: { checked: true, score },
      },
    }));
  };

  const addOption = () => {
    setFormikValues((prev: any) => ({ ...prev, questionOptions: [...prev.questionOptions, ""] }));
  };

  const removeOption = (index: number) => {
    setFormikValues((prev: any) => {
      const newOptions = prev.questionOptions.filter((_: any, i: number) => i !== index);
      const newMeasured = { ...optionMeasuredQualities };
      delete newMeasured[index];
      setOptionMeasuredQualities(newMeasured);
      // Also remove option type and image data
      setOptionTypes(prev => { const n = {...prev}; delete n[index]; return n; });
      setOptionImages(prev => { const n = {...prev}; delete n[index]; return n; });
      return { ...prev, questionOptions: newOptions };
    });
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

  const updateOption = (index: number, value: string) => {
    setFormikValues((prev: any) => {
      const newOptions = [...prev.questionOptions];
      newOptions[index] = value;
      return { ...prev, questionOptions: newOptions };
    });
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch {
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
      } catch {
        setMqt([]);
      }
    };
    fetchMQT();
  }, []);

  // Fetch games on mount
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await ListGamesData();
        setGames(response.data);
      } catch {
        setGames([]);
      }
    };
    fetchGames();
  }, []);

  // Reset form when useGameAsOption changes
  useEffect(() => {
    if (useGameAsOption) {
      setFormikValues(v => ({ ...v, questionOptions: [] }));
      setOptionMeasuredQualities({});
      setUseMQTAsOptions(false);
    } else {
      setSelectedGameId("");
    }
  }, [useGameAsOption]);

  useEffect(() => {
    if (!useMQTAsOptions && !useGameAsOption) {
      setFormikValues(v => ({ ...v, questionOptions: [""] }));
      setOptionMeasuredQualities({});
    }
  }, [useMQTAsOptions, useGameAsOption]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
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
          
          // Handle both cases: when useMQTAsOptions is true (options are objects) and false (options are strings)
          const optionText = isImageMode ? null : (typeof option === 'string' ? option : option.optionText);
          const optionImageBase64 = isImageMode ? (optionImages[index] || null) : null;
          const optionScores: any[] = [];
          
          if (optionMeasuredQualities[index]) {
            Object.entries(optionMeasuredQualities[index]).forEach(([typeId, val]: any) => {
              if (val.checked) {
                optionScores.push({
                  score: val.score || 1,
                  measuredQualityType: {
                    measuredQualityTypeId: Number(typeId)
                  }
                });
              }
            });
          }
          return {
            optionText,
            optionImageBase64,
            optionScores,
            correct: false,
            isGame: false,
            game: null
          };
        });
      }

      const payload = {
        questionText: formikValues.questionText,
        questionType: formikValues.questionType,
        maxOptionsAllowed: Number(formikValues.maxOptionsAllowed) || 0,
        options,
        section: { sectionId: Number(formikValues.sectionId) },
        flag : useMQTAsOptions ? 1 : 0
      };
      console.log(payload);

      await CreateQuestionData(payload);
      setFormikValues(initialValues);
      setOptionMeasuredQualities({});
      setOptionTypes({});
      setOptionImages({});
      setSelectedGameId("");
      setUseGameAsOption(false);
      onHide();
      navigate("/assessment-questions");
    } catch (error) {
      console.error(error);
      // window.location.replace("/error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Assessment Question</Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Question Text */}
          <div className="mb-3">
            <label className="form-label fw-bold">Question Text:</label>
            <textarea
              rows={4}
              className={clsx("form-control", {
                "is-invalid": !formikValues.questionText,
                "is-valid": !!formikValues.questionText,
              })}
              value={formikValues.questionText}
              onChange={e => setFormikValues(v => ({ ...v, questionText: e.target.value }))}
            />
          </div>

          {/* Question Type */}
          <div className="mb-3">
            <label className="form-label fw-bold">Question Type:</label>
            <select
              className={clsx("form-control", {
                "is-invalid": !formikValues.questionType,
                "is-valid": !!formikValues.questionType,
              })}
              value={formikValues.questionType}
              onChange={e => setFormikValues(v => ({ ...v, questionType: e.target.value }))}
            >
              <option value="">Select Question Type</option>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="single-choice">Single-Choice</option>
            </select>
          </div>

          {/* Section */}
          <div className="mb-3">
            <label className="form-label fw-bold">Section:</label>
            <select
              className={clsx("form-control", {
                "is-invalid": !formikValues.sectionId,
                "is-valid": !!formikValues.sectionId,
              })}
              value={formikValues.sectionId}
              onChange={e => setFormikValues(v => ({ ...v, sectionId: e.target.value }))}
            >
              <option value="">Select Section</option>
              {sections.map(s => (
                <option key={s.sectionId} value={s.sectionId}>
                  {s.sectionName}
                  {s.sectionDescription && ` - ${s.sectionDescription}`}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="mb-3">
            <label className="form-label fw-bold">Options:</label>
            
            {/* Game as Option Mode */}
            {useGameAsOption ? (
              <div className="p-3 border rounded bg-light">
                <div className="d-flex align-items-center mb-2">
                  <span className="me-2 fw-bold">🎮 Select Game:</span>
                </div>
                <select
                  className={clsx("form-control", {
                    "is-invalid": !selectedGameId,
                    "is-valid": !!selectedGameId,
                  })}
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
                  <div className="mt-2 text-success small">
                    ✅ Game selected. This question will launch the selected game.
                  </div>
                )}
              </div>
            ) : useMQTAsOptions ? (
              <MQT mqt={mqt} formikValues={formikValues} setFormikValues={setFormikValues} />
            ) : (
              formikValues.questionOptions.map((option, index) => {
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
                        id={`modal-option-type-${index}`}
                        checked={isImageMode}
                        onChange={() => toggleOptionType(index)}
                      />
                      <label className="form-check-label" htmlFor={`modal-option-type-${index}`}>
                        {isImageMode ? '📷 Image' : '📝 Text'}
                      </label>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-2">
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
                              style={{ maxWidth: 120, maxHeight: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-danger position-absolute"
                              style={{ top: -8, right: -8, padding: '2px 8px', fontSize: 10 }}
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
                        value={option}
                        onChange={e => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className={clsx("form-control flex-grow-1", { "is-invalid": !option, "is-valid": !!option })}
                      />
                    )}
                    <Dropdown>
                      <Dropdown.Toggle variant="secondary" size="sm">MQTs</Dropdown.Toggle>
                      <Dropdown.Menu style={{ minWidth: 250 }}>
                        <Dropdown.Header>Measured Quality Types</Dropdown.Header>
                        <div style={{ maxHeight: 250, overflowY: "auto", padding: 8 }}>
                          {mqt.map((type, i) => (
                            <div key={type.measuredQualityTypeId} className="d-flex align-items-center mb-2">
                              <input
                                type="checkbox"
                                checked={!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked}
                                onChange={() => handleQualityToggle(index, type.measuredQualityTypeId)}
                                className="form-check-input me-2"
                              />
                              <label className="me-2 mb-0">{type.measuredQualityTypeName}</label>
                              {!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked && (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={optionMeasuredQualities[index][type.measuredQualityTypeId]?.score ?? 0}
                                  onChange={e => handleQualityScoreChange(index, type.measuredQualityTypeId, Number(e.target.value))}
                                  className="form-control form-control-sm ms-2"
                                  style={{ width: 70 }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </Dropdown.Menu>
                    </Dropdown>
                    {formikValues.questionOptions.length > 1 && (
                      <Button variant="danger" size="sm" onClick={() => removeOption(index)}>-</Button>
                    )}
                    {index === formikValues.questionOptions.length - 1 && (
                      <Button variant="primary" size="sm" onClick={addOption}>+</Button>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>

          {/* Max Options Allowed */}
          <div className="mb-3">
            <label className="form-label fw-bold">Max Options Allowed:</label>
            <input
              type="number"
              min={0}
              max={100}
              value={formikValues.maxOptionsAllowed}
              onChange={e => setFormikValues(v => ({ ...v, maxOptionsAllowed: e.target.value }))}
              className="form-control w-25"
            />
          </div>

          {/* Use MQT as Options / Use Game as Option */}
          <div className="mb-3 d-flex gap-4">
            <div className="form-check">
              <input
                type="checkbox"
                checked={useMQTAsOptions}
                onChange={() => {
                  setUseMQTAsOptions(v => !v);
                  if (!useMQTAsOptions) setUseGameAsOption(false);
                }}
                className="form-check-input"
                id="useMQTAsOptions"
                disabled={useGameAsOption}
              />
              <label className="form-check-label" htmlFor="useMQTAsOptions">
                Use MQT as Options
              </label>
            </div>
            <div className="form-check">
              <input
                type="checkbox"
                checked={useGameAsOption}
                onChange={() => {
                  setUseGameAsOption(v => !v);
                  if (!useGameAsOption) setUseMQTAsOptions(false);
                }}
                className="form-check-input"
                id="useGameAsOption"
                disabled={useMQTAsOptions}
              />
              <label className="form-check-label" htmlFor="useGameAsOption">
                🎮 Use Game as Option
              </label>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default QuestionCreateModal;
