// Maps the printable Windows-1252 characters in the 0x80-0x9F range back to
// their byte values. These (e.g. EUR, (TM), smart quotes, en/em dash) are the
// characters that mojibake produces but that ISO-8859-1 cannot represent --
// the reason the old `charCodeAt & 0xff` approach silently dropped them.
const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

// Encode a string to windows-1252 bytes, mirroring MySQL's `latin1`.
// Returns null if any char isn't representable -- that means the text is
// genuine Unicode (CJK, emoji, real smart quotes), not mojibake, so leave it.
function encodeCp1252(s: string): Uint8Array | null {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      out[i] = code;
    } else if (code in CP1252_TO_BYTE) {
      out[i] = CP1252_TO_BYTE[code];
    } else {
      return null;
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

export function sanitizeText(input: string | null | undefined): string {
  if (!input) return "";
  if (!hasNonAscii(input)) return input;

  const bytes = encodeCp1252(input);
  if (!bytes) return input;

  try {
    // fatal:true so non-UTF-8 byte sequences (genuine accented text) throw
    // and the original is preserved instead of being corrupted.
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded === input ? input : decoded;
  } catch {
    return input;
  }
}

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
