import React, { useState, useEffect, useMemo } from "react";
import SingleAssessmentView from "./SingleAssessmentView";
import AllAssessmentsView from "./AllAssessmentsView";
import { ReadCollegeList } from "../College/API/College_APIs";
import { getAllAssessments, Assessment } from "../StudentInformation/StudentInfo_APIs";
import { getAssessmentMappingsByInstitute } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getReportType } from "./API/UnifiedReport_APIs";

// ═══════════════════════ COMPONENT ═══════════════════════

const UnifiedReportManagementPage: React.FC = () => {
  // ── Institute state ──
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [institutesLoading, setInstitutesLoading] = useState(false);

  // ── Assessment state ──
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "all" | "">("");
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [mappedAssessmentIds, setMappedAssessmentIds] = useState<Set<number> | null>(null);

  // ── Load institutes ──
  useEffect(() => {
    setInstitutesLoading(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setInstitutesLoading(false));
  }, []);

  // ── Load all assessments ──
  useEffect(() => {
    getAllAssessments()
      .then((res) => setAllAssessments(res.data || []))
      .catch(() => setAllAssessments([]));
  }, []);

  // ── Load assessment mappings for selected institute ──
  useEffect(() => {
    if (selectedInstitute === "") { setMappedAssessmentIds(null); return; }
    setAssessmentsLoading(true);
    getAssessmentMappingsByInstitute(Number(selectedInstitute))
      .then((res) => {
        const ids = new Set<number>(
          (res.data || []).filter((m: any) => m.isActive !== false).map((m: any) => Number(m.assessmentId))
        );
        setMappedAssessmentIds(ids.size > 0 ? ids : null);
      })
      .catch(() => setMappedAssessmentIds(null))
      .finally(() => setAssessmentsLoading(false));
  }, [selectedInstitute]);

  // ── Filter assessments by institute mapping ──
  useEffect(() => {
    if (mappedAssessmentIds && mappedAssessmentIds.size > 0) {
      setAssessments(allAssessments.filter((a) => mappedAssessmentIds.has(a.id)));
    } else {
      setAssessments(allAssessments);
    }
  }, [allAssessments, mappedAssessmentIds]);

  // ── Reset assessment when institute changes ──
  useEffect(() => {
    setSelectedAssessment("");
  }, [selectedInstitute]);

  // ── Selected assessment object ──
  const selectedAssessmentObj = useMemo(() => {
    if (selectedAssessment === "" || selectedAssessment === "all") return null;
    return assessments.find((a) => a.id === Number(selectedAssessment)) || null;
  }, [assessments, selectedAssessment]);

  const selectedInstituteName = institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>
          Unified Report Management
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Generate data, create reports, and manage all assessment types from one place
        </p>
      </div>

      {/* Selection Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24,
        background: "#fff", padding: 20, borderRadius: 12,
        border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>
            School / Institute
          </label>
          {institutesLoading ? (
            <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
          ) : (
            <select className="form-select form-select-solid" value={selectedInstitute}
              onChange={(e) => setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">-- Select a school --</option>
              {institutes.map((inst) => (
                <option key={inst.instituteCode} value={inst.instituteCode}>{inst.instituteName}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>
            Assessment
          </label>
          {assessmentsLoading ? (
            <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
          ) : (
            <select className="form-select form-select-solid" value={selectedAssessment}
              disabled={selectedInstitute === ""}
              onChange={(e) => setSelectedAssessment(
                e.target.value === "" ? "" : e.target.value === "all" ? "all" : Number(e.target.value)
              )}>
              <option value="">-- Select an assessment --</option>
              <option value="all" style={{ fontWeight: 700 }}>All Assessments</option>
              {assessments.map((a) => {
                const type = getReportType(a);
                return (
                  <option key={a.id} value={a.id}>
                    {a.assessmentName} [{type.toUpperCase()}]
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* Empty state */}
      {selectedAssessment === "" && (
        <div style={{
          padding: 48, textAlign: "center", color: "#9ca3af",
          border: "2px dashed #e5e7eb", borderRadius: 12, background: "#fff",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.4 }}>&#x1F4CA;</div>
          <div>Select a school and assessment to get started</div>
        </div>
      )}

      {/* Single Assessment Mode */}
      {selectedAssessment !== "" && selectedAssessment !== "all" && selectedAssessmentObj && selectedInstitute !== "" && (
        <SingleAssessmentView
          key={`${selectedInstitute}-${selectedAssessment}`}
          instituteCode={Number(selectedInstitute)}
          instituteName={selectedInstituteName}
          assessment={selectedAssessmentObj}
        />
      )}

      {/* All Assessments Mode */}
      {selectedAssessment === "all" && selectedInstitute !== "" && (
        <AllAssessmentsView
          instituteCode={Number(selectedInstitute)}
          instituteName={selectedInstituteName}
          assessments={assessments}
        />
      )}
    </div>
  );
};

export default UnifiedReportManagementPage;
