export interface ColumnDefinition {
  label: string;
  field: string;
  sort: string;
  width: number;
}

export interface SchoolOMRRow {
  studentName: string;
  rollNumber: string;
  class: string;
  section: string;
  mobile:string;
  Dob: string;
  totalMarks: number|null;
  obtainedMarks: number|null;
  answers: answers[];
  measuredQualityFinalScore: measuredQualityFinalScore[];
  [key: string]: any; // For dynamic columns from Excel
}

export interface answers {
  questionText : string;
    optionAnsweredText : string;
    measuredQualityTypes: measuredQualityTypes[];
}

export interface measuredQualityTypes {
    qualityType: string;
    qualityScore: number;
}

export interface measuredQualityFinalScore {
    qualityType: string|null;
    qualityScore: number|null;   
}
export interface SchoolOMRData {
  columns: ColumnDefinition[];
  rows: SchoolOMRRow[];
}

export const defaultSchoolOMRData: SchoolOMRData = {
  columns: [
    { label: 'Student Name', field: 'studentName', sort: 'asc', width: 150 },
    { label: 'Roll Number', field: 'rollNumber', sort: 'asc', width: 100 },
    { label: 'Class', field: 'class', sort: 'asc', width: 80 },
    { label: 'Section', field: 'section', sort: 'asc', width: 80 },
    { label: 'Total Marks', field: 'totalMarks', sort: 'asc', width: 100 },
    { label: 'Obtained Marks', field: 'obtainedMarks', sort: 'asc', width: 120 }
  ],
  rows: []
};

