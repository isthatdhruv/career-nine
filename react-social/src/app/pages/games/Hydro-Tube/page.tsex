"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameData } from "@/app/config/DataContext";

function HydroTubeContent() {
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
  
  // New States for Curious Clicks
  const [curiousClicks, setCuriousClicks] = useState(0);
  const [highlightedTile, setHighlightedTile] = useState<number | null>(null);
  
  // State for tracking tile progress
  const [tilesCorrect, setTilesCorrect] = useState(0);
  const [totalSolutionTiles, setTotalSolutionTiles] = useState(16);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { saveHydroTube, setStudentInfo } = useGameData();

  // Get URL params
  const userName = searchParams.get("name") || "Player";
  const userClass = searchParams.get("class") || "";

  // Set student info from URL params
  useEffect(() => {
    setStudentInfo(userName, userClass ? `Class ${userClass}` : "");
  }, [userName, userClass, setStudentInfo]);

  type Pattern = {
    id: number;
    name: string;
    tileTypes: Record<number, string>;
    solutions: number[][];  // 2D array to store multiple valid solutions
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
  ];

  const currentPattern = patterns[patternId];

  useEffect(() => {
    const randomPatternId = Math.floor(Math.random() * patterns.length);
    setPatternId(randomPatternId);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const nextTime = prev - 1;

        // Curious Click Logic: Highlight at 45s, 90s, 135s (3 minutes total)
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
    // STICK RULE: Keep dependency array length constant to prevent crash
  }, [router, isInitialized]);

  // Save data to Firestore when game ends
  useEffect(() => {
    if (!gameEnded) return;

    const saveResult = async () => {
      try {
        await saveHydroTube({
          patternsCompleted: completedPatterns.length,
          totalPatterns: 2,
          aimlessRotations,
          curiousClicks,
          tilesCorrect,
          totalTiles: totalSolutionTiles,
          timeSpentSeconds: 180 - timeLeft,
        });
        console.log("Hydro tube game data saved");
      } catch (e) {
        console.error("Error saving hydro tube data:", e);
      }
      // Redirect to end page after saving
      router.push(`/end-page?completed=${completedPatterns.length}`);
    };

    saveResult();
  }, [gameEnded, completedPatterns.length, aimlessRotations, curiousClicks, tilesCorrect, totalSolutionTiles, timeLeft, saveHydroTube, router]);

  const checkWin = (currentRotations: Record<number, number>): boolean => {
    const playerRotations = Array.from({ length: 16 }, (_, i) => currentRotations[i + 1] || 0);
    // Check if player's rotations match ANY of the valid solutions
    return currentPattern.solutions.some((solution) =>
      solution.every((solRot, i) => {
        const playerRotation = playerRotations[i];
        return solRot === 0 || solRot === playerRotation;
      })
    );
  };

  // Calculate how many tiles are correct out of total solution tiles
  const calculateProgress = (currentRotations: Record<number, number>): { correct: number; total: number } => {
    const playerRotations = Array.from({ length: 16 }, (_, i) => currentRotations[i + 1] || 0);
    
    // Find the solution with the most matching tiles
    let bestCorrectCount = 0;
    
    currentPattern.solutions.forEach((solution) => {
      let correctCount = 0;
      solution.forEach((solRot, i) => {
        const playerRotation = playerRotations[i];
        // A tile is correct if it matches the solution (solRot === 0 means any rotation is valid)
        if (solRot === 0 || solRot === playerRotation) {
          correctCount++;
        }
      });
      if (correctCount > bestCorrectCount) {
        bestCorrectCount = correctCount;
      }
    });
    
    return { correct: bestCorrectCount, total: 16 };
  };

  const loadNextPattern = () => {
    const newCompletedPatterns = [...completedPatterns, patternId];
    setCompletedPatterns(newCompletedPatterns);
    
    if (newCompletedPatterns.length >= 2) {
      // Update tilesCorrect to 16 since player completed the pattern
      setTilesCorrect(16);
      setGameEnded(true); // This will trigger the save useEffect
      return;
    }
    const nextPatternId = patterns.findIndex(p => !newCompletedPatterns.includes(p.id));
    
    if (nextPatternId !== -1) {
      setPatternId(nextPatternId);
      setTileRotations({});
      setIsWon(false);
      setLastClickedTile(null);
      setConsecutiveClicks(0);
      setHighlightedTile(null);
    }
  };

  const handleTileClick = (tileNumber: number) => {
    if (isWon) return; 

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

    setTileRotations((prev) => {
      const currentRotation = prev[tileNumber] || 0;
      const newRotation = (currentRotation + 90) % 360;
      const newState = { ...prev, [tileNumber]: newRotation };
      
      // Update progress tracking
      const progress = calculateProgress(newState);
      setTilesCorrect(progress.correct);
      setTotalSolutionTiles(progress.total);
      
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
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
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
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
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
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
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
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 flex items-center justify-center relative pt-40">
      <div className="absolute top-10 left-10 text-5xl opacity-30 animate-bounce">💧</div>
      <div className="absolute bottom-20 right-20 text-5xl opacity-30 animate-pulse">💧</div>
      
      <div className="absolute top-8 right-8 flex flex-col gap-4">
        <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border-2 border-orange-300">
          <div className="text-sm font-semibold text-slate-600 mb-1">Aimless Rotations</div>
          <div className="text-3xl font-bold text-orange-600 flex items-center gap-2">🔄 {aimlessRotations}</div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border-2 border-yellow-400">
          <div className="text-sm font-semibold text-slate-600 mb-1">Curious Clicks</div>
          <div className="text-3xl font-bold text-yellow-600 flex items-center gap-2">✨ {curiousClicks}</div>
        </div>
      </div>

      <div className="absolute top-8 left-8 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border-2 border-blue-300">
        <div className="text-sm font-semibold text-slate-600 mb-1">Time Left</div>
        <div className="text-3xl font-bold text-blue-600">{formatTime(timeLeft)}</div>
      </div>

      <div className="absolute top-32 left-8 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border-2 border-purple-300">
        <div className="text-sm font-semibold text-slate-600 mb-1">Current Pattern</div>
        <div className="text-xl font-bold text-purple-600">{currentPattern.name}</div>
        <div className="text-xs text-slate-500 mt-1">Completed: {completedPatterns.length}/2</div>
      </div>

      <div className="relative">
        {isWon && (
          <div className="absolute inset-0 bg-green-500/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl border-8 border-green-400 animate-pulse">
            <div className="text-6xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Perfect Flow Achieved!</h2>
            <p className="text-xl text-white/90 mb-2">{currentPattern.name} Complete!</p>
            <p className="text-lg text-white/80 mb-8">{completedPatterns.length + 1} of 2 patterns done</p>
            <button
              onClick={loadNextPattern}
              className="px-12 py-4 bg-white text-green-600 font-bold text-xl rounded-full shadow-2xl hover:scale-110 transition-all duration-200"
            >
              {completedPatterns.length + 1 >= 2 ? "Finish! 🏆" : "Next Pattern 💧"}
            </button>
          </div>
        )}

        {/* RE-ADDED TAP SVG */}
        <div className="absolute -top-32 left-0 z-10">
          <svg viewBox="0 0 120 150" className="w-32 h-40 drop-shadow-lg">
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
            <circle cx="60" cy="105" r="4" fill="#93c5fd" opacity="0.7">
              <animate attributeName="cy" values="105;115;125;135" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0.5;0.3;0.1" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        <div
          style={{
            display: "inline-grid",
            gridTemplateColumns: "repeat(4, 110px)",
            gridTemplateRows: "repeat(4, 110px)",
            gap: "3px",
            padding: "20px",
            background: isWon ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #64748b 0%, #475569 100%)",
            borderRadius: "16px",
            boxShadow: isWon ? "0 10px 40px rgba(16,185,129,0.4)" : "0 10px 40px rgba(0,0,0,0.15)",
            border: isWon ? "6px solid #059669" : "6px solid #334155",
            transition: "all 0.5s ease",
          }}
        >
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
                  width: "110px", height: "110px",
                  background: isHighlighted ? "#fef3c7" : "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                  cursor: isWon ? "default" : "pointer",
                  transform: `rotate(${rotation}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: isHighlighted ? "inset 0 0 15px #f59e0b, 0 0 20px #f59e0b" : "inset 0 2px 6px rgba(0,0,0,0.08)",
                  border: isHighlighted ? "4px solid #f59e0b" : (isWon ? "3px solid #10b981" : "1px solid #e2e8f0"),
                  animation: isHighlighted ? "pulse 1.5s infinite" : "none",
                }}
              >
                {renderPipe(pipeType)}
              </div>
            );
          })}
        </div>

        {/* RE-ADDED BUCKET SVG */}
        <div className="mt-4 flex justify-end">
          <svg viewBox="0 0 150 160" className={`w-36 h-40 drop-shadow-lg ${isWon ? "animate-bounce" : ""}`}>
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

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function HydroTube() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 flex items-center justify-center text-blue-600 text-3xl font-bold">
          Loading...
        </div>
      }
    >
      <HydroTubeContent />
    </Suspense>
  );
}
