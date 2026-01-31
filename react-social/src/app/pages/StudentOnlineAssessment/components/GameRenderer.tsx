import React from "react";
import { HydroTubeGame } from "../../games/Hydro-Tube/HydroTubeGame";
import { JungleSpotGame } from "../../games/Jungle-Spot/JungleSpotGame";
import { RabbitPathGame } from "../../games/Rabbit-Path/RabbitPathGame";

interface GameRendererProps {
  gameCode: number;
  userStudentId: string;
  playerName: string;
  onComplete: (data: any) => void;
  onExit: () => void;
}

/**
 * Game Code Mapping:
 * - 101: Jungle-Spot
 * - 102: Rabbit-Path
 * - 103: Hydro-Tube
 */
export function GameRenderer({ gameCode, userStudentId, playerName, onComplete, onExit }: GameRendererProps) {
  switch (gameCode) {
    case 101:
      return (
        <JungleSpotGame
          userStudentId={userStudentId}
          playerName={playerName}
          onComplete={onComplete}
          onExit={onExit}
        />
      );

    case 102:
      return (
        <RabbitPathGame
          userStudentId={userStudentId}
          playerName={playerName}
          onComplete={onComplete}
          onExit={onExit}
        />
      );

    case 103:
      return (
        <HydroTubeGame
          userStudentId={userStudentId}
          playerName={playerName}
          onComplete={onComplete}
          onExit={onExit}
        />
      );

    default:
      return (
        <div className="min-h-screen bg-red-100 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Unknown Game</h2>
            <p className="text-gray-700 mb-4">
              Game code <strong>{gameCode}</strong> is not recognized.
            </p>
            <button
              onClick={onExit}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
            >
              Exit
            </button>
          </div>
        </div>
      );
  }
}
