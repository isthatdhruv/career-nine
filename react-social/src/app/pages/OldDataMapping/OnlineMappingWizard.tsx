import { useEffect, useState } from "react";
import {
  fetchFirebaseSchoolData,
  createInstitute,
  createSession,
  getAllInstitutes,
  saveMapping,
  saveBatchMappings,
  getMappingsByType,
} from "./API/OldDataMapping_APIs";
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

// ─── Helper: merge sessions/grades/sections from multiple schools ─────────
function mergeSchoolChildren(selectedSchools: FirebaseSchool[]) {
  // session year → grade name → Set<section name>
  const sessionMap = new Map<string, Map<string, Set<string>>>();
  // Track firebase IDs for mapping
  const fbSessionIds = new Map<string, string[]>();
  const fbGradeIds = new Map<string, string[]>();
  const fbSectionIds = new Map<string, string[]>();

  for (const school of selectedSchools) {
    for (const sess of school.sessions || []) {
      const sessKey = sess.year.toLowerCase();
      if (!sessionMap.has(sessKey)) sessionMap.set(sessKey, new Map());
      if (!fbSessionIds.has(sessKey)) fbSessionIds.set(sessKey, []);
      fbSessionIds.get(sessKey)!.push(sess.id);

      for (const grade of sess.grades || []) {
        const gradeKey = grade.name.toLowerCase();
        const gradeMap = sessionMap.get(sessKey)!;
        if (!gradeMap.has(gradeKey)) gradeMap.set(gradeKey, new Set());
        const fullGradeKey = `${sessKey}__${gradeKey}`;
        if (!fbGradeIds.has(fullGradeKey)) fbGradeIds.set(fullGradeKey, []);
        fbGradeIds.get(fullGradeKey)!.push(grade.id);

        for (const section of grade.sections || []) {
          const sectionKey = section.name.toLowerCase();
          gradeMap.get(gradeKey)!.add(sectionKey);
          const fullSectionKey = `${sessKey}__${gradeKey}__${sectionKey}`;
          if (!fbSectionIds.has(fullSectionKey)) fbSectionIds.set(fullSectionKey, []);
          fbSectionIds.get(fullSectionKey)!.push(section.id);
        }
      }
    }
  }

  return { sessionMap, fbSessionIds, fbGradeIds, fbSectionIds };
}

const OnlineMappingWizard = ({ onBack }: Props) => {
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fetchError, setFetchError] = useState("");
  const [rawUserCount, setRawUserCount] = useState<number | null>(null);
  const [schools, setSchools] = useState<FirebaseSchool[]>([]);
  const [showDataView, setShowDataView] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // View Data panel state
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"new" | "existing" | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkInstitutes, setBulkInstitutes] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Bulk create form
  const [bulkNewName, setBulkNewName] = useState("");
  const [bulkNewCode, setBulkNewCode] = useState("");
  const [bulkNewAddress, setBulkNewAddress] = useState("");
  const [bulkNewMaxStudents, setBulkNewMaxStudents] = useState("");
  const [bulkNewMaxContactPersons, setBulkNewMaxContactPersons] = useState("");

  // Schools already mapped (via bulk or wizard) — skip in wizard
  const [mappedSchoolIds, setMappedSchoolIds] = useState<Set<string>>(new Set());

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
      const [res, mappingsRes] = await Promise.all([
        fetchFirebaseSchoolData(),
        getMappingsByType("SCHOOL"),
      ]);
      const data = res.data;
      setRawUserCount(data?.rawUserCount ?? 0);
      setSchools(data?.schools || []);

      // Pre-populate already-mapped school IDs from DB
      const existingMappings: any[] = mappingsRes.data || [];
      const alreadyMapped = new Set<string>(mappedSchoolIds);
      existingMappings.forEach((m: any) => {
        if (m.firebaseId) alreadyMapped.add(m.firebaseId);
        if (m.firebaseName) alreadyMapped.add(m.firebaseName);
      });
      setMappedSchoolIds(alreadyMapped);

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

  // ── Unmapped schools for wizard (skip already bulk-mapped ones) ─────────
  const unmappedSchools = schools.filter((s) => !mappedSchoolIds.has(s.id));

  const currentSchool = unmappedSchools[schoolIdx];
  const currentSession = currentSchool?.sessions?.[sessionIdx];
  const currentGrade = currentSession?.grades?.[gradeIdx];
  const currentSection = currentGrade?.sections?.[sectionIdx];

  // ── Advance logic after each mapping ──────────────────────────────────────

  const handleSchoolMapped = (mappingId: number, newInstituteCode: number, newInstituteName: string) => {
    setSchoolMapping({ mappingId, newEntityId: newInstituteCode, newEntityName: newInstituteName });
    setCompletedMappings((prev) => [...prev, { type: "School", firebase: currentSchool.name, newName: newInstituteName }]);
    setMappedSchoolIds((prev) => new Set(prev).add(currentSchool.id));
    if (currentSchool.sessions?.length > 0) {
      setSessionIdx(0);
      setStep("SESSION");
    } else {
      advanceSchool();
    }
  };

  const handleSchoolAutoMapped = (mappings: { type: string; firebase: string; newName: string }[]) => {
    setCompletedMappings((prev) => [...prev, ...mappings]);
    setMappedSchoolIds((prev) => new Set(prev).add(currentSchool.id));
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
    if (nextSchool < unmappedSchools.length) {
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
  const doneSchools = mappedSchoolIds.size + (step !== "DONE" ? 0 : 0);
  const progressPct = totalSchools > 0 ? Math.round((doneSchools / totalSchools) * 100) : 0;

  // ── Data view helpers ───────────────────────────────────────────────────
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    schools.forEach((s) => {
      all.add(`school__${s.id}`);
      s.sessions?.forEach((sess) => {
        all.add(`session__${sess.id}`);
        sess.grades?.forEach((g) => {
          all.add(`grade__${g.id}`);
        });
      });
    });
    setExpandedNodes(all);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  // Counts for summary
  const totalSessions = schools.reduce((sum, s) => sum + (s.sessions?.length || 0), 0);
  const totalGrades = schools.reduce((sum, s) => sum + (s.sessions?.reduce((ss, se) => ss + (se.grades?.length || 0), 0) || 0), 0);
  const totalSections = schools.reduce((sum, s) => sum + (s.sessions?.reduce((ss, se) => ss + (se.grades?.reduce((gs, g) => gs + (g.sections?.length || 0), 0) || 0), 0) || 0), 0);

  // Filtered schools for View Data (exclude already-mapped schools)
  const filteredSchools = schools.filter((s) => {
    if (mappedSchoolIds.has(s.id)) return false;
    if (searchFilter.trim() && !s.name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // ── Checkbox helpers ────────────────────────────────────────────────────
  const toggleSchoolSelect = (id: string) => {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      filteredSchools.forEach((s) => {
        if (!mappedSchoolIds.has(s.id)) next.add(s.id);
      });
      return next;
    });
  };

  const deselectAll = () => setSelectedSchoolIds(new Set());

  const selectedSchools = schools.filter((s) => selectedSchoolIds.has(s.id));
  const selectedCount = selectedSchoolIds.size;

  // ── Bulk action handlers ────────────────────────────────────────────────

  const handleBulkActionChoice = (action: "new" | "existing") => {
    setBulkAction(action);
    setBulkError("");
    if (action === "new" && selectedSchools.length > 0) {
      setBulkNewName(selectedSchools[0].name);
    }
    if (action === "existing") {
      setBulkLoading(true);
      getAllInstitutes()
        .then((res) => setBulkInstitutes(res.data || []))
        .catch(() => setBulkError("Failed to load institutes"))
        .finally(() => setBulkLoading(false));
    }
  };

  const handleBulkCreateNew = async () => {
    if (!bulkNewName.trim()) { setBulkError("College Name is required"); return; }
    if (!bulkNewCode.trim()) { setBulkError("Institute Code is required"); return; }
    if (!bulkNewAddress.trim()) { setBulkError("Institute Address is required"); return; }
    if (!bulkNewMaxStudents.trim()) { setBulkError("Maximum Students is required"); return; }
    if (!bulkNewMaxContactPersons.trim()) { setBulkError("Maximum Contact Persons is required"); return; }

    setBulkSaving(true);
    setBulkError("");

    try {
      // 1. Create institute
      setBulkProgress("Creating institute...");
      const res = await createInstitute({
        instituteName: bulkNewName.trim(),
        instituteCode: bulkNewCode.trim(),
        instituteAddress: bulkNewAddress.trim(),
        maxStudents: bulkNewMaxStudents.trim(),
        maxContactPersons: bulkNewMaxContactPersons.trim(),
        display: 1,
      });
      const newInstitute = res.data;
      const instituteCode = newInstitute.instituteCode;

      // 2. Save school mappings for ALL selected schools
      setBulkProgress("Saving school mappings...");
      const schoolMappingIds: number[] = [];
      for (const school of selectedSchools) {
        const mappingRes = await saveMapping({
          firebaseId: school.id,
          firebaseName: school.name,
          firebaseType: "SCHOOL",
          newEntityId: instituteCode,
          newEntityName: newInstitute.instituteName,
        });
        schoolMappingIds.push(mappingRes.data.id);
      }
      const parentMappingId = schoolMappingIds[0];

      const allMappings: { type: string; firebase: string; newName: string }[] =
        selectedSchools.map((s) => ({ type: "School", firebase: s.name, newName: newInstitute.instituteName }));

      // 3. Merge and deduplicate sessions/grades/sections across all selected schools
      setBulkProgress("Creating sessions, grades & sections...");
      const { sessionMap, fbSessionIds, fbGradeIds, fbSectionIds } = mergeSchoolChildren(selectedSchools);

      if (sessionMap.size > 0) {
        const sessionPayload: any[] = [];
        Array.from(sessionMap.entries()).forEach(([sessKey, gradeMap]) => {
          const classes: any[] = [];
          Array.from(gradeMap.entries()).forEach(([gradeKey, sectionSet]) => {
            classes.push({
              className: gradeKey,
              schoolSections: Array.from(sectionSet).map((secKey) => ({ sectionName: secKey })),
            });
          });
          sessionPayload.push({
            sessionYear: sessKey,
            instituteCode: instituteCode,
            schoolClasses: classes,
          });
        });

        const sessionRes = await createSession(sessionPayload);
        const createdSessions = sessionRes.data;

        // 4. Save child mappings
        setBulkProgress("Saving all mappings...");
        const childMappings: any[] = [];
        const sessionKeys = Array.from(sessionMap.keys());

        for (let si = 0; si < sessionKeys.length; si++) {
          const sessKey = sessionKeys[si];
          const dbSession = createdSessions[si];
          if (!dbSession) continue;

          // Map all firebase session IDs that contributed to this merged session
          for (const fbId of fbSessionIds.get(sessKey) || []) {
            childMappings.push({
              firebaseId: fbId,
              firebaseName: sessKey,
              firebaseType: "SESSION",
              newEntityId: dbSession.id,
              newEntityName: dbSession.sessionYear,
              parentMappingId,
            });
          }
          allMappings.push({ type: "Session", firebase: sessKey, newName: dbSession.sessionYear });

          const gradeKeys = Array.from(sessionMap.get(sessKey)!.keys());
          const dbClasses = dbSession.schoolClasses || [];

          for (let gi = 0; gi < gradeKeys.length; gi++) {
            const gradeKey = gradeKeys[gi];
            const dbClass = dbClasses[gi];
            if (!dbClass) continue;

            const fullGradeKey = `${sessKey}__${gradeKey}`;
            for (const fbId of fbGradeIds.get(fullGradeKey) || []) {
              childMappings.push({
                firebaseId: fbId,
                firebaseName: gradeKey,
                firebaseType: "GRADE",
                newEntityId: dbClass.id,
                newEntityName: dbClass.className,
                parentMappingId,
              });
            }
            allMappings.push({ type: "Grade", firebase: gradeKey, newName: dbClass.className });

            const sectionKeys = Array.from(sessionMap.get(sessKey)!.get(gradeKey)!);
            const dbSections = dbClass.schoolSections || [];

            for (let sei = 0; sei < sectionKeys.length; sei++) {
              const secKey = sectionKeys[sei];
              const dbSection = dbSections[sei];
              if (!dbSection) continue;

              const fullSectionKey = `${sessKey}__${gradeKey}__${secKey}`;
              for (const fbId of fbSectionIds.get(fullSectionKey) || []) {
                childMappings.push({
                  firebaseId: fbId,
                  firebaseName: secKey,
                  firebaseType: "SECTION",
                  newEntityId: dbSection.id,
                  newEntityName: dbSection.sectionName,
                  parentMappingId,
                });
              }
              allMappings.push({ type: "Section", firebase: secKey, newName: dbSection.sectionName });
            }
          }
        }

        if (childMappings.length > 0) {
          await saveBatchMappings(childMappings);
        }
      }

      // 5. Mark all selected schools as mapped
      setMappedSchoolIds((prev) => {
        const next = new Set(prev);
        selectedSchools.forEach((s) => next.add(s.id));
        return next;
      });
      setCompletedMappings((prev) => [...prev, ...allMappings]);
      setSelectedSchoolIds(new Set());
      setBulkAction(null);
      setBulkNewName(""); setBulkNewCode(""); setBulkNewAddress("");
      setBulkNewMaxStudents(""); setBulkNewMaxContactPersons("");
    } catch (err: any) {
      console.error("Bulk create error:", err);
      setBulkError("Failed to create. " + (err?.response?.data?.message || err?.message || ""));
    } finally {
      setBulkSaving(false);
      setBulkProgress("");
    }
  };

  const handleBulkMapExisting = async (institute: any) => {
    setBulkSaving(true);
    setBulkError("");

    try {
      setBulkProgress("Mapping selected schools...");
      const allMappings: { type: string; firebase: string; newName: string }[] = [];

      for (const school of selectedSchools) {
        await saveMapping({
          firebaseId: school.id,
          firebaseName: school.name,
          firebaseType: "SCHOOL",
          newEntityId: institute.instituteCode,
          newEntityName: institute.instituteName,
        });
        allMappings.push({ type: "School", firebase: school.name, newName: institute.instituteName });
      }

      // Mark as mapped — sessions/grades/sections need manual mapping via wizard
      // But since we're bulk-mapping to existing, the wizard will handle children
      // Actually, for "map to existing" in bulk, we just map the school level
      // The user would need to map children separately if needed
      setMappedSchoolIds((prev) => {
        const next = new Set(prev);
        selectedSchools.forEach((s) => next.add(s.id));
        return next;
      });
      setCompletedMappings((prev) => [...prev, ...allMappings]);
      setSelectedSchoolIds(new Set());
      setBulkAction(null);
    } catch (err: any) {
      setBulkError("Failed to map. " + (err?.response?.data?.message || err?.message || ""));
    } finally {
      setBulkSaving(false);
      setBulkProgress("");
    }
  };

  // Check if all schools are done (either via bulk or wizard)
  useEffect(() => {
    if (fetchState === "success" && schools.length > 0 && unmappedSchools.length === 0 && step !== "DONE") {
      setStep("DONE");
    }
  }, [fetchState, schools, unmappedSchools, step]);

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
            {fetchState === "success" && schools.length > 0 && (
              <button
                className={`btn btn-sm ms-auto ${showDataView ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => { setShowDataView(!showDataView); setBulkAction(null); }}
              >
                <i className={`bi ${showDataView ? "bi-x-lg" : "bi-diagram-3"} me-1`}></i>
                {showDataView ? "Close" : "View Data"}
              </button>
            )}
          </div>

          {/* Data Tree View with Checkboxes + Bulk Actions */}
          {showDataView && fetchState === "success" && schools.length > 0 && (
            <div className="card shadow-sm mb-6">
              <div className="card-header py-4 px-6">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">Firebase Data Overview</h5>
                    <span className="text-muted fs-7">
                      {totalSchools} school(s), {totalSessions} session(s), {totalGrades} grade(s), {totalSections} section(s)
                      {mappedSchoolIds.size > 0 && (
                        <span className="text-success ms-2">({mappedSchoolIds.size} already mapped)</span>
                      )}
                    </span>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-light" onClick={expandAll}>Expand All</button>
                    <button className="btn btn-sm btn-light" onClick={collapseAll}>Collapse All</button>
                  </div>
                </div>

                {/* Search + Select controls */}
                <div className="d-flex gap-3 align-items-center">
                  <div className="flex-grow-1">
                    <input
                      className="form-control form-control-sm"
                      placeholder="Search schools by name..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-sm btn-outline-primary" onClick={selectAllFiltered}>
                    Select All
                  </button>
                  {selectedCount > 0 && (
                    <button className="btn btn-sm btn-outline-secondary" onClick={deselectAll}>
                      Deselect
                    </button>
                  )}
                </div>

                {/* Bulk action bar */}
                {selectedCount > 0 && !bulkAction && (
                  <div className="d-flex align-items-center gap-3 mt-3 p-3 bg-light rounded">
                    <span className="fw-semibold">
                      {selectedCount} school(s) selected
                    </span>
                    <div className="ms-auto d-flex gap-2">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleBulkActionChoice("new")}
                      >
                        <i className="bi bi-plus-circle me-1"></i>Create New Institute
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleBulkActionChoice("existing")}
                      >
                        <i className="bi bi-search me-1"></i>Map to Existing
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bulk Create New Form */}
              {bulkAction === "new" && (
                <div className="border-top border-bottom bg-light-success px-6 py-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold mb-0">
                      Create New Institute for {selectedCount} school(s)
                    </h6>
                    <button className="btn btn-sm btn-light" onClick={() => setBulkAction(null)} disabled={bulkSaving}>
                      Cancel
                    </button>
                  </div>

                  {/* Summary of merged children */}
                  {(() => {
                    const { sessionMap } = mergeSchoolChildren(selectedSchools);
                    let gradeCount = 0, sectionCount = 0;
                    sessionMap.forEach((gm) => { gradeCount += gm.size; gm.forEach((s) => { sectionCount += s.size; }); });
                    return (
                      <div className="alert alert-light-success border border-success mb-3 py-2">
                        <i className="bi bi-info-circle me-2 text-success"></i>
                        Will merge and create: <strong>{sessionMap.size}</strong> session(s),{" "}
                        <strong>{gradeCount}</strong> grade(s), <strong>{sectionCount}</strong> section(s)
                        <span className="text-muted ms-2">(duplicates across schools are merged)</span>
                      </div>
                    );
                  })()}

                  {bulkError && <div className="alert alert-danger py-2 mb-3">{bulkError}</div>}

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold fs-7">College Name <span className="text-danger">*</span></label>
                      <input className="form-control form-control-sm" value={bulkNewName} onChange={(e) => setBulkNewName(e.target.value)} placeholder="Enter College Name" disabled={bulkSaving} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold fs-7">Institute Code <span className="text-danger">*</span></label>
                      <input className="form-control form-control-sm" value={bulkNewCode} onChange={(e) => setBulkNewCode(e.target.value)} placeholder="Enter Institute Code" disabled={bulkSaving} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">Institute Address <span className="text-danger">*</span></label>
                      <input className="form-control form-control-sm" value={bulkNewAddress} onChange={(e) => setBulkNewAddress(e.target.value)} placeholder="Enter Institute Address" disabled={bulkSaving} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold fs-7">Max Students <span className="text-danger">*</span></label>
                      <input className="form-control form-control-sm" value={bulkNewMaxStudents} onChange={(e) => setBulkNewMaxStudents(e.target.value)} placeholder="Enter Max Students" disabled={bulkSaving} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold fs-7">Max Contact Persons <span className="text-danger">*</span></label>
                      <input className="form-control form-control-sm" value={bulkNewMaxContactPersons} onChange={(e) => setBulkNewMaxContactPersons(e.target.value)} placeholder="Enter Max Contact Persons" disabled={bulkSaving} />
                    </div>
                  </div>

                  {bulkProgress && (
                    <div className="alert alert-info py-2 mt-3 mb-0">
                      <span className="spinner-border spinner-border-sm me-2" />{bulkProgress}
                    </div>
                  )}

                  <div className="mt-3">
                    <button className="btn btn-success" onClick={handleBulkCreateNew} disabled={bulkSaving}>
                      {bulkSaving ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                      Create & Map All ({selectedCount} schools)
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk Map to Existing */}
              {bulkAction === "existing" && (
                <div className="border-top border-bottom bg-light-primary px-6 py-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold mb-0">
                      Map {selectedCount} school(s) to existing institute
                    </h6>
                    <button className="btn btn-sm btn-light" onClick={() => setBulkAction(null)} disabled={bulkSaving}>
                      Cancel
                    </button>
                  </div>

                  {bulkError && <div className="alert alert-danger py-2 mb-3">{bulkError}</div>}

                  {bulkProgress && (
                    <div className="alert alert-info py-2 mb-3">
                      <span className="spinner-border spinner-border-sm me-2" />{bulkProgress}
                    </div>
                  )}

                  {bulkLoading ? (
                    <div className="text-center py-3">
                      <span className="spinner-border spinner-border-sm me-2" />Loading institutes...
                    </div>
                  ) : (
                    <div style={{ maxHeight: 250, overflowY: "auto" }}>
                      {bulkInstitutes.map((inst: any) => (
                        <div
                          key={inst.instituteCode}
                          className="d-flex align-items-center justify-content-between p-3 border rounded mb-2"
                          style={{ cursor: bulkSaving ? "default" : "pointer" }}
                          onClick={() => !bulkSaving && handleBulkMapExisting(inst)}
                        >
                          <span className="fw-semibold">{inst.instituteName}</span>
                          <button className="btn btn-sm btn-primary" disabled={bulkSaving}>
                            {bulkSaving ? <span className="spinner-border spinner-border-sm" /> : "Select"}
                          </button>
                        </div>
                      ))}
                      {bulkInstitutes.length === 0 && (
                        <p className="text-muted text-center py-3">No institutes found</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tree View */}
              <div className="card-body p-0" style={{ maxHeight: 500, overflowY: "auto" }}>
                {filteredSchools.map((school) => {
                  const schoolKey = `school__${school.id}`;
                  const schoolOpen = expandedNodes.has(schoolKey);
                  const isSelected = selectedSchoolIds.has(school.id);
                  const isMapped = mappedSchoolIds.has(school.id);
                  return (
                    <div key={school.id}>
                      {/* School row */}
                      <div
                        className={`d-flex align-items-center px-6 py-3 border-bottom ${isMapped ? "bg-light-success" : "bg-light-primary"}`}
                        style={{ cursor: "pointer" }}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="form-check-input me-3"
                          checked={isSelected}
                          disabled={isMapped}
                          onChange={(e) => { e.stopPropagation(); toggleSchoolSelect(school.id); }}
                        />
                        <div
                          className="d-flex align-items-center flex-grow-1"
                          onClick={() => toggleNode(schoolKey)}
                        >
                          <i className={`bi ${schoolOpen ? "bi-chevron-down" : "bi-chevron-right"} me-2 text-primary`}></i>
                          <i className={`bi ${isMapped ? "bi-check-circle-fill text-success" : "bi-building text-primary"} me-2`}></i>
                          <span className={`fw-bold ${isMapped ? "text-success" : ""}`}>
                            {school.name}
                            {isMapped && <span className="badge badge-light-success ms-2 fs-8">Mapped</span>}
                          </span>
                          <span className="badge badge-light-primary ms-auto">
                            {school.sessions?.length || 0} session(s)
                          </span>
                        </div>
                      </div>

                      {schoolOpen && school.sessions?.map((sess) => {
                        const sessKey = `session__${sess.id}`;
                        const sessOpen = expandedNodes.has(sessKey);
                        return (
                          <div key={sess.id}>
                            <div
                              className="d-flex align-items-center px-6 py-2 border-bottom"
                              style={{ cursor: "pointer", paddingLeft: 56 }}
                              onClick={() => toggleNode(sessKey)}
                            >
                              <i className={`bi ${sessOpen ? "bi-chevron-down" : "bi-chevron-right"} me-2 text-info`}></i>
                              <i className="bi bi-calendar3 me-2 text-info"></i>
                              <span className="fw-semibold">{sess.year}</span>
                              <span className="badge badge-light-info ms-auto">
                                {sess.grades?.length || 0} grade(s)
                              </span>
                            </div>

                            {sessOpen && sess.grades?.map((grade) => {
                              const gradeKey = `grade__${grade.id}`;
                              const gradeOpen = expandedNodes.has(gradeKey);
                              return (
                                <div key={grade.id}>
                                  <div
                                    className="d-flex align-items-center px-6 py-2 border-bottom"
                                    style={{ cursor: "pointer", paddingLeft: 80 }}
                                    onClick={() => toggleNode(gradeKey)}
                                  >
                                    <i className={`bi ${gradeOpen ? "bi-chevron-down" : "bi-chevron-right"} me-2 text-success`}></i>
                                    <i className="bi bi-mortarboard me-2 text-success"></i>
                                    <span className="fw-semibold">Grade {grade.name}</span>
                                    <span className="badge badge-light-success ms-auto">
                                      {grade.sections?.length || 0} section(s)
                                    </span>
                                  </div>

                                  {gradeOpen && grade.sections?.map((section) => (
                                    <div
                                      key={section.id}
                                      className="d-flex align-items-center px-6 py-2 border-bottom"
                                      style={{ paddingLeft: 104 }}
                                    >
                                      <i className="bi bi-dot me-1 text-warning"></i>
                                      <i className="bi bi-people me-2 text-warning"></i>
                                      <span>Section {section.name}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {filteredSchools.length === 0 && (
                  <div className="text-center py-4 text-muted">No schools match "{searchFilter}"</div>
                )}
              </div>
            </div>
          )}

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
          {fetchState === "success" && unmappedSchools.length > 0 && step !== "DONE" && (
            <>
              {/* Progress */}
              <div className="card mb-4">
                <div className="card-body py-4 px-6">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted fs-7">Overall Progress</span>
                    <span className="fw-semibold fs-7">{mappedSchoolIds.size} / {totalSchools} schools</span>
                  </div>
                  <div className="progress h-8px">
                    <div className="progress-bar bg-primary" style={{ width: `${progressPct}%` }}></div>
                  </div>

                  {/* Breadcrumb */}
                  <div className="mt-3 d-flex gap-2 flex-wrap">
                    <span className={`badge ${step === "SCHOOL" ? "badge-primary" : "badge-light-primary"}`}>
                      School {schoolIdx + 1}/{unmappedSchools.length}
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
                      totalSchools={unmappedSchools.length}
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
