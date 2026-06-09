# Server-Rendered Report PDFs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **PROJECT CONVENTION — NO COMMITS/STAGING:** Per the user's standing instruction, do **not** `git commit`, `git add`, stage, branch, or open worktrees. Each task ends with a **✅ Checkpoint** (a logically complete, reviewable unit) instead of a commit — leave changes unstaged for the user to review. Wherever a sub-skill says "commit", treat it as "reach a green checkpoint and pause for review".

**Goal:** Replace the inconsistent client-side `html2canvas`/`jsPDF` report download with server-rendered, Chromium-faithful PDFs that are pre-generated asynchronously at report-generation time, stored on DigitalOcean Spaces beside the HTML, and downloaded directly by the admin Reports Hub.

**Architecture:** `ReportService.generate()` stores the filled HTML (as today) and enqueues a durable `pdf_render_job` row (no inline rendering). A `@Scheduled` in-process poller claims jobs with `FOR UPDATE SKIP LOCKED`, renders the report's HTML URL to PDF via a self-hosted **Gotenberg** (headless Chromium) container, uploads the PDF to Spaces, and flips the report's `pdf_status`→`ready` + `pdf_url`. The Reports Hub polls status and downloads the stored PDF (or HTML) straight from the CDN; bulk ZIP bundles the already-rendered PDFs client-side.

**Tech Stack:** Spring Boot 2.5.x (Java, MySQL 8 + Flyway, JUnit 5 + Mockito + `MockRestServiceServer`), Gotenberg (Docker), React 17 + TypeScript (CRA / `react-scripts test` = Jest + RTL), JSZip.

**Design spec:** [docs/superpowers/specs/2026-06-03-server-rendered-report-pdfs-design.md](../specs/2026-06-03-server-rendered-report-pdfs-design.md)

---

## File Structure

**Backend — create:**
- `spring-social/src/main/resources/db/migration/V20260603001__generated_report_pdf_and_render_jobs.sql` — schema.
- `spring-social/src/main/java/com/kccitm/api/model/career9/report/PdfRenderJob.java` — job entity.
- `spring-social/src/main/java/com/kccitm/api/repository/Career9/report/PdfRenderJobRepository.java` — claim + recovery queries.
- `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/GotenbergClient.java` — HTML-URL→PDF bytes.
- `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderWorker.java` — scheduled poller/orchestrator.
- `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderClaimService.java` — `@Transactional` SKIP-LOCKED batch claim (separate bean so the proxy applies).
- `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderEnqueueService.java` — enqueue/refresh a job (keeps `ReportService` lean).
- Tests: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pdf/GotenbergClientTest.java`, `PdfRenderWorkerTest.java`.

**Backend — modify:**
- `model/career9/GeneratedReport.java` — add `pdfUrl`, `pdfStatus`.
- `service/b2c/report/ReportResult.java` — add `pdfUrl`, `pdfStatus`.
- `service/b2c/report/ReportService.java` — set `pdf_status=pending`, call enqueue service (steps 6b/6c).
- `controller/career9/report/UnifiedReportController.java` + `UnifiedReportResponse.java` — surface `pdfUrl`/`pdfStatus`; add retry endpoint.
- `repository/Career9/GeneratedReportRepository.java` — finder for retry endpoint (if missing).
- `src/main/resources/application*.yml` — `app.gotenberg.url`, poller config.
- The app's `@SpringBootApplication` / a `@Configuration` — `@EnableScheduling` (only if not already enabled).

**Infra — modify:**
- `docker-compose.yml` — add `gotenberg` service.

**Frontend — modify:**
- `react-social/src/app/pages/ReportTemplates/API/Report_Templates_APIs.ts` — response types gain `pdfUrl`/`pdfStatus`.
- `react-social/src/app/pages/ReportGeneration/API/GeneratedReport_APIs.ts` — add `retryReportPdf`.
- `react-social/src/app/pages/ReportGeneration/utils/pdfZip.ts` (new) — bundle stored PDFs into a ZIP (pure, testable) + test.
- `react-social/src/app/pages/ReportsHub/components/GenerateReportsModal.tsx` — PDF/HTML download from Spaces; drop `htmlToPdfBlob`.
- `react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx` — `ReportData` gains `pdfUrl`/`pdfStatus`; rows + ZIP use stored PDFs.
- `react-social/src/app/pages/ReportGeneration/utils/htmlToPdf.ts` — remove `htmlToPdfBlob` (html2canvas/jsPDF); keep nothing client-rasterizing.

---

## Phase 1 — Backend data model & migration

### Task 1: Flyway migration — columns + job table

**Files:**
- Create: `spring-social/src/main/resources/db/migration/V20260603001__generated_report_pdf_and_render_jobs.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ---------------------------------------------------------------------------
-- V20260603001__generated_report_pdf_and_render_jobs.sql
--
-- Server-rendered report PDFs. Adds the stored-PDF columns to generated_report
-- and a durable render-job queue drained by an in-process scheduled poller.
--   generated_report.pdf_url     — Spaces URL of the rendered PDF (NULL until ready)
--   generated_report.pdf_status  — notRequested | pending | rendering | ready | failed
--                                  existing rows backfill to 'notRequested' (they have
--                                  HTML but no PDF/job, so must NOT appear as "rendering")
-- pdf_render_job is the queue + tracking source of truth (one active row per report).
-- ---------------------------------------------------------------------------

ALTER TABLE generated_report
  ADD COLUMN pdf_url    VARCHAR(4096) NULL,
  ADD COLUMN pdf_status VARCHAR(50)   NOT NULL DEFAULT 'notRequested';

CREATE TABLE pdf_render_job (
  pdf_render_job_id    BIGINT        NOT NULL AUTO_INCREMENT,
  generated_report_id  BIGINT        NOT NULL,
  report_url           VARCHAR(4096) NOT NULL,
  status               VARCHAR(50)   NOT NULL DEFAULT 'pending',
  attempts             INT           NOT NULL DEFAULT 0,
  max_attempts         INT           NOT NULL DEFAULT 3,
  last_error           TEXT          NULL,
  lease_until          DATETIME      NULL,
  created_at           DATETIME      NOT NULL,
  updated_at           DATETIME      NOT NULL,
  PRIMARY KEY (pdf_render_job_id),
  UNIQUE KEY uk_prj_generated_report (generated_report_id),
  KEY idx_prj_status_lease (status, lease_until),
  CONSTRAINT fk_prj_generated_report FOREIGN KEY (generated_report_id)
    REFERENCES generated_report(generated_report_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Verify it applies**

Run: `cd spring-social && ./mvnw -q flyway:info` (or boot the app on the dev DB and confirm Flyway logs `Migrating ... V20260603001`).
Expected: migration listed/applied with no SQL error; `DESCRIBE generated_report;` shows `pdf_url`, `pdf_status`; `SHOW TABLES LIKE 'pdf_render_job';` returns the table.

- [ ] **✅ Checkpoint:** schema in place; leave files unstaged.

---

### Task 2: `GeneratedReport` entity — add `pdfUrl`, `pdfStatus`

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/model/career9/GeneratedReport.java`

- [ ] **Step 1: Add the columns** after the existing `reportUrl` field (around line 79):

```java
    @Column(name = "pdf_url", length = 4096)
    private String pdfUrl;

    // notRequested | pending | rendering | ready | failed
    @Column(name = "pdf_status", nullable = false, length = 50)
    private String pdfStatus = "notRequested";
```

- [ ] **Step 2: Add accessors** next to `getReportUrl`/`setReportUrl`:

```java
    public String getPdfUrl() { return pdfUrl; }
    public void setPdfUrl(String pdfUrl) { this.pdfUrl = pdfUrl; }

    public String getPdfStatus() { return pdfStatus; }
    public void setPdfStatus(String pdfStatus) { this.pdfStatus = pdfStatus; }
```

- [ ] **Step 3: Compile**

Run: `cd spring-social && ./mvnw -q -o compile`
Expected: BUILD SUCCESS.

- [ ] **✅ Checkpoint.**

---

### Task 3: `PdfRenderJob` entity + repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/report/PdfRenderJob.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/report/PdfRenderJobRepository.java`

- [ ] **Step 1: Write the entity**

```java
package com.kccitm.api.model.career9.report;

import java.io.Serializable;
import java.util.Date;
import javax.persistence.*;

/** Durable PDF render-job queue row. One active row per generated_report. */
@Entity
@Table(name = "pdf_render_job",
    uniqueConstraints = @UniqueConstraint(name = "uk_prj_generated_report",
        columnNames = {"generated_report_id"}))
public class PdfRenderJob implements Serializable {

    public static final String PENDING   = "pending";
    public static final String RENDERING = "rendering";
    public static final String DONE      = "done";
    public static final String FAILED    = "failed";

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "pdf_render_job_id")
    private Long pdfRenderJobId;

    @Column(name = "generated_report_id", nullable = false)
    private Long generatedReportId;

    @Column(name = "report_url", nullable = false, length = 4096)
    private String reportUrl;

    @Column(name = "status", nullable = false, length = 50)
    private String status = PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "lease_until")
    private Date leaseUntil;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    @PrePersist
    protected void onCreate() { this.createdAt = new Date(); this.updatedAt = new Date(); }

    @PreUpdate
    protected void onUpdate() { this.updatedAt = new Date(); }

    public Long getPdfRenderJobId() { return pdfRenderJobId; }
    public Long getGeneratedReportId() { return generatedReportId; }
    public void setGeneratedReportId(Long v) { this.generatedReportId = v; }
    public String getReportUrl() { return reportUrl; }
    public void setReportUrl(String v) { this.reportUrl = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int v) { this.attempts = v; }
    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int v) { this.maxAttempts = v; }
    public String getLastError() { return lastError; }
    public void setLastError(String v) { this.lastError = v; }
    public Date getLeaseUntil() { return leaseUntil; }
    public void setLeaseUntil(Date v) { this.leaseUntil = v; }
    public Date getCreatedAt() { return createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
}
```

- [ ] **Step 2: Write the repository**

Note: `@Lock`/`@QueryHints` are **ignored for native queries** — the `FOR UPDATE SKIP LOCKED`
clause in the SQL is what provides the row locking. The locks are held for the duration of the
caller's transaction, so `claimRunnable` MUST be called inside `@Transactional` (Task 8's
`PdfRenderClaimService`).

```java
package com.kccitm.api.repository.Career9.report;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.PdfRenderJob;

@Repository
public interface PdfRenderJobRepository extends JpaRepository<PdfRenderJob, Long> {

    Optional<PdfRenderJob> findByGeneratedReportId(Long generatedReportId);

    /**
     * Claim runnable jobs without contention across instances: PENDING, or
     * RENDERING whose lease expired (crash recovery). SKIP LOCKED (MySQL 8)
     * lets concurrent pollers/instances each grab a disjoint batch. Must run
     * inside a transaction (see PdfRenderClaimService).
     */
    @Query(value = "SELECT * FROM pdf_render_job "
            + "WHERE status = 'pending' "
            + "   OR (status = 'rendering' AND (lease_until IS NULL OR lease_until < :now)) "
            + "ORDER BY pdf_render_job_id ASC "
            + "LIMIT :limit FOR UPDATE SKIP LOCKED",
            nativeQuery = true)
    List<PdfRenderJob> claimRunnable(@Param("now") Date now, @Param("limit") int limit);
}
```

- [ ] **Step 3: Compile**

Run: `cd spring-social && ./mvnw -q -o compile`
Expected: BUILD SUCCESS.

- [ ] **✅ Checkpoint.**

---

### Task 4: `ReportResult` — carry `pdfUrl`/`pdfStatus`

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportResult.java`

- [ ] **Step 1: Add fields + constructor params.** Replace the class body with:

```java
package com.kccitm.api.service.b2c.report;

import java.util.Date;

/** Return shape of {@code ReportService.generate(...)}. */
public class ReportResult {

    public final String reportUrl;
    public final String typeCode;
    public final String subtypeCode;
    public final Date calculatedAt;
    public final Date renderedAt;
    public final boolean alreadyExisted;
    public final String pdfUrl;     // null until the async render completes
    public final String pdfStatus;  // notRequested | pending | rendering | ready | failed

    public ReportResult(String reportUrl, String typeCode, String subtypeCode,
                        Date calculatedAt, Date renderedAt, boolean alreadyExisted,
                        String pdfUrl, String pdfStatus) {
        this.reportUrl = reportUrl;
        this.typeCode = typeCode;
        this.subtypeCode = subtypeCode;
        this.calculatedAt = calculatedAt;
        this.renderedAt = renderedAt;
        this.alreadyExisted = alreadyExisted;
        this.pdfUrl = pdfUrl;
        this.pdfStatus = pdfStatus;
    }
}
```

- [ ] **Step 2:** Do not compile yet — `ReportService` (Task 7) is the only caller and is updated there. Proceed.

- [ ] **✅ Checkpoint.**

---

## Phase 2 — Gotenberg client

### Task 5: Config property + `RestTemplate` bean for Gotenberg

**Files:**
- Modify: `spring-social/src/main/resources/application.yml` (and the active profile file, e.g. `application-dev.yml`, if profiles override blocks)
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/GotenbergConfig.java`

- [ ] **Step 1: Add config** under the existing `app:` tree in `application.yml`:

```yaml
app:
  gotenberg:
    url: ${GOTENBERG_URL:http://localhost:3000}
    # seconds Chromium waits after load for client-side charts to settle
    wait-delay: ${GOTENBERG_WAIT_DELAY:2}
  pdf-render:
    poll-ms: ${PDF_RENDER_POLL_MS:3000}      # poller tick
    max-concurrent: ${PDF_RENDER_MAX_CONCURRENT:4}  # global in-flight cap (protect Gotenberg)
    lease-seconds: ${PDF_RENDER_LEASE_SECONDS:180}  # stale-RENDERING recovery window
```

- [ ] **Step 2: Dedicated RestTemplate** (timeouts sized for Chromium renders):

```java
package com.kccitm.api.service.b2c.report.pdf;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class GotenbergConfig {

    @Bean(name = "gotenbergRestTemplate")
    public RestTemplate gotenbergRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(120))
                .build();
    }
}
```

- [ ] **Step 3: Compile.** Run: `cd spring-social && ./mvnw -q -o compile` → BUILD SUCCESS.
- [ ] **✅ Checkpoint.**

---

### Task 6: `GotenbergClient.renderUrl(url)` (TDD)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/GotenbergClient.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pdf/GotenbergClientTest.java`

- [ ] **Step 1: Write the failing test** (uses Spring's `MockRestServiceServer`):

```java
package com.kccitm.api.service.b2c.report.pdf;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GotenbergClientTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private GotenbergClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.createServer(restTemplate);
        client = new GotenbergClient(restTemplate, "http://gotenberg:3000", 2);
    }

    @Test
    void renderUrl_postsToChromiumConvertUrl_andReturnsPdfBytes() {
        byte[] fakePdf = "%PDF-1.7 fake".getBytes();
        server.expect(requestTo("http://gotenberg:3000/forms/chromium/convert/url"))
              .andExpect(method(org.springframework.http.HttpMethod.POST))
              .andExpect(header("Content-Type", org.hamcrest.Matchers.startsWith("multipart/form-data")))
              .andRespond(withSuccess(fakePdf, MediaType.APPLICATION_PDF));

        byte[] out = client.renderUrl("https://cdn.example/report.html");

        assertThat(out).isEqualTo(fakePdf);
        server.verify();
    }
}
```

- [ ] **Step 2: Run it — expect FAIL** (class doesn't exist):

Run: `cd spring-social && ./mvnw -q -o test -Dtest=GotenbergClientTest`
Expected: compile/red failure.

- [ ] **Step 3: Implement `GotenbergClient`**

```java
package com.kccitm.api.service.b2c.report.pdf;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

/** Thin wrapper over Gotenberg's Chromium URL→PDF endpoint. */
@Component
public class GotenbergClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final int waitDelaySeconds;

    public GotenbergClient(
            @Qualifier("gotenbergRestTemplate") RestTemplate restTemplate,
            @Value("${app.gotenberg.url}") String baseUrl,
            @Value("${app.gotenberg.wait-delay:2}") int waitDelaySeconds) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.waitDelaySeconds = waitDelaySeconds;
    }

    /** Render a publicly-reachable HTML URL to PDF bytes. Throws on non-2xx. */
    public byte[] renderUrl(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("url", url);
        form.add("printBackground", "true");
        form.add("preferCssPageSize", "true");
        form.add("marginTop", "0");
        form.add("marginBottom", "0");
        form.add("marginLeft", "0");
        form.add("marginRight", "0");
        // Give client-side chart scripts time to paint before capture.
        form.add("waitDelay", waitDelaySeconds + "s");

        HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(form, headers);
        ResponseEntity<byte[]> resp = restTemplate.postForEntity(
                baseUrl + "/forms/chromium/convert/url", req, byte[].class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new IllegalStateException("Gotenberg render failed: HTTP " + resp.getStatusCode());
        }
        return resp.getBody();
    }
}
```

- [ ] **Step 4: Run the test — expect PASS.**

Run: `cd spring-social && ./mvnw -q -o test -Dtest=GotenbergClientTest`
Expected: PASS, `server.verify()` green.

- [ ] **✅ Checkpoint.**

---

## Phase 3 — Enqueue on generate

### Task 7: Enqueue service + wire into `ReportService.generate`

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderEnqueueService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportService.java`

- [ ] **Step 1: Write the enqueue service** (idempotent: one job per report, reset to PENDING on regenerate):

```java
package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Creates or resets the single render job for a generated report. */
@Service
public class PdfRenderEnqueueService {

    @Autowired private PdfRenderJobRepository jobRepository;

    /** Upsert the job to PENDING with a fresh attempt budget. */
    public void enqueue(Long generatedReportId, String reportUrl) {
        PdfRenderJob job = jobRepository.findByGeneratedReportId(generatedReportId)
                .orElseGet(PdfRenderJob::new);
        job.setGeneratedReportId(generatedReportId);
        job.setReportUrl(reportUrl);
        job.setStatus(PdfRenderJob.PENDING);
        job.setAttempts(0);
        job.setLastError(null);
        job.setLeaseUntil(null);
        jobRepository.save(job);
    }
}
```

- [ ] **Step 2: Wire into `ReportService`.** Add the field near the other `@Autowired` fields:

```java
    @Autowired private com.kccitm.api.service.b2c.report.pdf.PdfRenderEnqueueService pdfRenderEnqueueService;
```

- [ ] **Step 3: Set status + enqueue in `upsertGeneratedReport`.** In `ReportService.java` change the upsert (around line 299-302) so the row is marked pending and reset:

```java
        gr.setTypeOfReport(template.getEngineCode());
        gr.setReportTemplate(template);
        gr.setReportStatus("generated");
        gr.setReportUrl(reportUrl);
        gr.setPdfStatus("pending");   // async render will flip to ready/failed
        gr.setPdfUrl(null);           // stale PDF invalidated; re-rendered from new HTML
        gr.setUpdatedAt(new Date());
        GeneratedReport saved = generatedReportRepository.save(gr);
        pdfRenderEnqueueService.enqueue(saved.getGeneratedReportId(), reportUrl);
        return saved;
```

(Remove the old `return generatedReportRepository.save(gr);` line replaced above.)

- [ ] **Step 4: Update the `ReportResult` construction** at the end of `generate()` (line ~177). The PDF is async, so report the pending state:

```java
        GeneratedReport gr = upsertGeneratedReport(userStudentId, assessmentId, template, reportUrl);

        return new ReportResult(reportUrl, template.getEngineCode(), templateLabel(template),
                calcRow.getCalculatedAt(), gr.getUpdatedAt(), reusedCalc,
                gr.getPdfUrl(), gr.getPdfStatus());
```

- [ ] **Step 5: Compile**

Run: `cd spring-social && ./mvnw -q -o compile`
Expected: BUILD SUCCESS (confirms `ReportResult`'s new constructor + all call sites line up).

- [ ] **Step 6: Focused test — generate enqueues exactly one pending job.** Add a Mockito test that drives only `upsertGeneratedReport` via a small seam, or assert at the enqueue service. Minimal, dependency-light test on the enqueue service:

**File:** `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderEnqueueServiceTest.java`

```java
package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PdfRenderEnqueueServiceTest {

    @Mock PdfRenderJobRepository jobRepository;
    @InjectMocks PdfRenderEnqueueService service;

    @Test
    void enqueue_resetsExistingJobToPending() {
        PdfRenderJob existing = new PdfRenderJob();
        existing.setStatus(PdfRenderJob.FAILED);
        existing.setAttempts(3);
        existing.setLastError("boom");
        when(jobRepository.findByGeneratedReportId(7L)).thenReturn(Optional.of(existing));

        service.enqueue(7L, "https://cdn/r.html");

        ArgumentCaptor<PdfRenderJob> cap = ArgumentCaptor.forClass(PdfRenderJob.class);
        verify(jobRepository).save(cap.capture());
        PdfRenderJob saved = cap.getValue();
        assertThat(saved.getStatus()).isEqualTo(PdfRenderJob.PENDING);
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getLastError()).isNull();
        assertThat(saved.getReportUrl()).isEqualTo("https://cdn/r.html");
    }
}
```

Run: `cd spring-social && ./mvnw -q -o test -Dtest=PdfRenderEnqueueServiceTest`
Expected: PASS.

- [ ] **✅ Checkpoint:** generation now stores HTML + enqueues a pending PDF job; nothing renders inline.

---

## Phase 4 — Worker / poller

### Task 8: `PdfRenderWorker` orchestration (TDD)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderWorker.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderWorkerTest.java`

The worker exposes a `renderOne(PdfRenderJob)` method (pure orchestration, easy to test) and a `@Scheduled pollAndRender()` that claims a batch and calls `renderOne` for each.

- [ ] **Step 1: Write failing tests for `renderOne`** (success + failure-retry paths):

```java
package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PdfRenderWorkerTest {

    @Mock PdfRenderClaimService claimService; // unused by renderOne tests; satisfies @InjectMocks
    @Mock PdfRenderJobRepository jobRepository;
    @Mock GeneratedReportRepository generatedReportRepository;
    @Mock GotenbergClient gotenberg;
    @Mock DigitalOceanSpacesService spaces;
    @InjectMocks PdfRenderWorker worker;

    private PdfRenderJob job(long grId) {
        PdfRenderJob j = new PdfRenderJob();
        j.setGeneratedReportId(grId);
        j.setReportUrl("https://cdn/report-renders/pager-insight/assessment-9/student_3_pager-insight.html");
        j.setStatus(PdfRenderJob.RENDERING);
        j.setMaxAttempts(3);
        return j;
    }

    @Test
    void renderOne_success_uploadsPdf_marksReady() {
        PdfRenderJob j = job(42L);
        GeneratedReport gr = new GeneratedReport();
        when(gotenberg.renderUrl(j.getReportUrl())).thenReturn("%PDF".getBytes());
        when(spaces.uploadBytes(any(), eq("application/pdf"),
                eq("report-renders/pager-insight/assessment-9"),
                eq("student_3_pager-insight.pdf"))).thenReturn("https://cdn/.../student_3_pager-insight.pdf");
        when(generatedReportRepository.findById(42L)).thenReturn(Optional.of(gr));

        worker.renderOne(j);

        assertThat(gr.getPdfStatus()).isEqualTo("ready");
        assertThat(gr.getPdfUrl()).isEqualTo("https://cdn/.../student_3_pager-insight.pdf");
        assertThat(j.getStatus()).isEqualTo(PdfRenderJob.DONE);
        verify(generatedReportRepository).save(gr);
        verify(jobRepository).save(j);
    }

    @Test
    void renderOne_failure_underBudget_requeuesPending() {
        PdfRenderJob j = job(42L);
        j.setAttempts(0);
        when(gotenberg.renderUrl(anyString())).thenThrow(new IllegalStateException("HTTP 503"));

        worker.renderOne(j);

        assertThat(j.getStatus()).isEqualTo(PdfRenderJob.PENDING);
        assertThat(j.getAttempts()).isEqualTo(1);
        assertThat(j.getLastError()).contains("503");
        verify(jobRepository).save(j);
        verify(generatedReportRepository, never()).save(any());
    }

    @Test
    void renderOne_failure_overBudget_marksFailed_andReportFailed() {
        PdfRenderJob j = job(42L);
        j.setAttempts(2); // this attempt makes 3 == maxAttempts
        GeneratedReport gr = new GeneratedReport();
        when(gotenberg.renderUrl(anyString())).thenThrow(new IllegalStateException("boom"));
        when(generatedReportRepository.findById(42L)).thenReturn(Optional.of(gr));

        worker.renderOne(j);

        assertThat(j.getStatus()).isEqualTo(PdfRenderJob.FAILED);
        assertThat(gr.getPdfStatus()).isEqualTo("failed");
        verify(jobRepository).save(j);
        verify(generatedReportRepository).save(gr);
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (no class). `./mvnw -q -o test -Dtest=PdfRenderWorkerTest`.

- [ ] **Step 3a: Implement `PdfRenderClaimService`** (separate bean so `@Transactional` is honored — self-invoking a `@Transactional` method on the worker itself would bypass Spring's proxy and run non-transactionally):

**File:** `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pdf/PdfRenderClaimService.java`

```java
package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

/** Atomically claims a batch of runnable jobs and marks them RENDERING with a lease. */
@Service
public class PdfRenderClaimService {

    @Autowired private PdfRenderJobRepository jobRepository;

    @Value("${app.pdf-render.max-concurrent:4}") private int maxConcurrent;
    @Value("${app.pdf-render.lease-seconds:180}") private int leaseSeconds;

    /** SKIP LOCKED claim + lease, all in one transaction so the row locks hold. */
    @Transactional
    public List<PdfRenderJob> claimBatch() {
        List<PdfRenderJob> jobs = jobRepository.claimRunnable(new Date(), maxConcurrent);
        Date lease = new Date(System.currentTimeMillis() + leaseSeconds * 1000L);
        for (PdfRenderJob j : jobs) {
            j.setStatus(PdfRenderJob.RENDERING);
            j.setLeaseUntil(lease);
        }
        jobRepository.saveAll(jobs);
        return jobs;
    }
}
```

- [ ] **Step 3b: Implement `PdfRenderWorker`**

```java
package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/** Drains the pdf_render_job queue, rendering each via Gotenberg → Spaces. */
@Component
public class PdfRenderWorker {

    private static final Logger log = LoggerFactory.getLogger(PdfRenderWorker.class);

    @Autowired private PdfRenderClaimService claimService;
    @Autowired private PdfRenderJobRepository jobRepository;
    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private GotenbergClient gotenberg;
    @Autowired private DigitalOceanSpacesService spaces;

    /** Claim a batch (transactional, SKIP LOCKED) and render each outside the claim txn. */
    @Scheduled(fixedDelayString = "${app.pdf-render.poll-ms:3000}")
    public void pollAndRender() {
        List<PdfRenderJob> batch = claimService.claimBatch();
        for (PdfRenderJob job : batch) {
            try {
                renderOne(job);
            } catch (Exception e) {
                log.error("Unexpected error rendering job {}", job.getPdfRenderJobId(), e);
            }
        }
    }

    /** Render a single claimed job. Visible for testing. */
    void renderOne(PdfRenderJob job) {
        try {
            byte[] pdf = gotenberg.renderUrl(job.getReportUrl());
            String folder = folderOf(job.getReportUrl());
            String fileName = pdfFileNameOf(job.getReportUrl());
            String pdfUrl = spaces.uploadBytes(pdf, "application/pdf", folder, fileName);

            generatedReportRepository.findById(job.getGeneratedReportId()).ifPresent(gr -> {
                gr.setPdfUrl(pdfUrl);
                gr.setPdfStatus("ready");
                generatedReportRepository.save(gr);
            });
            job.setStatus(PdfRenderJob.DONE);
            job.setLeaseUntil(null);
            jobRepository.save(job);
        } catch (Exception e) {
            job.setAttempts(job.getAttempts() + 1);
            job.setLastError(truncate(e.getMessage(), 1000));
            job.setLeaseUntil(null);
            if (job.getAttempts() >= job.getMaxAttempts()) {
                job.setStatus(PdfRenderJob.FAILED);
                generatedReportRepository.findById(job.getGeneratedReportId()).ifPresent(gr -> {
                    gr.setPdfStatus("failed");
                    generatedReportRepository.save(gr);
                });
            } else {
                job.setStatus(PdfRenderJob.PENDING); // retry next tick
            }
            jobRepository.save(job);
            log.warn("PDF render attempt {} failed for job {}: {}",
                    job.getAttempts(), job.getPdfRenderJobId(), e.getMessage());
        }
    }

    /** "https://cdn/a/b/student_3_x.html" → "a/b" (path between host and filename). */
    static String folderOf(String url) {
        String path = url.replaceFirst("^https?://[^/]+/", "");
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(0, slash) : "";
    }

    /** ".../student_3_x.html" → "student_3_x.pdf". */
    static String pdfFileNameOf(String url) {
        String path = url.substring(url.lastIndexOf('/') + 1);
        return path.replaceFirst("\\.html?($|\\?.*$)", "") + ".pdf";
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
```

- [ ] **Step 4: Run the tests — expect PASS.** `./mvnw -q -o test -Dtest=PdfRenderWorkerTest`.
  If the upload-args assertion fails, reconcile `folderOf`/`pdfFileNameOf` with the exact `reportUrl` shape produced by `ReportService` (folder = `<renderFolder>/assessment-<id>`, file = `student_<id>_<label>.html`).

- [ ] **Step 5: Add focused tests for the two helpers** (in the same test file):

```java
    @Test void folderOf_stripsHostAndFilename() {
        assertThat(PdfRenderWorker.folderOf(
            "https://storage-c9.sgp1.digitaloceanspaces.com/pager-reports/insight/assessment-9/student_3_pager-insight.html"))
            .isEqualTo("pager-reports/insight/assessment-9");
    }
    @Test void pdfFileNameOf_swapsExtension() {
        assertThat(PdfRenderWorker.pdfFileNameOf(".../student_3_pager-insight.html"))
            .isEqualTo("student_3_pager-insight.pdf");
    }
```

Run again → PASS.

- [ ] **✅ Checkpoint.**

---

### Task 9: Enable scheduling

**Files:**
- Modify: the `@SpringBootApplication` class (find with `grep -rl "@SpringBootApplication" spring-social/src/main/java`) **or** add a tiny `@Configuration @EnableScheduling` class.

- [ ] **Step 1: Check if scheduling is already on.** Run: `grep -rn "@EnableScheduling" spring-social/src/main/java`.
  - If present: nothing to do.
  - If absent: create `spring-social/src/main/java/com/kccitm/api/config/SchedulingConfig.java`:

```java
package com.kccitm.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class SchedulingConfig { }
```

- [ ] **Step 2: Compile.** `cd spring-social && ./mvnw -q -o compile` → BUILD SUCCESS.
- [ ] **✅ Checkpoint.**

---

## Phase 5 — API exposure

### Task 10: Surface `pdfUrl`/`pdfStatus` in responses

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportResponse.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportController.java`

- [ ] **Step 1: Read `UnifiedReportResponse.java`** and add two fields `pdfUrl`, `pdfStatus` with getters, and extend the `ok(...)` factory to accept them. Pattern (adapt to the file's actual style):

```java
    private String pdfUrl;
    private String pdfStatus;
    public String getPdfUrl() { return pdfUrl; }
    public String getPdfStatus() { return pdfStatus; }

    public static UnifiedReportResponse ok(String typeCode, String subtypeCode, String reportUrl,
                                           Date calculatedAt, Date renderedAt, boolean alreadyExisted,
                                           String pdfUrl, String pdfStatus) {
        UnifiedReportResponse r = ok(typeCode, subtypeCode, reportUrl, calculatedAt, renderedAt, alreadyExisted);
        r.pdfUrl = pdfUrl;
        r.pdfStatus = pdfStatus;
        return r;
    }
```

- [ ] **Step 2: Update the controller call** in `UnifiedReportController.generate` (line ~58):

```java
            return ResponseEntity.ok(UnifiedReportResponse.ok(
                    r.typeCode, r.subtypeCode, r.reportUrl,
                    r.calculatedAt, r.renderedAt, r.alreadyExisted,
                    r.pdfUrl, r.pdfStatus));
```

- [ ] **Step 3: Update the bulk row** (line ~111) to include PDF state:

```java
                row.put("status", "ok");
                row.put("reportUrl", r.reportUrl);
                row.put("pdfUrl", r.pdfUrl);
                row.put("pdfStatus", r.pdfStatus);
                row.put("code", r.subtypeCode);
                row.put("typeCode", r.typeCode);
```

- [ ] **Step 4: Compile.** `./mvnw -q -o compile` → BUILD SUCCESS.
- [ ] **Note:** the "generated reports for assessment" fetch returns the `GeneratedReport` entity directly, so `pdfUrl`/`pdfStatus` appear automatically (Task 2). No change needed there.
- [ ] **✅ Checkpoint.**

---

### Task 11: Retry endpoint for failed PDFs

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportController.java`

- [ ] **Step 1: Add an endpoint** that re-enqueues by `generatedReportId` (reusing `PdfRenderEnqueueService`):

```java
    @Autowired private com.kccitm.api.service.b2c.report.pdf.PdfRenderEnqueueService pdfRenderEnqueueService;
    @Autowired private com.kccitm.api.repository.Career9.GeneratedReportRepository generatedReportRepository;

    @PostMapping("/generate-report-unified/{generatedReportId}/retry-pdf")
    @PreAuthorize("@auth.allows('generated_report.create')")
    public ResponseEntity<Map<String, Object>> retryPdf(@PathVariable Long generatedReportId) {
        return generatedReportRepository.findById(generatedReportId).map(gr -> {
            if (gr.getReportUrl() == null) {
                return ResponseEntity.badRequest().body(Map.<String, Object>of(
                        "status", "error", "message", "Report has no HTML to render"));
            }
            gr.setPdfStatus("pending");
            generatedReportRepository.save(gr);
            pdfRenderEnqueueService.enqueue(gr.getGeneratedReportId(), gr.getReportUrl());
            return ResponseEntity.ok(Map.<String, Object>of("status", "ok", "pdfStatus", "pending"));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
```

(Add imports: `org.springframework.web.bind.annotation.PathVariable`.)

- [ ] **Step 2: Compile + run the existing backend tests.** `cd spring-social && ./mvnw -q -o test` → BUILD SUCCESS / green.
- [ ] **✅ Checkpoint.**

---

## Phase 6 — Infrastructure

### Task 12: Add Gotenberg to docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Read `docker-compose.yml`** to match its version/network conventions, then add:

```yaml
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    # Internal only — do NOT publish to the host in prod. Expose 3000 to the
    # backend over the compose network. (Map "3000:3000" locally only if you
    # want to curl it directly during dev.)
    expose:
      - "3000"
    command:
      - "gotenberg"
      - "--chromium-disable-javascript=false"   # reports draw charts client-side
      - "--api-timeout=120s"
```

- [ ] **Step 2: Point the backend at it.** Ensure the backend service in compose has `GOTENBERG_URL=http://gotenberg:3000` in its environment (matches `app.gotenberg.url` from Task 5). If the backend isn't in this compose file, set `GOTENBERG_URL` wherever its env is configured and document it.

- [ ] **Step 3: Smoke test (manual).**

```bash
docker compose up -d gotenberg
curl -s -o /tmp/out.pdf -F "url=https://example.com" \
  http://localhost:3000/forms/chromium/convert/url   # only if you temporarily published 3000
file /tmp/out.pdf   # → PDF document
```

Expected: a valid PDF (confirms the container renders). Tear down after.

- [ ] **✅ Checkpoint:** backend can reach Gotenberg over the compose network.

---

### Task 13: End-to-end backend smoke (manual, no new code)

- [ ] **Step 1:** With the dev DB + Gotenberg running, generate one report (call `POST /generate-report-unified` with a real `userStudentId`/`assessmentId`, or use the UI). Confirm the response has `"pdfStatus":"pending"`.
- [ ] **Step 2:** Watch the logs / poll `getGeneratedReportsByAssessment`. Within a few seconds the row's `pdfStatus` should become `ready` and `pdfUrl` populated.
- [ ] **Step 3:** Open the `pdfUrl` — confirm the PDF is vector/selectable text and the layout matches the HTML (flex/grid intact, charts drawn).
- [ ] **Step 4 (failure path):** Stop Gotenberg, regenerate, confirm the row goes `pending`→(after `max_attempts`)→`failed` with `last_error` set; restart Gotenberg and `POST .../retry-pdf` → back to `ready`.
- [ ] **✅ Checkpoint:** backend feature verified end-to-end.

---

## Phase 7 — Frontend

### Task 14: API types — carry `pdfUrl`/`pdfStatus` + retry call

**Files:**
- Modify: `react-social/src/app/pages/ReportTemplates/API/Report_Templates_APIs.ts`
- Modify: `react-social/src/app/pages/ReportGeneration/API/GeneratedReport_APIs.ts`

- [ ] **Step 1:** In `Report_Templates_APIs.ts`, find the response types/usages for `GenerateUnifiedReport` and `GenerateUnifiedReportsBulk`. Ensure the typed result includes `pdfUrl?: string | null` and `pdfStatus?: string` (single response object and each bulk `results[]` row). If responses are loosely typed (`any`/inline), add an interface:

```ts
export interface UnifiedReportResult {
  reportUrl?: string | null;
  pdfUrl?: string | null;
  pdfStatus?: string;        // notRequested | pending | rendering | ready | failed
  typeCode?: string;
  code?: string;             // subtype (bulk rows)
  status?: string;           // "ok" | "error" | "forbidden" (bulk rows)
  userStudentId?: number;    // bulk rows
}
```

and type the axios calls to return it (`AxiosResponse<UnifiedReportResult>` / `{ results: UnifiedReportResult[] }`).

- [ ] **Step 2:** In `GeneratedReport_APIs.ts`, add the retry call:

```ts
export const retryReportPdf = (generatedReportId: number) =>
  api.post(`/generate-report-unified/${generatedReportId}/retry-pdf`);
```

(Use the same axios instance/import the file already uses for `getGeneratedReportsByAssessment`.)

- [ ] **Step 3:** Type-check. Run: `cd react-social && npx tsc --noEmit` → no new errors.
- [ ] **✅ Checkpoint.**

---

### Task 15: Pure ZIP-of-stored-PDFs util (TDD)

**Files:**
- Create: `react-social/src/app/pages/ReportGeneration/utils/pdfZip.ts`
- Test: `react-social/src/app/pages/ReportGeneration/utils/pdfZip.test.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { zipStoredPdfs } from "./pdfZip";

describe("zipStoredPdfs", () => {
  it("fetches each pdfUrl and adds it to the zip under fileName.pdf", async () => {
    const fetched: string[] = [];
    const fakeFetch = async (url: string) => {
      fetched.push(url);
      return { ok: true, blob: async () => new Blob([url], { type: "application/pdf" }) } as any;
    };
    const items = [
      { fileName: "Asha_report", pdfUrl: "https://cdn/a.pdf" },
      { fileName: "Ravi_report", pdfUrl: "https://cdn/b.pdf" },
    ];
    const { blob, added, skipped } = await zipStoredPdfs(items, fakeFetch as any);
    expect(fetched).toEqual(["https://cdn/a.pdf", "https://cdn/b.pdf"]);
    expect(added).toBe(2);
    expect(skipped).toEqual([]);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("skips items without a pdfUrl or with a failed fetch", async () => {
    const fakeFetch = async () => ({ ok: false } as any);
    const items = [
      { fileName: "NoPdf", pdfUrl: null },
      { fileName: "Broken", pdfUrl: "https://cdn/x.pdf" },
    ];
    const { added, skipped } = await zipStoredPdfs(items, fakeFetch as any);
    expect(added).toBe(0);
    expect(skipped.sort()).toEqual(["Broken", "NoPdf"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `cd react-social && CI=true npx react-scripts test src/app/pages/ReportGeneration/utils/pdfZip.test.ts --watchAll=false`.

- [ ] **Step 3: Implement:**

```ts
import JSZip from "jszip";

export type ZipItem = { fileName: string; pdfUrl: string | null | undefined };

/**
 * Bundle already-rendered PDFs (stored on Spaces) into a ZIP. No html2canvas:
 * the PDFs already exist server-side, so this is just fetch + zip.
 * Returns the zip blob plus which items were added/skipped (no pdf / fetch failed).
 */
export async function zipStoredPdfs(
  items: ZipItem[],
  fetchFn: typeof fetch = fetch
): Promise<{ blob: Blob; added: number; skipped: string[] }> {
  const zip = new JSZip();
  const skipped: string[] = [];
  let added = 0;

  for (const it of items) {
    if (!it.pdfUrl) { skipped.push(it.fileName); continue; }
    try {
      const res = await fetchFn(it.pdfUrl);
      if (!res.ok) { skipped.push(it.fileName); continue; }
      const blob = await res.blob();
      zip.file(`${it.fileName}.pdf`, blob);
      added++;
    } catch {
      skipped.push(it.fileName);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, added, skipped };
}
```

- [ ] **Step 4: Run — expect PASS.** Same command as Step 2.
- [ ] **✅ Checkpoint.**

---

### Task 16: GenerateReportsModal — download stored PDF/HTML, drop html2canvas

**Files:**
- Modify: `react-social/src/app/pages/ReportsHub/components/GenerateReportsModal.tsx`

- [ ] **Step 1: Extend the `Entry` type** (line 32) and how it's populated (lines 60, 88, 111):

```ts
type Entry = { reportUrl: string | null; status: string; pdfUrl: string | null; pdfStatus: string };
```

In `loadEntries` (line ~60):
```ts
        if (id) map.set(id, {
          reportUrl: gr.reportUrl, status: gr.reportStatus,
          pdfUrl: gr.pdfUrl ?? null, pdfStatus: gr.pdfStatus ?? "notRequested",
        });
```
In `generateOne` (line ~88):
```ts
      setEntry(sid, { reportUrl: res.data.reportUrl ?? null, status: "generated",
        pdfUrl: res.data.pdfUrl ?? null, pdfStatus: res.data.pdfStatus ?? "pending" });
```
In `generateAll` (line ~111):
```ts
          if (r.status === "ok") { ok++; setEntry(r.userStudentId, {
            reportUrl: r.reportUrl ?? null, status: "generated",
            pdfUrl: r.pdfUrl ?? null, pdfStatus: r.pdfStatus ?? "pending" }); }
```

- [ ] **Step 2: Replace the download handlers** (lines 127-166). Remove `downloadOne`'s html2canvas path; download the stored PDF directly. Replace `downloadAllZip` with the stored-PDF bundler:

```ts
  const triggerDownload = (urlOrBlob: string | Blob, fileName: string) => {
    const url = typeof urlOrBlob === "string" ? urlOrBlob : URL.createObjectURL(urlOrBlob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof urlOrBlob !== "string") URL.revokeObjectURL(url);
  };

  const safe = (s: string) => (s || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

  // Download the pre-rendered PDF straight from Spaces (no client conversion).
  const downloadOnePdf = (s: ModalStudent) => {
    const e = entries.get(s.userStudentId);
    if (!e?.pdfUrl) { showErrorToast("PDF not ready yet"); return; }
    triggerDownload(e.pdfUrl, `${safe(s.name)}_report.pdf`);
  };

  const downloadOneHtml = (s: ModalStudent) => {
    const e = entries.get(s.userStudentId);
    if (!e?.reportUrl) return;
    triggerDownload(e.reportUrl, `${safe(s.name)}_report.html`);
  };

  const downloadAllZip = async () => {
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
```

- [ ] **Step 3: Update imports** (lines 2-4): remove the `htmlToPdfBlob` import; remove the direct `JSZip` import (now inside `pdfZip.ts`); add the util:

```ts
import { zipStoredPdfs } from "../../ReportGeneration/utils/pdfZip";
```

- [ ] **Step 4: Update the row actions + footer** (lines 244-280). The "Download" button now downloads the stored PDF and is gated on `pdfStatus`; add a "HTML" button; `generatedCount` (line 72) should count rows with a ready PDF for the ZIP button. Replace the actions cell for a generated row:

```tsx
                        <span style={{ display: "inline-flex", gap: 4 }}>
                          <a className="btn btn-sm btn-light-primary py-1" href={e!.reportUrl!} target="_blank" rel="noreferrer">Preview</a>
                          <button className="btn btn-sm btn-light-success py-1"
                            disabled={e!.pdfStatus !== "ready" || !e!.pdfUrl}
                            title={e!.pdfStatus !== "ready" ? `PDF ${e!.pdfStatus}` : "Download PDF"}
                            onClick={() => downloadOnePdf(s)}>
                            {e!.pdfStatus === "ready" ? "PDF"
                              : e!.pdfStatus === "failed" ? "PDF ✗" : "PDF…"}
                          </button>
                          <button className="btn btn-sm btn-light py-1" onClick={() => downloadOneHtml(s)}>HTML</button>
                          <button className="btn btn-sm btn-light py-1" disabled={busy || generating}
                            onClick={() => generateOne(s.userStudentId, true)}>
                            {busy ? "…" : "Regenerate"}
                          </button>
                        </span>
```

And change `generatedCount` (line 72-75) to count ready PDFs:
```ts
  const generatedCount = useMemo(
    () => students.filter((s) => entries.get(s.userStudentId)?.pdfStatus === "ready"
                                 && entries.get(s.userStudentId)?.pdfUrl).length,
    [students, entries]
  );
```

- [ ] **Step 5: Poll while any PDF is pending.** Add an effect so badges flip to ready live:

```ts
  useEffect(() => {
    if (!open) return;
    const anyPending = Array.from(entries.values())
      .some((e) => e.pdfStatus === "pending" || e.pdfStatus === "rendering");
    if (!anyPending) return;
    const t = setInterval(() => { loadEntries(); }, 4000);
    return () => clearInterval(t);
  }, [open, entries, loadEntries]);
```

- [ ] **Step 6: Type-check + run frontend tests.** `cd react-social && npx tsc --noEmit && CI=true npx react-scripts test --watchAll=false` → green.
- [ ] **✅ Checkpoint.**

---

### Task 17: ReportsHubPage — rows + ZIP use stored PDFs

**Files:**
- Modify: `react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx`

- [ ] **Step 1: Extend `ReportData`** (the type around line 74 with `reportUrl?`). Add:
```ts
  pdfUrl?: string | null;
  pdfStatus?: string;
```
And where it's built from `gr` (around line 313):
```ts
            reportUrl: gr.reportUrl,
            pdfUrl: gr.pdfUrl ?? null,
            pdfStatus: gr.pdfStatus ?? "notRequested",
```

- [ ] **Step 2: Rework the ZIP job pipeline** (`startZipJob`, lines ~585-690). Replace the per-student "fetch HTML → htmlToPdfBlob" steps (lines ~632-676) with "use the stored `pdfUrl`". The job's fetch+convert phases collapse into a single fetch-the-PDF phase. Build the item list from `pdfUrl`:

```ts
        const items = ids
          .map((id) => {
            const rd = reportDataMap.get(id);
            const s = /* existing student lookup */ studentById.get(id);
            const safe = (s?.name || `student_${id}`).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
            return { userStudentId: id, fileName: `${safe}_report`, pdfUrl: rd?.pdfUrl ?? null };
          })
          .filter((x) => !!x.pdfUrl);
```

Then use `zipStoredPdfs(items)` (import it) to produce the blob, keeping the existing upload-to-Spaces step (`uploadReportZip`) and the `ZipJob` progress/phase bookkeeping. Update the phase labels from "Fetching/Converting" to a single "Bundling N PDFs".

- [ ] **Step 3: Remove the `htmlToPdfBlob` import and the FourPager `buildFourPagerHtml`→PDF branch** if it existed only to feed client conversion; the ZIP now always uses stored `pdfUrl`. Add `import { zipStoredPdfs } from "../ReportGeneration/utils/pdfZip";`.

- [ ] **Step 4: Per-row Download in the table** (lines ~1231-1293). Where the row renders the `reportUrl` "Preview"/download, add a PDF download gated on `rd.pdfStatus === "ready"` and keep an HTML link:

```tsx
                      {reportUrl ? (
                        <>
                          <a href={reportUrl} target="_blank" rel="noopener noreferrer" /* existing Preview/HTML link */>…</a>
                          {rd?.pdfStatus === "ready" && rd?.pdfUrl && (
                            <a href={rd.pdfUrl} download className="btn btn-sm btn-light-success py-1">PDF</a>
                          )}
                          {rd?.pdfStatus && rd.pdfStatus !== "ready" && rd.pdfStatus !== "notRequested" && (
                            <span className="badge badge-light-warning">PDF {rd.pdfStatus}</span>
                          )}
                        </>
                      ) : ( /* existing not-generated branch */ )}
```

- [ ] **Step 5: Type-check + tests.** `cd react-social && npx tsc --noEmit && CI=true npx react-scripts test --watchAll=false` → green.
- [ ] **✅ Checkpoint.**

---

### Task 18: Remove the client-side rasterizer

**Files:**
- Modify: `react-social/src/app/pages/ReportGeneration/utils/htmlToPdf.ts`

- [ ] **Step 1: Confirm no remaining importers of `htmlToPdfBlob`/`downloadReportsAsZip`/`downloadReportAsPdf`.** Run:
```bash
cd react-social && grep -rn "htmlToPdfBlob\|downloadReportsAsZip\|downloadReportAsPdf\|from .*ReportGeneration/utils/htmlToPdf" src | grep -v "utils/htmlToPdf.ts"
```
Expected: no results (Tasks 16-17 removed them). If any remain, migrate them to stored-PDF download / `zipStoredPdfs` first.

- [ ] **Step 2: Delete the rasterization code.** Remove `htmlToPdfBlob`, `downscaleCanvas`, `downloadReportAsPdf`, and `downloadReportsAsZip` (the html2canvas/jsPDF paths). If the file becomes empty, delete it; otherwise leave only still-used exports. Remove now-unused deps usage (`html2canvas`, `jspdf`) — and from `package.json` if nothing else imports them (`grep -rn "html2canvas\|jspdf" src`).

- [ ] **Step 3: Type-check + full frontend test run + build.**
```bash
cd react-social && npx tsc --noEmit && CI=true npx react-scripts test --watchAll=false && CI=true npm run build
```
Expected: all green, production build succeeds.

- [ ] **✅ Checkpoint:** the client no longer rasterizes; all PDFs come from Spaces.

---

## Phase 8 — Final verification

### Task 19: Full-flow acceptance

- [ ] **Step 1:** `docker compose up -d gotenberg` + backend on dev DB + `cd react-social && npm start`.
- [ ] **Step 2:** In the Reports Hub, generate reports for a small cohort. Confirm rows show "PDF…" then flip to "PDF" (ready) within seconds (poller working).
- [ ] **Step 3:** Click **PDF** on a row → downloads a vector PDF from the CDN; **HTML** → downloads the HTML; **Preview** → opens HTML in a tab.
- [ ] **Step 4:** Bulk-select → **Download ZIP** → a ZIP of the stored PDFs; verify a not-yet-ready member is reported as skipped, not silently dropped.
- [ ] **Step 5:** Compare a generated PDF to the browser view — flex/grid layout and charts intact, text selectable, identical regardless of which browser drove the UI.
- [ ] **Step 6:** Regenerate one report → its `pdfStatus` returns to pending then ready with a fresh PDF (old PDF overwritten).
- [ ] **✅ Checkpoint:** feature complete and verified end-to-end.

---

## Self-Review notes (coverage against the spec)

- **D1/D2 server-side Chromium via Gotenberg:** Tasks 5, 6, 12.
- **D3 eager-but-async at generation:** Task 7 (enqueue in `generate`), Tasks 8-9 (poller renders).
- **D4 DB-backed queue + tracking + retries + stale recovery:** Tasks 1, 3, 8, 11.
- **D5 download PDF + HTML from Spaces:** Tasks 14, 16, 17.
- **D6 client-side ZIP of stored PDFs + remove html2canvas:** Tasks 15, 16, 17, 18.
- **Schema (`pdf_url`/`pdf_status`, `notRequested` backfill, `pdf_render_job`):** Tasks 1, 2.
- **Resilience (PDF failure never fails generation; charts wait):** Task 7 (generation only enqueues), Task 8 (retry/fail isolation), Task 6 (`waitDelay`), Task 12 (`--chromium-disable-javascript=false`).
- **Status default for historical rows:** Task 1 (`DEFAULT 'notRequested'`), surfaced in Tasks 16/17 (treated as "no PDF yet").
