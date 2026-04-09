import { MDBDataTableV5 } from "mdbreact";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { showErrorToast } from "../../../utils/toast";
import { DeleteQuestionSectionData } from "../API/Question_Section_APIs";

const QuestionSectionTable = (props: {
  setPageLoading(arg0: string[]): unknown;
  data: any;
  setLoading: any;
}) => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  const filteredData = props.data.filter((item: any) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      (item.sectionName || "").toLowerCase().includes(q) ||
      (item.sectionDescription || "").toLowerCase().includes(q)
    );
  });

  const datatable = {
    columns: [
      { label: "#", field: "serialNo", width: 50, sort: "disabled" },
      { label: "Section Name", field: "sectionName", width: 250, sort: "asc" },
      { label: "Description", field: "sectionDescription", width: 400 },
      { label: "Actions", field: "actions", sort: "disabled", width: 120 },
    ],

    rows: filteredData.map((data: any, index: number) => ({
      serialNo: (
        <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>{index + 1}</span>
      ),
      sectionName: (
        <span style={{ fontSize: "0.88rem", color: "#111827", fontWeight: 600 }}>
          {data.sectionName}
        </span>
      ),
      sectionDescription: (
        <span style={{ fontSize: "0.84rem", color: "#4b5563" }}>
          {data.sectionDescription || "—"}
        </span>
      ),
      actions: (
        <div className="d-flex gap-1">
          <button
            onClick={() => {
              navigate(`/question-sections/edit/${data.sectionId}`, {
                state: { data },
              });
            }}
            className="btn btn-sm"
            title="Edit"
            style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#2563eb", border: "2px solid #2563eb", borderRadius: "6px" }}
          >
            <i className="bi bi-pencil-fill" style={{ fontSize: "0.85rem" }}></i>
          </button>
          <button
            onClick={async () => {
              try {
                props.setLoading(true);
                await DeleteQuestionSectionData(data.sectionId);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                showErrorToast("Failed to delete section. Please try again.");
                props.setLoading(false);
              }
            }}
            className="btn btn-sm"
            title="Delete"
            style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: "6px" }}
          >
            <i className="bi bi-trash-fill" style={{ fontSize: "0.85rem" }}></i>
          </button>
        </div>
      ),
    })),
  };

  return (
    <>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
          <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search sections..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ paddingLeft: 32, borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
          />
        </div>
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          {filteredData.length} of {props.data.length} sections
        </span>
      </div>

      {/* Table */}
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[10, 25, 50]}
        entries={25}
        pagesAmount={4}
        searchTop={false}
        searchBottom={false}
        data={datatable}
      />
    </>
  );
};

export default QuestionSectionTable;
