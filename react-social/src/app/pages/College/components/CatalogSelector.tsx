import { Dropdown, Form } from "react-bootstrap";
import { InstituteAssessment } from "../../AssessmentMapping/API/AssessmentMapping_APIs";

interface Props {
  /** All active assessments to choose from ({ id, AssessmentName|assessmentName }). */
  assessments: any[];
  /** The institute's current catalog rows. */
  catalog: InstituteAssessment[];
  /** Enable one assessment (checkbox checked). */
  onAdd: (assessmentId: number) => void;
  /** Remove one catalog row (checkbox unchecked / badge ×). */
  onRemove: (item: InstituteAssessment) => void;
  /** Disable interaction while a write is in flight. */
  busy?: boolean;
}

const nameOf = (a: any) => a?.AssessmentName || a?.assessmentName || `ID: ${a?.id}`;

/**
 * Compact catalog control: a checkbox dropdown of every assessment (checked =
 * enabled for the institute) plus badges of the currently-enabled ones. Checking
 * enables immediately; unchecking (or a badge ×) removes — no separate apply step.
 */
const CatalogSelector = ({ assessments, catalog, onAdd, onRemove, busy }: Props) => {
  const byAssessment = new Map<number, InstituteAssessment>();
  catalog.forEach((c) => byAssessment.set(Number(c.assessmentId), c));

  const catalogName = (assessmentId: number) => {
    const a = assessments.find((x: any) => Number(x.id) === Number(assessmentId));
    return a ? nameOf(a) : `ID: ${assessmentId}`;
  };

  return (
    <div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <Dropdown autoClose="outside">
          <Dropdown.Toggle variant="outline-secondary" size="sm" disabled={busy}>
            {catalog.length
              ? `${catalog.length} assessment${catalog.length === 1 ? "" : "s"} enabled`
              : "Select assessments"}
          </Dropdown.Toggle>
          {/* strategy:"fixed" lets the menu float above any overflow-clipping ancestor
              and flip when near the viewport bottom, so the last option is always
              reachable. paddingBottom adds a gap so the last row isn't flush/clipped. */}
          <Dropdown.Menu
            popperConfig={{ strategy: "fixed" }}
            style={{ maxHeight: 380, overflowY: "auto", minWidth: 320, paddingTop: 6, paddingBottom: 10 }}
          >
            {assessments.length === 0 ? (
              <Dropdown.ItemText className="text-muted small">No assessments available</Dropdown.ItemText>
            ) : (
              assessments.map((a: any) => {
                const item = byAssessment.get(Number(a.id));
                const enabled = !!item;
                return (
                  <div key={a.id} className="px-3 py-2">
                    <Form.Check
                      type="checkbox"
                      id={`catalog-opt-${a.id}`}
                      label={nameOf(a)}
                      checked={enabled}
                      disabled={busy}
                      onChange={() => (enabled && item ? onRemove(item) : onAdd(Number(a.id)))}
                    />
                  </div>
                );
              })
            )}
          </Dropdown.Menu>
        </Dropdown>
        <span className="text-muted" style={{ fontSize: "0.78rem" }}>
          Check to enable, uncheck to remove
        </span>
      </div>

      {catalog.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-3">
          {catalog.map((c) => (
            <span
              key={c.id}
              className="d-inline-flex align-items-center gap-2"
              style={{
                background: "#ecfdf5",
                border: "1.5px solid #a7f3d0",
                color: "#065f46",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              {catalogName(c.assessmentId)}
              <button
                type="button"
                aria-label="Remove"
                disabled={busy}
                onClick={() => onRemove(c)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogSelector;
