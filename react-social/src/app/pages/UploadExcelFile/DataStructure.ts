export interface ColumnDefinition {
  label: string;
  field: string;
  sort: string;
  width: number;
}

export interface SchoolOMRRow {
  StudentName: string;
  RollNumber: string;
  Class: string;
  Section: string;
  Mobile: string;
  Dob: string;
  answers: answers[];
  measuredQualityFinalScore: measuredQualityFinalScore[];
  [key: string]: any; // 🔹 allows dynamic Excel fields
}

export interface answers {
  questionText: string;
  optionAnsweredText: string;
  measuredQualityTypes: measuredQualityTypes[];
}

export interface measuredQualityTypes {
  qualityType: string;
  qualityScore: number;
}

export interface measuredQualityFinalScore {
  qualityType: string | null;
  qualityScore: number | null;
}

export interface SchoolOMRData {
  columns: ColumnDefinition[];
  rows: SchoolOMRRow[];
}
