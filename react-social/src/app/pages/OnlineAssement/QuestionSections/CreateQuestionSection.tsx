import { useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useQuestionSections } from "../../../lib/queries/lookups";
import QuestionSectionTable from "./components/QuestionSectionTable";

const QuestionSectionPage = () => {
  const { data: questionSectionData = [], isLoading: loading } = useQuestionSections<any>();
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();

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
            <h1>Assessment Sections</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => {
                  navigate("/question-sections/create");
                }}
              >
                <IconContext.Provider
                  value={{ style: { paddingBottom: "4px" } }}
                >
                  <div>
                    Add Section <MdQuestionAnswer size={21} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <QuestionSectionTable
            data={questionSectionData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionSectionPage;