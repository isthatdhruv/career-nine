declare module 'webgazer' {
  interface GazeData {
    x: number;
    y: number;
  }

  type GazeListener = (data: GazeData | null, elapsedTime: number) => void;

  interface WebGazer {
    setGazeListener(listener: GazeListener): WebGazer;
    clearGazeListener(): WebGazer;
    begin(): Promise<WebGazer>;
    end(): void;
    pause(): void;
    resume(): void;
    isReady(): boolean;
    showVideoPreview(show: boolean): WebGazer;
    showPredictionPoints(show: boolean): WebGazer;
    showFaceOverlay(show: boolean): WebGazer;
    showFaceFeedbackBox(show: boolean): WebGazer;
    setRegression(type: string): WebGazer;
    setTracker(type: string): WebGazer;
    saveDataAcrossSessions(save: boolean): WebGazer;
    applyKalmanFilter(apply: boolean): WebGazer;
    getCurrentPrediction(): Promise<GazeData | null>;
    getVideoElementCanvas(): HTMLCanvasElement | null;
    params: {
      showVideoPreview: boolean;
      [key: string]: any;
    };
  }

  const webgazer: WebGazer;
  export default webgazer;
}
