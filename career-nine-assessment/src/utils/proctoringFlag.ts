/**
 * Master proctoring kill-switch.
 *
 * Proctoring is the heaviest subsystem in the student app: two camera/ML
 * pipelines (WebGazer face-mesh inference per video frame + a MediaPipe face
 * counter), 4 gaze samples/sec accumulated for the whole session, multi-MB
 * uploads at submit time, and matching multi-MB Redis/MySQL load per student
 * on the backend. At 4000 concurrent students that load can threaten the
 * assessment itself.
 *
 * To disable ALL of it for an event:
 *   1. set `VITE_PROCTORING_ENABLED=false` in .env.production
 *   2. rebuild + redeploy the assessment frontend
 *
 * Default is ON (any value other than the literal string "false", including
 * the variable being absent, keeps proctoring enabled) so existing builds
 * and environments behave exactly as before.
 *
 * When OFF:
 *   - no camera permission prompt, no WebGazer, no MediaPipe face counter
 *   - no gaze/click collection, no per-question proctoring map, no
 *     localStorage persistence of proctoring data
 *   - no proctoring upload at submit time (the backend never sees a payload,
 *     which is the supported "no proctoring data" path)
 */
export const PROCTORING_ENABLED: boolean =
  import.meta.env.VITE_PROCTORING_ENABLED !== "false";
