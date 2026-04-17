// ═══════════════════════════════════════════════════════════════════════════
// Four-Pager Report — API Layer
// Reuses the Navigator 360 data endpoint (the 4-pager is a different view of
// the same intermediary scores) and exposes helpers to generate the filled
// HTML for a student.
// ═══════════════════════════════════════════════════════════════════════════

import { computeNavigator360 } from '../navigator360/Navigator360Engine';
import { fetchNavigator360Scores } from '../navigator360/Navigator360API';
import { Navigator360Result } from '../navigator360/Navigator360Types';
import { buildFourPagerPlaceholders } from './FourPagerEngine';
import { fetchTemplate, fillTemplate, resolveVariant } from './FourPagerTemplates';
import { FourPagerVariant, StudentMeta } from './FourPagerTypes';

export interface FourPagerBundle {
  html: string;
  variant: FourPagerVariant;
  result: Navigator360Result;
}

/**
 * Fetch scores → compute Navigator 360 → pick grade template → fill placeholders.
 * Returns the fully rendered HTML ready for iframe preview or PDF conversion.
 */
export async function buildFourPagerHtml(
  studentId: number,
  assessmentId: number,
  studentMeta: StudentMeta
): Promise<FourPagerBundle> {
  const raw = await fetchNavigator360Scores(studentId, assessmentId);
  // Front-end override: backend may not populate studentClass on the scores
  // response. Trust the hub's value (from section lookup) when provided.
  if (studentMeta.studentClass) raw.studentClass = studentMeta.studentClass;
  if (studentMeta.studentName) raw.studentName = studentMeta.studentName;
  const result = computeNavigator360(raw);
  const variant = resolveVariant(result.gradeGroup);
  const template = await fetchTemplate(variant);
  const placeholders = buildFourPagerPlaceholders(result, studentMeta);
  const html = fillTemplate(template, placeholders);
  return { html, variant, result };
}
