import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdSchool } from "react-icons/md";
import { MdPersonAdd } from "react-icons/md";
import { ReadCollegeData } from "./API/College_APIs";
import CollegeCreateModal from "./components/CollegeCreateModal";
import CollegeTable from "./components/CollegeTable";
import StudentUploadModal from "./components/StudentUploadModal";

const CollegePage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [collegeData, setCollegeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showStudentUpload, setShowStudentUpload] = useState(false);
  const [selectedCollegeForUpload, setSelectedCollegeForUpload] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    try {
      ReadCollegeData().then((data) => {
        setCollegeData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      // window.location.replace("/error");
    }
  }, [pageLoading]);

  const openUploadForCollege = (college: any) => {
    setSelectedCollegeForUpload(college);
    setShowStudentUpload(true);
  };

  const onUploadComplete = () => {
    // trigger refresh
    setShowStudentUpload(false);
    setSelectedCollegeForUpload(null);
    setPageLoading([String(Date.now())]);
  };

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
            <h1>Institutes List</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  variant="primary"
                  onClick={() => {
                    setModalShowCreate(true);
                  }}
                >
                  <IconContext.Provider value={{ style: { paddingBottom: "4px" } }}>
                    <div>
                      Add Institute <MdSchool size={21} />
                    </div>
                  </IconContext.Provider>
                </Button>

                <Button
                  variant="outline-primary"
                  onClick={() => navigate("/students")}
                >
                  <IconContext.Provider value={{ style: { paddingBottom: "4px" } }}>
                    <div>
                      Add Student <MdPersonAdd size={20} />
                    </div>
                  </IconContext.Provider>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <CollegeTable
            data={collegeData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
            onUploadClick={openUploadForCollege}
          />
        </div>
      )}

      <CollegeCreateModal
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />

      <StudentUploadModal
        show={showStudentUpload}
        onHide={() => setShowStudentUpload(false)}
        college={selectedCollegeForUpload}
        onUploaded={onUploadComplete}
      />
    </div>
  );
};

export default CollegePage;
