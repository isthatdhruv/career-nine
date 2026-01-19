"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RabbitRiverGame, { StonePos, RoundResult, shuffle } from "@/components/puzzles/RabbitRiverGame";

// Logic for Grade 3
// 1. Trials: Random, Length 3.
// 2. Rounds 0-2 (Set 1): Length 3.
// 3. Rounds 3-5 (Set 2): If Set 1 (0-2) all correct -> Length 4, Else Length 3.
// 4. Rounds 6-8 (Set 3): If Set 2 (3-5) all correct AND Set 2 was Length 4 -> Length 5, Else Keep.
// 5. Rounds 9-11 (Set 4): Max Length 5.

const generateClass3Sequence = (
    stones: StonePos[], 
    roundIndex: number, 
    history: RoundResult[],
    isTrial: boolean
): number[] => {
    
    // Determine Target Length
    let length = 3;

    if (isTrial) {
        length = 3;
    } else {
        // Main Game Logic
        // Set 1: Rounds 0-3 (4 rounds)
        // Set 2: Rounds 4-7 (4 rounds)
        // Set 3: Rounds 8-11 (4 rounds)

        // Check Set 1 Performance
        const set1Passed = history.filter(h => h.round >= 0 && h.round <= 3 && h.correct).length === 4;
        
        if (roundIndex >= 4) {
            if (set1Passed) {
                 length = 4;
            }
        }
    
        // Check Set 2 Performance
        if (roundIndex >= 8) {
             const set2Passed = history.filter(h => h.round >= 4 && h.round <= 7 && h.correct).length === 4;
             if (set1Passed && set2Passed) {
                 length = 5;
             } else if (set1Passed && !set2Passed) {
                 length = 4; // Stay at 4
             } else if (!set1Passed && set2Passed) {
                 length = 4; // Promotion from 3 to 4
             } else {
                 length = 3;
             }
        }
    }

    // GENERATE SEQUENCE
    // Constraint: 
    // - Length < 5: No consecutive numbers allowed.
    // - Length == 5: Allow at most 1 pair of consecutives (e.g. 2,3 is ok).
    
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
        if (length === 5) {
             // Allow 1 pair
             if (consecutivePairs <= 1) isValid = true;
        } else {
             // Strict no consecutives
             if (consecutivePairs === 0) isValid = true;
        }
        
        if (isValid) {
            candidates = potential;
            break;
        }
        attempts++;
    }
    
    // Fallback if strict generation fails (unlikely for len <= 5 with 10 items)
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
            className="Class 3"
            totalRounds={12}
            sequenceGenerator={generateClass3Sequence}
        />
    );
}

export default function Grade3Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>}>
            <GameWrapper />
        </Suspense>
    );
}
