import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { BiBookReader } from "react-icons/bi";
import { useLocation } from "react-router-dom";
import { ReadBatchByBranchIdData } from "./API/Batch_APIs";
import BatchCreateModal from "./components/BatchCreateModal";
import BatchTable from "./components/BatchTable";

const BatchPage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [BatchData, setBatchData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const location = useLocation();
  const data: any = location.state;

  useEffect(() => {
    setLoading(true);
    try {
      ReadBatchByBranchIdData(data.branchId).then((data) => {
        setBatchData(data.data.instituteBranchBatchMapping);
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
            <h1>{data.branch} - Batches</h1>
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
                    Add Batch <BiBookReader size={23} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <BatchTable
            data={BatchData}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
        </div>
      )}

      <BatchCreateModal
        branchId={data.branchId}
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />
    </div>
  );
};

export default BatchPage;
