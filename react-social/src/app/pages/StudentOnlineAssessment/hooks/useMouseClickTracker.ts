import { useEffect, useRef } from 'react';
import { MouseClickRecord } from '../types/proctoring';

interface UseMouseClickTrackerReturn {
  clicks: React.MutableRefObject<MouseClickRecord[]>;
}

export function useMouseClickTracker(enabled: boolean = true): UseMouseClickTrackerReturn {
  const clicksRef = useRef<MouseClickRecord[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: MouseEvent) => {
      clicksRef.current.push({
        t: Date.now(),
        x: e.clientX,
        y: e.clientY,
      });
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [enabled]);

  return { clicks: clicksRef };
}
