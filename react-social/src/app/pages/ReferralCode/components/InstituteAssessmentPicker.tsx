import { useEffect, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { getReferralInstitutes, getInstituteAssessments } from "../API/ReferralCode_APIs";

type Institute = { instituteCode: number; instituteName: string };
type Assessment = { assessmentId: number; assessmentName: string };

export type InstituteAssessmentPickerProps = {
  instituteCode: number | "";
  onInstituteChange: (code: number | "") => void;
  selectedAssessmentIds: number[];
  onAssessmentsChange: (ids: number[]) => void;
};

/**
 * Institute dropdown + multi-select of that institute's assessments. A referral
 * code is scoped to one institute and one-or-more of its assessments.
 */
const InstituteAssessmentPicker = ({
  instituteCode,
  onInstituteChange,
  selectedAssessmentIds,
  onAssessmentsChange,
}: InstituteAssessmentPickerProps) => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  useEffect(() => {
    getReferralInstitutes()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setLoadingInstitutes(false));
  }, []);

  useEffect(() => {
    if (instituteCode === "" || instituteCode == null) {
      setAssessments([]);
      return;
    }
    setLoadingAssessments(true);
    getInstituteAssessments(Number(instituteCode))
      .then((res) => setAssessments(res.data || []))
      .catch(() => setAssessments([]))
      .finally(() => setLoadingAssessments(false));
  }, [instituteCode]);

  const toggle = (id: number) => {
    if (selectedAssessmentIds.includes(id)) {
      onAssessmentsChange(selectedAssessmentIds.filter((x) => x !== id));
    } else {
      onAssessmentsChange([...selectedAssessmentIds, id]);
    }
  };

  return (
    <div>
      <Form.Group className="mb-3">
        <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
          Institute <span style={{ color: "#ef4444" }}>*</span>
        </Form.Label>
        {loadingInstitutes ? (
          <div className="text-muted"><Spinner animation="border" size="sm" /> Loading institutes...</div>
        ) : (
          <Form.Select
            value={instituteCode === "" ? "" : String(instituteCode)}
            onChange={(e) => {
              const v = e.target.value;
              onInstituteChange(v === "" ? "" : Number(v));
              onAssessmentsChange([]); // reset assessments when institute changes
            }}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0" }}
          >
            <option value="">Select an institute</option>
            {institutes.map((i) => (
              <option key={i.instituteCode} value={i.instituteCode}>
                {i.instituteName} (#{i.instituteCode})
              </option>
            ))}
          </Form.Select>
        )}
      </Form.Group>

      <Form.Group>
        <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
          Allowed Assessments <span style={{ color: "#ef4444" }}>*</span>
        </Form.Label>
        {instituteCode === "" ? (
          <div className="text-muted" style={{ fontSize: "0.85rem" }}>Select an institute first.</div>
        ) : loadingAssessments ? (
          <div className="text-muted"><Spinner animation="border" size="sm" /> Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="text-muted" style={{ fontSize: "0.85rem" }}>
            No assessments mapped to this institute.
          </div>
        ) : (
          <div style={{
            maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "10px 14px",
          }}>
            {assessments.map((a) => (
              <label key={a.assessmentId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={selectedAssessmentIds.includes(a.assessmentId)}
                  onChange={() => toggle(a.assessmentId)}
                />
                <span style={{ fontSize: "0.9rem" }}>{a.assessmentName}</span>
              </label>
            ))}
          </div>
        )}
      </Form.Group>
    </div>
  );
};

export default InstituteAssessmentPicker;
