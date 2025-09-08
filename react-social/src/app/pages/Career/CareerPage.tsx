import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdWork } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ReadCareersData } from "./API/Career_APIs";
import { CareerTable } from "./components";


const CareerPage = () => {
  const [careersData, setCareersData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();


  const fetchCareers = async () => {
    setLoading(true);
    try {
      const response = await ReadCareersData();
      setCareersData(response.data);
    } catch (error) {
      console.error("Failed to fetch careers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCareers();
    
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
            <h1>Careers</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => {
                  navigate("/career/create");
                }}
              >
                <IconContext.Provider value={{ style: { paddingBottom: "4px" } }}>
                  <div>
                    Add Career <MdWork size={21} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <CareerTable
            data={careersData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}
    </div>
  );
};

export default CareerPage;