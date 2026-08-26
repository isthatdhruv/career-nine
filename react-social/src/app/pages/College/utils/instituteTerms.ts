/**
 * School/college display terminology. The internal model is identical for both
 * (BoardName rows, SchoolSession → SchoolClasses → SchoolSections); only the
 * words shown to users change. `isSchool` null/undefined (legacy institutes)
 * defaults to school wording.
 */
export interface InstituteTerms {
  /** "Class" / "Year" — a SchoolClasses row under a session. */
  unit: string;
  unitPlural: string;
  unitLower: string;
  /** "Board" / "Course" — the institute-level BoardName catalog. */
  catalog: string;
  catalogPlural: string;
  /** Placeholder for the unit name input. */
  unitExample: string;
}

const SCHOOL_TERMS: InstituteTerms = {
  unit: "Class",
  unitPlural: "Classes",
  unitLower: "class",
  catalog: "Board",
  catalogPlural: "Boards",
  unitExample: "e.g., Class 9",
};

const COLLEGE_TERMS: InstituteTerms = {
  unit: "Year",
  unitPlural: "Years",
  unitLower: "year",
  catalog: "Course",
  catalogPlural: "Courses",
  unitExample: "e.g., 1st Year",
};

export function getInstituteTerms(isSchool?: boolean | null): InstituteTerms {
  return isSchool === false ? COLLEGE_TERMS : SCHOOL_TERMS;
}
