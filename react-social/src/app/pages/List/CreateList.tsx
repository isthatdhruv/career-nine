import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { MdQuestionAnswer } from "react-icons/md";
import { useNavigate, useLocation } from "react-router-dom";
import { ReadListData } from "./API/List_APIs";
import ListTable from "./components/ListTable";

const ListPage: React.FC = () => {
  const [listsData, setListsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchListData = async () => {
    setLoading(true);
    try {
      const response = await ReadListData();

      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.items)
        ? response.data.items
        : [];

      setListsData(data);
    } catch (error) {
      console.error("Failed to fetch list:", error);
      setListsData([]);
    } finally {
      setLoading(false);
    }
  };

  // initial and on-pageLoading refetch
  useEffect(() => {
    fetchListData();
  }, [pageLoading]);

  // refetch once when navigated back with refresh flag
  useEffect(() => {
    const state = (location as any).state;
    if (state?.refresh) {
      fetchListData();
      // clear history state so refresh happens only once
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div
      className="card"
      style={{ borderRadius: 12, boxShadow: "0 6px 20px rgba(15,23,42,0.06)" }}
    >
      {loading && (
        <span className="indicator-progress m-5" style={{ display: "block" }}>
          Please wait...{" "}
          <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      )}

      {!loading && (
        <div
          className="card-header border-0 pt-6 d-flex align-items-center justify-content-between"
          style={{ position: "relative" }}
        >
          <div className="card-title">
            <h1 style={{ margin: 0 }}>Lists</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              onClick={() => navigate("/list/create")}
              style={{
                backgroundColor: "#0d6efd",
                borderColor: "#0d6efd",
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 12,
                boxShadow: "0 6px 18px rgba(13,110,253,0.12)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span>Add Student</span>
                <MdQuestionAnswer size={18} />
              </span>
            </Button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <ListTable
            data={listsData}
            setLoading={setLoading}
            setPageLoading={(val: boolean) => setPageLoading(val)}
          />
        </div>
      )}
    </div>
  );
};

export default ListPage;
