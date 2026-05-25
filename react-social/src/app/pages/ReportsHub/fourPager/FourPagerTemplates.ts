// ═══════════════════════════════════════════════════════════════════════════
// Four-Pager Report — Template Fetcher
// Pulls the grade-specific HTML template from DigitalOcean Spaces and caches
// it in-memory for subsequent fills.
// ═══════════════════════════════════════════════════════════════════════════

import { FourPagerVariant } from './FourPagerTypes';

const BASE =
  process.env.REACT_APP_FOUR_PAGER_TEMPLATE_BASE ||
  'https://storage-c9.sgp1.digitaloceanspaces.com/four-pager-template-assets';

const TEMPLATE_URLS: Record<FourPagerVariant, string> = {
  insight: `${BASE}/insight-navigator.html`,
  subject: `${BASE}/subject-navigator.html`,
  career: `${BASE}/career-navigator.html`,
};

const cache: Partial<Record<FourPagerVariant, string>> = {};

export function resolveVariant(gradeGroup: '6-8' | '9-10' | '11-12'): FourPagerVariant {
  if (gradeGroup === '6-8') return 'insight';
  if (gradeGroup === '9-10') return 'subject';
  return 'career';
}

export async function fetchTemplate(variant: FourPagerVariant): Promise<string> {
  if (cache[variant]) return cache[variant]!;
  // Cache-bust per session so freshly uploaded templates are picked up;
  // subsequent calls within the session reuse the in-memory copy.
  const url = `${TEMPLATE_URLS[variant]}?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to fetch 4-pager template '${variant}': ${res.status}`);
  }
  const html = await res.text();
  cache[variant] = html;
  return html;
}

export function fillTemplate(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(data, key) ? data[key] : ''
  );
}
