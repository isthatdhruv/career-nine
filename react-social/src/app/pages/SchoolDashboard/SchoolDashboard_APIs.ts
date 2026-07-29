import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

// ── Mirrors com.kccitm.api.service.schoolreport.SchoolDashboard ──
// A null number is the workbook's blank cell, not a zero.

export interface ClassFilter {
  label: string;
  min: number;
  max: number;
}

export interface ClassCount {
  label: string;
  studentClass: number;
  students: number;
  pctOfSchool: number;
}

export interface SummarySheet {
  studentsInView: number;
  girls: number;
  boys: number;
  careerClarityPct: number;
  avgMatchedAspirations: number;
  studentsByClass: ClassCount[];
  totalStudents: number;
  dominantPersonality: string;
  secondPersonality: string;
  dominantLearningStyle: string;
  weakestLearningStyle: string;
  strongestAbility: string;
  weakestAbility: string;
  topValue: string;
  bestFitStream: string;
  mostWantedStream: string;
}

export interface TraitRow {
  label: string;
  riasecName: string;
  avgRawScore: number;
  pctAsTopTrait: number;
  pctInTopThree: number;
  studentsTopTrait: number;
  studentsInTopThree: number;
}

export interface PersonalitySheet {
  traits: TraitRow[];
  totalTopTraitPct: number;
  highestTraitShare: number;
  lowestTraitShare: number;
  spread: number;
  traitsAbove20: number;
}

export interface IntelligenceRow {
  label: string;
  pctStrong: number;
  pctLow: number;
  avgScore: number;
  studentsStrong: number;
  studentsLow: number;
}

export interface AbilityRow {
  label: string;
  pctStrong: number;
  pctLow: number;
  gap: number;
  avgScore: number;
  studentsStrong: number;
  studentsLow: number;
}

export interface AbilitiesSheet {
  abilities: AbilityRow[];
  avgAbilities10Plus: number;
  avgAbilities8OrLess: number;
  studentsWith5PlusWeak: number;
  pctWith5PlusWeak: number;
}

export interface ValueRow {
  label: string;
  pctInTopFive: number;
  students: number;
  rank: number | null;
}

export interface StreamRow {
  label: string;
  suitedPct: number;
  aspiringPct: number;
  gap: number;
  studentsSuited: number;
  studentsAspiring: number;
}

export interface ClusterRow {
  label: string;
  suitedTop3: number;
  aspiring: number;
  gap: number;
  readinessPct: number | null;
  stream: string;
}

export interface LabeledSeries {
  label: string;
  values: number[];
}

export interface ByClassSheet {
  classes: number[];
  students: number[];
  careerClarityPct: number[];
  fiveOrMoreWeakAbilities: number[];
  personalityTopTraitPct: LabeledSeries[];
  learningStyleStrongPct: LabeledSeries[];
  abilityLowPct: LabeledSeries[];
  streamFitVsWish: LabeledSeries[];
}

export interface SchoolDashboardData {
  filter: ClassFilter;
  summary: SummarySheet;
  personality: PersonalitySheet;
  learningStyle: { intelligences: IntelligenceRow[] };
  abilities: AbilitiesSheet;
  values: { values: ValueRow[] };
  careerGap: { streams: StreamRow[]; clusters: ClusterRow[] };
  byClass: ByClassSheet;
}

export interface Participation {
  total: number;
  completed: number;
  ongoing: number;
  notStarted: number;
  completedPct: number;
}

export interface AssessmentParticipation {
  assessmentId: number;
  assessmentName: string;
  total: number;
  completed: number;
  ongoing: number;
  notStarted: number;
  completedPct: number;
  scored: number;
}

export interface SchoolDashboardView {
  instituteCode: number | null;
  instituteName: string | null;
  /** The class filter that produced `dashboard`: "All", or a class number. */
  classFilter: string;
  /** Classes with at least one scoreable student, ascending. */
  classesPresent: number[];
  participation: Participation;
  assessments: AssessmentParticipation[];
  scoredStudents: number;
  unscoredStudents: number;
  distinctStudents: number;
  /** Null until at least one student has completed an assessment. */
  dashboard: SchoolDashboardData | null;
}

/**
 * Participation counts always cover the whole institute; `classFilter` narrows
 * only the dashboard aggregates.
 */
export function getSchoolDashboard(instituteCode: number, classFilter: string = "All") {
  return axios.get<SchoolDashboardView>(
    `${API_URL}/general-assessment/school-dashboard/${instituteCode}`,
    { params: { classFilter } }
  );
}
