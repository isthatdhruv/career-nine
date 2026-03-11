import { useState, useEffect, useRef } from 'react';

const CACHE_NAME = 'career9-resources-v1';
const MANIFEST_URL = '/resource-manifest.json';
const MAX_CONCURRENCY = 3;
const MANIFEST_TIMEOUT_MS = 5000;

const PREFETCH_PRIORITIES = new Set(['assessment', 'game']);

interface Resource {
  url: string;
  size: number;
  priority: string;
}

interface Manifest {
  version: string;
  resources: Resource[];
}

// ─── Pseudo-progress: smooth ticking bar that never reaches 100% on its own ───
// Gives constant visual feedback. Real download progress pushes it forward faster.

let pseudoPct = 0;       // Current displayed percentage
let realPct = 0;         // Actual download percentage
let tickTimer: number | null = null;
let totalFiles = 0;
let filesCompleted = 0;

function setBarDOM(pct: number) {
  const bar = document.getElementById('pl-bar');
  const label = document.getElementById('pl-label');
  if (bar) bar.style.width = `${pct.toFixed(1)}%`;
  if (label) {
    if (totalFiles > 0) {
      label.textContent = `Downloading resources ${filesCompleted} of ${totalFiles}`;
    } else {
      label.textContent = 'Preparing...';
    }
  }
}

function startPseudoProgress() {
  // Take over from the inline boot script in index.html
  // It was running pseudo-progress while the JS bundle downloaded
  const w = window as unknown as { __plBootPct?: () => number; __plBootStop?: () => void };
  if (w.__plBootStop) w.__plBootStop(); // Stop the boot timer
  pseudoPct = w.__plBootPct ? w.__plBootPct() : 2; // Continue from where boot left off
  realPct = 0;
  setBarDOM(pseudoPct);

  // Tick every 150ms — bar always creeps forward but slows down as it approaches realPct ceiling
  tickTimer = window.setInterval(() => {
    // The target is always slightly ahead of real progress, capped at 95%
    const target = Math.min(realPct + 8, 95);
    // Ease toward target: move faster when far away, slower when close
    const remaining = target - pseudoPct;
    if (remaining > 0.1) {
      pseudoPct += remaining * 0.08; // 8% of remaining distance per tick
    }
    setBarDOM(pseudoPct);
  }, 150);
}

function pushRealProgress(pct: number, completed: number, total: number) {
  realPct = pct;
  filesCompleted = completed;
  totalFiles = total;
  // If real progress jumps ahead of pseudo, snap pseudo forward
  if (realPct > pseudoPct) {
    pseudoPct = realPct;
    setBarDOM(pseudoPct);
  }
}

function finishProgress() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  pseudoPct = 100;
  realPct = 100;
  setBarDOM(100);
  const label = document.getElementById('pl-label');
  if (label) label.textContent = 'Ready!';
}

function hidePreloader() {
  finishProgress();
  const el = document.getElementById('preloader');
  if (!el) return;
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 400);
  }, 500);
}

// ─── Network helpers ───

async function fetchManifest(): Promise<Manifest | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
    const res = await fetch(MANIFEST_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getUncachedResources(resources: Resource[]): Promise<Resource[]> {
  if (!('caches' in window)) return [];
  try {
    const cache = await caches.open(CACHE_NAME);
    const uncached: Resource[] = [];
    for (const r of resources) {
      if (!(await cache.match(r.url))) uncached.push(r);
    }
    return uncached;
  } catch {
    return [];
  }
}

async function downloadWithProgress(
  cache: Cache,
  resource: Resource,
  onBytesRead: (bytes: number) => void,
): Promise<void> {
  const res = await fetch(resource.url);
  if (!res.ok) return;

  if (res.body) {
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      onBytesRead(value.length);
    }

    const blob = new Blob(chunks);
    const cachedResponse = new Response(blob, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
    await cache.put(resource.url, cachedResponse);
  } else {
    await cache.put(resource.url, res);
    onBytesRead(resource.size || 1);
  }
}

// ─── Component ───

export default function ResourcePreloader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // Reset module-level state in case of remount (React strict mode, HMR, etc.)
    pseudoPct = 0;
    realPct = 0;
    totalFiles = 0;
    filesCompleted = 0;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }

    // Start the pseudo progress bar immediately — gives constant visual motion
    startPseudoProgress();

    async function preload() {
      try {
        if (!('caches' in window)) return;

        // Clear our resource cache + session data so every visit starts fresh
        await caches.delete(CACHE_NAME);
        sessionStorage.clear();

        const manifest = await fetchManifest();
        if (!manifest || cancelledRef.current) return;

        const prefetchable = manifest.resources.filter(r => PREFETCH_PRIORITIES.has(r.priority));
        const uncached = await getUncachedResources(prefetchable);
        if (cancelledRef.current || uncached.length === 0) return;

        const totalBytes = uncached.reduce((s, r) => s + (r.size || 1), 0);
        let bytesLoaded = 0;
        let completed = 0;
        const total = uncached.length;

        totalFiles = total;
        pushRealProgress(0, 0, total);

        const cache = await caches.open(CACHE_NAME);
        let idx = 0;

        async function worker(): Promise<void> {
          while (idx < uncached.length) {
            const current = idx++;
            try {
              await downloadWithProgress(cache, uncached[current], (bytes) => {
                bytesLoaded += bytes;
                if (!cancelledRef.current) {
                  const pct = Math.round((bytesLoaded / totalBytes) * 100);
                  pushRealProgress(pct, completed, total);
                }
              });
            } catch { /* skip */ }
            completed++;
            if (!cancelledRef.current) {
              const pct = Math.round((bytesLoaded / totalBytes) * 100);
              pushRealProgress(pct, completed, total);
            }
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(MAX_CONCURRENCY, uncached.length) }, () => worker())
        );
      } catch {
        // Non-critical
      } finally {
        if (!cancelledRef.current) {
          hidePreloader();
          setReady(true);
        }
      }
    }

    preload();
    return () => {
      cancelledRef.current = true;
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
