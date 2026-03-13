import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadQuestionSectionDataList } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, UpdateQuestionData, ReadMeasuredQualityTypes, ReadQuestionByIdData, UploadQuestionMedia } from "../API/Question_APIs";
import { ListGamesData } from "../../Games/components/API/GAME_APIs";
import { CheckLockedByQuestion } from "../../CreateAssessment/API/Create_Assessment_APIs";
import { convertImageToWebP, generateVideoThumbnail, compressVideo } from "../../../utils/imageUtils";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  section: Yup.object().shape({
    sectionId: Yup.string().required("Section is required"),
  }).required("Section is required"),
  options: Yup.array()
    .of(Yup.object().shape({
      optionText: Yup.string().required("Option cannot be empty"),
      optionDescription: Yup.string().optional(),
    }))
    .min(1, "At least one option is required"),
});

interface Option {
  optionText: string;
  optionDescription?: string;
  correct: boolean;
  sequence: number;
  optionId?: string;
}

const QuestionEditPage = (props?: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(true);
  const [isAssessmentLocked, setIsAssessmentLocked] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [mqt, setMqt] = useState<any[]>([]);
  const [questionData, setQuestionData] = useState<any>({
    questionText: "",
    questionType: "",
    section: "",
    options: [{ optionText: "", optionDescription: "", correct: false, sequence: 1 }],
    id: "",
  });

  // State for measured qualities per option: { [optionIdx]: { [typeId]: { checked: boolean, score: number } } }
  const [optionMeasuredQualities, setOptionMeasuredQualities] = useState<Record<number, Record<number, { checked: boolean, score: number }>>>({});

  // State for tracking option type (text vs image) per option index
  const [optionTypes, setOptionTypes] = useState<{ [key: number]: 'text' | 'image' }>({});
  // State for storing Base64 image data per option index
  const [optionImages, setOptionImages] = useState<{ [key: number]: string }>({});

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

  // Handle question image upload — convert to webp and compress
  const handleQuestionImageSelect = async (file: File | null) => {
    if (!file) { setQuestionMediaBase64(""); return; }
    setQuestionMediaProcessing(true);
    try {
      const result = await convertImageToWebP(file, 0.8, 1920, 1080);
      setQuestionMediaBase64(result.base64);
    } catch (error) {
      console.error("Error converting image to WebP:", error);
      alert("Failed to process image. Please try a different file.");
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
      alert("Failed to compress video. Please try a different file.");
    } finally {
      setQuestionMediaProcessing(false);
      setVideoCompressProgress(0);
    }
  };

  // Search state for each option's measured quality dropdown
  const [qualitySearchTerms, setQualitySearchTerms] = useState<{ [key: number]: string }>({});

  // Track whether formik has been initialized with real data — disable reinitialize after that
  const dataLoadedRef = useRef(false);

  // Helper to initialize derived state from question options data
  const initializeDerivedState = (data: any) => {
    if (data.options && data.options.length > 0) {
      const qualities: Record<number, Record<number, { checked: boolean, score: number }>> = {};
      const types: { [key: number]: 'text' | 'image' } = {};
      const images: { [key: number]: string } = {};
      let foundGame = false;
      let foundGameId = "";

      data.options.forEach((option: any, idx: number) => {
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
          images[idx] = option.optionImageBase64.startsWith('data:')
            ? option.optionImageBase64
            : `data:image/png;base64,${option.optionImageBase64}`;
        } else {
          types[idx] = 'text';
        }

        // Check if this is a game option
        if (option.isGame && option.game) {
          foundGame = true;
          foundGameId = String(option.game.gameId);
        }
      });

      setOptionMeasuredQualities(qualities);
      setOptionTypes(types);
      setOptionImages(images);
      if (foundGame) {
        setUseGameAsOption(true);
        setSelectedGameId(foundGameId);
      }
    }

    // Load question media type and data from URLs
    if (data.questionMediaType) {
      setQuestionMediaType(data.questionMediaType);
    } else if (data.questionImageUrl) {
      setQuestionMediaType('image');
    } else if (data.questionVideoUrl) {
      setQuestionMediaType('video');
    } else {
      setQuestionMediaType('text');
    }

    if (data.questionImageUrl) {
      setQuestionMediaBase64(data.questionImageUrl);
    } else if (data.questionVideoUrl) {
      setQuestionMediaBase64(data.questionVideoUrl);
    }
  };

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
      setOptionImages(prev => { const n = { ...prev }; delete n[index]; return n; });
    }
  };

  // Filter measured quality types based on search term
  const getFilteredMeasuredQualities = (optionIndex: number) => {
    const searchTerm = qualitySearchTerms[optionIndex] || "";
    if (!searchTerm.trim()) return mqt;

    return mqt.filter((type: any) =>
      type.measuredQualityTypeName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const navigate = useNavigate();
  const location = useLocation();
  const locationStateRef = useRef(location.state);
  const { id } = useParams<{ id: string }>();

  // Fetch all data when component mounts
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch question data
        let questionDataResult = null;
        if (id) {
          try {
            const questionResponse = await ReadQuestionByIdData(id);
            const fetchedQuestion = questionResponse.data;

            questionDataResult = {
              ...fetchedQuestion,
              section: fetchedQuestion.section?.sectionId
                ? { sectionId: String(fetchedQuestion.section.sectionId) }
                : fetchedQuestion.section?.section
                  ? { sectionId: String(fetchedQuestion.section.section) }
                  : { sectionId: "" },
              questionOptions: fetchedQuestion.options
                ? fetchedQuestion.options.map((option: any) => option.optionText || option)
                : [{ optionText: "", optionDescription: "", correct: false, sequence: 1 }],
            };
          } catch (error) {
            console.error("Error fetching question:", error);
            const locationData = (locationStateRef.current as any)?.data;
            if (locationData) {
              questionDataResult = {
                ...locationData,
                section: locationData.section?.sectionId
                  ? { sectionId: String(locationData.section.sectionId) }
                  : locationData.section?.section
                    ? { sectionId: String(locationData.section.section) }
                    : { sectionId: "" },
                questionOptions: locationData.options
                  ? locationData.options.map((option: any) => option.optionText || option)
                  : locationData.questionOptions || [""]
              };
            }
          }
        } else {
          const locationData = (locationStateRef.current as any)?.data;
          if (locationData) {
            questionDataResult = {
              ...locationData,
              section: locationData.section?.sectionId
                ? { sectionId: String(locationData.section.sectionId) }
                : locationData.section?.section
                  ? { sectionId: String(locationData.section.section) }
                  : { sectionId: "" },
              questionOptions: locationData.options
                ? locationData.options.map((option: any) => option.optionText || option)
                : locationData.questionOptions || [""]
            };
          }
        }
        if (questionDataResult) {
          setQuestionData(questionDataResult);
          initializeDerivedState(questionDataResult);
        }

        // Fetch sections
        let sectionsResult: any[] = [];
        try {
          const response = await ReadQuestionSectionDataList();
          sectionsResult = response.data;
        } catch (error) {
          console.error("Error fetching sections:", error);
        }
        setSections(sectionsResult);

        // Fetch measured quality types
        let mqtResult: any[] = [];
        try {
          const response = await ReadMeasuredQualityTypes();
          mqtResult = response.data;
        } catch (error) {
          console.error("Error fetching measured quality types:", error);
        }
        setMqt(mqtResult);

        // Fetch games
        let gamesResult: any[] = [];
        try {
          const response = await ListGamesData();
          gamesResult = response.data;
        } catch (error) {
          console.error("Error fetching games:", error);
          gamesResult = [];
        }
        setGames(gamesResult);

        // Check if this question's assessment is locked
        if (id) {
          try {
            const lockRes = await CheckLockedByQuestion(id);
            setIsAssessmentLocked(lockRes.data?.isLocked === true);
          } catch (err) {
            setIsAssessmentLocked(false);
          }
        }
      } finally {
        // Mark data as loaded so enableReinitialize gets disabled
        // after formik picks up the real initialValues
        dataLoadedRef.current = true;
        setLoading(false);
      }
    };

    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  // ✅ Keep using useFormik but with enhanced initial values
  const formik = useFormik({
    enableReinitialize: !dataLoadedRef.current,
    initialValues: {
      id: questionData.id || id,
      questionId: questionData.questionId || questionData.id || id,
      questionText: questionData.questionText || "",
      questionType: questionData.questionType || "",
      maxOptionsAllowed: questionData.maxOptionsAllowed || 0,
      isMQT: questionData.isMQT ?? false,
      isMQTtyped: questionData.isMQTtyped ?? false,
      section: questionData.section && typeof questionData.section === "object" && "sectionId" in questionData.section
        ? { sectionId: String(questionData.section.sectionId) }
        : questionData.section
          ? { sectionId: String(questionData.section) }
          : { sectionId: "" },
      options:
        questionData.options && questionData.options.length > 0
          ? questionData.options.map((option: any, idx: number) => ({
            optionText: option.optionText || "",
            optionDescription: option.optionDescription || "",
            correct: option.correct ?? false,
            sequence: option.sequence || idx + 1,
            ...(option.optionId ? { optionId: option.optionId } : {}),
          }))
          : [
            {
              optionText: "",
              optionDescription: "",
              correct: false,
              sequence: 1,
            },
          ],
    },
    // validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Sort options by sequence before processing
        const sortedOptions = [...values.options].sort((a, b) => a.sequence - b.sequence);

        let options: any[] = [];

        if (useGameAsOption && selectedGameId) {
          // Game as option mode - single option with game reference
          options = [{
            optionText: null,
            optionImageBase64: null,
            optionDescription: "",
            optionScores: [],
            correct: false,
            sequence: 1,
            isGame: true,
            game: { gameId: Number(selectedGameId) }
          }];
        } else {
          // Build options array with optionScores from optionMeasuredQualities
          options = sortedOptions.map((option: any) => {
            // Find the original form index to look up qualities, types, and images
            const originalIdx = values.options.indexOf(option);

            // Check if this option is in image mode
            const isImageMode = optionTypes[originalIdx] === 'image';

            const qualities = optionMeasuredQualities[originalIdx] || {};
            const optionScores = Object.entries(qualities)
              .filter(([_, v]) => v && v.checked)
              .map(([typeId, v]) => ({
                score: v.score,
                measuredQualityType: { measuredQualityTypeId: Number(typeId) },
              }));
            return {
              optionText: isImageMode ? null : option.optionText,
              optionImageBase64: isImageMode ? (optionImages[originalIdx] || null) : null,
              optionDescription: option.optionDescription || "",
              optionScores,
              correct: option.correct ?? false,
              sequence: option.sequence,
              isGame: false,
              game: null,
              ...(option.optionId ? { optionId: option.optionId } : {}),
            };
          });
        }

        // Upload media to DO Spaces if it's new base64 data (not already a URL)
        let questionImageUrl = "";
        let questionVideoUrl = "";
        if (questionMediaType === 'image' && questionMediaBase64) {
          if (questionMediaBase64.startsWith('data:')) {
            try {
              const uploadResult = await UploadQuestionMedia(questionMediaBase64, 'image');
              questionImageUrl = uploadResult.url;
            } catch (uploadErr) {
              console.error("Media upload failed:", uploadErr);
              alert("Image upload failed. Question will be saved without the image.");
            }
          } else {
            questionImageUrl = questionMediaBase64;
          }
        } else if (questionMediaType === 'video' && questionMediaBase64) {
          if (questionMediaBase64.startsWith('data:')) {
            try {
              const uploadResult = await UploadQuestionMedia(questionMediaBase64, 'video');
              questionVideoUrl = uploadResult.url;
            } catch (uploadErr) {
              console.error("Media upload failed:", uploadErr);
              alert("Video upload failed. Question will be saved without the video.");
            }
          } else {
            questionVideoUrl = questionMediaBase64;
          }
        }

        const payload: any = {
          id: values.id,
          questionId: values.questionId,
          questionText: values.questionText,
          questionType: values.questionType,
          questionMediaType: questionMediaType,
          questionImageUrl: questionImageUrl || null,
          questionVideoUrl: questionVideoUrl || null,
          maxOptionsAllowed: Number(values.maxOptionsAllowed) || 0,
          isMQT: values.isMQT,
          isMQTtyped: values.isMQTtyped,
          options,
          section: { sectionId: values.section.sectionId },
        };

        const questionId = values.questionId || values.id;
        if (questionId) {
          await UpdateQuestionData(questionId, payload);
        } else {
          await CreateQuestionData(payload);
        }
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
        optionDescription: "",
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
      setOptionTypes(prev => { const n = { ...prev }; delete n[index]; return n; });
      setOptionImages(prev => { const n = { ...prev }; delete n[index]; return n; });
    }
  };

  const updateOption = (sequence: number, value: string) => {
    const currentOptions = [...formik.values.options];
    const optionIndex = currentOptions.findIndex(opt => opt.sequence === sequence);
    if (optionIndex !== -1) {
      currentOptions[optionIndex].optionText = value;
      formik.setFieldValue("options", currentOptions);
    }
  };

  const updateOptionDescription = (sequence: number, value: string) => {
    const currentOptions = [...formik.values.options];
    const optionIndex = currentOptions.findIndex(opt => opt.sequence === sequence);
    if (optionIndex !== -1) {

      currentOptions[optionIndex].optionDescription = value;
      formik.setFieldValue("options", currentOptions);
    }
  };


  if (isAssessmentLocked) {
    return (
      <div className="container py-5">
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <h2 className="mb-4">Question Locked</h2>
            <p className="text-muted fs-5">
              This question cannot be edited as there is an active assessment going on.
            </p>
            <button className="btn btn-secondary mt-3" onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                      name="questionMediaTypeEdit"
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
            <div className="fv-row mb-7">
              <label className={clsx("fs-6 fw-bold mb-2", { "required": questionMediaType === 'text' })}>
                {questionMediaType === 'text' ? 'Question Text:' : 'Question Text (optional caption/alt-text):'}
              </label>
              <textarea
                placeholder="Enter Question Text"
                rows={questionMediaType === 'text' ? 4 : 2}
                {...formik.getFieldProps("questionText")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  questionMediaType === 'text' && {
                    "is-invalid text-danger":
                      formik.touched.questionText && formik.errors.questionText,
                  },
                  questionMediaType === 'text' && {
                    "is-valid":
                      formik.touched.questionText && !formik.errors.questionText,
                  }
                )}
              />
              {questionMediaType === 'text' && formik.touched.questionText && formik.errors.questionText && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.questionText)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Question Image Upload */}
            {questionMediaType === 'image' && (
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Question Image:</label>
                <input
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
                      onClick={() => setQuestionMediaBase64("")}
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
                <option value="ranking">Ranking</option>
                <option value="text">Text Input</option>
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
                  const selectedSectionId = e.target.value;
                  formik.setFieldValue("section", { sectionId: selectedSectionId });
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
                  <option key={section.sectionId} value={String(section.sectionId)}>
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

              {/* Game as Option checkbox */}
              <div className="mb-3 d-flex gap-4">
                <div className="form-check">
                  <input
                    type="checkbox"
                    checked={useGameAsOption}
                    onChange={() => setUseGameAsOption(v => !v)}
                    className="form-check-input"
                    id="useGameAsOptionEdit"
                  />
                  <label className="form-check-label" htmlFor="useGameAsOptionEdit">
                    🎮 Use Game as Option
                  </label>
                </div>
              </div>

              {/* Game Selection Dropdown */}
              {useGameAsOption ? (
                <div className="p-3 border rounded bg-light mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <span className="me-2 fw-bold">🎮 Select Game:</span>
                  </div>
                  <select
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": !selectedGameId,
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
                    <div className="mt-2 text-success">
                      ✅ Game selected. This question will launch the selected game as an option.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {[...formik.values.options]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((option, index) => (
                      <div key={index} className="mb-3 p-3 border rounded bg-light" style={{ position: 'relative', zIndex: formik.values.options.length - index }}>
                        <div className="row g-3">
                          {/* Sequence Column */}
                          <div className="col-auto">
                            <label className="form-label small fw-bold">Sequence</label>
                            <select
                              className="form-select form-select-sm"
                              value={option.sequence}
                              onChange={(e) => updateOptionSequence(index, parseInt(e.target.value))}
                              style={{ width: '80px' }}
                            >
                              {generateSequenceOptions(formik.values.options.length).map(seq => (
                                <option key={seq} value={seq}>{seq}</option>
                              ))}
                            </select>
                          </div>

                          {/* Option Text & Description Column */}
                          <div className="col">
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
                                    onChange={e => updateOption(option.sequence, e.target.value)}
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
                                  value={option.optionDescription}
                                  onChange={e => {
                                    const currentOptions = [...formik.values.options];
                                    const optionIndex = currentOptions.findIndex(opt => opt.sequence === option.sequence);
                                    if (optionIndex !== -1) {
                                      currentOptions[optionIndex].optionDescription = e.target.value;
                                      formik.setFieldValue("options", currentOptions);
                                    }
                                  }}
                                  className="form-control form-control-sm"
                                  rows={2}
                                  style={{ resize: "vertical" }}
                                />
                              </>
                            )}
                          </div>

                          {/* Measured Quality Types Column */}
                          <div className="col-auto" style={{ minWidth: '200px' }}>
                                <Dropdown autoClose="outside">
                                  <Dropdown.Toggle
                                    variant="secondary"
                                    id={`dropdown-option-${index}`}
                                    size="sm"
                                  >
                                    Quality Types
                                  </Dropdown.Toggle>
                                  <Dropdown.Menu style={{ minWidth: 300, zIndex: 9999 }} popperConfig={{ strategy: 'fixed' }} renderOnMount>
                                    <Dropdown.Header>Measured Quality Types</Dropdown.Header>

                                    {/* Search Bar */}
                                    <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="🔍 Search quality types..."
                                        value={qualitySearchTerms[index] || ""}
                                        onChange={(e) => {
                                          setQualitySearchTerms(prev => ({
                                            ...prev,
                                            [index]: e.target.value
                                          }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>

                                    <Dropdown.Divider />

                                    <div style={{ maxHeight: 250, overflowY: "auto", padding: 8 }} onClick={(e) => e.stopPropagation()}>
                                      {getFilteredMeasuredQualities(index).length > 0 ? (
                                        getFilteredMeasuredQualities(index).map((type: any, i: number) => (
                                          <div key={type.measuredQualityTypeId}>
                                            <div className="d-flex align-items-center mb-2">
                                              <input
                                                type="checkbox"
                                                checked={!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked}
                                                onChange={() => handleQualityToggle(index, type.measuredQualityTypeId)}
                                                className="form-check-input me-2"
                                                id={`option-${index}-type-${type.measuredQualityTypeId}`}
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              <label
                                                htmlFor={`option-${index}-type-${type.measuredQualityTypeId}`}
                                                className="me-2 mb-0"
                                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleQualityToggle(index, type.measuredQualityTypeId);
                                                }}
                                              >
                                                {type.measuredQualityTypeName}
                                              </label>
                                              {!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked && (
                                                <input
                                                  type="number"
                                                  max={100}
                                                  value={optionMeasuredQualities[index][type.measuredQualityTypeId]?.score ?? 0}
                                                  onChange={e =>
                                                    handleQualityScoreChange(index, type.measuredQualityTypeId, Number(e.target.value))
                                                  }
                                                  placeholder="Score"
                                                  className="form-control form-control-sm ms-2"
                                                  style={{ width: 70 }}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              )}
                                            </div>
                                            {i < getFilteredMeasuredQualities(index).length - 1 && <hr style={{ margin: '4px 0' }} />}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-muted text-center py-2">
                                          No matching quality types found
                                        </div>
                                      )}
                                    </div>
                                  </Dropdown.Menu>
                            </Dropdown>

                            {/* Display Selected Measured Qualities */}
                            {optionMeasuredQualities[index] && Object.keys(optionMeasuredQualities[index]).length > 0 && (
                              <div className="mt-2">
                                <div className="small text-muted mb-1">Selected:</div>
                                <div className="d-flex flex-wrap gap-1">
                                  {Object.entries(optionMeasuredQualities[index])
                                    .filter(([_, value]) => value.checked)
                                    .map(([typeId, value]) => {
                                      const qualityType = mqt.find(q => q.measuredQualityTypeId === Number(typeId));
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
                          </div>

                          {/* Actions Column */}
                          <div className="col-auto">
                            <label className="form-label small fw-bold invisible">Actions</label>
                            <div className="d-flex gap-1">
                              {formik.values.options.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => removeOption(index)}
                                  title="Remove option"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}
                              {index === formik.values.options.length - 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={addOption}
                                  title="Add option"
                                >
                                  <i className="fas fa-plus"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {typeof formik.errors.options === "string" && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{formik.errors.options}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Max Options Allowed */}
            <div className="fv-row mb-7">
              <label className="fs-6 fw-bold mb-2">
                {formik.values.questionType === "text" ? "Number of Text Input Boxes" : "Max Options Allowed"}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={formik.values.maxOptionsAllowed}
                onChange={e =>
                  formik.setFieldValue("maxOptionsAllowed", e.target.value)
                }
                placeholder={formik.values.questionType === "text" ? "Number of text input boxes" : "Max Options Allowed"}
                className="form-control form-control-lg form-control-solid"
                style={{ width: 200 }}
              />
            </div>
            {formik.values.questionType === "text" && (
              <div className="alert alert-info mb-7">
                <strong>Text Input Mode:</strong> Students will type free-text answers instead of selecting options.
                The options below serve as reference options for autocomplete suggestions and scoring after admin mapping.
              </div>
            )}

            {/* isMQT and isMQTtyped Toggles */}
            <div className="fv-row mb-7 d-flex gap-5">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="isMQTToggleEdit"
                  checked={formik.values.isMQT || false}
                  onChange={() => formik.setFieldValue("isMQT", !formik.values.isMQT)}
                />
                <label className="form-check-label fs-6 fw-bold" htmlFor="isMQTToggleEdit">
                  isMQT
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="isMQTtypedToggleEdit"
                  checked={formik.values.isMQTtyped || false}
                  onChange={() => formik.setFieldValue("isMQTtyped", !formik.values.isMQTtyped)}
                />
                <label className="form-check-label fs-6 fw-bold" htmlFor="isMQTtypedToggleEdit">
                  isMQTtyped
                </label>
              </div>
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