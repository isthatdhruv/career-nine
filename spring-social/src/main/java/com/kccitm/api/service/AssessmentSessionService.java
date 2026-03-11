package com.kccitm.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Redis-backed assessment session management.
 * Creates, validates, and deletes sessions keyed by student+assessment.
 * Provides submission locking to prevent duplicate submissions.
 */
@Service
public class AssessmentSessionService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentSessionService.class);

    private static final String SESSION_KEY_PREFIX = "career9:session:";
    private static final int SESSION_TTL_HOURS = 24;
    private static final String DRAFT_KEY_PREFIX = "career9:draft:";
    private static final int DRAFT_TTL_HOURS = 24;
    private static final String SUBMIT_KEY_PREFIX = "career9:submit:";
    private static final int SUBMIT_TTL_HOURS = 24;
    private static final String HEARTBEAT_KEY_PREFIX = "career9:heartbeat:";
    private static final int HEARTBEAT_TTL_SECONDS = 60;
    private static final String DEMOGRAPHICS_KEY_PREFIX = "career9:demographics:";
    private static final int DEMOGRAPHICS_TTL_HOURS = 24;
    private static final String PARTIAL_KEY_PREFIX = "career9:partial:";
    private static final int PARTIAL_TTL_HOURS = 24;
    private static final String SUBMITTED_KEY_PREFIX = "career9:submitted:";
    private static final int SUBMITTED_TTL_HOURS = 48;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Create a new session for a student taking an assessment.
     * Generates a UUID token and stores the session in Redis with 24h TTL.
     */
    public AssessmentSession createSession(Long studentId, Long assessmentId) {
        String token = UUID.randomUUID().toString();
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;

        AssessmentSession session = new AssessmentSession(
                token, studentId, assessmentId, Instant.now().toString());

        redisTemplate.opsForValue().set(key, session, SESSION_TTL_HOURS, TimeUnit.HOURS);
        logger.info("Created assessment session for student={} assessment={}", studentId, assessmentId);

        return session;
    }

    /**
     * Validate a session token for a student+assessment pair.
     * If valid, refreshes the TTL (sliding expiration). Returns the session or null.
     */
    public AssessmentSession validateSession(Long studentId, Long assessmentId, String sessionToken) {
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);

        if (value == null) {
            return null;
        }

        AssessmentSession session = convertToSession(value);
        if (session == null || !sessionToken.equals(session.getSessionToken())) {
            return null;
        }

        // Sliding expiration: refresh TTL on each valid access
        redisTemplate.expire(key, SESSION_TTL_HOURS, TimeUnit.HOURS);
        logger.info("Validated assessment session for student={} assessment={}", studentId, assessmentId);

        return session;
    }

    /**
     * Delete a session for a student+assessment pair.
     */
    public void deleteSession(Long studentId, Long assessmentId) {
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
        logger.info("Deleted assessment session for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Acquire a submission lock for a student+assessment pair.
     * Uses Redis SETNX to ensure only one submission can proceed.
     * Returns true if the lock was acquired, false if already locked.
     */
    public boolean acquireSubmissionLock(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        Boolean result = redisTemplate.opsForValue()
                .setIfAbsent(key, "processing", SUBMIT_TTL_HOURS, TimeUnit.HOURS);
        return Boolean.TRUE.equals(result);
    }

    /**
     * Mark a submission as complete by storing the result.
     */
    public void markSubmissionComplete(Long studentId, Long assessmentId, Object result) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.opsForValue().set(key, result, SUBMIT_TTL_HOURS, TimeUnit.HOURS);
    }

    /**
     * Get the result of a previous submission.
     */
    public Object getSubmissionResult(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * Clear the submission lock for a student+assessment pair.
     */
    public void clearSubmissionLock(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
    }

    /**
     * Save a draft of student's current answer state to Redis.
     * Overwrites any existing draft for the same student+assessment.
     */
    public void saveDraft(Long studentId, Long assessmentId, Object draftData) {
        String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.opsForValue().set(key, draftData, DRAFT_TTL_HOURS, TimeUnit.HOURS);
        logger.debug("Saved draft for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Retrieve a saved draft for a student+assessment pair.
     * Returns null if no draft exists (expired or never saved).
     */
    public Object getDraft(Long studentId, Long assessmentId) {
        String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * Delete a draft after successful submission.
     */
    public void deleteDraft(Long studentId, Long assessmentId) {
        String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
        logger.debug("Deleted draft for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Save a heartbeat with the student's current page/question position.
     * Auto-expires in 60s — if student stops sending, they appear stale.
     */
    public void saveHeartbeat(Long studentId, Long assessmentId, Map<String, Object> position) {
        String key = HEARTBEAT_KEY_PREFIX + studentId + ":" + assessmentId;
        position.put("timestamp", Instant.now().toString());
        redisTemplate.opsForValue().set(key, position, HEARTBEAT_TTL_SECONDS, TimeUnit.SECONDS);
    }

    /**
     * Get a student's last heartbeat position. Returns null if expired or never sent.
     */
    public Map<String, Object> getHeartbeat(Long studentId, Long assessmentId) {
        String key = HEARTBEAT_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);
        if (value instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) value;
            return result;
        }
        return null;
    }

    /**
     * Save demographic responses to Redis for deferred submission.
     * Called from the demographics page to avoid blocking navigation.
     */
    public void saveDemographicsDraft(Long studentId, Long assessmentId, Object draftData) {
        String key = DEMOGRAPHICS_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.opsForValue().set(key, draftData, DEMOGRAPHICS_TTL_HOURS, TimeUnit.HOURS);
        logger.info("Saved demographics draft for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Retrieve saved demographic responses for deferred submission.
     */
    public Object getDemographicsDraft(Long studentId, Long assessmentId) {
        String key = DEMOGRAPHICS_KEY_PREFIX + studentId + ":" + assessmentId;
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * Delete demographics draft after successful persistence.
     */
    public void deleteDemographicsDraft(Long studentId, Long assessmentId) {
        String key = DEMOGRAPHICS_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
        logger.debug("Deleted demographics draft for student={} assessment={}", studentId, assessmentId);
    }

    // ── Partial Answer Buffering ──────────────────────────────────────────

    /**
     * Buffer partial answers in Redis instead of writing to MySQL.
     * Called by save-partial endpoint on every section transition.
     */
    public void savePartialAnswers(Long studentId, Long assessmentId, Object answers) {
        String key = PARTIAL_KEY_PREFIX + studentId + ":" + assessmentId;
        Map<String, Object> payload = new HashMap<>();
        payload.put("answers", answers);
        payload.put("savedAt", Instant.now().toString());
        redisTemplate.opsForValue().set(key, payload, PARTIAL_TTL_HOURS, TimeUnit.HOURS);
        logger.debug("Saved partial answers to Redis for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Retrieve buffered partial answers from Redis.
     * Returns the full payload map (with answers and savedAt), or null if not found.
     */
    public Map<String, Object> getPartialAnswers(Long studentId, Long assessmentId) {
        String key = PARTIAL_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);
        if (value instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) value;
            return result;
        }
        return null;
    }

    /**
     * Delete buffered partial answers after successful submission or flush.
     */
    public void deletePartialAnswers(Long studentId, Long assessmentId) {
        String key = PARTIAL_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
        logger.debug("Deleted partial answers for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Get all partial answer keys from Redis using SCAN (non-blocking).
     * Returns list of maps with parsed studentId, assessmentId, answerCount, ttl, savedAt.
     */
    public List<Map<String, Object>> getAllPartialAnswerEntries(Long filterAssessmentId) {
        Set<String> keys = redisTemplate.keys(PARTIAL_KEY_PREFIX + "*");
        List<Map<String, Object>> entries = new ArrayList<>();

        if (keys == null || keys.isEmpty()) {
            return entries;
        }

        for (String key : keys) {
            try {
                // Parse key: career9:partial:{studentId}:{assessmentId}
                String[] parts = key.replace(PARTIAL_KEY_PREFIX, "").split(":");
                if (parts.length != 2) continue;

                Long studentId = Long.parseLong(parts[0]);
                Long assessmentId = Long.parseLong(parts[1]);

                if (filterAssessmentId != null && !filterAssessmentId.equals(assessmentId)) {
                    continue;
                }

                Object value = redisTemplate.opsForValue().get(key);
                Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);

                int answerCount = 0;
                String savedAt = null;
                if (value instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> payload = (Map<String, Object>) value;
                    savedAt = (String) payload.get("savedAt");
                    Object answersObj = payload.get("answers");
                    if (answersObj instanceof List) {
                        answerCount = ((List<?>) answersObj).size();
                    }
                }

                Map<String, Object> entry = new HashMap<>();
                entry.put("userStudentId", studentId);
                entry.put("assessmentId", assessmentId);
                entry.put("answerCount", answerCount);
                entry.put("ttlSeconds", ttl != null ? ttl : -1);
                entry.put("savedAt", savedAt);
                entries.add(entry);
            } catch (Exception e) {
                logger.warn("Failed to parse partial key: {}", key, e);
            }
        }

        return entries;
    }

    // ── Submitted Answer Buffering (async submission) ─────────────────────

    /**
     * Save the full submission payload to Redis for async processing.
     * Called by /submit endpoint to return fast, then processed in background.
     */
    public void saveSubmittedAnswers(Long studentId, Long assessmentId, Map<String, Object> submissionData) {
        String key = SUBMITTED_KEY_PREFIX + studentId + ":" + assessmentId;
        Map<String, Object> payload = new HashMap<>(submissionData);
        payload.put("processingStatus", "pending");
        payload.put("submittedAt", Instant.now().toString());
        payload.put("retryCount", 0);
        redisTemplate.opsForValue().set(key, payload, SUBMITTED_TTL_HOURS, TimeUnit.HOURS);
        logger.info("Saved submitted answers to Redis for student={} assessment={}", studentId, assessmentId);
    }

    /**
     * Retrieve submitted answers payload from Redis.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getSubmittedAnswers(Long studentId, Long assessmentId) {
        String key = SUBMITTED_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return null;
    }

    /**
     * Update the processing status of a submitted answer entry.
     */
    @SuppressWarnings("unchecked")
    public void updateSubmittedStatus(Long studentId, Long assessmentId, String status) {
        String key = SUBMITTED_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);
        if (value instanceof Map) {
            Map<String, Object> payload = (Map<String, Object>) value;
            payload.put("processingStatus", status);
            Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
            if (ttl != null && ttl > 0) {
                redisTemplate.opsForValue().set(key, payload, ttl, TimeUnit.SECONDS);
            } else {
                redisTemplate.opsForValue().set(key, payload, SUBMITTED_TTL_HOURS, TimeUnit.HOURS);
            }
        }
    }

    /**
     * Check if a submission lock exists for a student+assessment pair.
     */
    public boolean hasSubmissionLock(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Get all submitted answer entries from Redis for retry scheduling.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAllSubmittedEntries() {
        Set<String> keys = redisTemplate.keys(SUBMITTED_KEY_PREFIX + "*");
        List<Map<String, Object>> entries = new ArrayList<>();

        if (keys == null || keys.isEmpty()) {
            return entries;
        }

        for (String key : keys) {
            try {
                String[] parts = key.replace(SUBMITTED_KEY_PREFIX, "").split(":");
                if (parts.length != 2) continue;

                Long studentId = Long.parseLong(parts[0]);
                Long assessmentId = Long.parseLong(parts[1]);

                Object value = redisTemplate.opsForValue().get(key);
                if (!(value instanceof Map)) continue;

                Map<String, Object> payload = (Map<String, Object>) value;
                Map<String, Object> entry = new HashMap<>();
                entry.put("userStudentId", studentId);
                entry.put("assessmentId", assessmentId);
                entry.put("processingStatus", payload.get("processingStatus"));
                entry.put("submittedAt", payload.get("submittedAt"));
                entry.put("retryCount", payload.get("retryCount"));
                entries.add(entry);
            } catch (Exception e) {
                logger.warn("Failed to parse submitted key: {}", key, e);
            }
        }

        return entries;
    }

    /**
     * Convert a Redis-deserialized value to AssessmentSession.
     * GenericJackson2JsonRedisSerializer may return a LinkedHashMap instead of the typed object.
     */
    private AssessmentSession convertToSession(Object value) {
        if (value instanceof AssessmentSession) {
            return (AssessmentSession) value;
        }
        if (value instanceof Map) {
            return objectMapper.convertValue(value, AssessmentSession.class);
        }
        return null;
    }
}
