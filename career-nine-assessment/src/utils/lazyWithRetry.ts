import { lazy, ComponentType } from 'react'

/**
 * Retrying wrapper around React.lazy, used ONLY for the three game bundles in
 * games/GameRenderer.tsx — the last genuinely conditional code-split in the app
 * (most questionnaires have no games at all).
 *
 * The assessment ROUTES are deliberately NOT code-split any more; see the
 * comment block in App.tsx for why. This helper therefore never reloads the
 * page: every remaining dynamic import fires MID-ASSESSMENT, where a reload
 * would destroy the in-memory answer state (answers live only in React state
 * plus the Redis partial snapshot). A game that will not load must fail softly
 * and stay replayable — GameRenderer's boundary handles that.
 *
 * Retry policy: 3 attempts with linear backoff. That covers a dropped packet or
 * a momentary WiFi stall on a venue network. It does NOT cover a stale build —
 * the static host is configured with `catchall_document: index.html`
 * (see .do/app.yaml), so a chunk removed by a redeploy returns HTTP 200 with
 * `Content-Type: text/html` rather than a 404, and every retry gets the same
 * HTML back. Only a fresh document fixes that, which is precisely why the
 * service worker must not swap builds under a live tab (vite.config.ts).
 */

const MAX_IMPORT_ATTEMPTS = 3

/**
 * Broad detection for "the module failed to load". Each engine words it
 * differently, and the MIME variant below is the one this deployment actually
 * produces when a hashed chunk no longer exists:
 *
 *   Failed to load module script: Expected a JavaScript module script but the
 *   server responded with a MIME type of text/html.
 */
export function isChunkLoadError(err: unknown): boolean {
  const msg =
    (err as { message?: string } | null)?.message ??
    (typeof err === 'string' ? err : '')
  if (!msg) return false
  return (
    /Failed to load module script/i.test(msg) ||        // stale chunk -> index.html (catchall)
    /dynamically imported module/i.test(msg) ||         // Chrome / Edge
    /error loading dynamically imported/i.test(msg) ||  // Firefox
    /Importing a module script failed/i.test(msg) ||    // Safari
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg)
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string,
) {
  return lazy(async () => {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= MAX_IMPORT_ATTEMPTS; attempt++) {
      try {
        return await factory()
      } catch (err) {
        lastError = err
        console.warn(
          `[chunk] ${chunkName} import failed (attempt ${attempt}/${MAX_IMPORT_ATTEMPTS})`,
          err,
        )
        if (attempt < MAX_IMPORT_ATTEMPTS) await sleep(400 * attempt)
      }
    }

    // Give up. The nearest error boundary decides what to do — for games that
    // means a toast plus a return to the question, never a page reload.
    throw lastError
  })
}
