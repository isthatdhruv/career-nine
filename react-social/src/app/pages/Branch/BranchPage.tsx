import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { GiBookshelf } from "react-icons/gi";
import { useLocation } from "react-router-dom";
import { ReadBranchByCourseIdData } from "./API/Branch_APIs";
import BranchCreateModal from "./components/BranchCreateModal";
import BranchTable from "./components/BranchTable";

const BranchPage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [BranchData, setBranchData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const location = useLocation();
  const data: any = location.state;

  useEffect(() => {
    setLoading(true);
    try {
      ReadBranchByCourseIdData(data.courseId).then((data) => {
        setBranchData(data.data);
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
            <h1>{data.course} - Branches</h1>
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
                    Add Branch <GiBookshelf size={25} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <BranchTable
            data={BranchData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}

      <BranchCreateModal
        courseId={data.courseId}
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />
    </div>
  );
};

export default BranchPage;
