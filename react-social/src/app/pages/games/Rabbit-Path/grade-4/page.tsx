"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RabbitRiverGame, { StonePos, RoundResult, shuffle } from "@/components/puzzles/RabbitRiverGame";

// Logic for Grade 4
// 1. Trials: Length 4 (Strict No Consecutives).
// 2. Rounds 0-2 (Set 1): Length 4 (Strict No Consecutives).
// 3. Rounds 3-5 (Set 2): 
//    - If Set 1 Perfect -> Length 5 (Max 1 Consec Pair).
//    - Else -> Length 4.
// 4. Rounds 6-12 (Set 3, 4):
//    - If Set 2 Perfect (at Length 5) -> Length 6 (Max 2 Consec Pairs).
//    - Else -> Stay at current.

const generateClass4Sequence = (
    stones: StonePos[], 
    roundIndex: number, 
    history: RoundResult[],
    isTrial: boolean
): number[] => {
    
    // Determine Target Length
    let length = 4;

    if (isTrial) {
        length = 4;
    } else {
        // Main Game Logic
        // Set 1: Rounds 0-3 (4 rounds)
        // Set 2: Rounds 4-7 (4 rounds)
        // Set 3: Rounds 8-11 (4 rounds)

        // 1. Check Set 1 (0-3)
        const set1Passed = history.filter(h => h.round >= 0 && h.round <= 3 && h.correct).length === 4;
        
        // Default Logic for Set 2 (4-7)
        if (roundIndex >= 4) {
            if (set1Passed) {
                length = 5;
            }
        }
        
        // 2. Check Set 2 (4-7)
        if (roundIndex >= 8) {
             const set2Passed = history.filter(h => h.round >= 4 && h.round <= 7 && h.correct).length === 4;
             
             // Logic: Set 2 Passed AND Set 1 Passed (implies Set 2 was at L5) -> L6
             if (set1Passed && set2Passed) {
                 length = 6;
             } else if (set1Passed && !set2Passed) {
                 length = 5; // Stay at 5
             } else {
                 length = 4; // Stay at 4
             }
        }
    }

    // GENERATE SEQUENCE
    // Constraint: 
    // - Length 4: STRICT No consecutive numbers allowed.
    // - Length 5: Allow at most 1 pair of consecutives.
    // - Length 6: Allow at most 2 pair of consecutives.
    
    const validIds = stones.filter(s => s.id !== 0 && s.id !== 11).map(s => s.id); // [1..10]
    
    let candidates: number[] = [];
    let attempts = 0;
    while(attempts < 500) {
        const potential = shuffle(validIds).slice(0, length).sort((a,b) => a - b);
        
        // Count consecutive pairs
        let consecutivePairs = 0;
        for (let i = 0; i < potential.length - 1; i++) {
            if (potential[i+1] === potential[i] + 1) {
                consecutivePairs++;
            }
        }
        
        let isValid = false;
        if (length === 6) {
             // Allow max 2 pairs
             if (consecutivePairs <= 2) isValid = true;
        } else if (length === 5) {
             // Allow max 1 pair
             if (consecutivePairs <= 1) isValid = true;
        } else {
             // Strict no consecutives (Length 4 and below)
             if (consecutivePairs === 0) isValid = true;
        }
        
        if (isValid) {
            candidates = potential;
            break;
        }
        attempts++;
    }
    
    // Fallback
    if (candidates.length === 0) {
        candidates = shuffle(validIds).slice(0, length).sort((a,b) => a - b);
    }
    
    return candidates;
};

function GameWrapper() {
    const searchParams = useSearchParams();
    const name = searchParams.get("name") || "Explorer";

    return (
        <RabbitRiverGame 
            studentName={name}
            className="Class 4"
            totalRounds={12}
            sequenceGenerator={generateClass4Sequence}
        />
    );
}

export default function Grade4Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>}>
            <GameWrapper />
        </Suspense>
    );
}
