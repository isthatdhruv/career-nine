// ═══════════════════════════════════════════════════════════════════════════
// Four-Pager Report — Placeholder Mapping Engine
// Translates a Navigator360Result into the ~99 placeholders expected by the
// four-pager templates (insight / subject / career).
// ═══════════════════════════════════════════════════════════════════════════

import {
  Navigator360Result,
  ScoredDimension,
  AbsoluteLevel,
  RIASEC_LABELS,
  RIASECType,
  CareerMatch,
} from '../navigator360/Navigator360Types';
import {
  abilityDisplayName,
  miDisplayName,
} from '../navigator360/Navigator360Engine';
import {
  VALUE_LABEL_TO_SPEC,
  SUBJECT_RIASEC,
} from '../navigator360/Navigator360CareerData';
import { StudentMeta, PlaceholderMap, FOUR_PAGER_PLACEHOLDER_KEYS } from './FourPagerTypes';

// ═════════════ Creative display names + narrative descriptions ═════════════

// RIASEC — "The Analyst" style persona + one-sentence narrative
const RIASEC_CREATIVE: Record<RIASECType, { name: string; desc: string }> = {
  R: { name: 'The Hands-On Thinker', desc: 'Enjoys practical work and learning by doing.' },
  I: { name: 'The Analyst', desc: 'A natural problem-solver and deep thinker.' },
  A: { name: 'The Creator', desc: 'Expresses ideas through design and imagination.' },
  S: { name: 'The Helper', desc: 'Thrives on supporting, teaching and uplifting others.' },
  E: { name: 'The Persuader', desc: 'Leads conversations, opportunities and people.' },
  C: { name: 'The Organiser', desc: 'Brings structure, reliability and precision to work.' },
};

// Multiple Intelligences — creative name + narrative
const MI_CREATIVE: Record<string, { name: string; desc: string }> = {
  'Logical-Mathematical': { name: 'Number Wizard', desc: 'Patterns, logic and systems are your natural language.' },
  'Linguistic':           { name: 'Word Smith',    desc: 'Reading, writing and speaking come alive for you.' },
  'Visual-Spatial':       { name: 'Visual Thinker', desc: 'Thinks in pictures, patterns and spaces.' },
  'Spatial-Visual':       { name: 'Visual Thinker', desc: 'Thinks in pictures, patterns and spaces.' },
  'Interpersonal':        { name: 'People Connector', desc: 'Reads people, builds bridges, leads teams.' },
  'Intrapersonal':        { name: 'Reflective Thinker', desc: 'Grows through self-reflection and self-awareness.' },
  'Bodily-Kinesthetic':   { name: 'Body Mover',    desc: 'Learns fastest through movement and hands-on practice.' },
  'Musical':              { name: 'Rhythm Master', desc: 'Hears pattern, pitch and tempo before words.' },
  'Naturalistic':         { name: 'Nature Reader', desc: 'Senses how living systems and the outdoors connect.' },
};

// Abilities — creative name + narrative
const ABILITY_CREATIVE: Record<string, { name: string; desc: string }> = {
  'Logical reasoning':                 { name: 'Sharp Logical Mind',    desc: 'Identifies patterns and solves complex problems step-by-step.' },
  'Computational':                     { name: 'Number Cruncher',       desc: 'Maths and calculations feel natural and enjoyable.' },
  'Technical':                         { name: 'Tech Wizard',           desc: 'Understands how tools and systems actually work.' },
  'Language/Communication':            { name: 'Word Smith',            desc: 'Explains ideas clearly in speech and writing.' },
  'Creativity/Artistic':               { name: 'Creative Soul',         desc: 'Generates original ideas others wouldn’t.' },
  'Form perception':                   { name: 'Pattern Spotter',       desc: 'Notices shape, layout and visual detail at a glance.' },
  'Speed and accuracy':                { name: 'Precision Master',      desc: 'Processes information quickly with few mistakes.' },
  'Decision making & problem solving': { name: 'Quick Decider',         desc: 'Weighs trade-offs and acts well under uncertainty.' },
  'Finger dexterity':                  { name: 'Skilled Hands',         desc: 'Precise, steady fine-motor control.' },
  'Motor movement':                    { name: 'Power Mover',           desc: 'Strong, coordinated large-muscle performance.' },
};

// Work Values — creative persona name (for display in the Core Values card)
const VALUE_CREATIVE: Record<string, string> = {
  'Mental Activity':    'The Deep Thinker',
  'High Achievement':   'The Achiever',
  'Autonomy':           'The Free Thinker',
  'Good Salary':        'The Earner',
  'Creativity':         'Idea Generator',
  'Helping Others':     'The Helper',
  'Job Security':       'The Stable One',
  'Prestige':           'The Distinguished',
  'Prestige / Status':  'The Distinguished',
  'Physical Activity':  'The Active One',
  'Working with Hands': 'The Craftsperson',
  'Leadership':         'The Leader',
  'Work-Life Balance':  'The Balancer',
  'Social Impact':      'The Impact Maker',
  'Routine Activity':   'The Steady One',
  'Variety':            'The Explorer',
  'Variety / Adventure': 'The Explorer',
};

// ═════════════════════════════ Helpers ═════════════════════════════════════

const CP_RANK = ['PRIMARY', 'SECONDARY', 'TERTIARY'] as const;

function levelLabel(level: AbsoluteLevel): string {
  if (level === 'HIGH') return 'HIGH';
  if (level === 'MODERATE') return 'MODERATE';
  return 'DEVELOPING';
}

function sortDesc(dims: ScoredDimension[]): ScoredDimension[] {
  return [...dims].sort((a, b) => b.normPct - a.normPct);
}

function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cciDescription(cci: Navigator360Result['cci']): string {
  if (cci === 'High')
    return '2 or more of your career choices match your top suitability careers.';
  if (cci === 'Moderate')
    return 'Some of your career choices align with your top suitability range.';
  return 'Your career choices differ from your strength-based suggestions — a great discussion for your counsellor.';
}

// Coherence score comes out of P2 (0–20). Map to one-word label.
function coherenceLabel(p2Aspirations: number): string {
  if (p2Aspirations >= 15) return 'High';
  if (p2Aspirations >= 8)  return 'Moderate';
  return 'Developing';
}

// Subject-personality alignment — show "High — 3/3 match your top types"
function subjectAlignment(
  subjects: string[],
  top3Riasec: RIASECType[]
): string {
  if (subjects.length === 0) return 'Exploring';
  const top = new Set<RIASECType>(top3Riasec);
  const aligned = subjects.filter((s) => {
    const r = SUBJECT_RIASEC[s] as RIASECType | undefined;
    return r && top.has(r);
  }).length;
  const ratio = aligned / subjects.length;
  const label = ratio >= 0.67 ? 'High' : ratio >= 0.34 ? 'Moderate' : 'Developing';
  return `${label} — ${aligned}/${subjects.length} match your top types`;
}

function careerTags(match: CareerMatch): string {
  const tags = [
    ...match.career.riasec.slice(0, 2).map((r) => RIASEC_LABELS[r as RIASECType]),
    ...(match.matchedValues[0] ? [match.matchedValues[0]] : []),
  ];
  return tags.map((t) => `<span class="p4n-career-tag">${t}</span>`).join('');
}

function careerShortDesc(match: CareerMatch): string {
  const first = match.career.degreePaths[0];
  if (!first) return '';
  const rest = match.career.degreePaths.length - 1;
  return rest > 0 ? `${first} · +${rest} more paths` : first;
}

// Build 5 growth areas from the lowest-scoring dimensions across all three pillars.
function pickGrowthAreas(
  riasec: ScoredDimension[],
  mi: ScoredDimension[],
  abilities: ScoredDimension[]
): Array<{ name: string; level: string }> {
  const all: Array<{ label: string; level: AbsoluteLevel; normPct: number }> = [
    ...riasec.map((d) => ({
      label: RIASEC_CREATIVE[d.name as RIASECType]?.name || RIASEC_LABELS[d.name as RIASECType] || d.name,
      level: d.level,
      normPct: d.normPct,
    })),
    ...mi.map((d) => {
      const m = MI_CREATIVE[miDisplayName(d.name)] || MI_CREATIVE[d.name];
      return { label: m?.name || miDisplayName(d.name), level: d.level, normPct: d.normPct };
    }),
    ...abilities.map((d) => {
      const a = ABILITY_CREATIVE[d.name];
      return { label: a?.name || abilityDisplayName(d.name), level: d.level, normPct: d.normPct };
    }),
  ];
  const sorted = all.sort((a, b) => a.normPct - b.normPct).slice(0, 5);
  return sorted.map((d) => ({ name: d.label, level: levelLabel(d.level) }));
}

// ═══════════════════════════ Main mapping ═══════════════════════════════════

export function buildFourPagerPlaceholders(
  result: Navigator360Result,
  student: StudentMeta
): PlaceholderMap {
  const out: PlaceholderMap = {};
  for (const k of FOUR_PAGER_PLACEHOLDER_KEYS) out[k] = '';

  // Student / meta
  out.student_name = student.studentName || result.studentName || '';
  out.grade = student.studentClass || result.studentClass || '';
  out.age = student.age != null ? String(student.age) : '';
  out.school_name = student.schoolName || '';
  out.school_city = student.schoolCity || '';
  out.report_date = todayLabel();
  out.qr_code = student.reportUrl || '';

  // Aggregate headers
  out.holland_code = result.hollandCode || '';
  const abHigh = result.abilities.filter((a) => a.level === 'HIGH').length;
  const abMod  = result.abilities.filter((a) => a.level === 'MODERATE').length;
  out.ability_aggregate = `${result.abilities.length}-Domain Aptitude · ${abHigh} High · ${abMod} Moderate`;

  // RIASEC — top 3 Career Personality cards
  const riasecTop = sortDesc(result.riasec).slice(0, 3);
  riasecTop.forEach((d, i) => {
    const key = d.name as RIASECType;
    const creative = RIASEC_CREATIVE[key];
    out[`cp_${i + 1}`] = creative?.name || RIASEC_LABELS[key] || d.name;
    out[`cp_${i + 1}_level`] = `Type ${i + 1} · ${CP_RANK[i]} · Score: ${levelLabel(d.level)}`;
    out[`cp_${i + 1}_desc`] = creative?.desc || '';
  });

  // MI — top 3
  const miTop = sortDesc(result.mi).slice(0, 3);
  miTop.forEach((d, i) => {
    const label = miDisplayName(d.name);
    const creative = MI_CREATIVE[label] || MI_CREATIVE[d.name];
    out[`mi_${i + 1}`] = creative?.name || label;
    out[`mi_${i + 1}_level`] = `MI ${i + 1} · ${CP_RANK[i]} · Score: ${levelLabel(d.level)}`;
    out[`mi_${i + 1}_desc`] = creative?.desc || '';
  });

  // Abilities — top 4
  const abTop = sortDesc(result.abilities).slice(0, 4);
  abTop.forEach((d, i) => {
    const creative = ABILITY_CREATIVE[d.name];
    out[`ab_${i + 1}`] = creative?.name || abilityDisplayName(d.name);
    out[`ab_${i + 1}_level`] = `Ability ${i + 1} · Score: ${levelLabel(d.level)}`;
    out[`ab_${i + 1}_desc`] = creative?.desc || '';
  });

  // Values (up to 5) — creative persona names for display
  const values = (result.values || []).slice(0, 5);
  values.forEach((v, i) => {
    const spec = VALUE_LABEL_TO_SPEC[v] || v;
    out[`value_${i + 1}`] = VALUE_CREATIVE[spec] || VALUE_CREATIVE[v] || v;
  });
  out.values_basis = values.map((v) => VALUE_LABEL_TO_SPEC[v] || v).join(' · ');

  // Subjects (up to 3) + alignment
  const subjects = (result.subjectsOfInterest || []).slice(0, 3);
  subjects.forEach((s, i) => {
    out[`subject_${i + 1}`] = s;
  });
  const top3Riasec = riasecTop.map((d) => d.name as RIASECType);
  out.subject_alignment = subjectAlignment(subjects, top3Riasec);

  // Aspirations (up to 3) + coherence
  (result.careerAspirations || []).slice(0, 3).forEach((a, i) => {
    out[`aspiration_${i + 1}`] = a;
  });
  out.aspiration_coherence = coherenceLabel(result.preferenceScore.p2Aspirations);

  // Strength profile — top item from each pillar + top value (creative names)
  out.strength_profile_1 = riasecTop[0] ? (RIASEC_CREATIVE[riasecTop[0].name as RIASECType]?.name || RIASEC_LABELS[riasecTop[0].name as RIASECType]) : '';
  out.strength_profile_2 = miTop[0] ? (MI_CREATIVE[miDisplayName(miTop[0].name)]?.name || miDisplayName(miTop[0].name)) : '';
  out.strength_profile_3 = abTop[0] ? (ABILITY_CREATIVE[abTop[0].name]?.name || abilityDisplayName(abTop[0].name)) : '';
  out.strength_profile_4 = values[0] ? (VALUE_CREATIVE[VALUE_LABEL_TO_SPEC[values[0]] || values[0]] || values[0]) : '';

  // Clarity & alignment (number only — templates add their own '%' suffix)
  out.clarity_index = result.cci;
  out.clarity_description = cciDescription(result.cci);
  out.alignment_score = String(result.alignmentScore);

  // Static Career Library QR — green on white, matches brand
  out.qr_image_url =
    'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' +
    encodeURIComponent('https://library.career-9.com') +
    '&color=0B3D2E&bgcolor=ffffff';

  // Top 9 career matches
  const topCareers = result.careerMatches.slice(0, 9);
  topCareers.forEach((match, i) => {
    const n = i + 1;
    out[`career_${n}_name`] = match.career.name;
    out[`career_${n}_score`] = `${match.suitability}%`;
    out[`career_${n}_pct`] = String(match.suitability);
    out[`career_${n}_desc`] = careerShortDesc(match);
    out[`career_${n}_tags`] = careerTags(match);
  });
  out.career_cluster_count = String(result.careerMatches.length);

  // Growth areas (5 lowest)
  const growth = pickGrowthAreas(result.riasec, result.mi, result.abilities);
  growth.forEach((g, i) => {
    out[`growth_${i + 1}_name`] = g.name;
    out[`growth_${i + 1}_level`] = g.level;
  });
  out.growth_note =
    'These are areas with room to grow. Your counsellor can suggest activities to help develop them over the coming months.';

  return out;
}

// Lazy re-use: also expose a typed bundle of what went in.
export { sortDesc as _sortDesc };
