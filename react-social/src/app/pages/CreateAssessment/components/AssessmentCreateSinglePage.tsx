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
      const isFreeBool = values.isFree === "true";
      const payload = {
        name: values.name,
        isFree: isFreeBool,
        price: isFreeBool ? 0 : Number(values.price),
        collegeId: values.collegeId,
        toolId: values.toolId,
        sectionIds: values.sectionIds,
        languages: values.languages,
        fileName: fileName,
        // Add any additional data from file upload or questions
      };

      const response = await CreateAssessmentData(payload);
      
      if (response.status === 200 || response.status === 201) {
        alert("✅ Assessment created successfully!");
        navigate("/assessments");
      } else {
        throw new Error("Failed to create assessment");
      }
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
                                  "border-danger": touched.languages && errors.languages,
                                  "border-success": touched.languages && !errors.languages && Array.isArray(values.languages) && values.languages.length > 0,
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
                                key={college.instituteCode}
                                value={college.instituteCode}
                              >
                                {college.instituteName}
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

                {/* 2. Tool Selection Section */}
                <div className="card mb-6">
                  <div className="card-header">
                    <h3 className="card-title mb-0">
                      <i className="fas fa-tools text-primary me-2"></i>
                      2. Tool Selection
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
                          <option key={tool.id} value={tool.id}>
                            {tool.name}
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

                {/* 3. File Upload Section */}
                {/* <div className="card mb-6">
                  <div className="card-header">
                    <h3 className="card-title mb-0">
                      <i className="fas fa-upload text-primary me-2"></i>
                      3. File Upload (Optional)
                      {fileName && (
                        <span className="badge badge-success ms-2">Complete</span>
                      )}
                    </h3>
                  </div>
                  <div className="card-body">
                    <div className="text-center py-4">
                      <div className="mb-4">
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => setShowUploadModal(true)}
                        >
                          <IconContext.Provider value={{ style: { verticalAlign: "middle" } }}>
                            <span className="d-flex align-items-center gap-2">
                              <MdUploadFile size={24} />
                              Upload Excel File
                            </span>
                          </IconContext.Provider>
                        </Button>
                      </div>

                      {fileName && (
                        <div className="alert alert-success">
                          <strong>✅ Uploaded File:</strong> {fileName}
                        </div>
                      )}

                      {tableData.rows.length > 0 && (
                        <div className="mt-4">
                          <h5>File Preview:</h5>
                          <MDBDataTableV5
                            hover
                            entriesOptions={[5, 10, 15]}
                            entries={5}
                            pagesAmount={4}
                            data={tableData}
                            searchTop
                            searchBottom={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div> */}

                {/* 4. Sections Selection */}
                <div className="card mb-6">
                  <div className="card-header">
                    <h3 className="card-title mb-0">
                      <i className="fas fa-list text-primary me-2"></i>
                      3. Section Selection
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
                                          }}
                                        />
                                        <label 
                                          className="form-check-label fw-semibold"
                                          htmlFor={`section-${sectionId}`}
                                        >
                                          {sectionName}
                                        </label>
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

                {/* 4.5. Question Assignment to Sections */}
                {Array.isArray(values.sectionIds) && values.sectionIds.length > 0 && (
                  <div className="card mb-6">
                    <div className="card-header">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-plus-circle text-primary me-2"></i>
                        4. Add Questions to Sections
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

                {/* 6. Questions Management */}
                {/* <div className="card mb-6">
                  <div className="card-header">
                    <div className="d-flex justify-content-between align-items-center">
                      <h3 className="card-title mb-0">
                        <i className="fas fa-question-circle text-primary me-2"></i>
                        6. Questions Management
                        {questions.length > 0 && (
                          <span className="badge badge-success ms-2">Complete</span>
                        )}
                      </h3>
                      <div className="d-flex justify-content-end align-items-center mb-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-light-primary"
                          onClick={() => setShowQuestionModal(true)}
                        >
                          Add New Question
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="questions-section">
                      <QuestionTable
                        data={questions}
                        sections={sections}
                        setPageLoading={setPageLoadingState}
                      />
                    </div>
                  </div>
                </div> */}

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
            </Form>
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