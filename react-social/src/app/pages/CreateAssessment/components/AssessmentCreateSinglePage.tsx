import clsx from "clsx";
import { Field, Form, Formik, FieldArray } from "formik";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { Button, Modal } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer, MdUploadFile, MdSettings } from "react-icons/md";
import * as XLSX from "xlsx";
import { MDBDataTableV5 } from "mdbreact";

// API imports
import { ReadCollegeData } from "../../College/API/College_APIs";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { ReadToolData } from "../../Tool/API/Tool_APIs";
import { ReadQuestionsData } from "../../AssesmentQuestions/API/Question_APIs";
import { CreateAssessmentData } from "../API/Create_Assessment_APIs";
import { ReadLanguageData } from "../API/Create_Assessment_APIs";

// Component imports
import CollegeCreateModal from "../../College/components/CollegeCreateModal";
import QuestionSectionCreateModal from "../../QuestionSections/components/QuestionSectionCreateModal";
import ToolCreateModal from "../../Tool/components/ToolCreateModal";
import QuestionCreateModal from "../../AssesmentQuestions/components/QuestionCreateModal";
import { QuestionTable } from "../../AssesmentQuestions/components";
import SectionQuestionSelector from "./SectionQuestionSelector";

const validationSchema = Yup.object().shape({
  // Basic Info
  name: Yup.string().required("Assessment name is required"),
  instructions: Yup.object().optional(),
  isFree: Yup.string().required("Assessment price type is required"),
  price: Yup.number()
    .typeError("Price must be a number")
    .when("isFree", {
      is: "false",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
  collegeId: Yup.string().required("College is required"),
  languages: Yup.array().min(1, "At least one language must be selected"),
  
  // Tool selection
  toolId: Yup.string().required("Tool is required"),
  
  // Section selection
  sectionIds: Yup.array().min(1, "At least one section must be selected"),
});

const AssessmentCreateSinglePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Data states
  const [colleges, setColleges] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  
  // Modal states
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // File upload states
  const [fileName, setFileName] = useState("");
  const [tableData, setTableData] = useState<{
    columns: { label: string; field: string; sort: string; width: number }[];
    rows: any[];
  }>({
    columns: [],
    rows: [],
  });

  const [pageLoadingState, setPageLoadingState] = useState(["false"]);
  
  // Question assignment state
  const [selectedSectionForQuestions, setSelectedSectionForQuestions] = useState<string>("");
  // pre-filled mapping from fetched questions: sectionId -> [questionId,...]
  const [preSectionQuestions, setPreSectionQuestions] = useState<{ [k: string]: string[] }>({});

  const initialValues = useMemo(() => ({
    name: "",
    instructions: { "English": "" },
    sectionInstructions: {} as { [sectionId: string]: { [language: string]: string } },
    price: 0,
    isFree: "true",
    collegeId: "",
    toolId: "",
    languages: [] as string[],
    sectionIds: [] as string[],
    sectionQuestions: preSectionQuestions as { [sectionId: string]: string[] },
    // ADD THIS NEW LINE FOR QUESTION ORDERING
    sectionQuestionsOrder: Object.keys(preSectionQuestions).reduce((acc: any, sid) => {
      acc[sid] = (preSectionQuestions[sid] || []).reduce((m: any, qid: string, idx: number) => {
        m[qid] = idx + 1;
        return m;
      }, {});
      return acc;
    }, {}) as { [sectionId: string]: { [questionId: string]: number } },
  }), [preSectionQuestions]);

  // Fetch data functions
  const fetchColleges = async () => {
    try {
      const response = await ReadCollegeData();
      setColleges(response.data || []);
    } catch (error) {
      console.error("Error fetching colleges:", error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await ReadQuestionSectionData();
      const sectionsData = response.data || [];
      // Ensure we have a proper array and clean the data
      const cleanedSections = Array.isArray(sectionsData) 
        ? sectionsData.map(section => {
            // Ensure each section is a plain object with expected properties
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
      setSections([]); // Ensure we always have an array
    }
  };

  const fetchTools = async () => {
    try {
      const response = await ReadToolData();
      setTools(response.data || []);
    } catch (error) {
      console.error("Error fetching tools:", error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await ReadQuestionsData();
      setQuestions(response.data || []);
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  const fetchLanguages = async () => {
    try {
      const response = await ReadLanguageData();
      setLanguages(response.data || []);
    } catch (error) {
      console.error("Error fetching languages:", error);
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchColleges();
    fetchSections();
    fetchTools();
    fetchQuestions();
    fetchLanguages();
  }, []);

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

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".xlsx", ".xls"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      alert("❌ Only Excel files (.xlsx, .xls) are allowed!");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      // Convert to table data format if needed for display
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length > 0) {
        const keys = Object.keys(jsonData[0] as object);
        const columns = keys.map(key => ({
          label: key,
          field: key,
          sort: 'asc',
          width: 150
        }));
        setTableData({ columns, rows: jsonData });
      }
    };
    reader.readAsArrayBuffer(file);
    setFileName(file.name);
    setShowUploadModal(false);
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    
    try {
      // Print the complete form data in JSON format
      console.log("=== COMPLETE FORM DATA ===");
      console.log(JSON.stringify(values, null, 2));
      
      // Also create a structured payload for better understanding
      const structuredPayload = {
        // Basic Assessment Information
        basicInfo: {
          name: values.name,
          isFree: values.isFree === "true",
          price: values.isFree === "true" ? 0 : Number(values.price),
          languages: values.languages,
          createdAt: new Date().toISOString()
        },
        
        // Multi-language Instructions
        instructions: {
          byLanguage: values.instructions || {},
          hasInstructions: values.instructions && Object.values(values.instructions).some(inst => inst && String(inst).trim()),
          supportedLanguages: values.languages || []
        },
        
        // Section-specific Instructions
        sectionInstructions: {
          bySection: values.sectionInstructions || {},
          hasSectionInstructions: values.sectionInstructions && Object.keys(values.sectionInstructions).some(sectionId => 
            values.sectionInstructions[sectionId] && Object.values(values.sectionInstructions[sectionId]).some(inst => inst && String(inst).trim())
          ),
          supportedLanguages: values.languages || [],
          sectionsWithInstructions: Object.keys(values.sectionInstructions || {}).filter(sectionId => 
            values.sectionInstructions[sectionId] && Object.values(values.sectionInstructions[sectionId]).some(inst => inst && String(inst).trim())
          )
        },
        
        // College Information
        collegeInfo: {
          collegeId: values.collegeId,
          collegeName: colleges.find(c => 
            c.instituteCode === values.collegeId || 
            c.id === values.collegeId || 
            c.collegeId === values.collegeId ||
            String(c.instituteCode) === String(values.collegeId)
          )?.instituteName || 
          colleges.find(c => 
            c.instituteCode === values.collegeId || 
            c.id === values.collegeId || 
            c.collegeId === values.collegeId ||
            String(c.instituteCode) === String(values.collegeId)
          )?.instituteName || 
          colleges.find(c => 
            c.instituteCode === values.collegeId || 
            c.id === values.collegeId || 
            c.collegeId === values.collegeId ||
            String(c.instituteCode) === String(values.collegeId)
          )?.name || "Unknown",
          collegeDetails: colleges.find(c => 
            c.instituteCode === values.collegeId || 
            c.id === values.collegeId || 
            c.collegeId === values.collegeId ||
            String(c.instituteCode) === String(values.collegeId)
          ) || null
        },
        
        // Tool Information
        toolInfo: {
          toolId: values.toolId,
          toolName: tools.find(t => 
            t.id === values.toolId || 
            t.toolId === values.toolId || 
            t.tool_id === values.toolId ||
            String(t.id) === String(values.toolId)
          )?.name || tools.find(t => 
            t.id === values.toolId || 
            t.toolId === values.toolId || 
            t.tool_id === values.toolId ||
            String(t.id) === String(values.toolId)
          )?.toolName || "Unknown",
          toolDetails: tools.find(t => 
            t.id === values.toolId || 
            t.toolId === values.toolId || 
            t.tool_id === values.toolId ||
            String(t.id) === String(values.toolId)
          ) || null
        },
        
        // Comprehensive Sections Information
        sectionsInfo: {
          selectedSectionIds: values.sectionIds,
          totalSections: values.sectionIds.length,
          sectionsWithFullDetails: values.sectionIds.map(sectionId => {
            const section = sections.find(s => String(s.sectionId) === String(sectionId));
            const questionIds = values.sectionQuestions[sectionId] || [];
            const questionOrderMap = values.sectionQuestionsOrder?.[sectionId] || {};
            
            return {
              sectionId,
              sectionName: section?.sectionName || "Unknown",
              sectionDescription: section?.sectionDescription || "",
              sectionDetails: section || null,
              questionCount: questionIds.length,
              questionsWithFullDetails: questionIds.map(questionId => {
                const question = questions.find(q => String(q.questionId) === String(questionId));
                
                return {
                  questionId,
                  questionText: question?.questionText || "Question not found",
                  questionType: question?.questionType || "unknown",
                  maxOptionsAllowed: question?.maxOptionsAllowed || 0,
                  orderInSection: questionOrderMap[questionId] || 0,
                  questionDetails: question || null,
                  
                  // Language-specific question data
                  questionsByLanguage: values.languages.reduce((acc, language) => {
                    // Check if question has language-specific data
                    const langSpecificData = question?.translations?.find(t => t.language === language) || 
                                           question?.questionTexts?.find(t => t.language === language) ||
                                           question?.[`questionText_${language}`] ||
                                           question?.[language.toLowerCase()];
                    
                    acc[language] = {
                      questionText: langSpecificData?.questionText || 
                                   langSpecificData?.text || 
                                   question?.questionText || 
                                   "Translation not available",
                      hasTranslation: !!langSpecificData,
                      translationSource: langSpecificData ? "database" : "fallback"
                    };
                    return acc;
                  }, {} as Record<string, any>),
                  
                  // Detailed Options Information with Language Support
                  options: (question?.options || []).map((option, optIndex) => ({
                    optionId: option.optionId || `option_${optIndex}`,
                    optionText: option.optionText || "",
                    description: option.description || "",
                    sequence: option.sequence || (optIndex + 1),
                    correct: option.correct || false,
                    
                    // Language-specific option data
                    optionsByLanguage: values.languages.reduce((acc, language) => {
                      // Check if option has language-specific data
                      const langSpecificData = option?.translations?.find(t => t.language === language) ||
                                             option?.optionTexts?.find(t => t.language === language) ||
                                             option?.[`optionText_${language}`] ||
                                             option?.[language.toLowerCase()];
                      
                      const langSpecificDesc = option?.descriptions?.find(d => d.language === language) ||
                                             option?.[`description_${language}`] ||
                                             option?.descriptionTranslations?.[language.toLowerCase()];
                      
                      acc[language] = {
                        optionText: langSpecificData?.optionText || 
                                   langSpecificData?.text || 
                                   option?.optionText || 
                                   "Translation not available",
                        description: langSpecificDesc?.description || 
                                   langSpecificDesc?.text || 
                                   option?.description || 
                                   "",
                        hasTranslation: !!(langSpecificData || langSpecificDesc),
                        translationSource: (langSpecificData || langSpecificDesc) ? "database" : "fallback"
                      };
                      return acc;
                    }, {} as Record<string, any>),
                    
                    // Option Scores and Measured Quality Types
                    optionScores: option.optionScores || [],
                    measuredQualityTypes: (option.optionScores || []).map(score => ({
                      typeId: score.measuredQualityType?.measuredQualityTypeId,
                      typeName: score.measuredQualityType?.measuredQualityTypeName,
                      score: score.score,
                      
                      // Language-specific MQT names if available
                      typeNamesByLanguage: values.languages.reduce((acc, language) => {
                        const mqtLangData = score.measuredQualityType?.translations?.find(t => t.language === language) ||
                                          score.measuredQualityType?.[`name_${language}`] ||
                                          score.measuredQualityType?.[language.toLowerCase()];
                        
                        acc[language] = {
                          typeName: mqtLangData?.name || 
                                   mqtLangData?.typeName || 
                                   score.measuredQualityType?.measuredQualityTypeName || 
                                   "Translation not available",
                          hasTranslation: !!mqtLangData,
                          translationSource: mqtLangData ? "database" : "fallback"
                        };
                        return acc;
                      }, {} as Record<string, any>)
                    }))
                  })).sort((a, b) => a.sequence - b.sequence),
                  
                  optionsCount: question?.options?.length || 0,
                  hasCorrectAnswers: (question?.options || []).some(opt => opt.correct),
                  
                  // Language coverage analysis
                  languageCoverage: {
                    supportedLanguages: values.languages,
                    questionTranslations: values.languages.reduce((acc, lang) => {
                      const hasTranslation = !!(question?.translations?.find(t => t.language === lang) ||
                                               question?.questionTexts?.find(t => t.language === lang) ||
                                               question?.[`questionText_${lang}`]);
                      acc[lang] = hasTranslation;
                      return acc;
                    }, {} as Record<string, boolean>),
                    
                    optionTranslations: (question?.options || []).map((option, idx) => ({
                      optionIndex: idx,
                      optionId: option.optionId || `option_${idx}`,
                      translations: values.languages.reduce((acc, lang) => {
                        const hasTranslation = !!(option?.translations?.find(t => t.language === lang) ||
                                                 option?.optionTexts?.find(t => t.language === lang) ||
                                                 option?.[`optionText_${lang}`]);
                        acc[lang] = hasTranslation;
                        return acc;
                      }, {} as Record<string, boolean>)
                    })),
                    
                    completenessPercentage: values.languages.length > 0 ? 
                      Math.round((values.languages.filter(lang => {
                        const questionHasTranslation = !!(question?.translations?.find(t => t.language === lang) ||
                                                         question?.questionTexts?.find(t => t.language === lang));
                        const optionsHaveTranslations = (question?.options || []).every(opt => 
                          !!(opt?.translations?.find(t => t.language === lang) ||
                             opt?.optionTexts?.find(t => t.language === lang))
                        );
                        return questionHasTranslation && optionsHaveTranslations;
                      }).length / values.languages.length) * 100) : 0
                  },
                  
                  // Question Validation
                  isValid: {
                    hasText: !!(question?.questionText),
                    hasOptions: (question?.options || []).length > 0,
                    hasValidOptions: (question?.options || []).every(opt => opt.optionText && opt.optionText.trim()),
                    hasLanguageSupport: values.languages.every(lang => {
                      const questionTranslation = question?.translations?.find(t => t.language === lang) ||
                                                 question?.questionTexts?.find(t => t.language === lang) ||
                                                 question?.[`questionText_${lang}`];
                      return !!questionTranslation || lang === "English"; // Assume English is default
                    }),
                    isComplete: !!(question?.questionText) && (question?.options || []).length > 0
                  }
                };
              }).sort((a, b) => a.orderInSection - b.orderInSection),
              
              // Section Validation
              isValid: {
                hasQuestions: questionIds.length > 0,
                allQuestionsValid: questionIds.every(qId => {
                  const q = questions.find(qu => String(qu.questionId) === String(qId));
                  return q && q.questionText && (q.options || []).length > 0;
                }),
                isComplete: questionIds.length > 0
              }
            };
          })
        },
        
        // Raw Question Assignments (for backend processing)
        questionAssignments: {
          sectionQuestions: values.sectionQuestions,
          sectionQuestionsOrder: values.sectionQuestionsOrder,
          totalQuestionsAssigned: Object.values(values.sectionQuestions).flat().length
        },
        
        // File Upload Information
        fileInfo: {
          fileName: fileName || null,
          hasFileData: tableData.rows.length > 0,
          fileData: tableData.rows.length > 0 ? {
            columns: tableData.columns,
            rows: tableData.rows,
            rowCount: tableData.rows.length
          } : null
        },
        
        // Assessment Statistics and Metadata
        statistics: {
          totalSections: values.sectionIds.length,
          totalQuestionsAssigned: Object.values(values.sectionQuestions).flat().length,
          totalUniqueQuestions: Array.from(new Set(Object.values(values.sectionQuestions).flat())).length,
          languageCount: values.languages?.length || 0,
          questionsPerSection: Object.keys(values.sectionQuestions).reduce((acc, sectionId) => {
            acc[sectionId] = (values.sectionQuestions[sectionId] || []).length;
            return acc;
          }, {} as Record<string, number>),
          
          // Question distribution analysis
          questionDistribution: values.sectionIds.map(sectionId => {
            const section = sections.find(s => String(s.sectionId) === String(sectionId));
            const questionCount = (values.sectionQuestions[sectionId] || []).length;
            return {
              sectionId,
              sectionName: section?.sectionName || "Unknown",
              questionCount,
              percentage: values.sectionIds.length > 0 ? 
                Math.round((questionCount / Object.values(values.sectionQuestions).flat().length) * 100) : 0
            };
          })
        },
        
        // Validation Summary
        validation: {
          isComplete: {
            basicInfo: !!(values.name && values.collegeId && values.isFree && values.toolId),
            languageSelection: values.languages && values.languages.length > 0,
            sectionSelection: values.sectionIds && values.sectionIds.length > 0,
            questionAssignment: Object.values(values.sectionQuestions).flat().length > 0,
            overall: !!(
              values.name && values.collegeId && values.isFree && values.toolId &&
              values.languages && values.languages.length > 0 &&
              values.sectionIds && values.sectionIds.length > 0 &&
              Object.values(values.sectionQuestions).flat().length > 0
            )
          },
          
          warnings: [] as string[],
          errors: [] as string[],
          
          // Generate warnings and errors
          issues: (() => {
            const issues: { warnings: string[], errors: string[] } = { warnings: [], errors: [] };
            
            // Check for missing data
            if (!values.name) issues.errors.push("Assessment name is required");
            if (!values.collegeId) issues.errors.push("College selection is required");
            if (!values.toolId) issues.errors.push("Tool selection is required");
            if (!values.languages || values.languages.length === 0) {
              issues.errors.push("At least one language must be selected");
            }
            if (!values.sectionIds || values.sectionIds.length === 0) {
              issues.errors.push("At least one section must be selected");
            }
            if (Object.values(values.sectionQuestions).flat().length === 0) {
              issues.errors.push("At least one question must be assigned to sections");
            }
            
            // Check for warnings
            if (values.isFree === "false" && (!values.price || values.price <= 0)) {
              issues.warnings.push("Price should be set for paid assessments");
            }
            if (!values.instructions || !Object.values(values.instructions).some(inst => inst && String(inst).trim())) {
              issues.warnings.push("No instructions provided");
            }
            
            // Check for sections without questions
            values.sectionIds.forEach(sectionId => {
              const questionCount = (values.sectionQuestions[sectionId] || []).length;
              if (questionCount === 0) {
                const section = sections.find(s => String(s.sectionId) === String(sectionId));
                issues.warnings.push(`Section "${section?.sectionName || sectionId}" has no questions assigned`);
              }
            });
            
            // Check for language coverage issues
            if (values.languages && values.languages.length > 1) {
              const allQuestionIds = Object.values(values.sectionQuestions).flat();
              const questionsWithoutFullTranslation = allQuestionIds.filter(qId => {
                const question = questions.find(q => String(q.questionId) === String(qId));
                if (!question) return true;
                
                return values.languages.some(lang => {
                  if (lang === "English") return false; // Assume English is default
                  
                  const questionTranslation = question?.translations?.find(t => t.language === lang) ||
                                            question?.questionTexts?.find(t => t.language === lang) ||
                                            question?.[`questionText_${lang}`];
                  
                  const optionTranslations = (question?.options || []).every(opt => 
                    !!(opt?.translations?.find(t => t.language === lang) ||
                       opt?.optionTexts?.find(t => t.language === lang) ||
                       opt?.[`optionText_${lang}`])
                  );
                  
                  return !questionTranslation || !optionTranslations;
                });
              });
              
              if (questionsWithoutFullTranslation.length > 0) {
                issues.warnings.push(`${questionsWithoutFullTranslation.length} questions missing translations for selected languages`);
              }
            }
            
            return issues;
          })()
        },
        
        // Raw form values (for debugging)
        rawFormValues: values,
        
        // Generation metadata
        payloadMetadata: {
          generatedAt: new Date().toISOString(),
          version: "1.0",
          includesFullDetails: true,
          includesValidation: true,
          includesStatistics: true
        }
      };
      
      console.log("=== STRUCTURED PAYLOAD ===");
      console.log(JSON.stringify(structuredPayload, null, 2));
      
      // Show alert with JSON data (you can comment this out if console logging is sufficient)
      alert(`Assessment data logged to console. Check browser console for complete JSON data.\n\nSummary:\n- Name: ${values.name}\n- Sections: ${values.sectionIds.length}\n- Questions: ${Object.values(values.sectionQuestions).flat().length}`);
      
      // Uncomment below when ready to actually create assessment
      // const response = await CreateAssessmentData(structuredPayload);
      // if (response.status === 200 || response.status === 201) {
      //   alert("✅ Assessment created successfully!");
      //   navigate("/assessments");
      // } else {
      //   throw new Error("Failed to create assessment");
      // }
      
    } catch (error) {
      console.error("Error creating assessment:", error);
      alert("❌ Error creating assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // build preSectionQuestions from questions fetched (auto-check)
  useEffect(() => {
    const map: { [k: string]: string[] } = {};
    (questions || []).forEach((q: any) => {
      const sid = q?.section?.sectionId ?? q?.sectionId ?? q?.section?.id;
      const qid = String(q?.questionId ?? q?.id ?? "");
      if (sid && qid) {
        const s = String(sid);
        if (!map[s]) map[s] = [];
        if (!map[s].includes(qid)) map[s].push(qid);
      }
    });
    setPreSectionQuestions(map);
  }, [questions]);

  return (
    <div className="container-fluid py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-xl-10">
          <div className="card shadow-sm">
        <div className="card-header text-center">
          <h1 className="mb-2 py-5">Create Assessment</h1>
          {/* <p className="text-muted mb-0">Fill out all sections below to create your assessment</p> */}
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, values, setFieldValue }) => (
            <>
              <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
                <div className="card-body">
                  
                  {/* 1. Basic Information Section */}
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-info-circle text-primary me-2"></i>
                        1. Basic Information
                        {values.name && values.collegeId && values.isFree && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          {/* Assessment Name */}
                          <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Assessment Name:
                            </label>
                            <Field
                              as="input"
                              name="name"
                              placeholder="Enter Assessment Name"
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

                          {/* Pricing */}
                          <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Assessment Type:
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
                          {/* Language Selection */}
                          {/* <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Assessment Languages
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
                                          id={`lang-${lang.languageId}`}
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
                                          htmlFor={`lang-${lang.languageId}`}
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
                        </div> */}

                        <div className="col-md-6">
                          {/* College Selection */}
                          {/* <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Assessment Type:
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
                          </div> */}

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

                          {/* Language Selection */}
                          <div className="fv-row mb-7">
                            <label className="required fs-6 fw-bold mb-2">
                              Assessment Languages
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
                                          id={`lang-${lang.languageId}`}
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
                                          htmlFor={`lang-${lang.languageId}`}
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

                        <div className="col-md-6">
                          {/* College Selection */}
                          <div className="fv-row mb-7">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <label className="required fs-6 fw-bold">
                                Select College
                              </label>
                              <button
                                type="button"
                                className="btn btn-sm btn-light-primary"
                                onClick={() => setShowCollegeModal(true)}
                              >
                                Add New College
                              </button>
                            </div>

                            <Field
                              as="select"
                              name="collegeId"
                              className={clsx(
                                "form-control form-control-lg form-control-solid",
                                {
                                  "is-invalid text-danger":
                                    touched.collegeId && errors.collegeId,
                                },
                                {
                                  "is-valid": touched.collegeId && !errors.collegeId,
                                }
                              )}
                            >
                              <option value="">Select College</option>
                              {colleges.map((college) => (
                                <option
                                  key={college.instituteCode || college.id || college.collegeId}
                                  value={college.instituteCode || college.id || college.collegeId}
                                >
                                  {college.instituteName || college.name}
                                </option>
                              ))}
                            </Field>

                            {touched.collegeId && errors.collegeId && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  <span role="alert">{String(errors.collegeId)}</span>
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
                          {({ field, form }: any) => (
                            <textarea
                              {...field}
                              rows={4}
                              placeholder="Enter general instructions for the assessment in English"
                              className="form-control form-control-lg form-control-solid"
                              style={{ resize: "vertical" }}
                              onChange={(e) => {
                                setFieldValue("instructions.English", e.target.value);
                              }}
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
                            .filter(lang => lang !== "English") // Don't show English again
                            .map((language, index) => (
                            <div key={language} className="fv-row mb-7">
                              <label className="fs-6 fw-bold mb-2">
                                <i className="fas fa-language text-muted me-1"></i>
                                {language} Instructions:
                              </label>
                              <Field name={`instructions.${language}`}>
                                {({ field, form }: any) => (
                                  <textarea
                                    {...field}
                                    rows={4}
                                    placeholder={`Enter general instructions for the assessment in ${language}`}
                                    className="form-control form-control-lg form-control-solid"
                                    style={{ resize: "vertical" }}
                                    onChange={(e) => {
                                      setFieldValue(`instructions.${language}`, e.target.value);
                                    }}
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
                          <span>Select languages in the Basic Information section to add language-specific instructions.</span>
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
                                    // Ensure section is an object with required properties
                                    if (!section || typeof section !== 'object') {
                                      return null;
                                    }

                                    const rawSectionId = section.sectionId || section.id || index;
                                    const sectionId = String(rawSectionId); // Ensure it's always a string
                                    const sectionName = String(section.sectionName || section.name || `Section ${index + 1}`);

                                    return (
                                      <div key={sectionId} className="col-md-6 col-lg-4 mb-3">
                                        <div className="form-check">
                                          <Field
                                            type="checkbox"
                                            name="sectionIds"
                                            value={sectionId}
                                            className="form-check-input"
                                            id={`section-${sectionId}`}
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
                                            htmlFor={`section-${sectionId}`}
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
                        {values.sectionInstructions && Object.keys(values.sectionInstructions).some(sectionId => 
                          values.sectionInstructions[sectionId] && 
                          values.sectionInstructions[sectionId]["English"] && 
                          String(values.sectionInstructions[sectionId]["English"]).trim()
                        ) && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                    </div>
                    <div className="card-body">
                      {Array.isArray(values.sectionIds) && values.sectionIds.length > 0 ? (
                        <>
                          <div className="alert alert-info mb-4">
                            <i className="fas fa-info-circle me-2"></i>
                            Provide specific instructions for each section. English instructions are required, other languages are optional.
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
                                
                                {/* English Instructions (Required) */}
                                <div className="fv-row mb-4">
                                  <label className="required fs-6 fw-bold mb-2">
                                    <i className="fas fa-flag text-muted me-1"></i>
                                    English Instructions:
                                  </label>
                                  <Field name={`sectionInstructions.${sectionId}.English`}>
                                    {({ field, form }: any) => (
                                      <textarea
                                        {...field}
                                        rows={3}
                                        placeholder={`Enter specific instructions for ${sectionName} in English`}
                                        className="form-control form-control-solid"
                                        style={{ resize: "vertical" }}
                                        onChange={(e) => {
                                          setFieldValue(`sectionInstructions.${sectionId}.English`, e.target.value);
                                        }}
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
                                            {({ field, form }: any) => (
                                              <textarea
                                                {...field}
                                                rows={3}
                                                placeholder={`Enter specific instructions for ${sectionName} in ${language} (optional)`}
                                                className="form-control form-control-solid"
                                                style={{ resize: "vertical" }}
                                                onChange={(e) => {
                                                  setFieldValue(`sectionInstructions.${sectionId}.${language}`, e.target.value);
                                                }}
                                              />
                                            )}
                                          </Field>
                                        </div>
                                      ))}
                                  </div>
                                )}
                                
                                {/* Section Description Helper */}
                                {section?.sectionDescription && (
                                  <div className="alert alert-light mt-3">
                                    <small className="text-muted">
                                      <strong>Section Description:</strong> {section.sectionDescription}
                                    </small>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {(!Array.isArray(values.languages) || values.languages.length === 0) && (
                            <div className="alert alert-warning d-flex align-items-center">
                              <i className="fas fa-exclamation-triangle me-2"></i>
                              <span>Select languages in the Basic Information section to add language-specific section instructions.</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="alert alert-info d-flex align-items-center">
                          <i className="fas fa-info-circle me-2"></i>
                          <span>Please select sections in the "Section Selection" step below to add section-specific instructions.</span>
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
                          // Pass down necessary props for question management
                          questions={questions}
                          values={values}
                          setFieldValue={setFieldValue}
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
                        onClick={() => navigate("/assessments")}
                      >
                        <i className="fas fa-times me-2"></i>
                        Cancel
                      </button>
                      
                      <div>
                        <button
                          type="button"
                          className="btn btn-info btn-lg me-3"
                          onClick={() => setShowPreviewModal(true)}
                          disabled={!Array.isArray(values.sectionIds) || values.sectionIds.length === 0}
                        >
                          <i className="fas fa-eye me-2"></i>
                          Preview
                        </button>
                        <button
                          type="submit"
                          className="btn btn-success btn-lg"
                          disabled={loading || !values.name || !values.collegeId || !values.isFree || !values.toolId || values.sectionIds.length === 0 || values.languages.length === 0}
                        >
                          {!loading && (
                            <span className="indicator-label">
                              <i className="fas fa-check me-2"></i>
                              Create Assessment
                            </span>
                          )}
                          {loading && (
                            <span className="indicator-progress" style={{ display: "block" }}>
                              <i className="fas fa-spinner fa-spin me-2"></i>
                              Creating Assessment...
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
                  <Modal.Title>Assessment Preview</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  {values.sectionIds && values.sectionIds.length > 0 ? (
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
                                const question = questions.find((q) => String(q.questionId) === String(questionId));
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
          )}
        </Formik>

        {/* Modals */}
        <CollegeCreateModal
          setPageLoading={setPageLoading ?? (() => {})}
          show={showCollegeModal}
          onHide={() => setShowCollegeModal(false)}
        />

        <QuestionSectionCreateModal
          show={showSectionModal}
          onHide={() => setShowSectionModal(false)}
        />

        <ToolCreateModal
          setPageLoading={setPageLoading ?? (() => {})}
          show={showToolModal}
          onHide={() => setShowToolModal(false)}
        />

        <QuestionCreateModal
          show={showQuestionModal}
          onHide={() => setShowQuestionModal(false)}
          setPageLoading={setPageLoadingState}
        />

        {/* File Upload Modal */}
        <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Upload Excel File</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="form-control"
            />
            <small className="text-muted mt-2 d-block">
              Only Excel files (.xlsx, .xls) are allowed
            </small>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
          </Modal.Footer>
        </Modal>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentCreateSinglePage;