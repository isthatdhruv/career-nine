import { useEffect, useRef } from 'react';
import http from '../api/http';

interface HeartbeatOptions {
  userStudentId: number | null;
  assessmentId: number | null;
  page: string;              // e.g. "question", "section-select", "instructions", "demographics"
  sectionName?: string;
  sectionId?: string;
  questionIndex?: string;
  /**
   * Live answered-question count, supplied by the page from its in-memory
   * answer state. Answers live ONLY in React state + Redis (the localStorage
   * keys the old implementation counted are never written anymore, so it
   * permanently reported 0 and admins watched every student stuck at 0%).
   * A getter (not a value) so each beat reads the current count without the
   * options object changing identity on every answer.
   */
  answeredCount?: () => number;
}

const HEARTBEAT_INTERVAL = 30_000; // 30s — well within the 60s Redis TTL

/**
 * Sends a lightweight heartbeat to the backend every 30s
 * so the admin live-tracking page knows which page this student is on.
 *
 * - Strict 30s cadence: position changes (page/section/question) update a ref
 *   and ride the NEXT beat. The previous implementation re-ran the effect and
 *   fired a POST on every question navigation, multiplying heartbeat volume
 *   several-fold during active answering — each one paying the backend's
 *   per-request auth cost.
 * - Fire-and-forget POST (explicitly opted out of the axios retry interceptor)
 * - Silently fails on network errors (doesn't affect assessment UX)
 * - Stops automatically when component unmounts
 */
export function useHeartbeat({ userStudentId, assessmentId, page, sectionName, sectionId, questionIndex, answeredCount }: HeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Position + count getter live in a ref so the interval effect below does
  // NOT depend on them — beats stay on cadence across navigation.
  const positionRef = useRef({ page, sectionName, sectionId, questionIndex, answeredCount });
  positionRef.current = { page, sectionName, sectionId, questionIndex, answeredCount };

  useEffect(() => {
    if (!userStudentId || !assessmentId) return;

    const send = () => {
      const pos = positionRef.current;
      const payload: Record<string, unknown> = {
        userStudentId,
        assessmentId,
        page: pos.page,
        answeredCount: pos.answeredCount ? pos.answeredCount() : 0,
      };
      if (pos.sectionName) payload.sectionName = pos.sectionName;
      if (pos.sectionId) payload.sectionId = pos.sectionId;
      if (pos.questionIndex) payload.questionIndex = pos.questionIndex;

      // Fire-and-forget: don't await, don't handle errors, don't retry
      http.post('/assessments/heartbeat', payload, { __noRetry: true } as object).catch(() => {});
    };

    // Send immediately on mount, then strictly every 30s
    send();
    intervalRef.current = setInterval(send, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userStudentId, assessmentId]);
}
