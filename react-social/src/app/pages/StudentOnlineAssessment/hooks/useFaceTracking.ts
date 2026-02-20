import { useEffect, useRef } from 'react';
import { EyeGazeSnapshot } from '../types/proctoring';

// Throttle: store one gaze point every 250ms to avoid flooding memory.
// WebGazer calls the listener at ~60fps; we only need ~4 samples/sec.
const SAMPLE_INTERVAL_MS = 250;

interface UseEyeGazeTrackingReturn {
  snapshots: React.MutableRefObject<EyeGazeSnapshot[]>;
  videoElement: React.MutableRefObject<HTMLVideoElement | null>;
}

export function useEyeGazeTracking(): UseEyeGazeTrackingReturn {
  const snapshotsRef = useRef<EyeGazeSnapshot[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const webgazer = (await import('webgazer')).default;

        if (cancelled) return;

        // Configure WebGazer: hide all UI, enable Kalman filter for smoother predictions
        webgazer
          .showVideoPreview(false)
          .showPredictionPoints(false)
          .showFaceOverlay(false)
          .showFaceFeedbackBox(false)
          .applyKalmanFilter(true)
          .saveDataAcrossSessions(false)
          .setRegression('ridge');

        // Set gaze listener before begin() to capture from the start
        webgazer.setGazeListener(
          (data: { x: number; y: number } | null) => {
            if (cancelled) return;

            const now = Date.now();
            if (now - lastSampleTimeRef.current < SAMPLE_INTERVAL_MS) return;
            lastSampleTimeRef.current = now;

            if (data !== null) {
              snapshotsRef.current.push({
                t: now,
                x: Math.round(data.x),
                y: Math.round(data.y),
                faceDetected: true,
                faceCount: 1, // default; overridden by useFaceCounter via usePerQuestionProctoring
              });
            } else {
              snapshotsRef.current.push({
                t: now,
                x: null,
                y: null,
                faceDetected: false,
                faceCount: 0,
              });
            }
          }
        );

        await webgazer.begin();

        if (cancelled) {
          webgazer.end();
          return;
        }

        // Grab the video element WebGazer created so useFaceCounter can reuse it
        const webgazerVideo = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
        if (webgazerVideo) {
          videoElementRef.current = webgazerVideo;
        }

        // Hide any DOM elements WebGazer injected
        const elementsToHide = [
          'webgazerVideoContainer',
          'webgazerFaceFeedbackBox',
          'webgazerGazeDot',
          'webgazerFaceOverlay',
        ];
        elementsToHide.forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
      } catch (err) {
        // Webcam denied or WebGazer init failure — proctoring continues
        // without gaze data, matching existing graceful-degradation pattern.
        console.warn('Eye gaze tracking init failed:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      import('webgazer').then((mod) => {
        const webgazer = mod.default;
        try {
          webgazer.clearGazeListener();
          webgazer.end();
        } catch {
          // Already ended
        }
        // Clean up injected DOM elements
        ['webgazerVideoContainer', 'webgazerFaceFeedbackBox', 'webgazerGazeDot', 'webgazerFaceOverlay'].forEach(
          (id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
          }
        );
      });
    };
  }, []);

  return { snapshots: snapshotsRef, videoElement: videoElementRef };
}

// Backward-compatible export name
export { useEyeGazeTracking as useFaceTracking };
