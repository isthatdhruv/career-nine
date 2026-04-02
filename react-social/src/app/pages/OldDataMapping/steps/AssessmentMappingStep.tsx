import { useEffect, useState, useMemo } from "react";
import {
  getAllAssessments,
  getAssessmentsByInstitute,
  fetchFirebaseUserData,
  fetchFirebaseSchoolData,
  getAllInstitutes,
  saveMapping,
  saveBatchMappings,
  getMappingsByType,
  createSession,
  deleteMappingByName,
} from "../API/OldDataMapping_APIs";

export interface DetailedResponse {
  question: string;
  selectedOption?: string;
  selectedAnswer?: string;
  [key: string]: any;
}

export interface StudentAssignment {
  firebaseDocId: string;
  name: string;
  grade: string;
  firebaseSchool: string;
  email: string;
  dob: string;
  gender: string;
  phone: string;
  instituteCode: number;
  instituteName: string;
  assessmentId: number;
  assessmentName: string;
  abilityDetailedResponses?: DetailedResponse[];
  multipleIntelligenceResponses?: DetailedResponse[];
  personalityDetailedResponses?: DetailedResponse[];
  careerAspirations?: string[];
  subjectsOfInterest?: string[];
  values?: string[];
}

interface FirebaseUser {
  docId: string;
  personal?: {
    name?: string;
    email?: string;
    dob?: string;
    gender?: string;
    phone?: string;
    countryCode?: string;
  };
  educational?: {
    school?: string;
    studentClass?: string;
    section?: string;
  };
  abilityDetailedResponses?: DetailedResponse[];
  multipleIntelligenceResponses?: DetailedResponse[];
  personalityDetailedResponses?: DetailedResponse[];
  careerAspirations?: string[];
  subjectsOfInterest?: string[];
  values?: string[];
}

// Firebase school hierarchy types (from fetch-school-data endpoint)
interface FirebaseSection { id: string; name: string; }
interface FirebaseGrade { id: string; name: string; sections: FirebaseSection[]; }
interface FirebaseSession { id: string; year: string; grades: FirebaseGrade[]; }
interface FirebaseSchool { id: string; name: string; sessions: FirebaseSession[]; }

interface Institute {
  instituteCode: number;
  instituteName: string;
}

interface Props {
  existingAssignments: StudentAssignment[];
  onDone: (assignments: StudentAssignment[]) => void;
}

const parseGrade = (classStr?: string): string => {
  if (!classStr) return "Unknown";
  const match = classStr.match(/(\d+)/);
  return match ? match[1] : classStr;
};

// Merge sessions/grades/sections from multiple Firebase schools (dedup by name)
function mergeSchoolChildren(selectedSchools: FirebaseSchool[]) {
  const sessionMap = new Map<string, Map<string, Set<string>>>();
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

const AssessmentMappingStep = ({
  existingAssignments,
  onDone,
}: Props) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [firebaseUsers, setFirebaseUsers] = useState<FirebaseUser[]>([]);
  const [firebaseSchools, setFirebaseSchools] = useState<FirebaseSchool[]>([]);
  const [alreadyMappedSchools, setAlreadyMappedSchools] = useState<Set<string>>(new Set());
  // Firebase school name (lowercase) → system institute code
  const [schoolToInstituteMap, setSchoolToInstituteMap] = useState<Map<string, number>>(new Map());
  // Raw school mappings from DB for the mapping summary card
  const [rawSchoolMappings, setRawSchoolMappings] = useState<{ firebaseName: string; newEntityId: number; newEntityName: string }[]>([]);
  const [showMappingSummary, setShowMappingSummary] = useState(false);
  const [unmapping, setUnmapping] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchName, setSearchName] = useState("");
  const [filterGrades, setFilterGrades] = useState<Set<string>>(new Set());
  const [filterSchools, setFilterSchools] = useState<Set<string>>(new Set());
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [gradeSearch, setGradeSearch] = useState("");
  const [schoolMappedFilter, setSchoolMappedFilter] = useState<"all" | "mapped" | "unmapped">("all");
  const [filterSystemSchools, setFilterSystemSchools] = useState<Set<number>>(new Set());
  const [systemSchoolDropdownOpen, setSystemSchoolDropdownOpen] = useState(false);
  const [systemSchoolSearch, setSystemSchoolSearch] = useState("");

  // Selection
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Assignments: docId -> StudentAssignment
  const [assignments, setAssignments] = useState<Map<string, StudentAssignment>>(
    () => {
      const m = new Map<string, StudentAssignment>();
      existingAssignments.forEach((a) => m.set(a.firebaseDocId, a));
      return m;
    }
  );

  // Bulk assign form
  const [bulkSchoolId, setBulkSchoolId] = useState<string>("");
  const [bulkAssessmentId, setBulkAssessmentId] = useState<string>("");
  const [schoolAssessments, setSchoolAssessments] = useState<any[]>([]);
  const [schoolAssessmentsLoading, setSchoolAssessmentsLoading] = useState(false);
  const [bulkSchoolSearch, setBulkSchoolSearch] = useState("");
  const [bulkSchoolDropdownOpen, setBulkSchoolDropdownOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAllAssessments(),
      fetchFirebaseUserData(),
      fetchFirebaseSchoolData(),
      getAllInstitutes(),
      getMappingsByType("SCHOOL"),
    ])
      .then(([assessRes, usersRes, schoolDataRes, instRes, mappedRes]) => {
        setAssessments(assessRes.data || []);

        const users: FirebaseUser[] =
          usersRes.data?.users || usersRes.data || [];
        setFirebaseUsers(users);

        // School hierarchy data
        const schoolData = schoolDataRes.data?.schools || [];
        setFirebaseSchools(schoolData);

        const instList = instRes.data || [];
        setInstitutes(
          instList
            .map((i: any) => ({
              instituteCode: Number(i.instituteCode ?? i.id),
              instituteName: i.instituteName ?? i.name ?? "",
            }))
            .sort((a: Institute, b: Institute) => a.instituteName.localeCompare(b.instituteName))
        );

        // Track already-mapped firebase school names + which system school they map to
        const mapped = new Set<string>();
        const s2i = new Map<string, number>();
        const rawMappings: { firebaseName: string; newEntityId: number; newEntityName: string }[] = [];
        (mappedRes.data || []).forEach((m: any) => {
          const entityId = Number(m.newEntityId);
          if (m.firebaseName) {
            const key = m.firebaseName.toLowerCase().trim();
            mapped.add(key);
            if (entityId) s2i.set(key, entityId);
            rawMappings.push({
              firebaseName: m.firebaseName,
              newEntityId: entityId,
              newEntityName: m.newEntityName || "",
            });
          }
          if (m.firebaseId && m.firebaseId !== m.firebaseName) {
            const key = m.firebaseId.toLowerCase().trim();
            mapped.add(key);
            if (entityId) s2i.set(key, entityId);
          }
        });
        setAlreadyMappedSchools(mapped);
        setSchoolToInstituteMap(s2i);
        setRawSchoolMappings(rawMappings);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch assessments for the selected system school
  useEffect(() => {
    if (!bulkSchoolId) {
      setSchoolAssessments([]);
      setBulkAssessmentId("");
      return;
    }
    setSchoolAssessmentsLoading(true);
    setBulkAssessmentId("");
    getAssessmentsByInstitute(Number(bulkSchoolId))
      .then((res) => setSchoolAssessments(res.data || []))
      .catch(() => setSchoolAssessments(assessments)) // fallback to all
      .finally(() => setSchoolAssessmentsLoading(false));
  }, [bulkSchoolId]);

  // Unique grades and schools for filters
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    firebaseUsers.forEach((u) => grades.add(parseGrade(u.educational?.studentClass)));
    return Array.from(grades).sort((a, b) => {
      const na = parseInt(a);
      const nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [firebaseUsers]);

  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>();
    firebaseUsers.forEach((u) => {
      if (u.educational?.school) schools.add(u.educational.school);
    });
    return Array.from(schools).sort();
  }, [firebaseUsers]);

  // Filtered system school options for the filter dropdown
  const filteredSystemSchoolOptions = useMemo(() => {
    if (!systemSchoolSearch.trim()) return institutes;
    return institutes.filter((i) =>
      i.instituteName.toLowerCase().includes(systemSchoolSearch.toLowerCase())
    );
  }, [institutes, systemSchoolSearch]);

  // Filter helpers
  const closeAllDropdowns = () => {
    setGradeDropdownOpen(false);
    setSchoolDropdownOpen(false);
    setBulkSchoolDropdownOpen(false);
    setSystemSchoolDropdownOpen(false);
  };

  const toggleSystemSchoolFilter = (code: number) => {
    setFilterSystemSchools((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleGradeFilter = (grade: string) => {
    setFilterGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  };

  const toggleSchoolFilter = (school: string) => {
    setFilterSchools((prev) => {
      const next = new Set(prev);
      if (next.has(school)) next.delete(school);
      else next.add(school);
      return next;
    });
  };

  const selectAllFilteredSchools = () => {
    setFilterSchools((prev) => {
      const next = new Set(prev);
      filteredSchoolOptions.forEach((s) => next.add(s));
      return next;
    });
  };

  const selectAllFilteredGrades = () => {
    setFilterGrades((prev) => {
      const next = new Set(prev);
      filteredGradeOptions.forEach((g) => next.add(g));
      return next;
    });
  };

  const filteredSchoolOptions = useMemo(() => {
    let list = uniqueSchools;
    if (schoolSearch.trim()) {
      list = list.filter((s) =>
        s.toLowerCase().includes(schoolSearch.toLowerCase())
      );
    }
    if (schoolMappedFilter === "mapped") {
      list = list.filter((s) => alreadyMappedSchools.has(s.toLowerCase()));
    } else if (schoolMappedFilter === "unmapped") {
      list = list.filter((s) => !alreadyMappedSchools.has(s.toLowerCase()));
    }
    return list;
  }, [uniqueSchools, schoolSearch, schoolMappedFilter, alreadyMappedSchools]);

  const filteredGradeOptions = useMemo(() => {
    if (!gradeSearch.trim()) return uniqueGrades;
    return uniqueGrades.filter((g) =>
      `grade ${g}`.toLowerCase().includes(gradeSearch.toLowerCase()) ||
      g.includes(gradeSearch)
    );
  }, [uniqueGrades, gradeSearch]);

  const filteredInstituteOptions = useMemo(() => {
    if (!bulkSchoolSearch.trim()) return institutes;
    return institutes.filter((i) =>
      i.instituteName.toLowerCase().includes(bulkSchoolSearch.toLowerCase())
    );
  }, [institutes, bulkSchoolSearch]);

  // Filtered students
  const filteredUsers = useMemo(() => {
    if (filterSystemSchools.size > 0) {
      console.log("System school filter active:", Array.from(filterSystemSchools), "schoolToInstituteMap size:", schoolToInstituteMap.size);
    }
    return firebaseUsers.filter((u) => {
      const name = (u.personal?.name || "").toLowerCase();
      const grade = parseGrade(u.educational?.studentClass);
      const school = u.educational?.school || "";

      if (searchName && !name.includes(searchName.toLowerCase())) return false;
      if (filterGrades.size > 0 && !filterGrades.has(grade)) return false;
      if (filterSchools.size > 0 && !filterSchools.has(school)) return false;

      // System school filter: show students whose firebase school is mapped to selected system school,
      // OR students already assigned to that system school in this session
      if (filterSystemSchools.size > 0) {
        const assignedInst = assignments.get(u.docId)?.instituteCode;
        const mappedInst = schoolToInstituteMap.get(school.toLowerCase().trim());
        const matchesAssigned = assignedInst !== undefined && filterSystemSchools.has(Number(assignedInst));
        const matchesMapped = mappedInst !== undefined && filterSystemSchools.has(Number(mappedInst));
        if (!matchesAssigned && !matchesMapped) return false;
      }

      return true;
    });
  }, [firebaseUsers, searchName, filterGrades, filterSchools, filterSystemSchools, schoolToInstituteMap, assignments]);

  // Selection helpers
  const toggleSelect = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => next.add(u.docId));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => next.delete(u.docId));
      return next;
    });
  };

  const allFilteredSelected = useMemo(
    () => filteredUsers.length > 0 && filteredUsers.every((u) => selectedDocIds.has(u.docId)),
    [filteredUsers, selectedDocIds]
  );

  const selectedInstitute = useMemo(() => {
    return institutes.find((i) => String(i.instituteCode) === bulkSchoolId) || null;
  }, [institutes, bulkSchoolId]);

  const canApplyBulk = bulkSchoolId && bulkAssessmentId && selectedDocIds.size > 0;

  // ── Apply bulk assignment with full hierarchy mapping ──────────────────
  const applyBulkAssignment = async () => {
    if (!canApplyBulk || !selectedInstitute) {
      console.log("canApplyBulk:", canApplyBulk, "bulkSchoolId:", bulkSchoolId, "bulkAssessmentId:", bulkAssessmentId, "selectedDocIds.size:", selectedDocIds.size, "selectedInstitute:", selectedInstitute);
      return;
    }

    const assessment = schoolAssessments.find((a: any) => String(a.id) === bulkAssessmentId)
      || assessments.find((a: any) => String(a.id) === bulkAssessmentId);
    if (!assessment) {
      console.log("Assessment not found. bulkAssessmentId:", bulkAssessmentId, "assessments:", assessments.slice(0, 3));
      setError("Assessment not found. Please reselect the assessment.");
      return;
    }

    setApplying(true);
    setError("");

    try {
      // Collect unique Firebase school names from selected students
      const firebaseSchoolNames = new Set<string>();
      selectedDocIds.forEach((docId) => {
        const user = firebaseUsers.find((u) => u.docId === docId);
        if (user?.educational?.school) {
          firebaseSchoolNames.add(user.educational.school);
        }
      });

      // Find unmapped Firebase schools that need full hierarchy creation
      const unmappedFbSchoolNames = Array.from(firebaseSchoolNames).filter(
        (s) => !alreadyMappedSchools.has(s.toLowerCase())
      );

      if (unmappedFbSchoolNames.length > 0) {
        setApplyProgress("Saving school mappings...");

        // Find matching FirebaseSchool objects (with hierarchy) by name
        const matchingFbSchools: FirebaseSchool[] = [];
        for (const fbName of unmappedFbSchoolNames) {
          const match = firebaseSchools.find(
            (fs) => fs.name.toLowerCase() === fbName.toLowerCase() || fs.id === fbName.toLowerCase()
          );
          if (match) matchingFbSchools.push(match);
        }

        // 1. Save SCHOOL mappings
        const schoolMappingIds: number[] = [];
        for (const fbSchool of matchingFbSchools) {
          const mappingRes = await saveMapping({
            firebaseId: fbSchool.id,
            firebaseName: fbSchool.name,
            firebaseType: "SCHOOL",
            newEntityId: selectedInstitute.instituteCode,
            newEntityName: selectedInstitute.instituteName,
          });
          schoolMappingIds.push(mappingRes.data.id);
        }
        // Also save mappings for schools not found in hierarchy (name-only)
        for (const fbName of unmappedFbSchoolNames) {
          const alreadySaved = matchingFbSchools.some(
            (fs) => fs.name.toLowerCase() === fbName.toLowerCase()
          );
          if (!alreadySaved) {
            await saveMapping({
              firebaseId: fbName.toLowerCase(),
              firebaseName: fbName,
              firebaseType: "SCHOOL",
              newEntityId: selectedInstitute.instituteCode,
              newEntityName: selectedInstitute.instituteName,
            });
          }
        }

        const parentMappingId = schoolMappingIds.length > 0 ? schoolMappingIds[0] : null;

        // 2. Merge and create sessions/grades/sections
        if (matchingFbSchools.length > 0) {
          setApplyProgress("Creating sessions, grades & sections...");
          const { sessionMap, fbSessionIds, fbGradeIds, fbSectionIds } =
            mergeSchoolChildren(matchingFbSchools);

          if (sessionMap.size > 0) {
            const sessionPayload: any[] = [];
            Array.from(sessionMap.entries()).forEach(([sessKey, gradeMap]) => {
              const classes: any[] = [];
              Array.from(gradeMap.entries()).forEach(([gradeKey, sectionSet]) => {
                classes.push({
                  className: gradeKey,
                  schoolSections: Array.from(sectionSet).map((secKey) => ({
                    sectionName: secKey,
                  })),
                });
              });
              sessionPayload.push({
                sessionYear: sessKey,
                instituteCode: selectedInstitute.instituteCode,
                schoolClasses: classes,
              });
            });

            const sessionRes = await createSession(sessionPayload);
            const createdSessions = sessionRes.data;

            // 3. Save child mappings (SESSION, GRADE, SECTION)
            setApplyProgress("Saving hierarchy mappings...");
            const childMappings: any[] = [];
            const sessionKeys = Array.from(sessionMap.keys());

            for (let si = 0; si < sessionKeys.length; si++) {
              const sessKey = sessionKeys[si];
              const dbSession = createdSessions[si];
              if (!dbSession) continue;

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
                }
              }
            }

            if (childMappings.length > 0) {
              await saveBatchMappings(childMappings);
            }
          }
        }

        // Update tracked sets
        setAlreadyMappedSchools((prev) => {
          const next = new Set(prev);
          unmappedFbSchoolNames.forEach((n) => next.add(n.toLowerCase()));
          return next;
        });
        setSchoolToInstituteMap((prev) => {
          const next = new Map(prev);
          unmappedFbSchoolNames.forEach((n) => next.set(n.toLowerCase(), selectedInstitute.instituteCode));
          return next;
        });
        setRawSchoolMappings((prev) => [
          ...prev,
          ...unmappedFbSchoolNames.map((n) => ({
            firebaseName: n,
            newEntityId: selectedInstitute.instituteCode,
            newEntityName: selectedInstitute.instituteName,
          })),
        ]);
      }

      // Assign students
      setApplyProgress("Assigning students...");
      const newAssignments = new Map(assignments);
      selectedDocIds.forEach((docId) => {
        const user = firebaseUsers.find((u) => u.docId === docId);
        if (!user) return;

        newAssignments.set(docId, {
          firebaseDocId: user.docId,
          name: user.personal?.name || "",
          grade: parseGrade(user.educational?.studentClass),
          firebaseSchool: user.educational?.school || "",
          email: user.personal?.email || "",
          dob: user.personal?.dob || "",
          gender: user.personal?.gender || "",
          phone: user.personal?.phone || "",
          instituteCode: selectedInstitute.instituteCode,
          instituteName: selectedInstitute.instituteName,
          assessmentId: assessment.id,
          assessmentName: assessment.AssessmentName,
          abilityDetailedResponses: user.abilityDetailedResponses,
          multipleIntelligenceResponses: user.multipleIntelligenceResponses,
          personalityDetailedResponses: user.personalityDetailedResponses,
          careerAspirations: user.careerAspirations,
          subjectsOfInterest: user.subjectsOfInterest,
          values: user.values,
        });
      });

      setAssignments(newAssignments);
      setSelectedDocIds(new Set());
    } catch (err: any) {
      console.error("Apply failed:", err);
      setError(
        "Failed to apply: " +
          (err?.response?.data?.message || err?.message || "Unknown error")
      );
    } finally {
      setApplying(false);
      setApplyProgress("");
    }
  };

  const removeAssignment = (docId: string) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      next.delete(docId);
      return next;
    });
  };

  const assignedCount = assignments.size;

  const handleNext = () => {
    if (assignedCount === 0) {
      setError("Please select and map at least one student before proceeding.");
      return;
    }
    onDone(Array.from(assignments.values()));
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <span className="spinner-border spinner-border-sm me-2" />
        Loading students, assessments, and schools...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <span className="badge badge-light-info fs-7 mb-2">Step 1</span>
        <h4 className="fw-bold text-dark mb-1">Select Students & Map to School + Assessment</h4>
        <p className="text-muted fs-7">
          Filter by Firebase schools, select students, then assign them to a system school and assessment.
          Firebase schools will be automatically mapped with their sessions, grades &amp; sections.
        </p>
      </div>

      {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

      {/* School Mapping Summary Card */}
      {rawSchoolMappings.length > 0 && (
        <div className="card border border-dashed mb-4">
          <div
            className="card-header bg-light py-3 d-flex align-items-center justify-content-between"
            style={{ cursor: "pointer" }}
            onClick={() => setShowMappingSummary(!showMappingSummary)}
          >
            <h6 className="fw-bold mb-0 fs-7">
              <i className="bi bi-diagram-3 me-2 text-primary"></i>
              School Mapping Summary
              <span className="badge badge-light-primary ms-2 fs-9">
                {(() => {
                  const grouped: Record<number, string[]> = {};
                  rawSchoolMappings.forEach((m) => {
                    if (!grouped[m.newEntityId]) grouped[m.newEntityId] = [];
                    grouped[m.newEntityId].push(m.firebaseName);
                  });
                  return Object.keys(grouped).length;
                })()} system school{Object.keys(
                  rawSchoolMappings.reduce<Record<number, boolean>>((acc, m) => { acc[m.newEntityId] = true; return acc; }, {})
                ).length !== 1 ? "s" : ""}
              </span>
            </h6>
            <i className={`bi ${showMappingSummary ? "bi-chevron-up" : "bi-chevron-down"} fs-7 text-muted`}></i>
          </div>
          {showMappingSummary && (
            <div className="card-body p-0">
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {(() => {
                  // Group firebase schools by system school
                  const grouped: Record<string, { instituteCode: number; instituteName: string; fbSchools: string[] }> = {};
                  rawSchoolMappings.forEach((m) => {
                    const key = String(m.newEntityId);
                    if (!grouped[key]) {
                      grouped[key] = {
                        instituteCode: m.newEntityId,
                        instituteName: m.newEntityName,
                        fbSchools: [],
                      };
                    }
                    if (!grouped[key].fbSchools.includes(m.firebaseName)) {
                      grouped[key].fbSchools.push(m.firebaseName);
                    }
                  });
                  return Object.values(grouped).map((group) => (
                    <div key={group.instituteCode} className="border-bottom px-4 py-3">
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-building text-primary me-2"></i>
                        <span className="fw-bold fs-7">{group.instituteName}</span>
                        <span className="badge badge-light fs-9 ms-2">#{group.instituteCode}</span>
                        <span className="badge badge-light-success fs-9 ms-2">
                          {group.fbSchools.length} firebase school{group.fbSchools.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="d-flex flex-wrap gap-2 ms-4">
                        {group.fbSchools.map((fb) => (
                          <span key={fb} className="badge badge-light fs-9 py-1 px-2 d-inline-flex align-items-center gap-1">
                            {fb}
                            <i
                              className="bi bi-x-circle text-danger"
                              style={{ cursor: "pointer", fontSize: 11 }}
                              title={`Unmap "${fb}"`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (unmapping) return;
                                setUnmapping(fb);
                                try {
                                  await deleteMappingByName(fb, "SCHOOL");
                                  // Remove from local state
                                  setRawSchoolMappings((prev) => prev.filter((m) => m.firebaseName !== fb));
                                  setAlreadyMappedSchools((prev) => {
                                    const next = new Set(prev);
                                    next.delete(fb.toLowerCase());
                                    return next;
                                  });
                                  setSchoolToInstituteMap((prev) => {
                                    const next = new Map(prev);
                                    next.delete(fb.toLowerCase());
                                    return next;
                                  });
                                } catch (err) {
                                  console.error("Unmap failed:", err);
                                  setError("Failed to unmap school: " + fb);
                                } finally {
                                  setUnmapping(null);
                                }
                              }}
                            ></i>
                            {unmapping === fb && <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }}></span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Assignment Panel */}
      <div className="card border border-primary mb-4">
        <div className="card-header bg-light-primary py-3">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-pencil-square me-2"></i>
            Assign Selected Students ({selectedDocIds.size} selected)
          </h6>
        </div>
        <div className="card-body p-4">
          <div className="row g-3">
            {/* System School dropdown with search */}
            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">System School</label>
              <div style={{ position: "relative" }}>
                <button
                  className="btn btn-sm btn-light w-100 text-start d-flex align-items-center justify-content-between"
                  onClick={() => { setBulkSchoolDropdownOpen(!bulkSchoolDropdownOpen); setGradeDropdownOpen(false); setSchoolDropdownOpen(false); }}
                  type="button"
                  disabled={applying}
                >
                  <span className="text-truncate">
                    {selectedInstitute ? selectedInstitute.instituteName : "-- Select School --"}
                  </span>
                  <i className="bi bi-chevron-down ms-2 fs-9"></i>
                </button>
                {bulkSchoolDropdownOpen && (
                  <div
                    className="border rounded bg-white shadow-sm"
                    style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 25 }}
                  >
                    <div className="p-2 border-bottom">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search schools..."
                        value={bulkSchoolSearch}
                        onChange={(e) => setBulkSchoolSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {bulkSchoolId && (
                      <div
                        className="px-3 py-2 border-bottom text-danger fw-semibold fs-8"
                        style={{ cursor: "pointer" }}
                        onClick={() => { setBulkSchoolId(""); setBulkSchoolDropdownOpen(false); setBulkSchoolSearch(""); }}
                      >
                        Clear Selection
                      </div>
                    )}
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {filteredInstituteOptions.map((inst) => (
                        <div
                          key={inst.instituteCode}
                          className={`px-3 py-2 fs-7 d-flex align-items-center justify-content-between ${
                            String(inst.instituteCode) === bulkSchoolId ? "bg-light-primary fw-semibold" : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setBulkSchoolId(String(inst.instituteCode));
                            setBulkSchoolDropdownOpen(false);
                            setBulkSchoolSearch("");
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f8fa")}
                          onMouseOut={(e) => (e.currentTarget.style.backgroundColor =
                            String(inst.instituteCode) === bulkSchoolId ? "" : "transparent"
                          )}
                        >
                          <span className="text-truncate">{inst.instituteName}</span>
                          <span className="badge badge-light fs-9">#{inst.instituteCode}</span>
                        </div>
                      ))}
                      {filteredInstituteOptions.length === 0 && (
                        <div className="text-muted text-center py-3 fs-8">No schools match</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Assessment</label>
              <select
                className="form-select form-select-sm"
                value={bulkAssessmentId}
                onChange={(e) => setBulkAssessmentId(e.target.value)}
                disabled={applying}
              >
                <option value="">{schoolAssessmentsLoading ? "Loading..." : bulkSchoolId ? "-- Select Assessment --" : "-- Select School First --"}</option>
                {schoolAssessments.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.AssessmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Show which Firebase schools will be mapped */}
          {selectedDocIds.size > 0 && bulkSchoolId && (() => {
            const fbSchools = new Set<string>();
            selectedDocIds.forEach((docId) => {
              const user = firebaseUsers.find((u) => u.docId === docId);
              if (user?.educational?.school) fbSchools.add(user.educational.school);
            });
            const schoolList = Array.from(fbSchools);
            const newMappings = schoolList.filter((s) => !alreadyMappedSchools.has(s.toLowerCase()));
            const alreadyDone = schoolList.filter((s) => alreadyMappedSchools.has(s.toLowerCase()));
            return (
              <div className="mt-3">
                {newMappings.length > 0 && (
                  <div className="alert alert-info py-2 mb-2 fs-8">
                    <i className="bi bi-building me-1"></i>
                    <strong>{newMappings.length}</strong> Firebase school{newMappings.length !== 1 ? "s" : ""} will be mapped to{" "}
                    <strong>{selectedInstitute?.instituteName}</strong> (with sessions, grades &amp; sections):{" "}
                    {newMappings.map((s, i) => (
                      <span key={s}>
                        {i > 0 && ", "}
                        <code className="fs-9">{s}</code>
                      </span>
                    ))}
                  </div>
                )}
                {alreadyDone.length > 0 && (
                  <div className="alert alert-success py-2 mb-0 fs-8">
                    <i className="bi bi-check-circle me-1"></i>
                    {alreadyDone.length} school{alreadyDone.length !== 1 ? "s" : ""} already mapped:{" "}
                    {alreadyDone.map((s, i) => (
                      <span key={s}>
                        {i > 0 && ", "}
                        <code className="fs-9">{s}</code>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {applying && (
            <div className="mt-3 d-flex align-items-center gap-2 text-muted fs-7">
              <span className="spinner-border spinner-border-sm" />
              {applyProgress}
            </div>
          )}

          <button
            className="btn btn-primary btn-sm mt-3"
            disabled={!canApplyBulk || applying}
            onClick={applyBulkAssignment}
          >
            {applying ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" />
                Applying...
              </>
            ) : (
              <>
                <i className="bi bi-check2-all me-1"></i>
                Apply to {selectedDocIds.size} Student{selectedDocIds.size !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex gap-3 mb-3 flex-wrap">
        <div style={{ minWidth: 200, flex: 1 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search by name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        {/* Multi-select Grade filter */}
        <div style={{ minWidth: 160, position: "relative" }}>
          <button
            className={`btn btn-sm w-100 text-start d-flex align-items-center justify-content-between ${
              filterGrades.size > 0 ? "btn-light-primary" : "btn-light"
            }`}
            onClick={() => { setGradeDropdownOpen(!gradeDropdownOpen); setSchoolDropdownOpen(false); setBulkSchoolDropdownOpen(false); }}
            type="button"
          >
            <span className="text-truncate">
              {filterGrades.size === 0
                ? "All Grades"
                : filterGrades.size === 1
                ? `Grade ${Array.from(filterGrades)[0]}`
                : `${filterGrades.size} Grades`}
            </span>
            <i className="bi bi-chevron-down ms-2 fs-9"></i>
          </button>
          {gradeDropdownOpen && (
            <div
              className="border rounded bg-white shadow-sm"
              style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20 }}
            >
              <div className="p-2 border-bottom">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search grades..."
                  value={gradeSearch}
                  onChange={(e) => setGradeSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="d-flex border-bottom">
                <div
                  className="px-3 py-2 text-primary fw-semibold fs-8 flex-grow-1"
                  style={{ cursor: "pointer" }}
                  onClick={selectAllFilteredGrades}
                >
                  Select All ({filteredGradeOptions.length})
                </div>
                <div
                  className="px-3 py-2 text-danger fw-semibold fs-8"
                  style={{ cursor: "pointer" }}
                  onClick={() => { setFilterGrades(new Set()); setGradeSearch(""); }}
                >
                  Clear
                </div>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {filteredGradeOptions.map((g) => (
                  <label
                    key={g}
                    className="d-flex align-items-center gap-2 px-3 py-2 fs-7"
                    style={{ cursor: "pointer" }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f8fa")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={filterGrades.has(g)}
                      onChange={() => toggleGradeFilter(g)}
                    />
                    Grade {g}
                  </label>
                ))}
                {filteredGradeOptions.length === 0 && (
                  <div className="text-muted text-center py-3 fs-8">No grades match</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Multi-select School filter */}
        <div style={{ minWidth: 220, position: "relative" }}>
          <button
            className={`btn btn-sm w-100 text-start d-flex align-items-center justify-content-between ${
              filterSchools.size > 0 ? "btn-light-primary" : "btn-light"
            }`}
            onClick={() => { setSchoolDropdownOpen(!schoolDropdownOpen); setGradeDropdownOpen(false); setBulkSchoolDropdownOpen(false); }}
            type="button"
          >
            <span className="text-truncate">
              {filterSchools.size === 0
                ? "All Schools"
                : filterSchools.size === 1
                ? Array.from(filterSchools)[0]
                : `${filterSchools.size} Schools`}
            </span>
            <i className="bi bi-chevron-down ms-2 fs-9"></i>
          </button>
          {schoolDropdownOpen && (
            <div
              className="border rounded bg-white shadow-sm"
              style={{ position: "absolute", top: "100%", left: 0, minWidth: 320, zIndex: 20 }}
            >
              <div className="p-2 border-bottom">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search schools..."
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {/* Mapped/Unmapped sub-filter */}
              <div className="d-flex border-bottom px-2 py-1 gap-1">
                {(["all", "mapped", "unmapped"] as const).map((f) => (
                  <button
                    key={f}
                    className={`btn btn-sm py-0 px-2 fs-9 ${schoolMappedFilter === f ? "btn-primary" : "btn-light"}`}
                    onClick={() => setSchoolMappedFilter(f)}
                    type="button"
                  >
                    {f === "all" ? "All" : f === "mapped" ? "Mapped" : "Unmapped"}
                  </button>
                ))}
              </div>
              <div className="d-flex border-bottom">
                <div
                  className="px-3 py-2 text-primary fw-semibold fs-8 flex-grow-1"
                  style={{ cursor: "pointer" }}
                  onClick={selectAllFilteredSchools}
                >
                  Select All ({filteredSchoolOptions.length})
                </div>
                <div
                  className="px-3 py-2 text-danger fw-semibold fs-8"
                  style={{ cursor: "pointer" }}
                  onClick={() => { setFilterSchools(new Set()); setSchoolSearch(""); setSchoolMappedFilter("all"); }}
                >
                  Clear
                </div>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {filteredSchoolOptions.map((s) => (
                  <label
                    key={s}
                    className="d-flex align-items-center gap-2 px-3 py-2 fs-7"
                    style={{ cursor: "pointer" }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f8fa")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={filterSchools.has(s)}
                      onChange={() => toggleSchoolFilter(s)}
                    />
                    <span className="text-truncate">{s}</span>
                    {alreadyMappedSchools.has(s.toLowerCase()) ? (
                      <span className="badge badge-light-success fs-9 ms-auto">mapped</span>
                    ) : (
                      <span className="badge badge-light-warning fs-9 ms-auto">unmapped</span>
                    )}
                  </label>
                ))}
                {filteredSchoolOptions.length === 0 && (
                  <div className="text-muted text-center py-3 fs-8">No schools match</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* System School filter */}
        <div style={{ minWidth: 220, position: "relative" }}>
          <button
            className={`btn btn-sm w-100 text-start d-flex align-items-center justify-content-between ${
              filterSystemSchools.size > 0 ? "btn-light-success" : "btn-light"
            }`}
            onClick={() => { setSystemSchoolDropdownOpen(!systemSchoolDropdownOpen); setGradeDropdownOpen(false); setSchoolDropdownOpen(false); setBulkSchoolDropdownOpen(false); }}
            type="button"
          >
            <span className="text-truncate">
              {filterSystemSchools.size === 0
                ? "All System Schools"
                : filterSystemSchools.size === 1
                ? institutes.find((i) => filterSystemSchools.has(i.instituteCode))?.instituteName || "1 School"
                : `${filterSystemSchools.size} System Schools`}
            </span>
            <i className="bi bi-chevron-down ms-2 fs-9"></i>
          </button>
          {systemSchoolDropdownOpen && (
            <div
              className="border rounded bg-white shadow-sm"
              style={{ position: "absolute", top: "100%", left: 0, minWidth: 300, zIndex: 20 }}
            >
              <div className="p-2 border-bottom">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search system schools..."
                  value={systemSchoolSearch}
                  onChange={(e) => setSystemSchoolSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="d-flex border-bottom">
                <div
                  className="px-3 py-2 text-primary fw-semibold fs-8 flex-grow-1"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setFilterSystemSchools((prev) => {
                      const next = new Set(prev);
                      filteredSystemSchoolOptions.forEach((i) => next.add(i.instituteCode));
                      return next;
                    });
                  }}
                >
                  Select All ({filteredSystemSchoolOptions.length})
                </div>
                <div
                  className="px-3 py-2 text-danger fw-semibold fs-8"
                  style={{ cursor: "pointer" }}
                  onClick={() => { setFilterSystemSchools(new Set()); setSystemSchoolSearch(""); }}
                >
                  Clear
                </div>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {filteredSystemSchoolOptions.map((inst) => (
                  <label
                    key={inst.instituteCode}
                    className="d-flex align-items-center gap-2 px-3 py-2 fs-7"
                    style={{ cursor: "pointer" }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f8fa")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={filterSystemSchools.has(inst.instituteCode)}
                      onChange={() => toggleSystemSchoolFilter(inst.instituteCode)}
                    />
                    <span className="text-truncate">{inst.instituteName}</span>
                    <span className="badge badge-light fs-9 ms-auto">#{inst.instituteCode}</span>
                  </label>
                ))}
                {filteredSystemSchoolOptions.length === 0 && (
                  <div className="text-muted text-center py-3 fs-8">No schools match</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Select all / status bar */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-3">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              checked={allFilteredSelected}
              onChange={() => (allFilteredSelected ? deselectAllFiltered() : selectAllFiltered())}
              id="selectAllFiltered"
            />
            <label className="form-check-label fs-7" htmlFor="selectAllFiltered">
              Select All ({filteredUsers.length})
            </label>
          </div>
          {selectedDocIds.size > 0 && (
            <span className="badge badge-light-primary fs-8">
              {selectedDocIds.size} selected
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge badge-light-success fs-8">
            {assignedCount} mapped
          </span>
          <span className="text-muted fs-8">
            / {firebaseUsers.length} total
          </span>
        </div>
      </div>

      {/* Student Table */}
      <div className="card border mb-4">
        <div className="card-body p-0">
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="table table-row-bordered table-hover mb-0">
              <thead className="bg-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr className="fw-semibold text-muted fs-7">
                  <th className="ps-4 py-3" style={{ width: 40 }}></th>
                  <th className="py-3">Name</th>
                  <th className="py-3">Grade</th>
                  <th className="py-3">Firebase School</th>
                  <th className="py-3 text-center">Status</th>
                  <th className="py-3 pe-4" style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-6">
                      No students match the current filters.
                    </td>
                  </tr>
                )}
                {filteredUsers.map((user) => {
                  const isSelected = selectedDocIds.has(user.docId);
                  const assignment = assignments.get(user.docId);
                  const grade = parseGrade(user.educational?.studentClass);

                  return (
                    <tr
                      key={user.docId}
                      className={isSelected ? "bg-light-primary" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSelect(user.docId)}
                    >
                      <td className="ps-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isSelected}
                          onChange={() => toggleSelect(user.docId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-3 align-middle">
                        <span className="fw-semibold">
                          {user.personal?.name || "Unnamed"}
                        </span>
                        {user.personal?.email && (
                          <span className="text-muted fs-8 d-block">
                            {user.personal.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3 align-middle">
                        <span className="badge badge-light fs-8">Grade {grade}</span>
                      </td>
                      <td className="py-3 align-middle">
                        <span className="fs-7">{user.educational?.school || "—"}</span>
                      </td>
                      <td className="py-3 align-middle text-center">
                        {assignment ? (
                          <div>
                            <span className="badge badge-light-success fs-8 d-block mb-1">
                              {assignment.instituteName}
                            </span>
                            <span className="text-muted fs-9 d-block">
                              {assignment.assessmentName}
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-light-warning fs-8">Unmapped</span>
                        )}
                      </td>
                      <td className="py-3 pe-4 align-middle">
                        {assignment && (
                          <button
                            className="btn btn-sm btn-icon btn-light-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAssignment(user.docId);
                            }}
                            title="Remove mapping"
                          >
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="d-flex justify-content-between align-items-center">
        <span className="text-muted fs-7">
          {assignedCount} student{assignedCount !== 1 ? "s" : ""} mapped and ready to import
        </span>
        <button
          className="btn btn-primary"
          onClick={handleNext}
          disabled={assignedCount === 0 || applying}
          title={assignedCount === 0 ? "Map at least one student before proceeding" : ""}
        >
          Next <i className="bi bi-arrow-right ms-2"></i>
        </button>
      </div>
    </div>
  );
};

export default AssessmentMappingStep;
