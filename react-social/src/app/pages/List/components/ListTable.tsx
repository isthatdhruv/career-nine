import React from "react";
import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { DeleteListData } from "../API/List_APIs";

type Props = {
  data: any[];
  setLoading: (v: boolean) => void;
  setPageLoading: (v: boolean) => void;
};

const ListTable: React.FC<Props> = ({ data = [], setLoading, setPageLoading }) => {
  const navigate = useNavigate();

  const rows = (data || []).map((item: any, idx: number) => {
    const roll = item?.rollNo ?? "";
    const name = item?.name ?? "";
    const email = item?.email ?? "";
    const id = item?.id ?? item?._id ?? idx;

    return {
      roll,
      name,
      email,
      actions: (
        <div style={{ display: "flex", gap: 8 }}>
          {/* Edit */}
          <button
            onClick={() => navigate(`/list/edit/${id}`, { state: { item } })}
            className="btn btn-icon btn-primary btn-sm"
            style={{
              backgroundColor: "#1e90ff",
              borderColor: "#1e90ff",
              color: "white",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            <AiFillEdit size={16} />
          </button>

          {/* Delete */}
          <button
            onClick={async () => {
              if (!window.confirm("Delete this student?")) return;

              setLoading(true);
              try {
                await DeleteListData(id);
                setPageLoading(true);
              } catch (err) {
                console.error("Delete failed:", err);
                alert("Failed to delete.");
              } finally {
                setLoading(false);
              }
            }}
            className="btn btn-icon btn-danger btn-sm"
            style={{
              backgroundColor: "#ff4d6d",
              borderColor: "#ff4d6d",
              color: "white",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      ),
    };
  });

  const datatable = {
    columns: [
      { label: "Roll No", field: "roll", width: 100 },
      { label: "Name", field: "name", width: 200 },
      { label: "Email", field: "email", width: 250 },
      { label: "Actions", field: "actions", sort: "disabled", width: 150 },
    ],
    rows,
  };

  return (
    <div>
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="60vh"
        entriesOptions={[5, 10, 25]}
        entries={10}
        pagesAmount={4}
        data={datatable}
        noBottomColumns
      />
    </div>
  );
};

export default ListTable;
