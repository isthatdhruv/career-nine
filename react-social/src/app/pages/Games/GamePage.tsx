import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { BsCalendarWeek } from "react-icons/bs";
import { useLocation } from "react-router-dom";
import { ListGamesData } from "./components/API/GAME_APIs";
import GameCreateModal from "./components/GameCreateModal";
import GameTable from "./components/GameTable";


const GamePage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [GameData, setGameData] = useState([]);
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
              {data ? `${data.gameName}-${data.gameCode} - Sessions` : "Games"}
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
                    Add Game <BsCalendarWeek size={23} />
                  </div>
                </IconContext.Provider>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card-body pt-5">
          <GameTable
            data={GameData || []}
            setLoading={setLoading}
            setPageLoading={setPageLoading}
          />
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
