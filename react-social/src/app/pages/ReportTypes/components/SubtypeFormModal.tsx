import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import {
  CreateReportSubtype,
  ReportSubtypeDto,
  UpdateReportSubtype,
  UploadSubtypeTemplate,
} from "../API/Report_Types_APIs";
import { showErrorToast } from "../../../utils/toast";

interface Props {
  show: boolean;
  onClose: () => void;
  onSaved: () => void;
  typeCode: string;             // parent type's code
  existing?: ReportSubtypeDto | null;  // null = create, populated = edit
}

const SubtypeFormModal = ({ show, onClose, onSaved, typeCode, existing }: Props) => {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [spacesRenderFolder, setSpacesRenderFolder] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setCode(existing.code);
      setDisplayName(existing.displayName);
      setSpacesRenderFolder(existing.spacesRenderFolder);
    } else {
      setCode("");
      setDisplayName("");
      setSpacesRenderFolder("");
    }
    setFile(null);
  }, [existing, show]);

  const isEdit = !!existing;

  const submit = async () => {
    if (!code.trim() || !displayName.trim() || !spacesRenderFolder.trim()) {
      showErrorToast("code, display name and spaces folder are required");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await UpdateReportSubtype(existing!.reportSubtypeId, {
          displayName: displayName.trim(),
          spacesRenderFolder: spacesRenderFolder.trim(),
        });
        if (file) await UploadSubtypeTemplate(existing!.reportSubtypeId, file);
      } else {
        await CreateReportSubtype(
          {
            typeCode,
            code: code.trim(),
            displayName: displayName.trim(),
            spacesRenderFolder: spacesRenderFolder.trim(),
          },
          file ?? undefined
        );
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data ?? e?.message ?? "Save failed";
      showErrorToast(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? "Edit Subtype" : "Add Subtype"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <label className="form-label fw-bold">
            Subtype Code {isEdit && <small className="text-muted">(immutable)</small>}
          </label>
          <input
            type="text"
            className="form-control"
            value={code}
            disabled={isEdit}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. insight, subject, career, default"
          />
        </div>
        <div className="mb-3">
          <label className="form-label fw-bold">Display Name</label>
          <input
            type="text"
            className="form-control"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Insight 4-Pager (6-8)"
          />
        </div>
        <div className="mb-3">
          <label className="form-label fw-bold">Spaces Render Folder</label>
          <input
            type="text"
            className="form-control"
            value={spacesRenderFolder}
            onChange={(e) => setSpacesRenderFolder(e.target.value)}
            placeholder="e.g. pager-reports/insight"
          />
          <div className="form-text">
            Where generated student reports get uploaded on DO Spaces. Will be prefixed under
            <code>{` <folder>/assessment-<id>/student_<id>_<subtype>.html`}</code>.
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label fw-bold">
            HTML Template {isEdit && <small className="text-muted">(optional — uploading replaces the current one)</small>}
          </label>
          <input
            type="file"
            accept="text/html"
            className="form-control"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {isEdit && existing?.templateSpacesUrl && (
            <div className="form-text">
              Currently:{" "}
              <a href={existing.templateSpacesUrl} target="_blank" rel="noreferrer">view current template</a>
              {existing.templateUploadedAt && (
                <> (last uploaded {new Date(existing.templateUploadedAt).toLocaleString()})</>
              )}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-light" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default SubtypeFormModal;
