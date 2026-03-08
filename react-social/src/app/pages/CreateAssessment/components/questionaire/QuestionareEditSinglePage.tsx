import clsx from "clsx";
import { Field, Form, Formik, FieldArray } from "formik";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as Yup from "yup";
import { Button, Modal, Spinner } from "react-bootstrap";

// API imports
import { ReadCollegeData } from "../../../College/API/College_APIs";
import { ReadQuestionSectionData } from "../../../QuestionSections/API/Question_Section_APIs";
import { ReadToolData } from "../../../Tool/API/Tool_APIs";
import { ReadQuestionsDataList, ReadQuestionByIdData } from "../../../AssesmentQuestions/API/Question_APIs";
import { ReadLanguageData, ReadQuestionaireById, UpdateQuestionaire } from "../../API/Create_Questionaire_APIs";
import { CheckLockedByQuestionnaire } from "../../API/Create_Assessment_APIs";

// Component imports
import CollegeCreateModal from "../../../College/components/CollegeCreateModal";
import QuestionSectionCreateModal from "../../../QuestionSections/components/QuestionSectionCreateModal";
import ToolCreateModal from "../../../Tool/components/ToolCreateModal";
import QuestionCreateModal from "../../../AssesmentQuestions/components/QuestionCreateModal";
import QuestionLanguageModal from "../../../AssesmentQuestions/components/QuestionLanguageModal";
import SectionQuestionSelector from "../SectionQuestionSelector";

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Questionare name is required"),
  instructions: Yup.object().optional(),
  isFree: Yup.string().required("Questionare price type is required"),
  price: Yup.number()
    .typeError("Price must be a number")
    .when("isFree", {
      is: "false",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
  languages: Yup.array().min(1, "At least one language must be selected"),
  // Questionnaire type (General or Bet Assessment)
  questionnaireType: Yup.string().required("Questionnaire type is required"),
  toolId: Yup.string().required("Tool is required"),
  sectionIds: Yup.array().min(1, "At least one section must be selected"),
});

const QuestionareEditSinglePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Questionnaire data from API
  const [questionnaireData, setQuestionnaireData] = useState<any>(null);

  // Data states
  const [colleges, setColleges] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]); // Lightweight: id + text only
  const [questionsFullData, setQuestionsFullData] = useState<any[]>([]); // Full data for preview
  const [loadingPreviewData, setLoadingPreviewData] = useState(false);
  const [languages, setLanguages] = useState<any[]>([]);
  
  // Loading states for individual data types
  const [loadingStates, setLoadingStates] = useState({
    colleges: true,
    sections: true,
    tools: true,
    questions: true,
    languages: true,
    questionnaire: true,
  });
  
  // Modal states
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [pageLoadingState, setPageLoadingState] = useState(["false"]);
  const [isAssessmentLocked, setIsAssessmentLocked] = useState(false);
  
  // Question assignment state
  const [selectedSectionForQuestions, setSelectedSectionForQuestions] = useState<string>("");

  // Translation Modal State
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translationQuestionId, setTranslationQuestionId] = useState<number | null>(null);
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState<string>("");

  // Fetch questionnaire data by ID
  const fetchQuestionnaireData = async () => {
    if (!id) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, questionnaire: true }));
      const response = await ReadQuestionaireById(id);
      console.log("Fetched questionnaire data:", response.data);
      setQuestionnaireData(response.data);
    } catch (error) {
      console.error("Error fetching questionnaire:", error);
      alert("Failed to load questionnaire data");
      navigate("/questionaire/List");
    } finally {
      setLoadingStates(prev => ({ ...prev, questionnaire: false }));
      setQuestionnaireLoading(false);
    }
  };

  // Fetch data functions
  const fetchColleges = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, colleges: true }));
      const response = await ReadCollegeData();
      setColleges(response.data || []);
    } catch (error) {
      console.error("Error fetching colleges:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, colleges: false }));
    }
  };

  const fetchSections = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, sections: true }));
      const response = await ReadQuestionSectionData();
      const sectionsData = response.data || [];
      const cleanedSections = Array.isArray(sectionsData) 
        ? sectionsData.map(section => {
            if (section && typeof section === 'object') {
              return {
                sectionId: String(section.sectionId || section.id || ''),
                sectionName: String(section.sectionName || section.name || ''),
                sectionDescription: String(section.sectionDescription || section.description || '')
              };
            }
            return null;
          }).filter(Boolean)
        : [];
      setSections(cleanedSections);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setSections([]);
    } finally {
      setLoadingStates(prev => ({ ...prev, sections: false }));
    }
  };

  const fetchTools = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, tools: true }));
      const response = await ReadToolData();
      setTools(response.data || []);
    } catch (error) {
      console.error("Error fetching tools:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, tools: false }));
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, questions: true }));
      // Use lightweight endpoint - only fetches id and text, not options/scores
      const response = await ReadQuestionsDataList();
      setQuestions(response.data || []);
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, questions: false }));
    }
  };

  // Fetch full question data for preview (only selected questions)
  const fetchQuestionsFullData = async (questionIds: string[]) => {
    if (questionIds.length === 0) return;

    setLoadingPreviewData(true);
    try {
      const promises = questionIds.map(id => ReadQuestionByIdData(id));
      const responses = await Promise.all(promises);
      const fullData = responses.map(res => res.data).filter(Boolean);
      setQuestionsFullData(fullData);
    } catch (error) {
      console.error("Error fetching full question data:", error);
    } finally {
      setLoadingPreviewData(false);
    }
  };

  const fetchLanguages = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, languages: true }));
      const response = await ReadLanguageData();
      setLanguages(response.data || []);
    } catch (error) {
      console.error("Error fetching languages:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, languages: false }));
    }
  };

  // Initial data loading
  useEffect(() => {
    const loadAllData = async () => {
      setDataLoading(true);
      await Promise.all([
        fetchColleges(),
        fetchSections(),
        fetchTools(),
        fetchQuestions(),
        fetchLanguages(),
        fetchQuestionnaireData(),
      ]);
      // Check if the questionnaire's assessment is locked
      if (id) {
        try {
          const lockRes = await CheckLockedByQuestionnaire(id);
          setIsAssessmentLocked(lockRes.data?.isLocked === true);
        } catch (err) {
          // If no assessment linked, treat as unlocked
          setIsAssessmentLocked(false);
        }
      }
      setDataLoading(false);
    };

    loadAllData();
  }, [id]);

  // Check if all data is loaded
  const isDataLoaded = useMemo(() => {
    return !Object.values(loadingStates).some(loading => loading);
  }, [loadingStates]);

  // Refresh data when modals close
  useEffect(() => {
    if (!showCollegeModal) fetchColleges();
  }, [showCollegeModal]);

  useEffect(() => {
    if (!showSectionModal) fetchSections();
  }, [showSectionModal]);

  useEffect(() => {
    if (!showToolModal) fetchTools();
  }, [showToolModal]);

  useEffect(() => {
    if (!showQuestionModal) fetchQuestions();
  }, [showQuestionModal]);

  // Build initial values from fetched questionnaire data
  const initialValues = useMemo(() => {
    if (!questionnaireData) {
      return {
        name: "",
        instructions: { "English": "" },
        sectionInstructions: {} as { [sectionId: string]: { [language: string]: string } },
        price: 0,
        isFree: "true",
        questionnaireType: "false", // false = General, true = Bet Assessment
        toolId: "",
        languages: ["English"] as string[], // English selected by default
        sectionIds: [] as string[],
        sectionQuestions: {} as { [sectionId: string]: string[] },
        sectionQuestionsOrder: {} as { [sectionId: string]: { [questionId: string]: number } },
      };
    }

    console.log("=== INITIALIZING EDIT FORM ===");
    console.log("Questionnaire Data:", questionnaireData);

    // Extract languages from questionnaire data - always include English
    const extractedLanguages = (questionnaireData.languages || []).map((l: any) =>
      l.language?.languageName || l.languageName || ""
    ).filter(Boolean);

    // Ensure English is always included
    const selectedLanguages = Array.from(new Set(["English", ...extractedLanguages]));

    // Extract instructions per language - Initialize with empty strings for all languages
    const instructions: { [lang: string]: string } = {};

    // First, populate from questionnaire data
    (questionnaireData.languages || []).forEach((l: any) => {
      const langName = l.language?.languageName || l.languageName || "";
      if (langName) {
        instructions[langName] = l.instructions || "";
      }
    });

    // Ensure at least English exists (for backward compatibility)
    if (!instructions["English"]) {
      instructions["English"] = "";
    }

    console.log("Initialized instructions:", instructions);

    // Extract section IDs
    const sectionIds = (questionnaireData.sections || []).map((s: any) =>
      String(s.section?.sectionId || s.sectionId || "")
    ).filter(Boolean);

    // Extract section questions and order
    const sectionQuestions: { [sectionId: string]: string[] } = {};
    const sectionQuestionsOrder: { [sectionId: string]: { [questionId: string]: number } } = {};

    (questionnaireData.sections || []).forEach((section: any) => {
      const sectionId = String(section.section?.sectionId || section.sectionId || "");
      if (sectionId) {
        const questionIds = (section.questions || []).map((q: any) =>
          String(q.question?.questionId || q.questionId || "")
        ).filter(Boolean);
        sectionQuestions[sectionId] = questionIds;

        // Build order map
        const orderMap: { [questionId: string]: number } = {};
        (section.questions || []).forEach((q: any) => {
          const qId = String(q.question?.questionId || q.questionId || "");
          if (qId) {
            orderMap[qId] = Number(q.order) || 1;
          }
        });
        sectionQuestionsOrder[sectionId] = orderMap;
      }
    });

    // Extract section instructions
    const sectionInstructions: { [sectionId: string]: { [language: string]: string } } = {};
    (questionnaireData.sections || []).forEach((section: any) => {
      const sectionId = String(section.section?.sectionId || section.sectionId || "");
      if (sectionId) {
        sectionInstructions[sectionId] = {};
        (section.instruction || []).forEach((inst: any) => {
          const langName = inst.language?.languageName || "";
          if (langName) {
            sectionInstructions[sectionId][langName] = inst.instructionText || "";
          }
        });
      }
    });

    console.log("Initialized section instructions:", sectionInstructions);

    // Extract tool ID - handle all possible field name variations
    const extractedToolId = String(
      questionnaireData.tool?.toolId ||
      questionnaireData.tool?.id ||
      questionnaireData.tool?.tool_id ||
      questionnaireData.toolId ||
      ""
    );

    console.log("Extracted tool ID:", extractedToolId);

    return {
      name: questionnaireData.name || "",
      instructions,
      sectionInstructions,
      price: Number(questionnaireData.price) || 0,
      isFree: questionnaireData.isFree === true || questionnaireData.isFree === "true" ? "true" : "false",
      questionnaireType: questionnaireData.type === true || questionnaireData.type === "true" ? "true" : "false", // false = General, true = Bet Assessment
      toolId: extractedToolId,
      languages: selectedLanguages,
      sectionIds,
      sectionQuestions,
      sectionQuestionsOrder,
    };
  }, [questionnaireData]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    
    try {
      // Build the tool object
      const selectedTool = tools.find((t: any) => 
        String(t.id || t.toolId || t.tool_id) === String(values.toolId)
      );
      const toolPayload = selectedTool ? {
        toolId: Number(values.toolId),
        name: selectedTool.name || selectedTool.toolName || null,
        price: selectedTool.price || null,
        isFree: selectedTool.isFree ?? false,
        free: selectedTool.free ?? false
      } : { toolId: Number(values.toolId) };

      // Build the languages array with instructions
      // Include English + all selected languages to ensure English instructions are always saved
      const languagesToIncludeGeneral = Array.from(new Set(["English", ...(values.languages || [])]));

      const languagesPayload = languagesToIncludeGeneral
        .map((langName: string) => {
          const langObj = languages.find((l: any) => l.languageName === langName);
          // Find existing language entry if updating
          const existingLang = (questionnaireData?.languages || []).find((l: any) =>
            (l.language?.languageName || l.languageName) === langName
          );
          const instructionText = values.instructions?.[langName] || "";

          // Language object must be valid
          if (!langObj || !langObj.languageId) {
            console.warn(`Language not found for general instructions: ${langName}`);
            return null;
          }

          return {
            id: existingLang?.id || null,
            language: {
              languageId: langObj.languageId,
              languageName: langObj.languageName
            },
            instructions: instructionText
          };
        })
        .filter((lang: any) => lang !== null);

      console.log("Languages payload (with instructions):", languagesPayload);

      // Build the sections array with questions and instructions
      const sectionsPayload = (values.sectionIds || []).map((sectionId: string, sectionIdx: number) => {
        const sectionObj = sections.find((s: any) => String(s.sectionId) === String(sectionId));
        
        // Find existing section entry if updating
        const existingSection = (questionnaireData?.sections || []).find((s: any) => 
          String(s.section?.sectionId || s.sectionId) === String(sectionId)
        );

        const sectionData = sectionObj ? {
          sectionId: Number(sectionId),
          sectionName: sectionObj.sectionName || "",
          sectionDescription: sectionObj.sectionDescription || "",
          questionId: []
        } : { sectionId: Number(sectionId) };

        // Build questions array for this section
        const sectionQuestionIds = values.sectionQuestions?.[sectionId] || [];
        const sectionQuestionsOrderMap = values.sectionQuestionsOrder?.[sectionId] || {};
        
        const questionsPayload = sectionQuestionIds.map((qId: string, index: number) => {
          const questionObj = questions.find((q: any) =>
            String(q.questionId || q.id) === String(qId)
          );

          // Find existing question entry
          const existingQuestion = (existingSection?.questions || []).find((q: any) =>
            String(q.question?.questionId || q.questionId) === String(qId)
          );

          // Build lightweight question reference - backend has full data
          // Only send questionId; backend will look up full question details
          const questionData = {
            questionId: Number(qId),
            questionText: questionObj?.questionText || "",
            section: sectionData
          };

          const safeSectionName = (sectionData.sectionName || "").replace(/\s+/g, '_');
          const isMQT = questionObj?.flag === true; // flag from lightweight data if available
          const sequence = index + 1;

          const header = isMQT
            ? `${safeSectionName}_MQT_${sequence}`
            : `${safeSectionName}_${sequence}`;

          return {
            questionnaireQuestionId: existingQuestion?.questionnaireQuestionId || null,
            question: questionData,
            order: String(sectionQuestionsOrderMap[qId] || 1),
            excelQuestionHeader: header
          };
        });

        // Build section instructions array
        // Include English + all selected languages to ensure all filled instructions are saved
        const sectionInstructionsData = values.sectionInstructions?.[sectionId] || {};
        const languagesToInclude = Array.from(new Set(["English", ...(values.languages || [])]));

        const instructionPayload = languagesToInclude
          .map((langName: string) => {
            const langObj = languages.find((l: any) => l.languageName === langName);
            // Find existing instruction
            const existingInst = (existingSection?.instruction || []).find((inst: any) =>
              (inst.language?.languageName || inst.languageName) === langName
            );
            const instructionText = sectionInstructionsData[langName] || "";

            // Only include instructions with non-empty text
            if (!instructionText || !instructionText.trim()) {
              return null;
            }

            // Language object must be valid
            if (!langObj || !langObj.languageId) {
              console.warn(`Language not found for: ${langName}`);
              return null;
            }

            return {
              questionnaireSectionInstructionId: existingInst?.questionnaireSectionInstructionId || null,
              language: {
                languageId: langObj.languageId,
                languageName: langObj.languageName
              },
              instructionText: instructionText.trim()
            };
          })
          .filter((inst: any) => inst !== null); // Remove null entries

        console.log(`Section ${sectionId} instructions payload:`, instructionPayload);

        return {
          questionnaireSectionId: existingSection?.questionnaireSectionId || null,
          section: sectionData,
          order: String(sectionIdx + 1),
          questions: questionsPayload,
          instruction: instructionPayload
        };
      });

      // Build the final payload
      const completePayload = {
        questionnaireId: questionnaireData?.questionnaireId || Number(id),
        tool: toolPayload,
        languages: languagesPayload,
        modeId: questionnaireData?.modeId ?? 0,
        price: Number(values.price) || 0,
        isFree: values.isFree === "true",
        type: values.questionnaireType === "true", // false = General, true = Bet Assessment
        name: values.name,
        display: questionnaireData?.display || null,
        sections: sectionsPayload,
        createdAt: questionnaireData?.createdAt || ""
      };
      
      console.log("=== UPDATE QUESTIONNAIRE PAYLOAD ===");
      console.log(JSON.stringify(completePayload, null, 2));
      
      const response = await UpdateQuestionaire(String(id), completePayload); // change it to complete payload afterwards
      if (response.status === 200 || response.status === 201) {
        alert("✅ Questionnaire updated successfully!");
        navigate("/questionaire/List");
      } else {
        throw new Error("Failed to update questionnaire");
      }
      
    } catch (error) {
      console.error("Error updating questionnaire:", error);
      alert("❌ Error updating questionnaire. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTranslation = (questionId: number, language: string) => {
    setTranslationQuestionId(questionId);
    setTranslationTargetLanguage(language);
    setShowTranslationModal(true);
  };

  // Show loading screen while data is being fetched
  if (dataLoading || questionnaireLoading) {
    return (
      <div className="container-fluid py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-xl-8">
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <div className="mb-4">
                  <Spinner animation="border" variant="primary" style={{ width: "3rem", height: "3rem" }} />
                </div>
                <h3 className="text-muted mb-3">Loading Questionnaire Editor</h3>
                <p className="text-muted mb-4">Please wait while we load your questionnaire data...</p>
                
                {/* Loading Progress */}
                <div className="row justify-content-center">
                  <div className="col-md-6">
                    <div className="list-group list-group-flush">
                      {[
                        { key: "questionnaire", label: "Questionnaire Data" },
                        { key: "languages", label: "Languages" },
                        { key: "tools", label: "Tools" },
                        { key: "sections", label: "Sections" },
                        { key: "questions", label: "Questions" },
                      ].map((item) => {
                        const isLoading = !!(loadingStates as any)[item.key];
                        return (
                          <div key={item.key} className={clsx("list-group-item d-flex justify-content-between align-items-center border-0", {
                            "text-success": !isLoading,
                            "text-muted": isLoading
                          })}>
                            <span>
                              <i className={clsx("fas me-2", {
                                "fa-check-circle text-success": !isLoading,
                                "fa-spinner fa-spin text-primary": isLoading
                              })}></i>
                              {isLoading ? `Loading ${item.label}` : `Loaded ${item.label}`}
                            </span>
                            {!isLoading && <span className="badge bg-success">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAssessmentLocked) {
    return (
      <div className="container-fluid py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-xl-8">
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <h2 className="mb-4">Questionnaire Locked</h2>
                <p className="text-muted fs-5">
                  This questionnaire cannot be edited as there is an active assessment going on.
                </p>
                <button className="btn btn-secondary mt-3" onClick={() => navigate("/questionaire/List")}>
                  Go Back to List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-xl-10">
          <div className="card shadow-sm">
            <div className="card-header text-center">
              <h1 className="mb-2 py-3">Edit Questionnaire</h1>
              {questionnaireData && (
                <div className="mb-3">
                  <h4 className="text-primary mb-1">{questionnaireData.name}</h4>
                  <small className="text-muted">
                    ID: {questionnaireData.questionnaireId} | 
                    Mode: {questionnaireData.modeId === 1 ? 'OFFLINE' : 'ONLINE'}
                  </small>
                </div>
              )}
            </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, values, setFieldValue }) => {
            // Debug log to verify values are being set
            console.log("=== FORMIK VALUES ===", values);
            return (
            <>
              <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
                <div className="card-body">
                  
                  {/* 1. Basic Configuration Section */}
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-cog text-primary me-2"></i>
                        1. Questionnaire Configuration
                        {values.isFree && values.languages.length > 0 && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">Questionnaire Name</label>
                            <Field
                              type="text"
                              name="name"
                              placeholder="Enter questionnaire name"
                              className={clsx(
                                "form-control form-control-lg form-control-solid",
                                {
                                  "is-invalid text-danger": touched.name && errors.name,
                                },
                                {
                                  "is-valid": touched.name && !errors.name,
                                }
                              )}
                            />
                            {touched.name && errors.name && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  <span role="alert">{String(errors.name)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6">
                          {/* Questionnaire Type (General / Bet Assessment) */}
                          <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Questionnaire Category:
                            </label>
                            <Field
                              as="select"
                              name="questionnaireType"
                              className={clsx(
                                "form-control form-control-lg form-control-solid",
                                {
                                  "is-invalid text-danger": touched.questionnaireType && errors.questionnaireType,
                                },
                                {
                                  "is-valid": touched.questionnaireType && !errors.questionnaireType,
                                }
                              )}
                            >
                              <option value="">Select Category</option>
                              <option value="false">General</option>
                              <option value="true">Bet Assessment</option>
                            </Field>
                            {touched.questionnaireType && errors.questionnaireType && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  <span role="alert">{String(errors.questionnaireType)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                         <div className="col-md-6">
                           {/* Pricing */}
                           <div className="fv-row mb-7">
                             <label className="required fs-6 fw-bold mb-2">
                               Questionnaire Type:
                             </label>
                             <Field
                               as="select"
                               name="isFree"
                               className={clsx(
                                 "form-control form-control-lg form-control-solid",
                                 {
                                   "is-invalid text-danger": touched.isFree && errors.isFree,
                                 },
                                 {
                                   "is-valid": touched.isFree && !errors.isFree,
                                 }
                               )}
                             >
                               <option value="">Select Type</option>
                               <option value="true">Free</option>
                               <option value="false">Paid</option>
                             </Field>
                             {touched.isFree && errors.isFree && (
                               <div className="fv-plugins-message-container">
                                 <div className="fv-help-block text-danger">
                                   <span role="alert">{String(errors.isFree)}</span>
                                 </div>
                               </div>
                             )}
                           </div>

                           {/* Price field - only show if paid */}
                           {values.isFree === "false" && (
                             <div className="fv-row mb-7">
                               <label className="required fs-6 fw-bold mb-2">
                                 Price:
                               </label>
                               <Field
                                 type="number"
                                 name="price"
                                 placeholder="Enter price"
                                 className={clsx(
                                   "form-control form-control-lg form-control-solid",
                                   {
                                     "is-invalid text-danger": touched.price && errors.price,
                                   },
                                   {
                                     "is-valid": touched.price && !errors.price,
                                   }
                                 )}
                               />
                               {touched.price && errors.price && (
                                 <div className="fv-plugins-message-container">
                                   <div className="fv-help-block text-danger">
                                     <span role="alert">{String(errors.price)}</span>
                                   </div>
                                 </div>
                               )}
                             </div>
                           )}
                         </div>

                        <div className="col-md-6">
                          {/* Language Selection */}
                          <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Questionnaire Languages
                            </label>
                            <FieldArray name="languages">
                              {({ push, remove }) => (
                                <div className={clsx(
                                  "border rounded p-3",
                                  {
                                    "border-danger":  errors.languages,
                                    "border-success": !errors.languages && Array.isArray(values.languages) && values.languages.length > 0,
                                  }
                                )}>
                                  <div className="d-flex flex-wrap gap-4">
                                    {languages.map((lang) => (
                                      <div key={lang.languageId} className="form-check">
                                        <Field
                                          type="checkbox"
                                          name="languages"
                                          value={lang.languageName}
                                          className="form-check-input"
                                          id={`lang-edit-${lang.languageId}`}
                                          checked={Array.isArray(values.languages) && values.languages.includes(lang.languageName)}
                                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            if (e.target.checked) {
                                              push(lang.languageName);
                                            } else {
                                              if (Array.isArray(values.languages)) {
                                                const index = values.languages.indexOf(lang.languageName);
                                                if (index > -1) {
                                                  remove(index);
                                                }
                                              }
                                            }
                                          }}
                                        />
                                        <label
                                          className="form-check-label fw-semibold"
                                          htmlFor={`lang-edit-${lang.languageId}`}
                                        >
                                          {lang.languageName}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </FieldArray>
                            {touched.languages && errors.languages && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  <span role="alert">{String(errors.languages)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. General Instructions Section */}
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-file-text text-primary me-2"></i>
                        2. General Instructions
                        {values.instructions && Object.values(values.instructions).some(inst => inst && String(inst).trim()) && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                    </div>
                    <div className="card-body">
                      {/* Default English Instructions */}
                      <div className="fv-row mb-7">
                        <label className="fs-6 fw-bold mb-2">
                          <i className="fas fa-flag text-muted me-1"></i>
                          English Instructions (Default):
                        </label>
                        <Field name="instructions.English">
                          {({ field }: any) => (
                            <textarea
                              name={field.name}
                              value={field.value || ""}
                              rows={4}
                              placeholder="Enter general instructions for the questionnaire in English"
                              className="form-control form-control-lg form-control-solid"
                              style={{ resize: "vertical" }}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                            />
                          )}
                        </Field>
                      </div>

                      {/* Dynamic Language Instructions */}
                      {Array.isArray(values.languages) && values.languages.length > 0 && (
                        <div className="border-top pt-4">
                          <h6 className="fw-bold mb-4 text-muted">
                            <i className="fas fa-globe text-muted me-1"></i>
                            Instructions for Selected Languages:
                          </h6>
                          {values.languages
                            .filter(lang => lang !== "English")
                            .map((language) => (
                            <div key={language} className="fv-row mb-7">
                              <label className="fs-6 fw-bold mb-2">
                                <i className="fas fa-language text-muted me-1"></i>
                                {language} Instructions:
                              </label>
                              <Field name={`instructions.${language}`}>
                                {({ field }: any) => (
                                  <textarea
                                    name={field.name}
                                    value={field.value || ""}
                                    rows={4}
                                    placeholder={`Enter general instructions for the questionnaire in ${language}`}
                                    className="form-control form-control-lg form-control-solid"
                                    style={{ resize: "vertical" }}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                  />
                                )}
                              </Field>
                            </div>
                          ))}
                        </div>
                      )}

                      {(!Array.isArray(values.languages) || values.languages.length === 0) && (
                        <div className="alert alert-info d-flex align-items-center">
                          <i className="fas fa-info-circle me-2"></i>
                          <span>Select languages in the Questionnaire Configuration section to add language-specific instructions.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Tool Selection Section */}
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-tools text-primary me-2"></i>
                        3. Tool Selection
                        {values.toolId && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                    </div>
                    <div className="card-body">
                      <div className="fv-row mb-7">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label className="required fs-6 fw-bold">Select Tool</label>
                          <button
                            type="button"
                            className="btn btn-sm btn-light-primary"
                            onClick={() => setShowToolModal(true)}
                          >
                            Add New Tool
                          </button>
                        </div>

                        <Field
                          as="select"
                          name="toolId"
                          className={clsx(
                            "form-control form-control-lg form-control-solid",
                            {
                              "is-invalid text-danger": touched.toolId && errors.toolId,
                            },
                            {
                              "is-valid": touched.toolId && !errors.toolId,
                            }
                          )}
                        >
                          <option value="">Select Tool</option>
                          {tools.map((tool) => (
                            <option key={tool.id || tool.toolId || tool.tool_id} value={tool.id || tool.toolId || tool.tool_id}>
                              {tool.name || tool.toolName}
                            </option>
                          ))}
                        </Field>

                        {touched.toolId && errors.toolId && (
                          <div className="fv-plugins-message-container">
                            <div className="fv-help-block text-danger">
                              <span role="alert">{String(errors.toolId)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. Section Selection */}
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-list text-primary me-2"></i>
                        4. Section Selection
                        {Array.isArray(values.sectionIds) && values.sectionIds.length > 0 && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                    </div>
                    <div className="card-body">
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

                        <FieldArray name="sectionIds">
                          {({ push, remove }) => (
                            <div className={clsx(
                              "border rounded p-3",
                              {
                                "border-danger": touched.sectionIds && errors.sectionIds,
                                "border-success": touched.sectionIds && !errors.sectionIds && values.sectionIds.length > 0,
                              }
                            )}>
                              {Array.isArray(sections) && sections.length > 0 ? (
                                <div className="row">
                                  {sections.map((section, index) => {
                                    if (!section || typeof section !== 'object') {
                                      return null;
                                    }

                                    const rawSectionId = section.sectionId || section.id || index;
                                    const sectionId = String(rawSectionId);
                                    const sectionName = String(section.sectionName || section.name || `Section ${index + 1}`);

                                    return (
                                      <div key={sectionId} className="col-md-6 col-lg-4 mb-3">
                                        <div className="form-check">
                                          <Field
                                            type="checkbox"
                                            name="sectionIds"
                                            value={sectionId}
                                            className="form-check-input"
                                            id={`section-edit-${sectionId}`}
                                            checked={Array.isArray(values.sectionIds) && values.sectionIds.includes(sectionId)}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                              if (e.target.checked) {
                                                push(sectionId);
                                              } else {
                                                if (Array.isArray(values.sectionIds)) {
                                                  const index = values.sectionIds.indexOf(sectionId);
                                                  if (index > -1) {
                                                    remove(index);
                                                  }
                                                }
                                              }
                                            } } />
                                          <label
                                            className="form-check-label fw-semibold"
                                            htmlFor={`section-edit-${sectionId}`}
                                          >
                                            {sectionName}
                                          </label>
                                          {section.sectionDescription && (
                                            <div className="ms-4 mt-1">
                                              <span className="text-muted small">
                                                {section.sectionDescription}
                                              </span>
                                            </div>
                                          )}
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
                              <span role="alert">{String(errors.sectionIds)}</span>
                            </div>
                          </div>
                        )}

                        {Array.isArray(values.sectionIds) && values.sectionIds.length > 0 && (
                          <div className="mt-3">
                            <small className="text-muted">
                              Selected: {values.sectionIds.length} section{values.sectionIds.length !== 1 ? 's' : ''}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4.5. Section-Specific Instructions */}
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-file-alt text-primary me-2"></i>
                        4.5. Section Instructions
                      </h3>
                    </div>
                    <div className="card-body">
                      {Array.isArray(values.sectionIds) && values.sectionIds.length > 0 ? (
                        <>
                          <div className="alert alert-info mb-4">
                            <i className="fas fa-info-circle me-2"></i>
                            Provide specific instructions for each section. All section instructions are optional.
                          </div>

                          {values.sectionIds.map((sectionId) => {
                            const section = sections.find(s => String(s.sectionId) === String(sectionId));
                            const sectionName = section?.sectionName || `Section ${sectionId}`;
                            
                            return (
                              <div key={sectionId} className="border rounded p-4 mb-4">
                                <h5 className="mb-3 text-primary">
                                  <i className="fas fa-layer-group me-2"></i>
                                  {sectionName}
                                </h5>
                                
                                {/* English Instructions (Optional) */}
                                <div className="fv-row mb-4">
                                  <label className="fs-6 fw-bold mb-2">
                                    <i className="fas fa-flag text-muted me-1"></i>
                                    English Instructions (Optional):
                                  </label>
                                  <Field name={`sectionInstructions.${sectionId}.English`}>
                                    {({ field }: any) => (
                                      <textarea
                                        name={field.name}
                                        value={field.value || ""}
                                        rows={3}
                                        placeholder={`Enter specific instructions for ${sectionName} in English`}
                                        className="form-control form-control-solid"
                                        style={{ resize: "vertical" }}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                      />
                                    )}
                                  </Field>
                                </div>

                                {/* Other Language Instructions (Optional) */}
                                {Array.isArray(values.languages) && values.languages.length > 0 && (
                                  <div>
                                    {values.languages
                                      .filter(lang => lang !== "English")
                                      .map((language) => (
                                        <div key={language} className="fv-row mb-3">
                                          <label className="fs-6 fw-bold mb-2">
                                            <i className="fas fa-language text-muted me-1"></i>
                                            {language} Instructions (Optional):
                                          </label>
                                          <Field name={`sectionInstructions.${sectionId}.${language}`}>
                                            {({ field }: any) => (
                                              <textarea
                                                name={field.name}
                                                value={field.value || ""}
                                                rows={3}
                                                placeholder={`Enter specific instructions for ${sectionName} in ${language} (optional)`}
                                                className="form-control form-control-solid"
                                                style={{ resize: "vertical" }}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                              />
                                            )}
                                          </Field>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <div className="alert alert-info d-flex align-items-center">
                          <i className="fas fa-info-circle me-2"></i>
                          <span>Please select sections in the "Section Selection" step above to add section-specific instructions.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5. Question Assignment to Sections */}
                  {Array.isArray(values.sectionIds) && values.sectionIds.length > 0 && (
                    <div className="card mb-6">
                      <div className="card-header">
                        <h3 className="card-title mb-0">
                          <i className="fas fa-plus-circle text-primary me-2"></i>
                          5. Add Questions to Sections
                        </h3>
                      </div>
                      <div className="card-body">
                        <div className="alert alert-info">
                          <i className="fas fa-info-circle me-2"></i>
                          Select a section below to add questions to it.
                        </div>
                        
                        <SectionQuestionSelector
                          sectionIds={values.sectionIds || []}
                          sections={sections}
                          selectedSection={selectedSectionForQuestions}
                          onSelectSection={(sid) => setSelectedSectionForQuestions(sid)}
                          onCreateQuestion={() => setShowQuestionModal(true)}
                          createButtonLabel="Create New Question"
                          questions={questions}
                          values={values}
                          setFieldValue={setFieldValue}
                          languages={values.languages}
                          onAddTranslation={handleAddTranslation}
                        />
                      </div>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="card">
                    <div className="card-footer d-flex justify-content-between">
                      <button
                        type="button"
                        className="btn btn-light btn-lg"
                        onClick={() => navigate("/questionaire/List")}
                      >
                        <i className="fas fa-times me-2"></i>
                        Cancel
                      </button>
                      
                      <div>
                        <button
                          type="button"
                          className="btn btn-info btn-lg me-3"
                          onClick={() => {
                            // Collect all selected question IDs across sections
                            const allQuestionIds = Object.values(values.sectionQuestions || {}).flat();
                            fetchQuestionsFullData(allQuestionIds);
                            setShowPreviewModal(true);
                          }}
                          disabled={!Array.isArray(values.sectionIds) || values.sectionIds.length === 0}
                        >
                          <i className="fas fa-eye me-2"></i>
                          Preview
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-lg"
                          disabled={loading || !values.isFree || !values.toolId || values.sectionIds.length === 0 || values.languages.length === 0}
                        >
                          {!loading && (
                            <span className="indicator-label">
                              <i className="fas fa-save me-2"></i>
                              Update Questionnaire
                            </span>
                          )}
                          {loading && (
                            <span className="indicator-progress" style={{ display: "block" }}>
                              <i className="fas fa-spinner fa-spin me-2"></i>
                              Updating...
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Form>

              {/* Preview Modal */}
              <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                  <Modal.Title>Questionnaire Preview</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  {values.name && (
                    <div className="mb-4 p-3 bg-light rounded">
                      <h5 className="text-primary mb-1">{values.name}</h5>
                      <small className="text-muted">
                        ID: {questionnaireData?.questionnaireId} |
                        Mode: {questionnaireData?.modeId === 1 ? 'OFFLINE' : 'ONLINE'}
                      </small>
                    </div>
                  )}

                  {loadingPreviewData ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <p className="text-muted mt-3">Loading question details...</p>
                    </div>
                  ) : values.sectionIds && values.sectionIds.length > 0 ? (
                    values.sectionIds.map((sectionId) => {
                      const section = sections.find((s) => String(s.sectionId) === String(sectionId));
                      const questionIds = values.sectionQuestions[sectionId] || [];
                      const questionOrderMap = values.sectionQuestionsOrder?.[sectionId] || {};

                      const sortedQuestionIds = [...questionIds].sort((a, b) => {
                        const orderA = questionOrderMap[a] || Infinity;
                        const orderB = questionOrderMap[b] || Infinity;
                        return orderA - orderB;
                      });

                      return (
                        <div key={sectionId} className="mb-4">
                          <h4 className="text-primary border-bottom pb-2 mb-3">{section ? section.sectionName : `Section ${sectionId}`}</h4>
                          {sortedQuestionIds.length > 0 ? (
                            <ul className="list-group list-group-flush">
                              {sortedQuestionIds.map((questionId, index) => {
                                // Use full data for preview (includes options)
                                const question = questionsFullData.find((q) => String(q.questionId || q.id) === String(questionId));
                                return (
                                  <li key={questionId} className="list-group-item px-0">
                                    <p className="fw-bold mb-2">{index + 1}. {question ? question.questionText : `Question not found`}</p>
                                    {question && question.options && question.options.length > 0 ? (
                                      <ul className="list-unstyled ps-4">
                                        {question.options.map((opt: any, optIndex: number) => (
                                          <li key={opt.optionId || optIndex} className="mb-1">
                                            {String.fromCharCode(65 + optIndex)}. {opt.optionText}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-muted fst-italic ps-4">No options available for this question.</p>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-muted">No questions have been added to this section yet.</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-muted">Select sections and add questions to see a preview.</p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                    Close
                  </Button>
                </Modal.Footer>
              </Modal>
            </>
          );
          }}
        </Formik>

        {/* Modals */}
        <CollegeCreateModal
          setPageLoading={setPageLoadingState}
          show={showCollegeModal}
          onHide={() => setShowCollegeModal(false)}
        />

        <QuestionSectionCreateModal
          show={showSectionModal}
          onHide={() => setShowSectionModal(false)}
        />

        <ToolCreateModal
          show={showToolModal}
          onHide={() => setShowToolModal(false)}
        />

        <QuestionCreateModal
          show={showQuestionModal}
          onHide={() => setShowQuestionModal(false)}
          setPageLoading={setPageLoadingState}
        />

        <QuestionLanguageModal
          show={showTranslationModal}
          onHide={() => setShowTranslationModal(false)}
          questionId={translationQuestionId}
          targetLanguage={translationTargetLanguage}
          setPageLoading={(isLoading) => setPageLoadingState(prev => [String(isLoading)])} 
        />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionareEditSinglePage;
