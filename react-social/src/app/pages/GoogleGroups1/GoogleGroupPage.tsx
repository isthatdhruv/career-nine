import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { BiBookBookmark } from "react-icons/bi";
import { useLocation } from "react-router-dom";
import { ReadCourseByCollegeIdData } from "./API/GoogleGroup_APIs";
import GoogleGroupCreateModal from "./components/GoogleGroupCreateModal";
import GoogleGroupTable from "./components/GoogleGroupTable";

const GoogleGroupPage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [CourseData, setCourseData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const location = useLocation();
  const data: any = location.state;

  useEffect(() => {
    setLoading(true);
    try {
      ReadCourseByCollegeIdData(data.collegeId).then((data) => {
        setCourseData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
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
            <h1>Google Groups</h1>
          </div>

          <div className="card-toolbar">
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() => {
                  setModalShowCreate(true);
                }}
              >
                <IconContext.Provider
                  value={{ style: { paddingBottom: "4px" } }}
                >
                  <div>
                    Add Google Group <BiBookBookmark size={23} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <GoogleGroupTable
            data={CourseData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}
      <GoogleGroupCreateModal
        collegeId={data.collegeId}
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />
    </div>
  );
};

export default GoogleGroupPage;
