---
created: 2026-02-06T$(date "+%H:%M")
title: Remove feedback overlay and fix trial retry in Rabbit Path game
area: ui
files:
  - react-social/src/app/pages/games/Rabbit-Path/RabbitPathGame.tsx:139-285
---

## Problem

The Rabbit Path game was showing visual feedback (✅/❌ overlay) after every round which was distracting. Additionally, in trial/practice mode, when a student made a mistake, the game would generate a completely new sequence instead of allowing them to retry the same sequence - making it harder to learn.

## Solution

1. Removed the feedback overlay completely (lines 983-1005 commented out)
2. Added `trialSequence` state to store the current trial sequence
3. Created `retryWithSameSequence()` function that replays the stored sequence without generating a new one
4. Modified `evaluateAndAdvance()` to use retry function in trial mode
5. Modified `startRound()` to store sequence when in trial mode
6. Used ref pattern (`retryRef`) to avoid callback dependency issues
7. Reduced transition delays from 1000ms/700ms to 500ms
