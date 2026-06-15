// Mojibake repair for the assessment app's data-load boundary.
//
// The app serves question/option/instruction text from 3 tiers (browser Cache
// API, static build-time data.json, and the backend API). Static/cached files
// can be frozen copies generated before the backend mojibake fix, so we clean
// the text on the CLIENT — whatever the source — right where data enters
// (loadAssessmentById). This guarantees garbled chars like "â€™" never render.
//
// Logic mirrors the backend MojibakeFixer: re-encode the string as windows-1252
// (MySQL "latin1") then strict-UTF-8 decode. Self-validating, so genuine Hindi /
// emoji / accented text and already-clean punctuation are left untouched.

// Printable windows-1252 chars in 0x80-0x9F mapped back to their byte values
// (€ ™ smart quotes en/em dash …) — the ones a naive `& 0xff` drops.
const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function encodeCp1252(s: string): Uint8Array | null {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      out[i] = code;
    } else if (code in CP1252_TO_BYTE) {
      out[i] = CP1252_TO_BYTE[code];
    } else {
      return null; // genuine Unicode (CJK, emoji, real smart quotes) — not mojibake
    }
  }
  return out;
}

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return true;
  }
  return false;
}

export function sanitizeText(input: string): string {
  if (!input || !hasNonAscii(input)) return input;
  const bytes = encodeCp1252(input);
  if (!bytes) return input;
  try {
    // fatal:true so genuine (non-UTF-8) byte sequences throw and are preserved.
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded === input ? input : decoded;
  } catch {
    return input;
  }
}

// Recursively clean every string in an assessment payload (questions, options,
// instructions, section names). Base64 image strings are pure ASCII, so
// hasNonAscii short-circuits them with zero cost.
export function sanitizePayload<T>(value: T): T {
  if (typeof value === "string") return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map(sanitizePayload) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      out[k] = sanitizePayload((value as Record<string, unknown>)[k]);
    }
    return out as unknown as T;
  }
  return value;
}
