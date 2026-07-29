import React, { useCallback, useRef } from "react";
import { GameRenderer } from "./GameRenderer";
import { useGameData } from "../contexts/DataContext";

interface AssessmentGameWrapperProps {
  gameCode: number;
  userStudentId: string;
  assessmentId: string;
  playerName: string;
  /**
   * `saved` reports whether the result actually reached Firestore. The caller
   * must NOT mark the question answered when it is false — the game has to
   * stay replayable, otherwise the run is lost with no way to redo it.
   */
  onComplete: (saved: boolean) => void;
  onExit: () => void;
}

export function AssessmentGameWrapper({
  gameCode,
  userStudentId,
  assessmentId,
  playerName,
  onComplete,
  onExit
}: AssessmentGameWrapperProps) {

  const { saveAnimalReaction, saveRabbitPath, saveHydroTube } = useGameData();

  // RabbitPathGame and HydroTubeGame fire onComplete from an effect whose deps
  // include the callback itself, so it can re-run and submit the same result
  // twice. One completion per mount.
  const completionHandledRef = useRef(false);

  const handleGameComplete = useCallback(async (data: any) => {
    if (completionHandledRef.current) return;
    completionHandledRef.current = true;

    console.log("=== Game Complete Handler Called ===");
    console.log("Received data:", data);
    console.log("Game code:", gameCode);

    let saved = false;

    try {
      // Save to Firestore via DataContext based on game type
      switch (gameCode) {
        case 101: // Jungle-Spot (Animal Reaction)
          console.log("Saving Jungle-Spot via DataContext...");
          await saveAnimalReaction({
            totalTrials: data.totalTrials,
            trialMs: data.trialMs,
            target: data.target,
            targetsShown: data.targetsShown,
            hits: data.hits,
            misses: data.misses,
            falsePositives: data.falsePositives,
            hitRTsMs: data.hitRTsMs || [],
          }, userStudentId, assessmentId);
          console.log("Jungle-Spot results saved via DataContext!");
          saved = true;
          break;

        case 102: // Rabbit-Path
          console.log("Saving Rabbit-Path via DataContext...");
          await saveRabbitPath({
            score: data.score,
            totalRounds: data.totalRounds,
            roundsPlayed: data.roundsPlayed,
            history: data.history,
          }, userStudentId, assessmentId);
          console.log("Rabbit-Path results saved via DataContext!");
          saved = true;
          break;

        case 103: // Hydro-Tube
          console.log("Saving Hydro-Tube via DataContext...");
          await saveHydroTube({
            patternsCompleted: data.patternsCompleted,
            totalPatterns: data.totalPatterns,
            aimlessRotations: data.aimlessRotations,
            curiousClicks: data.curiousClicks,
            tilesCorrect: data.tilesCorrect,
            totalTiles: data.totalTiles,
            timeSpentSeconds: data.timeSpentSeconds,
          }, userStudentId, assessmentId);
          console.log("Hydro-Tube results saved via DataContext!");
          saved = true;
          break;

        default:
          console.warn("Unknown game code:", gameCode);
      }
    } catch (error: any) {
      console.error("Failed to save game results:", error);
      console.error("Error message:", error?.message);
      // Allow another attempt on relaunch — the result is also buffered in
      // localStorage by DataContext and retried on the next app load.
      completionHandledRef.current = false;
    }

    onComplete(saved);
  }, [onComplete, userStudentId, assessmentId, gameCode, saveAnimalReaction, saveRabbitPath, saveHydroTube]);

  const handleGameExit = useCallback(() => {
    onExit();
  }, [onExit]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'white', overflowY: 'auto', width: '100%', height: '100%' }}
    >
      <GameRenderer
        gameCode={gameCode}
        userStudentId={userStudentId}
        playerName={playerName}
        onComplete={handleGameComplete}
        onExit={handleGameExit}
      />
    </div>
  );
}
