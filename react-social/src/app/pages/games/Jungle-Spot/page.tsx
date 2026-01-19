"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGameData } from "@/app/config/DataContext";
import { Suspense } from "react";

type AnimalType = "lion" | "elephant" | "rhino" | "deer" | "tiger";

const ANIMALS: AnimalType[] = ["lion", "elephant", "rhino", "deer", "tiger"];

const TOTAL_TRIALS = 120;
const TRIAL_MS = 1000; // 1 second per trial
const IMAGES_PER_ANIMAL = 5;

// Balanced deck: 24 of each animal = 120 trials
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
  // CHANGE THIS if your filenames differ:
  // Example expected: /assets/game/lion_1.png ... lion_5.png
  return `/assets/game/${animal}.webp`;
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// function mean(nums: number[]) {
//   if (!nums.length) return 0;
//   return nums.reduce((a, b) => a + b, 0) / nums.length;
// }
// function median(nums: number[]) {
//   if (!nums.length) return 0;
//   const a = [...nums].sort((x, y) => x - y);
//   const m = (a.length / 2) | 0;
//   return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
// }

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { saveAnimalReaction, setStudentInfo } = useGameData();

  const userName = searchParams.get("name") || "Explorer";
  const userClass = searchParams.get("class") || "";
  const mode = searchParams.get("mode"); // "sequence" or null

  // Set student info from URL params
  useEffect(() => {
    setStudentInfo(userName, userClass ? `Class ${userClass}` : "");
  }, [userName, userClass, setStudentInfo]);

  // UI state (kept minimal to avoid re-render noise)
  const [ready, setReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [trialIndex, setTrialIndex] = useState(-1);
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [showFlash, setShowFlash] = useState(false); // Brief flash between trials

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
      // Push PER_ANIMAL (24) copies of each animal for a total of 120 trials
      for (let i = 0; i < PER_ANIMAL; i++) {
        deck.push({ animal });
      }
    }
    shuffleInPlace(deck);
    // ensure exact length
    return deck.slice(0, TOTAL_TRIALS);
  }, []);

  // Refs for timing-accurate logic (no dependency on React state timing)
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const nextSwitchRef = useRef<number>(0);
  const currentTrialRef = useRef<Trial | null>(null);
  const currentIndexRef = useRef<number>(-1);

  const clickedThisTrialRef = useRef<boolean>(false);
  const onsetRef = useRef<number>(0); // performance.now() at stimulus onset
  const hasStartedRef = useRef<boolean>(false); // prevent effect re-run from resetting score

  // refs for score updates without stale closure
  const scoreRef = useRef<Score>(score);

  // Preload all possible images (25) BEFORE starting
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      const srcs: string[] = [];
      for (const a of ANIMALS) {
        for (let v = 1; v <= IMAGES_PER_ANIMAL; v++) {
          srcs.push(getImageSrc(a));
        }
      }

      await Promise.all(
        srcs.map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new window.Image();
              img.onload = () => resolve();
              img.onerror = () => resolve(); // don't block forever
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

    // finalize miss on last trial if needed
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
        // If target trial (lion) ended without a click => miss
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

      const t = trials[nextIdx];
      currentTrialRef.current = t;

      clickedThisTrialRef.current = false;
      onsetRef.current = now;

      // Flash briefly to indicate new trial (especially for consecutive same-animal)
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 80);

      // update image
      setCurrentSrc(getImageSrc(t.animal));
    },
    [trials, endGame]
  );

  const loop = useCallback(
    (now: number) => {
      if (gameOver) return;

      // first tick: start trial 0
      if (currentIndexRef.current === -1) {
        startRef.current = now;
        nextSwitchRef.current = now;
        advanceTrial(now);
        nextSwitchRef.current = now + TRIAL_MS;
      } else if (now >= nextSwitchRef.current) {
        // move to next trial, keeping boundaries stable
        // (avoid accumulating drift by stepping in multiples)
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
    // Prevent this effect from resetting score when loop callback changes due to gameOver
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    setGameOver(false);
    setScore({ hits: 0, misses: 0, falsePositives: 0, hitRTs: [] });
    scoreRef.current = { hits: 0, misses: 0, falsePositives: 0, hitRTs: [] };

    rafRef.current = requestAnimationFrame(loop);

    return () => stopLoop();
  }, [ready, loop, stopLoop]);

  // Input handler (pointerdown is faster/cleaner than click)
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

  // Save results on gameOver
  useEffect(() => {
    if (!gameOver) return;

    const saveResult = async () => {
      try {
        const final = scoreRef.current;

        // count how many lions were shown
        const lionsShown = trials.reduce(
          (acc, t) => acc + (t.animal === "lion" ? 1 : 0),
          0
        );

        await saveAnimalReaction({
          totalTrials: TOTAL_TRIALS,
          trialMs: TRIAL_MS,
          target: "lion",
          targetsShown: lionsShown,
          hits: final.hits,
          misses: final.misses,
          falsePositives: final.falsePositives,
          hitRTsMs: final.hitRTs,
        });
      } catch (e) {
        console.error("Error saving result:", e);
      }
    };

    saveResult();
  }, [gameOver, trials, saveAnimalReaction]);

  const handleRestart = () => window.location.reload();
  const handleExit = () => router.push("/");

  if (!ready) {
    return (
      <main className="min-h-screen bg-green-600 flex items-center justify-center text-white text-3xl font-bold">
        Loading assets...
      </main>
    );
  }

  if (gameOver) {
    const final = scoreRef.current;
    const lionsShown = trials.reduce(
      (acc, t) => acc + (t.animal === "lion" ? 1 : 0),
      0
    );

    return (
      <main className="min-h-screen bg-green-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="z-10 bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border-4 border-yellow-400 max-w-md w-full text-center">
          <h1 className="text-4xl font-extrabold text-green-900 mb-6">
            Done, {userName} , Thank you for playing!
          </h1>

          {mode === "sequence" ? (
            <button
              onClick={() =>
                router.push(
                  `/game-page/rabbit-path/grade-${userClass || "3"}?name=${encodeURIComponent(userName)}&class=${userClass || "3"}`
                )
              }
              className="block w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-2xl font-black py-4 rounded-full shadow-[0_6px_0_rgb(30,58,138)] hover:shadow-[0_4px_0_rgb(30,58,138)] active:translate-y-[6px] active:shadow-none transition-all uppercase tracking-wider flex items-center justify-center gap-3"
            >
              <span>Next Game</span>
              <span>➡️</span>
            </button>
          ) : (
            <Link
              href="/"
              className="block w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 text-2xl font-black py-4 rounded-full shadow-[0_6px_0_rgb(180,83,9)] hover:shadow-[0_4px_0_rgb(180,83,9)] active:translate-y-[6px] active:shadow-none transition-all uppercase tracking-wider"
            >
              Play Again
            </Link>
          )}
        </div>
      </main>
    );
  }

  const currentTrial = trialIndex >= 0 ? trials[trialIndex] : null;

  return (
    <main
      className="min-h-screen bg-green-600 flex flex-col items-center justify-center relative overflow-hidden"
      onPointerDown={handleInput}
    >
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 10%, transparent 10%)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-3 pointer-events-auto">
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            handleRestart();
          }}
          className="bg-white/20 hover:bg-white/40 text-white p-3 rounded-full backdrop-blur-sm transition-all text-xl"
          title="Restart Game"
        >
          🔄
        </button>
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            handleExit();
          }}
          className="bg-red-500/20 hover:bg-red-500/40 text-white p-3 rounded-full backdrop-blur-sm transition-all text-xl"
          title="Exit Game"
        >
          ❌
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center select-none">
        {/* Use plain <img> for lowest overhead + no Next/Image lazy behavior */}
        <div className="transform transition-all duration-150 scale-100">
          <div className="bg-white p-4 rounded-3xl shadow-2xl rotate-1 border-8 border-white">
            {currentSrc && !showFlash ? (
              <img
                src={currentSrc}
                alt={currentTrial?.animal ?? "animal"}
                width={350}
                height={350}
                draggable={false}
                className="object-contain"
              />
            ) : (
              <div className="w-[350px] h-[350px]" />
            )}
          </div>
        </div>

        <p className="mt-10 text-white/90 text-xl font-bold bg-black/20 px-6 py-2 rounded-full backdrop-blur-sm">
          Tap / Press SPACE only for{" "}
          <span className="text-yellow-300">LION</span>
        </p>

        {/* optional: tiny debug line */}
        <p className="mt-3 text-white/60 text-sm font-semibold">
          Trial {Math.max(0, trialIndex + 1)} / {TOTAL_TRIALS}
        </p>
      </div>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-green-500 flex items-center justify-center text-white text-3xl font-bold">
          Loading...
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
