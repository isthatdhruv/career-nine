"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// === TYPES ===
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
  saveAnimalReaction: (data: Omit<AnimalReactionData, "timestamp">) => Promise<void>;
  saveRabbitPath: (data: Omit<RabbitPathData, "timestamp">) => Promise<void>;
  saveHydroTube: (data: Omit<HydroTubeData, "timestamp">) => Promise<void>;
  isSaving: boolean;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setStudentInfo = useCallback((name: string, className: string) => {
    setStudentName(name);
    setStudentClass(className);
  }, []);

  const getDocId = useCallback(() => studentName.trim().toLowerCase(), [studentName]);

  const saveAnimalReaction = useCallback(async (data: Omit<AnimalReactionData, "timestamp">) => {
    if (!studentName) {
      console.warn("Cannot save: studentName not set");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, "game_results", getDocId()), {
        name: studentName,
        ...(studentClass ? { className: studentClass } : {}),
        animal_reaction: { ...data, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      }, { merge: true });
      console.log("Animal reaction saved");
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  }, [studentName, studentClass, getDocId]);

  const saveRabbitPath = useCallback(async (data: Omit<RabbitPathData, "timestamp">) => {
    if (!studentName) {
      console.warn("Cannot save: studentName not set");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, "game_results", getDocId()), {
        name: studentName,
        ...(studentClass ? { className: studentClass } : {}),
        rabbit_path: { ...data, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      }, { merge: true });
      console.log("Rabbit path saved");
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  }, [studentName, studentClass, getDocId]);

  const saveHydroTube = useCallback(async (data: Omit<HydroTubeData, "timestamp">) => {
    if (!studentName) {
      console.warn("Cannot save: studentName not set");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, "game_results", getDocId()), {
        name: studentName,
        ...(studentClass ? { className: studentClass } : {}),
        hydro_tube: { ...data, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      }, { merge: true });
      console.log("Hydro tube saved");
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  }, [studentName, studentClass, getDocId]);

  return (
    <DataContext.Provider value={{
      studentName,
      studentClass,
      setStudentInfo,
      saveAnimalReaction,
      saveRabbitPath,
      saveHydroTube,
      isSaving,
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
