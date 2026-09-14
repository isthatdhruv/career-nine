#!/usr/bin/env bash
# Regenerates public/catalogues/india-cities.json from the GeoNames dump.
#
# The file is a static asset: it ships with the app (behind the same CDN as
# everything else under public/), is fetched lazily by the demographics page
# only when a "city" field is present, and is NOT part of the boot precache
# (generate-manifest.cjs files it under the un-prefetched "other" category).
#
# Usage:  bash scripts/build-city-catalogue.sh            # population >= 15,000 (~3,750 towns, ~24 KB gzip)
#         MIN_POP=5000 bash scripts/build-city-catalogue.sh   # ~6,400 towns, ~40 KB gzip
#
# Source: GeoNames cities5000 + admin1CodesASCII (CC BY 4.0, https://www.geonames.org).
set -euo pipefail
MIN_POP="${MIN_POP:-15000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/catalogues/india-cities.json"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "Downloading GeoNames dumps..."
curl -sfL --max-time 300 -o "$TMP/cities5000.zip" https://download.geonames.org/export/dump/cities5000.zip
curl -sfL --max-time 120 -o "$TMP/admin1CodesASCII.txt" https://download.geonames.org/export/dump/admin1CodesASCII.txt
unzip -q -o "$TMP/cities5000.zip" -d "$TMP"

MIN_POP="$MIN_POP" TMP="$TMP" OUT="$OUT" node - <<'NODE'
const fs = require("fs");
const { TMP, OUT } = process.env;
const minPop = Number(process.env.MIN_POP);

// admin1 code -> state / UT name, India only
const states = {};
for (const line of fs.readFileSync(`${TMP}/admin1CodesASCII.txt`, "utf8").split("\n")) {
  const [code, name] = line.split("\t");
  if (code && code.startsWith("IN.")) states[code.slice(3)] = name;
}

// GeoNames columns: 1 geonameid, 2 name, 3 asciiname, ..., 9 country, 11 admin1, 15 population
const rows = [];
for (const line of fs.readFileSync(`${TMP}/cities5000.txt`, "utf8").split("\n")) {
  const c = line.split("\t");
  if (c[8] !== "IN") continue;
  const ascii = c[2] || c[1];
  const admin1 = c[10];
  const pop = Number(c[14] || 0);
  if (!states[admin1] || pop < minPop) continue;
  rows.push({ name: ascii, state: admin1, pop });
}
// Population-sorted so the typeahead surfaces the prominent match first.
rows.sort((a, b) => b.pop - a.pop);
const seen = new Set();
const cities = [];
for (const r of rows) {
  const key = r.name.toLowerCase() + "|" + r.state;
  if (seen.has(key)) continue;
  seen.add(key);
  cities.push([r.name, r.state]);
}
const doc = {
  source: "GeoNames cities5000 + admin1CodesASCII (CC BY 4.0), India, ASCII names, population-sorted",
  minPopulation: minPop,
  updated: new Date().toISOString().slice(0, 10),
  states,
  cities,
};
fs.mkdirSync(require("path").dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc));
console.log(`Wrote ${OUT}: ${cities.length} cities, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB raw`);
NODE
