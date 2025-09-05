import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { BsCalendarWeek } from "react-icons/bs";
import { useLocation } from "react-router-dom";
import { ReadSessionByBatchIdData } from "./API/Session_APIs";
import SessionCreateModal from "./components/SessionCreateModal";
import SessionTable from "./components/SessionTable";

const SessionPage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [SessionData, setSessionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const location = useLocation();
  const data: any = location.state;

  useEffect(() => {
    setLoading(true);
    try {
      ReadSessionByBatchIdData(data.batchId).then((data) => {
        setSessionData(data.data);
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
            <h1>
              {data.batchStart}-{data.batchEnd} - Sessions
            </h1>
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
                    Add Session <BsCalendarWeek size={23} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <SessionTable
            data={SessionData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}

      <SessionCreateModal
        batchId={data.batchId}
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />
    </div>
  );
};

export default SessionPage;
