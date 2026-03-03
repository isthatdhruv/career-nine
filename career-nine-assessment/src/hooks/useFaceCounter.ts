import { useEffect } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const DETECTION_INTERVAL_MS = 1000; // count faces every 1 second

interface UseFaceCounterParams {
  videoElement: React.MutableRefObject<HTMLVideoElement | null>;
  faceCountRef: React.MutableRefObject<number>;
}

export function useFaceCounter({ videoElement, faceCountRef }: UseFaceCounterParams): void {

  useEffect(() => {
    let cancelled = false;
    let detector: FaceDetector | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let independentStream: MediaStream | null = null;
    let independentVideo: HTMLVideoElement | null = null;

    const init = async () => {
      try {
        // Start camera and MediaPipe loading in parallel for fastest startup
        const visionPromise = FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // Request camera immediately — don't wait for WebGazer
        // Browser reuses the permission grant, so WebGazer won't prompt again
        try {
          independentStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          });
          if (cancelled) {
            independentStream.getTracks().forEach((t) => t.stop());
            return;
          }
          independentVideo = document.createElement('video');
          independentVideo.srcObject = independentStream;
          independentVideo.setAttribute('playsinline', '');
          independentVideo.muted = true;
          await independentVideo.play();
        } catch {
          // Camera denied — will fall back to WebGazer's video when available
        }

        const vision = await visionPromise;
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

          // Prefer WebGazer's video if available, fall back to independent stream
          const video = videoElement.current || independentVideo;
          if (video && video.readyState >= 2) {
            try {
              const result = detector.detectForVideo(video, Date.now());
              faceCountRef.current = result.detections.length;
            } catch {
              // Detection can fail if video frame is not ready
            }
          }

          // Once WebGazer's video is available, stop the independent stream
          if (videoElement.current && independentStream) {
            independentStream.getTracks().forEach((t) => t.stop());
            independentStream = null;
            if (independentVideo) {
              independentVideo.srcObject = null;
              independentVideo = null;
            }
          }

          timeoutId = setTimeout(detect, DETECTION_INTERVAL_MS);
        };

        // Start detection as soon as possible
        detect();
      } catch (err) {
        console.warn('Face counter init failed:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (detector) {
        try { detector.close(); } catch { /* already closed */ }
      }
      if (independentStream) {
        independentStream.getTracks().forEach((t) => t.stop());
      }
      if (independentVideo) {
        independentVideo.srcObject = null;
      }
    };
  }, [videoElement, faceCountRef]);
}
