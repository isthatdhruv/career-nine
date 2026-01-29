import { useState, useEffect, useCallback } from "react";

// How to play video path - place video at: public/assets/game/hydro-tube-tutorial.mp4
const HOW_TO_PLAY_VIDEO_PATH = "/assets/game/hydro-tube-tutorial.mp4";

interface HydroTubeGameProps {
  userStudentId: string;
  playerName: string;
  onComplete: (data: any) => void;
  onExit: () => void;
}

type Pattern = {
  id: number;
  name: string;
  tileTypes: Record<number, string>;
  solutions: number[][];
};

const patterns: Pattern[] = [
  {
    id: 0,
    name: "Pattern A",
    tileTypes: {
      1: "t-pipe", 2: "bend", 3: "bend", 4: "straight",
      5: "straight", 6: "bend", 7: "straight", 8: "bend",
      9: "bend", 10: "bend", 11: "straight", 12: "bend",
      13: "straight", 14: "bend", 15: "straight", 16: "bend",
    },
    solutions: [
      [270, 90, 0, 0, 0, 270, 90, 90, 0, 0, 90, 180, 0, 270, 90, 90],
      [270, 0, 0, 0, 0, 0, 0, 0, 270, 90, 0, 0, 0, 270, 90, 90]
    ]
  },
  {
    id: 1,
    name: "Pattern B",
    tileTypes: {
      1: "bend", 2: "bend", 3: "bend", 4: "straight",
      5: "bend", 6: "bend", 7: "bend", 8: "t-pipe",
      9: "bend", 10: "t-pipe", 11: "straight", 12: "bend",
      13: "straight", 14: "straight", 15: "bend", 16: "straight",
    },
    solutions: [
      [270, 90, 0, 0, 0, 180, 0, 0, 270, 0, 90, 90, 0, 0, 0, 0]
    ],
  },
  {
    id: 2,
    name: "Pattern C",
    tileTypes: {
      1: "t-pipe", 2: "bend", 3: "straight", 4: "bend",
      5: "straight", 6: "bend", 7: "t-pipe", 8: "straight",
      9: "bend", 10: "straight", 11: "bend", 12: "straight",
      13: "bend", 14: "straight", 15: "straight", 16: "bend",
    },
    solutions: [
      // rotations for tiles 1..16 (0/90/180/270)
      // [90, 180, 90, 270, 0, 90, 180, 0, 0, 90, 270, 0, 0, 180, 90, 90],
      [270, 90, 0, 0, 0, 270, 0, 0, 0, 90, 180, 0, 270, 90, 90, 90]

    ]
  }
];

export function HydroTubeGame({ userStudentId, playerName, onComplete, onExit }: HydroTubeGameProps) {
  // Flow states: Video -> Trial -> Main Game
  const [showHowToPlayVideo, setShowHowToPlayVideo] = useState(true);
  const [isTrial, setIsTrial] = useState(true);
  const [trialComplete, setTrialComplete] = useState(false);

  const [tileRotations, setTileRotations] = useState<Record<number, number>>({});
  const [isWon, setIsWon] = useState(false);
  const [patternId, setPatternId] = useState(0);
  const [completedPatterns, setCompletedPatterns] = useState<number[]>([]);
  const [lastClickedTile, setLastClickedTile] = useState<number | null>(null);
  const [consecutiveClicks, setConsecutiveClicks] = useState(0);
  const [aimlessRotations, setAimlessRotations] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [isInitialized, setIsInitialized] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const [curiousClicks, setCuriousClicks] = useState(0);
  const [highlightedTile, setHighlightedTile] = useState<number | null>(null);

  const [tilesCorrect, setTilesCorrect] = useState(0);
  const [totalSolutionTiles, setTotalSolutionTiles] = useState(16);

  const currentPattern = patterns[patternId];

  // Initialize: Trial uses Pattern C (id: 2), Main game uses random patterns
  useEffect(() => {
    if (isTrial) {
      // Trial mode: use Pattern C (id: 2)
      setPatternId(2);
    } else {
      // Main game: use random pattern (excluding pattern C used in trial)
      const availablePatterns = patterns.filter(p => p.id !== 2);
      const randomIndex = Math.floor(Math.random() * availablePatterns.length);
      setPatternId(availablePatterns[randomIndex].id);
    }
    setIsInitialized(true);
  }, [isTrial]);

  useEffect(() => {
    // Don't run timer during video or trial mode
    if (!isInitialized || showHowToPlayVideo || isTrial) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const nextTime = prev - 1;

        if (nextTime === 135 || nextTime === 90 || nextTime === 45) {
          const randomTile = Math.floor(Math.random() * 16) + 1;
          setHighlightedTile(randomTile);
          setTimeout(() => setHighlightedTile(null), 5000);
        }

        if (prev <= 1) {
          clearInterval(timer);
          setGameEnded(true);
          return 0;
        }
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInitialized]);

  useEffect(() => {
    if (!gameEnded) return;

    const gameData = {
      userStudentId,
      playerName,
      patternsCompleted: completedPatterns.length,
      totalPatterns: 2,
      aimlessRotations,
      curiousClicks,
      tilesCorrect,
      totalTiles: totalSolutionTiles,
      timeSpentSeconds: 180 - timeLeft,
      timestamp: new Date().toISOString(),
      gameType: 'hydro-tube'
    };

    console.log("Hydro tube game data:", gameData);
    onComplete(gameData);
  }, [gameEnded, completedPatterns.length, aimlessRotations, curiousClicks, tilesCorrect, totalSolutionTiles, timeLeft, userStudentId, playerName, onComplete]);

  const checkWin = useCallback((currentRotations: Record<number, number>): boolean => {
    const playerRotations = Array.from({ length: 16 }, (_, i) => currentRotations[i + 1] || 0);
    return currentPattern.solutions.some((solution) =>
      solution.every((solRot, i) => {
        const playerRotation = playerRotations[i];
        return solRot === 0 || solRot === playerRotation;
      })
    );
  }, [currentPattern.solutions]);

  const calculateProgress = useCallback((currentRotations: Record<number, number>): { correct: number; total: number } => {
    const playerRotations = Array.from({ length: 16 }, (_, i) => currentRotations[i + 1] || 0);

    let bestCorrectCount = 0;

    currentPattern.solutions.forEach((solution) => {
      let correctCount = 0;
      solution.forEach((solRot, i) => {
        const playerRotation = playerRotations[i];
        if (solRot === 0 || solRot === playerRotation) {
          correctCount++;
        }
      });
      if (correctCount > bestCorrectCount) {
        bestCorrectCount = correctCount;
      }
    });

    return { correct: bestCorrectCount, total: 16 };
  }, [currentPattern.solutions]);

  const loadNextPattern = () => {
    if (isTrial) {
      // Trial complete - show trial complete screen
      setTrialComplete(true);
      setIsWon(false);
      return;
    }

    const newCompletedPatterns = [...completedPatterns, patternId];
    setCompletedPatterns(newCompletedPatterns);

    if (newCompletedPatterns.length >= 2) {
      setTilesCorrect(16);
      setGameEnded(true);
      return;
    }

    // Find next pattern (excluding pattern C which is used for trial)
    const availablePatterns = patterns.filter(p => p.id !== 2 && !newCompletedPatterns.includes(p.id));

    if (availablePatterns.length > 0) {
      setPatternId(availablePatterns[0].id);
      setTileRotations({});
      setIsWon(false);
      setLastClickedTile(null);
      setConsecutiveClicks(0);
      setHighlightedTile(null);
    }
  };

  // Handle video completion
  const handleVideoComplete = useCallback(() => {
    setShowHowToPlayVideo(false);
  }, []);

  // Start main game after trial
  const handleStartMainGame = useCallback(() => {
    setTrialComplete(false);
    setIsTrial(false);
    setTileRotations({});
    setIsWon(false);
    setLastClickedTile(null);
    setConsecutiveClicks(0);
    setHighlightedTile(null);
    setTimeLeft(180);
    setCompletedPatterns([]);
    // Reset main game stats
    setAimlessRotations(0);
    setCuriousClicks(0);
    setTilesCorrect(0);
  }, []);

  const handleTileClick = (tileNumber: number) => {
    if (isWon) return;

    // Only track curious clicks and aimless rotations during main game (not trial)
    if (!isTrial) {
      if (tileNumber === highlightedTile) {
        setCuriousClicks(prev => prev + 1);
        setHighlightedTile(null);
      }

      if (lastClickedTile === tileNumber) {
        const newConsecutiveClicks = consecutiveClicks + 1;
        setConsecutiveClicks(newConsecutiveClicks);
        if (newConsecutiveClicks === 4) {
          setAimlessRotations(prev => prev + 1);
          setConsecutiveClicks(0);
        }
      } else {
        setLastClickedTile(tileNumber);
        setConsecutiveClicks(1);
      }
    }

    setTileRotations((prev) => {
      const currentRotation = prev[tileNumber] || 0;
      const newRotation = (currentRotation + 90) % 360;
      const newState = { ...prev, [tileNumber]: newRotation };

      // Only track progress during main game
      if (!isTrial) {
        const progress = calculateProgress(newState);
        setTilesCorrect(progress.correct);
        setTotalSolutionTiles(progress.total);
      }

      if (checkWin(newState)) {
        setTimeout(() => setIsWon(true), 500);
      }
      return newState;
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const renderPipe = (type: string) => {
    if (type === "straight") {
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          <rect x="35" y="0" width="30" height="100" fill="#60a5fa" />
          <rect x="37" y="0" width="8" height="100" fill="#3b82f6" opacity="0.4" />
          <rect x="57" y="0" width="6" height="100" fill="#93c5fd" opacity="0.6" />
          <rect x="48" y="0" width="4" height="100" fill="#dbeafe" opacity="0.5" />
          <rect x="32" y="15" width="36" height="5" fill="#3b82f6" rx="2" />
          <rect x="32" y="47" width="36" height="5" fill="#3b82f6" rx="2" />
          <rect x="32" y="80" width="36" height="5" fill="#3b82f6" rx="2" />
        </svg>
      );
    } else if (type === "bend") {
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          <path d="M 35 100 L 35 50 Q 35 35 50 35 L 100 35 L 100 65 L 50 65 Q 65 65 65 50 L 65 100 Z" fill="#60a5fa" />
          <path d="M 39 100 L 39 50 Q 39 39 50 39 L 100 39" stroke="#3b82f6" strokeWidth="10" fill="none" opacity="0.4" />
          <path d="M 61 100 L 61 50 Q 61 46 65 46 L 100 46" stroke="#93c5fd" strokeWidth="8" fill="none" opacity="0.6" />
          <path d="M 48 100 L 48 50 Q 48 42 54 42 L 100 42" stroke="#dbeafe" strokeWidth="5" fill="none" opacity="0.5" />
          <rect x="32" y="82" width="36" height="5" fill="#3b82f6" rx="2" />
          <rect x="82" y="32" width="5" height="36" fill="#3b82f6" rx="2" />
        </svg>
      );
    } else if (type === "t-pipe") {
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          <rect x="35" y="50" width="30" height="50" fill="#60a5fa" />
          <rect x="0" y="35" width="100" height="30" fill="#60a5fa" />
          <circle cx="50" cy="50" r="22" fill="#3b82f6" />
          <circle cx="50" cy="50" r="18" fill="#60a5fa" />
          <rect x="37" y="50" width="8" height="50" fill="#3b82f6" opacity="0.4" />
          <rect x="0" y="37" width="100" height="8" fill="#3b82f6" opacity="0.4" />
          <rect x="57" y="50" width="6" height="50" fill="#93c5fd" opacity="0.6" />
          <rect x="0" y="57" width="100" height="6" fill="#93c5fd" opacity="0.6" />
          <circle cx="46" cy="46" r="10" fill="#93c5fd" opacity="0.5" />
          <circle cx="48" cy="48" r="6" fill="#dbeafe" opacity="0.6" />
          <rect x="32" y="80" width="36" height="5" fill="#3b82f6" rx="2" />
          <rect x="15" y="32" width="5" height="36" fill="#3b82f6" rx="2" />
          <rect x="80" y="32" width="5" height="36" fill="#3b82f6" rx="2" />
        </svg>
      );
    }
    return null;
  };

  const progressPercent = (completedPatterns.length / 2) * 100;

  // How To Play Video Screen
  if (showHowToPlayVideo) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 30%, #0369a1 50%, #0284c7 75%, #0ea5e9 100%)',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(12, 74, 110, 0.95), rgba(7, 89, 133, 0.95))',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '2px solid rgba(56, 189, 248, 0.3)',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px' }}>🎬</span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#7dd3fc', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              How To Play
            </h1>
          </div>

          <p style={{ color: '#38bdf8', fontSize: '14px', marginBottom: '20px' }}>
            Watch this short tutorial before starting, {playerName}!
          </p>

          {/* Video Container */}
          <div
            style={{
              background: '#000',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '20px',
              border: '3px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            }}
          >
            <video
              src={HOW_TO_PLAY_VIDEO_PATH}
              controls
              autoPlay
              style={{
                width: '100%',
                maxHeight: '300px',
                display: 'block',
              }}
              onEnded={handleVideoComplete}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Info Text */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <p style={{ color: '#7dd3fc', fontSize: '13px' }}>
              🚰 Rotate the pipes to connect the water flow!<br />
              <span style={{ color: 'rgba(186, 230, 253, 0.8)' }}>After the video: <strong>1 practice pattern</strong> → <strong>2 main patterns</strong></span>
            </p>
          </div>

          <button
            onClick={handleVideoComplete}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 700,
              color: '#0c4a6e',
              background: 'linear-gradient(to right, #38bdf8, #0ea5e9, #38bdf8)',
              border: '2px solid rgba(125, 211, 252, 0.5)',
              borderRadius: '14px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            I Understand, Start Practice!
            <span style={{ fontSize: '18px' }}>🎯</span>
          </button>
        </div>
      </div>
    );
  }

  // Trial Complete Screen
  if (trialComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 30%, #0369a1 50%, #0284c7 75%, #0ea5e9 100%)',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(12, 74, 110, 0.95), rgba(7, 89, 133, 0.95))',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '2px solid rgba(34, 197, 94, 0.4)',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Checkmark Icon */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(34, 197, 94, 0.3)',
              }}
            >
              <span style={{ fontSize: '40px' }}>✅</span>
            </div>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#4ade80', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Practice Complete!
          </h1>
          <p style={{ color: '#86efac', fontSize: '16px', marginBottom: '24px' }}>
            Great job solving Pattern C!
          </p>

          {/* Info about main game */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '24px',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <p style={{ color: '#7dd3fc', fontSize: '14px', fontWeight: 600 }}>
              🎮 Ready for the real challenge?<br />
              <span style={{ color: 'rgba(186, 230, 253, 0.8)', fontWeight: 400 }}>2 patterns await! You have 3 minutes.</span>
            </p>
          </div>

          <button
            onClick={handleStartMainGame}
            style={{
              width: '100%',
              padding: '16px 24px',
              fontSize: '18px',
              fontWeight: 700,
              color: '#0c4a6e',
              background: 'linear-gradient(to right, #38bdf8, #0ea5e9, #38bdf8)',
              border: '2px solid rgba(125, 211, 252, 0.5)',
              borderRadius: '14px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            Start Main Game
            <span style={{ fontSize: '20px' }}>💧</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 30%, #0369a1 50%, #0284c7 75%, #0ea5e9 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '16px',
    }}>
      {/* Pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='20' fill='none' stroke='%2338bdf8' stroke-width='2'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
      }} />

      {/* Floating water drops */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', fontSize: '48px', opacity: 0.3, animation: 'bounce 2s infinite' }}>💧</div>
      <div style={{ position: 'absolute', bottom: '15%', right: '8%', fontSize: '40px', opacity: 0.25, animation: 'bounce 2.5s infinite' }}>💧</div>

      {/* Progress Bar - only show during main game */}
      {!isTrial && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '8px',
          background: 'linear-gradient(to right, #0c4a6e, #075985, #0c4a6e)',
          zIndex: 30,
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(to right, #38bdf8, #7dd3fc, #38bdf8)',
            transition: 'width 0.3s ease-out',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
          }} />
        </div>
      )}

      {/* Player Info - Top Left */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '16px',
        zIndex: 20,
        background: 'rgba(12, 74, 110, 0.9)',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: '20px' }}>🚰</span>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(186, 230, 253, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Plumber</div>
          <div style={{ color: '#7dd3fc', fontWeight: 700, fontSize: '14px' }}>{playerName}</div>
        </div>
      </div>

      {/* Timer/Practice Badge - Top Center */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        background: isTrial
          ? 'linear-gradient(to bottom, rgba(234, 179, 8, 0.95), rgba(202, 138, 4, 0.95))'
          : timeLeft < 30
            ? 'linear-gradient(to bottom, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))'
            : 'linear-gradient(to bottom, rgba(12, 74, 110, 0.95), rgba(7, 89, 133, 0.95))',
        padding: '10px 24px',
        borderRadius: '14px',
        border: isTrial
          ? '2px solid rgba(253, 224, 71, 0.5)'
          : timeLeft < 30 ? '2px solid rgba(248, 113, 113, 0.5)' : '2px solid rgba(56, 189, 248, 0.5)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        {isTrial ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🎯</span>
            <span style={{ color: '#fef08a', fontWeight: 700, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Practice
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⏱️</span>
            <span style={{
              color: timeLeft < 30 ? '#fca5a5' : '#7dd3fc',
              fontWeight: 900,
              fontSize: '24px',
              animation: timeLeft < 30 ? 'pulse 1s infinite' : 'none'
            }}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {/* Controls - Top Right */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '16px',
        zIndex: 50,
        display: 'flex',
        gap: '10px',
      }}>
        <button
          onClick={onExit}
          style={{
            background: 'linear-gradient(to bottom right, #991b1b, #7f1d1d)',
            color: 'white',
            padding: '10px',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            cursor: 'pointer',
            fontSize: '18px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
          title="Exit"
        >
          ✕
        </button>
      </div>

      {/* Stats Cards - Left Side (only during main game) */}
      {!isTrial && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '16px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{
            background: 'rgba(12, 74, 110, 0.9)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(253, 230, 138, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Aimless Rotations</div>
            <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔄 {aimlessRotations}
            </div>
          </div>
          <div style={{
            background: 'rgba(12, 74, 110, 0.9)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(192, 132, 252, 0.4)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(216, 180, 254, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Curious Clicks</div>
            <div style={{ color: '#c084fc', fontWeight: 700, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✨ {curiousClicks}
            </div>
          </div>
          <div style={{
            background: 'rgba(12, 74, 110, 0.9)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(134, 239, 172, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Pattern</div>
            <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '16px' }}>
              {currentPattern.name}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(134, 239, 172, 0.6)', marginTop: '2px' }}>
              {completedPatterns.length}/2 Complete
            </div>
          </div>
        </div>
      )}

      {/* Practice Info Card - Left Side (only during trial) */}
      {isTrial && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '16px',
          zIndex: 20,
        }}>
          <div style={{
            background: 'rgba(12, 74, 110, 0.9)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(253, 224, 71, 0.4)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(253, 224, 71, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Practice Pattern</div>
            <div style={{ color: '#fef08a', fontWeight: 700, fontSize: '16px' }}>
              Pattern C
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(253, 224, 71, 0.6)', marginTop: '2px' }}>
              No time limit
            </div>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Tap SVG - positioned top-left of grid */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '-10px',
          zIndex: 15
        }}>
          <svg viewBox="0 0 120 150" style={{ width: '100px', height: '120px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
            <rect x="25" y="5" width="70" height="22" fill="#94a3b8" stroke="#64748b" strokeWidth="3" rx="11" />
            <circle cx="40" cy="16" r="5" fill="#cbd5e1" />
            <circle cx="80" cy="16" r="5" fill="#cbd5e1" />
            <ellipse cx="60" cy="50" rx="32" ry="28" fill="#e0f2fe" stroke="#bae6fd" strokeWidth="3" />
            <circle cx="50" cy="44" r="4" fill="#334155" />
            <circle cx="70" cy="44" r="4" fill="#334155" />
            <path d="M 48 56 Q 60 64 72 56" stroke="#334155" strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="48" y="15" width="24" height="18" fill="#60a5fa" stroke="#3b82f6" strokeWidth="3" rx="9" />
            <circle cx="60" cy="24" r="5" fill="#93c5fd" />
            <ellipse cx="54" cy="42" rx="14" ry="18" fill="#ffffff" opacity="0.5" />
            <path d="M 54 72 Q 54 82 60 92 Q 60 98 60 105" stroke="#bae6fd" strokeWidth="16" fill="none" strokeLinecap="round" />
            <path d="M 56 72 Q 56 82 60 92 Q 60 98 60 105" stroke="#e0f2fe" strokeWidth="12" fill="none" strokeLinecap="round" />
            <ellipse cx="60" cy="105" rx="10" ry="6" fill="#bae6fd" stroke="#93c5fd" strokeWidth="2" />
            <circle cx="60" cy="115" r="5" fill="#60a5fa" opacity="0.8">
              <animate attributeName="cy" values="115;125;135;145" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.6;0.4;0.2" dur="1.2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* Game Frame */}
        <div style={{
          position: 'relative',
          background: isWon
            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
            : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
          padding: '16px',
          borderRadius: '20px',
          boxShadow: isWon
            ? '0 15px 50px rgba(5, 150, 105, 0.5)'
            : '0 15px 50px rgba(0,0,0,0.4)',
          border: isWon ? '4px solid #10b981' : '4px solid #64748b',
          transition: 'all 0.5s ease',
        }}>
          {/* Win Overlay */}
          {isWon && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 150, 105, 0.9)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              borderRadius: '16px',
            }}>
              <span style={{ fontSize: '64px', marginBottom: '16px', animation: 'bounce 1s infinite' }}>🎉</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'white', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                Perfect Flow!
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px', marginBottom: '8px' }}>
                {currentPattern.name} Complete!
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '24px' }}>
                {completedPatterns.length + 1} of 2 patterns done
              </p>
              <button
                onClick={loadNextPattern}
                style={{
                  padding: '14px 32px',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#059669',
                  background: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                }}
              >
                {completedPatterns.length + 1 >= 2 ? "Finish! 🏆" : "Next Pattern 💧"}
              </button>
            </div>
          )}

          {/* Tile Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 80px)',
            gridTemplateRows: 'repeat(4, 80px)',
            gap: '4px',
          }}>
            {Array.from({ length: 16 }).map((_, index) => {
              const tileNumber = index + 1;
              const rotation = tileRotations[tileNumber] || 0;
              const pipeType = currentPattern.tileTypes[tileNumber];
              const isHighlighted = highlightedTile === tileNumber;

              return (
                <div
                  key={tileNumber}
                  onClick={() => handleTileClick(tileNumber)}
                  style={{
                    width: '80px',
                    height: '80px',
                    background: isHighlighted
                      ? 'linear-gradient(145deg, #fef3c7 0%, #fde68a 100%)'
                      : 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)',
                    cursor: isWon ? 'default' : 'pointer',
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    boxShadow: isHighlighted
                      ? 'inset 0 0 15px #f59e0b, 0 0 20px #f59e0b'
                      : 'inset 0 2px 6px rgba(0,0,0,0.08)',
                    border: isHighlighted
                      ? '3px solid #f59e0b'
                      : isWon
                        ? '2px solid #10b981'
                        : '1px solid #e2e8f0',
                    animation: isHighlighted ? 'pulse 1.5s infinite' : 'none',
                  }}
                >
                  {renderPipe(pipeType)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bucket SVG */}
        <div style={{ marginTop: '-10px', display: 'flex', justifyContent: 'flex-end', width: '100%', paddingRight: '20px' }}>
          <svg viewBox="0 0 150 160" style={{
            width: '100px',
            height: '110px',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            animation: isWon ? 'bounce 1s infinite' : 'none'
          }}>
            <path d="M 32 28 Q 75 6 118 28" stroke="#94a3b8" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="32" cy="28" r="6" fill="#64748b" stroke="#475569" strokeWidth="2" />
            <circle cx="118" cy="28" r="6" fill="#64748b" stroke="#475569" strokeWidth="2" />
            <path d="M 22 35 L 12 125 Q 12 142 28 148 L 122 148 Q 138 142 138 125 L 128 35 Z" fill="#f87171" stroke="#ef4444" strokeWidth="3" />
            <ellipse cx="75" cy="35" rx="56" ry="14" fill="#fca5a5" stroke="#f87171" strokeWidth="2" />
            <ellipse cx="75" cy="35" rx="50" ry="11" fill="#fecaca" />
            <ellipse cx="42" cy="75" rx="18" ry="40" fill="#fee2e2" opacity="0.7" />
            <circle cx="65" cy="70" r="4" fill="#7f1d1d" />
            <circle cx="85" cy="70" r="4" fill="#7f1d1d" />
            <path d="M 62 84 Q 75 92 88 84" stroke="#7f1d1d" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 28 105 L 20 130 Q 20 138 32 142 L 118 142 Q 130 138 130 130 L 122 105 Z" fill="#60a5fa" opacity="0.9" />
            <ellipse cx="75" cy="115" rx="38" ry="10" fill="#93c5fd" opacity="0.9" />
            <ellipse cx="75" cy="122" rx="32" ry="6" fill="#bfdbfe" opacity="0.7">
              <animate attributeName="rx" values="32;36;32" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0.4;0.7" dur="1.5s" repeatCount="indefinite" />
            </ellipse>
          </svg>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: inset 0 0 15px #f59e0b, 0 0 20px #f59e0b; }
          50% { transform: scale(1.05); box-shadow: inset 0 0 20px #f59e0b, 0 0 30px #f59e0b; }
          100% { transform: scale(1); box-shadow: inset 0 0 15px #f59e0b, 0 0 20px #f59e0b; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
