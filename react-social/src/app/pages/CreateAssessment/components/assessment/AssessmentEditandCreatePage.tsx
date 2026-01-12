import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadAssessmentByIdData, UpdateAssessmentData, CreateAssessmentData } from "../../API/Create_Assessment_APIs";
import { ReadQuestionaireData } from "../../API/Create_Questionaire_APIs";
import { Dropdown, Form } from "react-bootstrap";

const validationSchema = Yup.object().shape({
  assessmentName: Yup.string().required("Assessment name is required"),
});

const AssessmentEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [assessmentData, setAssessmentData] = useState<any>({
    id: "",
    assessmentName: "",
    startDate: "",
    endDate: "",
    isActive: false,
    modeofAssessment: false,
  });
  
 
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | null>(null);

  // Fetch questionnaires when component mounts
  useEffect(() => {
    const fetchQuestionnaires = async () => {
      try {
        const response = await ReadQuestionaireData();
        console.log("Loaded questionnaires:", response.data);
        setQuestionnaires(response.data);
      } catch (error) {
        console.error("Error fetching questionnaires:", error);
      }
    };
    fetchQuestionnaires();
  }, []);

  // Fetch tool data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          setLoading(true);
          const response = await ReadAssessmentByIdData(id);
          console.log("Fetched assessment data:", response.data);
          const transformedData = {
            id: response.data.id,
            assessmentName: response.data.AssessmentName || response.data.assessmentName,
            startDate: response.data.starDate || response.data.startDate || "",
            endDate: response.data.endDate || "",
            isActive: response.data.isActive || false,
            modeofAssessment: response.data.modeofAssessment || false,
          };
          setAssessmentData(transformedData);
          
          // Pre-select questionnaire if exists
          if (response.data.questionnaire?.id) {
            setSelectedQuestionnaireId(response.data.questionnaire.id);
          }
          
      
        } catch (error) {
          console.error("Error fetching assessment:", error);
          // Try to get data from location state as fallback
          const locationData = (location.state as any)?.data;
          if (locationData) {
            setAssessmentData(locationData);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback to location state if no ID in URL
        const locationData = (location.state as any)?.data;
        if (locationData) {
          setAssessmentData(locationData);
        }
      }
    };

    fetchData();
  }, [id, location.state]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: assessmentData.id || id || "",
      assessmentName: assessmentData.assessmentName || assessmentData.AssessmentName || "",
      startDate: assessmentData.startDate || assessmentData.starDate || "",
      endDate: assessmentData.endDate || "",
      isActive: assessmentData.isActive || false,
      modeofAssessment: assessmentData.modeofAssessment || false,
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Transform the form values to match backend model (AssessmentTable.java)
        const payload: any = {
          AssessmentName: values.assessmentName,
          starDate: values.startDate,
          endDate: values.endDate,
          isActive: values.isActive,
          modeofAssessment: values.modeofAssessment,
        };

        // Add questionnaire if selected (use questionnaireId to match backend model)
        if (selectedQuestionnaireId) {
          payload.questionnaire = { questionnaireId: selectedQuestionnaireId };
        }

        console.log("Payload being sent:", payload);

        let response;
        if (isEditMode && values.id) {
          // Update existing assessment
          response = await UpdateAssessmentData(values.id, payload);
          console.log("Update successful:", response);
        } else {
          // Create new assessment
          response = await CreateAssessmentData(payload);
          console.log("Create successful:", response);
        }

        navigate("/assessments");

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
          alert(`Failed to ${isEditMode ? "update" : "create"} assessment: ${errorMessage}`);
        } else {
          alert(`Failed to ${isEditMode ? "update" : "create"} assessment: Unknown error occurred`);
        }
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h1 className="mb-0">{isEditMode ? "Edit" : "Create"} Assessment</h1>
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

            {/* Assessment Name */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Assessment Name:
              </label>
              <input
                type="text"
                placeholder="Enter Assessment Name"
                {...formik.getFieldProps("assessmentName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.assessmentName && formik.errors.assessmentName,
                  },
                  {
                    "is-valid":
                      formik.touched.assessmentName && !formik.errors.assessmentName,
                  }
                )}
              />
              {formik.touched.assessmentName && formik.errors.assessmentName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.assessmentName)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Assessment Price Type */}


            {/* Options Management Section */}
            <div className="card mb-7">
              <h3 className="card-title">Assessment Settings</h3>
              <div className="card-body">
                <div className="mb-3">
                  <label className="fs-6 fw-bold mb-2">Start Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    {...formik.getFieldProps("startDate")}
                  />
                </div>
                <div className="mb-3">
                  <label className="fs-6 fw-bold mb-2">End Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    {...formik.getFieldProps("endDate")}
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isActive"
                    checked={formik.values.isActive}
                    onChange={() =>
                      formik.setFieldValue("isActive", !formik.values.isActive)
                    }
                  />
                  <label className="form-check-label" htmlFor="isActive">
                    Is Active
                  </label>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="modeofAssessment"
                    checked={formik.values.modeofAssessment}
                    onChange={() =>
                      formik.setFieldValue("modeofAssessment", !formik.values.modeofAssessment)
                    }
                  />
                  <label className="form-check-label" htmlFor="modeofAssessment">
                    Mode of Assessment (Online)
                  </label>
                </div>
              </div>
            </div>
            <div className="card mb-7">
              <h3 className="card-title">Select Questionnaire</h3>
              <div className="card-body">
                {questionnaires.length === 0 ? (
                  <div className="text-muted">No questionnaires available</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {questionnaires.map((q: any, index: number) => {
                      const qId = q.questionnaireId || q.id;
                      return (
                        <label
                          key={qId ?? index}
                          className={`d-flex align-items-center p-3 rounded border cursor-pointer ${
                            selectedQuestionnaireId === qId
                              ? "border-primary bg-light-primary"
                              : "border-secondary"
                          }`}
                          style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                        >
                          <input
                            type="radio"
                            name="questionnaire"
                            className="form-check-input me-3"
                            style={{ width: "20px", height: "20px" }}
                            checked={selectedQuestionnaireId === qId}
                            onChange={() => setSelectedQuestionnaireId(qId)}
                          />
                          <div className="d-flex flex-column">
                            <span className="fw-bold">
                              {q.name || q.questionnaireName || `Questionnaire ${qId}`}
                            </span>
                            {q.description && (
                              <small className="text-muted">{q.description}</small>
                            )}
                          </div>
                          {selectedQuestionnaireId === qId && (
                            <span className="badge bg-primary ms-auto">Selected</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/assessments")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {!loading && <span className="indicator-label">{isEditMode ? "Update" : "Create"}</span>}
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

export default AssessmentEditPage;
