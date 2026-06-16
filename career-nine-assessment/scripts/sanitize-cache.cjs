#!/usr/bin/env node
/**
 * sanitize-cache.cjs — clean mojibake out of the static assessment cache files
 * AT REST, so the frozen data.json / config.json never contain garbled chars
 * (e.g. "â€™" for ') regardless of what the backend returned at build time.
 *
 * Usage:
 *   node scripts/sanitize-cache.cjs <dir>     # clean data.json + config.json in <dir>
 *   node scripts/sanitize-cache.cjs --all     # clean every public/assessment-cache/<id>
 *
 * Same windows-1252 self-validating logic as the app's src/utils/sanitizeText.ts
 * and the backend MojibakeFixer: re-encode as windows-1252 (MySQL "latin1") then
 * strict-UTF-8 decode. Leaves genuine Hindi / emoji / accents untouched.
 */
const fs = require('fs');
const path = require('path');

const CP1252_TO_BYTE = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

function encodeCp1252(s) {
  const out = Buffer.allocUnsafe(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) out[i] = code;
    else if (code in CP1252_TO_BYTE) out[i] = CP1252_TO_BYTE[code];
    else return null; // genuine Unicode — not mojibake
  }
  return out;
}

function hasNonAscii(s) {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) return true;
  return false;
}

function sanitizeText(input) {
  if (!input || !hasNonAscii(input)) return input;
  const bytes = encodeCp1252(input);
  if (!bytes) return input;
  try {
    const decoded = strictUtf8.decode(bytes);
    return decoded === input ? input : decoded;
  } catch {
    return input;
  }
}

let fixed = 0;
function sanitize(value) {
  if (typeof value === 'string') {
    const out = sanitizeText(value);
    if (out !== value) fixed++;
    return out;
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = sanitize(value[k]);
    return value;
  }
  return value;
}

function cleanFile(file) {
  if (!fs.existsSync(file)) return;
  const before = fixed;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cleaned = sanitize(data);
  if (fixed !== before) {
    fs.writeFileSync(file, JSON.stringify(cleaned));
    console.log(`  ✓ sanitized ${fixed - before} string(s) in ${file}`);
  }
}

function cleanDir(dir) {
  cleanFile(path.join(dir, 'data.json'));
  cleanFile(path.join(dir, 'config.json'));
}

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/sanitize-cache.cjs <dir> | --all');
  process.exit(1);
}
if (arg === '--all') {
  const base = 'public/assessment-cache';
  if (fs.existsSync(base)) {
    for (const id of fs.readdirSync(base)) {
      const d = path.join(base, id);
      if (fs.statSync(d).isDirectory()) cleanDir(d);
    }
  }
} else {
  cleanDir(arg);
}
console.log(fixed > 0 ? `Done — fixed ${fixed} string(s).` : 'Done — no mojibake found.');
