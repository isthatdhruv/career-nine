# Dev Auto-Fill for Allotted Assessments — Design

**Date:** 2026-05-12
**Scope:** `career-nine-assessment/` (student-facing Vite app)
**Environment gate:** `staging-assessment.career-9.com`, `localhost`, `127.0.0.1` only

## Goal

Provide a one-click dev affordance on the Allotted Assessment page that:

1. Starts the assessment for the logged-in student (skipping the demographic gate).
2. Pre-fills every question with random, rule-valid answers in localStorage.
3. Navigates directly to the first section's first question so the tester can review the auto-filled answers in the existing UI, edit any, and submit via the existing Submit button.

The feature must be invisible and unreachable on the production hostname (`assessment.career-9.com`).

## Non-goals

- No backend changes. No new endpoints, no DB writes beyond what `startAssessment` and `submit` already do.
- No changes to the assessment-taking page (`SectionQuestionPage`). It already reads pre-filled state from localStorage on mount, so the auto-fill flow just needs to prime localStorage and navigate.
- No deterministic / seeded randomness. `Math.random()` is fine; this is for manual testing.
- No proctoring data generation. Snapshots will be near-empty; backend accepts this.
- No game-option synthesis. Games require real interaction; questions whose only "answer" is a game stay unanswered (the existing submit-warning modal handles this).

## User flow

1. Tester logs in as a student on `staging-assessment.career-9.com` (or `localhost`).
2. Allotted-assessment page shows each assessment card with the normal **Start Assessment** button. Below it, a secondary **⚡ Dev: Auto-fill & Start** button is visible (only on staging/local).
3. Tester clicks Auto-fill. Spinner; under the hood:
   - `localStorage.assessmentId` is set.
   - `fetchAssessmentData(assessmentId)` populates `sessionStorage.assessmentData` with the full questionnaire.
   - `POST /assessments/startAssessment` is called (creates the StudentAssessmentMapping, returns session token).
   - `generateRandomAnswers(questionnaire)` walks every section/question and produces three answer maps.
   - The maps are written to `localStorage` under the keys SectionQuestionPage reads (`assessmentAnswers`, `assessmentRankingAnswers`, `assessmentTextAnswers`).
   - Stale-state keys (`assessmentElapsedTime`, `assessmentSavedForLater`, `assessmentSkipped`) are reset.
4. Tester is navigated to `/studentAssessment/sections/<firstSectionId>/questions/0`. The existing page mounts, picks up the pre-filled state, lights up the question-navigation grid green, and behaves identically to a real session from this point onward — edit any answer, click through, submit.

## Architecture

Three files, all under `career-nine-assessment/src/`:

```
src/
├── utils/
│   ├── devMode.ts          # NEW — isDevAutoFillEnabled()
│   └── devAutoFill.ts      # NEW — generateRandomAnswers(questionnaire)
└── pages/
    └── AllottedAssessmentPage.tsx   # MODIFIED — adds DevAutoFillButton + handler
```

No other files are touched.

### `utils/devMode.ts`

Single helper, exported as a named function:

```ts
export function isDevAutoFillEnabled(): boolean {
  const host = window.location.hostname;
  return (
    host === 'staging-assessment.career-9.com' ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}
```

Used at render time:

```tsx
{isDevAutoFillEnabled() && <DevAutoFillButton ... />}
```

On `assessment.career-9.com` the function returns `false`, the button does not render, and the handler is never reachable. There is no `dangerouslySetInnerHTML`, no env-var that could be misconfigured in production builds — just a hostname check.

### `utils/devAutoFill.ts`

Pure function. No React, no I/O, no API calls.

```ts
type Answers = Record<string, Record<number, number[]>>;
type RankingAnswers = Record<string, Record<number, Record<number, number>>>;
type TextAnswers = Record<string, Record<number, Record<number, string>>>;

export function generateRandomAnswers(questionnaire: any): {
  answers: Answers;
  rankingAnswers: RankingAnswers;
  textAnswers: TextAnswers;
};
```

For each section and each question:

- **Skip** if every option is a game option (`options.every(o => o.isGame)`).

- **Ranking** (`question.questionType === 'ranking'`):
  - Take all non-game options, shuffle, assign ranks `1..n`.
  - Write to `rankingAnswers[sectionId][questionnaireQuestionId] = { [optionId]: rank }`.

- **Text / MQT-typed** (`question.questionType === 'text'` or `question.isMQTtyped === true`):
  - For input index `0`: 50/50 pick a random existing option's `optionText` (so the backend's exact-match path scores it via MQT scores) OR write `"dev-autofill-<questionId>-0"` (falls through as `textResponse`).
  - Write to `textAnswers[sectionId][questionnaireQuestionId][0]`.

- **MCQ (default)**:
  - Resolve `(min, max)` from `optionsRule` + `optionsCount`, falling back to the legacy rule used in `SectionQuestionPage.tsx:494-506`:
    - `optionsRule === 'min'` → `min = optionsCount, max = 0` (unlimited).
    - `optionsRule === 'max'` → `min = 1, max = optionsCount`.
    - `optionsRule === 'equal'` → `min = max = optionsCount`.
    - No rule, `maxOptionsAllowed === 0` → `min = 1, max = 0` (unlimited).
    - No rule otherwise → `min = minOptionsAllowed ?? maxOptionsAllowed, max = maxOptionsAllowed`.
  - Normalize unlimited: if `max === 0` after resolution, set `max = options.length` (using the count of non-game options).
  - Clamp: `min = max(1, min)`, `max = min(options.length, max)`, and if `min > max`, force `min = max`.
  - Pick a random integer `k ∈ [min, max]`, shuffle the non-game options, take the first `k` `optionId`s.
  - Write to `answers[sectionId][questionnaireQuestionId] = [optionId, ...]`.

Returns the three maps. Caller writes them to localStorage.

### `pages/AllottedAssessmentPage.tsx` changes

Add an inline `DevAutoFillButton` component (or a small JSX block) rendered conditionally per card:

```tsx
{isDevAutoFillEnabled() &&
  assessment.isActive &&
  assessment.studentStatus !== 'completed' && (
    <button
      onClick={() => handleDevAutoFill(assessment)}
      disabled={loadingId === assessment.assessmentId}
      className="btn w-100 mt-2"
      style={{
        padding: '0.5rem',
        border: '2px dashed #f97316',
        background: 'rgba(249, 115, 22, 0.06)',
        color: '#c2410c',
        fontSize: '0.85rem',
        fontWeight: 600,
        borderRadius: '10px',
      }}
    >
      ⚡ Dev: Auto-fill & Start
    </button>
  )}
```

Add the handler:

```ts
const handleDevAutoFill = async (assessment: Assessment) => {
  const userStudentId = localStorage.getItem('userStudentId');
  if (!userStudentId) {
    alert('Session expired. Please login again.');
    navigate('/student-login');
    return;
  }
  setLoadingId(assessment.assessmentId);
  try {
    localStorage.setItem('assessmentId', String(assessment.assessmentId));
    await fetchAssessmentData(String(assessment.assessmentId));
    await http.post('/assessments/startAssessment', {
      userStudentId: Number(userStudentId),
      assessmentId: Number(assessment.assessmentId),
    });

    const raw = sessionStorage.getItem('assessmentData');
    if (!raw) throw new Error('Assessment data not loaded');
    const questionnaireData = JSON.parse(raw);
    const questionnaire = Array.isArray(questionnaireData)
      ? questionnaireData[0]
      : questionnaireData;
    if (!questionnaire?.sections?.length) {
      throw new Error('Questionnaire has no sections');
    }

    const { answers, rankingAnswers, textAnswers } =
      generateRandomAnswers(questionnaire);

    localStorage.setItem('assessmentAnswers', JSON.stringify(answers));
    localStorage.setItem('assessmentRankingAnswers', JSON.stringify(rankingAnswers));
    localStorage.setItem('assessmentTextAnswers', JSON.stringify(textAnswers));
    localStorage.setItem('assessmentSavedForLater', JSON.stringify({}));
    localStorage.setItem('assessmentSkipped', JSON.stringify({}));
    localStorage.setItem('assessmentElapsedTime', '0');

    const firstSectionId = questionnaire.sections[0].section.sectionId;
    navigate(`/studentAssessment/sections/${firstSectionId}/questions/0`);
  } catch (err) {
    console.error('Dev auto-fill failed:', err);
    alert('Auto-fill failed. Check console.');
  } finally {
    setLoadingId(null);
  }
};
```

The handler intentionally **skips the demographics check** that the normal `handleStartAssessment` performs at `AllottedAssessmentPage.tsx:62-79`. Backend `startAssessment` and `submit` do not enforce demographics, so this is safe.

## SectionQuestionPage — no changes

The page already reads from these localStorage keys on mount:

- `assessmentAnswers` → `SectionQuestionPage.tsx:152`
- `assessmentRankingAnswers` → `SectionQuestionPage.tsx:159`
- `assessmentTextAnswers` → `SectionQuestionPage.tsx:198`
- `assessmentSavedForLater` → `SectionQuestionPage.tsx:165`
- `assessmentSkipped` → `SectionQuestionPage.tsx:178`

With the dev handler having primed all of them and the questionnaire in `sessionStorage.assessmentData`, the page mounts normally. The question-navigation grid colors questions green per `getQuestionColor` at `SectionQuestionPage.tsx:429-452`. Submit, edit, navigate — all work as in a real session.

## Edge cases

- **Existing in-progress answers in localStorage:** overwritten. Acceptable for a dev tool.
- **Empty questionnaire / zero sections:** handler throws and alerts; nothing partial is written.
- **Question whose only options are games:** generator skips. Question remains unanswered, the grid shows it as not-yet-answered, and the existing submit-warning modal (`SectionQuestionPage.tsx` `handleSubmitAssessment` at line 970) handles the gap. Tester can confirm or fill manually.
- **Demographic fields required:** skipped intentionally. Backend doesn't enforce them at `startAssessment` or `submit`.
- **Already-completed assessment:** button hidden via the `studentStatus !== 'completed'` guard (same as Start button).
- **Already-ongoing assessment:** button still visible; re-clicking overwrites local progress and restarts from question 0. Intentional.
- **Proctoring data:** the proctoring hooks in SectionQuestionPage only begin collecting once that page mounts, so a submission immediately after auto-fill will carry near-empty `perQuestionData`. Backend submission accepts this; proctoring is fire-and-forget at `SectionQuestionPage.tsx:1040-1045`.

## Verification

After implementation, manually verify on `localhost`:

1. Production hostname check: temporarily set hostname via DevTools or hosts file to `assessment.career-9.com` → reload → button absent.
2. Staging/local: button visible on each active, non-completed assessment card.
3. Click button → spinner → lands on first-section-first-question page within a few seconds.
4. Question-navigation grid: every non-game question is green.
5. Open any MCQ with a multi-select rule → selection count is within the rule's bounds.
6. Open any ranking question → every option has a rank, no duplicates, ranks span `1..n`.
7. Open any text question → at least input 0 has either a known option's text or a `dev-autofill-...` string.
8. Click Submit Assessment → confirm modal → POST `/assessment-answer/submit` succeeds → lands on `/studentAssessment/completed`.
9. Inspect the request body — answers count matches the questionnaire's question count (minus any game-only questions).

## Out of scope / future

- A "Submit Now" shortcut button on the section question page (deferred — existing Submit button works fine once you scroll to the end).
- Seeded random for reproducible test runs.
- An equivalent feature in the admin React app for testing report generation flows.
- Backend dev endpoints.
