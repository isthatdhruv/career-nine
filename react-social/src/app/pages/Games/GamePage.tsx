import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ListGamesData } from "./components/API/GAME_APIs";
import GameCreateModal from "./components/GameCreateModal";
import GameTable from "./components/GameTable";
import PageHeader from "../../components/PageHeader";


const GamePage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [GameData, setGameData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const location = useLocation();
  const data: any = location.state;

  useEffect(() => {
    setLoading(true);
    try {
      ListGamesData().then((data) => {
        setGameData(data.data);
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
        icon={<i className="bi bi-controller" />}
        title={data ? `${data.gameName}-${data.gameCode} - Sessions` : "Games"}
        subtitle={
          loading ? (
            "Loading..."
          ) : (
            <>
              <strong>{GameData?.length || 0}</strong> games
            </>
          )
        }
        actions={[
          {
            label: "Add Game",
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
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading games...</p>
        </div>
      )}

      {!loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
            <GameTable
              data={GameData || []}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}

      <GameCreateModal
        GameId={data?.gameId || ""}
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />
    </div>
  );
};

export default GamePage;
