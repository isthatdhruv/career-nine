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

/**
 * Contact-field wording on the registration forms. A cohort flagged
 * `audience18Plus` (per class route / mapping row) registers the student
 * themselves, so the email and phone collected are the student's own.
 * `adult` null/undefined/false (legacy rows, minors) keeps the parent wording.
 */
export interface ContactTerms {
  /** "Parent's Email" / "Your Email" */
  emailLabel: string;
  /** "Parent's Phone" / "Your Phone" */
  phoneLabel: string;
}

const MINOR_CONTACT_TERMS: ContactTerms = {
  emailLabel: "Parent's Email",
  phoneLabel: "Parent's Phone",
};

const ADULT_CONTACT_TERMS: ContactTerms = {
  emailLabel: "Your Email",
  phoneLabel: "Your Phone",
};

export function contactTerms(adult?: boolean | null): ContactTerms {
  return adult === true ? ADULT_CONTACT_TERMS : MINOR_CONTACT_TERMS;
}
