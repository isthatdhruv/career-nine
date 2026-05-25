# Phase 11: Safe Submission Pattern - Research

**Researched:** 2026-03-07
**Domain:** Reliable assessment answer submission, draft auto-save, save-before-delete pattern
**Confidence:** HIGH

## Summary

Phase 11 addresses two reliability problems in the current assessment submission flow: (1) the controller uses delete-then-save ordering for answers and raw scores, risking data loss if the transaction partially fails, and (2) student answer progress exists only in browser localStorage, which is lost on browser crash/tab close.

The current `AssessmentAnswerController.submitAssessmentAnswers()` (line 304) deletes old answers before saving new ones. While `@Transactional` provides atomicity within a single JVM, there are edge cases (JVM crash, connection pool timeout during long transactions with 200 concurrent students) where the delete can commit but the save does not. The fix is to reverse the order: save new answers first, then delete old ones. Since the `assessment_answer` table has no unique constraint on `(user_student_id, assessment_id, questionnaire_question_id)`, saving new records before deleting old ones is safe -- duplicates only exist momentarily and the old ones are cleaned up in the same transaction.

For draft auto-save, a new backend endpoint will accept a JSON blob of the student's current localStorage answers and store it in Redis with a TTL. The frontend will call this every 30 seconds. On page reload after a crash, the frontend checks Redis for a saved draft before defaulting to empty state.

**Primary recommendation:** Reorder operations to save-before-delete in the submit endpoint, add a simple draft-save/draft-restore endpoint pair backed by Redis, and add a 30-second auto-save interval in the frontend.

## Standard Stack

### Core (Already in Place)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Spring Data Redis + Lettuce | 2.5.x | Redis operations for draft storage | Already configured in Phase 10 |
| Spring Boot @Transactional | 2.5.5 | Transaction management for submit | Already in use on submit endpoint |
| RedisTemplate<String, Object> | 2.5.x | Draft POJO serialization | Already configured with GenericJackson2JsonRedisSerializer |

### Supporting (No New Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GenericJackson2JsonRedisSerializer | (bundled) | Serialize draft JSON to Redis | Already configured in RedisConfig.java |

### No New Dependencies Required

This phase uses only existing infrastructure from Phase 10. No new Maven or npm dependencies are needed.

## Architecture Patterns

### Pattern 1: Save-Before-Delete for Answer Submission

**What:** Reverse the operation order in the submit endpoint so new data is persisted before old data is removed.

**When to use:** Any replace-all-records pattern where data loss is unacceptable.

**Current code (AssessmentAnswerController.java lines 303-323):**
```java
// CURRENT (UNSAFE): delete-then-save
assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);
assessmentAnswerRepository.saveAll(answersToSave);

assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());
assessmentRawScoreRepository.saveAll(rawScoresToSave);
```

**Proposed code:**
```java
// SAFE: save-before-delete
// 1. Save new answers first (duplicates exist momentarily)
assessmentAnswerRepository.saveAll(answersToSave);

// 2. Delete old answers (those NOT in the new batch)
//    Since new answers have new auto-generated IDs, delete by old IDs
assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);
// Re-save new answers (they were deleted by the broad delete above)
assessmentAnswerRepository.saveAll(answersToSave);
```

**Better approach -- use explicit ID-based deletion:**
```java
// SAFE: save new, then delete only old records by ID
// 1. Collect existing answer IDs before saving
List<Long> existingAnswerIds = assessmentAnswerRepository
    .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId)
    .stream().map(AssessmentAnswer::getAssessmentAnswerId).collect(Collectors.toList());

// 2. Save new answers (new auto-generated IDs, no conflict)
assessmentAnswerRepository.saveAll(answersToSave);

// 3. Delete only the OLD answers by their specific IDs
if (!existingAnswerIds.isEmpty()) {
    assessmentAnswerRepository.deleteAllById(existingAnswerIds);
}

// Same pattern for raw scores:
List<Long> existingScoreIds = assessmentRawScoreRepository
    .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
    .stream().map(AssessmentRawScore::getAssessmentRawScoreId).collect(Collectors.toList());

assessmentRawScoreRepository.saveAll(rawScoresToSave);

if (!existingScoreIds.isEmpty()) {
    assessmentRawScoreRepository.deleteAllById(existingScoreIds);
}
```

**Why this is safe:** If the transaction fails after saving new answers but before deleting old ones, the rollback removes the new answers and old ones remain intact. If it fails after deleting old ones, the rollback restores them too. In no scenario is data lost within the transaction boundary.

**Confidence:** HIGH -- standard JPA/Hibernate transactional behavior, well-documented.

### Pattern 2: Draft Auto-Save to Redis

**What:** Periodically back up localStorage answer state to Redis so it survives browser crashes.

**Key design:**
- Redis key: `career9:draft:{studentId}:{assessmentId}`
- TTL: 24 hours (matches session TTL)
- Value: JSON blob of all answer state (answers, rankingAnswers, textAnswers, savedForLater, skipped, elapsedTime, completedGames)
- Backend: Two simple endpoints -- `POST /assessment-answer/draft-save` and `GET /assessment-answer/draft-restore/{studentId}/{assessmentId}`
- Frontend: 30-second `setInterval` that calls draft-save, plus a check on page load

**Draft save endpoint:**
```java
@PostMapping("/draft-save")
public ResponseEntity<?> saveDraft(@RequestBody Map<String, Object> draftData) {
    Long studentId = ((Number) draftData.get("userStudentId")).longValue();
    Long assessmentId = ((Number) draftData.get("assessmentId")).longValue();

    String key = "career9:draft:" + studentId + ":" + assessmentId;
    redisTemplate.opsForValue().set(key, draftData, 24, TimeUnit.HOURS);

    return ResponseEntity.ok(Map.of("status", "saved"));
}
```

**Draft restore endpoint:**
```java
@GetMapping("/draft-restore/{studentId}/{assessmentId}")
public ResponseEntity<?> restoreDraft(@PathVariable Long studentId, @PathVariable Long assessmentId) {
    String key = "career9:draft:" + studentId + ":" + assessmentId;
    Object draft = redisTemplate.opsForValue().get(key);

    if (draft == null) {
        return ResponseEntity.status(404).body(Map.of("status", "no_draft"));
    }
    return ResponseEntity.ok(draft);
}
```

**Frontend auto-save hook (30s interval):**
```typescript
useEffect(() => {
    const interval = setInterval(async () => {
        const userStudentId = localStorage.getItem('userStudentId');
        const assessmentId = localStorage.getItem('assessmentId');
        if (!userStudentId || !assessmentId) return;

        const draft = {
            userStudentId: parseInt(userStudentId),
            assessmentId: parseInt(assessmentId),
            answers,
            rankingAnswers,
            textAnswers,
            savedForLater: serializeSets(savedForLater),
            skipped: serializeSets(skipped),
            elapsedTime,
            completedGames,
            timestamp: Date.now(),
        };

        try {
            await fetch(`${import.meta.env.VITE_API_URL}/assessment-answer/draft-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
        } catch (e) {
            console.warn('Draft auto-save failed:', e);
        }
    }, 30000);

    return () => clearInterval(interval);
}, [answers, rankingAnswers, textAnswers, savedForLater, skipped, elapsedTime, completedGames]);
```

**Confidence:** HIGH -- simple Redis GET/SET, well within existing infrastructure.

### Pattern 3: Draft Cleanup on Submission

**What:** Delete the Redis draft after successful submission so recovery doesn't offer stale data.

```java
// In submitAssessmentAnswers, after successful save:
String draftKey = "career9:draft:" + userStudentId + ":" + assessmentId;
redisTemplate.delete(draftKey);
```

**Confidence:** HIGH

### Recommended Project Structure

No new files beyond what's strictly needed:

```
Backend changes:
  AssessmentAnswerController.java     # Reorder to save-before-delete + draft endpoints
  AssessmentSessionService.java       # Add draft save/restore/delete methods

Frontend changes:
  hooks/useAutoSaveDraft.ts           # New hook for 30s auto-save interval
  pages/SectionQuestionPage.tsx       # Use auto-save hook, add draft restore on mount
```

### Anti-Patterns to Avoid

- **Storing full entity objects in Redis drafts:** The draft should store raw IDs and primitive values (the same format as localStorage), not JPA entities. JPA entities have circular references and lazy-load proxies that fail to serialize.

- **Using @Async for draft saves:** Don't make the draft-save endpoint async. It's a simple Redis SET with 24h TTL -- it completes in <1ms. Making it async adds complexity without benefit.

- **Compressing draft data:** Assessment answer payloads are typically 5-50KB. Redis handles this trivially. Don't add compression complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction safety | Custom two-phase commit | `@Transactional` with reordered operations | Spring's proxy-based transaction management handles rollback automatically |
| Draft serialization | Custom serializer | GenericJackson2JsonRedisSerializer (already configured) | Handles Map<String, Object> natively |
| Duplicate submission prevention | Custom locking | Existing SET NX idempotency from Phase 10 | Already implemented and tested |
| Draft TTL management | Custom expiry scheduler | Redis TTL on SET | Built-in Redis feature |

**Key insight:** The existing Redis infrastructure from Phase 10 handles everything needed. No new libraries or infrastructure. The primary work is reordering existing Java code and adding two simple REST endpoints.

## Common Pitfalls

### Pitfall 1: @Transactional Not Working Due to Self-Invocation
**What goes wrong:** If a `@Transactional` method calls another method in the same class, the inner call bypasses the proxy and runs outside the transaction.
**Why it happens:** Spring AOP proxies only intercept external calls.
**How to avoid:** The submit method is already a single `@Transactional` method with all DB operations inline. Keep it that way. Don't extract the save-before-delete logic into a separate method in the same controller.
**Warning signs:** Data inconsistencies that only appear under load.

### Pitfall 2: Draft Auto-Save Causing Unnecessary Network Traffic
**What goes wrong:** Sending the full answer state every 30 seconds even when nothing has changed wastes bandwidth, especially on mobile.
**Why it happens:** Naive interval-based approach without change detection.
**How to avoid:** Track a "dirty" flag that is set when any answer state changes and cleared after a successful save. Only send the draft when dirty.
**Warning signs:** Network tab showing POST requests every 30s with identical payloads.

### Pitfall 3: Draft Restore Overwriting Newer LocalStorage State
**What goes wrong:** Student answers some questions, browser doesn't crash, but on a fresh page load the Redis draft (which might be older) overwrites the localStorage state.
**Why it happens:** Draft restore runs without checking if localStorage has newer data.
**How to avoid:** Include a timestamp in both the Redis draft and localStorage. On load, compare timestamps and use the newer one. If localStorage has answers and they're newer than the Redis draft, keep localStorage.
**Warning signs:** Student reports "my answers disappeared" after navigating away and back.

### Pitfall 4: Bulk-Submit Endpoints Still Using Delete-Then-Save
**What goes wrong:** The fix is applied to `/submit` but the three bulk endpoints (`/bulk-submit`, `/bulk-submit-with-students`, `/bulk-submit-by-rollnumber`) still use the old pattern.
**Why it happens:** The fix scope is too narrow.
**How to avoid:** Apply save-before-delete to ALL endpoints that replace answers. However, per prior decisions, bulk-submit endpoints are excluded from idempotency -- but they still need the safe ordering fix.
**Warning signs:** Data loss reports from bulk upload operations.

### Pitfall 5: Redis Draft Size Under allkeys-lru
**What goes wrong:** Under memory pressure, Redis evicts draft data before the student can recover it.
**Why it happens:** allkeys-lru evicts least-recently-used keys regardless of purpose.
**How to avoid:** Draft data is small (5-50KB per student) and accessed frequently (every 30s). With 200 concurrent students, total draft storage is ~10MB maximum. This is well within the ~1.5GB Redis budget. The 30s access pattern keeps drafts "hot" and unlikely to be evicted.
**Warning signs:** Draft restore returning null for active students.

### Pitfall 6: Concurrent Save-Before-Delete with Same Student
**What goes wrong:** Two concurrent submissions from the same student could interleave save and delete operations.
**Why it happens:** Without proper locking, two threads could both fetch existing IDs, both save new answers, then both delete -- leaving only one set of answers.
**How to avoid:** The existing SET NX idempotency lock from Phase 10 already prevents this. Only one submission can proceed per student+assessment. The second gets a 409 or cached result.
**Warning signs:** This is already handled. Verify the idempotency lock is acquired BEFORE any DB operations.

## Code Examples

### Save-Before-Delete Implementation (Complete)

```java
// In AssessmentAnswerController.submitAssessmentAnswers():
// Replace lines 303-323 with:

// 6. SAFE: Save-before-delete pattern
// 6a. Collect IDs of existing answers and scores BEFORE any writes
List<Long> existingAnswerIds = assessmentAnswerRepository
    .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId)
    .stream()
    .map(AssessmentAnswer::getAssessmentAnswerId)
    .collect(java.util.stream.Collectors.toList());

List<Long> existingScoreIds = assessmentRawScoreRepository
    .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
    .stream()
    .map(AssessmentRawScore::getAssessmentRawScoreId)
    .collect(java.util.stream.Collectors.toList());

// 6b. Save new answers and scores first (safe: new auto-generated IDs)
assessmentAnswerRepository.saveAll(answersToSave);
assessmentRawScoreRepository.saveAll(rawScoresToSave);

// 6c. Delete old answers and scores by their specific IDs
if (!existingAnswerIds.isEmpty()) {
    assessmentAnswerRepository.deleteAllById(existingAnswerIds);
}
if (!existingScoreIds.isEmpty()) {
    assessmentRawScoreRepository.deleteAllById(existingScoreIds);
}
```

### Draft Auto-Save Hook (Frontend)

```typescript
// hooks/useAutoSaveDraft.ts
import { useEffect, useRef, useCallback } from 'react';

export function useAutoSaveDraft(
  answers: Record<string, Record<number, number[]>>,
  rankingAnswers: Record<string, Record<number, Record<number, number>>>,
  textAnswers: Record<string, Record<number, Record<number, string>>>,
  savedForLater: Record<string, Set<number>>,
  skipped: Record<string, Set<number>>,
  elapsedTime: number,
  completedGames: Record<number, boolean>,
  intervalMs: number = 30000
) {
  const dirtyRef = useRef(false);
  const lastSavedRef = useRef<string>('');

  // Mark dirty on any state change
  useEffect(() => {
    dirtyRef.current = true;
  }, [answers, rankingAnswers, textAnswers, savedForLater, skipped, completedGames]);

  // Serialize Sets for transport
  const serializeSets = useCallback((sets: Record<string, Set<number>>) => {
    const result: Record<string, number[]> = {};
    for (const key in sets) {
      result[key] = Array.from(sets[key]);
    }
    return result;
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;

      const userStudentId = localStorage.getItem('userStudentId');
      const assessmentId = localStorage.getItem('assessmentId');
      if (!userStudentId || !assessmentId) return;

      const draft = {
        userStudentId: parseInt(userStudentId),
        assessmentId: parseInt(assessmentId),
        answers,
        rankingAnswers,
        textAnswers,
        savedForLater: serializeSets(savedForLater),
        skipped: serializeSets(skipped),
        elapsedTime,
        completedGames,
        timestamp: Date.now(),
      };

      // Skip if payload hasn't changed (structural equality)
      const serialized = JSON.stringify(draft);
      if (serialized === lastSavedRef.current) {
        dirtyRef.current = false;
        return;
      }

      try {
        await fetch(`${import.meta.env.VITE_API_URL}/assessment-answer/draft-save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: serialized,
        });
        dirtyRef.current = false;
        lastSavedRef.current = serialized;
      } catch (e) {
        console.warn('Draft auto-save failed:', e);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [answers, rankingAnswers, textAnswers, savedForLater, skipped, elapsedTime, completedGames, intervalMs, serializeSets]);
}
```

### Draft Restore on Page Load

```typescript
// In SectionQuestionPage.tsx or a parent component:
useEffect(() => {
  const restoreDraft = async () => {
    const userStudentId = localStorage.getItem('userStudentId');
    const assessmentId = localStorage.getItem('assessmentId');
    if (!userStudentId || !assessmentId) return;

    // Check if localStorage already has answers (prefer newer)
    const localAnswers = localStorage.getItem('assessmentAnswers');
    const localTimestamp = localStorage.getItem('assessmentDraftTimestamp');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/assessment-answer/draft-restore/${userStudentId}/${assessmentId}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) return; // No draft in Redis

      const draft = await response.json();

      // Only restore from Redis if localStorage is empty or older
      if (!localAnswers || (localTimestamp && draft.timestamp > parseInt(localTimestamp))) {
        setAnswers(draft.answers || {});
        setRankingAnswers(draft.rankingAnswers || {});
        setTextAnswers(draft.textAnswers || {});
        // Deserialize Sets
        const restoredSavedForLater: Record<string, Set<number>> = {};
        for (const key in draft.savedForLater) {
          restoredSavedForLater[key] = new Set(draft.savedForLater[key]);
        }
        setSavedForLater(restoredSavedForLater);
        // ... same for skipped
        setElapsedTime(draft.elapsedTime || 0);
        setCompletedGames(draft.completedGames || {});

        console.log('Restored draft from Redis (timestamp:', draft.timestamp, ')');
      }
    } catch (e) {
      console.warn('Draft restore failed:', e);
    }
  };

  restoreDraft();
}, []); // Run once on mount
```

### AssessmentSessionService Draft Methods

```java
// Add to AssessmentSessionService.java:
private static final String DRAFT_KEY_PREFIX = "career9:draft:";
private static final int DRAFT_TTL_HOURS = 24;

public void saveDraft(Long studentId, Long assessmentId, Object draftData) {
    String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
    redisTemplate.opsForValue().set(key, draftData, DRAFT_TTL_HOURS, TimeUnit.HOURS);
}

public Object getDraft(Long studentId, Long assessmentId) {
    String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
    return redisTemplate.opsForValue().get(key);
}

public void deleteDraft(Long studentId, Long assessmentId) {
    String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
    redisTemplate.delete(key);
}
```

## Existing Codebase Analysis

### Files That Need Modification

| File | Change | Scope |
|------|--------|-------|
| `AssessmentAnswerController.java` | Reorder to save-before-delete in `/submit`; add draft-save, draft-restore endpoints; delete draft on successful submission | Lines 303-323 (submit), new endpoints |
| `AssessmentSessionService.java` | Add saveDraft/getDraft/deleteDraft methods | ~15 lines of new methods |
| `SectionQuestionPage.tsx` | Use auto-save hook; add draft restore on mount; store timestamp in localStorage | Hook integration, mount effect |
| `useAutoSaveDraft.ts` (NEW) | Auto-save hook with dirty tracking and 30s interval | New file, ~70 lines |

### Files That May Need Modification

| File | Change | When |
|------|--------|------|
| `AssessmentAnswerController.java` bulk endpoints | Apply save-before-delete to `/bulk-submit`, `/bulk-submit-with-students`, `/bulk-submit-by-rollnumber` | If bulk upload data safety matters (recommended) |

### Key Observations from Current Code

1. **The `@Transactional` annotation is already on the submit method** (line 109). This means save-before-delete will work correctly within the transaction boundary. No changes to transaction config needed.

2. **The `deleteByUserStudent_UserStudentIdAndAssessment_Id` method** (used on line 304) is a Spring Data derived delete that deletes ALL answers for a student+assessment pair. For save-before-delete, we need to collect existing IDs first and delete by ID instead.

3. **The `findByUserStudent_UserStudentIdAndAssessment_Id` method** already exists in the repository (line 43). This can be used to collect existing answer IDs before saving new ones.

4. **The `deleteAllById` method** is inherited from `JpaRepository` -- no new repository method needed.

5. **localStorage keys used by the frontend:**
   - `assessmentAnswers` -- main answer state
   - `assessmentRankingAnswers` -- ranking question state
   - `assessmentTextAnswers` -- text question state
   - `assessmentSavedForLater` -- saved for later flags
   - `assessmentSkipped` -- skipped flags
   - `assessmentElapsedTime` -- timer
   - `assessmentCompletedGames` -- game completion flags
   - `assessmentSeenSectionInstructions` -- instruction popups
   - `userStudentId`, `assessmentId` -- session identifiers

6. **Existing retry logic in frontend** (lines 685-737): The frontend already retries 3 times with exponential backoff. Draft auto-save complements this by ensuring data persists even if all retries fail.

7. **The idempotency lock from Phase 10** prevents concurrent submissions, so save-before-delete won't face race conditions between two submissions for the same student.

## Concurrency Analysis (200 Concurrent Students)

**Scenario:** 200 students submit simultaneously.

**With current setup:**
- Each student has a unique (userStudentId, assessmentId) pair
- The SET NX idempotency lock ensures at most one submission per student
- Different students' submissions don't conflict (different rows)
- `@Transactional` with default isolation (READ_COMMITTED on MySQL) is sufficient

**Database load:**
- 200 concurrent transactions, each doing: SELECT (collect IDs) + INSERT (new answers) + DELETE (old answers by ID)
- Typical assessment: 40-100 answers per student
- Total operations: ~200 * 3 = 600 database operations (batched via `saveAll`)
- MySQL 5.7 handles this comfortably with InnoDB row-level locking

**Redis load:**
- 200 idempotency lock checks (SET NX)
- 200 draft deletes on success
- 200 result caches
- Redis handles ~100K ops/sec on a single instance. 600 ops is trivial.

**Confidence:** HIGH -- each student's data is independent. No cross-student contention.

## Open Questions

1. **Should bulk-submit endpoints also get save-before-delete?**
   - What we know: Prior decisions exclude bulk-submit from idempotency. But save-before-delete is about data safety, not deduplication.
   - What's unclear: Whether the team considers bulk-submit data-loss acceptable (since it's re-uploadable).
   - Recommendation: Apply save-before-delete to ALL endpoints. It's a simple reordering with no performance cost. Leaving any endpoint with delete-first is a latent bug.

2. **Should draft auto-save use the assessment session token for auth?**
   - What we know: The interceptor validates X-Assessment-Session headers. Draft endpoints could use this.
   - What's unclear: Whether the draft endpoints should be protected by session validation or left open (like the current submit endpoint).
   - Recommendation: Keep it simple -- use the same pattern as the current submit endpoint (no session header required). The studentId+assessmentId in the request body is sufficient for draft key construction.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of `AssessmentAnswerController.java` (965 lines), `AssessmentSessionService.java` (135 lines), `AssessmentAnswerRepository.java`, `AssessmentRawScoreRepository.java`, `SectionQuestionPage.tsx` (1867 lines), `useDebouncedLocalStorage.ts`, `RedisConfig.java`, `AssessmentSession.java`
- **Phase 10 research and plans** -- `10-RESEARCH.md`, `10-02-PLAN.md` for idempotency lock design
- **Spring Data JPA** -- `@Transactional` behavior with `JpaRepository.deleteAllById()` and `saveAll()` -- standard Spring Boot 2.5.x behavior
- **Redis SET with TTL** -- Standard `RedisTemplate.opsForValue().set(key, value, ttl, unit)` pattern already in use in `AssessmentSessionService`

### Secondary (MEDIUM confidence)
- Spring `@Transactional` rollback behavior on JVM crash -- standard documentation states that uncommitted transactions are rolled back by the database when the connection drops. MySQL InnoDB's crash recovery guarantees this.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing infrastructure
- Architecture (save-before-delete): HIGH -- straightforward reordering with well-understood JPA semantics
- Architecture (draft auto-save): HIGH -- simple Redis GET/SET, proven pattern
- Pitfalls: HIGH -- identified from direct code analysis of existing patterns

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain, no version-sensitive findings)
