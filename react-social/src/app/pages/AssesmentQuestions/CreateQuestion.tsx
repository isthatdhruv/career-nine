import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { FaRecycle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { ReadQuestionSectionData } from "../QuestionSections/API/Question_Section_APIs";
import { ReadQuestionsData, ReadQuestionsDataList } from "./API/Question_APIs";
import { QuestionTable } from "./components";
import QuestionRecycleBinModal from "./components/QuestionRecycleBinModal";

const AssessmentQuestionsPage = () => {
  const [questionsData, setQuestionsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]); 
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBinModal, setShowRecycleBinModal] = useState(false);
  const navigate = useNavigate();


  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await ReadQuestionsDataList();
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
        <div className="card-header border-0 pt-6">
          <div className="card-title">
            <h1>Assessment Questions</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="outline-danger"
                className="d-flex align-items-center"
                onClick={() => setShowRecycleBinModal(true)}
              >
                <FaRecycle size={18} className="me-2" />
                Recycle Bin
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  navigate("/assessment-questions/create");
                }}
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
      )}

      {!loading && (
        <div className="card-body pt-5">
          <QuestionTable
            data={questionsData}
            sections={sections}
            // setLoading={true}
            setPageLoading={setPageLoading}
          />
        </div>
      )}

      <QuestionRecycleBinModal
        show={showRecycleBinModal}
        onHide={() => setShowRecycleBinModal(false)}
        onRestoreComplete={() => setPageLoading(["true"])}
        sections={sections}
      />
    </div>
  );
};

export default AssessmentQuestionsPage;