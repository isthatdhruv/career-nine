#!/usr/bin/env node
/**
 * Generates resource-manifest.json after vite build.
 * Lists all assets in dist/ categorized by priority for the ResourcePreloader.
 *
 * Priority levels:
 *   - critical: JS/CSS bundles (already loaded by browser, preloader skips these)
 *   - assessment: cached assessment JSON + extracted images
 *   - game: game sprites, scenes, tutorial videos
 *   - deferred: mediapipe WASM/ML models (large, only needed for face tracking)
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');

function categorize(relativePath) {
  if (relativePath.startsWith('assessment-cache/')) return 'assessment';
  if (relativePath.startsWith('mediapipe/')) return 'deferred';
  if (relativePath.startsWith('assets/game/') || relativePath.startsWith('game-scenes/')) return 'game';
  if (relativePath.match(/\.(js|css)$/)) return 'critical';
  if (relativePath.match(/\.(html)$/)) return 'critical';
  return 'other';
}

function walkDir(dir, base) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, relativePath));
    } else {
      // Skip compressed versions and the manifest itself
      if (entry.name.endsWith('.gz') || entry.name.endsWith('.br')) continue;
      if (entry.name === 'resource-manifest.json') continue;
      // Skip service worker files
      if (entry.name === 'sw.js' || entry.name === 'registerSW.js' || entry.name === 'workbox-' + entry.name) continue;

      const stat = fs.statSync(fullPath);
      results.push({
        url: '/' + relativePath.replace(/\\/g, '/'),
        size: stat.size,
        priority: categorize(relativePath.replace(/\\/g, '/')),
      });
    }
  }
  return results;
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('dist/ directory not found. Run vite build first.');
  process.exit(1);
}

const resources = walkDir(DIST_DIR, '');

// Sort by priority order: assessment first (what users need), then game, then deferred
const priorityOrder = { assessment: 0, game: 1, deferred: 2, critical: 3, other: 4 };
resources.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));

const manifest = {
  version: Date.now().toString(36),
  generated: new Date().toISOString(),
  resources,
  summary: {
    total: resources.length,
    totalSize: resources.reduce((s, r) => s + r.size, 0),
    byPriority: {}
  }
};

for (const r of resources) {
  if (!manifest.summary.byPriority[r.priority]) {
    manifest.summary.byPriority[r.priority] = { count: 0, size: 0 };
  }
  manifest.summary.byPriority[r.priority].count++;
  manifest.summary.byPriority[r.priority].size += r.size;
}

const outputPath = path.join(DIST_DIR, 'resource-manifest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log('Generated resource-manifest.json:');
for (const [priority, info] of Object.entries(manifest.summary.byPriority)) {
  console.log(`  ${priority}: ${info.count} files, ${(info.size / 1024 / 1024).toFixed(1)}MB`);
}
console.log(`  Total: ${manifest.summary.total} files, ${(manifest.summary.totalSize / 1024 / 1024).toFixed(1)}MB`);
