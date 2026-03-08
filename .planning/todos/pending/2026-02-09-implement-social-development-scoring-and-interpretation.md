---
created: 2026-02-09T06:17
title: Implement Social Development scoring and interpretation
area: ui
files:
  - react-social/src/app/pages/StudentDashboard/StudentDashboard.tsx
---

## Problem

The Social Development tab in the StudentDashboard needs cumulative scoring logic and tier-based interpretation display. Currently the tab exists in the navigation but lacks the scoring implementation.

**Assessment Structure:**
- 9 questions in the Social Development section
- Each question has 3 options, all mapped to the same MQT but with different score mappings
- Max score per question: 2 (from the selected option)
- Max cumulative score: 18

**Interpretation Tiers:**

| Score Range | Tier | Traits |
|-------------|------|--------|
| 0 - 6 | Fact-Focused | Listens to exactly what is said; prefers clear instructions over hints; finds "white lies" or sarcasm confusing |
| 7 - 12 | Clue-Spotter | Usually tells when a friend is being funny; knows mistakes are different from being mean; may find complex bluffs tricky |
| 13 - 18 | Mind-Reading | Tracks layers of thoughts easily; understands subtle commands and hints; can see through "double bluffs" and tricks |

**Cultural Context Note:** Each tier's interpretation is prefaced with: "In our cultural context, social 'politeness' often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence."

## Solution

1. Fetch the student's answers for the Social Development section questions
2. For each answered question, get the selected option's MQT score
3. Sum all 9 scores to get cumulative total (0-18)
4. Map cumulative score to the appropriate tier (0-6, 7-12, 13-18)
5. Display the interpretation text with traits in the Social Development tab
6. Overview tab should include Social Development summary alongside the other 4 areas
