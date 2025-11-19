import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { ReadQuestionsData } from "../../AssesmentQuestions/API/Question_APIs";
import { QuestionTable } from "../../AssesmentQuestions/components";
import QuestionCreateModal from "../../AssesmentQuestions/components/QuestionCreateModal"; // Import modal

const AssessmentQuestionsPage = () => {
  const [questionsData, setQuestionsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showModal, setShowModal] = useState(false); // State for modal visibility
  const navigate = useNavigate();

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await ReadQuestionsData();
      setQuestionsData(response.data);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    fetchQuestions();

    if (pageLoading[0] === "true") {
      setPageLoading(["false"]);
    }
  }, [pageLoading[0]]);

  return (
    <div className="card">
      {loading && (
        <span className="indicator-progress m-5" style={{ display: "block" }}>
          Please wait...{" "}
          <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      )}

      {!loading && (
        <>
          <div className="card-header border-0 pt-6">
            <div className="card-title">
              <h1>Assessment Questions</h1>
            </div>

            <div className="card-toolbar">
              <div className="d-flex justify-content-end">
                <Button
                  variant="primary"
                  onClick={() => setShowModal(true)} // Open modal
                >
                  <IconContext.Provider
                    value={{ style: { paddingBottom: "4px" } }}
                  >
                    <div>
                      Add Question <MdQuestionAnswer size={21} />
                    </div>
                  </IconContext.Provider>
                </Button>
              </div>
            </div>
          </div>

          <div className="card-body pt-5">
            <QuestionTable
              data={questionsData}
              sections={sections}
              // setLoading={true}
              setPageLoading={setPageLoading}
            />
          </div>

          {/* Footer Buttons */}
          <div className="card-footer d-flex justify-content-end mt-4">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/assessments/create/step-6")}
            >
              Next
            </button>
          </div>

          {/* Question Create Modal */}
          <QuestionCreateModal
            show={showModal}
            onHide={() => setShowModal(false)}
            setPageLoading={setPageLoading}
          />
        </>
      )}
    </div>
  );
};

export default AssessmentQuestionsPage;
