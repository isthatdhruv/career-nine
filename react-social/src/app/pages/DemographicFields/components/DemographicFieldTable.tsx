import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDemographicField } from '../API/DemographicField_APIs';
import { showErrorToast } from '../../../utils/toast';
import { ActionIcon } from '../../../components/ActionIcon';

type FieldDefinition = {
  fieldId: number;
  fieldName: string;
  displayLabel: string;
  fieldSource: string;
  systemFieldKey: string | null;
  dataType: string;
  isActive: boolean;
  options: any[];
};

type Props = {
  data: FieldDefinition[];
  setPageLoading: (loading: boolean) => void;
  refreshData: () => void;
};

const DATA_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  TEXT: { bg: "#2563eb", color: "#fff" },
  SELECT_SINGLE: { bg: "#7c3aed", color: "#fff" },
  SELECT_MULTI: { bg: "#9333ea", color: "#fff" },
  NUMBER: { bg: "#d97706", color: "#fff" },
  DATE: { bg: "#059669", color: "#fff" },
};

const DemographicFieldTable = ({ data, setPageLoading, refreshData }: Props) => {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  const handleDelete = async (id: number) => {
    try {
      setPageLoading(true);
      await deleteDemographicField(id);
      refreshData();
    } catch (error) {
      console.error('Error deleting field:', error);
      showErrorToast('Failed to delete field');
    } finally {
      setPageLoading(false);
      setDeleteConfirm(null);
    }
  };

  const filtered = data.filter((f) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      f.fieldName.toLowerCase().includes(q) ||
      f.displayLabel.toLowerCase().includes(q) ||
      f.dataType.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
          <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search fields..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ paddingLeft: 32, borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
          />
        </div>
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          {filtered.length} of {data.length} fields
        </span>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table align-middle mb-0" style={{ width: "100%", tableLayout: "auto", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["#", "Field Name", "Display Label", "Source", "Data Type", "Options", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    fontWeight: 700,
                    color: "#374151",
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                    whiteSpace: "nowrap",
                    background: "#f9fafb",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((field, index) => {
              const dtStyle = DATA_TYPE_STYLES[field.dataType] || { bg: "#f3f4f6", color: "#6b7280" };
              return (
                <tr key={field.fieldId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", color: "#9ca3af" }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ color: "#111827", fontWeight: 600 }}>{field.fieldName}</span>
                    {field.systemFieldKey && (
                      <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>maps to: {field.systemFieldKey}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>
                    {field.displayLabel}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", display: "inline-block",
                      background: field.fieldSource === "SYSTEM" ? "#2563eb" : "#059669",
                      color: "#fff",
                    }}>
                      {field.fieldSource}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", display: "inline-block",
                      background: dtStyle.bg, color: dtStyle.color,
                    }}>
                      {field.dataType}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>
                    {field.options ? field.options.length : 0}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", display: "inline-block",
                      background: field.isActive ? "#059669" : "#dc2626",
                      color: "#fff",
                    }}>
                      {field.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div className="d-flex gap-1">
                      <button
                        className="btn btn-sm"
                        title="Edit"
                        onClick={() => navigate(`/demographic-fields/edit/${field.fieldId}`)}
                        style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#2563eb", border: "2px solid #2563eb", borderRadius: "6px" }}
                      >
                        <ActionIcon type="edit" size="sm" />
                      </button>
                      {deleteConfirm === field.fieldId ? (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleDelete(field.fieldId)}
                            style={{ padding: "6px 14px", borderRadius: "6px", fontWeight: 600, fontSize: "0.82rem", background: "#fff", color: "#dc2626", border: "2px solid #dc2626" }}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => setDeleteConfirm(null)}
                            style={{ padding: "6px 14px", borderRadius: "6px", fontWeight: 600, fontSize: "0.82rem", background: "#fff", color: "#6b7280", border: "2px solid #6b7280" }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-sm"
                          title="Delete"
                          onClick={() => setDeleteConfirm(field.fieldId)}
                          style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: "6px" }}
                        >
                          <ActionIcon type="delete" size="sm" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-5">
                  <i className="bi bi-inbox d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
                  <span style={{ color: "#6b7280" }}>No demographic fields found. Create one to get started.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default DemographicFieldTable;
