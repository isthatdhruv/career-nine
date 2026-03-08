---
created: 2026-02-06T12:36
title: Add device detection warning to assessment pages
area: ui
files:
  - react-social/src/app/pages/StudentLogin/AllottedAssessmentPage.tsx:20-62
---

## Problem

Students were able to start assessments on mobile devices, tablets, and iPads, which provides a poor user experience and makes it difficult to complete assessments properly. The assessment interface is designed for desktop/laptop computers with larger screens and full keyboards.

## Solution

Implemented device detection in `AllottedAssessmentPage.tsx`:
1. Added `isMobileOrTablet()` function that detects:
   - Mobile phones (iPhone, Android, BlackBerry, Windows Phone)
   - Tablets (iPad, Android tablets, Kindle)
   - Small screens (≤1024px width)
2. Check runs before allowing assessment start
3. Shows professional warning modal with:
   - Red warning icon
   - Clear "Desktop Required" message
   - Yellow highlighted instruction box
   - "I Understand" button to dismiss

This pattern should be applied to other assessment-related pages:
- GeneralInstructionsPage
- AssessmentPage (main assessment interface)
- Any other pages where students interact with assessments

Next steps: Audit all assessment pages and add similar device detection where appropriate.
