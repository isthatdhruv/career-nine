// ═══════════════════════════════════════════════════════════════════════════
// Navigator 360 — Computation Engine
// Implements the full Navigator 360 Technical Specification v1.0
// Sections 2–9: Data Cleaning, Normalization, Scoring, Career Matching
// ═══════════════════════════════════════════════════════════════════════════

import {
  IntermediaryScores,
  ScoredDimension,
  AbsoluteLevel,
  PotentialScoreResult,
  PreferenceScoreResult,
  CareerMatch,
  CCILevel,
  FlagCode,
  FlagInfo,
  Navigator360Result,
  RIASEC_KEYS,
  RIASEC_LABELS,
  RIASECType,
  ABILITY_SHORT,
  MI_DISPLAY,
} from './Navigator360Types';

import {
  CAREER_DEFINITIONS,
  VALUE_LABEL_TO_SPEC,
  VALUE_CONFLICTS,
  ASPIRATION_TO_CAREER,
  ASPIRATION_RIASEC,
  SUBJECT_RIASEC,
} from './Navigator360CareerData';

// ═══════════════════════ STANINE LOOKUP (Section 4.1) ═══════════════════════

function riasecStanine(raw: number): number {
  if (raw <= 10) return 1;
  if (raw === 11) return 2;
  if (raw === 12) return 3;
  if (raw === 13) return 4;
  if (raw === 14) return 5;
  if (raw === 15) return 6;
  if (raw === 16) return 7;
  if (raw === 17) return 8;
  return 9; // 18
}

function abilityMIStanine(raw: number): number {
  if (raw <= 4) return 1;
  if (raw === 5) return 2;
  if (raw === 6) return 3;
  if (raw === 7) return 4;
  if (raw === 8) return 5;
  if (raw === 9) return 6;
  if (raw === 10) return 7;
  if (raw === 11) return 8;
  return 9; // 12
}

// ═══════════════════════ ABSOLUTE LEVEL (Section 4.2) ═══════════════════════

function absoluteLevel(stanine: number): AbsoluteLevel {
  if (stanine >= 7) return 'HIGH';
  if (stanine >= 3) return 'MODERATE';
  return 'LOW';
}

// ═══════════════════════ NORMALIZATION (Section 3) ═══════════════════════

function normalizeRIASEC(raw: number): number {
  return Math.round(((raw - 9) / 9) * 1000) / 10; // 1dp
}

function normalizeAbilityMI(raw: number): number {
  return Math.round(((raw - 3) / 9) * 1000) / 10; // 1dp
}

// ═══════════════════════ SCORE DIMENSIONS ═══════════════════════

function scoreRIASEC(scores: Record<string, number>): ScoredDimension[] {
  return RIASEC_KEYS.map((key) => {
    const raw = scores[key] ?? 9;
    const normPct = normalizeRIASEC(raw);
    const stanine = riasecStanine(raw);
    return {
      name: key,
      rawScore: raw,
      normPct,
      stanine,
      level: absoluteLevel(stanine),
    };
  });
}

function scoreAbilities(scores: Record<string, number>): ScoredDimension[] {
  return Object.entries(scores).map(([name, raw]) => {
    const normPct = normalizeAbilityMI(raw);
    const stanine = abilityMIStanine(raw);
    return { name, rawScore: raw, normPct, stanine, level: absoluteLevel(stanine) };
  });
}

function scoreMI(scores: Record<string, number>): ScoredDimension[] {
  return Object.entries(scores).map(([name, raw]) => {
    const normPct = normalizeAbilityMI(raw);
    const stanine = abilityMIStanine(raw);
    return { name, rawScore: raw, normPct, stanine, level: absoluteLevel(stanine) };
  });
}

// ═══════════════════════ BIAS CHECKS (Section 2.5) ═══════════════════════

function checkBiases(
  riasec: ScoredDimension[],
  abilities: ScoredDimension[],
  mi: ScoredDimension[]
): FlagInfo[] {
  const flags: FlagInfo[] = [];

  // BIAS-01: >=83% Yes in RIASEC (high scores indicate all Yes)
  const riasecTotal = riasec.reduce((s, d) => s + d.rawScore, 0);
  const maxRiasec = riasec.length * 18;
  // If total raw >= 83% of max possible, acquiescence
  if (riasecTotal / maxRiasec >= 0.83) {
    flags.push({
      code: 'BIAS-01', name: 'Acquiescence',
      message: 'Personality answers followed an unusual positive pattern. Profile may be artificially high.',
      severity: 'warning',
    });
  }

  // BIAS-02: >=83% No in RIASEC (most scores near 9)
  const minRiasec = riasec.length * 9;
  if ((riasecTotal - minRiasec) / (maxRiasec - minRiasec) <= 0.17) {
    flags.push({
      code: 'BIAS-02', name: 'Disacquiescence',
      message: 'Personality answers followed an unusual negative pattern. All types may be suppressed.',
      severity: 'warning',
    });
  }

  // BIAS-03: >=83% lowest score in abilities
  const lowAbilities = abilities.filter((a) => a.rawScore <= 4).length;
  if (lowAbilities / abilities.length >= 0.83) {
    flags.push({
      code: 'BIAS-03', name: 'Ability Floor Bias',
      message: 'Most ability scores at floor level. May indicate disengagement or reading difficulty.',
      severity: 'warning',
    });
  }

  // BIAS-04: >=83% lowest score in MI
  const lowMI = mi.filter((m) => m.rawScore <= 4).length;
  if (lowMI / mi.length >= 0.83) {
    flags.push({
      code: 'BIAS-04', name: 'MI Floor Bias',
      message: 'Most intelligence scores at floor level. Discovery plan recommended.',
      severity: 'warning',
    });
  }

  return flags;
}

// ═══════════════════════ POTENTIAL SCORE (Section 5) ═══════════════════════

function computePotentialScore(
  riasec: ScoredDimension[],
  mi: ScoredDimension[],
  abilities: ScoredDimension[],
  academicPct: number | null
): PotentialScoreResult {
  const flags: FlagCode[] = [];

  // ── Component 1: Personality (max 25) ──
  let personality = 0;
  const hiTypes = riasec.filter((d) => d.level === 'HIGH');
  const mdTypes = riasec.filter((d) => d.level === 'MODERATE');

  if (hiTypes.length === 0) {
    personality = 3; // floor
    flags.push('P-01');
  } else {
    const gateMul = hiTypes.length === 1 ? 0.65 : 1.0;
    const qualified = [...hiTypes, ...mdTypes]
      .sort((a, b) => b.normPct - a.normPct)
      .slice(0, 3);
    const weights = [0.50, 0.30, 0.20];
    let weighted = 0;
    for (let i = 0; i < qualified.length && i < 3; i++) {
      let contribution = qualified[i].normPct * weights[i];
      if (qualified[i].level === 'MODERATE') contribution *= 0.75;
      weighted += contribution;
    }

    const allNorms = riasec.map((d) => d.normPct);
    const spread = Math.max(...allNorms) - Math.min(...allNorms);
    const clarityBonus = spread >= 60 ? 3 : spread >= 40 ? 2 : 0;
    const basePts = (weighted / 100) * (25 - clarityBonus);
    personality = Math.min(25, Math.round((basePts + clarityBonus) * gateMul));

    // P-03: flat moderate (all stanines 3–5)
    if (hiTypes.length === 0 && riasec.every((d) => d.stanine >= 3 && d.stanine <= 5)) {
      flags.push('P-03');
    }
  }

  // ── Component 2: Intelligence (max 25) ──
  let intelligence = 0;
  const hiMI = mi.filter((d) => d.level === 'HIGH');
  const mdMI = mi.filter((d) => d.level === 'MODERATE');

  if (hiMI.length === 0) {
    intelligence = 2; // floor
    flags.push('P-05');
  } else {
    const gateMul = hiMI.length === 1 ? 0.65 : 1.0;
    const qualified = [...hiMI, ...mdMI]
      .sort((a, b) => b.normPct - a.normPct)
      .slice(0, 3);
    const weights = [0.50, 0.30, 0.20];
    let weighted = 0;
    for (let i = 0; i < qualified.length && i < 3; i++) {
      let contribution = qualified[i].normPct * weights[i];
      if (qualified[i].level === 'MODERATE') contribution *= 0.75;
      weighted += contribution;
    }
    intelligence = Math.min(25, Math.round((weighted / 100) * 25 * gateMul));
  }

  // ── Component 3: Ability (max 30) ──
  let ability = 0;
  const hiAb = abilities.filter((d) => d.level === 'HIGH');
  const mdAb = abilities.filter((d) => d.level === 'MODERATE');

  if (hiAb.length === 0) {
    ability = 3; // floor
    flags.push('P-06');
  } else {
    const gateMul = hiAb.length < 3 ? 0.70 : 1.0;
    const qualified = [...hiAb, ...mdAb]
      .sort((a, b) => b.normPct - a.normPct)
      .slice(0, 5);
    const weights = [0.30, 0.25, 0.20, 0.15, 0.10];
    let weighted = 0;
    for (let i = 0; i < qualified.length && i < 5; i++) {
      let contribution = qualified[i].normPct * weights[i];
      if (qualified[i].level === 'MODERATE') contribution *= 0.75;
      weighted += contribution;
    }
    ability = Math.min(30, Math.round((weighted / 100) * 30 * gateMul));
  }

  // ── Component 4: Academic (max 20) ──
  let academic = 0;
  if (academicPct !== null) {
    academic = Math.round((academicPct / 100) * 20);
  }

  // ── Final ──
  const potRaw = personality + intelligence + ability + academic;
  const completionPct = 1.0; // assume full completion for now
  const total = Math.max(0, Math.min(100, Math.round(potRaw * completionPct * 1.05)));

  return { personality, intelligence, ability, academic, total, completionPct, flags };
}

// ═══════════════════════ PREFERENCE SCORE (Section 6) ═══════════════════════

function computePreferenceScore(
  values: string[],
  aspirations: string[],
  subjects: string[],
  topRiasec: RIASECType[],
  ccNorm: number
): PreferenceScoreResult {
  // P1: Value Intensity (max 20)
  const p1 = Math.round((Math.min(values.length, 5) / 5) * 20);

  // P2: Aspiration Clarity (max 20)
  const aspRiasecTypes = aspirations.map((a) => ASPIRATION_RIASEC[a]).filter(Boolean);
  const topType = topRiasec[0];
  const matchingCount = aspRiasecTypes.filter((t) => t === topType).length;
  const coherence = aspRiasecTypes.length > 0 ? matchingCount / aspRiasecTypes.length : 0;
  const p2 = Math.round((Math.min(aspirations.length, 4) / 4) * 20 * coherence);

  // P3: Cultural Compatibility (max 30) — use 50% default if no CC data
  const p3 = Math.round((ccNorm / 100) * 30);

  // P4: Subject–RIASEC Alignment (max 30)
  const top3Riasec = topRiasec.slice(0, 3);
  const alignedCount = subjects.filter((s) => {
    const sRiasec = SUBJECT_RIASEC[s];
    return sRiasec && top3Riasec.includes(sRiasec);
  }).length;
  const alignmentPct = subjects.length > 0 ? alignedCount / subjects.length : 0;
  const underPenalty = subjects.length < 3 ? 0.80 : 1.0;
  const p4 = Math.round(alignmentPct * underPenalty * 30);

  return {
    p1Values: p1,
    p2Aspirations: p2,
    p3Culture: p3,
    p4Subjects: p4,
    total: p1 + p2 + p3 + p4,
  };
}

// ═══════════════════════ CAREER MATCHING (Section 7) ═══════════════════════

function computePotentialMatch(
  career: typeof CAREER_DEFINITIONS[0],
  riasecLevels: Record<string, AbsoluteLevel>,
  miLevels: Record<string, AbsoluteLevel>,
  abilityLevels: Record<string, AbsoluteLevel>
): number {
  // RIASEC contribution (40 pts)
  let riasecPts = 0;
  const rWeights = [1.0, 0.6, 0.3];
  for (let i = 0; i < Math.min(career.riasec.length, 3); i++) {
    const level = riasecLevels[career.riasec[i]];
    if (level === 'HIGH') riasecPts += 13.3 * rWeights[i];
    else if (level === 'MODERATE') riasecPts += 8.0 * rWeights[i];
  }

  // MI contribution (30 pts)
  let miPts = 0;
  const mWeights = [1.0, 0.6, 0.3];
  for (let i = 0; i < Math.min(career.mi.length, 3); i++) {
    const level = miLevels[career.mi[i]];
    if (level === 'HIGH') miPts += 10.0 * mWeights[i];
    else if (level === 'MODERATE') miPts += 6.0 * mWeights[i];
  }

  // Ability contribution (30 pts)
  let abPts = 0;
  const aWeights = [1.0, 0.6, 0.3];
  for (let i = 0; i < Math.min(career.abilities.length, 3); i++) {
    const level = abilityLevels[career.abilities[i]];
    if (level === 'HIGH') abPts += 10.0 * aWeights[i];
    else if (level === 'MODERATE') abPts += 6.0 * aWeights[i];
  }

  return Math.min(100, Math.round(riasecPts + miPts + abPts));
}

function computeValuesMatch(
  career: typeof CAREER_DEFINITIONS[0],
  studentValues: string[]
): { score: number; matched: string[] } {
  const specValues = studentValues.map((v) => VALUE_LABEL_TO_SPEC[v] || v);
  const matched = specValues.filter((v) => career.values.includes(v));
  const matchScore = specValues.length > 0 ? (matched.length / specValues.length) * 100 : 0;

  let conflictPenalty = 0;
  for (const val of specValues) {
    const conflicts = VALUE_CONFLICTS[val];
    if (conflicts && conflicts.some((c) => career.name.includes(c))) {
      conflictPenalty += 15;
    }
  }

  return {
    score: Math.max(0, Math.round(matchScore - conflictPenalty)),
    matched,
  };
}

function matchCareers(
  riasec: ScoredDimension[],
  mi: ScoredDimension[],
  abilities: ScoredDimension[],
  studentValues: string[],
  aspirations: string[]
): CareerMatch[] {
  const riasecLevels: Record<string, AbsoluteLevel> = {};
  riasec.forEach((d) => { riasecLevels[d.name] = d.level; });

  const miLevels: Record<string, AbsoluteLevel> = {};
  mi.forEach((d) => { miLevels[d.name] = d.level; });

  const abilityLevels: Record<string, AbsoluteLevel> = {};
  abilities.forEach((d) => { abilityLevels[d.name] = d.level; });

  const aspirationCareerIds = new Set(
    aspirations.map((a) => ASPIRATION_TO_CAREER[a]).filter(Boolean)
  );

  return CAREER_DEFINITIONS.map((career) => {
    const potMatch = computePotentialMatch(career, riasecLevels, miLevels, abilityLevels);
    const valMatch = computeValuesMatch(career, studentValues);
    const isAspiration = aspirationCareerIds.has(career.id);
    const aspBonus = isAspiration ? 10 : 0;
    const suitability = Math.min(100, Math.round(potMatch * 0.60 + valMatch.score * 0.40 + aspBonus));
    const suitability9 = Math.round((suitability / 100) * 9);

    return {
      career,
      potentialMatch: potMatch,
      valuesMatch: valMatch.score,
      suitability,
      suitability9: Math.max(1, suitability9),
      matchedValues: valMatch.matched,
      isAspiration,
    };
  }).sort((a, b) => b.suitability - a.suitability);
}

// ═══════════════════════ CCI (Section 8) ═══════════════════════

function computeCCI(
  aspirations: string[],
  rankedCareers: CareerMatch[]
): CCILevel {
  const top3Ids = rankedCareers.slice(0, 3).map((c) => c.career.id);
  const top9Ids = rankedCareers.slice(0, 9).map((c) => c.career.id);

  const aspCareerIds = aspirations.map((a) => ASPIRATION_TO_CAREER[a]).filter(Boolean);
  const matchesTop3 = aspCareerIds.filter((id) => top3Ids.includes(id)).length;
  const matchesTop9 = aspCareerIds.filter((id) => top9Ids.includes(id)).length;

  if (matchesTop3 >= 2) return 'High';
  if (matchesTop3 === 1 || matchesTop9 >= 1) return 'Moderate';
  return 'Low';
}

// ═══════════════════════ ALIGNMENT (Section 9) ═══════════════════════

function computeAlignment(
  riasec: ScoredDimension[],
  mi: ScoredDimension[],
  abilities: ScoredDimension[],
  topCareers: CareerMatch[]
): number {
  const top3Riasec = [...riasec].sort((a, b) => b.normPct - a.normPct).slice(0, 3).map((d) => d.name);
  const top3MI = [...mi].sort((a, b) => b.normPct - a.normPct).slice(0, 3).map((d) => d.name);
  const top3Ab = [...abilities].sort((a, b) => b.normPct - a.normPct).slice(0, 3).map((d) => d.name);

  const dataPoints = [...top3Riasec, ...top3MI, ...top3Ab, 'academic']; // 10 points

  const careerMatchRates: number[] = [];
  for (const cm of topCareers.slice(0, 3)) {
    const careerDims = [
      ...cm.career.riasec,
      ...cm.career.mi,
      ...cm.career.abilities,
    ];
    const matching = dataPoints.filter((dp) => dp !== 'academic' && careerDims.includes(dp)).length;
    careerMatchRates.push(matching / 10);
  }

  const baseAlignment = careerMatchRates.length > 0
    ? (careerMatchRates.reduce((a, b) => a + b, 0) / careerMatchRates.length) * 100
    : 0;

  const valBonus = topCareers.slice(0, 3).reduce((s, c) => s + c.valuesMatch, 0) / 3 * 0.15;

  return Math.min(99, Math.round(baseAlignment + valBonus));
}

// ═══════════════════════ PSYCHOMETRIC FLAGS (Section 10–12) ═══════════════════════

function collectFlags(
  riasec: ScoredDimension[],
  mi: ScoredDimension[],
  abilities: ScoredDimension[],
  aspirations: string[],
  values: string[],
  cci: CCILevel,
  potFlags: FlagCode[],
  gradeGroup: string
): FlagInfo[] {
  const flags: FlagInfo[] = [];

  // Include bias checks
  flags.push(...checkBiases(riasec, abilities, mi));

  // P-01: Undifferentiated personality
  if (potFlags.includes('P-01')) {
    flags.push({
      code: 'P-01', name: 'Undifferentiated Personality',
      message: 'All RIASEC types are Low. Active exploration phase — counsellor will guide discovery.',
      severity: gradeGroup === '11-12' ? 'critical' : 'info',
    });
  }

  // P-03: Flat moderate
  if (potFlags.includes('P-03')) {
    flags.push({
      code: 'P-03', name: 'Flat Moderate Profile',
      message: 'Broad range of interests with no strongly dominant personality type.',
      severity: 'info',
    });
  }

  // P-05: All MI Low
  if (potFlags.includes('P-05')) {
    flags.push({
      code: 'P-05', name: 'All MI Low',
      message: 'Learning strengths waiting to be discovered through experience.',
      severity: gradeGroup === '11-12' ? 'critical' : 'warning',
    });
  }

  // P-06: All Ability Low
  if (potFlags.includes('P-06')) {
    flags.push({
      code: 'P-06', name: 'All Ability Low',
      message: 'Ability scores may not reflect true strengths. Counsellor will review.',
      severity: gradeGroup === '11-12' ? 'critical' : 'warning',
    });
  }

  // P-07: Aspiration mismatch
  if (cci === 'Low') {
    flags.push({
      code: 'P-07', name: 'Aspiration Mismatch',
      message: 'Career interests differ from top-strength careers — exciting conversation to have with counsellor.',
      severity: gradeGroup === '11-12' ? 'critical' : 'info',
    });
  }

  // P-10: Aspiration incoherence
  const aspRiasecSet = new Set(aspirations.map((a) => ASPIRATION_RIASEC[a]).filter(Boolean));
  if (aspRiasecSet.size >= 4) {
    flags.push({
      code: 'P-10', name: 'Aspiration Incoherence',
      message: 'Wide-ranging curiosity spanning 4+ career personality types. Exploration session recommended.',
      severity: gradeGroup === '11-12' ? 'warning' : 'info',
    });
  }

  return flags;
}

// ═══════════════════════ GRADE GROUP ═══════════════════════

function resolveGradeGroup(studentClass: string): '6-8' | '9-10' | '11-12' {
  const num = parseInt(studentClass.replace(/\D/g, ''), 10);
  if (num >= 11) return '11-12';
  if (num >= 9) return '9-10';
  return '6-8';
}

// ═══════════════════════ MAIN COMPUTATION ═══════════════════════

export function computeNavigator360(
  data: IntermediaryScores,
  academicPct: number | null = null,
  ccRaw: number | null = null
): Navigator360Result {
  const gradeGroup = resolveGradeGroup(data.studentClass);

  // 1. Score all dimensions
  const riasec = scoreRIASEC(data.riasecScores);
  const abilities = scoreAbilities(data.aptitudeScores);
  const mi = scoreMI(data.miScores);

  // 2. Normalize values to spec format
  const studentValues = data.selectedValues;

  // 3. Compute Potential Score
  const potentialScore = computePotentialScore(riasec, mi, abilities, academicPct);

  // 4. Compute top RIASEC for preference score
  const topRiasec = [...riasec]
    .sort((a, b) => b.normPct - a.normPct)
    .map((d) => d.name as RIASECType);

  // 5. Cultural compatibility (default 50% if not available)
  const ccNorm = ccRaw !== null ? Math.round(((ccRaw - 6) / 18) * 100) : 50;

  // 6. Compute Preference Score
  const preferenceScore = computePreferenceScore(
    studentValues, data.selectedCareerAsps, data.selectedSOIs, topRiasec, ccNorm
  );

  // 7. Career Matching
  const allMatches = matchCareers(riasec, mi, abilities, studentValues, data.selectedCareerAsps);
  const topCount = gradeGroup === '11-12' ? 5 : 3;
  const topCareers = allMatches.slice(0, topCount);

  // 8. CCI
  const cci = computeCCI(data.selectedCareerAsps, allMatches);

  // 9. Alignment Score
  const alignmentScore = computeAlignment(riasec, mi, abilities, topCareers);

  // 10. Holland Code (top 3 RIASEC)
  const hollandCode = topRiasec.slice(0, 3).join('');

  // 11. Flags
  const flags = collectFlags(
    riasec, mi, abilities, data.selectedCareerAsps, studentValues,
    cci, potentialScore.flags, gradeGroup
  );

  return {
    studentName: data.studentName,
    studentClass: data.studentClass,
    gradeGroup,
    riasec,
    abilities,
    mi,
    careerAspirations: data.selectedCareerAsps,
    values: studentValues,
    subjectsOfInterest: data.selectedSOIs,
    potentialScore,
    preferenceScore,
    careerMatches: allMatches,
    topCareers,
    cci,
    alignmentScore,
    flags,
    hollandCode,
  };
}

// ═══════════════════════ DISPLAY HELPERS ═══════════════════════

export function riasecDisplayName(key: string): string {
  return RIASEC_LABELS[key as RIASECType] || key;
}

export function abilityDisplayName(name: string): string {
  return ABILITY_SHORT[name] || name;
}

export function miDisplayName(name: string): string {
  return MI_DISPLAY[name] || name;
}

export function levelColor(level: AbsoluteLevel): string {
  if (level === 'HIGH') return '#059669';
  if (level === 'MODERATE') return '#d97706';
  return '#dc2626';
}

export function stanineLabel(stanine: number): string {
  const labels = [
    '', 'Well below average', 'Below average', 'Slightly below average',
    'Low average', 'Average', 'High average', 'Above average',
    'Well above average', 'Superior',
  ];
  return labels[stanine] || '';
}
