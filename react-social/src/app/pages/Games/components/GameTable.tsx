import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteGameTableData } from "./API/GAME_APIs";
import GameEditModal from "./GameEditModal";

const GameTable = (props: {
  data: any[];
  setLoading: any;
  setPageLoading: any;
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState({
    gameName: "",
    gameCode:""
  });

  const datatable = {
    columns: [
      {
        label: "Game ID",
        field: "gameId",
        sort: "asc",
        width: 100,
      },
      {
        label: "Game Name",
        field: "gameName",
        width: 100,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      
      {
        label: "Game Code",
        field: "gameCode",
        sort: "asc",
        width: 100,
      },
      
    ],

    rows: props.data.map((data) => ({
      gameId: data.gameId,
      gameName: data.gameName,
      gameCode: data.gameCode,
      actions: (
        <>
          <button
            onClick={() => {
              setEditModalData(data);
              setModalShowEdit(true);
            }}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <AiFillEdit size={16} />
          </button>

          <button
            onClick={() => {
              props.setLoading(true);
              DeleteGameTableData(data.gameId).then(() => {
                props.setPageLoading(["true"]);
              });
            }}
            className="btn btn-icon btn-danger btn-sm me-3"
          >
            <UseAnimations
              animation={trash}
              size={22}
              strokeColor={"#EFF8FE"}
            />
          </button>
        </>
      ),
    })),
  };

  return (
    <>
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={datatable}
      />
      <GameEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default GameTable;
