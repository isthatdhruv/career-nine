import React, { useCallback } from "react";
import { GameRenderer } from "./GameRenderer";
import { useGameData } from "../../Games/Data-Context/DataContext";

interface AssessmentGameWrapperProps {
  gameCode: number;
  userStudentId: string;
  playerName: string;
  onComplete: () => void;
  onExit: () => void;
}

export function AssessmentGameWrapper({
  gameCode,
  userStudentId,
  playerName,
  onComplete,
  onExit
}: AssessmentGameWrapperProps) {

  const { saveAnimalReaction, saveRabbitPath, saveHydroTube } = useGameData();

  const handleGameComplete = useCallback(async (data: any) => {
    console.log("=== Game Complete Handler Called ===");
    console.log("Received data:", data);
    console.log("Game code:", gameCode);

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
          }, userStudentId);
          console.log("✅ Jungle-Spot results saved via DataContext!");
          break;

        case 102: // Rabbit-Path
          console.log("Saving Rabbit-Path via DataContext...");
          await saveRabbitPath({
            score: data.score,
            totalRounds: data.totalRounds,
            roundsPlayed: data.roundsPlayed,
            history: data.history,
          }, userStudentId);
          console.log("✅ Rabbit-Path results saved via DataContext!");
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
          }, userStudentId);
          console.log("✅ Hydro-Tube results saved via DataContext!");
          break;

        default:
          console.warn("Unknown game code:", gameCode);
      }
    } catch (error: any) {
      console.error("❌ Failed to save game results:", error);
      console.error("Error message:", error?.message);
    }

    // Always call onComplete to close the game UI
    onComplete();
  }, [onComplete, userStudentId, gameCode, saveAnimalReaction, saveRabbitPath, saveHydroTube]);

  const handleGameExit = useCallback(() => {
    onExit();
  }, [onExit]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-white overflow-auto"
      style={{ width: "100%", height: "100%" }}
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
