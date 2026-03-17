import React, { createContext, useContext, useState, useCallback } from "react";
// Firebase is lazy-loaded only when game data needs to be saved
async function getFirestore() {
  const { doc, setDoc } = await import("firebase/firestore");
  const { db } = await import("../firebase");
  return { doc, setDoc, db };
}

export type AnimalReactionData = {
  totalTrials: number;
  trialMs: number;
  target: string;
  targetsShown: number;
  hits: number;
  misses: number;
  falsePositives: number;
  hitRTsMs: number[];
  timestamp?: string;
};

export type RabbitPathData = {
  score: number;
  totalRounds: number;
  roundsPlayed: number;
  timestamp?: string;
  history?: any[];
};

export type HydroTubeData = {
  patternsCompleted: number;
  totalPatterns: number;
  aimlessRotations: number;
  curiousClicks: number;
  tilesCorrect: number;
  totalTiles: number;
  timeSpentSeconds: number;
  timestamp?: string;
};

export type GameData = {
  name: string;
  className?: string;
  animal_reaction?: AnimalReactionData;
  rabbit_path?: RabbitPathData;
  hydro_tube?: HydroTubeData;
  timestamp: string;
};

type DataContextType = {
  studentName: string;
  studentClass: string;
  setStudentInfo: (name: string, className: string) => void;
  saveAnimalReaction: (data: Omit<AnimalReactionData, "timestamp">, userStudentId?: string) => Promise<void>;
  saveRabbitPath: (data: Omit<RabbitPathData, "timestamp">, userStudentId?: string) => Promise<void>;
  saveHydroTube: (data: Omit<HydroTubeData, "timestamp">, userStudentId?: string) => Promise<void>;
  isSaving: boolean;
};

const DataContext = createContext<DataContextType | null>(null);

function getUserStudentId(providedId?: string): string | null {
  if (providedId && providedId.trim()) {
    return providedId.trim();
  }
  if (typeof window !== 'undefined') {
    const storedId = localStorage.getItem('userStudentId');
    if (storedId && storedId.trim()) {
      return storedId.trim();
    }
  }
  return null;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setStudentInfo = useCallback((name: string, className: string) => {
    setStudentName(name);
    setStudentClass(className);
  }, []);

  const saveAnimalReaction = useCallback(async (data: Omit<AnimalReactionData, "timestamp">, providedUserId?: string) => {
    const docId = getUserStudentId(providedUserId);
    if (!docId) {
      console.error("Cannot save Animal Reaction: userStudentId not found");
      return;
    }
    setIsSaving(true);
    try {
      const saveData = {
        userStudentId: docId,
        animal_reaction: { ...data, timestamp: new Date().toISOString() },
        lastUpdated: new Date().toISOString(),
      };
      const { doc, setDoc, db } = await getFirestore();
      await setDoc(doc(db, "game_results", docId), saveData, { merge: true });
    } catch (e: any) {
      console.error("Failed to save Animal Reaction:", e?.message || e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveRabbitPath = useCallback(async (data: Omit<RabbitPathData, "timestamp">, providedUserId?: string) => {
    const docId = getUserStudentId(providedUserId);
    if (!docId) {
      console.error("Cannot save Rabbit Path: userStudentId not found");
      return;
    }
    setIsSaving(true);
    try {
      const saveData = {
        userStudentId: docId,
        rabbit_path: { ...data, timestamp: new Date().toISOString() },
        lastUpdated: new Date().toISOString(),
      };
      const { doc, setDoc, db } = await getFirestore();
      await setDoc(doc(db, "game_results", docId), saveData, { merge: true });
    } catch (e: any) {
      console.error("Failed to save Rabbit Path:", e?.message || e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveHydroTube = useCallback(async (data: Omit<HydroTubeData, "timestamp">, providedUserId?: string) => {
    const docId = getUserStudentId(providedUserId);
    if (!docId) {
      console.error("Cannot save Hydro Tube: userStudentId not found");
      return;
    }
    setIsSaving(true);
    try {
      const saveData = {
        userStudentId: docId,
        hydro_tube: { ...data, timestamp: new Date().toISOString() },
        lastUpdated: new Date().toISOString(),
      };
      const { doc, setDoc, db } = await getFirestore();
      await setDoc(doc(db, "game_results", docId), saveData, { merge: true });
    } catch (e: any) {
      console.error("Failed to save Hydro Tube:", e?.message || e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return (
    <DataContext.Provider value={{
      studentName, studentClass, setStudentInfo,
      saveAnimalReaction, saveRabbitPath, saveHydroTube, isSaving,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useGameData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useGameData must be used within DataProvider");
  }
  return ctx;
}
