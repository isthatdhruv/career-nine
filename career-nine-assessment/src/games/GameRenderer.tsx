import React, { lazy, Suspense } from "react";

const JungleSpotGame = lazy(() => import('./JungleSpotGame').then(m => ({ default: m.JungleSpotGame })));
const RabbitPathGame = lazy(() => import('./RabbitPathGame').then(m => ({ default: m.RabbitPathGame })));
const HydroTubeGame = lazy(() => import('./HydroTubeGame').then(m => ({ default: m.HydroTubeGame })));

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

  return <Suspense fallback={<GameLoading />}>{renderGame()}</Suspense>;
}
