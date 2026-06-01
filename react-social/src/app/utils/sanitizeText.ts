function hasMojibake(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x80 && c <= 0x9f) return true;
  }
  return false;
}

export function sanitizeText(input: string | null | undefined): string {
  if (!input) return "";
  if (!hasMojibake(input)) return input;

  try {
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      bytes[i] = input.charCodeAt(i) & 0xff;
    }
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (decoded.indexOf("�") !== -1) return input;
    return decoded;
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
