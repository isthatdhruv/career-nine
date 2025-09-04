import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ReadMeasuredQualitiesData } from "./API/Measured_Qualities_APIs";
import { MeasuredQualitiesTable } from "./components";

const MeasuredQualitiesPage = () => {
  const [measuredQualitiesData, setMeasuredQualitiesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]); 
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();

  const fetchMeasuredQualities = async () => {
    setLoading(true);
    try {
      const response = await ReadMeasuredQualitiesData();
      setMeasuredQualitiesData(response.data);
    } catch (error) {
      console.error("Failed to fetch measured qualities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      const fetchSections = async () => {
        setLoading(true);
        try {
          const response = await ReadMeasuredQualitiesData();
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
    fetchMeasuredQualities();

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
            <h1>Measured Qualities</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => {
                  navigate("/measured-qualities/create");
                }}
              >
                <IconContext.Provider
                  value={{ style: { paddingBottom: "4px" } }}
                >
                  <div>
                    Add Measured Qualities <MdQuestionAnswer size={21} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <MeasuredQualitiesTable
            data={measuredQualitiesData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}
    </div>
  );
};

export default MeasuredQualitiesPage;