import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dropdown, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { showErrorToast } from '../../../utils/toast';
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes, UploadQuestionMedia } from "../API/Question_APIs";
import { MQT } from "./MeasuredQualityTypesAsOptionComponent"; // Adjust the import based on your file structure
import { ListGamesData } from "../../Games/components/API/GAME_APIs";
import { convertImageToWebP, generateVideoThumbnail, compressVideo } from "../../../utils/imageUtils";

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
  // State for tracking which option images are being processed
  const [optionImageProcessing, setOptionImageProcessing] = useState<{ [key: number]: boolean }>({});
  // State for pending image confirmation popup (custom overlay portal)
  const [pendingImage, setPendingImage] = useState<
    { source: 'question'; base64: string; originalWidth: number; originalHeight: number; originalSize: number; finalWidth: number; finalHeight: number; finalSize: number }
    | { source: 'option'; index: number; base64: string; originalWidth: number; originalHeight: number; originalSize: number; finalWidth: number; finalHeight: number; finalSize: number }
    | null
  >(null);
  // Ref to reset question image file input
  const questionImageInputRef = useRef<HTMLInputElement>(null);

  // NEW: Game as option states
  const [useGameAsOption, setUseGameAsOption] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  const [isMQT, setIsMQT] = useState(false);
  const [isMQTtyped, setIsMQTtyped] = useState(false);

  // Question media type: 'text' | 'image' | 'video'
  const [questionMediaType, setQuestionMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [questionMediaBase64, setQuestionMediaBase64] = useState<string>("");
  const [questionMediaProcessing, setQuestionMediaProcessing] = useState(false);
  const [questionVideoThumbnail, setQuestionVideoThumbnail] = useState<string>("");
  const [videoCompressProgress, setVideoCompressProgress] = useState<number>(0);

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

  // Handle option image: shrink to 512x512, convert to WebP, then show confirmation popup
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

  // Handle question image upload — shrink to 1280x720, convert to webp, then show confirmation popup
  const handleQuestionImageSelect = async (file: File | null) => {
    if (!file) {
      setQuestionMediaBase64("");
      return;
    }
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
    if (!file) {
      setQuestionMediaBase64("");
      setQuestionVideoThumbnail("");
      return;
    }
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
    <><div className="container py-5">
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

                  // Handle both string options (manual) and object options (MQT)
                  const optionText = isImageMode ? null : (typeof option === 'string' ? option : option.optionText);
                  const optionImageUrl = isImageMode ? (optionImageUrls[index] || null) : null;
                  const isCorrect = typeof option === 'string' ? false : (option.correct || false);
                  const optionDescription = typeof option === 'string' ? null : (option.optionDescription || null);

                  // Build optionScores for this option
                  const optionScores: any[] = [];
                  if (optionMeasuredQualities[index]) {
                    Object.entries(optionMeasuredQualities[index]).forEach(([typeId, val]: any) => {
                      if (val.checked) {
                        optionScores.push({
                          score: val.score,
                          question_option: {},
                          measuredQualityType: { measuredQualityTypeId: Number(typeId) }
                        });
                      }
                    });
                  }
                  return {
                    optionText,
                    optionImageUrl,
                    optionScores,
                    correct: isCorrect,
                    isGame: false,
                    game: null,
                    optionDescription
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

              // Compose payload
              const payload: any = {
                questionText: formikValues.questionText,
                questionType: formikValues.questionType,
                questionMediaType: questionMediaType,
                questionImageUrl: questionImageUrl || null,
                questionVideoUrl: questionVideoUrl || null,
                maxOptionsAllowed: Number(formikValues.maxOptionsAllowed) || 0,
                isMQT: isMQT,
                isMQTtyped: isMQTtyped,
                options,
                section: { sectionId: Number(formikValues.sectionId) },
                flag: useMQTAsOptions ? 1 : 0
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
              navigate("/assessment-questions");
            } catch (error: any) {
              console.error("Error creating question:", error);
              const msg = error?.response?.data?.message || error?.message || "Unknown error";
              showErrorToast("Failed to create question: " + msg);
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="card-body">
            {/* Question Content Type Selector */}
            <div className="fv-row mb-4">
              <label className="fs-6 fw-bold mb-2">Question Content Type:</label>
              <div className="d-flex gap-3">
                {(['text', 'image', 'video'] as const).map((type) => (
                  <label key={type} className={clsx(
                    "btn btn-sm",
                    questionMediaType === type ? "btn-primary" : "btn-outline-secondary"
                  )}>
                    <input
                      type="radio"
                      name="questionMediaType"
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

            {/* Question Text (always shown for context/alt-text) */}
            <div className="fv-row mb-7">
              <label className={clsx("fs-6 fw-bold mb-2", { "required": questionMediaType === 'text' })}>
                {questionMediaType === 'text' ? 'Question Text:' : 'Question Text (optional caption/alt-text):'}
              </label>
              <textarea
                name="questionText"
                placeholder="Enter Question Text"
                rows={questionMediaType === 'text' ? 4 : 2}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  questionMediaType === 'text' && {
                    "is-invalid text-danger": !formikValues.questionText,
                    "is-valid": !!formikValues.questionText,
                  }
                )}
                value={formikValues.questionText}
                onChange={e => setFormikValues(v => ({ ...v, questionText: e.target.value }))}
              />
            </div>

            {/* Question Image Upload */}
            {questionMediaType === 'image' && (
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Question Image:</label>
                <input
                  ref={questionImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleQuestionImageSelect(e.target.files?.[0] || null)}
                  className="form-control form-control-lg form-control-solid mb-2"
                />
                <small className="text-muted d-block mb-2">
                  Image will be automatically converted to WebP format and compressed.
                </small>
                {questionMediaProcessing && (
                  <div className="d-flex align-items-center gap-2 text-primary mb-2">
                    <span className="spinner-border spinner-border-sm"></span>
                    <span>Processing image...</span>
                  </div>
                )}
                {questionMediaBase64 && !questionMediaProcessing && (
                  <div className="position-relative d-inline-block">
                    <img
                      src={questionMediaBase64}
                      alt="Question"
                      style={{ maxWidth: 400, maxHeight: 300, objectFit: 'contain', borderRadius: 8, border: '1px solid #ddd' }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger position-absolute"
                      style={{ top: -8, right: -8, padding: '4px 10px', fontSize: 12 }}
                      onClick={() => { setQuestionMediaBase64(""); if (questionImageInputRef.current) questionImageInputRef.current.value = ""; }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Question Video Upload */}
            {questionMediaType === 'video' && (
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Question Video:</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleQuestionVideoSelect(e.target.files?.[0] || null)}
                  className="form-control form-control-lg form-control-solid mb-2"
                />
                <small className="text-muted d-block mb-2">
                  Supported formats: MP4, WebM, OGG. Video will be compressed automatically.
                </small>
                {questionMediaProcessing && (
                  <div className="mb-2">
                    <div className="d-flex align-items-center gap-2 text-primary mb-1">
                      <span className="spinner-border spinner-border-sm"></span>
                      <span>Compressing video... {videoCompressProgress > 0 ? `${videoCompressProgress}%` : ''}</span>
                    </div>
                    {videoCompressProgress > 0 && (
                      <div className="progress" style={{ height: 6 }}>
                        <div className="progress-bar" role="progressbar" style={{ width: `${videoCompressProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}
                {questionMediaBase64 && !questionMediaProcessing && (
                  <div className="position-relative d-inline-block">
                    <video
                      src={questionMediaBase64}
                      controls
                      style={{ maxWidth: 400, maxHeight: 300, borderRadius: 8, border: '1px solid #ddd' }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger position-absolute"
                      style={{ top: -8, right: -8, padding: '4px 10px', fontSize: 12 }}
                      onClick={() => { setQuestionMediaBase64(""); setQuestionVideoThumbnail(""); }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
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
                <option value="text">Text Input</option>
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
              <label className="fs-6 fw-bold mb-2">
                {formikValues.questionType === "text" ? "Number of Text Input Boxes" : "Max Options Allowed"}
              </label>
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
                placeholder={formikValues.questionType === "text" ? "Number of text input boxes" : "Max Options Allowed"}
                className="form-control form-control-lg form-control-solid w-25"
                style={{ width: 200 }}
              />
            </div>
            {formikValues.questionType === "text" && (
              <div className="alert alert-info mb-7">
                <strong>Text Input Mode:</strong> Students will type free-text answers instead of selecting options.
                The options below serve as reference options for autocomplete suggestions and scoring after admin mapping.
              </div>
            )}
            <div className="fv-row mb-7 d-flex gap-5">
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
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="isMQTtypedToggle"
                  checked={isMQTtyped}
                  onChange={() => setIsMQTtyped(v => !v)}
                />
                <label className="form-check-label fs-6 fw-bold" htmlFor="isMQTtypedToggle">
                  isMQTtyped
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

    {/* Confirmation popup — rendered via portal to document.body so it sits on top of everything */}
    {pendingImage && createPortal(
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => { setPendingImage(null); if (questionImageInputRef.current) questionImageInputRef.current.value = ""; }}
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
            <Button variant="outline-secondary" onClick={() => { setPendingImage(null); if (questionImageInputRef.current) questionImageInputRef.current.value = ""; }}>Cancel</Button>
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

export default QuestionCreatePage;

