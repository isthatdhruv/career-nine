#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build-time generator: scans `src/app/routing/PrivateRoutes.tsx` for
 *   <Route path="..."  element={<RequirePermission perm="...">  ... </RequirePermission>}
 * blocks and writes `src/app/permissions-manifest.json` as
 *   { "<perm.code>": ["<route path>", ...] }
 *
 * The output feeds RolePermissionsModal so each permission option in the picker
 * shows which routes it actually gates.
 *
 * Wired via `prestart` / `prebuild` in package.json so it runs before every
 * dev-server start or production build. Local dev gets a fresh manifest every
 * time `npm start` is invoked; CI gets one as part of `npm run build`.
 *
 * Implementation note: this is a regex pass, not an AST parser. Every existing
 * <RequirePermission perm="x"> wrapper in the codebase is a one-line attribute
 * inside a one-line element, so regex is enough. If/when that convention
 * breaks down, swap for `ts-morph` or `@typescript-eslint/parser` and update
 * this file — the consumers (manifest JSON) don't change.
 *
 * Comment stripping is string-AWARE (see stripComments): a naive block-comment
 * regex sweep treats the slash-star inside a route path like the wildcard
 * "auth/[star]" as a block-comment opener and silently eats every route up to
 * the next comment-close. That bug dropped ~18 routes and emitted garbage
 * paths (e.g. student_management.read got "auth}<newline><Route path="). The
 * scanner below never starts a comment while inside a string literal, so
 * wildcard paths survive intact.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(REPO_ROOT, "src/app/routing/PrivateRoutes.tsx");
const OUTPUT = path.join(REPO_ROOT, "src/app/permissions-manifest.json");

/**
 * Remove `//` line comments and `/* ... *​/` block comments, but ONLY when not
 * inside a string literal (", ', or `). Newlines are preserved so byte offsets
 * stay roughly line-aligned for debugging. Escapes inside strings are honoured.
 */
function stripComments(src) {
  let out = "";
  const n = src.length;
  // code | line | block | dquote | squote | tquote
  let state = "code";
  for (let i = 0; i < n; i++) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";

    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; i++; continue; }
      if (c === "/" && c2 === "*") { state = "block"; i++; continue; }
      if (c === '"') { state = "dquote"; out += c; continue; }
      if (c === "'") { state = "squote"; out += c; continue; }
      if (c === "`") { state = "tquote"; out += c; continue; }
      out += c;
      continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += c; }
      continue;
    }
    if (state === "block") {
      if (c === "*" && c2 === "/") { state = "code"; i++; continue; }
      if (c === "\n") out += c; // keep line count stable
      continue;
    }
    // ── inside a string literal: copy verbatim, respect escapes ──
    out += c;
    if (c === "\\") { // escape — copy the escaped char too
      if (i + 1 < n) { out += src[i + 1]; i++; }
      continue;
    }
    const q = state === "dquote" ? '"' : state === "squote" ? "'" : "`";
    if (c === q) state = "code";
  }
  return out;
}

/**
 * Normalize a captured route path to what React Router actually serves, so it
 * matches `location.pathname` at runtime (the matcher in permissions.ts uses
 * literal equality on the leading-slash form).
 *
 *  - Relative children of the path-less <AuthorizedLayout> parent (e.g.
 *    `path="group"`) resolve to `/group`. Prepend the slash.
 *  - Paths carrying a `${...}` template artifact (a bug where a template
 *    literal was pasted into a plain "..." string) can never match a real URL —
 *    skip them and warn rather than poison the manifest.
 *
 * Returns the normalized path, or null if the path should be skipped.
 */
function normalizeRoutePath(p) {
  if (!p) return null;
  if (p.includes("${")) {
    console.warn(`[extract-perm-routes] skipping route with template artifact: ${JSON.stringify(p)}`);
    return null;
  }
  return p.startsWith("/") ? p : "/" + p;
}

function extract() {
  if (!fs.existsSync(INPUT)) {
    console.warn(`[extract-perm-routes] ${INPUT} not found — writing empty manifest`);
    return {};
  }

  const src = fs.readFileSync(INPUT, "utf8");

  // String-aware comment removal so commented-out routes are ignored while
  // wildcard paths like `path="auth/*"` survive intact.
  const stripped = stripComments(src);

  // <Route path="X" ... element={<RequirePermission perm="Y" ...>...
  // The tempered `(?:(?!<Route\b)[\s\S])*?` segments handle attribute reordering
  // and line wraps while refusing to cross into the *next* <Route. Without the
  // tempering, a redirect route (<Route ... element={<Navigate/>}>, no
  // RequirePermission) would borrow the following route's perm and mask the
  // real route — e.g. the /reports route sitting after a block of /roles/*
  // <Navigate> redirects.
  const NOT_ROUTE = "(?:(?!<Route\\b)[\\s\\S])*?";
  const re = new RegExp(
    `<Route\\b${NOT_ROUTE}\\bpath\\s*=\\s*(["'\`])([^"'\`]+?)\\1` +
    `${NOT_ROUTE}<RequirePermission\\b${NOT_ROUTE}\\bperm\\s*=\\s*(["'\`])([^"'\`]+?)\\3`,
    "g"
  );

  const map = {};
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const perm = m[4];
    const routePath = normalizeRoutePath(m[2]);
    if (!perm || !routePath) continue;
    if (!map[perm]) map[perm] = [];
    if (!map[perm].includes(routePath)) map[perm].push(routePath);
  }

  // Stable ordering: sorted keys, sorted route arrays.
  const sorted = {};
  Object.keys(map).sort().forEach((k) => {
    sorted[k] = map[k].slice().sort();
  });
  return sorted;
}

function main() {
  const manifest = extract();
  const json = JSON.stringify(manifest, null, 2) + "\n";
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, json, "utf8");

  const permCount = Object.keys(manifest).length;
  const routeCount = Object.values(manifest).reduce((n, arr) => n + arr.length, 0);
  console.log(
    `[extract-perm-routes] Wrote ${OUTPUT.replace(REPO_ROOT + path.sep, "")} ` +
    `— ${permCount} permission${permCount === 1 ? "" : "s"} → ${routeCount} route${routeCount === 1 ? "" : "s"}`
  );
}

main();
