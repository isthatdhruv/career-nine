// Raw eye-tracking data from WebGazer (replaces old FaceSnapshot)
export interface EyeGazeSnapshot {
  t: number;             // timestamp (ms since epoch)
  x: number | null;      // screen X coordinate (null = no face detected)
  y: number | null;      // screen Y coordinate (null = no face detected)
  faceDetected: boolean; // true if WebGazer returned data (non-null)
  faceCount: number;     // from MediaPipe face counter (0, 1, 2, ...)
}

// Mouse click record
export interface MouseClickRecord {
  t: number;           // timestamp (ms since epoch)
  x: number;           // clientX
  y: number;           // clientY
}

// Element bounding rect
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Option position with its ID
export interface OptionRect {
  optionId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Gaze point with screen coordinates + backward-compat legacy fields
export interface GazePoint {
  t: number;
  x: number | null;                    // screen X coordinate
  y: number | null;                    // screen Y coordinate
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';
  faceDetected: boolean;
  faceCount: number;
  // Legacy fields — kept for backward compatibility
  headYaw: number | null;
  headPitch: number | null;
}

// Per-question proctoring data
export interface PerQuestionData {
  questionnaireQuestionId: number;
  screenWidth: number;
  screenHeight: number;
  questionRect: ElementRect | null;
  optionsRect: OptionRect[];
  gazePoints: GazePoint[];                // backward-compat gaze data with derived direction
  eyeGazePoints: EyeGazeSnapshot[];      // raw screen coordinate gaze data
  firstLookedOptionId: number | null;     // first option the gaze entered
  timeSpentMs: number;
  questionStartTime: number;
  questionEndTime: number;
  mouseClickCount: number;
  mouseClicks: MouseClickRecord[];
  maxFacesDetected: number;
  avgFacesDetected: number;
  headAwayCount: number;
  tabSwitchCount: number;
}

// Full payload sent to backend
export interface ProctoringPayload {
  userStudentId: number;
  assessmentId: number;
  perQuestionData: PerQuestionData[];
}
