// ═══════════════════════════════════════════════════════════════════════════
// Navigator 360 — Type Definitions
// Based on the Navigator 360 Technical Specification v1.0
// ═══════════════════════════════════════════════════════════════════════════

// ── Raw data from backend ──

export interface IntermediaryScores {
  studentName: string;
  studentClass: string;
  riasecScores: Record<string, number>;   // R,I,A,S,E,C → raw score (9–18)
  aptitudeScores: Record<string, number>; // ability name → raw score (3–12)
  miScores: Record<string, number>;       // MI name → raw score (3–12)
  selectedSOIs: string[];                 // up to 5
  selectedValues: string[];               // up to 5
  selectedCareerAsps: string[];           // up to 5
}

// ── RIASEC ──

export type RIASECType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export const RIASEC_LABELS: Record<RIASECType, string> = {
  R: 'Realistic',
  I: 'Investigative',
  A: 'Artistic',
  S: 'Social',
  E: 'Enterprising',
  C: 'Conventional',
};

export const RIASEC_DESCRIPTIONS: Record<RIASECType, string> = {
  R: 'Practical, Hands-on, Athletic, Mechanical, Outdoorsy',
  I: 'Analytical, Curious, Precise, Independent, Research-driven',
  A: 'Creative, Expressive, Imaginative, Flexible, Original',
  S: 'Helpful, Empathetic, Cooperative, Friendly, Teaching-oriented',
  E: 'Ambitious, Persuasive, Confident, Leadership-oriented',
  C: 'Organised, Detail-oriented, Systematic, Reliable',
};

export const RIASEC_KEYS: RIASECType[] = ['R', 'I', 'A', 'S', 'E', 'C'];

// ── Abilities ──

export const ABILITY_NAMES = [
  'Speed and accuracy',
  'Computational',
  'Creativity/Artistic',
  'Language/Communication',
  'Technical',
  'Decision making & problem solving',
  'Finger dexterity',
  'Form perception',
  'Logical reasoning',
  'Motor movement',
] as const;
export type AbilityName = typeof ABILITY_NAMES[number];

export const ABILITY_SHORT: Record<string, string> = {
  'Speed and accuracy': 'Speed & Accuracy',
  'Computational': 'Computational',
  'Creativity/Artistic': 'Creativity',
  'Language/Communication': 'Language',
  'Technical': 'Technical',
  'Decision making & problem solving': 'Decision Making',
  'Finger dexterity': 'Finger Dexterity',
  'Form perception': 'Form Perception',
  'Logical reasoning': 'Logical Reasoning',
  'Motor movement': 'Motor Movement',
};

// ── Multiple Intelligences ──

export const MI_NAMES = [
  'Bodily-Kinesthetic',
  'Interpersonal',
  'Intrapersonal',
  'Linguistic',
  'Logical-Mathematical',
  'Musical',
  'Visual-Spatial',
  'Naturalistic',
] as const;
export type MIName = typeof MI_NAMES[number];

// Mapping from backend MI names to spec MI names
export const MI_DISPLAY: Record<string, string> = {
  'Bodily-Kinesthetic': 'Bodily-Kinesthetic',
  'Interpersonal': 'Interpersonal',
  'Intrapersonal': 'Intrapersonal',
  'Linguistic': 'Linguistic',
  'Logical-Mathematical': 'Logical-Mathematical',
  'Musical': 'Musical',
  'Visual-Spatial': 'Spatial-Visual',
  'Naturalistic': 'Naturalistic',
};

// ── Stanine & Level ──

export type AbsoluteLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface ScoredDimension {
  name: string;
  rawScore: number;
  normPct: number;    // 0–100, 1dp
  stanine: number;    // 1–9
  level: AbsoluteLevel;
}

// ── Potential Score Components ──

export interface PotentialScoreResult {
  personality: number;       // max 25
  intelligence: number;      // max 25
  ability: number;           // max 30
  academic: number;          // max 20
  total: number;             // max 100
  completionPct: number;
  flags: FlagCode[];
}

// ── Preference Score Components ──

export interface PreferenceScoreResult {
  p1Values: number;          // max 20
  p2Aspirations: number;     // max 20
  p3Culture: number;         // max 30
  p4Subjects: number;        // max 30
  total: number;             // max 100
}

// ── Career Definition ──

export interface CareerDefinition {
  id: string;
  name: string;
  riasec: RIASECType[];          // [Primary, Secondary, Tertiary]
  mi: string[];                  // 3 supporting MI
  abilities: string[];           // 3 supporting abilities
  values: string[];              // aligned values
  degreePaths: string[];
}

// ── Career Match ──

export interface CareerMatch {
  career: CareerDefinition;
  potentialMatch: number;        // 0–100
  valuesMatch: number;           // 0–100
  suitability: number;           // 0–100
  suitability9: number;          // 1–9
  matchedValues: string[];
  isAspiration: boolean;
}

// ── CCI ──

export type CCILevel = 'High' | 'Moderate' | 'Low';

// ── Flags ──

export type FlagCode =
  | 'ERR-01' | 'ERR-02' | 'ERR-04'
  | 'WARN-01'
  | 'BIAS-01' | 'BIAS-02' | 'BIAS-03' | 'BIAS-04'
  | 'P-01' | 'P-03' | 'P-05' | 'P-06' | 'P-07' | 'P-08' | 'P-09' | 'P-10';

export interface FlagInfo {
  code: FlagCode;
  name: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

// ── Full Report Result ──

export interface Navigator360Result {
  // Student info
  studentName: string;
  studentClass: string;
  gradeGroup: '6-8' | '9-10' | '11-12';

  // Section D/E/F scored dimensions
  riasec: ScoredDimension[];
  abilities: ScoredDimension[];
  mi: ScoredDimension[];

  // Section A/B/C selections
  careerAspirations: string[];
  values: string[];
  subjectsOfInterest: string[];

  // Composite scores
  potentialScore: PotentialScoreResult;
  preferenceScore: PreferenceScoreResult;

  // Career matching
  careerMatches: CareerMatch[];
  topCareers: CareerMatch[];     // top 3 (or top 5 for 11–12)
  cci: CCILevel;
  alignmentScore: number;

  // Flags
  flags: FlagInfo[];

  // Holland code
  hollandCode: string;           // e.g. "RIA"
}
