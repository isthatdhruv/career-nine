import { useEffect } from 'react';

/**
 * Hook to prevent page reload/close with a confirmation dialog.
 * @param enabled - Whether to enable the reload prevention (default: true)
 */
export const usePreventReload = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers require returnValue to be set
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
};
