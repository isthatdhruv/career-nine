import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
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

type GameKey = "animal_reaction" | "rabbit_path" | "hydro_tube";

type DataContextType = {
  studentName: string;
  studentClass: string;
  setStudentInfo: (name: string, className: string) => void;
  saveAnimalReaction: (data: Omit<AnimalReactionData, "timestamp">, userStudentId?: string, assessmentId?: string) => Promise<void>;
  saveRabbitPath: (data: Omit<RabbitPathData, "timestamp">, userStudentId?: string, assessmentId?: string) => Promise<void>;
  saveHydroTube: (data: Omit<HydroTubeData, "timestamp">, userStudentId?: string, assessmentId?: string) => Promise<void>;
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

// The assessment the run belongs to. Games live inside a questionnaire, so the
// same student can play them again under a different assessment — the result
// document keeps one entry per assessment (see buildWriteBody).
function getAssessmentId(providedId?: string): string | null {
  if (providedId && String(providedId).trim()) {
    return String(providedId).trim();
  }
  if (typeof window !== 'undefined') {
    const storedId = localStorage.getItem('assessmentId');
    if (storedId && storedId.trim()) {
      return storedId.trim();
    }
  }
  return null;
}

/**
 * A game result that has been produced but not yet confirmed written to
 * Firestore. Buffered in localStorage so a network blip / tab close between
 * the game ending and the write landing does not destroy the run — the games
 * themselves keep results in memory only, so this buffer is the sole copy.
 */
type PendingWrite = {
  gameKey: GameKey;
  docId: string;
  assessmentId: string | null;
  payload: Record<string, any>;
};

const PENDING_PREFIX = "pendingGameResult:";

function pendingKey(entry: PendingWrite): string {
  return `${PENDING_PREFIX}${entry.docId}:${entry.assessmentId ?? "na"}:${entry.gameKey}`;
}

function stashPending(entry: PendingWrite) {
  try {
    localStorage.setItem(pendingKey(entry), JSON.stringify(entry));
  } catch {
    // Out of quota — the in-flight write below is then the only chance.
  }
}

function clearPending(entry: PendingWrite) {
  try {
    localStorage.removeItem(pendingKey(entry));
  } catch {
    // Non-fatal: a stale entry just gets re-written on the next flush.
  }
}

/**
 * Document shape written to game_results/{userStudentId}:
 *
 *   userStudentId, lastUpdated, assessmentId        ← latest run
 *   animal_reaction / rabbit_path / hydro_tube      ← latest run (legacy shape;
 *       BetReportDataController.computeCognitive still reads these top-level)
 *   assessments: {
 *     "5":  { assessmentId, animal_reaction, rabbit_path, hydro_tube, lastUpdated },
 *     "12": { ... }
 *   }
 *
 * With merge:true this overwrites the entry for THIS assessment (same game key
 * → replaced) and leaves entries for every other assessment untouched, so a
 * second assessment appends rather than clobbering the first.
 */
function buildWriteBody(entry: PendingWrite, now: string): Record<string, any> {
  const { gameKey, docId, assessmentId, payload } = entry;

  const body: Record<string, any> = {
    userStudentId: docId,
    [gameKey]: payload,
    lastUpdated: now,
  };

  if (assessmentId) {
    body.assessmentId = assessmentId;
    body.assessments = {
      [assessmentId]: {
        assessmentId,
        [gameKey]: payload,
        lastUpdated: now,
      },
    };
  }

  return body;
}

async function writeToFirestore(entry: PendingWrite): Promise<void> {
  const { doc, setDoc, db } = await getFirestore();
  const body = buildWriteBody(entry, new Date().toISOString());
  await setDoc(doc(db, "game_results", entry.docId), body, { merge: true });
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setStudentInfo = useCallback((name: string, className: string) => {
    setStudentName(name);
    setStudentClass(className);
  }, []);

  // Retry any result that was buffered but never confirmed written (tab closed
  // mid-write, connection dropped, Firestore rejected). Runs once per app load.
  useEffect(() => {
    let cancelled = false;

    const flushPending = async () => {
      // Snapshot synchronously, before the first await. Several entry pages
      // (student login, magic link, campaign/school register, payment status)
      // call localStorage.clear() from their own mount effect, which would
      // otherwise race this flush and destroy the only copy of the result.
      const snapshot: Array<{ key: string; entry: PendingWrite | null }> = [];
      try {
        for (const key of Object.keys(localStorage)) {
          if (!key.startsWith(PENDING_PREFIX)) continue;
          let entry: PendingWrite | null = null;
          try {
            entry = JSON.parse(localStorage.getItem(key) || "null");
          } catch {
            entry = null;
          }
          snapshot.push({ key, entry });
        }
      } catch {
        return;
      }
      if (snapshot.length === 0) return;

      for (const { key, entry } of snapshot) {
        if (cancelled) return;
        if (!entry || !entry.docId || !entry.gameKey || !entry.payload) {
          // Unparseable/incomplete — nothing recoverable, drop it.
          try { localStorage.removeItem(key); } catch { /* ignore */ }
          continue;
        }
        try {
          await writeToFirestore(entry);
          try { localStorage.removeItem(key); } catch { /* ignore */ }
          console.log(`Recovered pending game result: ${key}`);
        } catch (e: any) {
          // Keep it buffered and try again on the next app load.
          console.warn(`Could not flush pending game result ${key}:`, e?.message || e);
        }
      }
    };

    flushPending();
    return () => { cancelled = true; };
  }, []);

  /**
   * Persist one game's result. Throws on failure — the caller (game wrapper)
   * needs to know, because a silently dropped write used to still mark the
   * question answered and disable the launch button, making the run
   * unrepeatable and the data unrecoverable.
   */
  const saveGame = useCallback(async (
    gameKey: GameKey,
    data: Record<string, any>,
    providedUserId?: string,
    providedAssessmentId?: string,
  ) => {
    const docId = getUserStudentId(providedUserId);
    if (!docId) {
      throw new Error("Cannot save game result: userStudentId missing from session");
    }

    const entry: PendingWrite = {
      gameKey,
      docId,
      assessmentId: getAssessmentId(providedAssessmentId),
      payload: { ...data, timestamp: new Date().toISOString() },
    };

    // Buffer first: from here on the result survives a failed write.
    stashPending(entry);
    setIsSaving(true);
    try {
      let lastError: any = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await writeToFirestore(entry);
          clearPending(entry);
          return;
        } catch (e: any) {
          lastError = e;
          console.error(`Failed to save ${gameKey} (attempt ${attempt}/2):`, e?.message || e);
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      }
      // Left in the pending buffer for the next app load to retry.
      throw lastError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveAnimalReaction = useCallback(
    (data: Omit<AnimalReactionData, "timestamp">, providedUserId?: string, providedAssessmentId?: string) =>
      saveGame("animal_reaction", data, providedUserId, providedAssessmentId),
    [saveGame],
  );

  const saveRabbitPath = useCallback(
    (data: Omit<RabbitPathData, "timestamp">, providedUserId?: string, providedAssessmentId?: string) =>
      saveGame("rabbit_path", data, providedUserId, providedAssessmentId),
    [saveGame],
  );

  const saveHydroTube = useCallback(
    (data: Omit<HydroTubeData, "timestamp">, providedUserId?: string, providedAssessmentId?: string) =>
      saveGame("hydro_tube", data, providedUserId, providedAssessmentId),
    [saveGame],
  );

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
