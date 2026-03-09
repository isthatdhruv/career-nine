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
 * Count total unique questions answered from localStorage.
 * Covers all answer types: multiple-choice, ranking, and text.
 */
function countAnsweredQuestions(): number {
  const answered = new Set<string>();

  try {
    // Multiple-choice: { sectionId: { questionId: [optionIds] } }
    const mc = localStorage.getItem('assessmentAnswers');
    if (mc) {
      const parsed = JSON.parse(mc);
      for (const secId in parsed) {
        for (const qId in parsed[secId]) {
          if (Array.isArray(parsed[secId][qId]) && parsed[secId][qId].length > 0) {
            answered.add(qId);
          }
        }
      }
    }

    // Ranking: { sectionId: { questionId: { optionId: rank } } }
    const rank = localStorage.getItem('assessmentRankingAnswers');
    if (rank) {
      const parsed = JSON.parse(rank);
      for (const secId in parsed) {
        for (const qId in parsed[secId]) {
          if (Object.keys(parsed[secId][qId] || {}).length > 0) {
            answered.add(qId);
          }
        }
      }
    }

    // Text: { sectionId: { questionId: { inputIdx: text } } }
    const text = localStorage.getItem('assessmentTextAnswers');
    if (text) {
      const parsed = JSON.parse(text);
      for (const secId in parsed) {
        for (const qId in parsed[secId]) {
          const inputs = parsed[secId][qId] || {};
          const hasValue = Object.values(inputs).some(
            (v) => typeof v === 'string' && (v as string).trim().length > 0
          );
          if (hasValue) answered.add(qId);
        }
      }
    }
  } catch {
    // Silently fail — don't break assessment
  }

  return answered.size;
}

/**
 * Sends a lightweight heartbeat to the backend every 30s
 * so the admin live-tracking page knows which page this student is on.
 *
 * Includes live answeredCount from localStorage (not DB).
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
        answeredCount: countAnsweredQuestions(),
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
