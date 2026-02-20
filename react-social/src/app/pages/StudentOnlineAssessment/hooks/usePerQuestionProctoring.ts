import { useEffect, useRef, useCallback } from 'react';
import {
  PerQuestionData,
  EyeGazeSnapshot,
  MouseClickRecord,
  GazePoint,
  ElementRect,
  OptionRect,
} from '../types/proctoring';

const STORAGE_KEY = 'proctoring_per_question';

interface UsePerQuestionProctoringParams {
  questionnaireQuestionId: number | null;
  proctoringSnapshots: React.MutableRefObject<EyeGazeSnapshot[]>;
  proctoringClicks: React.MutableRefObject<MouseClickRecord[]>;
  faceCountRef: React.MutableRefObject<number>;
}

interface UsePerQuestionProctoringReturn {
  perQuestionData: React.MutableRefObject<Map<number, PerQuestionData>>;
  finalizeCurrentQuestion: () => void;
}

// Derive gaze direction from screen coordinates
function deriveGazeDirection(
  x: number | null,
  y: number | null,
  screenWidth: number,
  screenHeight: number
): GazePoint['gazeDirection'] {
  if (x === null || y === null) return 'unknown';

  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  // 25% of screen dimension as the "center" zone threshold
  const thresholdX = screenWidth * 0.25;
  const thresholdY = screenHeight * 0.25;

  const dx = x - centerX;
  const dy = y - centerY;

  // Check horizontal deviation first (matches old yaw-first priority)
  if (Math.abs(dx) > thresholdX) {
    return dx < 0 ? 'left' : 'right';
  }
  if (Math.abs(dy) > thresholdY) {
    return dy < 0 ? 'up' : 'down';
  }
  return 'center';
}

// Find the first option whose bounding box contains a gaze point
function computeFirstLookedOption(
  snapshots: EyeGazeSnapshot[],
  optionsRect: OptionRect[]
): number | null {
  if (optionsRect.length === 0) return null;

  for (const snap of snapshots) {
    if (snap.x === null || snap.y === null) continue;

    for (const opt of optionsRect) {
      if (
        snap.x >= opt.x &&
        snap.x <= opt.x + opt.width &&
        snap.y >= opt.y &&
        snap.y <= opt.y + opt.height
      ) {
        return opt.optionId;
      }
    }
  }

  return null; // gaze never entered any option bounding box
}

export function usePerQuestionProctoring({
  questionnaireQuestionId,
  proctoringSnapshots,
  proctoringClicks,
  faceCountRef,
}: UsePerQuestionProctoringParams): UsePerQuestionProctoringReturn {

  const perQuestionDataRef = useRef<Map<number, PerQuestionData>>(new Map());
  const questionStartTimeRef = useRef<number>(Date.now());
  const snapshotStartIndexRef = useRef<number>(0);
  const clickStartIndexRef = useRef<number>(0);
  const tabSwitchCountRef = useRef<number>(0);
  const prevQuestionIdRef = useRef<number | null>(null);
  // Store positions captured when the question STARTS (not at finalization)
  const capturedQuestionRectRef = useRef<ElementRect | null>(null);
  const capturedOptionsRectRef = useRef<OptionRect[]>([]);

  // Load persisted data on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as [number, PerQuestionData][];
        perQuestionDataRef.current = new Map(parsed);
      }
    } catch {
      // Ignore
    }
  }, []);

  const persistData = useCallback(() => {
    try {
      const entries = Array.from(perQuestionDataRef.current.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // localStorage full
    }
  }, []);

  // Capture element positions for the current question
  const capturePositions = useCallback(() => {
    let questionRect: ElementRect | null = null;
    const optionsRect: OptionRect[] = [];

    // Capture question text element position
    const questionEl = document.querySelector('[data-proctoring="question-text"]');
    if (questionEl) {
      const rect = questionEl.getBoundingClientRect();
      questionRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }

    // Capture each option element position
    const optionEls = document.querySelectorAll('[data-proctoring-option-id]');
    optionEls.forEach((el) => {
      const optionId = parseInt(el.getAttribute('data-proctoring-option-id') || '0');
      if (optionId) {
        const rect = el.getBoundingClientRect();
        optionsRect.push({
          optionId,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    return { questionRect, optionsRect };
  }, []);

  // Finalize data for the current question
  const finalizeCurrentQuestion = useCallback(() => {
    const qId = prevQuestionIdRef.current;
    if (qId === null) return;

    const now = Date.now();
    const startTime = questionStartTimeRef.current;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Get snapshots collected during this question
    const allSnapshots = proctoringSnapshots.current;
    const questionSnapshots = allSnapshots.slice(snapshotStartIndexRef.current);

    // Get clicks collected during this question
    const allClicks = proctoringClicks.current;
    const questionClicks = allClicks.slice(clickStartIndexRef.current);

    // Stamp each snapshot with the latest face count from MediaPipe
    const currentFaceCount = faceCountRef.current;
    const stampedSnapshots: EyeGazeSnapshot[] = questionSnapshots.map((s) => ({
      ...s,
      faceCount: s.faceDetected ? Math.max(s.faceCount, currentFaceCount) : 0,
    }));

    // Convert to backward-compatible GazePoint format
    const gazePoints: GazePoint[] = stampedSnapshots.map((s) => ({
      t: s.t,
      x: s.x,
      y: s.y,
      gazeDirection: deriveGazeDirection(s.x, s.y, screenW, screenH),
      faceDetected: s.faceDetected,
      faceCount: s.faceCount,
      // Legacy fields — no longer computed, kept for backward compat
      headYaw: null,
      headPitch: null,
    }));

    // Raw eye gaze points
    const eyeGazePoints: EyeGazeSnapshot[] = [...stampedSnapshots];

    // Face detection stats (from faceCount values)
    const faceCounts = stampedSnapshots.map((s) => s.faceCount);
    const maxFacesDetected = faceCounts.length > 0 ? Math.max(...faceCounts) : 0;
    const avgFacesDetected = faceCounts.length > 0
      ? faceCounts.reduce((sum, c) => sum + c, 0) / faceCounts.length
      : 0;

    // Head-away events: gaze is null (no face) or goes off-screen
    let headAwayCount = 0;
    let wasAway = false;
    for (const s of stampedSnapshots) {
      const isAway =
        !s.faceDetected ||
        s.x === null ||
        s.y === null ||
        s.x < 0 ||
        s.y < 0 ||
        s.x > screenW ||
        s.y > screenH;
      if (isAway && !wasAway) headAwayCount++;
      wasAway = isAway;
    }

    // Use positions captured when the question started (not now, since DOM may show next question)
    const questionRect = capturedQuestionRectRef.current;
    const optionsRect = capturedOptionsRectRef.current;

    // Compute which option the student looked at first
    const firstLookedOptionId = computeFirstLookedOption(stampedSnapshots, optionsRect);

    const data: PerQuestionData = {
      questionnaireQuestionId: qId,
      screenWidth: screenW,
      screenHeight: screenH,
      questionRect,
      optionsRect,
      gazePoints,
      eyeGazePoints,
      firstLookedOptionId,
      timeSpentMs: now - startTime,
      questionStartTime: startTime,
      questionEndTime: now,
      mouseClickCount: questionClicks.length,
      mouseClicks: questionClicks,
      maxFacesDetected,
      avgFacesDetected: Math.round(avgFacesDetected * 100) / 100,
      headAwayCount,
      tabSwitchCount: tabSwitchCountRef.current,
    };

    // Merge with existing data if student revisited this question
    const existing = perQuestionDataRef.current.get(qId);
    if (existing) {
      data.timeSpentMs = existing.timeSpentMs + data.timeSpentMs;
      data.questionStartTime = existing.questionStartTime; // keep original start
      data.mouseClickCount = existing.mouseClickCount + data.mouseClickCount;
      data.mouseClicks = [...existing.mouseClicks, ...data.mouseClicks];
      data.maxFacesDetected = Math.max(existing.maxFacesDetected, data.maxFacesDetected);
      data.headAwayCount = existing.headAwayCount + data.headAwayCount;
      data.tabSwitchCount = existing.tabSwitchCount + data.tabSwitchCount;
      data.gazePoints = [...existing.gazePoints, ...data.gazePoints];
      data.eyeGazePoints = [...existing.eyeGazePoints, ...data.eyeGazePoints];
      // Keep the FIRST firstLookedOptionId (from the initial visit)
      data.firstLookedOptionId = existing.firstLookedOptionId ?? data.firstLookedOptionId;
      // Recompute avg faces from merged gazePoints
      const allFaces = data.gazePoints.map((g) => g.faceCount);
      data.avgFacesDetected = allFaces.length > 0
        ? Math.round((allFaces.reduce((s, c) => s + c, 0) / allFaces.length) * 100) / 100
        : 0;
    }

    perQuestionDataRef.current.set(qId, data);
    persistData();
  }, [proctoringSnapshots, proctoringClicks, faceCountRef, capturePositions, persistData]);

  // Track tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current++;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // When question changes, finalize previous and start new
  useEffect(() => {
    if (questionnaireQuestionId === null) return;

    // Finalize the previous question if there was one
    if (prevQuestionIdRef.current !== null && prevQuestionIdRef.current !== questionnaireQuestionId) {
      finalizeCurrentQuestion();
    }

    // Start tracking new question
    prevQuestionIdRef.current = questionnaireQuestionId;
    questionStartTimeRef.current = Date.now();
    snapshotStartIndexRef.current = proctoringSnapshots.current.length;
    clickStartIndexRef.current = proctoringClicks.current.length;
    tabSwitchCountRef.current = 0;

    // Capture DOM positions after the new question renders
    // Use requestAnimationFrame to wait for the DOM to paint
    requestAnimationFrame(() => {
      const { questionRect, optionsRect } = capturePositions();
      capturedQuestionRectRef.current = questionRect;
      capturedOptionsRectRef.current = optionsRect;
    });

  }, [questionnaireQuestionId, finalizeCurrentQuestion, proctoringSnapshots, proctoringClicks, capturePositions]);

  return {
    perQuestionData: perQuestionDataRef,
    finalizeCurrentQuestion,
  };
}
