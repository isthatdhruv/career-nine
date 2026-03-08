# Phase 10: Session Management - Research

**Researched:** 2026-03-07
**Domain:** Redis server-side assessment sessions, idempotent submission via SET NX, shared-device protection
**Confidence:** HIGH

## Summary

Phase 10 adds server-side assessment sessions in Redis to solve two concrete problems: (1) when multiple students share a device, the frontend stores `userStudentId` and `assessmentId` in localStorage, which means Student B could accidentally submit answers under Student A's identity if localStorage is stale; and (2) the current `/assessment-answer/submit` endpoint has no idempotency protection, so network retries (the frontend already retries 3 times with exponential backoff) or double-clicks can cause duplicate submissions.

The solution uses `RedisTemplate<String, Object>` (already configured in Phase 8 with `GenericJackson2JsonRedisSerializer`) to store two types of Redis keys: (a) session keys that bind a student+assessment pair to a start time and session token, validated on every assessment API call; and (b) SET NX idempotency keys that prevent the same student+assessment submission from being processed twice. Both key types use the existing `career9:` namespace convention from Phase 9.

The implementation is backend-only for the core session/idempotency logic (new service + filter/interceptor), with minimal frontend changes to pass a session token in request headers. The existing `startAssessment` endpoint becomes the session creation point, and the existing `submit` endpoint gains idempotency checking.

**Primary recommendation:** Create an `AssessmentSessionService` that uses `RedisTemplate.opsForValue()` for session CRUD and `opsForValue().setIfAbsent()` for idempotent submission. Add a Spring `HandlerInterceptor` to validate session tokens on assessment-related endpoints. Modify `startAssessment` to create sessions and `submit` to check idempotency keys. Frontend passes session token via `X-Assessment-Session` header.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Spring Data Redis (RedisTemplate) | 2.5.x (BOM) | Session storage and idempotency keys in Redis | Already configured in Phase 8. `opsForValue().set()` with TTL for sessions, `setIfAbsent()` (SET NX) for dedup |
| Spring WebMvc HandlerInterceptor | 5.3.x (BOM) | Validate session token on assessment API calls | Standard Spring pattern for cross-cutting request validation without modifying controllers |
| GenericJackson2JsonRedisSerializer | (BOM) | Serialize session objects as JSON in Redis | Already configured on RedisTemplate in Phase 8. Human-readable session data in Redis |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| UUID (java.util.UUID) | JDK 11 | Generate session tokens | `UUID.randomUUID().toString()` for unique session identifiers |
| Spring @Scheduled (optional) | 5.3.x | Cleanup expired sessions if needed | Only if Redis TTL-based expiry is insufficient (it should be sufficient) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HandlerInterceptor | Servlet Filter | Filter runs before Spring DispatcherServlet. Interceptor has access to handler method annotations. Interceptor is more idiomatic for Spring MVC and allows selective endpoint targeting. |
| UUID session token | JWT session token | JWT is self-contained but adds complexity. UUID + Redis lookup is simpler and allows server-side invalidation. JWT cannot be invalidated without Redis anyway. |
| RedisTemplate manual ops | Spring Session | Spring Session is for HTTP session management (JSESSIONID replacement). Our use case is assessment-specific sessions with custom lifecycle. Spring Session is overkill and would change the auth model. |
| SET NX for idempotency | Database unique constraint | DB constraint works but requires schema changes. Redis SET NX is atomic, fast, and auto-expires. The idempotency window (24h) aligns with Redis TTL. |

## Architecture Patterns

### Current State (What Exists)

```
Frontend (localStorage):
  userStudentId → stored on login
  assessmentId  → stored when student clicks "Start Assessment"
  assessmentAnswers → stored as student answers questions

Backend:
  POST /assessments/startAssessment
    → finds StudentAssessmentMapping
    → sets status = "ongoing"
    → returns {success: true}

  POST /assessment-answer/submit
    → extracts userStudentId + assessmentId from request body
    → validates entities exist
    → deletes old answers (prevents duplicates on re-submission)
    → saves new answers + raw scores
    → returns {status: "success", scoresSaved, answersSaved}

No server-side validation that the student making the request is the same
student who started the assessment. No idempotency protection.
```

### Target State (After Phase 10)

```
Frontend:
  localStorage: userStudentId, assessmentId (unchanged)
  X-Assessment-Session header: session token received from startAssessment

Backend:
  POST /assessments/startAssessment
    → finds StudentAssessmentMapping (unchanged)
    → creates Redis session: career9:session:{studentId}:{assessmentId}
      value: {sessionToken, studentId, assessmentId, startTime}
      TTL: 24 hours
    → sets status = "ongoing" (unchanged)
    → returns {success: true, sessionToken: "uuid"}

  Assessment API calls (getby/{id}, submit, etc.):
    → HandlerInterceptor reads X-Assessment-Session header
    → looks up session in Redis
    → validates studentId matches request
    → if invalid: 403 Forbidden
    → if valid: request proceeds

  POST /assessment-answer/submit
    → check idempotency key: career9:submit:{studentId}:{assessmentId}
      using SET NX with 24h TTL
    → if key already exists: return cached result (409 or 200 with same response)
    → if key set successfully: proceed with submission
    → on success: store result in idempotency value
    → existing delete-old-answers logic provides natural re-submission support

Redis Keys:
  career9:session:{studentId}:{assessmentId}  → session object (24h TTL)
  career9:submit:{studentId}:{assessmentId}   → submission dedup (24h TTL)
```

### Pattern 1: Assessment Session Creation in startAssessment

**What:** When a student starts an assessment, create a Redis key binding that student to that assessment with a unique session token. Return the token to the frontend.

**When to use:** Every time `startAssessment` is called.

**Example:**
```java
// AssessmentSessionService.java
@Service
public class AssessmentSessionService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentSessionService.class);
    private static final String SESSION_KEY_PREFIX = "career9:session:";
    private static final long SESSION_TTL_HOURS = 24;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * Create or refresh an assessment session.
     * Key format: career9:session:{studentId}:{assessmentId}
     * Value: AssessmentSession object (serialized as JSON by GenericJackson2JsonRedisSerializer)
     */
    public AssessmentSession createSession(Long studentId, Long assessmentId) {
        String sessionToken = UUID.randomUUID().toString();
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;

        AssessmentSession session = new AssessmentSession();
        session.setSessionToken(sessionToken);
        session.setStudentId(studentId);
        session.setAssessmentId(assessmentId);
        session.setStartTime(Instant.now().toString());

        redisTemplate.opsForValue().set(key, session, SESSION_TTL_HOURS, TimeUnit.HOURS);

        logger.info("Created assessment session for student {} assessment {} token {}",
                studentId, assessmentId, sessionToken);

        return session;
    }

    /**
     * Validate a session token against the stored session.
     * Returns the session if valid, null if invalid or expired.
     */
    public AssessmentSession validateSession(Long studentId, Long assessmentId, String sessionToken) {
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);

        if (value == null) {
            return null; // Session expired or never created
        }

        // GenericJackson2JsonRedisSerializer deserializes to the original type
        // but may return LinkedHashMap if class info is embedded
        AssessmentSession session = convertToSession(value);

        if (session != null && sessionToken.equals(session.getSessionToken())) {
            // Refresh TTL on valid access (sliding expiration)
            redisTemplate.expire(key, SESSION_TTL_HOURS, TimeUnit.HOURS);
            return session;
        }

        return null;
    }

    /**
     * Delete session when assessment is completed.
     */
    public void deleteSession(Long studentId, Long assessmentId) {
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
    }
}
```

**Key decisions:**
- Session key includes both studentId and assessmentId, so a student can have one session per assessment.
- `set()` with TTL creates the key atomically with expiration. No separate EXPIRE call needed.
- Sliding expiration: each valid access refreshes the 24h TTL, so active sessions never expire during use.
- Session is deleted on successful submission (assessment complete), but TTL handles cleanup if student abandons.

### Pattern 2: Idempotent Submission via SET NX

**What:** Before processing a submission, attempt to set a Redis key using `setIfAbsent()` (SET NX). If the key already exists, the submission is a duplicate. This is atomic and race-condition free.

**When to use:** In the `/assessment-answer/submit` endpoint.

**Example:**
```java
// In AssessmentSessionService or a dedicated IdempotencyService
private static final String SUBMIT_KEY_PREFIX = "career9:submit:";
private static final long SUBMIT_TTL_HOURS = 24;

/**
 * Attempt to acquire an idempotency lock for submission.
 * Returns true if this is the first submission (lock acquired).
 * Returns false if a submission is already in progress or completed.
 */
public boolean acquireSubmissionLock(Long studentId, Long assessmentId) {
    String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
    Boolean acquired = redisTemplate.opsForValue()
            .setIfAbsent(key, "processing", SUBMIT_TTL_HOURS, TimeUnit.HOURS);
    return Boolean.TRUE.equals(acquired);
}

/**
 * Mark submission as completed with result data.
 * Updates the idempotency key value from "processing" to the result.
 */
public void markSubmissionComplete(Long studentId, Long assessmentId, Object result) {
    String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
    redisTemplate.opsForValue().set(key, result, SUBMIT_TTL_HOURS, TimeUnit.HOURS);
}

/**
 * Get cached submission result (for returning to duplicate requests).
 */
public Object getSubmissionResult(Long studentId, Long assessmentId) {
    String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
    return redisTemplate.opsForValue().get(key);
}

/**
 * Clear submission lock (e.g., when admin wants to allow re-submission).
 */
public void clearSubmissionLock(Long studentId, Long assessmentId) {
    String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
    redisTemplate.delete(key);
}
```

**Key decisions:**
- `setIfAbsent(key, value, timeout, unit)` is the Spring Data Redis equivalent of `SET key value NX EX timeout`. It's atomic -- no race condition between checking and setting.
- Initial value is `"processing"` to distinguish in-flight submissions from completed ones.
- After successful DB commit, update the key to the actual result so duplicate requests can return the cached response.
- 24h TTL ensures cleanup. The existing `deleteByUserStudent_UserStudentIdAndAssessment_Id` in the submit endpoint already handles re-submission at the DB level, so the idempotency key just prevents redundant processing.

### Pattern 3: HandlerInterceptor for Session Validation

**What:** A Spring MVC `HandlerInterceptor` that checks the `X-Assessment-Session` header on assessment-related endpoints and validates it against Redis.

**When to use:** On endpoints where wrong-student-loading must be prevented: `/assessment-answer/submit`, `/assessments/getby/{id}`, `/assessments/startAssessment`.

**Example:**
```java
@Component
public class AssessmentSessionInterceptor implements HandlerInterceptor {

    @Autowired
    private AssessmentSessionService sessionService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        String sessionToken = request.getHeader("X-Assessment-Session");

        // If no session header, let the request through (backwards compatibility)
        // The interceptor validates when a session token IS provided
        if (sessionToken == null || sessionToken.isEmpty()) {
            return true;
        }

        // Extract studentId from request (header, path, or body)
        // Implementation depends on endpoint patterns
        Long studentId = extractStudentId(request);
        Long assessmentId = extractAssessmentId(request);

        if (studentId == null || assessmentId == null) {
            return true; // Can't validate without IDs, let through
        }

        AssessmentSession session = sessionService.validateSession(studentId, assessmentId, sessionToken);
        if (session == null) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Invalid or expired assessment session\"}");
            return false;
        }

        // Store session in request attributes for downstream use
        request.setAttribute("assessmentSession", session);
        return true;
    }
}
```

**Registration:**
```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private AssessmentSessionInterceptor sessionInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(sessionInterceptor)
                .addPathPatterns("/assessment-answer/**", "/assessments/**")
                .excludePathPatterns("/assessments/getAll", "/assessments/get/list*",
                        "/assessments/create", "/assessments/update/**",
                        "/assessments/prefetch/**");
    }
}
```

**Key decisions:**
- Backwards compatibility: if no `X-Assessment-Session` header is present, the request passes through. This prevents breaking admin endpoints, bulk-submit endpoints, and other non-student flows.
- Only student-facing endpoints need session validation.
- `excludePathPatterns` for admin/CRUD endpoints that don't use sessions.

### Pattern 4: Session Data Object

**What:** A simple POJO stored as JSON in Redis representing the assessment session.

```java
public class AssessmentSession implements Serializable {
    private static final long serialVersionUID = 1L;

    private String sessionToken;
    private Long studentId;
    private Long assessmentId;
    private String startTime;  // ISO-8601 string for JSON safety

    // Getters, setters, no-arg constructor required for Jackson deserialization
}
```

**Key decisions:**
- Use `String` for `startTime` instead of `Instant` to avoid Jackson serialization issues with `GenericJackson2JsonRedisSerializer`.
- Implements `Serializable` for consistency with RedisTemplate value requirements.
- Stored at key `career9:session:{studentId}:{assessmentId}` -- only one active session per student-assessment pair.

### Anti-Patterns to Avoid

- **Using Spring Session (HttpSession + Redis):** This is for replacing JSESSIONID-based HTTP sessions. Our use case is assessment-specific sessions with custom lifecycle. Spring Session would change the auth model and add unnecessary complexity.
- **Storing session token in localStorage only:** The whole point is server-side validation. The token must be validated against Redis on every request.
- **Using @Cacheable for sessions:** Sessions are mutable state with custom TTL and SET NX semantics. @Cacheable is for read-through caching. Use RedisTemplate directly.
- **Making session validation mandatory immediately:** Roll out with backwards compatibility first (no header = pass through). Then update frontend. Then optionally make it mandatory.
- **Using SETNX without TTL:** Always use `setIfAbsent(key, value, timeout, unit)` to combine SET NX + EX atomically. Separate SETNX then EXPIRE is not atomic -- if the app crashes between the two calls, the key lives forever.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic set-if-not-exists with TTL | Manual check-then-set with `get()` + `set()` | `RedisTemplate.opsForValue().setIfAbsent(key, value, timeout, unit)` | Not atomic. Race condition between get and set. SET NX EX is a single Redis command. |
| Session expiration cleanup | Scheduled job to scan and delete expired sessions | Redis key TTL (`set()` with timeout parameter) | Redis handles expiration automatically. No background thread, no scanning, no clock skew issues. |
| Request-scoped session data | ThreadLocal or custom filter chain | `request.setAttribute("assessmentSession", session)` in HandlerInterceptor | Standard Servlet API. Available to controllers via `HttpServletRequest`. |
| Unique token generation | Custom random string generator | `UUID.randomUUID().toString()` | JDK built-in, cryptographically strong random, zero dependencies. |

**Key insight:** Redis provides all the primitives needed (SET with TTL, SET NX with TTL, GET, DELETE). The implementation is mostly wiring -- creating a service that calls RedisTemplate methods and an interceptor that calls the service. No custom data structures or algorithms needed.

## Common Pitfalls

### Pitfall 1: GenericJackson2JsonRedisSerializer Type Reconstruction

**What goes wrong:** `GenericJackson2JsonRedisSerializer` embeds `@class` metadata in JSON. When deserializing, it tries to reconstruct the exact Java type. If the class is moved, renamed, or its fields change, deserialization fails with `ClassNotFoundException` or `InvalidTypeIdException`.

**Why it happens:** The serializer stores the fully-qualified class name (`com.kccitm.api.model.AssessmentSession`) in the JSON. Redis contains stale data from before the class was changed.

**How to avoid:**
1. Put `AssessmentSession` in a stable package and don't rename it.
2. Add a `serialVersionUID` field.
3. Use `@JsonIgnoreProperties(ignoreUnknown = true)` to tolerate added fields.
4. If class structure changes, flush the affected Redis keys.

**Warning signs:** `org.springframework.data.redis.serializer.SerializationException: Could not read JSON` in logs.

### Pitfall 2: Interceptor Ordering with Security Filter

**What goes wrong:** The `HandlerInterceptor` runs AFTER Spring Security filters. If the endpoint is `permitAll()` (like `assessments/prefetch/**`), the interceptor still runs. If the endpoint requires auth, the security filter runs first.

**Why it happens:** Spring Security is a Servlet Filter chain. HandlerInterceptors run inside DispatcherServlet, after filters.

**How to avoid:** This is actually correct behavior for our case. Security runs first (validates JWT), then our interceptor runs (validates assessment session). The interceptor should NOT duplicate security concerns. Exclude public endpoints from the interceptor path patterns.

**Warning signs:** 403 errors on public endpoints that don't need session validation.

### Pitfall 3: Request Body Consumed Before Controller

**What goes wrong:** The interceptor tries to read `userStudentId` and `assessmentId` from the request body (POST endpoints). But `HttpServletRequest.getInputStream()` can only be read once. If the interceptor reads it, the controller gets an empty body.

**Why it happens:** Servlet input streams are not replayable by default.

**How to avoid:** For POST endpoints, do NOT read the request body in the interceptor. Instead:
1. For `startAssessment`: the session is being created, not validated. No interceptor needed.
2. For `submit`: extract `studentId` and `assessmentId` from query parameters or headers, not the body. Or add them as path variables. Or use a `ContentCachingRequestWrapper`.
3. Simplest approach: require `X-Assessment-Student-Id` and `X-Assessment-Id` headers alongside `X-Assessment-Session`. The frontend already knows these values from localStorage.

**Warning signs:** `HttpMessageNotReadableException: Required request body is missing` in controller after interceptor reads body.

### Pitfall 4: Idempotency Key Not Cleared on Failure

**What goes wrong:** `setIfAbsent()` sets the key to `"processing"`, then the submission fails (DB error, validation error). The idempotency key remains, blocking all future submission attempts for 24 hours.

**Why it happens:** The SET NX succeeds (key is set) but the business logic fails. The key is not cleaned up.

**How to avoid:** Wrap the submission in try-catch. On failure, delete the idempotency key so the student can retry:
```java
boolean locked = sessionService.acquireSubmissionLock(studentId, assessmentId);
if (!locked) {
    return cachedResultOrConflict();
}
try {
    // ... process submission ...
    sessionService.markSubmissionComplete(studentId, assessmentId, result);
    return ResponseEntity.ok(result);
} catch (Exception e) {
    // Submission failed -- release the idempotency lock so student can retry
    sessionService.clearSubmissionLock(studentId, assessmentId);
    throw e;
}
```

**Warning signs:** Student gets "duplicate submission" error after a failed attempt. Cannot retry.

### Pitfall 5: Shared Device Still Has Stale localStorage

**What goes wrong:** Student A logs in, starts assessment, answers questions. Student B sits down, logs in (new `userStudentId` in localStorage), but the old `assessmentId` from Student A is still in localStorage. Student B starts what they think is their assessment but loads Student A's assessment data.

**Why it happens:** `localStorage.setItem('assessmentId', ...)` is set when a student clicks "Start Assessment", but it's not cleared on login. The `userStudentId` IS updated on login, but `assessmentId` persists.

**How to avoid:** Two layers of defense:
1. **Frontend:** Clear all assessment-related localStorage on new student login (already partially done for some keys in `SectionQuestionPage.tsx` after submission, but not on login).
2. **Backend (this phase):** The session token binds studentId + assessmentId. If Student B tries to load Student A's assessment, the session token won't match (Student B has a different token or no token). The interceptor rejects the request.

**Warning signs:** Student sees wrong assessment questions. Session validation catches the mismatch.

## Code Examples

### Example 1: Modifying startAssessment to Create Session

```java
// In AssessmentTableController.java - modified startAssessment endpoint
@Autowired
private AssessmentSessionService assessmentSessionService;

@PostMapping("/startAssessment")
public ResponseEntity<HashMap<String, Object>> startAssessment(
        @RequestBody java.util.Map<String, Long> request) {
    Long userStudentId = request.get("userStudentId");
    Long assessmentId = request.get("assessmentId");

    // ... existing validation ...

    // Only update if not completed (existing logic)
    if (!"completed".equals(mapping.getStatus())) {
        mapping.setStatus("ongoing");
        studentAssessmentMappingRepository.save(mapping);
    }

    // NEW: Create assessment session in Redis
    AssessmentSession session = assessmentSessionService.createSession(userStudentId, assessmentId);

    response.put("success", true);
    response.put("status", mapping.getStatus());
    response.put("sessionToken", session.getSessionToken());  // NEW
    return ResponseEntity.ok(response);
}
```

### Example 2: Modifying submit to Use Idempotency

```java
// In AssessmentAnswerController.java - modified submit endpoint
@Autowired
private AssessmentSessionService assessmentSessionService;

@Transactional
@PostMapping(value = "/submit", headers = "Accept=application/json")
public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
    try {
        Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
        Long assessmentId = ((Number) submissionData.get("assessmentId")).longValue();

        // NEW: Idempotency check
        if (!assessmentSessionService.acquireSubmissionLock(userStudentId, assessmentId)) {
            Object cachedResult = assessmentSessionService.getSubmissionResult(userStudentId, assessmentId);
            if (cachedResult != null && !"processing".equals(cachedResult)) {
                // Return cached successful result
                return ResponseEntity.ok(cachedResult);
            }
            // Still processing (concurrent request) or no result yet
            return ResponseEntity.status(409).body(Map.of(
                "error", "Submission already in progress or completed",
                "status", "duplicate"
            ));
        }

        try {
            // ... existing submission logic unchanged ...

            Map<String, Object> result = Map.of(
                "status", "success",
                "scoresSaved", rawScoresToSave.size(),
                "answersSaved", answersToSave.size(),
                "skippedAnswers", skippedCount
            );

            // NEW: Cache result and clean up session
            assessmentSessionService.markSubmissionComplete(userStudentId, assessmentId, result);
            assessmentSessionService.deleteSession(userStudentId, assessmentId);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            // NEW: Release idempotency lock on failure
            assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);
            throw e;
        }

    } catch (Exception e) {
        return ResponseEntity.status(500).body("Error: " + e.getMessage());
    }
}
```

### Example 3: Frontend Session Token Handling

```typescript
// In AllottedAssessmentPage.tsx - after calling startAssessment
const response = await fetch(`${API_URL}/assessments/startAssessment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userStudentId: Number(userStudentId),
        assessmentId: assessment.assessmentId
    })
});
const data = await response.json();

// NEW: Store session token
if (data.sessionToken) {
    sessionStorage.setItem('assessmentSessionToken', data.sessionToken);
}

// In SectionQuestionPage.tsx - when submitting
const sessionToken = sessionStorage.getItem('assessmentSessionToken');
const response = await fetch(`${API_URL}/assessment-answer/submit`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(sessionToken ? { "X-Assessment-Session": sessionToken } : {})
    },
    body: JSON.stringify(submissionJSON),
});
```

**Key insight:** Use `sessionStorage` (not `localStorage`) for the session token. `sessionStorage` is cleared when the browser tab closes. If Student B opens a new tab, they won't have Student A's session token.

### Example 4: Redis Key Layout

```
# Session keys (24h TTL, set by startAssessment)
career9:session:42:7       → {"@class":"...AssessmentSession","sessionToken":"uuid-here","studentId":42,"assessmentId":7,"startTime":"2026-03-07T10:30:00Z"}
career9:session:43:7       → {"@class":"...AssessmentSession","sessionToken":"uuid-here","studentId":43,"assessmentId":7,"startTime":"2026-03-07T10:31:00Z"}

# Idempotency keys (24h TTL, set by submit)
career9:submit:42:7        → "processing"  (during submission)
career9:submit:42:7        → {"status":"success","scoresSaved":12,...}  (after completion)

# Cache keys (from Phase 9, unchanged)
career9:assessmentDetails::7          → assessment config
career9:assessmentDetails::prefetch-42 → prefetch data
career9:assessmentQuestions::SimpleKey[] → all questions
career9:measuredQualityTypes::SimpleKey[] → all MQT types
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side only session (localStorage) | Server-side session in Redis + client token | This phase | Prevents wrong-assessment loading on shared devices |
| No duplicate submission protection | SET NX idempotency keys | This phase | Prevents double-submission from retries or double-clicks |
| RedisTemplate.opsForValue().setIfAbsent(key, value) | setIfAbsent(key, value, timeout, unit) | Spring Data Redis 2.1+ | Atomic SET NX EX in single call. The 2-arg version requires separate EXPIRE call. Spring Boot 2.5.x includes this. |

**Deprecated/outdated:**
- `RedisTemplate.opsForValue().setIfAbsent(key, value)` without timeout: Still works but requires a separate `expire()` call which is not atomic. Always use the 4-arg version with timeout.

## Open Questions

1. **Should session validation be mandatory or optional?**
   - What we know: Making it mandatory immediately would break all existing clients (the `career-nine-assessment` standalone app, the `react-social` app).
   - What's unclear: Timeline for updating all frontends to pass session tokens.
   - Recommendation: Deploy with backwards compatibility (no header = pass through). Add a configuration flag `app.assessment.session.required=false` that can be flipped to `true` once all frontends are updated. This is a safe rollout strategy.

2. **Should bulk-submit endpoints get idempotency?**
   - What we know: The bulk-submit endpoints (`/bulk-submit`, `/bulk-submit-with-students`, `/bulk-submit-by-rollnumber`) are admin-only, used for offline assessment upload.
   - What's unclear: Whether admins experience duplicate submission issues.
   - Recommendation: Skip idempotency for bulk endpoints in this phase. They're admin-only, called from a different UI, and already handle re-upload by deleting old answers first. Add later if needed.

3. **How to handle "resume after server restart"?**
   - What we know: Success criterion #4 says "Student can resume assessment after server restart without losing progress." Redis has AOF persistence configured (Phase 8), so session keys survive Redis restart. Student answers are saved in localStorage on the frontend. The session token in sessionStorage would be lost if the browser tab was closed.
   - What's unclear: Whether "server restart" means browser tab stays open (session token in sessionStorage survives) or browser is also restarted.
   - Recommendation: If browser tab stays open, sessionStorage retains the token and Redis retains the session. If browser is closed, the student must log in again and call startAssessment again (which creates a new session). Their answers are preserved in localStorage and can be re-submitted. This covers the "resume" scenario adequately.

4. **What about the `career-nine-assessment` standalone Vite app?**
   - What we know: There are two frontend apps that interact with assessment endpoints: `react-social` (main app) and `career-nine-assessment` (standalone Vite app). Both use localStorage for `userStudentId` and `assessmentId`.
   - What's unclear: Whether both apps need to be updated simultaneously.
   - Recommendation: Since session validation is optional (backwards compatible), update one app at a time. The interceptor's "no header = pass through" behavior means unchanged apps continue working.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `AssessmentAnswerController.java`, `AssessmentTableController.java`, `StudentAssessmentMapping.java`, `RedisConfig.java`, `CacheConfig.java`, `application.yml`
- Codebase analysis: `AllottedAssessmentPage.tsx`, `SectionQuestionPage.tsx`, `AssessmentContext.tsx` (both react-social and career-nine-assessment)
- Phase 8 RESEARCH.md and Phase 8/9 SUMMARY.md files -- confirmed RedisTemplate with GenericJackson2JsonRedisSerializer is configured
- Spring Data Redis `ValueOperations.setIfAbsent(K, V, long, TimeUnit)` -- available since Spring Data Redis 2.1, included in Spring Boot 2.5.x BOM
- Spring MVC `HandlerInterceptor` -- stable API since Spring 3.x, unchanged in Spring 5.3.x

### Secondary (MEDIUM confidence)
- Redis SET NX EX semantics -- well-documented Redis command, universally used for distributed locking and idempotency patterns
- Idempotency key pattern with SET NX -- standard pattern described in Stripe, Shopify, and other payment/submission APIs

### Tertiary (LOW confidence)
- None -- all patterns used are well-established and verified against the existing codebase infrastructure.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using RedisTemplate already configured in Phase 8, no new dependencies
- Architecture: HIGH -- HandlerInterceptor + service + RedisTemplate is standard Spring MVC pattern. All code is new (no risky refactoring of existing logic)
- Pitfalls: HIGH -- all identified pitfalls have concrete prevention strategies based on codebase analysis
- Frontend changes: MEDIUM -- sessionStorage for token is straightforward, but two separate frontend apps need updating

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable technology, unlikely to change)
