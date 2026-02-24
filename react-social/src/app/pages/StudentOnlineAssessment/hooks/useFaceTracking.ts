import { useEffect, useRef } from 'react';
import { EyeGazeSnapshot } from '../types/proctoring';

// Throttle: store one gaze point every 250ms to avoid flooding memory.
// WebGazer calls the listener at ~60fps; we only need ~4 samples/sec.
const SAMPLE_INTERVAL_MS = 250;

interface UseEyeGazeTrackingParams {
  faceCountRef: React.MutableRefObject<number>;
}

interface UseEyeGazeTrackingReturn {
  snapshots: React.MutableRefObject<EyeGazeSnapshot[]>;
  videoElement: React.MutableRefObject<HTMLVideoElement | null>;
}

export function useEyeGazeTracking({ faceCountRef }: UseEyeGazeTrackingParams): UseEyeGazeTrackingReturn {
  const snapshotsRef = useRef<EyeGazeSnapshot[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const webgazerReadyRef = useRef<boolean>(false);

  // Create face-only snapshots while WebGazer is still initializing.
  // This ensures questions answered before WebGazer is ready still have face count data.
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Stop once WebGazer's gaze listener takes over
      if (webgazerReadyRef.current) {
        clearInterval(intervalId);
        return;
      }

      const currentFaces = faceCountRef.current;
      snapshotsRef.current.push({
        t: Date.now(),
        x: null,
        y: null,
        faceDetected: currentFaces > 0,
        faceCount: currentFaces,
      });
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [faceCountRef]);

  // Initialize WebGazer for gaze tracking
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

            // Use real-time face count from MediaPipe (via shared faceCountRef)
            const currentFaces = faceCountRef.current;

            if (data !== null) {
              snapshotsRef.current.push({
                t: now,
                x: Math.round(data.x),
                y: Math.round(data.y),
                faceDetected: true,
                faceCount: Math.max(1, currentFaces), // at least 1 since WebGazer found a face
              });
            } else {
              snapshotsRef.current.push({
                t: now,
                x: null,
                y: null,
                faceDetected: currentFaces > 0, // MediaPipe may still see a face even when WebGazer can't predict gaze
                faceCount: currentFaces,
              });
            }
          }
        );

        await webgazer.begin();

        if (cancelled) {
          webgazer.end();
          return;
        }

        // Mark WebGazer as ready — stops the face-only snapshot interval
        webgazerReadyRef.current = true;

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

      // Immediately stop all camera MediaStream tracks (synchronous, reliable)
      if (videoElementRef.current && videoElementRef.current.srcObject) {
        const stream = videoElementRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoElementRef.current.srcObject = null;
      }

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
