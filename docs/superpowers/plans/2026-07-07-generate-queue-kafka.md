# Generate Queue (Kafka + report-worker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins generate/regenerate reports from ReportsHub through the Kafka `report.generate` pipeline (executed by the report-worker), with per-student status polling, orthogonal `force` × `emailMode` controls, and a confirm-gated "email these students" toggle.

**Architecture:** Extend the existing pipeline (no new topic): `ReportGenerateEvent` gains optional `force`/`reportTemplateId`/`emailMode`/`batchId` fields (legacy events keep today's behavior via defaults). Two new `/generate-report-unified/enqueue*` endpoints stamp `generated_report` rows `"queued"` and publish events; the consumer honors the new fields and flips rows to `"failed"` on terminal errors. A new `GenerateQueueModal` polls the by-assessment endpoint until every enqueued row leaves `"queued"`.

**Tech Stack:** Spring Boot 2 (javax), Spring Kafka `@RetryableTopic`, Redis (`StringRedisTemplate`), JUnit 5 + Mockito + AssertJ, React + TypeScript (axios).

**Spec:** `docs/superpowers/specs/2026-07-07-generate-queue-kafka-design.md`

## Global Constraints

- **DO NOT COMMIT.** All changes stay uncommitted in the working tree on branch `main` (explicit user instruction). Every "commit" step is replaced by "leave uncommitted".
- `force` and `emailMode` are fully orthogonal; all four combinations valid.
- `emailMode` values: `"auto"` (legacy/on-submission only), `"none"`, `"all"`. Admin endpoints accept only `"none"`/`"all"` (400 otherwise).
- Level of email gating: `all` → any student with an address (whitelabel ignored); `none` → never; `auto`/missing → existing whitelabel-gated logic byte-for-byte.
- New `reportStatus` value `"queued"` joins `notGenerated|generated|failed`.
- Backend module dir: `/home/babayaga/Projects/career-nine/spring-social`. Frontend: `/home/babayaga/Projects/career-nine/react-social`.
- Backend test command: `cd spring-social && mvn -q test -Dtest=<ClassName>`.

---

### Task 1: `ReportGenerateEvent` — new optional fields

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateEvent.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateEventTest.java` (create)

**Interfaces:**
- Produces: public fields `boolean force` (default `false`), `Long reportTemplateId` (default `null`), `String emailMode` (default `"auto"`), `String batchId` (default `null`) — consumed by Tasks 3, 4, 5.

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReportGenerateEventTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void legacyJsonWithoutNewFields_deserializesToTodaysBehavior() throws Exception {
        String legacy = "{\"userStudentId\":1,\"assessmentId\":2,\"recipientEmail\":\"a@b.c\","
                + "\"whitelabel\":true,\"schoolName\":\"S\",\"logoUrl\":null}";
        ReportGenerateEvent ev = mapper.readValue(legacy, ReportGenerateEvent.class);
        assertThat(ev.force).isFalse();
        assertThat(ev.reportTemplateId).isNull();
        assertThat(ev.emailMode).isEqualTo("auto");
        assertThat(ev.batchId).isNull();
        assertThat(ev.key()).isEqualTo("1:2");
    }

    @Test
    void adminFieldsRoundTripThroughJson() throws Exception {
        ReportGenerateEvent ev = new ReportGenerateEvent(1L, 2L, "a@b.c", false, "S", null);
        ev.force = true;
        ev.reportTemplateId = 7L;
        ev.emailMode = "all";
        ev.batchId = "batch-123";
        ReportGenerateEvent back = mapper.readValue(mapper.writeValueAsString(ev), ReportGenerateEvent.class);
        assertThat(back.force).isTrue();
        assertThat(back.reportTemplateId).isEqualTo(7L);
        assertThat(back.emailMode).isEqualTo("all");
        assertThat(back.batchId).isEqualTo("batch-123");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -q test -Dtest=ReportGenerateEventTest`
Expected: COMPILE ERROR — `force`, `reportTemplateId`, `emailMode`, `batchId` not defined.

- [ ] **Step 3: Add the fields**

In `ReportGenerateEvent.java`, after the existing `public String logoUrl;` line (line 21), insert:

```java
    // ── Admin-enqueue extensions (2026-07). Legacy events omit these; the field
    // initializers ARE the backward-compat defaults (Jackson only overwrites
    // fields present in the JSON), so on-submission events behave exactly as
    // before: force=false, default template, whitelabel-gated ("auto") email.
    /** true = recompute intermediary scores + placeholders; false = reuse cached. */
    public boolean force = false;
    /** Explicit template; null = the assessment's default template. */
    public Long reportTemplateId = null;
    /** "auto" = whitelabel-gated (legacy) · "none" = never email · "all" = email anyone with an address. */
    public String emailMode = "auto";
    /** Set per admin enqueue action; folded into the email idempotency key. */
    public String batchId = null;
```

Do not change the existing constructor.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-social && mvn -q test -Dtest=ReportGenerateEventTest`
Expected: PASS (2 tests)

- [ ] **Step 5: Leave uncommitted** (no commits per user instruction)

---

### Task 2: `ReportEmailEvent` + `ReportEmailIdempotency` — batchId propagation

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportEmailEvent.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportEmailIdempotency.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportEmailIdempotencyTest.java` (create)

**Interfaces:**
- Consumes: `ReportGenerateEvent.emailMode` / `.batchId` (Task 1).
- Produces: `ReportEmailEvent` public fields `String emailMode`, `String batchId` (copied from the generate event); `ReportEmailIdempotency.claim(long, long, String batchId)`, `markSent(long, long, String)`, `release(long, long, String)` — 3-arg signatures replace the 2-arg ones (only `ReportEmailConsumer` calls them; it is updated in Task 3).

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.report.pipeline;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportEmailIdempotencyTest {

    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> ops;
    @InjectMocks ReportEmailIdempotency idempotency;

    @Test
    void claimWithoutBatchId_usesLegacyKey() {
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(eq("report:sent:5:9"), eq("sending"), any(Duration.class))).thenReturn(true);
        assertThat(idempotency.claim(5, 9, null)).isEqualTo(ReportEmailIdempotency.Claim.PROCEED);
    }

    @Test
    void claimWithBatchId_usesBatchScopedKey() {
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(eq("report:sent:5:9:batch-42"), eq("sending"), any(Duration.class))).thenReturn(true);
        assertThat(idempotency.claim(5, 9, "batch-42")).isEqualTo(ReportEmailIdempotency.Claim.PROCEED);
    }

    @Test
    void releaseWithBatchId_deletesBatchScopedKey() {
        idempotency.release(5, 9, "batch-42");
        verify(redis).delete("report:sent:5:9:batch-42");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -q test -Dtest=ReportEmailIdempotencyTest`
Expected: COMPILE ERROR — 3-arg `claim`/`release` not defined.

- [ ] **Step 3: Implement**

`ReportEmailEvent.java` — after `public boolean linkOnly;` (line 23) add:

```java
    /** Copied from the generate event ("auto" for legacy on-submission events). */
    public String emailMode = "auto";
    /** Admin batch id; scopes the idempotency key so a fresh batch can re-email. */
    public String batchId = null;
```

and inside the `ReportEmailEvent(ReportGenerateEvent src, ...)` constructor body add:

```java
        this.emailMode = src.emailMode;
        this.batchId = src.batchId;
```

`ReportEmailIdempotency.java` — replace the `key`, `claim`, `markSent`, `release` methods with batch-aware versions:

```java
    private String key(long studentId, long assessmentId, String batchId) {
        String base = "report:sent:" + studentId + ":" + assessmentId;
        // Legacy (on-submission) events carry no batchId and keep the exact key
        // they use today. Admin batches get their own key so a new batch can
        // re-email inside the 7-day sent window, while retries within the batch
        // still dedupe.
        return (batchId == null || batchId.isBlank()) ? base : base + ":" + batchId;
    }

    /** Atomically attempt to claim the send. */
    public Claim claim(long studentId, long assessmentId, String batchId) {
        String key = key(studentId, assessmentId, batchId);
        Boolean acquired = redis.opsForValue()
                .setIfAbsent(key, "sending", Duration.ofSeconds(lockSeconds));
        if (Boolean.TRUE.equals(acquired)) {
            return Claim.PROCEED;
        }
        String existing = redis.opsForValue().get(key);
        if ("sent".equals(existing)) {
            return Claim.ALREADY_SENT;
        }
        return Claim.IN_PROGRESS;
    }

    /** Promote the lock to a durable "sent" marker after a successful send. */
    public void markSent(long studentId, long assessmentId, String batchId) {
        redis.opsForValue().set(key(studentId, assessmentId, batchId), "sent", Duration.ofDays(sentDays));
    }

    /** Release the lock so a retry can re-claim (call on send failure). */
    public void release(long studentId, long assessmentId, String batchId) {
        redis.delete(key(studentId, assessmentId, batchId));
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-social && mvn -q test -Dtest=ReportEmailIdempotencyTest`
Expected: PASS (3 tests). NOTE: `ReportEmailConsumer` now has compile errors (2-arg calls) — fixed in Task 3; run only this test class, not the whole module.

- [ ] **Step 5: Leave uncommitted**

---

### Task 3: `ReportEmailConsumer` — emailMode-aware gate + batch keys

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportEmailConsumer.java`

**Interfaces:**
- Consumes: `ReportEmailEvent.emailMode`/`.batchId` (Task 2), 3-arg idempotency methods (Task 2).

- [ ] **Step 1: Update the whitelabel re-check** (lines 55–62). Replace:

```java
        // Invariant: only whitelabel students are emailed. The generate stage already
        // gates on this, but re-check defensively so a stray or replayed non-whitelabel
        // event can never result in an email going out.
        if (!ev.whitelabel) {
            logger.warn("Report email skipped (non-whitelabel reached email stage) student={} assessment={}",
                    ev.userStudentId, ev.assessmentId);
            return;
        }
```

with:

```java
        // Invariant: only whitelabel students are emailed on the automatic path.
        // Admin enqueues with emailMode="all" legitimately email non-whitelabel
        // students, so the defensive re-check exempts exactly that mode.
        if (!ev.whitelabel && !"all".equals(ev.emailMode)) {
            logger.warn("Report email skipped (non-whitelabel, mode={}) student={} assessment={}",
                    ev.emailMode, ev.userStudentId, ev.assessmentId);
            return;
        }
```

- [ ] **Step 2: Thread batchId through the idempotency calls.** Replace the three call sites:

```java
        ReportEmailIdempotency.Claim claim = idempotency.claim(ev.userStudentId, ev.assessmentId, ev.batchId);
```
```java
            idempotency.markSent(ev.userStudentId, ev.assessmentId, ev.batchId);
```
```java
            idempotency.release(ev.userStudentId, ev.assessmentId, ev.batchId); // let the retry re-claim
```

- [ ] **Step 3: Verify compilation**

Run: `cd spring-social && mvn -q compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Leave uncommitted**

---

### Task 4: `ReportGenerateConsumer` — force/template passthrough, email decision, failed-row marking

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumer.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportService.java` (make `resolveTemplate` public)
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumerTest.java` (create)

**Interfaces:**
- Consumes: `ReportGenerateEvent` new fields (Task 1); `ReportService.generate(Long, Long, Long, boolean)`; `GeneratedReportRepository.findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(Long, Long, Long)`.
- Produces: `ReportService.resolveTemplate(Long assessmentId, Long reportTemplateId)` is now **public** (used again in Task 6).

- [ ] **Step 1: Make `ReportService.resolveTemplate` public.** In `ReportService.java` line 223 change

```java
    private ReportTemplate resolveTemplate(Long assessmentId, Long reportTemplateId) {
```
to
```java
    public ReportTemplate resolveTemplate(Long assessmentId, Long reportTemplateId) {
```

- [ ] **Step 2: Write the failing test**

```java
package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.service.b2c.report.ReportResult;
import com.kccitm.api.service.b2c.report.ReportService;
import com.kccitm.api.service.b2c.report.pdf.PdfRenderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportGenerateConsumerTest {

    @Mock ReportService reportService;
    @Mock PdfRenderService pdfRenderService;
    @Mock KafkaTemplate<String, String> kafkaTemplate;
    @Mock GeneratedReportRepository generatedReportRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks ReportGenerateConsumer consumer;

    private ReportResult okResult() {
        return new ReportResult("http://html", "pager", "tpl", new Date(), new Date(), false,
                "http://pdf", "ready");
    }

    @BeforeEach
    void init() {
        ReflectionTestUtils.setField(consumer, "pdfAttempts", 1);
    }

    private String json(boolean whitelabel, String email, String emailMode,
                        Long templateId, boolean force) throws Exception {
        ReportGenerateEvent ev = new ReportGenerateEvent(5L, 9L, email, whitelabel, "S", null);
        ev.emailMode = emailMode;
        ev.reportTemplateId = templateId;
        ev.force = force;
        ev.batchId = "b1";
        return new ObjectMapper().writeValueAsString(ev);
    }

    @Test
    void passesForceAndTemplateIdThroughToReportService() throws Exception {
        when(reportService.generate(5L, 9L, 7L, true)).thenReturn(okResult());
        consumer.onGenerate(json(false, null, "none", 7L, true));
        verify(reportService).generate(5L, 9L, 7L, true);
    }

    @Test
    void emailModeAll_emailsNonWhitelabelStudentWithAddress() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(false, "a@b.c", "all", null, false));
        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_EMAIL), eq("5:9"), anyString());
    }

    @Test
    void emailModeNone_neverEmailsEvenWhitelabelWithAddress() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(true, "a@b.c", "none", null, false));
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    void emailModeAuto_keepsWhitelabelGating() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(false, "a@b.c", "auto", null, false));
        verify(kafkaTemplate, never()).send(any(), any(), any());

        consumer.onGenerate(json(true, "a@b.c", "auto", null, false));
        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_EMAIL), eq("5:9"), anyString());
    }

    @Test
    void emailModeAll_withoutAddress_generatesButDoesNotEmail() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(false, null, "all", null, false));
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd spring-social && mvn -q test -Dtest=ReportGenerateConsumerTest`
Expected: FAIL — `generate(5, 9, 7, true)` never called (consumer still hardcodes `null, false`); `emailModeAll_emailsNonWhitelabelStudentWithAddress` fails (whitelabel gate).

- [ ] **Step 4: Implement consumer changes**

In `ReportGenerateConsumer.java`:

(a) Add imports + autowired repository beside the existing `@Autowired` fields:

```java
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.model.career9.ReportTemplate;
import java.util.Date;
```
```java
    @Autowired private GeneratedReportRepository generatedReportRepository;
```

(b) Replace the body of the main `try` block's first two statements (lines 65–76):

```java
            ReportResult r = reportService.generate(
                    ev.userStudentId, ev.assessmentId, ev.reportTemplateId, ev.force);

            // Email decision — emailMode and force are fully orthogonal.
            //   "all"  → email anyone with an address (whitelabel ignored; admin toggle ON)
            //   "none" → generate only (admin toggle OFF)
            //   "auto" → legacy on-submission behavior: whitelabel students only
            boolean hasEmail = ev.recipientEmail != null && !ev.recipientEmail.isBlank();
            String mode = ev.emailMode == null ? "auto" : ev.emailMode;
            boolean shouldEmail =
                    "all".equals(mode)  ? hasEmail
                  : "none".equals(mode) ? false
                  :                       (ev.whitelabel && hasEmail);
            if (!shouldEmail) {
                logger.info("Report generated (not mailed — mode={} whitelabel={} hasEmail={}) student={} assessment={}",
                        mode, ev.whitelabel, hasEmail, ev.userStudentId, ev.assessmentId);
                return;
            }
```

(c) In the terminal sanity branch (currently `logger.error("Report generate TERMINAL (sanity {})…` then `throw new IllegalStateException(...)`), insert `markRowFailed(ev);` between the log line and the `throw`.

(d) Replace the `@DltHandler` method body's log statement — keep the existing `logger.error(...)` line, then append after it:

```java
        // Best-effort: flip the row to "failed" so an admin-enqueued chip resolves
        // to a definitive ✕ instead of spinning at "queued" forever.
        try {
            markRowFailed(objectMapper.readValue(json, ReportGenerateEvent.class));
        } catch (Exception e) {
            logger.warn("DLT: could not parse payload to mark row failed: {}", e.getMessage());
        }
```

(e) Add the helper at the bottom of the class (before the closing brace):

```java
    /**
     * Best-effort: mark the (student, assessment, template) row failed. Resolving
     * the template can itself fail (e.g. no template mapped) — then there is no
     * row to mark and we just log.
     */
    private void markRowFailed(ReportGenerateEvent ev) {
        try {
            ReportTemplate template = reportService.resolveTemplate(ev.assessmentId, ev.reportTemplateId);
            generatedReportRepository
                    .findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(
                            ev.userStudentId, ev.assessmentId, template.getReportTemplateId())
                    .ifPresent(gr -> {
                        gr.setReportStatus("failed");
                        gr.setUpdatedAt(new Date());
                        generatedReportRepository.save(gr);
                    });
        } catch (Exception e) {
            logger.warn("Could not mark generated_report failed student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
        }
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd spring-social && mvn -q test -Dtest=ReportGenerateConsumerTest`
Expected: PASS (5 tests)

- [ ] **Step 6: Leave uncommitted**

---

### Task 5: `ReportPipelineProducer.enqueueAdmin`

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducer.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducerTest.java` (create)

**Interfaces:**
- Produces: `void enqueueAdmin(Long userStudentId, Long assessmentId, Long reportTemplateId, boolean force, String emailMode, String batchId)` — **throws** `IllegalArgumentException` (student not found) / `IllegalStateException` (Kafka failure). Unlike `enqueue()`, admin failures must surface (controller maps them to 404/502).

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportPipelineProducerTest {

    @Mock KafkaTemplate<String, String> kafkaTemplate;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Mock InstituteBrandingService brandingService;
    @Mock UserStudentRepository userStudentRepository;
    @InjectMocks ReportPipelineProducer producer;

    @Test
    void enqueueAdmin_publishesEventWithAdminFields() throws Exception {
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findByIdWithStudentInfo(5L)).thenReturn(Optional.of(us));
        BrandingDto brand = mock(BrandingDto.class);
        when(brand.isWhitelabel()).thenReturn(false);
        when(brandingService.forInstitute(any())).thenReturn(brand);

        producer.enqueueAdmin(5L, 9L, 7L, true, "all", "batch-1");

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_GENERATE), eq("5:9"), payload.capture());
        ReportGenerateEvent ev = new ObjectMapper().readValue(payload.getValue(), ReportGenerateEvent.class);
        assertThat(ev.force).isTrue();
        assertThat(ev.reportTemplateId).isEqualTo(7L);
        assertThat(ev.emailMode).isEqualTo("all");
        assertThat(ev.batchId).isEqualTo("batch-1");
    }

    @Test
    void enqueueAdmin_unknownStudent_throws() {
        when(userStudentRepository.findByIdWithStudentInfo(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> producer.enqueueAdmin(99L, 9L, null, false, "none", "b"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

NOTE for implementer: if `kafkaTemplate.send` in this Spring Kafka version returns `ListenableFuture` rather than `CompletableFuture`, the unused import can be dropped — the test does not stub the return value.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -q test -Dtest=ReportPipelineProducerTest`
Expected: COMPILE ERROR — `enqueueAdmin` not defined.

- [ ] **Step 3: Implement.** Add to `ReportPipelineProducer.java` below `enqueue(...)`:

```java
    /**
     * Admin-triggered enqueue (Generate Queue modal). Unlike {@link #enqueue},
     * failures must SURFACE to the caller: the controller maps them to 404/502
     * and does NOT stamp the row "queued", so a dead broker can never strand a
     * chip in the queued state.
     *
     * @throws IllegalArgumentException student not found
     * @throws IllegalStateException    serialization/Kafka failure
     */
    public void enqueueAdmin(Long userStudentId, Long assessmentId, Long reportTemplateId,
                             boolean force, String emailMode, String batchId) {
        UserStudent userStudent = userStudentRepository.findByIdWithStudentInfo(userStudentId)
                .orElseThrow(() -> new IllegalArgumentException("UserStudent not found: " + userStudentId));
        BrandingDto brand = brandingService.forInstitute(userStudent.getInstitute());
        StudentInfo info = userStudent.getStudentInfo();
        String email = info != null ? info.getEmail() : null;
        String recipient = (email != null && !email.trim().isEmpty()) ? email.trim() : null;

        ReportGenerateEvent ev = new ReportGenerateEvent(userStudentId, assessmentId, recipient,
                brand.isWhitelabel(), brand.getSchoolName(), brand.getLogoUrl());
        ev.force = force;
        ev.reportTemplateId = reportTemplateId;
        ev.emailMode = emailMode;
        ev.batchId = batchId;
        try {
            kafkaTemplate.send(ReportPipelineConfig.TOPIC_GENERATE, ev.key(),
                    objectMapper.writeValueAsString(ev));
            logger.info("Report pipeline: admin enqueue student={} assessment={} template={} force={} emailMode={} batch={}",
                    userStudentId, assessmentId, reportTemplateId, force, emailMode, batchId);
        } catch (Exception e) {
            throw new IllegalStateException("Kafka enqueue failed for student " + userStudentId
                    + ": " + e.getMessage(), e);
        }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-social && mvn -q test -Dtest=ReportPipelineProducerTest`
Expected: PASS (2 tests)

- [ ] **Step 5: Leave uncommitted**

---

### Task 6: Enqueue endpoints on `UnifiedReportController`

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedEnqueueRequest.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportController.java`

**Interfaces:**
- Consumes: `ReportPipelineProducer.enqueueAdmin(...)` (Task 5), `ReportService.resolveTemplate(...)` (Task 4), `GeneratedReportRepository.findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(Long,Long,Long)`, `UserStudentRepository.findById(Long)`.
- Produces: `POST /generate-report-unified/enqueue` and `POST /generate-report-unified/enqueue/bulk`, both returning `202 {queued, batchId, results:[{userStudentId, status, message?}]}` — consumed by Task 8's frontend API functions. Row `status` values: `"queued" | "forbidden" | "error"`.

- [ ] **Step 1: Create the request DTO**

```java
package com.kccitm.api.controller.career9.report;

import java.util.List;

/**
 * Request for the async (Kafka) enqueue endpoints. Single endpoint uses
 * {@code userStudentId}; bulk uses {@code userStudentIds}. {@code force} and
 * {@code emailMode} are fully orthogonal (all four combinations valid).
 */
public class UnifiedEnqueueRequest {

    private Long userStudentId;          // single enqueue
    private List<Long> userStudentIds;   // bulk enqueue
    private Long assessmentId;
    /** Optional — null uses the assessment's default template. */
    private Long reportTemplateId;
    /** true = recompute scores + placeholders; false = re-render from cached data. */
    private Boolean force;
    /** "none" (default) or "all". "auto" is reserved for on-submission events. */
    private String emailMode;

    public UnifiedEnqueueRequest() {}

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public List<Long> getUserStudentIds() { return userStudentIds; }
    public void setUserStudentIds(List<Long> userStudentIds) { this.userStudentIds = userStudentIds; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Long getReportTemplateId() { return reportTemplateId; }
    public void setReportTemplateId(Long reportTemplateId) { this.reportTemplateId = reportTemplateId; }

    public Boolean getForce() { return force; }
    public void setForce(Boolean force) { this.force = force; }

    public String getEmailMode() { return emailMode; }
    public void setEmailMode(String emailMode) { this.emailMode = emailMode; }
}
```

- [ ] **Step 2: Add endpoints + helpers to `UnifiedReportController`**

Add imports:

```java
import java.util.Date;
import java.util.UUID;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.b2c.report.pipeline.ReportPipelineProducer;
```

Add autowired fields beside the existing ones:

```java
    @Autowired private ReportPipelineProducer reportPipelineProducer;
    @Autowired private UserStudentRepository userStudentRepository;
```

Add the two endpoints and helpers at the bottom of the class (before the closing brace):

```java
    // ═══════════════════ ASYNC ENQUEUE (Kafka → report-worker) ═══════════════════

    /**
     * Enqueue one student's report onto the Kafka pipeline. Returns 202
     * immediately; the report-worker generates it. The row is stamped
     * reportStatus="queued" ONLY after a successful publish, so a dead broker
     * can never strand the UI at "queued".
     */
    @PostMapping("/generate-report-unified/enqueue")
    @PreAuthorize("@auth.allows('generated_report.create', @auth.instituteOfStudent(#req.userStudentId))")
    public ResponseEntity<Map<String, Object>> enqueue(@RequestBody UnifiedEnqueueRequest req) {
        if (req == null || req.getUserStudentId() == null || req.getAssessmentId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "userStudentId and assessmentId are required"));
        }
        String emailMode = normalizeEmailMode(req.getEmailMode());
        if (emailMode == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "emailMode must be \"none\" or \"all\""));
        }
        ReportTemplate template;
        try {
            template = reportService.resolveTemplate(req.getAssessmentId(), req.getReportTemplateId());
        } catch (ReportRoutingException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
        String batchId = UUID.randomUUID().toString();
        boolean force = Boolean.TRUE.equals(req.getForce());
        try {
            reportPipelineProducer.enqueueAdmin(req.getUserStudentId(), req.getAssessmentId(),
                    template.getReportTemplateId(), force, emailMode, batchId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", ex.getMessage()));
        }
        stampQueued(req.getUserStudentId(), req.getAssessmentId(), template);
        return ResponseEntity.accepted().body(Map.of(
                "queued", 1, "batchId", batchId,
                "results", List.of(Map.of("userStudentId", req.getUserStudentId(), "status", "queued"))));
    }

    /**
     * Bulk enqueue — one Kafka message per student, all sharing one batchId.
     * Never fails the whole batch; per-student outcomes are returned so the UI
     * can show forbidden/error rows. Only successfully-published students are
     * stamped "queued".
     */
    @PostMapping("/generate-report-unified/enqueue/bulk")
    @PreAuthorize("@auth.allows('generated_report.create')")
    public ResponseEntity<Map<String, Object>> enqueueBulk(@RequestBody UnifiedEnqueueRequest req) {
        if (req == null || req.getAssessmentId() == null
                || req.getUserStudentIds() == null || req.getUserStudentIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "assessmentId and userStudentIds are required"));
        }
        String emailMode = normalizeEmailMode(req.getEmailMode());
        if (emailMode == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "emailMode must be \"none\" or \"all\""));
        }
        ReportTemplate template;
        try {
            template = reportService.resolveTemplate(req.getAssessmentId(), req.getReportTemplateId());
        } catch (ReportRoutingException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
        String batchId = UUID.randomUUID().toString();
        boolean force = Boolean.TRUE.equals(req.getForce());
        List<Map<String, Object>> results = new ArrayList<>();
        int queued = 0;
        for (Long sid : req.getUserStudentIds()) {
            Map<String, Object> row = new HashMap<>();
            row.put("userStudentId", sid);
            try {
                if (!auth.allows("generated_report.create", auth.instituteOfStudent(sid))) {
                    row.put("status", "forbidden");
                    row.put("message", "Not permitted for this student's institute");
                    results.add(row);
                    continue;
                }
                reportPipelineProducer.enqueueAdmin(sid, req.getAssessmentId(),
                        template.getReportTemplateId(), force, emailMode, batchId);
                stampQueued(sid, req.getAssessmentId(), template);
                row.put("status", "queued");
                queued++;
            } catch (Exception ex) {
                logger.error("Enqueue failed student={} assessment={}", sid, req.getAssessmentId(), ex);
                row.put("status", "error");
                row.put("message", ex.getMessage());
            }
            results.add(row);
        }
        Map<String, Object> response = new HashMap<>();
        response.put("queued", queued);
        response.put("batchId", batchId);
        response.put("results", results);
        return ResponseEntity.accepted().body(response);
    }

    /** null → "none" (safe default); "none"/"all" pass; anything else → invalid (null). */
    private String normalizeEmailMode(String raw) {
        if (raw == null || raw.isBlank()) return "none";
        String m = raw.trim().toLowerCase();
        return ("none".equals(m) || "all".equals(m)) ? m : null;
    }

    /** Upsert the row to "queued" — mirrors ReportService.upsertGeneratedReport identity. */
    private void stampQueued(Long userStudentId, Long assessmentId, ReportTemplate template) {
        GeneratedReport gr = generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(
                        userStudentId, assessmentId, template.getReportTemplateId())
                .orElseGet(() -> {
                    GeneratedReport n = new GeneratedReport();
                    n.setUserStudent(userStudentRepository.findById(userStudentId).orElse(null));
                    n.setAssessmentId(assessmentId);
                    n.setCreatedAt(new Date());
                    return n;
                });
        gr.setTypeOfReport(template.getEngineCode());
        gr.setReportTemplate(template);
        gr.setReportStatus("queued");   // existing reportUrl/pdfUrl stay valid until overwritten
        gr.setUpdatedAt(new Date());
        generatedReportRepository.save(gr);
    }
```

- [ ] **Step 3: Compile + run the whole backend suite**

Run: `cd spring-social && mvn -q test`
Expected: BUILD SUCCESS, all tests pass (including Tasks 1–5 tests and the pre-existing suite).

- [ ] **Step 4: Leave uncommitted**

---

### Task 7: Frontend API functions

**Files:**
- Modify: `react-social/src/app/pages/ReportTemplates/API/Report_Templates_APIs.ts` (append after `GenerateUnifiedReportsBulk`, which ends near line 150)

**Interfaces:**
- Produces: `EnqueueUnifiedReportsBulk(assessmentId, userStudentIds, reportTemplateId?, force?, emailMode?)` and `EnqueueUnifiedReport(userStudentId, assessmentId, reportTemplateId?, force?, emailMode?)`, both returning `AxiosResponse<EnqueueResponse>` — consumed by Task 8.

- [ ] **Step 1: Append to `Report_Templates_APIs.ts`:**

```ts
// ═══════════════════ ASYNC ENQUEUE (Kafka → report-worker) ═══════════════════

export type EnqueueEmailMode = "none" | "all";

export interface EnqueueResultRow {
  userStudentId: number;
  status: "queued" | "forbidden" | "error";
  message?: string;
}

export interface EnqueueResponse {
  queued: number;
  batchId: string;
  results: EnqueueResultRow[];
}

export function EnqueueUnifiedReport(
  userStudentId: number,
  assessmentId: number,
  reportTemplateId?: number,
  force = false,
  emailMode: EnqueueEmailMode = "none"
) {
  return axios.post<EnqueueResponse>(`${API_URL}/generate-report-unified/enqueue`, {
    userStudentId, assessmentId, reportTemplateId, force, emailMode,
  });
}

export function EnqueueUnifiedReportsBulk(
  assessmentId: number,
  userStudentIds: number[],
  reportTemplateId?: number,
  force = false,
  emailMode: EnqueueEmailMode = "none"
) {
  return axios.post<EnqueueResponse>(`${API_URL}/generate-report-unified/enqueue/bulk`, {
    assessmentId, userStudentIds, reportTemplateId, force, emailMode,
  });
}
```

- [ ] **Step 2: Leave uncommitted** (typecheck happens in Task 10)

---

### Task 8: `GenerateQueueModal` component

**Files:**
- Create: `react-social/src/app/pages/ReportsHub/components/GenerateQueueModal.tsx`

**Interfaces:**
- Consumes: `EnqueueUnifiedReport` / `EnqueueUnifiedReportsBulk` (Task 7), `getGeneratedReportsByAssessment` + `GeneratedReport` (existing), `zipStoredPdfs` (existing), `TemplateMappingDto` (existing).
- Produces: default export `GenerateQueueModal: React.FC<Props>` with the same `Props` shape as `GenerateReportsModal` — consumed by Task 9.

Status model: after a successful enqueue the server row IS `"queued"` (stamped before the 202 returns), so batch resolution is purely status-based — a polled row whose status is no longer `"queued"` has been resolved by the worker. No timestamp comparison needed (supersedes the spec's `updatedAt` heuristic; strictly simpler and race-free because the stamp happens synchronously before the response).

- [ ] **Step 1: Create the component (complete file):**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { zipStoredPdfs } from "../../ReportGeneration/utils/pdfZip";
import {
  EnqueueUnifiedReport,
  EnqueueUnifiedReportsBulk,
  TemplateMappingDto,
} from "../../ReportTemplates/API/Report_Templates_APIs";
import {
  getGeneratedReportsByAssessment,
} from "../../ReportGeneration/API/GeneratedReport_APIs";
import { ModalStudent } from "./GenerateReportsModal";

interface Props {
  open: boolean;
  onClose: () => void;
  assessmentId: number;
  assessmentName: string;
  templates: TemplateMappingDto[];
  initialTemplateId: number | "";
  students: ModalStudent[];
  /** Called after any batch resolves so the parent page can refresh its maps. */
  onGenerated: () => void;
}

type Entry = { reportUrl: string | null; status: string; pdfUrl: string | null; pdfStatus: string };

const POLL_MS = 4000;
const BATCH_CAP_MS = 10 * 60 * 1000; // 10 min → mark remaining as stalled

const GenerateQueueModal: React.FC<Props> = ({
  open, onClose, assessmentId, assessmentName, templates, initialTemplateId, students, onGenerated,
}) => {
  const [templateId, setTemplateId] = useState<number | "">(initialTemplateId);
  const [entries, setEntries] = useState<Map<number, Entry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  // Email toggle: default OFF on every open; confirm required to switch ON.
  const [emailOn, setEmailOn] = useState(false);
  // Current batch: students still awaiting the worker (+ start time for the cap).
  const [batch, setBatch] = useState<Set<number>>(new Set());
  const [batchTotal, setBatchTotal] = useState(0);
  const [stalled, setStalled] = useState<Set<number>>(new Set());
  const batchStartRef = useRef<number>(0);

  const single = students.length === 1;

  useEffect(() => {
    setTemplateId(initialTemplateId);
    setEmailOn(false);
    setBatch(new Set());
    setBatchTotal(0);
    setStalled(new Set());
  }, [initialTemplateId, open]);

  // Load rows for the chosen template (rows are unique per student+assessment+template).
  const loadEntries = useCallback(async () => {
    if (!open || templateId === "") { setEntries(new Map()); return new Map<number, Entry>(); }
    setLoading(true);
    try {
      const res = await getGeneratedReportsByAssessment(assessmentId);
      const map = new Map<number, Entry>();
      for (const gr of res.data || []) {
        if (gr.reportTemplateId !== templateId) continue;
        const id = gr.userStudent?.userStudentId;
        if (id) map.set(id, {
          reportUrl: gr.reportUrl, status: gr.reportStatus,
          pdfUrl: gr.pdfUrl ?? null, pdfStatus: gr.pdfStatus ?? "notRequested",
        });
      }
      setEntries(map);
      return map;
    } catch {
      return new Map<number, Entry>();
    } finally {
      setLoading(false);
    }
  }, [open, templateId, assessmentId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Poll while a batch is outstanding. A row leaves "queued" only when the
  // worker finished (success → "generated", terminal failure → "failed").
  useEffect(() => {
    if (!open || batch.size === 0) return;
    const t = setInterval(async () => {
      const map = await loadEntries();
      setBatch((prev) => {
        const next = new Set(prev);
        for (const sid of Array.from(prev)) {
          const st = map.get(sid)?.status;
          if (st && st !== "queued") next.delete(sid);
        }
        if (next.size === 0) {
          showSuccessToast("Queue batch finished");
          onGenerated();
        } else if (Date.now() - batchStartRef.current > BATCH_CAP_MS) {
          setStalled(new Set(next));
          showErrorToast(`${next.size} report(s) still queued after 10 min — is the report-worker running?`);
          return new Set<number>();
        }
        return next;
      });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [open, batch.size, loadEntries, onGenerated]);

  const tId = templateId === "" ? undefined : Number(templateId);
  const emailMode = emailOn ? ("all" as const) : ("none" as const);

  const startBatch = (ids: number[]) => {
    batchStartRef.current = Date.now();
    setStalled(new Set());
    setBatch(new Set(ids));
    setBatchTotal(ids.length);
    // Chips flip to queued immediately (server stamped rows before the 202).
    setEntries((prev) => {
      const n = new Map(prev);
      for (const id of ids) {
        const e = n.get(id);
        n.set(id, { reportUrl: e?.reportUrl ?? null, status: "queued",
          pdfUrl: e?.pdfUrl ?? null, pdfStatus: e?.pdfStatus ?? "notRequested" });
      }
      return n;
    });
  };

  const toggleEmail = () => {
    if (emailOn) { setEmailOn(false); return; }
    const yes = window.confirm(
      `Email ${students.length} student(s) their report when generation completes?\n\n` +
      `Whitelabel status is IGNORED — every selected student with an email address will receive one.`
    );
    if (yes) setEmailOn(true);
  };

  // ── enqueue one (force = which button: Regenerate ✕ = true, Regenerate = false) ──
  const enqueueOne = async (sid: number, force: boolean) => {
    if (templateId === "") { showErrorToast("Pick a report template first"); return; }
    setBusyIds((p) => new Set(p).add(sid));
    try {
      const res = await EnqueueUnifiedReport(sid, assessmentId, tId, force, emailMode);
      const row = res.data.results?.[0];
      if (row && row.status !== "queued") {
        showErrorToast(`Enqueue failed: ${row.message || row.status}`);
        return;
      }
      startBatch([sid]);
    } catch (e: any) {
      showErrorToast("Enqueue failed: " + (e?.response?.data?.error || e?.message || "error"));
    } finally {
      setBusyIds((p) => { const n = new Set(p); n.delete(sid); return n; });
    }
  };

  // ── enqueue all (single bulk call; worker concurrency does the pacing) ──
  const enqueueAll = async (force: boolean) => {
    if (templateId === "") { showErrorToast("Pick a report template first"); return; }
    const ids = students.map((s) => s.userStudentId);
    setEnqueuing(true);
    try {
      const res = await EnqueueUnifiedReportsBulk(assessmentId, ids, tId, force, emailMode);
      const okIds = (res.data.results || []).filter((r) => r.status === "queued").map((r) => r.userStudentId);
      const failed = (res.data.results || []).filter((r) => r.status !== "queued");
      if (failed.length) showErrorToast(`${failed.length} student(s) not queued (${failed[0].status})`);
      if (okIds.length === 0) return;
      startBatch(okIds);
      showSuccessToast(`Queued ${okIds.length}/${ids.length}${emailOn ? " (emails ON)" : ""}`);
    } catch (e: any) {
      showErrorToast("Bulk enqueue failed: " + (e?.response?.data?.error || e?.message || "error"));
    } finally {
      setEnqueuing(false);
    }
  };

  // ── downloads (same as GenerateReportsModal — straight from Spaces) ──
  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const safe = (s: string) => (s || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

  const downloadUrlAsFile = async (url: string, fileName: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    triggerDownload(await res.blob(), fileName);
  };

  const downloadOnePdf = async (s: ModalStudent) => {
    const e = entries.get(s.userStudentId);
    if (!e?.pdfUrl) { showErrorToast("PDF not ready yet"); return; }
    setDownloadingId(s.userStudentId);
    try { await downloadUrlAsFile(e.pdfUrl, `${safe(s.name)}_report.pdf`); }
    catch { showErrorToast("Download failed"); }
    finally { setDownloadingId(null); }
  };

  const downloadAllZip = async () => {
    // Zip guard: zipping mid-batch downloads the PREVIOUS versions still in Spaces.
    if (batch.size > 0) {
      const yes = window.confirm(`${batch.size} report(s) still regenerating — zip the current versions anyway?`);
      if (!yes) return;
    }
    const items = students
      .map((s) => ({ fileName: `${safe(s.name)}_report`, pdfUrl: entries.get(s.userStudentId)?.pdfUrl ?? null }))
      .filter((x) => !!x.pdfUrl);
    if (items.length === 0) { showErrorToast("No ready PDFs to download"); return; }
    setDownloadingAll(true);
    try {
      const { blob, added, skipped } = await zipStoredPdfs(items);
      if (added === 0) { showErrorToast("No PDFs could be downloaded"); return; }
      triggerDownload(blob, `${safe(assessmentName)}_reports.zip`);
      if (skipped.length) showErrorToast(`${skipped.length} report(s) skipped (PDF not ready)`);
    } catch { showErrorToast("ZIP download failed"); }
    finally { setDownloadingAll(false); }
  };

  if (!open) return null;

  const selectedTemplate = templates.find((m) => m.template.reportTemplateId === templateId);
  const resolved = batchTotal - batch.size;
  const readyPdfCount = students.filter((s) => {
    const e = entries.get(s.userStudentId);
    return e?.pdfStatus === "ready" && !!e?.pdfUrl;
  }).length;

  const chip = (sid: number) => {
    const e = entries.get(sid);
    if (stalled.has(sid)) return <span className="badge badge-light-warning" title="Report-worker may not be running">Stalled ⚠</span>;
    if (batch.has(sid) || e?.status === "queued") return <span className="badge badge-light-info">Queued…</span>;
    if (e?.status === "generated" && e.reportUrl) return <span className="badge badge-light-success">Generated</span>;
    if (e?.status === "failed") return <span className="badge badge-light-danger">Failed</span>;
    return <span className="badge badge-light-warning">Not generated</span>;
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flexGrow: 1 }}>
            <h3 style={{ margin: 0 }}>Generate Queue</h3>
            <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              {assessmentName} · {students.length} student{students.length !== 1 ? "s" : ""} · via report-worker
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* template picker */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: 4 }}>
            Report to generate
          </label>
          <select
            className="form-select"
            value={templateId}
            disabled={templates.length === 0 || enqueuing || batch.size > 0}
            onChange={(e) => setTemplateId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            {templates.length === 0 ? (
              <option value="">No template mapped to this assessment</option>
            ) : (
              templates.map((m) => (
                <option key={m.template.reportTemplateId} value={m.template.reportTemplateId}>
                  {m.template.displayName}{m.isDefault ? " (default)" : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {/* email toggle */}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div className="form-check form-switch" style={{ marginBottom: 0 }}>
            <input className="form-check-input" type="checkbox" id="queueEmailToggle"
              checked={emailOn} onChange={toggleEmail} disabled={enqueuing} />
            <label className="form-check-label" htmlFor="queueEmailToggle" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Email these students
            </label>
          </div>
          <span style={{ fontSize: "0.75rem", color: emailOn ? "#dc2626" : "#9ca3af" }}>
            {emailOn ? "ON — every student with an address will be emailed (whitelabel ignored)" : "off"}
          </span>
        </div>

        {/* batch progress */}
        {batchTotal > 0 && batch.size > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.8rem", color: "#374151", marginBottom: 4 }}>
              Worker processing {resolved}/{batchTotal}…
            </div>
            <div style={{ height: 8, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${batchTotal ? (resolved / batchTotal) * 100 : 0}%`,
                background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width 0.3s",
              }} />
            </div>
          </div>
        )}

        {/* student list */}
        <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table className="table table-sm align-middle" style={{ marginBottom: 0 }}>
            <thead><tr style={{ fontSize: "0.78rem", color: "#6b7280" }}>
              <th>Name</th><th>Username</th><th>Status</th><th className="text-end">Actions</th>
            </tr></thead>
            <tbody>
              {students.map((s) => {
                const e = entries.get(s.userStudentId);
                const busy = busyIds.has(s.userStudentId) || batch.has(s.userStudentId);
                return (
                  <tr key={s.userStudentId}>
                    <td style={{ fontWeight: 600 }}>{s.name || "-"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.username || "—"}</td>
                    <td>{chip(s.userStudentId)}</td>
                    <td className="text-end">
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button className="btn btn-sm btn-light-danger py-1" disabled={busy || enqueuing || templateId === ""}
                          title="Recalculate scores + placeholders, regenerate report + PDF"
                          onClick={() => enqueueOne(s.userStudentId, true)}>
                          {busy ? "…" : "Regenerate ✕"}
                        </button>
                        <button className="btn btn-sm btn-light py-1" disabled={busy || enqueuing || templateId === ""}
                          title="Re-render from existing scores, regenerate PDF"
                          onClick={() => enqueueOne(s.userStudentId, false)}>
                          {busy ? "…" : "Regenerate"}
                        </button>
                        <button className="btn btn-sm btn-light-success py-1"
                          disabled={downloadingId === s.userStudentId || e?.pdfStatus !== "ready" || !e?.pdfUrl}
                          title={e?.pdfStatus !== "ready" ? `PDF ${e?.pdfStatus ?? "not requested"}` : "Download PDF"}
                          onClick={() => downloadOnePdf(s)}>
                          {downloadingId === s.userStudentId ? "…" : "PDF"}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {!single && (
            <>
              <button className="btn btn-danger" disabled={enqueuing || batch.size > 0 || templateId === ""}
                title="Recalculate scores + placeholders for every student"
                onClick={() => enqueueAll(true)}>
                {enqueuing ? "Queuing…" : `Regenerate ✕ all (${students.length})`}
              </button>
              <button className="btn btn-primary" disabled={enqueuing || batch.size > 0 || templateId === ""}
                title="Re-render every report from existing scores"
                onClick={() => enqueueAll(false)}>
                {enqueuing ? "Queuing…" : `Regenerate all (${students.length})`}
              </button>
            </>
          )}
          {single && (
            <span style={{ fontSize: "0.78rem", color: "#6b7280", alignSelf: "center" }}>
              Use the row buttons to queue this student.
            </span>
          )}
          <button className="btn btn-light-success" disabled={downloadingAll || readyPdfCount === 0}
            onClick={() => (single ? downloadOnePdf(students[0]) : downloadAllZip())}>
            {downloadingAll ? "Zipping…" : single ? "Download PDF" : `Download all as ZIP (${readyPdfCount})`}
          </button>
          <div style={{ flexGrow: 1 }} />
          <button className="btn btn-light" onClick={onClose}>Close</button>
        </div>
        {loading && <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: 8 }}>Loading current status…</div>}
        {selectedTemplate && (
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 8 }}>
            Engine: {selectedTemplate.template.engineCode}
            {!selectedTemplate.template.hasTemplate && " · ⚠ no HTML uploaded for this template"}
          </div>
        )}
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1060,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const panel: React.CSSProperties = {
  background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 760,
  maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};
const closeBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: "1.1rem", cursor: "pointer", color: "#6b7280",
};

export default GenerateQueueModal;
```

Prerequisite check: `ModalStudent` must be exported from `GenerateReportsModal.tsx` — it already is (`export interface ModalStudent`, line 13). `loadEntries` in this component returns the map (the sync modal's doesn't) — that is intentional, the poll effect consumes the fresh map directly.

- [ ] **Step 2: Leave uncommitted** (typecheck in Task 10)

---

### Task 9: Wire the modal into `ReportsHubPage`

**Files:**
- Modify: `react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx`

**Interfaces:**
- Consumes: `GenerateQueueModal` (Task 8).

- [ ] **Step 1: Import** — below line 38 (`import GenerateReportsModal, { ModalStudent } from "./components/GenerateReportsModal";`) add:

```tsx
import GenerateQueueModal from "./components/GenerateQueueModal";
```

- [ ] **Step 2: State** — below line 164 (`const [generateModalOpen, setGenerateModalOpen] = useState(false);`) add:

```tsx
  const [queueModalOpen, setQueueModalOpen] = useState(false);
```

- [ ] **Step 3: Opener** — the existing `openGenerateModal` (line 529) builds `modalStudents` then calls `setGenerateModalOpen(true)`. Directly after that function add:

```tsx
  const openQueueModal = () => {
    if (!selectedAssessmentObj) return;
    const ids = getSelectedOrAllIds();
    if (ids.length === 0) { showErrorToast("Select at least one student."); return; }
    if (templates.length === 0) {
      showErrorToast("No report template is mapped to this assessment. Map one in Report Templates or the assessment editor first.");
      return;
    }
    const list: ModalStudent[] = ids.map((id) => {
      const s = students.find((st) => st.userStudentId === id);
      return { userStudentId: id, name: s?.name || `Student ${id}`, username: s?.username };
    });
    setModalStudents(list);
    setQueueModalOpen(true);
  };
```

- [ ] **Step 4: Header action** — in the `actions=[...]` array (line ~851), after the `Generate${countLabel}` entry insert:

```tsx
          {
            label: `Queue${countLabel}`,
            iconClass: "bi-stack",
            onClick: openQueueModal,
            variant: "ghost",
            disabled: !ready || displayedStudents.length === 0,
          },
```

- [ ] **Step 5: Inline toolbar button** — after the inline `Generate${countLabel}` button (the `</button>` closing at ~line 1092, just before the `{/* Download ZIP */}` comment) insert:

```tsx
                  {/* Generate via Kafka queue → report-worker */}
                  <button className="btn btn-sm btn-light" disabled={displayedStudents.length === 0}
                    onClick={openQueueModal}
                    style={{ borderRadius: 8, padding: "8px 20px", fontWeight: 600, fontSize: "0.85rem" }}>
                    {`Queue${countLabel}`}
                  </button>
```

- [ ] **Step 6: Render the modal** — after the `GenerateReportsModal` block (closes at line ~1491) add:

```tsx
      {queueModalOpen && selectedAssessmentObj && (
        <GenerateQueueModal
          open={queueModalOpen}
          onClose={() => setQueueModalOpen(false)}
          assessmentId={selectedAssessmentObj.id}
          assessmentName={selectedAssessmentName}
          templates={templates}
          initialTemplateId={selectedTemplateId}
          students={modalStudents}
          onGenerated={onModalGenerated}
        />
      )}
```

- [ ] **Step 7: Leave uncommitted**

---

### Task 10: Full verification

- [ ] **Step 1: Backend** — Run: `cd spring-social && mvn -q test`
Expected: BUILD SUCCESS, all tests green.

- [ ] **Step 2: Frontend** — Run: `cd react-social && npx tsc --noEmit 2>&1 | grep -iE "fourPager|ReportsHub|Report_Templates|GenerateQueue" ; echo done`
Expected: no lines before `done` (pre-existing errors in unrelated files are out of scope).

- [ ] **Step 3: Manual end-to-end note** — full pipeline verification (enqueue → worker consumes → row flips → poll resolves → optional email) requires local Kafka + Redis + a process running with `--spring.profiles.active=report-worker`. Document the smoke steps in the final report; do not block on infra that isn't running locally.

- [ ] **Step 4: Leave uncommitted; report summary to user**
