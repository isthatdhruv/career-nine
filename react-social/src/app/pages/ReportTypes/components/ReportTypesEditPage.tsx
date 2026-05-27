import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DeleteReportSubtype,
  ReadReportSubtypes,
  ReadReportTypeById,
  ReportSubtypeDto,
  ReportTypeDto,
  UpdateReportType,
  UploadSubtypeTemplate,
} from "../API/Report_Types_APIs";
import SubtypeFormModal from "./SubtypeFormModal";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

const ReportTypesEditPage = () => {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const navigate = useNavigate();

  const [type, setType] = useState<ReportTypeDto | null>(null);
  const [subtypes, setSubtypes] = useState<ReportSubtypeDto[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingSubtype, setEditingSubtype] = useState<ReportSubtypeDto | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([ReadReportTypeById(id), ReadReportSubtypes(id)]);
      setType(t.data);
      setSubtypes(s.data);
      setDisplayName(t.data.displayName);
      setCode(t.data.code);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(id)) fetchAll();
  }, [id]);

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await UpdateReportType(id, { code: code.trim(), displayName: displayName.trim() });
      showSuccessToast("Report type updated.");
      await fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data ?? e?.message ?? "Update failed";
      showErrorToast(typeof msg === "string" ? msg : "Update failed");
    } finally {
      setSavingMeta(false);
    }
  };

  const deleteSubtype = async (sid: number) => {
    if (!window.confirm("Delete this subtype?")) return;
    try {
      await DeleteReportSubtype(sid);
      showSuccessToast("Subtype deleted.");
      await fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data ?? e?.message ?? "Delete failed";
      showErrorToast(typeof msg === "string" ? msg : "Delete failed");
    }
  };

  const uploadOnly = async (sid: number, file: File) => {
    try {
      await UploadSubtypeTemplate(sid, file);
      showSuccessToast("Template uploaded.");
      await fetchAll();
    } catch (e: any) {
      showErrorToast(e?.message ?? "Upload failed");
    }
  };

  if (loading) return <div className="p-5">Loading…</div>;
  if (!type) return <div className="p-5">Report type not found.</div>;

  return (
    <div className="container py-5">
      <div className="card shadow-sm mb-4">
        <div className="card-header">
          <h1 className="mb-0">Edit Report Type</h1>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label fw-bold">Code</label>
            <input
              type="text"
              className="form-control"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-bold">Display Name</label>
            <input
              type="text"
              className="form-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <button className="btn btn-light me-2" onClick={() => navigate("/admin/report-types")}>
              Back
            </button>
            <button className="btn btn-primary" onClick={saveMeta} disabled={savingMeta}>
              {savingMeta ? "Saving…" : "Save Type"}
            </button>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header d-flex align-items-center">
          <h3 className="mb-0 flex-grow-1">Subtypes</h3>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              setEditingSubtype(null);
              setShowModal(true);
            }}
          >
            + Add Subtype
          </button>
        </div>
        <div className="card-body p-0">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>Code</th>
                <th>Display Name</th>
                <th>Render Folder</th>
                <th>Template</th>
                <th>Last Uploaded</th>
                <th style={{ minWidth: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subtypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No subtypes yet — click "+ Add Subtype" above.
                  </td>
                </tr>
              )}
              {subtypes.map((s) => (
                <tr key={s.reportSubtypeId}>
                  <td><code>{s.code}</code></td>
                  <td>{s.displayName}</td>
                  <td><code>{s.spacesRenderFolder}</code></td>
                  <td>
                    {s.templateSpacesUrl ? (
                      <a href={s.templateSpacesUrl} target="_blank" rel="noreferrer">view</a>
                    ) : (
                      <span className="text-danger">not uploaded</span>
                    )}
                  </td>
                  <td>
                    {s.templateUploadedAt
                      ? new Date(s.templateUploadedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <label className="btn btn-sm btn-light-primary me-2 mb-0">
                      Upload Template
                      <input
                        type="file"
                        accept="text/html"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadOnly(s.reportSubtypeId, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="btn btn-sm btn-light-info me-2"
                      onClick={() => {
                        setEditingSubtype(s);
                        setShowModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-light-danger"
                      onClick={() => deleteSubtype(s.reportSubtypeId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SubtypeFormModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchAll}
        typeCode={type.code}
        existing={editingSubtype}
      />
    </div>
  );
};

export default ReportTypesEditPage;
