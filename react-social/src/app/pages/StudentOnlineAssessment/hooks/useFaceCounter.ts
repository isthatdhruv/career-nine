import { useEffect, useRef } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const DETECTION_INTERVAL_MS = 4000; // count faces every 4 seconds

interface UseFaceCounterParams {
  videoElement: React.MutableRefObject<HTMLVideoElement | null>;
}

interface UseFaceCounterReturn {
  faceCount: React.MutableRefObject<number>;
}

export function useFaceCounter({ videoElement }: UseFaceCounterParams): UseFaceCounterReturn {
  const faceCountRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    let detector: FaceDetector | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        if (cancelled) return;

        detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });

        if (cancelled) {
          detector.close();
          return;
        }

        const detect = () => {
          if (cancelled || !detector) return;

          const video = videoElement.current;
          if (video && video.readyState >= 2) {
            try {
              const result = detector.detectForVideo(video, Date.now());
              faceCountRef.current = result.detections.length;
            } catch {
              // Detection can fail if video frame is not ready
            }
          }

          timeoutId = setTimeout(detect, DETECTION_INTERVAL_MS);
        };

        // Wait a bit for WebGazer's video to be ready before starting detection
        timeoutId = setTimeout(detect, 2000);
      } catch (err) {
        console.warn('Face counter init failed:', err);
        // Fall back: face count stays at 0 (non-blocking)
      }
    };

    init();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (detector) {
        try {
          detector.close();
        } catch {
          // Already closed
        }
      }
    };
  }, [videoElement]);

  return { faceCount: faceCountRef };
}
