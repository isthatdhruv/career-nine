import { MDBDataTableV5 } from "mdbreact";
import { useNavigate } from "react-router-dom";
import { ActionIconButton } from "../../../components/ActionIcon";
import { DeleteReportType, ReportTypeDto } from "../API/Report_Types_APIs";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

interface Props {
  types: ReportTypeDto[];
  onChanged: () => void;
}

const ReportTypesTable = ({ types, onChanged }: Props) => {
  const navigate = useNavigate();

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this report type? Fails if subtypes still reference it.")) return;
    try {
      await DeleteReportType(id);
      showSuccessToast("Report type deleted.");
      onChanged();
    } catch (e: any) {
      const msg = e?.response?.data ?? e?.message ?? "Delete failed";
      showErrorToast(typeof msg === "string" ? msg : "Delete failed");
    }
  };

  const datatable = {
    columns: [
      { label: "Code", field: "code", width: 200 },
      { label: "Display Name", field: "displayName", width: 300 },
      { label: "Actions", field: "actions", sort: "disabled", width: 200 },
    ],
    rows: types.map((t) => ({
      code: <code>{t.code}</code>,
      displayName: t.displayName,
      actions: (
        <div className="d-flex">
          <button
            className="btn btn-sm btn-light-primary me-2"
            onClick={() => navigate(`/admin/report-types/edit/${t.reportTypeId}`)}
          >
            Edit + Subtypes
          </button>
          <ActionIconButton
            type="delete"
            title="Delete"
            onClick={() => handleDelete(t.reportTypeId)}
          />
        </div>
      ),
    })),
  };

  return (
    <MDBDataTableV5
      hover
      entriesOptions={[10, 25, 50]}
      entries={10}
      pagesAmount={4}
      data={datatable}
      searchTop
      searchBottom={false}
    />
  );
};

export default ReportTypesTable;
