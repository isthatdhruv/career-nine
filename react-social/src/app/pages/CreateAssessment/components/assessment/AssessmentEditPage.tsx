import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadAssessmentByIdData, UpdateAssessmentData } from "../../API/Create_Assessment_APIs";
import { ReadQuestionaireData } from "../../API/Create_Questionaire_APIs";
import { Dropdown, Form } from "react-bootstrap";
import { data } from "jquery";

const validationSchema = Yup.object().shape({
  AssessmentName: Yup.string().required("Assessment name is required"),
});

const AssessmentEditPage = (props?: {
  setPageLoading?: any;
  data?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | null>(null);

  function normalizeAssessmentData(data: any) {
    if (!data) return {
      id: "",
      AssessmentName: "",
      startDate: "",
      endDate: "",
      isActive: false,
      modeofAssessment: false,
      questionnaires: [
        {
          questionnaireId: 0,
          questionnaireName: "",
        },
      ],
    };
    return {
      ...data,
      AssessmentName: data.AssessmentName || data.assessmentName || "",
    };
  }

  const [assessmentData, setAssessmentData] = useState<any>(normalizeAssessmentData(props?.data || (location.state as any)?.data));
  const [questionnairesLoading, setQuestionnairesLoading] = useState(true);

  useEffect(() => {
    const fetchQuestionnaires = async () => {
      setQuestionnairesLoading(true);
      try {
        const response = await ReadQuestionaireData();
        setQuestionnaires(response.data);
      } catch (error) {
        console.error("Error fetching questionnaires:", error);
      } finally {
        setQuestionnairesLoading(false);
      }
    };
    fetchQuestionnaires();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const response = await ReadAssessmentByIdData(id);
          const norm = normalizeAssessmentData(response.data);
          setAssessmentData(norm);
          if (norm.questionnaire?.questionnaireId) {
            setSelectedQuestionnaireId(norm.questionnaire.questionnaireId);
          }
        } catch (error) {
          console.error("Error fetching assessment:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [id]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: assessmentData.id || id || "",
      assessmentName: assessmentData.AssessmentName || assessmentData.assessmentName || "",
      startDate: assessmentData.startDate || assessmentData.starDate || "",
      endDate: assessmentData.endDate || "",
      isActive: assessmentData.isActive || false,
      modeofAssessment: assessmentData.modeofAssessment || false,
      questionnaires: assessmentData.questionnaires?.map((q: any) => q.questionnaireId) || [],
    },
    validationSchema: Yup.object().shape({
      assessmentName: Yup.string().required("Assessment name is required"),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const payload: any = {
          id: values.id,
          AssessmentName: values.assessmentName,
          starDate: values.startDate,
          endDate: values.endDate,
          isActive: values.isActive,
          modeofAssessment: values.modeofAssessment,
        };
        if (selectedQuestionnaireId) {
          payload.questionnaire = { questionnaireId: selectedQuestionnaireId };
        }
        let response;
        if (id && values.id) {
          response = await UpdateAssessmentData(values.id, payload);
        }
        navigate("/assessments");
        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }
      } catch (error) {
        const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || "Unknown error occurred";
        alert(`Failed to update assessment: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h1 className="mb-0">Edit Assessment</h1>
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
                {questionnairesLoading ? (
                  <div className="d-flex align-items-center gap-2 py-4">
                    <span className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </span>
                    <span className="text-muted">Loading questionnaires...</span>
                  </div>
                ) : questionnaires.length === 0 ? (
                  <div className="text-muted">No questionnaires available</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {questionnaires.map((q: any, index: number) => {
                      const qId = q.questionnaireId || q.id;
                      return (
                        <label
                          key={qId ?? index}
                          className={`d-flex align-items-center p-3 rounded border cursor-pointer ${selectedQuestionnaireId === qId
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

export default AssessmentEditPage;
