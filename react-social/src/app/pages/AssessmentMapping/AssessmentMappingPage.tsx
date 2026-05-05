import { useEffect, useMemo, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { ReadCollegeList } from "../College/API/College_APIs";
import SchoolAssessmentMappingPanel from "../College/components/SchoolAssessmentMappingPanel";
import AssessmentMappingPanel from "../College/components/AssessmentMappingPanel";

type Level = "SCHOOL" | "DETAIL";

interface Institute {
  instituteCode: number;
  instituteName: string;
}

const AssessmentMappingPage = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedInstituteCode, setSelectedInstituteCode] = useState<string>("");
  const [level, setLevel] = useState<Level>("SCHOOL");

  useEffect(() => {
    setLoadingInstitutes(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setLoadingInstitutes(false));
  }, []);

  const selectedInstitute = useMemo(
    () => institutes.find((i) => String(i.instituteCode) === selectedInstituteCode) || null,
    [institutes, selectedInstituteCode]
  );

  const filteredInstitutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return institutes;
    return institutes.filter((i) => i.instituteName?.toLowerCase().includes(q));
  }, [institutes, search]);

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: "1.5rem", color: "#1e293b" }}>
          Assessment Mapping
        </h2>
        <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
          Manage school-level mappings (class → assessment + registration link) and class/section/session-level assessment mappings (with free &amp; paid links).
        </div>
      </div>

      {/* Institute picker */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: "20px 24px",
        border: "1px solid #e2e8f0", marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, alignItems: "end" }}>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
              Search Institute
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Type to filter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
              Institute
            </Form.Label>
            <Form.Select
              value={selectedInstituteCode}
              onChange={(e) => setSelectedInstituteCode(e.target.value)}
              disabled={loadingInstitutes}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
            >
              <option value="">
                {loadingInstitutes ? "Loading institutes…" : "-- Select an institute --"}
              </option>
              {filteredInstitutes.map((i) => (
                <option key={i.instituteCode} value={i.instituteCode}>
                  {i.instituteName}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>
      </div>

      {/* Level toggle */}
      {selectedInstitute && (
        <div style={{
          background: "#fff", borderRadius: 16, padding: "16px 24px",
          border: "1px solid #e2e8f0", marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 10 }}>
            Mapping Level
          </Form.Label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <LevelOption
              label="School Level"
              description="Class → assessment configs + single shareable registration link with cap"
              active={level === "SCHOOL"}
              onClick={() => setLevel("SCHOOL")}
              accent="#059669"
            />
            <LevelOption
              label="Class / Section / Session Level"
              description="Per-mapping free & paid registration links at any level"
              active={level === "DETAIL"}
              onClick={() => setLevel("DETAIL")}
              accent="#1e293b"
            />
          </div>
        </div>
      )}

      {/* Panel area */}
      {!selectedInstitute ? (
        <div style={{
          background: "#fff", borderRadius: 16, padding: "64px 24px",
          border: "2px dashed #e2e8f0", textAlign: "center", color: "#94a3b8",
        }}>
          {loadingInstitutes ? (
            <>
              <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
              Loading institutes…
            </>
          ) : (
            <>Select an institute to begin.</>
          )}
        </div>
      ) : (
        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #e2e8f0", overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            padding: "16px 24px",
            background: level === "SCHOOL"
              ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
              : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            color: "#fff",
          }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {level === "SCHOOL" ? "School Level Mapping" : "Class / Section / Session Level Mapping"}
            </div>
            <div style={{ fontSize: "0.8rem", opacity: 0.85, marginTop: 2 }}>
              {selectedInstitute.instituteName}
            </div>
          </div>
          {level === "SCHOOL" ? (
            <SchoolAssessmentMappingPanel
              instituteCode={selectedInstitute.instituteCode}
              instituteName={selectedInstitute.instituteName}
              active
            />
          ) : (
            <AssessmentMappingPanel
              instituteCode={selectedInstitute.instituteCode}
              instituteName={selectedInstitute.instituteName}
              active
            />
          )}
        </div>
      )}
    </div>
  );
};

interface LevelOptionProps {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  accent: string;
}

const LevelOption = ({ label, description, active, onClick, accent }: LevelOptionProps) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: "1 1 280px",
      textAlign: "left",
      padding: "14px 18px",
      borderRadius: 12,
      border: active ? `2px solid ${accent}` : "1.5px solid #e2e8f0",
      background: active ? `${accent}10` : "#fff",
      cursor: "pointer",
      transition: "all 0.15s",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `2px solid ${accent}`,
        background: active ? accent : "transparent",
        flexShrink: 0,
      }} />
      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: active ? accent : "#1e293b" }}>
        {label}
      </div>
    </div>
    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 6, marginLeft: 26 }}>
      {description}
    </div>
  </button>
);

export default AssessmentMappingPage;
