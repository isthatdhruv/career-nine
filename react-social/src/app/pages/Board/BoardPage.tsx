import { useEffect, useState } from "react";
import { ReadBoardData } from "./API/Board_APIs";
import BoardCreateModal from "./components/BoardCreateModal";
import BoardTable from "./components/BoardTable";
import PageHeader from "../../components/PageHeader";

const BoardPage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [boardData, setBoardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);

  useEffect(() => {
    setLoading(true);
    try {
      ReadBoardData().then((data) => {
        setBoardData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, [pageLoading]);

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-easel" />}
        title="Board List"
        subtitle={
          loading ? (
            "Loading..."
          ) : (
            <>
              <strong>{boardData.length}</strong> boards
            </>
          )
        }
        actions={[
          {
            label: "Add Board",
            iconClass: "bi-plus-lg",
            onClick: () => setModalShowCreate(true),
            variant: "primary",
          },
        ]}
      />

      {loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
          <div className="spinner-border" style={{ color: "#0ea5e9" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading boards...</p>
        </div>
      )}

      {!loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
            <BoardTable
              data={boardData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}

      <BoardCreateModal
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />
    </div>
  );
};

export default BoardPage;
