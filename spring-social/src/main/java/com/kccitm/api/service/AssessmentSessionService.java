package com.kccitm.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
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
