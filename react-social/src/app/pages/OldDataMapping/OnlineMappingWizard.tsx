import { useState } from "react";
import { fetchFirebaseSchoolData } from "./API/OldDataMapping_APIs";
import GradeMappingStep from "./steps/GradeMappingStep";
import SchoolMappingStep from "./steps/SchoolMappingStep";
import SectionMappingStep from "./steps/SectionMappingStep";
import SessionMappingStep from "./steps/SessionMappingStep";

// ─── Types ───────────────────────────────────────────────────────────────────
interface FirebaseSection { id: string; name: string; }
interface FirebaseGrade { id: string; name: string; sections: FirebaseSection[]; }
interface FirebaseSession { id: string; year: string; grades: FirebaseGrade[]; }
interface FirebaseSchool { id: string; name: string; sessions: FirebaseSession[]; }

type WizardStep = "SCHOOL" | "SESSION" | "GRADE" | "SECTION" | "DONE";

interface MappedNode {
  mappingId: number;
  newEntityId: number;
  newEntityName: string;
  existingChildren?: any[];
}

interface Props { onBack: () => void; }

const OnlineMappingWizard = ({ onBack }: Props) => {
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fetchError, setFetchError] = useState("");
  const [rawUserCount, setRawUserCount] = useState<number | null>(null);
  const [schools, setSchools] = useState<FirebaseSchool[]>([]);

  // Navigation state
  const [step, setStep] = useState<WizardStep>("SCHOOL");
  const [schoolIdx, setSchoolIdx] = useState(0);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [gradeIdx, setGradeIdx] = useState(0);
  const [sectionIdx, setSectionIdx] = useState(0);

  // Mapped results (to pass IDs down the hierarchy)
  const [schoolMapping, setSchoolMapping] = useState<MappedNode | null>(null);
  const [sessionMapping, setSessionMapping] = useState<MappedNode | null>(null);
  const [gradeMapping, setGradeMapping] = useState<MappedNode | null>(null);

  // Summary of completed mappings
  const [completedMappings, setCompletedMappings] = useState<
    { type: string; firebase: string; newName: string }[]
  >([]);

  const handleFetch = async () => {
    setFetchState("loading");
    setFetchError("");
    try {
      const res = await fetchFirebaseSchoolData();
      const data = res.data;
      setRawUserCount(data?.rawUserCount ?? 0);
      setSchools(data?.schools || []);
      setFetchState("success");
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || "";
      if (typeof msg === "string" && msg.includes("not initialized")) {
        setFetchError("Firebase is not initialized on the server. Please check the backend configuration.");
      } else {
        setFetchError("Failed to fetch data from Firebase: " + (typeof msg === "string" ? msg : "Unknown error"));
      }
      setFetchState("error");
    }
  };

  const currentSchool = schools[schoolIdx];
  const currentSession = currentSchool?.sessions?.[sessionIdx];
  const currentGrade = currentSession?.grades?.[gradeIdx];
  const currentSection = currentGrade?.sections?.[sectionIdx];

  // ── Advance logic after each mapping ──────────────────────────────────────

  // Called when user selects "Map to Existing" — still need to map sessions/grades/sections manually
  const handleSchoolMapped = (mappingId: number, newInstituteCode: number, newInstituteName: string) => {
    setSchoolMapping({ mappingId, newEntityId: newInstituteCode, newEntityName: newInstituteName });
    setCompletedMappings((prev) => [...prev, { type: "School", firebase: currentSchool.name, newName: newInstituteName }]);
    // If this school has sessions, start mapping them
    if (currentSchool.sessions?.length > 0) {
      setSessionIdx(0);
      setStep("SESSION");
    } else {
      advanceSchool();
    }
  };

  // Called when user selects "Create New" — all children auto-created, skip to next school
  const handleSchoolAutoMapped = (mappings: { type: string; firebase: string; newName: string }[]) => {
    setCompletedMappings((prev) => [...prev, ...mappings]);
    advanceSchool();
  };

  const handleSessionMapped = (mappingId: number, newSessionId: number, newSessionYear: string, existingClasses: any[]) => {
    setSessionMapping({ mappingId, newEntityId: newSessionId, newEntityName: newSessionYear, existingChildren: existingClasses });
    setCompletedMappings((prev) => [...prev, { type: "Session", firebase: currentSession.year, newName: newSessionYear }]);
    if (currentSession.grades?.length > 0) {
      setGradeIdx(0);
      setStep("GRADE");
    } else {
      advanceSession();
    }
  };

  const handleGradeMapped = (mappingId: number, newClassId: number, newClassName: string, existingSections: any[]) => {
    setGradeMapping({ mappingId, newEntityId: newClassId, newEntityName: newClassName, existingChildren: existingSections });
    setCompletedMappings((prev) => [...prev, { type: "Grade", firebase: currentGrade.name, newName: newClassName }]);
    if (currentGrade.sections?.length > 0) {
      setSectionIdx(0);
      setStep("SECTION");
    } else {
      advanceGrade();
    }
  };

  const handleSectionMapped = (mappingId: number, newSectionId: number, newSectionName: string) => {
    setCompletedMappings((prev) => [...prev, { type: "Section", firebase: currentSection.name, newName: newSectionName }]);
    advanceSection();
  };

  // ── Advance helpers ────────────────────────────────────────────────────────

  const advanceSection = () => {
    const nextSection = sectionIdx + 1;
    if (nextSection < (currentGrade?.sections?.length ?? 0)) {
      setSectionIdx(nextSection);
    } else {
      advanceGrade();
    }
  };

  const advanceGrade = () => {
    const nextGrade = gradeIdx + 1;
    if (nextGrade < (currentSession?.grades?.length ?? 0)) {
      setGradeIdx(nextGrade);
      setSectionIdx(0);
      setStep("GRADE");
    } else {
      advanceSession();
    }
  };

  const advanceSession = () => {
    const nextSession = sessionIdx + 1;
    if (nextSession < (currentSchool?.sessions?.length ?? 0)) {
      setSessionIdx(nextSession);
      setGradeIdx(0);
      setSectionIdx(0);
      setStep("SESSION");
    } else {
      advanceSchool();
    }
  };

  const advanceSchool = () => {
    const nextSchool = schoolIdx + 1;
    if (nextSchool < schools.length) {
      setSchoolIdx(nextSchool);
      setSessionIdx(0);
      setGradeIdx(0);
      setSectionIdx(0);
      setStep("SCHOOL");
    } else {
      setStep("DONE");
    }
  };

  // ── Progress bar ──────────────────────────────────────────────────────────
  const totalSchools = schools.length;
  const doneSchools = schoolIdx + (step === "DONE" ? 1 : 0);
  const progressPct = totalSchools > 0 ? Math.round((doneSchools / totalSchools) * 100) : 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="container mt-6">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">

          {/* Header */}
          <div className="d-flex align-items-center mb-6 gap-3">
            <button className="btn btn-light btn-sm" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i>Back
            </button>
            <h3 className="fw-bold text-dark mb-0">Online Firebase Mapping</h3>
          </div>

          {/* Fetch Step */}
          {fetchState !== "success" && (
            <div className="card shadow-sm mb-6">
              <div className="card-body p-8 text-center">
                <i className="bi bi-cloud-arrow-down fs-2x text-primary mb-4 d-block"></i>
                <h5 className="fw-bold mb-3">Step 1: Fetch Firebase Data</h5>
                <p className="text-muted mb-6">
                  Pull all schools, sessions, grades, and sections from your Firebase database.
                </p>
                {fetchState === "error" && (
                  <div className="alert alert-warning text-start mb-4">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {fetchError}
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleFetch}
                  disabled={fetchState === "loading"}
                >
                  {fetchState === "loading" ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Fetching...</>
                  ) : (
                    <><i className="bi bi-cloud-arrow-down me-2"></i>Fetch from Firebase</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Empty state after successful fetch */}
          {fetchState === "success" && schools.length === 0 && step !== "DONE" && (
            <div className="card shadow-sm mb-6">
              <div className="card-body p-8 text-center">
                <i className="bi bi-inbox fs-2x text-warning mb-4 d-block"></i>
                <h5 className="fw-bold mb-2">No School Data Found</h5>
                <p className="text-muted mb-2">
                  Firebase returned <strong>{rawUserCount ?? 0}</strong> user document(s), but none had a valid <code>educational.school</code> field.
                </p>
                <p className="text-muted mb-6 fs-7">
                  {rawUserCount === 0
                    ? "The \"Users\" (and \"users\") collection appears to be empty or inaccessible."
                    : "Make sure student documents contain an \"educational\" map with a non-empty \"school\" field."}
                </p>
                <button className="btn btn-light" onClick={() => setFetchState("idle")}>
                  <i className="bi bi-arrow-clockwise me-2"></i>Try Again
                </button>
              </div>
            </div>
          )}

          {/* Mapping Wizard */}
          {fetchState === "success" && schools.length > 0 && step !== "DONE" && (
            <>
              {/* Progress */}
              <div className="card mb-4">
                <div className="card-body py-4 px-6">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted fs-7">Overall Progress</span>
                    <span className="fw-semibold fs-7">{doneSchools} / {totalSchools} schools</span>
                  </div>
                  <div className="progress h-8px">
                    <div className="progress-bar bg-primary" style={{ width: `${progressPct}%` }}></div>
                  </div>

                  {/* Breadcrumb */}
                  <div className="mt-3 d-flex gap-2 flex-wrap">
                    <span className={`badge ${step === "SCHOOL" ? "badge-primary" : "badge-light-primary"}`}>
                      School {schoolIdx + 1}/{totalSchools}
                    </span>
                    {currentSchool && (
                      <span className={`badge ${step === "SESSION" ? "badge-info" : "badge-light"}`}>
                        Session {sessionIdx + 1}/{currentSchool.sessions?.length ?? 0}
                      </span>
                    )}
                    {currentSession && (
                      <span className={`badge ${step === "GRADE" ? "badge-success" : "badge-light"}`}>
                        Grade {gradeIdx + 1}/{currentSession.grades?.length ?? 0}
                      </span>
                    )}
                    {currentGrade && (
                      <span className={`badge ${step === "SECTION" ? "badge-warning" : "badge-light"}`}>
                        Section {sectionIdx + 1}/{currentGrade.sections?.length ?? 0}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Step Card */}
              <div className="card shadow-sm">
                <div className="card-body p-8">
                  {step === "SCHOOL" && currentSchool && (
                    <SchoolMappingStep
                      school={currentSchool}
                      schoolIndex={schoolIdx}
                      totalSchools={totalSchools}
                      onMapped={handleSchoolMapped}
                      onAutoMapped={handleSchoolAutoMapped}
                    />
                  )}
                  {step === "SESSION" && currentSession && schoolMapping && (
                    <SessionMappingStep
                      session={currentSession}
                      sessionIndex={sessionIdx}
                      totalSessions={currentSchool.sessions.length}
                      instituteCode={schoolMapping.newEntityId}
                      schoolMappingId={schoolMapping.mappingId}
                      onMapped={handleSessionMapped}
                    />
                  )}
                  {step === "GRADE" && currentGrade && sessionMapping && (
                    <GradeMappingStep
                      grade={currentGrade}
                      gradeIndex={gradeIdx}
                      totalGrades={currentSession!.grades.length}
                      sessionId={sessionMapping.newEntityId}
                      sessionMappingId={sessionMapping.mappingId}
                      existingClasses={sessionMapping.existingChildren ?? []}
                      onMapped={handleGradeMapped}
                    />
                  )}
                  {step === "SECTION" && currentSection && gradeMapping && (
                    <SectionMappingStep
                      section={currentSection}
                      sectionIndex={sectionIdx}
                      totalSections={currentGrade!.sections.length}
                      classId={gradeMapping.newEntityId}
                      gradeMappingId={gradeMapping.mappingId}
                      existingSections={gradeMapping.existingChildren ?? []}
                      onMapped={handleSectionMapped}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Done */}
          {step === "DONE" && (
            <div className="card shadow-sm">
              <div className="card-body p-8 text-center">
                <i className="bi bi-check-circle-fill fs-2x text-success mb-4 d-block"></i>
                <h4 className="fw-bold text-dark mb-2">Mapping Complete!</h4>
                <p className="text-muted mb-6">
                  All {totalSchools} school(s) and their sub-entities have been mapped successfully.
                </p>

                <div className="table-responsive mb-6">
                  <table className="table table-striped table-hover text-start">
                    <thead className="table-light">
                      <tr>
                        <th>Type</th>
                        <th>Firebase Name</th>
                        <th>Mapped To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedMappings.map((m, i) => (
                        <tr key={i}>
                          <td><span className="badge badge-light-primary">{m.type}</span></td>
                          <td>{m.firebase}</td>
                          <td className="text-success fw-semibold">{m.newName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button className="btn btn-primary" onClick={onBack}>
                  <i className="bi bi-arrow-left me-2"></i>Back to Mapping Home
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OnlineMappingWizard;
