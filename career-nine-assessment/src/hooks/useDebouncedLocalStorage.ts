import { useRef, useCallback, useEffect } from 'react';

/**
 * Batches multiple localStorage writes into a single debounced write.
 * Instead of 7 separate useEffect->localStorage.setItem calls on every state change,
 * this collects all pending writes and flushes them together after a delay.
 */
export function useDebouncedLocalStorage(delayMs: number = 500) {
  const pendingWrites = useRef<Record<string, string>>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const writes = pendingWrites.current;
    pendingWrites.current = {};
    for (const [key, value] of Object.entries(writes)) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error(`Failed to write localStorage key "${key}":`, e);
        // On quota exceeded, try clearing non-critical keys to make space
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          try {
            // Remove the largest non-critical cached items first
            const expendable = ['assessmentSeenSectionInstructions', 'assessmentCompletedGames', 'assessmentSkipped', 'assessmentSavedForLater'];
            for (const k of expendable) {
              if (k !== key) localStorage.removeItem(k);
            }
            localStorage.setItem(key, value);
          } catch {
            // Last resort: try sessionStorage as fallback
            try { sessionStorage.setItem(key, value); } catch { /* truly out of space */ }
          }
        }
      }
    }
  }, []);

  const scheduleWrite = useCallback((key: string, value: string) => {
    pendingWrites.current[key] = value;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(flush, delayMs);
  }, [delayMs, flush]);

  // Flush on unmount to avoid losing data
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      flush();
    };
  }, [flush]);

  return { scheduleWrite, flush };
}
