import { useEffect, useRef } from 'react';
import http from '../api/http';

interface HeartbeatOptions {
  userStudentId: number | null;
  assessmentId: number | null;
  page: string;              // e.g. "question", "section-select", "instructions", "demographics"
  sectionName?: string;
  sectionId?: string;
  questionIndex?: string;
}

const HEARTBEAT_INTERVAL = 30_000; // 30s — well within the 60s Redis TTL

/**
 * Sends a lightweight heartbeat to the backend every 30s
 * so the admin live-tracking page knows which page this student is on.
 *
 * - Uses fire-and-forget POST (no retries, no error handling)
 * - Silently fails on network errors (doesn't affect assessment UX)
 * - Stops automatically when component unmounts
 */
export function useHeartbeat({ userStudentId, assessmentId, page, sectionName, sectionId, questionIndex }: HeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userStudentId || !assessmentId) return;

    const send = () => {
      const payload: Record<string, unknown> = {
        userStudentId,
        assessmentId,
        page,
      };
      if (sectionName) payload.sectionName = sectionName;
      if (sectionId) payload.sectionId = sectionId;
      if (questionIndex) payload.questionIndex = questionIndex;

      // Fire-and-forget: don't await, don't handle errors
      http.post('/assessments/heartbeat', payload).catch(() => {});
    };

    // Send immediately on mount/page change, then repeat
    send();
    intervalRef.current = setInterval(send, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userStudentId, assessmentId, page, sectionName, sectionId, questionIndex]);
}
