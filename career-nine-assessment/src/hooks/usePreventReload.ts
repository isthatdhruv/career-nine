import { useEffect } from 'react';

/**
 * Set when the app itself is deliberately navigating/reloading (e.g. the
 * self-healing reload in lazyWithRetry after a stale-chunk failure). While set,
 * the beforeunload guard stays quiet so the student is not shown a native
 * "Leave site?" dialog for a recovery they never asked for.
 *
 * One-way for the lifetime of the document: everything that sets it is about to
 * replace the page anyway.
 */
let reloadSuppressed = false;

export function suppressPreventReload() {
  reloadSuppressed = true;
}

export const usePreventReload = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (reloadSuppressed) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
};
