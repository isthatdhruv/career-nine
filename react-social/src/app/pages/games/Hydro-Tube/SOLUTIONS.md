# Hydro-Tube Game - Complete Solution Documentation

## Overview

This document provides a comprehensive analysis of all valid solutions for the Hydro-Tube pipe puzzle game. The analysis was performed by tracing all possible water paths from the entry point (tile 1, from North) to the exit point (tile 16, to South or East).

---

## Game Mechanics

### Pipe Types

| Pipe | Symbol | Rotation 0° Openings | Description |
|------|--------|---------------------|-------------|
| **straight** | ║ | North ↔ South | Vertical pipe |
| **bend** | ╔ | South ↔ East | L-shaped corner (bottom-right) |
| **t-pipe** | ╦ | West ↔ East ↔ South | T-junction (top closed) |

### Rotation Effects

Rotation is **clockwise**. Each 90° rotation shifts all openings:
- 0° → 90°: North becomes East, East becomes South, etc.

| Pipe | 0° | 90° | 180° | 270° |
|------|-----|------|-------|-------|
| straight | N-S (║) | E-W (═) | N-S (║) | E-W (═) |
| bend | S-E (╔) | W-S (╗) | N-W (╝) | E-N (╚) |
| t-pipe | W-E-S (╦) | N-S-W (╣) | N-E-W (╩) | N-E-S (╠) |

### Water Flow Rules

1. **Entry**: Water enters **tile 1** from the **North** (top)
2. **Exit**: Water must exit **tile 16** to the **South** (bottom) or **East** (right)
3. **Path**: Water flows through connected pipe openings
4. **Solution Format**: Array of 16 rotation values (0, 90, 180, or 270)
   - Non-zero values: Required rotation for that tile
   - Zero (0): "Wildcard" - any rotation accepted (per `checkWin` logic)

---

## Grid Layout

```
 Position:  1   2   3   4
            5   6   7   8
            9  10  11  12
           13  14  15  16

 Row/Col:  (0,0) (0,1) (0,2) (0,3)
           (1,0) (1,1) (1,2) (1,3)
           (2,0) (2,1) (2,2) (2,3)
           (3,0) (3,1) (3,2) (3,3)
```

---

## Pattern A

### Tile Configuration

```
 1: t-pipe    2: bend      3: bend      4: straight
 5: straight  6: bend      7: straight  8: bend
 9: bend     10: bend     11: straight 12: bend
13: straight 14: bend     15: straight 16: bend
```

### Valid Paths: 2

---

#### Path 1: Short Route (7 tiles)

**Route:** `1 → 5 → 9 → 10 → 14 → 15 → 16 → exit(South)`

**Visual:**
```
       1   2   3   4
     ┌───┬───┬───┬───┐
   1 │[╠]│ · │ · │ · │  ↓ Water enters
     ├───┼───┼───┼───┤
   5 │[║]│ · │ · │ · │
     ├───┼───┼───┼───┤
   9 │[╚]│[╗]│ · │ · │
     ├───┼───┼───┼───┤
  13 │ · │[╚]│[═]│[╗]│  ↓ Water exits
     └───┴───┴───┴───┘

[X] = tiles on water path
 ·  = tiles not on path (any rotation works)
```

**Solution Array:**
```javascript
[270, 0, 0, 0, 0, 0, 0, 0, 270, 90, 0, 0, 0, 270, 90, 90]
//1   2  3  4  5  6  7  8   9  10 11 12 13  14  15  16
```

**Required Rotations:**
| Tile | Type | Rotation | Opens | Purpose |
|------|------|----------|-------|---------|
| 1 | t-pipe | 270° | N-E-S | Entry from N, exit to S |
| 5 | straight | 0°/180° | N-S | Pass through vertically |
| 9 | bend | 270° | E-N | Receive from N, send to E |
| 10 | bend | 90° | W-S | Receive from W, send to S |
| 14 | bend | 270° | E-N | Receive from N, send to E |
| 15 | straight | 90°/270° | E-W | Pass through horizontally |
| 16 | bend | 90° | W-S | Receive from W, exit to S |

---

#### Path 2: Long Route (11 tiles)

**Route:** `1 → 2 → 6 → 7 → 8 → 12 → 11 → 10 → 14 → 15 → 16 → exit(South)`

**Visual:**
```
       1   2   3   4
     ┌───┬───┬───┬───┐
   1 │[╠]│[╗]│ · │ · │  ↓ Water enters
     ├───┼───┼───┼───┤
   5 │ · │[╚]│[═]│[╗]│
     ├───┼───┼───┼───┤
   9 │ · │[╔]│[═]│[╝]│  ← Backtrack left
     ├───┼───┼───┼───┤
  13 │ · │[╚]│[═]│[╗]│  ↓ Water exits
     └───┴───┴───┴───┘
```

**Solution Array:**
```javascript
[270, 90, 0, 0, 0, 270, 90, 90, 0, 0, 90, 180, 0, 270, 90, 90]
//1   2  3  4  5   6   7   8  9 10  11  12 13  14  15  16
```

**Required Rotations:**
| Tile | Type | Rotation | Opens | Purpose |
|------|------|----------|-------|---------|
| 1 | t-pipe | 270° | N-E-S | Entry from N, exit to E |
| 2 | bend | 90° | W-S | Receive from W, send to S |
| 6 | bend | 270° | E-N | Receive from N, send to E |
| 7 | straight | 90° | E-W | Pass through horizontally |
| 8 | bend | 90° | W-S | Receive from W, send to S |
| 12 | bend | 180° | N-W | Receive from N, send to W |
| 11 | straight | 90° | E-W | Receive from E, send to W |
| 10 | bend | 0° | S-E | Receive from E, send to S |
| 14 | bend | 270° | E-N | Receive from N, send to E |
| 15 | straight | 90° | E-W | Pass through horizontally |
| 16 | bend | 90° | W-S | Receive from W, exit to S |

> ⚠️ **Note:** Tile 10 has rotation `0` in the solution array, but `0` is treated as "wildcard" by `checkWin`. However, tile 10 **MUST** be 0° for this path to work. This could cause false positives if a player sets tile 10 to a different rotation.

---

## Pattern B

### Tile Configuration

```
 1: bend      2: bend      3: bend      4: straight
 5: bend      6: bend      7: bend      8: t-pipe
 9: bend     10: t-pipe   11: straight 12: bend
13: straight 14: straight 15: bend     16: straight
```

### Valid Paths: 2

---

#### Path 1: Main Route (9 tiles) ✓ Currently in Game

**Route:** `1 → 2 → 6 → 5 → 9 → 10 → 11 → 12 → 16 → exit(South)`

**Visual:**
```
       1   2   3   4
     ┌───┬───┬───┬───┐
   1 │[╚]│[╗]│ · │ · │  ↓ Water enters
     ├───┼───┼───┼───┤
   5 │[╔]│[╝]│ · │ · │  ← Backtrack left
     ├───┼───┼───┼───┤
   9 │[╚]│[╦]│[═]│[╗]│
     ├───┼───┼───┼───┤
  13 │ · │ · │ · │[║]│  ↓ Water exits
     └───┴───┴───┴───┘
```

**Solution Array:**
```javascript
[270, 90, 0, 0, 0, 180, 0, 0, 270, 0, 90, 90, 0, 0, 0, 0]
//1   2  3  4  5   6  7  8   9 10  11  12 13 14 15 16
```

---

#### Path 2: Alternate Route (7 tiles) ⚠️ NOT in Game

**Route:** `1 → 2 → 6 → 7 → 11 → 15 → 16 → exit(East)`

**Visual:**
```
       1   2   3   4
     ┌───┬───┬───┬───┐
   1 │[╚]│[╗]│ · │ · │  ↓ Water enters
     ├───┼───┼───┼───┤
   5 │ · │[╚]│[╗]│ · │
     ├───┼───┼───┼───┤
   9 │ · │ · │[║]│ · │
     ├───┼───┼───┼───┤
  13 │ · │ · │[╚]│[═]│  → Water exits East
     └───┴───┴───┴───┘
```

**Solution Array:**
```javascript
[270, 90, 0, 0, 0, 270, 90, 0, 0, 0, 0, 0, 0, 0, 270, 90]
//1   2  3  4  5   6   7  8  9 10 11 12 13 14  15  16
```

**Required Rotations:**
| Tile | Type | Rotation | Opens | Purpose |
|------|------|----------|-------|---------|
| 1 | bend | 270° | E-N | Entry from N, exit to E |
| 2 | bend | 90° | W-S | Receive from W, send to S |
| 6 | bend | 270° | E-N | Receive from N, send to E |
| 7 | bend | 90° | W-S | Receive from W, send to S |
| 11 | straight | 0°/180° | N-S | Pass through vertically |
| 15 | bend | 270° | E-N | Receive from N, send to E |
| 16 | straight | 90°/270° | E-W | Receive from W, exit to E |

> 💡 **Recommendation:** Consider adding this as an alternate solution in the game for more variety.

---

## Pattern C (Practice/Trial Pattern)

### Tile Configuration

```
 1: bend      2: bend      3: straight  4: bend
 5: straight  6: bend      7: t-pipe    8: straight
 9: bend     10: straight 11: bend     12: straight
13: bend     14: straight 15: straight 16: bend
```

### Valid Paths: 1

---

#### Only Path (11 tiles) ✓ Currently in Game

**Route:** `1 → 2 → 6 → 7 → 11 → 10 → 9 → 13 → 14 → 15 → 16 → exit(South)`

**Visual:**
```
       1   2   3   4
     ┌───┬───┬───┬───┐
   1 │[╚]│[╗]│ · │ · │  ↓ Water enters
     ├───┼───┼───┼───┤
   5 │ · │[╚]│[╦]│ · │
     ├───┼───┼───┼───┤
   9 │[╔]│[═]│[╝]│ · │  ← Backtrack left
     ├───┼───┼───┼───┤
  13 │[╚]│[═]│[═]│[╗]│  ↓ Water exits
     └───┴───┴───┴───┘
```

**Solution Array:**
```javascript
[270, 90, 0, 0, 0, 270, 0, 0, 0, 90, 180, 0, 270, 90, 90, 90]
//1   2  3  4  5   6  7  8  9  10  11 12  13  14  15  16
```

**Required Rotations:**
| Tile | Type | Rotation | Opens | Purpose |
|------|------|----------|-------|---------|
| 1 | bend | 270° | E-N | Entry from N, exit to E |
| 2 | bend | 90° | W-S | Receive from W, send to S |
| 6 | bend | 270° | E-N | Receive from N, send to E |
| 7 | t-pipe | 0° | W-E-S | Receive from W, send to S |
| 11 | bend | 180° | N-W | Receive from N, send to W |
| 10 | straight | 90° | E-W | Receive from E, send to W |
| 9 | bend | 0° | S-E | Receive from E, send to S |
| 13 | bend | 270° | E-N | Receive from N, send to E |
| 14 | straight | 90° | E-W | Pass through horizontally |
| 15 | straight | 90° | E-W | Pass through horizontally |
| 16 | bend | 90° | W-S | Receive from W, exit to S |

---

## Summary Table

| Pattern | Unique Paths | Game Solutions | Missing Solutions | Status |
|---------|--------------|----------------|-------------------|--------|
| **A** | 2 | 2 | 0 | ✓ Complete |
| **B** | 2 | 1 | 1 (East exit) | ⚠️ Missing alternate |
| **C** | 1 | 1 | 0 | ✓ Complete |

---

## Total Combination Counts

When counting all possible tile rotations (including non-path tiles that can have any rotation):

| Pattern | Unique Paths | Non-Path Tiles | Total Combinations |
|---------|--------------|----------------|-------------------|
| A | 2 | 9 and 5 | 4^9 + 4^5 = **263,168** |
| B | 2 | 7 and 9 | 4^7 + 4^9 = **278,528** |
| C | 1 | 5 | 4^5 = **1,024** |

---

## Code Reference

### Solution Arrays in Game

```typescript
// Pattern A
solutions: [
  [270, 90, 0, 0, 0, 270, 90, 90, 0, 0, 90, 180, 0, 270, 90, 90],  // Path 2 (long)
  [270, 0, 0, 0, 0, 0, 0, 0, 270, 90, 0, 0, 0, 270, 90, 90]         // Path 1 (short)
]

// Pattern B
solutions: [
  [270, 90, 0, 0, 0, 180, 0, 0, 270, 0, 90, 90, 0, 0, 0, 0]         // Path 1 only
  // Missing: [270, 90, 0, 0, 0, 270, 90, 0, 0, 0, 0, 0, 0, 0, 270, 90]  // Path 2 (East exit)
]

// Pattern C
solutions: [
  [270, 90, 0, 0, 0, 270, 0, 0, 0, 90, 180, 0, 270, 90, 90, 90]     // Only path
]
```

### checkWin Logic

```typescript
const checkWin = (currentRotations: Record<number, number>): boolean => {
  const playerRotations = Array.from({ length: 16 }, (_, i) => currentRotations[i + 1] || 0);
  return currentPattern.solutions.some((solution) =>
    solution.every((solRot, i) => {
      const playerRotation = playerRotations[i];
      return solRot === 0 || solRot === playerRotation;  // 0 = wildcard
    })
  );
};
```

---

## Recommendations

1. **Add Missing Solution for Pattern B:**
   ```typescript
   // Add to Pattern B solutions array:
   [270, 90, 0, 0, 0, 270, 90, 0, 0, 0, 0, 0, 0, 0, 270, 90]
   ```

2. **Consider Wildcard Logic:** The `0 = wildcard` approach works but could cause edge cases where path tiles that happen to need 0° rotation get treated as wildcards.

3. **Documentation:** Keep this file updated when adding new patterns or solutions.

---

*Generated: February 2026*
*Analysis performed using path-based DFS solver*
