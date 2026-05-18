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
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(REPO_ROOT, "src/app/routing/PrivateRoutes.tsx");
const OUTPUT = path.join(REPO_ROOT, "src/app/permissions-manifest.json");

function extract() {
  if (!fs.existsSync(INPUT)) {
    console.warn(`[extract-perm-routes] ${INPUT} not found — writing empty manifest`);
    return {};
  }

  const src = fs.readFileSync(INPUT, "utf8");

  // Strip /* ... */ block comments and // line comments so we don't pick up
  // commented-out routes. Simple sweep — does not handle string-literal cases
  // but those don't appear here.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  // <Route path="X" ... element={<RequirePermission perm="Y" ...>...
  // The `[\s\S]*?` in the middle handles attribute reordering and line wraps.
  const re =
    /<Route\b[\s\S]*?\bpath\s*=\s*(["'`])([^"'`]+?)\1[\s\S]*?<RequirePermission\b[\s\S]*?\bperm\s*=\s*(["'`])([^"'`]+?)\3/g;

  const map = {};
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const routePath = m[2];
    const perm = m[4];
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
