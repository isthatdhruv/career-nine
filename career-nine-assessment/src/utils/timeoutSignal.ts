/**
 * Feature-safe AbortSignal timeout.
 *
 * AbortSignal.timeout() only exists on Chrome/Edge 103+, Firefox 100+,
 * Safari 15.4+ and is a runtime API the Vite build does not polyfill — on
 * older school machines calling it threw a synchronous TypeError BEFORE any
 * network I/O, permanently breaking the call site (including assessment
 * submission). Falls back to AbortController, or to no signal at all on
 * ancient browsers (request then simply has no client-side timeout).
 */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }
  return undefined;
}
