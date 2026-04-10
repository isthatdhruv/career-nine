import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal, Dropdown, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { showErrorToast } from '../../../utils/toast';
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes, UploadQuestionMedia } from "../API/Question_APIs";
import { MQT } from "./MeasuredQualityTypesAsOptionComponent";
import { ListGamesData } from "../../Games/components/API/GAME_APIs";
import { convertImageToWebP, generateVideoThumbnail, compressVideo } from "../../../utils/imageUtils";

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
  // State for storing processed WebP Base64 image data per option index (for preview and upload)
  const [optionImages, setOptionImages] = useState<{ [key: number]: string }>({});
  // State for tracking which option images are being processed
  const [optionImageProcessing, setOptionImageProcessing] = useState<{ [key: number]: boolean }>({});
  // State for pending image confirmation popup (custom overlay portal)
  const [pendingImage, setPendingImage] = useState<
    { source: 'question'; base64: string; originalWidth: number; originalHeight: number; originalSize: number; finalWidth: number; finalHeight: number; finalSize: number }
    | { source: 'option'; index: number; base64: string; originalWidth: number; originalHeight: number; originalSize: number; finalWidth: number; finalHeight: number; finalSize: number }
    | null
  >(null);

  // Game as option states
  const [useGameAsOption, setUseGameAsOption] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // Question media type: 'text' | 'image' | 'video'
  const [questionMediaType, setQuestionMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [questionMediaBase64, setQuestionMediaBase64] = useState<string>("");
  const [questionMediaProcessing, setQuestionMediaProcessing] = useState(false);
  const [questionVideoThumbnail, setQuestionVideoThumbnail] = useState<string>("");
  const [videoCompressProgress, setVideoCompressProgress] = useState<number>(0);

  // Handle question image upload — convert to webp and compress, then show confirmation popup
  const handleQuestionImageSelect = async (file: File | null) => {
    if (!file) { setQuestionMediaBase64(""); return; }
    setQuestionMediaProcessing(true);
    try {
      const result = await convertImageToWebP(file, 0.8, 1280, 720);
      setPendingImage({
        source: 'question', base64: result.base64,
        originalWidth: result.originalWidth, originalHeight: result.originalHeight, originalSize: result.originalSize,
        finalWidth: result.finalWidth, finalHeight: result.finalHeight, finalSize: result.finalSize,
      });
    } catch (error) {
      console.error("Error converting image to WebP:", error);
      showErrorToast("Failed to process image. Please try a different file.");
    } finally {
      setQuestionMediaProcessing(false);
    }
  };

  // Handle question video upload — compress with FFmpeg.wasm
  const handleQuestionVideoSelect = async (file: File | null) => {
    if (!file) { setQuestionMediaBase64(""); setQuestionVideoThumbnail(""); return; }
    setQuestionMediaProcessing(true);
    setVideoCompressProgress(0);
    try {
      const [compressed, thumbnail] = await Promise.all([
        compressVideo(file, (p) => setVideoCompressProgress(p)),
        generateVideoThumbnail(file),
      ]);
      setQuestionMediaBase64(compressed.base64);
      setQuestionVideoThumbnail(thumbnail);
    } catch (error) {
      console.error("Error compressing video:", error);
      showErrorToast("Failed to compress video. Please try a different file.");
    } finally {
      setQuestionMediaProcessing(false);
      setVideoCompressProgress(0);
    }
  };

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

  // Handle image file selection: compress and convert to WebP, then show confirmation
  const handleImageSelect = async (index: number, file: File | null) => {
    if (file) {
      setOptionImageProcessing(prev => ({ ...prev, [index]: true }));
      try {
        const result = await convertImageToWebP(file, 0.8, 512, 512);
        setPendingImage({
          source: 'option', index, base64: result.base64,
          originalWidth: result.originalWidth, originalHeight: result.originalHeight, originalSize: result.originalSize,
          finalWidth: result.finalWidth, finalHeight: result.finalHeight, finalSize: result.finalSize,
        });
      } catch (error) {
        console.error("Error converting option image to WebP:", error);
        showErrorToast("Failed to process option image. Please try a different file.");
      } finally {
        setOptionImageProcessing(prev => ({ ...prev, [index]: false }));
      }
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
        // Regular options mode - upload option images to CDN first
        const optionImageUrls: { [key: number]: string } = {};
        for (const [indexStr, base64Data] of Object.entries(optionImages)) {
          const idx = Number(indexStr);
          if (optionTypes[idx] === 'image' && base64Data) {
            try {
              const uploadResult = await UploadQuestionMedia(base64Data, 'image');
              optionImageUrls[idx] = uploadResult.url;
            } catch (uploadErr) {
              console.error(`Option ${idx + 1} image upload failed:`, uploadErr);
              showErrorToast(`Option ${idx + 1} image upload failed. It will be skipped.`);
            }
          }
        }

        options = formikValues.questionOptions.map((option: any, index: number) => {
          // Check if this option is in image mode
          const isImageMode = optionTypes[index] === 'image';

          // Handle both cases: when useMQTAsOptions is true (options are objects) and false (options are strings)
          const optionText = isImageMode ? null : (typeof option === 'string' ? option : option.optionText);
          const optionImageUrl = isImageMode ? (optionImageUrls[index] || null) : null;
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
            optionImageUrl,
            optionScores,
            correct: false,
            isGame: false,
            game: null
          };
        });
      }

      // Upload media to DO Spaces if present
      let questionImageUrl = "";
      let questionVideoUrl = "";
      if (questionMediaType === 'image' && questionMediaBase64) {
        try {
          const uploadResult = await UploadQuestionMedia(questionMediaBase64, 'image');
          questionImageUrl = uploadResult.url;
        } catch (uploadErr) {
          console.error("Media upload failed:", uploadErr);
          showErrorToast("Image upload failed. Question will be created without the image.");
        }
      } else if (questionMediaType === 'video' && questionMediaBase64) {
        try {
          const uploadResult = await UploadQuestionMedia(questionMediaBase64, 'video');
          questionVideoUrl = uploadResult.url;
        } catch (uploadErr) {
          console.error("Media upload failed:", uploadErr);
          showErrorToast("Video upload failed. Question will be created without the video.");
        }
      }

      const payload: any = {
        questionText: formikValues.questionText,
        questionType: formikValues.questionType,
        questionMediaType: questionMediaType,
        questionImageUrl: questionImageUrl || null,
        questionVideoUrl: questionVideoUrl || null,
        maxOptionsAllowed: Number(formikValues.maxOptionsAllowed) || 0,
        options,
        section: { sectionId: Number(formikValues.sectionId) },
        flag : useMQTAsOptions ? 1 : 0
      };

      await CreateQuestionData(payload);
      setFormikValues(initialValues);
      setOptionMeasuredQualities({});
      setOptionTypes({});
      setOptionImages({});
      setSelectedGameId("");
      setUseGameAsOption(false);
      setQuestionMediaType('text');
      setQuestionMediaBase64("");
      setQuestionVideoThumbnail("");
      onHide();
      navigate("/assessment-questions");
    } catch (error: any) {
      console.error("Error creating question:", error);
      const msg = error?.response?.data?.message || error?.message || "Unknown error";
      showErrorToast("Failed to create question: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <><Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Assessment Question</Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Question Content Type Selector */}
          <div className="mb-3">
            <label className="form-label fw-bold">Question Content Type:</label>
            <div className="d-flex gap-2">
              {(['text', 'image', 'video'] as const).map((type) => (
                <label key={type} className={clsx(
                  "btn btn-sm",
                  questionMediaType === type ? "btn-primary" : "btn-outline-secondary"
                )}>
                  <input
                    type="radio"
                    name="questionMediaTypeModal"
                    value={type}
                    checked={questionMediaType === type}
                    onChange={() => {
                      setQuestionMediaType(type);
                      setQuestionMediaBase64("");
                      setQuestionVideoThumbnail("");
                    }}
                    className="d-none"
                  />
                  {type === 'text' && 'Text'}
                  {type === 'image' && 'Image'}
                  {type === 'video' && 'Video'}
                </label>
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div className="mb-3">
            <label className="form-label fw-bold">
              {questionMediaType === 'text' ? 'Question Text:' : 'Question Text (optional caption):'}
            </label>
            <textarea
              rows={questionMediaType === 'text' ? 4 : 2}
              className={clsx("form-control", questionMediaType === 'text' && {
                "is-invalid": !formikValues.questionText,
                "is-valid": !!formikValues.questionText,
              })}
              value={formikValues.questionText}
              onChange={e => setFormikValues(v => ({ ...v, questionText: e.target.value }))}
            />
          </div>

          {/* Question Image Upload */}
          {questionMediaType === 'image' && (
            <div className="mb-3">
              <label className="form-label fw-bold">Question Image:</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleQuestionImageSelect(e.target.files?.[0] || null)}
                className="form-control form-control-sm mb-2"
              />
              <small className="text-muted">Auto-converted to WebP and compressed.</small>
              {questionMediaProcessing && (
                <div className="d-flex align-items-center gap-2 text-primary mt-2">
                  <span className="spinner-border spinner-border-sm"></span>
                  <span>Processing...</span>
                </div>
              )}
              {questionMediaBase64 && !questionMediaProcessing && (
                <div className="position-relative d-inline-block mt-2">
                  <img src={questionMediaBase64} alt="Question" style={{ maxWidth: 300, maxHeight: 200, objectFit: 'contain', borderRadius: 6, border: '1px solid #ddd' }} />
                  <button type="button" className="btn btn-sm btn-danger position-absolute" style={{ top: -6, right: -6, padding: '2px 8px', fontSize: 11 }} onClick={() => setQuestionMediaBase64("")}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Question Video Upload */}
          {questionMediaType === 'video' && (
            <div className="mb-3">
              <label className="form-label fw-bold">Question Video:</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleQuestionVideoSelect(e.target.files?.[0] || null)}
                className="form-control form-control-sm mb-2"
              />
              <small className="text-muted">Supported: MP4, WebM, OGG. Video will be compressed automatically.</small>
              {questionMediaProcessing && (
                <div className="mt-2">
                  <div className="d-flex align-items-center gap-2 text-primary mb-1">
                    <span className="spinner-border spinner-border-sm"></span>
                    <span>Compressing video... {videoCompressProgress > 0 ? `${videoCompressProgress}%` : ''}</span>
                  </div>
                  {videoCompressProgress > 0 && (
                    <div className="progress" style={{ height: 5 }}>
                      <div className="progress-bar" role="progressbar" style={{ width: `${videoCompressProgress}%` }} />
                    </div>
                  )}
                </div>
              )}
              {questionMediaBase64 && !questionMediaProcessing && (
                <div className="position-relative d-inline-block mt-2">
                  <video src={questionMediaBase64} controls style={{ maxWidth: 300, maxHeight: 200, borderRadius: 6, border: '1px solid #ddd' }} />
                  <button type="button" className="btn btn-sm btn-danger position-absolute" style={{ top: -6, right: -6, padding: '2px 8px', fontSize: 11 }} onClick={() => { setQuestionMediaBase64(""); setQuestionVideoThumbnail(""); }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

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
                        <small className="text-muted d-block mb-1">Auto-compressed and converted to WebP, stored on CDN.</small>
                        {optionImageProcessing[index] && (
                          <div className="d-flex align-items-center gap-2 text-primary mb-2">
                            <span className="spinner-border spinner-border-sm"></span>
                            <span>Processing...</span>
                          </div>
                        )}
                        {optionImages[index] && !optionImageProcessing[index] && (
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

    {/* Confirmation popup — rendered via portal to document.body so it sits on top of everything */}
    {pendingImage && createPortal(
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => setPendingImage(null)}
      >
        <div
          style={{
            background: '#fff', borderRadius: 12, padding: 24,
            maxWidth: 450, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h5 className="mb-3 text-center">Confirm Image</h5>
          <p className="text-muted text-center mb-2">
            Image has been compressed, resized and converted to WebP.
          </p>
          <div className="mb-3 p-2 rounded" style={{ background: '#f8f9fa', fontSize: 13 }}>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">Original:</span>
              <span>{pendingImage.originalWidth} x {pendingImage.originalHeight} &middot; {(pendingImage.originalSize / 1024).toFixed(1)} KB</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">After processing:</span>
              <span className="text-success fw-bold">{pendingImage.finalWidth} x {pendingImage.finalHeight} &middot; {(pendingImage.finalSize / 1024).toFixed(1)} KB</span>
            </div>
            {pendingImage.originalSize > pendingImage.finalSize && (
              <div className="text-center mt-1">
                <span className="badge bg-success">
                  {Math.round((1 - pendingImage.finalSize / pendingImage.originalSize) * 100)}% smaller
                </span>
              </div>
            )}
          </div>
          <div className="text-center mb-3">
            <img
              src={pendingImage.base64}
              alt="Processed preview"
              style={{ maxWidth: '100%', maxHeight: 250, objectFit: 'contain', borderRadius: 8, border: '1px solid #ddd' }}
            />
          </div>
          <div className="d-flex justify-content-center gap-3">
            <Button variant="outline-secondary" onClick={() => setPendingImage(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              if (pendingImage.source === 'question') {
                setQuestionMediaBase64(pendingImage.base64);
              } else {
                setOptionImages(prev => ({ ...prev, [(pendingImage as any).index]: pendingImage.base64 }));
              }
              setPendingImage(null);
            }}>Confirm</Button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default QuestionCreateModal;
