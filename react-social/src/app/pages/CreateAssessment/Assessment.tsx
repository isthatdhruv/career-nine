import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ReadAssessmentData } from "./API/Create_Assessment_APIs";
import { AssessmentTable } from "./components";
import AssessmentCreateModal from "./components/assessment/AssessmentCreateModal";

const AssessmentPage = () => {
  const [assessmentData, setAssessmentData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]); 
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

 

 

  // Initial load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await ReadAssessmentData();
        console.log("Fetched assessment data:", response.data);
        setAssessmentData(response.data || []);
      } catch (error) {
        console.error("Error fetching assessments:", error);
        setAssessmentData([]);
      }
    };
    fetchData();
  }, []);

  // Refresh when pageLoading is set to true
  useEffect(() => {
    if (pageLoading[0] === "true") {
      const fetchData = async () => {
        try {
          const response = await ReadAssessmentData();
          console.log("Refreshed assessment data:", response.data);
          setAssessmentData(response.data || []);
        } catch (error) {
          console.error("Error refreshing assessments:", error);
        }
        setPageLoading(["false"]);
      };
      fetchData();
    }
  }, [pageLoading]);


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
            <h1>Assessments</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => navigate("/assessments/create")}
              >
                <IconContext.Provider
                  value={{ style: { paddingBottom: "4px" } }}
                >
                  <div>
                    Create Assessment <MdQuestionAnswer size={21} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <AssessmentTable
            data={assessmentData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}

      {/* Creation Modal */}
      <AssessmentCreateModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        setPageLoading={setPageLoading}
      />
    </div>
  );
};

export default AssessmentPage;