/**
 * School/college display terminology. The backend model is identical for both
 * (Session → Class → Section rows); only the words shown to students change.
 * `isSchool` null/undefined (legacy institutes, cached payloads) defaults to
 * school wording.
 */
export interface InstituteTerms {
  /** "Class" / "Year" — a class row under a session. */
  unit: string;
  /** "Select Class" / "Select Year" */
  selectUnit: string;
  /** "Board" / "Course" */
  catalog: string;
}

const SCHOOL_TERMS: InstituteTerms = {
  unit: "Class",
  selectUnit: "Select Class",
  catalog: "Board",
};

const COLLEGE_TERMS: InstituteTerms = {
  unit: "Year",
  selectUnit: "Select Year",
  catalog: "Course",
};

export function getInstituteTerms(isSchool?: boolean | null): InstituteTerms {
  return isSchool === false ? COLLEGE_TERMS : SCHOOL_TERMS;
}
