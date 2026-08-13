import React, { Suspense } from "react";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { showErrorToast } from "../utils/toast";

/**
 * The game bundles are the app's last genuinely conditional code-split: most
 * questionnaires contain no game at all, and each bundle is only reachable from
 * a game option inside a question. Everything on the core assessment path is a
 * static import (see App.tsx).
 */
const JungleSpotGame = lazyWithRetry(() => import('./JungleSpotGame').then(m => ({ default: m.JungleSpotGame })), 'JungleSpotGame');
const RabbitPathGame = lazyWithRetry(() => import('./RabbitPathGame').then(m => ({ default: m.RabbitPathGame })), 'RabbitPathGame');
const HydroTubeGame = lazyWithRetry(() => import('./HydroTubeGame').then(m => ({ default: m.HydroTubeGame })), 'HydroTubeGame');

interface GameRendererProps {
  gameCode: number;
  userStudentId: string;
  playerName: string;
  onComplete: (data: any) => void;
  onExit: () => void;
}

const GameLoading = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading game...</span>
    </div>
  </div>
);

/**
 * Local boundary so a game bundle that will not load cannot take the assessment
 * down with it.
 *
 * This is reached mid-assessment: answers for the current section live only in
 * React state between Redis snapshots, so bubbling up to AppErrorBoundary (and
 * its refresh CTA) could cost the student real work. Instead we toast and hand
 * control back to SectionQuestionPage via the existing onExit prop, which closes
 * the game overlay and returns the student to the question. The game option
 * stays unanswered and the launch button stays enabled, so it remains
 * replayable — the same contract as a game whose result failed to save.
 */
class GameLoadBoundary extends React.Component<
  { onFail: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[GameLoadBoundary] game bundle failed to load', error);
    showErrorToast(
      'The game could not be loaded. Please try launching it again — if it keeps failing, tell your invigilator.',
    );
    this.props.onFail();
  }

  render() {
    // Render nothing on failure: onFail has already unmounted this overlay.
    return this.state.failed ? null : this.props.children;
  }
}

export function GameRenderer({ gameCode, userStudentId, playerName, onComplete, onExit }: GameRendererProps) {
  const renderGame = () => {
    switch (gameCode) {
      case 101:
        return <JungleSpotGame userStudentId={userStudentId} playerName={playerName} onComplete={onComplete} onExit={onExit} />;
      case 102:
        return <RabbitPathGame userStudentId={userStudentId} playerName={playerName} onComplete={onComplete} onExit={onExit} />;
      case 103:
        return <HydroTubeGame userStudentId={userStudentId} playerName={playerName} onComplete={onComplete} onExit={onExit} />;
      default:
        return (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>Unknown Game</h2>
              <p style={{ color: '#4b5563', marginBottom: '1rem' }}>Game code <strong>{gameCode}</strong> is not recognized.</p>
              <button onClick={onExit} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Exit</button>
            </div>
          </div>
        );
    }
  };

  return (
    <GameLoadBoundary onFail={onExit}>
      <Suspense fallback={<GameLoading />}>{renderGame()}</Suspense>
    </GameLoadBoundary>
  );
}
