import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

// Asset Paths
const SCENE_SRC = "/game-scenes/2nd/game-scene-2nd.png";
const RABBIT_SRC = "/game-scenes/2nd/rabbit-nobg.png";

// How to play video path - place video at: public/assets/game/rabbit-path-tutorial.mp4
const HOW_TO_PLAY_VIDEO_PATH = "/assets/game/rabbit-path-tutorial.mp4";

type Phase = "ready" | "show" | "input" | "feedback" | "paused" | "trial_done" | "done";

type StonePos = {
  id: number;
  xPct: number;
  yPct: number;
  rPct: number;
  rabbitScale?: number;
};

type RoundResult = {
  round: number;
  sequence: number[];
  input: number[];
  correct: boolean;
};

interface RabbitPathGameProps {
  userStudentId: string;
  playerName: string;
  onComplete: (data: any) => void;
  onExit: () => void;
}

const STONES: StonePos[] = [
  { id: 0, xPct: 21.4, yPct: 81.3, rPct: 4, rabbitScale: 3.5 },
  { id: 1, xPct: 47.1, yPct: 77.3, rPct: 4.8, rabbitScale: 2.1 },
  { id: 2, xPct: 36.2, yPct: 70.9, rPct: 4, rabbitScale: 2.1 },
  { id: 3, xPct: 53.3, yPct: 68, rPct: 4.4, rabbitScale: 2 },
  { id: 4, xPct: 43.9, yPct: 59.8, rPct: 4, rabbitScale: 1.8 },
  { id: 5, xPct: 69, yPct: 62.8, rPct: 3.5, rabbitScale: 1.4 },
  { id: 6, xPct: 58.5, yPct: 55.3, rPct: 3.9, rabbitScale: 1.5 },
  { id: 7, xPct: 76.3, yPct: 56, rPct: 3.1, rabbitScale: 1.5 },
  { id: 8, xPct: 67.8, yPct: 50.6, rPct: 3.1, rabbitScale: 1.5 },
  { id: 9, xPct: 82.5, yPct: 51, rPct: 2.3, rabbitScale: 0.9 },
  { id: 10, xPct: 74.7, yPct: 49, rPct: 2, rabbitScale: 1 },
  { id: 11, xPct: 81.6, yPct: 40.5, rPct: 4, rabbitScale: 0 }
];

const ROUND_SHOW_MS = 10_000;
const ROUND_INPUT_MS = 20_000;
const BUFFER_MS = 10_000;
const GAME_MAX_TIME_MS = 150_000;
const TOTAL_ROUNDS = 12;
const HOME_POS = { xPct: 21.4, yPct: 81.3 };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Grade 4 Sequence Generator
const generateClass4Sequence = (
  stones: StonePos[],
  roundIndex: number,
  history: RoundResult[],
  isTrial: boolean
): number[] => {
  let length = 4;

  if (!isTrial) {
    const set1Passed = history.filter(h => h.round >= 0 && h.round <= 3 && h.correct).length === 4;
    
    if (roundIndex >= 4) {
      if (set1Passed) length = 5;
    }
    
    if (roundIndex >= 8) {
      const set2Passed = history.filter(h => h.round >= 4 && h.round <= 7 && h.correct).length === 4;
      
      if (set1Passed && set2Passed) {
        length = 6;
      } else if (set1Passed && !set2Passed) {
        length = 5;
      } else {
        length = 4;
      }
    }
  }

  const validIds = stones.filter(s => s.id !== 0 && s.id !== 11).map(s => s.id);
  
  let candidates: number[] = [];
  let attempts = 0;
  while (attempts < 500) {
    const potential = shuffle(validIds).slice(0, length).sort((a, b) => a - b);
    
    let consecutivePairs = 0;
    for (let i = 0; i < potential.length - 1; i++) {
      if (potential[i + 1] === potential[i] + 1) consecutivePairs++;
    }
    
    let isValid = false;
    if (length === 6) {
      if (consecutivePairs <= 2) isValid = true;
    } else if (length === 5) {
      if (consecutivePairs <= 1) isValid = true;
    } else {
      if (consecutivePairs === 0) isValid = true;
    }
    
    if (isValid) {
      candidates = potential;
      break;
    }
    attempts++;
  }
  
  if (candidates.length === 0) {
    candidates = shuffle(validIds).slice(0, length).sort((a, b) => a - b);
  }
  
  return candidates;
};

export function RabbitPathGame({ userStudentId, playerName, onComplete, onExit }: RabbitPathGameProps) {
  // Flow states: Video -> Trial -> Main Game
  const [showHowToPlayVideo, setShowHowToPlayVideo] = useState(true); // Start with video (required)
  
  // Game State
  const [phase, setPhase] = useState<Phase>("ready");
  const [isTrial, setIsTrial] = useState(true);
  const [trialRound, setTrialRound] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [activeStone, setActiveStone] = useState<number | null>(null);
  const [bufferActivated, setBufferActivated] = useState(false);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [stonesState] = useState<StonePos[]>(STONES);

  // Rabbit State
  const [rabbitPos, setRabbitPos] = useState({ x: HOME_POS.xPct, y: HOME_POS.yPct });
  const [rabbitScale, setRabbitScale] = useState(1);
  const [rabbitVisible, setRabbitVisible] = useState(true);

  // Timer State
  const [phaseMsLeft, setPhaseMsLeft] = useState(0);
  const [gameMsLeft, setGameMsLeft] = useState(GAME_MAX_TIME_MS);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  
  // Refs
  const sequenceRef = useRef<number[]>([]);
  const inputRef = useRef<number[]>([]);
  const historyRef = useRef<RoundResult[]>([]);
  const timers = useRef<number[]>([]);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const startRoundRef = useRef<(nextRoundIndex: number) => void>(() => {});

  // Loading state for images
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload images
  useEffect(() => {
    const imageUrls = [SCENE_SRC, RABBIT_SRC];
    let loadedCount = 0;
    
    imageUrls.forEach(src => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === imageUrls.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === imageUrls.length) {
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const moveRabbitTo = useCallback((stoneId: number | null) => {
    if (stoneId === 0 || stoneId === null) {
      const startStone = stonesState.find(s => s.id === 0);
      if (startStone) {
        setRabbitPos({ x: startStone.xPct, y: startStone.yPct - 5 });
        setRabbitScale(startStone.rabbitScale ?? 1.2);
      } else {
        setRabbitPos({ x: HOME_POS.xPct, y: HOME_POS.yPct });
        setRabbitScale(1.2);
      }
      setRabbitVisible(true);
      return;
    }
    
    if (stoneId === 11) {
      const endStone = stonesState.find(s => s.id === 11);
      if (endStone) {
        setRabbitPos({ x: endStone.xPct, y: endStone.yPct - 5 });
        setRabbitScale(endStone.rabbitScale ?? 0);
        setRabbitVisible(true);
      }
      return;
    }

    const stone = stonesState.find(s => s.id === stoneId);
    if (stone) {
      setRabbitPos({ x: stone.xPct, y: stone.yPct - 5 });
      setRabbitScale(stone.rabbitScale ?? 1);
      setRabbitVisible(true);
    }
  }, [stonesState]);

  const handleNextRound = useCallback(() => {
    if (isTrial) {
      const nextTrialRound = trialRound + 1;
      if (nextTrialRound >= 2) {
        setPhase("trial_done");
        setPhaseMsLeft(0);
      } else {
        setTrialRound(nextTrialRound);
        // Start next trial round after a brief delay
        setTimeout(() => startRoundRef.current(nextTrialRound), 100);
      }
      return;
    }

    const nextRound = round + 1;
    if (nextRound >= TOTAL_ROUNDS) {
      setPhase("done");
      setPhaseMsLeft(0);
    } else {
      setRound(nextRound);
      // Start next round after a brief delay
      setTimeout(() => startRoundRef.current(nextRound), 100);
    }
  }, [isTrial, trialRound, round]);

  const evaluateAndAdvance = useCallback((input: number[], seq: number[]) => {
    const correct = input.length === seq.length && input.every((v, i) => v === seq[i]);
    setLastResult(correct ? "correct" : "wrong");

    if (correct) {
      if (!isTrial) setScore(s => s + 1);
      moveRabbitTo(11);
    }

    if (!isTrial) {
      const newResult = {
        round: round,
        sequence: seq,
        input: input,
        correct: correct
      };
      setHistory(prev => [...prev, newResult]);
      historyRef.current = [...historyRef.current, newResult];
    }

    clearTimers();
    
    if (isTrial && !correct) {
      // Retry same trial round with a new sequence after showing feedback
      timers.current.push(window.setTimeout(() => {
        // Restart the same trial round (trialRound stays the same)
        startRoundRef.current(trialRound);
      }, 1500));
    } else {
      timers.current.push(window.setTimeout(() => handleNextRound(), correct ? 1000 : 700));
    }
    
    setPhase("feedback");
  }, [isTrial, round, trialRound, moveRabbitTo, clearTimers, handleNextRound]);

  const finishAfterBuffer = useCallback(() => {
    setPhase(prev => {
      if (prev !== "input") return prev;
      evaluateAndAdvance(inputRef.current, sequenceRef.current);
      return "feedback";
    });
  }, [evaluateAndAdvance]);

  const finishInputAndScore = useCallback(() => {
    setPhase((prev) => {
      if (prev !== "input") return prev;

      const input = inputRef.current;
      const seq = sequenceRef.current;

      if (input.length === 0) {
        clearTimers();
        return "paused";
      }

      const isPartialCorrect = input.length > 0 && input.every((v, i) => v === seq[i]);
      if (isPartialCorrect && !bufferActivated) {
        setBufferActivated(true);
        setPhaseMsLeft(BUFFER_MS);
        timers.current.push(window.setTimeout(() => finishAfterBuffer(), BUFFER_MS));
        return "input";
      }

      evaluateAndAdvance(input, seq);
      return "feedback";
    });
  }, [bufferActivated, clearTimers, evaluateAndAdvance, finishAfterBuffer]);

  const startRound = useCallback((nextRoundIndex: number) => {
    clearTimers();
    setLastResult(null);
    setPlayerInput([]);
    inputRef.current = [];
    setBufferActivated(false);
    moveRabbitTo(0);

    const seq = generateClass4Sequence(stonesState, nextRoundIndex, historyRef.current, isTrial);
    setSequence(seq);
    sequenceRef.current = seq;

    setPhase("show");
    setPhaseMsLeft(ROUND_SHOW_MS);

    const stepMs = Math.floor(ROUND_SHOW_MS / (seq.length + 2));

    timers.current.push(window.setTimeout(() => moveRabbitTo(0), 100));

    seq.forEach((stoneId, idx) => {
      timers.current.push(window.setTimeout(() => {
        setActiveStone(stoneId);
        moveRabbitTo(stoneId);
      }, (idx + 1) * stepMs));
    });

    timers.current.push(window.setTimeout(() => {
      setActiveStone(null);
      moveRabbitTo(11);
    }, (seq.length + 1) * stepMs));

    timers.current.push(window.setTimeout(() => {
      setPhase("input");
      setPhaseMsLeft(ROUND_INPUT_MS);
      setActiveStone(null);
      moveRabbitTo(0);
    }, ROUND_SHOW_MS));

    timers.current.push(window.setTimeout(() => {
      finishInputAndScore();
    }, ROUND_SHOW_MS + ROUND_INPUT_MS));

    if (!isTrial) {
      setRound(nextRoundIndex);
    } else {
      setTrialRound(nextRoundIndex);
    }
  }, [clearTimers, moveRabbitTo, stonesState, isTrial, finishInputAndScore]);

  // Keep ref in sync with latest startRound function
  useEffect(() => {
    startRoundRef.current = startRound;
  }, [startRound]);

  const onStoneClick = useCallback((stoneId: number) => {
    if (phase !== "input") return;
    if (stoneId === 0 || stoneId === 11) return;

    moveRabbitTo(stoneId);
    const nextInput = [...inputRef.current, stoneId];
    inputRef.current = nextInput;
    setPlayerInput(nextInput);

    const idx = nextInput.length - 1;
    const seq = sequenceRef.current;

    if (stoneId !== seq[idx]) {
      evaluateAndAdvance(nextInput, seq);
    } else {
      if (nextInput.length === seq.length) {
        setTimeout(() => {
          evaluateAndAdvance(nextInput, seq);
        }, 500);
      }
    }
  }, [phase, moveRabbitTo, evaluateAndAdvance]);

  const handleContinueGame = useCallback(() => {
    setPhase("ready");
    setTimeout(() => startRoundRef.current(round), 50);
  }, [round]);

  // Handle video completion - move to trial mode
  const handleVideoComplete = useCallback(() => {
    setShowHowToPlayVideo(false);
  }, []);

  const handleGameControl = useCallback(() => {
    if (phase === "ready") {
      if (isTrial) {
        startRoundRef.current(0);
      } else {
        setGameMsLeft(GAME_MAX_TIME_MS);
        startRoundRef.current(0);
      }
    } else {
      clearTimers();
      setIsTrial(true);
      setPhase("ready");
      setRound(0);
      setTrialRound(0);
      setScore(0);
      setSequence([]);
      sequenceRef.current = [];
      setPlayerInput([]);
      inputRef.current = [];
      setActiveStone(null);
      moveRabbitTo(0);
      setPhaseMsLeft(0);
      setGameMsLeft(GAME_MAX_TIME_MS);
      setHistory([]);
      historyRef.current = [];
    }
  }, [phase, isTrial, clearTimers, moveRabbitTo]);

  // Phase countdown
  useEffect(() => {
    if (phase !== "show" && phase !== "input") return;
    const tick = window.setInterval(() => setPhaseMsLeft(ms => Math.max(0, ms - 100)), 100);
    return () => window.clearInterval(tick);
  }, [phase]);

  // Global game timer
  useEffect(() => {
    if (phase === "ready" || phase === "done" || phase === "trial_done" || isTrial) return;
    const interval = window.setInterval(() => {
      setGameMsLeft(prev => {
        if (prev <= 100) {
          setPhase("done");
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [phase, isTrial]);

  // Save results on done
  useEffect(() => {
    if (phase === "done") {
      const gameData = {
        userStudentId,
        playerName,
        score,
        totalRounds: TOTAL_ROUNDS,
        roundsPlayed: round + 1,
        history,
        timestamp: new Date().toISOString(),
        gameType: 'rabbit-path'
      };
      console.log("Rabbit Path game completed:", gameData);
      onComplete(gameData);
    }
  }, [phase, score, round, history, userStudentId, playerName, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const phaseLabel = useMemo(() => {
    if (phase === "ready") return "Ready";
    if (phase === "show") return "Watch carefully";
    if (phase === "input") return "Your turn";
    if (phase === "feedback") return lastResult === "correct" ? "Correct!" : "Oops!";
    if (phase === "done") return "Finished";
    return "";
  }, [phase, lastResult]);

  const phaseSecondsLeft = Math.ceil(phaseMsLeft / 1000);
  const progressPercent = ((round + 1) / TOTAL_ROUNDS) * 100;

  // Loading Screen
  if (!imagesLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f33 50%, #1a2d47 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid #3b82f6',
            borderTopColor: '#93c5fd',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '24px',
          }} />
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#93c5fd', letterSpacing: '2px' }}>
            Preparing Adventure...
          </p>
          <p style={{ color: 'rgba(147, 197, 253, 0.6)', fontSize: '14px', marginTop: '8px' }}>
            Loading river crossing
          </p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // How To Play Video Screen - shown first (required)
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
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f33 50%, #1a2d47 100%)',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.9), rgba(15, 31, 51, 0.95))',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px' }}>🎬</span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#93c5fd', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              How To Play
            </h1>
          </div>
          
          <p style={{ color: '#60a5fa', fontSize: '14px', marginBottom: '20px' }}>
            Watch this short tutorial before starting, {playerName}!
          </p>

          {/* Video Container */}
          <div
            style={{
              background: '#000',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '20px',
              border: '3px solid rgba(59, 130, 246, 0.4)',
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
            background: 'rgba(59, 130, 246, 0.2)', 
            borderRadius: '12px', 
            padding: '12px 16px', 
            marginBottom: '20px',
            border: '1px solid rgba(59, 130, 246, 0.3)' 
          }}>
            <p style={{ color: '#93c5fd', fontSize: '13px' }}>
              🐰 Watch the rabbit hop on stones, then repeat the sequence!<br />
              <span style={{ color: 'rgba(147, 197, 253, 0.8)' }}>After the video: <strong>2 practice rounds</strong> → <strong>{TOTAL_ROUNDS} main rounds</strong></span>
            </p>
          </div>

          <button
            onClick={handleVideoComplete}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 700,
              color: '#0f1f33',
              background: 'linear-gradient(to right, #60a5fa, #3b82f6, #60a5fa)',
              border: '2px solid rgba(147, 197, 253, 0.5)',
              borderRadius: '14px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
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
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f33 30%, #071520 50%, #1a2d47 75%, #0f1f33 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '16px',
    }}>
      {/* Pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30 Z' fill='none' stroke='%233b82f6' stroke-width='1'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
      }} />

      {/* Progress Bar */}
      {!isTrial && phase !== "ready" && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '8px',
          background: 'linear-gradient(to right, #1e3a5f, #2d4a6f, #1e3a5f)',
          zIndex: 30,
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(to right, #3b82f6, #60a5fa, #3b82f6)',
            transition: 'width 0.3s ease-out',
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
          }} />
        </div>
      )}

      {/* Player Info - Top Left */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '16px',
        zIndex: 20,
        background: 'rgba(30, 58, 95, 0.9)',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: '20px' }}>🐰</span>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(147, 197, 253, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Explorer</div>
          <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: '14px' }}>{playerName}</div>
        </div>
      </div>

      {/* Status - Top Center */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        background: isTrial 
          ? 'linear-gradient(to bottom, rgba(234, 179, 8, 0.95), rgba(202, 138, 4, 0.95))'
          : 'linear-gradient(to bottom, rgba(30, 58, 95, 0.95), rgba(15, 31, 51, 0.95))',
        padding: '10px 24px',
        borderRadius: '14px',
        border: isTrial ? '2px solid rgba(253, 224, 71, 0.5)' : '2px solid rgba(59, 130, 246, 0.5)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: isTrial ? '#fde047' : '#60a5fa', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {isTrial ? 'Trial' : 'Round'}
          </span>
          <span style={{ color: isTrial ? '#fef08a' : '#93c5fd', fontWeight: 900, fontSize: '22px' }}>
            {isTrial ? trialRound + 1 : round + 1}
          </span>
          <span style={{ color: isTrial ? '#ca8a04' : '#3b82f6', fontWeight: 700, fontSize: '18px' }}>/</span>
          <span style={{ color: isTrial ? 'rgba(253, 224, 71, 0.7)' : 'rgba(147, 197, 253, 0.7)', fontWeight: 600, fontSize: '18px' }}>
            {isTrial ? 2 : TOTAL_ROUNDS}
          </span>
        </div>
      </div>

      {/* Controls - Top Right */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '16px',
        zIndex: 50,
        display: 'flex',
        gap: '10px',
        pointerEvents: 'auto',
      }}>
        <button
          onClick={handleGameControl}
          style={{
            background: 'linear-gradient(to bottom right, #2563eb, #1d4ed8)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          {phase === "ready" ? "🚀 Start" : "🔄 Restart"}
        </button>
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

      {/* Phase & Timer Info */}
      {(phase === "show" || phase === "input") && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: phase === "show" 
            ? 'linear-gradient(to right, rgba(234, 179, 8, 0.95), rgba(202, 138, 4, 0.95))'
            : 'linear-gradient(to right, rgba(22, 163, 74, 0.95), rgba(21, 128, 61, 0.95))',
          padding: '12px 32px',
          borderRadius: '16px',
          border: phase === "show" ? '2px solid rgba(253, 224, 71, 0.6)' : '2px solid rgba(74, 222, 128, 0.6)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '24px' }}>{phase === "show" ? "👀" : "👆"}</span>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>
                {phaseLabel}
              </p>
              <p style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>
                {phaseSecondsLeft}s
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <div
        ref={gameContainerRef}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '900px',
          userSelect: 'none',
        }}
      >
        {/* Game Frame */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f33 50%, #1a2d47 100%)',
          padding: '12px',
          borderRadius: '20px',
          boxShadow: '0 15px 50px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)',
          border: '4px solid #3b82f6',
        }}>
          {/* Inner Frame */}
          <div style={{
            background: 'linear-gradient(135deg, #0f1f33, #071520)',
            padding: '6px',
            borderRadius: '14px',
          }}>
            {/* Game Scene Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)',
            }}>
              {/* Background Scene */}
              <img
                src={SCENE_SRC}
                alt="Jungle river scene"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />

              {/* Rabbit */}
              <div
                style={{
                  position: 'absolute',
                  zIndex: 10,
                  width: '14%',
                  transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  pointerEvents: 'none',
                  left: `${rabbitPos.x}%`,
                  top: `${rabbitPos.y}%`,
                  transform: `translate(-50%, -50%) scale(${rabbitScale})`,
                  opacity: rabbitVisible ? 1 : 0,
                }}
              >
                <img
                  src={RABBIT_SRC}
                  alt="Rabbit"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))',
                  }}
                  draggable={false}
                />
              </div>

              {/* Stones */}
              {stonesState.map((s) => {
                const isActive = activeStone === s.id && phase === "show";
                const isClickable = phase === "input" && s.id !== 0 && s.id !== 11;
                const wasClicked = playerInput.includes(s.id);

                return (
                  <div
                    key={s.id}
                    style={{
                      position: 'absolute',
                      left: `${s.xPct}%`,
                      top: `${s.yPct}%`,
                      width: `${s.rPct * 2}%`,
                      height: `${s.rPct * 2}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <button
                      onClick={() => isClickable && onStoneClick(s.id)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: 'none',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        cursor: isClickable ? 'pointer' : 'default',
                        transform: isClickable ? 'scale(1)' : 'scale(1)',
                        boxShadow: isActive
                          ? '0 0 0 4px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.6)'
                          : wasClicked && phase !== 'show'
                          ? '0 0 0 4px rgba(255,255,255,0.3)'
                          : 'none',
                        background: isActive
                          ? 'rgba(255,255,255,0.25)'
                          : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (isClickable) {
                          (e.target as HTMLButtonElement).style.transform = 'scale(1.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                      }}
                      aria-label={`Stone ${s.id}`}
                    />
                  </div>
                );
              })}

              {/* Ready overlay */}
              {phase === "ready" && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                }}>
                  <div style={{
                    padding: '24px 32px',
                    borderRadius: '24px',
                    background: 'rgba(30, 58, 95, 0.95)',
                    border: '2px solid rgba(59, 130, 246, 0.4)',
                    textAlign: 'center',
                    maxWidth: '400px',
                  }}>
                    <span style={{ fontSize: '48px' }}>🐰</span>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#93c5fd', marginTop: '12px' }}>
                      Rabbit's Path
                    </h2>
                    <p style={{ color: 'rgba(147, 197, 253, 0.8)', fontSize: '14px', marginTop: '8px' }}>
                      Watch the rabbit jump on stones, then repeat the same sequence!
                    </p>
                    <button
                      onClick={handleGameControl}
                      style={{
                        marginTop: '20px',
                        padding: '12px 32px',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#0f1f33',
                        background: 'linear-gradient(to right, #60a5fa, #3b82f6)',
                        border: '2px solid rgba(147, 197, 253, 0.5)',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      {isTrial ? "Start Trial 🎯" : "Start Game 🚀"}
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback overlay */}
              {phase === "feedback" && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    padding: '20px 40px',
                    borderRadius: '20px',
                    background: lastResult === 'correct' 
                      ? 'rgba(22, 163, 74, 0.95)' 
                      : 'rgba(220, 38, 38, 0.95)',
                    border: lastResult === 'correct'
                      ? '3px solid rgba(74, 222, 128, 0.6)'
                      : '3px solid rgba(248, 113, 113, 0.6)',
                  }}>
                    <span style={{ fontSize: '48px' }}>{lastResult === 'correct' ? '✅' : '❌'}</span>
                  </div>
                </div>
              )}

              {/* Done overlay */}
              {phase === "done" && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                }}>
                  <div style={{
                    padding: '32px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95), rgba(15, 31, 51, 0.95))',
                    border: '2px solid rgba(59, 130, 246, 0.4)',
                    textAlign: 'center',
                    maxWidth: '400px',
                  }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      margin: '0 auto',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
                    }}>
                      <span style={{ fontSize: '40px' }}>🏆</span>
                    </div>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#93c5fd', marginTop: '16px' }}>
                      Game Complete!
                    </h2>
                    <p style={{ color: 'rgba(147, 197, 253, 0.8)', fontSize: '16px', marginTop: '8px' }}>
                      Well done, {playerName}!
                    </p>
                    
                    <div style={{
                      marginTop: '20px',
                      padding: '16px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      borderRadius: '12px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: 700, color: '#60a5fa' }}>{score}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(147, 197, 253, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Correct out of {TOTAL_ROUNDS}
                      </div>
                    </div>

                    <button
                      onClick={onExit}
                      style={{
                        marginTop: '20px',
                        padding: '12px 32px',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#0f1f33',
                        background: 'linear-gradient(to right, #60a5fa, #3b82f6)',
                        border: '2px solid rgba(147, 197, 253, 0.5)',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      Continue 🌟
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Paused Modal */}
      {phase === "paused" && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95), rgba(15, 31, 51, 0.95))',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            border: '3px solid rgba(234, 179, 8, 0.5)',
          }}>
            <span style={{ fontSize: '48px' }}>🧐</span>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fcd34d', marginTop: '12px' }}>
              Please Focus!
            </h2>
            <p style={{ color: 'rgba(253, 224, 71, 0.8)', fontSize: '14px', marginTop: '8px' }}>
              It seems you're distracted. Ready to try again?
            </p>
            <button
              onClick={handleContinueGame}
              style={{
                marginTop: '24px',
                padding: '12px 32px',
                fontSize: '16px',
                fontWeight: 700,
                color: '#1a2e05',
                background: 'linear-gradient(to right, #22c55e, #16a34a)',
                border: '2px solid rgba(74, 222, 128, 0.5)',
                borderRadius: '14px',
                cursor: 'pointer',
              }}
            >
              Continue Game
            </button>
          </div>
        </div>
      )}

      {/* Trial Complete Modal */}
      {phase === "trial_done" && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95), rgba(15, 31, 51, 0.95))',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
            border: '3px solid rgba(34, 197, 94, 0.5)',
          }}>
            <span style={{ fontSize: '48px' }}>🎉</span>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#4ade80', marginTop: '12px' }}>
              Trial Complete!
            </h2>
            <p style={{ color: 'rgba(134, 239, 172, 0.8)', fontSize: '14px', marginTop: '8px' }}>
              You've finished the practice rounds. Ready for the real game?
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setPhase("ready");
                  setTrialRound(0);
                  setIsTrial(true);
                  setTimeout(() => startRoundRef.current(0), 500);
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#374151',
                  background: 'linear-gradient(to right, #e5e7eb, #d1d5db)',
                  border: '2px solid rgba(156, 163, 175, 0.5)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                Retry Trial
              </button>
              <button
                onClick={() => {
                  setIsTrial(false);
                  setPhase("ready");
                  setRound(0);
                  setScore(0);
                  setHistory([]);
                  historyRef.current = [];
                  setTimeout(() => {
                    setGameMsLeft(GAME_MAX_TIME_MS);
                    startRoundRef.current(0);
                  }, 500);
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1a2e05',
                  background: 'linear-gradient(to right, #22c55e, #16a34a)',
                  border: '2px solid rgba(74, 222, 128, 0.5)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                Start Game 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
