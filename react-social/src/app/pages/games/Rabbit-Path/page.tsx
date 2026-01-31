"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameData } from "@/app/config/DataContext";

/**
 * Rabbit River Memory Game
 * Round:
 *  - SHOW (10s): highlight stones in sequence (5 stones)
 *  - INPUT (5s): player clicks stones in same order
 * Total: 15s per round
 * 3 minutes => 12 rounds
 */

// Asset Paths
const SCENE_SRC = "/game-scenes/2nd/game-scene-2nd.png";
const RABBIT_SRC = "/game-scenes/2nd/rabbit-nobg.png";

type Phase = "ready" | "show" | "input" | "feedback" | "paused" | "trial_done" | "done";

type StonePos = {
  id: number; // 1..9
  xPct: number; // 0..100
  yPct: number; // 0..100
  rPct: number; // radius as % of container width (rough)
  rabbitScale?: number; // Visual scale of rabbit at this stone (default 1)
};

const STONES: StonePos[] = [
  {
    "id": 0,
    "xPct": 21.4,
    "yPct": 81.3,
    "rPct": 4,
    "rabbitScale": 3.5
  },
  {
    "id": 1,
    "xPct": 47.1,
    "yPct": 77.3,
    "rPct": 4.8,
    "rabbitScale": 2.1
  },
  {
    "id": 2,
    "xPct": 36.2,
    "yPct": 70.9,
    "rPct": 4,
    "rabbitScale": 2.1
  },
  {
    "id": 3,
    "xPct": 53.3,
    "yPct": 68,
    "rPct": 4.4,
    "rabbitScale": 2
  },
  {
    "id": 4,
    "xPct": 43.9,
    "yPct": 59.8,
    "rPct": 4,
    "rabbitScale": 1.8
  },
  {
    "id": 5,
    "xPct": 69,
    "yPct": 62.8,
    "rPct": 3.5,
    "rabbitScale": 1.4
  },
  {
    "id": 6,
    "xPct": 58.5,
    "yPct": 55.3,
    "rPct": 3.9,
    "rabbitScale": 1.5
  },
  {
    "id": 7,
    "xPct": 76.3,
    "yPct": 56,
    "rPct": 3.1,
    "rabbitScale": 1.5
  },
  {
    "id": 8,
    "xPct": 67.8,
    "yPct": 50.6,
    "rPct": 3.1,
    "rabbitScale": 1.5
  },
  {
    "id": 9,
    "xPct": 82.5,
    "yPct": 51,
    "rPct": 2.3,
    "rabbitScale": 0.9
  },
  {
    "id": 10,
    "xPct": 74.7,
    "yPct": 49,
    "rPct": 2,
    "rabbitScale": 1
  },
 {
    "id": 11,
    "xPct": 81.6,
    "yPct": 40.5,
    "rPct": 4,
    "rabbitScale": 0
  }
];

const ROUND_SHOW_MS = 10_000;
const ROUND_INPUT_MS = 20_000;
const BUFFER_MS = 10_000;
const GAME_MAX_TIME_MS = 150_000; // 2m 30s Limit

const TOTAL_ROUNDS = 12; // Fixed limit as requested
const HOME_POS = { xPct: 21.4, yPct: 81.3 }; // Bottom Left Home (Matches Stone 0)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate a random subset of stones, sorted by ID (increasing order)
// Length increases with difficulty (roundIndex)
function generateSequence(stones: StonePos[], roundIndex: number): number[] {
  // Determine sequence length based on round
  // Round 0,1: 3 stones
  // Round 2,3: 4 stones
  // Round 4,5: 5 stones (e.g. 1,3,5,7,9)
  // Round 6+: 6+ stones
  const length = Math.min(Math.max(3, 3 + Math.floor(roundIndex / 2)), stones.length);
  
  // 1. Shuffle all PLAYABLE IDs (exclude 0 and 11) to pick random ones
  const allIds = stones.filter(s => s.id !== 0 && s.id !== 11).map(s => s.id);
  const randomSubset = shuffle(allIds).slice(0, length);
  
  // 2. Sort the subset to ensure "increasing order" (rabbit jumps forward)
  return randomSubset.sort((a, b) => a - b);
}

import { Suspense } from "react";

function GameContent() {
  // Video / Intro State
  const [showVideo, setShowVideo] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { saveRabbitPath, setStudentInfo } = useGameData();
  const searchParams = useSearchParams();
  const userName = searchParams.get("name") || "Explorer";
  const userClass = searchParams.get("class") || "";

  // Set student info on mount
  useEffect(() => {
    setStudentInfo(userName, userClass ? `Class ${userClass}` : "");
  }, [userName, userClass, setStudentInfo]);

  // Editor State
  const [stonesState, setStonesState] = useState<StonePos[]>(STONES);
  const [isEditing, setIsEditing] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
       setIsDev(true);
    }
  }, []);

  // Game State
  const [phase, setPhase] = useState<Phase>("ready");
  const [isTrial, setIsTrial] = useState(true);
  const [trialRound, setTrialRound] = useState(0); // 0 or 1
  const [round, setRound] = useState(0); // 0..TOTAL_ROUNDS
  const [score, setScore] = useState(0);

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [activeStone, setActiveStone] = useState<number | null>(null);
  const [bufferActivated, setBufferActivated] = useState(false);
  
  // Refs for State (needed for Timers/Closures to access latest values)
  const sequenceRef = useRef<number[]>([]);
  const inputRef = useRef<number[]>([]);

  // Load/Save from LocalStorage for persistence
  useEffect(() => {
      const saved = localStorage.getItem("rabbit-stones-config");
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              // Simple validation
              if (Array.isArray(parsed) && parsed.length > 0) {
                  // Migration: Ensure ID 11 (End) exists
                  const hasEnd = parsed.some((s: any) => s.id === 11);
                  if (!hasEnd) {
                      const endStone = STONES.find(s => s.id === 11);
                      if (endStone) parsed.push(endStone);
                  }
                  
                  // Migration: Ensure ID 0 (Start) exists
                  const hasStart = parsed.some((s: any) => s.id === 0);
                  if (!hasStart) {
                       const startStone = STONES.find(s => s.id === 0);
                       if (startStone) parsed.unshift(startStone);
                  }

                  setStonesState(parsed);
              }
          } catch (e) {
              console.error("Failed to load layout", e);
          }
      }
  }, []);

  // Save changes
  useEffect(() => {
      if (isEditing) {
          localStorage.setItem("rabbit-stones-config", JSON.stringify(stonesState));
      }
  }, [stonesState, isEditing]);

  // Rabbit Position State
  const [rabbitPos, setRabbitPos] = useState({ x: HOME_POS.xPct, y: HOME_POS.yPct });
  const [rabbitScale, setRabbitScale] = useState(1);
  const [rabbitVisible, setRabbitVisible] = useState(true);

  const [phaseMsLeft, setPhaseMsLeft] = useState(0);
  const [gameMsLeft, setGameMsLeft] = useState(GAME_MAX_TIME_MS);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);

  // Optional: show numbers on stones while tuning positions
  const [debugNumbers, setDebugNumbers] = useState(false);

  const timers = useRef<number[]>([]);
  const router = useRouter();

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const handleVideoEnd = () => {
    setVideoEnded(true);
  };

  const handleStartGameClick = () => {
    setShowVideo(false);
  };

  const moveRabbitTo = (stoneId: number | null) => {
      // If moving to Start (0), ensure visible and at home pos
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
      
      // If moving to End (11), move there then hide
      if (stoneId === 11) {
          const endStone = stonesState.find(s => s.id === 11);
          if (endStone) {
             setRabbitPos({ x: endStone.xPct, y: endStone.yPct - 5 });
             setRabbitScale(endStone.rabbitScale ?? 0);
             // We can let it be visible but scale 0 effectively hides it or small
             // But let's keep visible=false for safety too, or just rely on scale if user wants visual control?
             // User wants to SET final size, so maybe he wants it to shrink to nothing?
             // Let's keep visible true briefly to show it at "final size" then hide?
             // Or just let scale dictate visibility
             setRabbitVisible(true); 
          }
          return;
      }

      // Normal jump
      const stone = stonesState.find(s => s.id === stoneId);
      if (stone) {
          setRabbitPos({ x: stone.xPct, y: stone.yPct - 5 });
          setRabbitScale(stone.rabbitScale ?? 1);
          setRabbitVisible(true);
      }
  };

  const startRound = (nextRoundIndex: number) => {
    clearTimers();
    setLastResult(null);
    setPlayerInput([]);
    inputRef.current = []; // Reset Ref
    setBufferActivated(false);
    moveRabbitTo(0); // Start at 0th box

    const seq = generateSequence(stonesState, nextRoundIndex);
    setSequence(seq);
    sequenceRef.current = seq; // Update Ref

    // SHOW phase: highlight each of 5 stones evenly across 10s
    setPhase("show");
    setPhaseMsLeft(ROUND_SHOW_MS);

    // Full path: 0 -> [seq] -> 10
    // We animate jumping through sequence.
    // Time distribution:
    // We need time for each jump in sequence, plus final jump to 10.
    
    const stepMs = Math.floor(ROUND_SHOW_MS / (seq.length + 2)); // +2 for Start jump logic buffer and End jump
    
    // Initial delay before first jump
    timers.current.push(window.setTimeout(() => {
        // Just ensuring it's at 0
        moveRabbitTo(0);
    }, 100));

    seq.forEach((stoneId, idx) => {
      // Jump and Highlight Stone
      const t1 = window.setTimeout(() => {
        setActiveStone(stoneId);
        moveRabbitTo(stoneId);
      }, (idx + 1) * stepMs); // Start jumping AFTER initial pause
      
      timers.current.push(t1);
    });

    // Final Jump to Bushes (10)
    timers.current.push(
      window.setTimeout(() => {
          setActiveStone(null);
          moveRabbitTo(11); // Jump to bushes and disappear
      }, (seq.length + 1) * stepMs)
    );

    // Switch to INPUT phase after SHOW time
    timers.current.push(
      window.setTimeout(() => {
        setPhase("input");
        setPhaseMsLeft(ROUND_INPUT_MS);
        setActiveStone(null);
        moveRabbitTo(0); // Bring rabbit back to Start for player turn? Or keep hidden?
        // Usually player acts as the rabbit. Let's reset rabbit to 0 so it can jump on user clicks.
      }, ROUND_SHOW_MS)
    );

    // End INPUT after 5s, auto-check whatever is entered
    timers.current.push(
      window.setTimeout(() => {
        finishInputAndScore();
      }, ROUND_SHOW_MS + ROUND_INPUT_MS)
    );

    if (!isTrial) {
        setRound(nextRoundIndex);
    } else {
        setTrialRound(nextRoundIndex);
    }
  };

  const finishInputAndScore = () => {
    // Prevent double-finishes
    setPhase((prev) => {
      if (prev !== "input") return prev;

      const input = inputRef.current;
      const seq = sequenceRef.current;
      
      // TIMEOUT/BUFFER CHECK
      
      // Case A: No Input -> PAUSE
      if (input.length === 0) {
           clearTimers();
           return "paused";
      }

      // Case B: Partial Correct -> BUFFER (give +10s if not already buffered)
      const isPartialCorrect = input.length > 0 && input.every((v, i) => v === seq[i]);
      if (isPartialCorrect && !bufferActivated) {
          setBufferActivated(true);
          setPhaseMsLeft(BUFFER_MS);
          
          const bufferTimer = window.setTimeout(() => {
               finishAfterBuffer();   
          }, BUFFER_MS);
          
          timers.current.push(bufferTimer);
          return "input"; // Stay in input
      }

      // Case C: Standard Fail (Incorrect or Incomplete after buffer used)
      // Proceed to standard scoring (which will mark as wrong)
      
      // Case C: Standard Fail/Success
      const correct =
        input.length === seq.length &&
        input.every((v, i) => v === seq[i]);
        
      setLastResult(correct ? "correct" : "wrong");
      
      if (isTrial) {
           if (correct) {
              moveRabbitTo(11); 
           }
      } else {
          if (correct) {
              setScore((s) => s + 1);
              moveRabbitTo(11); 
          }
      }

      // Next round or done
      clearTimers();
      timers.current.push(
        window.setTimeout(() => {
            handleNextRound();
        }, (correct ? 1000 : 700)) 
      );

      return "feedback";
    });
  };

  const finishAfterBuffer = () => {
       setPhase(prev => {
           if (prev !== "input") return prev;
           // Time is TRULY up now.
           const input = inputRef.current;
           const seq = sequenceRef.current;
           const correct = input.length === seq.length && input.every((v, i) => v === seq[i]);
           
           setLastResult(correct ? "correct" : "wrong");
           
           if (correct) {
               if (!isTrial) setScore(s => s + 1);
               moveRabbitTo(11);
           }
           
           clearTimers();
           timers.current.push(window.setTimeout(() => handleNextRound(), correct ? 1000 : 700));
           return "feedback";
       });
  };
  
  const handleContinueGame = () => {
      // User clicked "Continue" on "Focus" modal
      setPhase("ready"); 
      // Restart current round with new sequence
      setTimeout(() => startRound(round), 50);
  };



  const handleNextRound = () => {
      // HANDLE TRIAL END
      if (isTrial) {
          setTrialRound(prev => {
              const next = prev + 1;
              if (next >= 2) {
                  // 2 Trials Done
                  setPhase("trial_done");
                  setPhaseMsLeft(0);
                  return prev;
              } else {
                   setTimeout(() => startRound(next), 0);
                   return next;
              }
          });
          return;
      }

      // GAME END
      setRound(prevRound => {
          const next = prevRound + 1;
          if (next >= TOTAL_ROUNDS) {
              setPhase("done");
              setPhaseMsLeft(0);
              return prevRound;
          } else {
              setTimeout(() => startRound(next), 0);
              return next;
          }
      });
  };

  const onStoneClick = (stoneId: number) => {
    if (phase !== "input" || isEditing) return;

    // Is clickable?
    if (stoneId === 0 || stoneId === 11) return;

    // Move Rabbit to clicked stone
    moveRabbitTo(stoneId);

    // Update Input State & Ref
    const nextInput = [...inputRef.current, stoneId];
    inputRef.current = nextInput;
    setPlayerInput(nextInput);

    // Logic Check
    const idx = nextInput.length - 1;
    const seq = sequenceRef.current;
    
    // Check Current Step
    if (stoneId !== seq[idx]) {
        // WRONG
        setLastResult("wrong");
        setPhase("feedback");
        clearTimers();
        timers.current.push(
            window.setTimeout(() => handleNextRound(), 700)
        );
    } else {
        // CORRECT so far
        if (nextInput.length === seq.length) {
            // SEQUENCE COMPLETE
            setLastResult("correct");
            setScore(s => s + 1);
            setPhase("feedback");
            moveRabbitTo(11); // Success -> Run to bushes!
            clearTimers();
            timers.current.push(
                window.setTimeout(() => handleNextRound(), 1000)
            );
        }
    }
  };

  // Editor Handlers
  const handleMouseDown = (e: React.MouseEvent, id: number) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingId(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isEditing || draggingId === null || !editorRef.current) return;
    
    const rect = editorRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newX = Number(x.toFixed(1));
    const newY = Number(y.toFixed(1));

    setStonesState(prev => prev.map(s => 
      s.id === draggingId ? { ...s, xPct: newX, yPct: newY } : s
    ));

    // Live update Rabbit visual if dragging
    setRabbitPos({ x: newX, y: newY - 5 });
    // Also ensure scale is correct for this stone (grab from current state)
    const s = stonesState.find(st => st.id === draggingId);
    if (s) setRabbitScale(s.rabbitScale ?? 1);
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const adjustRadius = (id: number, delta: number) => {
    setStonesState(prev => prev.map(s => {
        if (s.id !== id) return s;
        const newR = Math.max(1, Number((s.rPct + delta).toFixed(1)));
        return { ...s, rPct: newR };
    }));
  };

  const adjustRabbitScale = (id: number, delta: number) => {
    let newScale = 1;
    setStonesState(prev => prev.map(s => {
        if (s.id !== id) return s;
        const current = s.rabbitScale ?? 1;
        newScale = Math.max(0, Number((current + delta).toFixed(1)));
        return { ...s, rabbitScale: newScale };
    }));

    // Immediate visual feedback
    const stone = stonesState.find(s => s.id === id);
    if (stone) {
        setRabbitPos({ x: stone.xPct, y: stone.yPct - 5 });
        setRabbitScale(newScale);
        setRabbitVisible(true);
    }
  };

  // Phase countdown UI
  useEffect(() => {
    if (phase !== "show" && phase !== "input") return;

    const tick = window.setInterval(() => {
      setPhaseMsLeft((ms) => Math.max(0, ms - 100));
    }, 100);

    return () => window.clearInterval(tick);
  }, [phase]);

  // Save Results on Done
  useEffect(() => {
    if (phase === "done") {
        const save = async () => {
            try {
                await saveRabbitPath({
                    score: score,
                    totalRounds: TOTAL_ROUNDS,
                    roundsPlayed: round + 1,
                });
                console.log("Rabbit score saved");
            } catch(e) {
                console.error("Save failed", e);
            }
        };
        save();
    }
  }, [phase, score, round, saveRabbitPath]);

  // Cleanup
  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleGameControl = () => {
    if (phase === "ready") {
      // Start!
      if (isTrial) {
          startRound(0); // Start Trial Round 0
      } else {
          setGameMsLeft(GAME_MAX_TIME_MS);
          startRound(0); // Start Game Round 0
      }
    } else {
       // Stop and Reset to Start (Default to Trial Mode?)
       // If user clicks "Restart" during game, maybe go back to Ready (Trial?)
       // Let's assume restart resets everything including trial status
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
       moveRabbitTo(0); // Go to start position
       setPhaseMsLeft(0);
       setGameMsLeft(GAME_MAX_TIME_MS);
    }
  };

  // Global Timer
  useEffect(() => {
    if (phase === "ready" || phase === "done" || phase === "trial_done" || isTrial) return;
    
    const interval = window.setInterval(() => {
        setGameMsLeft(prev => {
            if (prev <= 100) {
                // TIME UP
                setPhase("done");
                return 0;
            }
            return prev - 100;
        });
    }, 100);
    
    return () => window.clearInterval(interval);
  }, [phase]);

  const phaseLabel = useMemo(() => {
    if (phase === "ready") return "Ready";
    if (phase === "show") return "Watch carefully";
    if (phase === "input") return "Your turn";
    if (phase === "feedback") return lastResult === "correct" ? "Correct!" : "Oops!";
    if (phase === "done") return "Finished";
    return "";
  }, [phase, lastResult]);

  const phaseSecondsLeft = Math.ceil(phaseMsLeft / 1000);

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Video Popup Modal */}
      {showVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full border-4 border-yellow-400 relative">
            <div className="bg-yellow-400 p-4 text-center">
              <h2 className="text-2xl font-black text-yellow-900 uppercase tracking-widest">How to Play</h2>
            </div>
            
            <div className="relative aspect-video bg-black">
              <video 
                ref={videoRef}
                src="/game-scenes/2nd/gamerule.mp4"
                className="w-full h-full object-contain"
                controls
                autoPlay
                onEnded={handleVideoEnd}
              />
            </div>

            <div className="p-6 flex justify-center bg-slate-50">
               <button
                 onClick={handleStartGameClick}
                 className={`
                    px-8 py-3 rounded-full text-xl font-bold transition-all transform shadow-[0_4px_0_rgb(0,0,0,0.2)]
                    ${videoEnded 
                        ? 'bg-green-500 hover:bg-green-400 text-white translate-y-0 active:translate-y-[4px] active:shadow-none cursor-pointer' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                    }
                 `}
                 disabled={!videoEnded}
               >
                 {videoEnded ? "Go to Game 🚀" : "Watch to Start..."}
               </button>
            </div>
            
            {/* Dev Skip Button */}
            <button 
                onClick={() => setVideoEnded(true)}
                className="absolute top-2 right-2 text-yellow-900/20 hover:text-yellow-900 font-bold text-xs"
                title="Dev Skip"
            >
                SKIP
            </button>
          </div>
        </div>
      )}


      {/* PAUSE / TIMEOUT MODAL */}
      {phase === "paused" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
             <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border-4 border-yellow-400 shadow-2xl relative">
                  <h2 className="text-3xl font-black text-yellow-500 mb-4">Please Focus! 🧐</h2>
                  <p className="text-gray-600 mb-8 text-lg">
                      It seems you're distracted. Ready to try again?
                  </p>
                  
                  <button 
                      onClick={handleContinueGame}
                      className="px-8 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-bold shadow-lg transition-transform active:scale-95"
                  >
                      Continue Game
                  </button>
             </div>
        </div>
      )}

      {/* TRIAL COMPLETE MODAL */}
      {phase === "trial_done" && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
             <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center border-4 border-emerald-400 shadow-2xl relative">
                  <h2 className="text-3xl font-black text-emerald-600 mb-4">Trial Complete! 🎉</h2>
                  <p className="text-gray-600 mb-8 text-lg">
                      You've finished the practice rounds. Ready for the real game?
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button 
                          onClick={() => {
                              // Restart Trial
                              setPhase("ready");
                              setTrialRound(0);
                              setIsTrial(true);
                              setTimeout(() => startRound(0), 500);
                          }}
                          className="px-6 py-3 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 text-lg font-bold shadow-md transition-transform active:scale-95"
                      >
                          Restart Trial
                      </button>
                      <button 
                          onClick={() => {
                              // Start Real Game
                              setIsTrial(false);
                              setPhase("ready");
                              setRound(0);
                              setScore(0);
                              // Start after brief delay
                              setTimeout(() => {
                                  setGameMsLeft(GAME_MAX_TIME_MS);
                                  startRound(0);
                              }, 500);
                          }}
                          className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-lg font-bold shadow-lg transition-transform active:scale-95"
                      >
                          Start Game 🚀
                      </button>
                  </div>
             </div>
         </div>
      )}

      {/* Main Game Container */}
      <div className={`w-full max-w-[80%] transition-all duration-500 flex flex-col items-center ${showVideo ? 'blur-sm scale-95 opacity-50' : 'blur-0 scale-100 opacity-100'}`}>
        {/* Top HUD */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 w-full">
          <div className="flex items-center gap-3">
             {/* Back Button */}
             <button
              onClick={() => router.push('/')}
              className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 transition font-semibold flex items-center gap-2"
            >
              🏠 <span className="hidden sm:inline">Home</span>
            </button>

            {/* <div className="px-3 py-2 rounded-2xl bg-white/10 backdrop-blur">
              <div className="text-xs opacity-80">Round</div>
              <div className="text-lg font-semibold">
                {Math.min(round + (phase === "ready" ? 0 : 1), TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
              </div>
            </div> */}

            {/* <div className="px-3 py-2 rounded-2xl bg-white/10 backdrop-blur">
              <div className="text-xs opacity-80">Score</div>
              <div className="text-lg font-semibold">{score}</div>
            </div> */}

             {/* Trial Indicator */}
             {isTrial && (
                <div className="px-3 py-2 rounded-2xl bg-yellow-400/20 backdrop-blur border border-yellow-400/50">
                    <div className="text-xs text-yellow-200 font-bold uppercase tracking-widest">Trial Mode</div>
                    <div className="text-lg font-semibold text-yellow-400">Round {trialRound + 1} / 2</div>
                </div>
             )}

             {!isTrial && (
                <div className="px-3 py-2 rounded-2xl bg-white/10 backdrop-blur">
                   <div className="text-xs opacity-80">Total Time</div>
                   <div className={`text-lg font-semibold ${gameMsLeft < 30000 ? 'text-red-400 animate-pulse' : ''}`}>
                     {Math.floor(gameMsLeft / 1000)}s
                   </div>
                </div>
             )}

            <div className="px-3 py-2 rounded-2xl bg-white/10 backdrop-blur">
              <div className="text-xs opacity-80">Phase</div>
              <div className="text-lg font-semibold">{phaseLabel}</div>
            </div>

            {(phase === "show" || phase === "input") && (
              <div className="px-3 py-2 rounded-2xl bg-white/10 backdrop-blur">
                <div className="text-xs opacity-80">Time left</div>
                <div className="text-lg font-semibold">{phaseSecondsLeft}s</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDev && (
            <button
              className={`px-3 py-2 rounded-2xl transition font-bold ${isEditing ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/10 hover:bg-white/15'}`}
              onClick={() => setIsEditing(e => !e)}
              type="button"
            >
              {isEditing ? "✅ DONE Editing" : "🛠️ Edit Layout"}
            </button>
            )}

            <button
              className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 transition"
              onClick={() => setDebugNumbers((d) => !d)}
              type="button"
            >
              {debugNumbers ? "Hide #'s" : "Show #'s"}
            </button>

            <button
                className="px-5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 transition font-semibold"
                onClick={handleGameControl}
                type="button"
              >
               {phase === "ready" ? (isTrial ? "Start Trial" : "Start Game") : "Restart"}
           </button>
          </div>
        </div>

        {/* Game Stage */}
        <div 
            ref={editorRef}
            className={`relative w-full aspect-[16/9] rounded-3xl overflow-hidden shadow-2xl border bg-black select-none ${isEditing ? 'border-yellow-500 ring-4 ring-yellow-500/30' : 'border-white/10'}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
          {/* Background scene */}
          <img
            src={SCENE_SRC}
            alt="Jungle river scene"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            draggable={false}
          />

          {/* Bush “exit” hint (right side) */}
          <div className="absolute right-[6%] bottom-[32%] w-[10%] h-[18%] rounded-2xl bg-emerald-500/0 pointer-events-none" />

          {/* Rabbit Logic */}
          <div 
            className="absolute z-10 w-[14%] h-auto transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none"
            style={{
                left: `${rabbitPos.x}%`,
                top: `${rabbitPos.y}%`,
                transform: `translate(-50%, -50%) scale(${rabbitScale})`,
                opacity: (rabbitVisible || isEditing) ? (isEditing ? 0.3 : 1) : 0, // Hide when supposed to be invisible (unless editing)
                transition: "left 0.3s, top 0.3s, opacity 0.3s, transform 0.3s"
            }}
          >
             <img
                src={RABBIT_SRC}
                alt="Rabbit"
                className="w-full h-full object-contain drop-shadow-lg"
                draggable={false}
            />
          </div>


          {/* Stones as clickable hotspots */}
          {stonesState.map((s) => {
            const isActive = activeStone === s.id && phase === "show";
            const isClickable = phase === "input" && !isEditing && s.id !== 0 && s.id !== 11; // 0 and 11 not clickable
            const wasClicked = playerInput.includes(s.id);
            const isBeingDragged = draggingId === s.id;
            
            // Special styling for Start/End in Editor
            const isStartOrEnd = s.id === 0 || s.id === 11;

            return (
              <div 
                key={s.id} 
                className="absolute" 
                style={{
                  left: `${s.xPct}%`, 
                  top: `${s.yPct}%`, 
                  width: `${s.rPct * 2}%`,
                  height: `${s.rPct * 2}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                 {/* Hitbox / Button */}
                 <button
                    type="button"
                    onMouseDown={(e) => handleMouseDown(e, s.id)}
                    onClick={() => !isEditing && isClickable && onStoneClick(s.id)}
                    className={[
                      "w-full h-full rounded-full transition-transform duration-150",
                      isClickable ? "cursor-pointer" : "cursor-default",
                      isClickable ? "hover:scale-110" : "",
                      isActive ? "scale-100" : "", 
                      isEditing ? "cursor-move ring-2 ring-yellow-400 bg-yellow-400/30" : "",
                      isBeingDragged ? "scale-110 shadow-xl" : "",
                      (isEditing && isStartOrEnd) ? "bg-blue-500/30 ring-blue-500" : "" // Distinguish 0/10 in editor
                    ].join(" ")}
                    style={{
                      // visual ring / glow
                      boxShadow: isActive
                        ? "0 0 0 4px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.6)"
                        : wasClicked && phase !== "show"
                        ? "0 0 0 4px rgba(255,255,255,0.3)"
                        : (debugNumbers || isEditing) ? "0 0 0 2px rgba(255,0,0,0.5)" : "none", 
                      background:
                        isActive
                          ? "rgba(255,255,255,0.25)"
                          : (debugNumbers || isEditing)
                          ? (isStartOrEnd ? "rgba(0,0,255,0.2)" : "rgba(255,0,0,0.2)")
                          : "transparent",
                    }}
                    aria-label={`Stone ${s.id}`}
                  >
                    {(debugNumbers || isEditing) && (
                      <span className="text-xs font-bold text-white drop-shadow-md bg-black/50 px-1 rounded pointer-events-none">
                        {s.id === 0 ? "START" : s.id === 11 ? "END" : s.id}
                      </span>
                    )}
                  </button>
                  
                  {/* Radius & Rabbit Scale Controls (Only when editing) */}
                  {isEditing && (
                      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col gap-1 items-center bg-black/80 rounded p-1 z-50 pointer-events-auto shadow-lg backdrop-blur">
                          <div className="flex gap-1 items-center">
                            <span className="text-[8px] text-gray-300 w-4 text-center">Size</span>
                            <button onMouseDown={(e) => { e.stopPropagation(); adjustRadius(s.id, -0.2); }} className="px-2 bg-red-500/80 hover:bg-red-500 text-white text-[10px] rounded font-bold">-</button>
                            <button onMouseDown={(e) => { e.stopPropagation(); adjustRadius(s.id, 0.2); }} className="px-2 bg-green-500/80 hover:bg-green-500 text-white text-[10px] rounded font-bold">+</button>
                          </div>
                          <div className="flex gap-1 items-center">
                            <span className="text-[8px] text-gray-300 w-4 text-center">🐰</span>
                            <button onMouseDown={(e) => { e.stopPropagation(); adjustRabbitScale(s.id, -0.1); }} className="px-2 bg-orange-500/80 hover:bg-orange-500 text-white text-[10px] rounded font-bold">-</button>
                            <button onMouseDown={(e) => { e.stopPropagation(); adjustRabbitScale(s.id, 0.1); }} className="px-2 bg-blue-500/80 hover:bg-blue-500 text-white text-[10px] rounded font-bold">+</button>
                          </div>
                      </div>
                  )}
              </div>
            );
          })}

          {/* Overlay messages */}
          {!isEditing && phase === "ready" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-6 py-4 rounded-3xl bg-black/55 backdrop-blur border border-white/10 text-center max-w-md pointer-events-auto">
                <div className="text-2xl font-semibold">Rabbit River</div>
                <div className="mt-2 text-sm opacity-90">
                  Watch the rabbit’s stone jumps for 10 seconds.
                  Then repeat the same order in 5 seconds.
                </div>
                <div className="mt-3 text-xs opacity-70">
                  Total rounds: {TOTAL_ROUNDS} (3 minutes)
                </div>
              </div>
            </div>
          )}

          {!isEditing && phase === "done" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-6 py-4 rounded-3xl bg-black/60 backdrop-blur border border-white/10 text-center max-w-md pointer-events-auto">
                <div className="text-2xl font-semibold">Time’s up</div>
                <div className="mt-2 text-base">
                  Score: <span className="font-bold">{score}</span> / {TOTAL_ROUNDS}
                </div>
                <button 
                  onClick={() => router.push('/')}
                  className="mt-4 bg-white text-black font-bold py-2 px-6 rounded-full hover:bg-gray-200 transition"
                >
                  Return Home
                </button>
              </div>
            </div>
          )}
        </div>

        {/* JSON Export for Developer */}
        {isEditing && (
          <div className="mt-6 p-4 bg-slate-800 rounded-xl w-full border border-yellow-500/30 relative animate-in slide-in-from-bottom-5">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-yellow-400 font-bold text-sm tracking-widest uppercase">🔧 Generated Position Config</h3>
                 <button 
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(stonesState, null, 2))}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs px-3 py-1 rounded"
                 >
                     Copy to Clipboard
                 </button>
             </div>
             <pre className="font-mono text-[10px] text-green-300 overflow-auto max-h-40 bg-black/50 p-2 rounded">
                 {JSON.stringify(stonesState, null, 2)}
             </pre>
             <div className="flex justify-between items-center mt-2">
                <p className="text-gray-400 text-xs italic">
                    Changes are auto-saved to your browser. Copy JSON to code to make permanent.
                </p>
                <button 
                  onClick={() => {
                      if(confirm("Reset layout to default in code?")) {
                          localStorage.removeItem("rabbit-stones-config");
                          setStonesState(STONES);
                          window.location.reload();
                      }
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold underline"
                >
                    Reset Defaults
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function RabbitRiverGamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-3xl font-bold">Loading Path...</div>}>
      <GameContent />
    </Suspense>
  );
}
