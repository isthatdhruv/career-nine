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

// Static Career Library QR — always points to the same URL. Fetched once and
// inlined as a data URL so bulk zips (50+ reports) don't re-hit the external
// qrserver.com endpoint and get rate-limited, which previously hung html2canvas.
const QR_SOURCE_URL =
  'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' +
  encodeURIComponent('https://library.career-9.com') +
  '&color=0B3D2E&bgcolor=ffffff';

let qrDataUrlPromise: Promise<string> | null = null;

function loadQrDataUrl(): Promise<string> {
  if (qrDataUrlPromise) return qrDataUrlPromise;
  qrDataUrlPromise = fetch(QR_SOURCE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`QR fetch failed: ${res.status}`);
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        })
    )
    .catch((err) => {
      // Reset so a later attempt can retry, and fall back to the source URL.
      qrDataUrlPromise = null;
      console.warn('4-pager QR inline failed, falling back to remote URL:', err);
      return QR_SOURCE_URL;
    });
  return qrDataUrlPromise;
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
  const [raw, qrDataUrl] = await Promise.all([
    fetchNavigator360Scores(studentId, assessmentId),
    loadQrDataUrl(),
  ]);
  // Front-end override: backend may not populate studentClass on the scores
  // response. Trust the hub's value (from section lookup) when provided.
  if (studentMeta.studentClass) raw.studentClass = studentMeta.studentClass;
  if (studentMeta.studentName) raw.studentName = studentMeta.studentName;
  const result = computeNavigator360(raw);
  const variant = resolveVariant(result.gradeGroup);
  const template = await fetchTemplate(variant);
  const placeholders = buildFourPagerPlaceholders(result, studentMeta);
  placeholders.qr_image_url = qrDataUrl;
  const html = fillTemplate(template, placeholders);
  return { html, variant, result };
}
