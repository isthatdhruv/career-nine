// ═══════════════════════════════════════════════════════════════════════════
// Four-Pager Report — Type Definitions
// Consumes Navigator360Result, produces placeholder map for 4-page template.
// ═══════════════════════════════════════════════════════════════════════════

export type FourPagerVariant = 'insight' | 'subject' | 'career';

export interface StudentMeta {
  studentName: string;
  studentClass: string;
  age?: string | number;
  schoolName?: string;
  schoolCity?: string;
  reportUrl?: string;
}

export type PlaceholderMap = Record<string, string>;

export const FOUR_PAGER_PLACEHOLDER_KEYS = [
  'student_name', 'grade', 'age', 'school_name', 'school_city',
  'report_date', 'qr_code', 'qr_image_url',
  'holland_code', 'ability_aggregate',
  'cp_1', 'cp_1_level', 'cp_1_desc',
  'cp_2', 'cp_2_level', 'cp_2_desc',
  'cp_3', 'cp_3_level', 'cp_3_desc',
  'mi_1', 'mi_1_level', 'mi_1_desc',
  'mi_2', 'mi_2_level', 'mi_2_desc',
  'mi_3', 'mi_3_level', 'mi_3_desc',
  'ab_1', 'ab_1_level', 'ab_1_desc',
  'ab_2', 'ab_2_level', 'ab_2_desc',
  'ab_3', 'ab_3_level', 'ab_3_desc',
  'ab_4', 'ab_4_level', 'ab_4_desc',
  'value_1', 'value_2', 'value_3', 'value_4', 'value_5', 'values_basis',
  'subject_1', 'subject_2', 'subject_3', 'subject_alignment',
  'aspiration_1', 'aspiration_2', 'aspiration_3', 'aspiration_coherence',
  'strength_profile_1', 'strength_profile_2', 'strength_profile_3', 'strength_profile_4',
  'clarity_index', 'clarity_description', 'alignment_score',
  'career_1_name', 'career_1_score', 'career_1_pct', 'career_1_desc', 'career_1_tags',
  'career_2_name', 'career_2_score', 'career_2_pct', 'career_2_desc', 'career_2_tags',
  'career_3_name', 'career_3_score', 'career_3_pct', 'career_3_desc', 'career_3_tags',
  'career_4_name', 'career_4_score', 'career_4_pct', 'career_4_desc', 'career_4_tags',
  'career_5_name', 'career_5_score', 'career_5_pct', 'career_5_desc', 'career_5_tags',
  'career_6_name', 'career_6_score', 'career_6_pct', 'career_6_desc', 'career_6_tags',
  'career_7_name', 'career_7_score', 'career_7_pct', 'career_7_desc', 'career_7_tags',
  'career_8_name', 'career_8_score', 'career_8_pct', 'career_8_desc', 'career_8_tags',
  'career_9_name', 'career_9_score', 'career_9_pct', 'career_9_desc', 'career_9_tags',
  'career_cluster_count',
  'growth_1_name', 'growth_1_level',
  'growth_2_name', 'growth_2_level',
  'growth_3_name', 'growth_3_level',
  'growth_4_name', 'growth_4_level',
  'growth_5_name', 'growth_5_level',
  'growth_note',
] as const;

export type FourPagerPlaceholderKey = typeof FOUR_PAGER_PLACEHOLDER_KEYS[number];
