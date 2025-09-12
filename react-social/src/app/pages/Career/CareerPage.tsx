import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
<<<<<<< HEAD
import { MdQuestionAnswer } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ReadCareerData } from "./API/Career_APIs";
import { CareerTable } from "./components";

const CareerPage = () => {
  const [careerData, setCareerData] = useState([]);
=======
import { MdWork } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ReadCareersData } from "./API/Career_APIs";
import { CareerTable } from "./components";


const CareerPage = () => {
  const [careersData, setCareersData] = useState([]);
>>>>>>> origin/palak
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]); 
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();

<<<<<<< HEAD
  const fetchCareerData = async () => {
    setLoading(true);
    try {
      const response = await ReadCareerData();
      setCareerData(response.data);
    } catch (error) {
      console.error("Failed to fetch career data:", error);
=======

  const fetchCareers = async () => {
    setLoading(true);
    try {
      const response = await ReadCareersData();
      setCareersData(response.data);
    } catch (error) {
      console.error("Failed to fetch careers:", error);
>>>>>>> origin/palak
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
<<<<<<< HEAD
      const fetchSections = async () => {
        setLoading(true);
        try {
          const response = await ReadCareerData();
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
    fetchCareerData();

=======
    fetchCareers();
    
>>>>>>> origin/palak
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
<<<<<<< HEAD
            <h1>Career</h1>
=======
            <h1>Careers</h1>
>>>>>>> origin/palak
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => {
<<<<<<< HEAD
                  navigate("/careers/create");
=======
                  navigate("/career/create");
>>>>>>> origin/palak
                }}
              >
                <IconContext.Provider value={{ style: { paddingBottom: "4px" } }}>
                  <div>
<<<<<<< HEAD
                    Add Career <MdQuestionAnswer size={21} />
=======
                    Add Career <MdWork size={21} />
>>>>>>> origin/palak
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