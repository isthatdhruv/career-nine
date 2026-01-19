import { useEffect, useMemo, useRef, useState, useCallback } from "react";

interface JungleSpotGameProps {
  userStudentId: string;
  playerName: string;
  onComplete: (data: any) => void;
  onExit: () => void;
}

type AnimalType = "lion" | "elephant" | "rhino" | "deer" | "tiger";

const ANIMALS: AnimalType[] = ["lion", "elephant", "rhino", "deer", "tiger"];
const TOTAL_TRIALS = 120;
const TRIAL_MS = 1000; // 1 second per trial
const IMAGES_PER_ANIMAL = 5;
const PER_ANIMAL = TOTAL_TRIALS / ANIMALS.length; // 24

type Trial = {
  animal: AnimalType;
};

type Score = {
  hits: number;
  misses: number;
  falsePositives: number;
  hitRTs: number[]; // ms
};

function getImageSrc(animal: AnimalType) {
  return `/assets/game/${animal}.webp`;
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pre-create image elements for instant switching
const imageCache = new Map<string, HTMLImageElement>();

export function JungleSpotGame({ userStudentId, playerName, onComplete, onExit }: JungleSpotGameProps) {
  const [ready, setReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [trialIndex, setTrialIndex] = useState(-1);
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [showFlash, setShowFlash] = useState(false); // White flash between trials

  const [score, setScore] = useState<Score>({
    hits: 0,
    misses: 0,
    falsePositives: 0,
    hitRTs: [],
  });

  // Trials generated once
  const trials: Trial[] = useMemo(() => {
    const deck: Trial[] = [];
    for (const animal of ANIMALS) {
      for (let i = 0; i < PER_ANIMAL; i++) {
        deck.push({ animal });
      }
    }
    shuffleInPlace(deck);
    return deck.slice(0, TOTAL_TRIALS);
  }, []);

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const nextSwitchRef = useRef<number>(0);
  const currentTrialRef = useRef<Trial | null>(null);
  const currentIndexRef = useRef<number>(-1);
  const clickedThisTrialRef = useRef<boolean>(false);
  const onsetRef = useRef<number>(0);
  const hasStartedRef = useRef<boolean>(false);
  const scoreRef = useRef<Score>(score);

  // Preload all images into cache for instant display
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      const uniqueSrcs = ANIMALS.map(a => getImageSrc(a));
      
      await Promise.all(
        uniqueSrcs.map(
          (src) =>
            new Promise<void>((resolve) => {
              if (imageCache.has(src)) {
                resolve();
                return;
              }
              const img = new window.Image();
              img.onload = () => {
                imageCache.set(src, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = src;
            })
        )
      );

      if (!cancelled) setReady(true);
    };

    preload();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const endGame = useCallback(() => {
    stopLoop();

    const idx = currentIndexRef.current;
    if (idx >= 0 && idx < TOTAL_TRIALS) {
      const t = trials[idx];
      if (t?.animal === "lion" && !clickedThisTrialRef.current) {
        const s = scoreRef.current;
        const next: Score = { ...s, misses: s.misses + 1 };
        scoreRef.current = next;
        setScore(next);
      }
    }

    setGameOver(true);
  }, [stopLoop, trials]);

  const advanceTrial = useCallback(
    (now: number) => {
      const prevIdx = currentIndexRef.current;
      if (prevIdx >= 0 && prevIdx < TOTAL_TRIALS) {
        const prevTrial = trials[prevIdx];
        if (prevTrial.animal === "lion" && !clickedThisTrialRef.current) {
          const s = scoreRef.current;
          const next: Score = { ...s, misses: s.misses + 1 };
          scoreRef.current = next;
          setScore(next);
        }
      }

      const nextIdx = prevIdx + 1;
      if (nextIdx >= TOTAL_TRIALS) {
        endGame();
        return;
      }

      currentIndexRef.current = nextIdx;
      setTrialIndex(nextIdx);
      clickedThisTrialRef.current = false;
      
      const t = trials[nextIdx];
      currentTrialRef.current = t;
      setCurrentSrc(getImageSrc(t.animal));
      
      // Show white flash to indicate new trial
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 80);
      
      // Set onset time - accept ~50ms natural error from flash
      onsetRef.current = performance.now();
    },
    [trials, endGame]
  );

  const loop = useCallback(
    (now: number) => {
      if (gameOver) return;

      if (currentIndexRef.current === -1) {
        startRef.current = now;
        nextSwitchRef.current = now;
        advanceTrial(now);
        nextSwitchRef.current = now + TRIAL_MS;
      } else if (now >= nextSwitchRef.current) {
        while (now >= nextSwitchRef.current) {
          nextSwitchRef.current += TRIAL_MS;
        }
        advanceTrial(now);
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [advanceTrial, gameOver]
  );

  // start the loop once ready
  useEffect(() => {
    if (!ready) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    setGameOver(false);
    setScore({ hits: 0, misses: 0, falsePositives: 0, hitRTs: [] });
    scoreRef.current = { hits: 0, misses: 0, falsePositives: 0, hitRTs: [] };

    rafRef.current = requestAnimationFrame(loop);

    return () => stopLoop();
  }, [ready, loop, stopLoop]);

  const handleInput = useCallback(() => {
    if (!ready || gameOver) return;
    if (currentIndexRef.current < 0) return;
    if (clickedThisTrialRef.current) return;

    clickedThisTrialRef.current = true;

    const t = currentTrialRef.current;
    if (!t) return;

    const clickTime = performance.now();
    const rt = clickTime - onsetRef.current;

    const s = scoreRef.current;

    if (t.animal === "lion") {
      const next: Score = {
        ...s,
        hits: s.hits + 1,
        hitRTs: [...s.hitRTs, Math.round(Math.max(0, rt) * 100) / 100],
      };
      scoreRef.current = next;
      setScore(next);
    } else {
      const next: Score = { ...s, falsePositives: s.falsePositives + 1 };
      scoreRef.current = next;
      setScore(next);
    }
  }, [ready, gameOver]);

  // Spacebar support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown as any);
  }, [handleInput]);

  // Mouse/Touch click support - global listener for clicks anywhere on screen
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Don't trigger for button clicks (restart, exit, continue)
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }
      handleInput();
    };
    
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [handleInput]);

  // Store final results when game ends (don't call onComplete here - let user click button)
  const gameResultsRef = useRef<any>(null);
  
  useEffect(() => {
    if (!gameOver) return;

    const final = scoreRef.current;
    const lionsShown = trials.reduce(
      (acc, t) => acc + (t.animal === "lion" ? 1 : 0),
      0
    );

    // Store the results for when user clicks Continue
    gameResultsRef.current = {
      userStudentId,
      playerName,
      totalTrials: TOTAL_TRIALS,
      trialMs: TRIAL_MS,
      target: "lion",
      targetsShown: lionsShown,
      hits: final.hits,
      misses: final.misses,
      falsePositives: final.falsePositives,
      hitRTsMs: final.hitRTs,
      timestamp: new Date().toISOString(),
      gameType: 'jungle-spot'
    };

    console.log("Jungle Spot game completed:", gameResultsRef.current);
  }, [gameOver, trials, userStudentId, playerName]);

  const handleContinue = useCallback(() => {
    if (gameResultsRef.current) {
      console.log("Saving game results to Firestore...");
      onComplete(gameResultsRef.current);
    } else {
      onComplete({ error: "No game results available" });
    }
  }, [onComplete]);

  const handleRestart = () => window.location.reload();

  // Loading Screen
  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d3320 0%, #071a0f 50%, #0a1f14 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              border: '4px solid #166534',
              borderTopColor: '#fbbf24',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '24px',
            }}
          />
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24', letterSpacing: '2px' }}>
            Entering the Jungle...
          </p>
          <p style={{ color: 'rgba(134, 239, 172, 0.6)', fontSize: '14px', marginTop: '8px' }}>
            Preparing wildlife spotting
          </p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Game Over Screen
  if (gameOver) {
    const final = scoreRef.current;
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d3320 0%, #071a0f 50%, #0a1f14 100%)',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.9), rgba(6, 46, 35, 0.95))',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '2px solid rgba(251, 191, 36, 0.3)',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Trophy */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto',
                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(251, 191, 36, 0.3)',
              }}
            >
              <span style={{ fontSize: '40px' }}>🏆</span>
            </div>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Safari Complete!
          </h1>
          <p style={{ color: '#86efac', fontSize: '16px', marginBottom: '24px' }}>
            Well done, {playerName}!
          </p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(21, 128, 61, 0.4)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ade80' }}>{final.hits}</div>
              <div style={{ fontSize: '10px', color: 'rgba(134, 239, 172, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Lions Found</div>
            </div>
            <div style={{ background: 'rgba(146, 64, 14, 0.4)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24' }}>{final.misses}</div>
              <div style={{ fontSize: '10px', color: 'rgba(253, 230, 138, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Missed</div>
            </div>
            <div style={{ background: 'rgba(127, 29, 29, 0.4)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f87171' }}>{final.falsePositives}</div>
              <div style={{ fontSize: '10px', color: 'rgba(252, 165, 165, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>False Alarms</div>
            </div>
          </div>

          <button
            onClick={handleContinue}
            style={{
              width: '100%',
              padding: '16px 24px',
              fontSize: '18px',
              fontWeight: 700,
              color: '#1a2e05',
              background: 'linear-gradient(to right, #fbbf24, #f59e0b, #fbbf24)',
              border: '2px solid rgba(253, 230, 138, 0.5)',
              borderRadius: '14px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(251, 191, 36, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            Continue Adventure
            <span style={{ fontSize: '20px' }}>🌴</span>
          </button>
        </div>
      </div>
    );
  }

  const currentTrial = trialIndex >= 0 ? trials[trialIndex] : null;
  const progressPercent = ((trialIndex + 1) / TOTAL_TRIALS) * 100;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0d3320 0%, #0a1f14 30%, #071a0f 50%, #0d2818 75%, #0a1f14 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onPointerDown={handleInput}
    >
      {/* Jungle leaf texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.15,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30 Z' fill='none' stroke='%2322c55e' stroke-width='1'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
        }}
      />

      {/* Progress Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '8px',
          background: 'linear-gradient(to right, #78350f, #92400e, #78350f)',
          zIndex: 30,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(to right, #22c55e, #4ade80, #22c55e)',
            transition: 'width 0.3s ease-out',
            boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)',
          }}
        />
      </div>

      {/* Player Info - Top Left */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '16px',
          zIndex: 20,
          background: 'rgba(6, 78, 59, 0.9)',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        }}
      >
        <span style={{ fontSize: '20px' }}>🧭</span>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(134, 239, 172, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Explorer</div>
          <div style={{ color: '#fcd34d', fontWeight: 700, fontSize: '14px' }}>{playerName}</div>
        </div>
      </div>

      {/* Trial Counter - Top Center */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'linear-gradient(to bottom, rgba(146, 64, 14, 0.95), rgba(120, 53, 15, 0.95))',
          padding: '10px 24px',
          borderRadius: '14px',
          border: '2px solid rgba(251, 191, 36, 0.5)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '22px' }}>{Math.max(0, trialIndex + 1)}</span>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: '18px' }}>/</span>
          <span style={{ color: 'rgba(251, 191, 36, 0.7)', fontWeight: 600, fontSize: '18px' }}>{TOTAL_TRIALS}</span>
        </div>
      </div>

      {/* Controls - Top Right */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '16px',
          zIndex: 50,
          display: 'flex',
          gap: '10px',
          pointerEvents: 'auto',
        }}
      >
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            handleRestart();
          }}
          style={{
            background: 'linear-gradient(to bottom right, #15803d, #166534)',
            color: 'white',
            padding: '10px',
            borderRadius: '12px',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            cursor: 'pointer',
            fontSize: '18px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
          title="Restart"
        >
          🔄
        </button>
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onExit();
          }}
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

      {/* Main Game Area */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
          padding: '0 16px',
        }}
      >
        {/* Image Frame */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #b45309 0%, #92400e 50%, #78350f 100%)',
            padding: '12px',
            borderRadius: '20px',
            boxShadow: '0 15px 50px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)',
            border: '4px solid #d97706',
          }}
        >
          {/* Inner Frame */}
          <div
            style={{
              background: 'linear-gradient(135deg, #78350f, #451a03)',
              padding: '6px',
              borderRadius: '14px',
            }}
          >
            {/* Image Container - Square */}
            <div
              style={{
                width: '300px',
                height: '300px',
                background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              {/* Corner decorations */}
              <div style={{ position: 'absolute', top: '8px', left: '8px', width: '20px', height: '20px', borderLeft: '3px solid rgba(251, 191, 36, 0.4)', borderTop: '3px solid rgba(251, 191, 36, 0.4)', borderRadius: '4px 0 0 0' }} />
              <div style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', borderRight: '3px solid rgba(251, 191, 36, 0.4)', borderTop: '3px solid rgba(251, 191, 36, 0.4)', borderRadius: '0 4px 0 0' }} />
              <div style={{ position: 'absolute', bottom: '8px', left: '8px', width: '20px', height: '20px', borderLeft: '3px solid rgba(251, 191, 36, 0.4)', borderBottom: '3px solid rgba(251, 191, 36, 0.4)', borderRadius: '0 0 0 4px' }} />
              <div style={{ position: 'absolute', bottom: '8px', right: '8px', width: '20px', height: '20px', borderRight: '3px solid rgba(251, 191, 36, 0.4)', borderBottom: '3px solid rgba(251, 191, 36, 0.4)', borderRadius: '0 0 4px 0' }} />

              {/* Animal Image */}
              {currentSrc ? (
                <img
                  key={`${trialIndex}-${currentSrc}`}
                  src={currentSrc}
                  alt={currentTrial?.animal ?? "animal"}
                  style={{
                    width: '85%',
                    height: '85%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))',
                  }}
                  draggable={false}
                />
              ) : (
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid rgba(34, 197, 94, 0.3)',
                    borderTopColor: '#22c55e',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              )}

              {/* White flash overlay */}
              {showFlash && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '10px',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Instructions Below */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Instruction Card */}
          <div
            style={{
              background: 'linear-gradient(to right, rgba(120, 53, 15, 0.95), rgba(146, 64, 14, 0.95), rgba(120, 53, 15, 0.95))',
              padding: '16px 32px',
              borderRadius: '16px',
              border: '3px solid rgba(251, 191, 36, 0.6)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <span style={{ fontSize: '40px' }}>🦁</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(253, 230, 138, 0.9)', fontSize: '14px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
                  Spot the
                </p>
                <p style={{ color: '#fcd34d', fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  LION
                </p>
              </div>
              <span style={{ fontSize: '40px' }}>👆</span>
            </div>
          </div>

          {/* Secondary instruction */}
          <p style={{ color: 'rgba(134, 239, 172, 0.6)', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '3px' }}>
            Tap Screen or Press Space
          </p>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
