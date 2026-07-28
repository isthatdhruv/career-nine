# School Admin Cohort Insights Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a school-admin "cohort insights" page (a cohort version of Navigator 360) that serves pre-generated, per-(institute × assessment) insight payloads, generated on demand by a superadmin, with zero recomputation on read.

**Architecture:** Extend the existing `SchoolReport` storage + endpoints rather than create a new table. A superadmin click enqueues an async generation job that aggregates already-precomputed per-student `Navigator360Result` JSONs (from `generated_report.navigator_dashboard_json`) into one stored payload. School admins read the stored payload only, scoped to their institute via the existing ABAC `@auth` mechanism. The cohort aggregation math is a **pluggable component** with a labeled placeholder implementation; real formulas drop in later behind the same interface.

**Tech Stack:** Java 11, Spring Boot 2.5.5, Maven, Flyway, JPA/Hibernate (MySQL), JUnit 5 + Mockito, Jackson; React + TypeScript (CRA), Axios.

## Global Constraints

- **NO git operations (standing user instruction):** do NOT commit, stage (`git add`), branch, switch branches, or open worktrees. Each task's final step is a **Verify & leave unstaged** checkpoint — run the build/tests, confirm green, then stop. Ignore any "Commit" convention from the execution sub-skill.
- **Java version:** 11. **Spring Boot:** 2.5.5. Do not introduce dependencies not already in `spring-social/pom.xml`.
- **Migrations are forward-only.** Never edit an applied migration. Naming: `V<YYYYMMDDNNN>__<snake_case>.sql` in `spring-social/src/main/resources/db/migration/`. Use `V20260624001`, `V20260624002`, … for files created today (2026-06-24); bump the 3-digit sequence if those names already exist.
- **Backend single-test command:** `mvn -f spring-social/pom.xml test -Dtest=ClassName`
- **Backend compile command:** `mvn -f spring-social/pom.xml clean compile`
- **Frontend type-check command:** `cd react-social && npx tsc --noEmit` (if the project defines a `typecheck`/`build` npm script, that is equally acceptable).
- **Auth note:** `auth.enforce-mode` is `log-only` in all profiles — `@PreAuthorize("@auth.allows(...)")` will NOT block requests yet (it audits denials). Wire permissions correctly regardless; enforcement is flipped on operationally later. Superadmins always pass (`principal.isSuperAdmin()` short-circuits to `true`).
- **Testing reality:** this codebase's tests are pure JUnit 5 + Mockito unit tests (no `@SpringBootTest`/`@DataJpaTest`/`@WebMvcTest` harness). TDD applies to unit-testable logic (the aggregator, the generation-service orchestration, the controller methods with a mocked service). For migrations, entity field additions, JPQL repository methods, and frontend wiring, the verification step is **compile/type-check + a described manual check**, not a fabricated test.
- **`instituteCode` type mismatch (real, handle explicitly):** `SchoolReport.instituteCode` and `UserStudent.institute.instituteCode` are `Long`; `@auth.allows(perm, Integer)` takes `Integer`. In controllers, accept the path variable as `Integer` for the `@auth` scope binding and convert to `Long` (`instituteCode.longValue()`) before calling repositories/services.

---

## File Structure

**Backend (`spring-social/src/main/...`):**
- `resources/db/migration/V20260624001__extend_school_report_for_cohort_insights.sql` — new columns (create)
- `resources/db/migration/V20260624002__seed_cohort_insights_permissions.sql` — permission seed (create)
- `java/com/kccitm/api/security/PermissionCode.java` — add 2 enum constants (modify)
- `java/com/kccitm/api/model/career9/SchoolReport.java` — add 4 fields + accessors (modify)
- `java/com/kccitm/api/service/dashboard/cohort/CohortInsightPayload.java` — payload DTO (create)
- `java/com/kccitm/api/service/dashboard/cohort/CohortInsightAggregator.java` — interface (create)
- `java/com/kccitm/api/service/dashboard/cohort/PlaceholderCohortInsightAggregator.java` — v0 impl (create)
- `java/com/kccitm/api/repository/Career9/GeneratedReportRepository.java` — add 1 query (modify)
- `java/com/kccitm/api/repository/Career9/StudentAssessmentMappingRepository.java` — add 1 count query (modify)
- `java/com/kccitm/api/service/dashboard/cohort/CohortInsightGenerationService.java` — orchestration + async (create)
- `java/com/kccitm/api/service/dashboard/cohort/CohortInsightView.java` — read DTO (create)
- `java/com/kccitm/api/controller/dashboard/CohortInsightController.java` — endpoints (create)

**Backend tests (`spring-social/src/test/...`):**
- `java/com/kccitm/api/service/dashboard/cohort/PlaceholderCohortInsightAggregatorTest.java` (create)
- `java/com/kccitm/api/service/dashboard/cohort/CohortInsightGenerationServiceTest.java` (create)
- `java/com/kccitm/api/controller/dashboard/CohortInsightControllerTest.java` (create)

**Frontend (`react-social/src/app/...`):**
- `pages/SchoolAdmin/CohortInsights_APIs.ts` — API client (create)
- `pages/SchoolAdmin/CohortInsightsPage.tsx` — page (create)
- `routing/PrivateRoutes.tsx` — add route (modify)
- sidebar/menu file (modify — locate at execution time; see Task 8)

The new package path `service/dashboard/cohort/` keeps the cohort code in one focused, self-contained unit separate from the per-student `service/dashboard/insight/` code.

---

## Task 1: Extend `school_report` storage + permission catalog

**Files:**
- Create: `spring-social/src/main/resources/db/migration/V20260624001__extend_school_report_for_cohort_insights.sql`
- Create: `spring-social/src/main/resources/db/migration/V20260624002__seed_cohort_insights_permissions.sql`
- Modify: `spring-social/src/main/java/com/kccitm/api/security/PermissionCode.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/model/career9/SchoolReport.java`

**Interfaces:**
- Produces (consumed by Tasks 4, 5): `SchoolReport.getGenerationStatus()/setGenerationStatus(String)`, `getLogicVersion()/setLogicVersion(String)`, `getGeneratedBy()/setGeneratedBy(Long)`, `getCompletedCount()/setCompletedCount(Integer)`.
- Produces: permission codes `"dashboard.school.insights.generate"`, `"dashboard.school.insights.read"`.

This is a wiring/schema task — verification is compile + Flyway-applies-on-boot, not a unit test (per Global Constraints).

- [ ] **Step 1: Write the column migration**

Create `V20260624001__extend_school_report_for_cohort_insights.sql`:

```sql
-- Cohort-insights generation lifecycle fields layered onto the existing school_report table.
-- generation_status is SEPARATE from the existing `status` column ("generated"/"stale") so the
-- BET school-report flow that writes `status` is left untouched.
ALTER TABLE school_report
  ADD COLUMN generation_status VARCHAR(20)  NULL,
  ADD COLUMN logic_version     VARCHAR(64)  NULL,
  ADD COLUMN generated_by      BIGINT       NULL,
  ADD COLUMN completed_count   INT          NULL;
```

- [ ] **Step 2: Write the permission seed migration**

Create `V20260624002__seed_cohort_insights_permissions.sql`:

```sql
INSERT INTO permission (code, description) VALUES
  ('dashboard.school.insights.generate', 'Generate/refresh school cohort insight payloads (superadmin)'),
  ('dashboard.school.insights.read',     'View the school cohort insights dashboard')
ON DUPLICATE KEY UPDATE description = VALUES(description);
```

- [ ] **Step 3: Add the enum constants**

In `PermissionCode.java`, add two constants alongside the existing ones (match the existing `NAME("code", "description")` style; place them near other `dashboard.*`/institute codes):

```java
DASHBOARD_SCHOOL_INSIGHTS_GENERATE("dashboard.school.insights.generate", "Generate/refresh school cohort insight payloads (superadmin)"),
DASHBOARD_SCHOOL_INSIGHTS_READ("dashboard.school.insights.read", "View the school cohort insights dashboard"),
```

(Keep the enum's existing terminating semicolon after the final constant.)

- [ ] **Step 4: Add entity fields + accessors to `SchoolReport.java`**

Add these fields (near the existing `status` field) and their getters/setters:

```java
// --- Cohort-insights generation lifecycle (V20260624001) ---
@Column(name = "generation_status", length = 20)
private String generationStatus;   // "PENDING" | "GENERATING" | "GENERATED" | "FAILED"

@Column(name = "logic_version", length = 64)
private String logicVersion;       // aggregator logic version stamped at generation

@Column(name = "generated_by")
private Long generatedBy;          // superadmin user id who triggered generation

@Column(name = "completed_count")
private Integer completedCount;    // students who had COMPLETED the assessment at generation time
```

```java
public String getGenerationStatus() { return generationStatus; }
public void setGenerationStatus(String generationStatus) { this.generationStatus = generationStatus; }

public String getLogicVersion() { return logicVersion; }
public void setLogicVersion(String logicVersion) { this.logicVersion = logicVersion; }

public Long getGeneratedBy() { return generatedBy; }
public void setGeneratedBy(Long generatedBy) { this.generatedBy = generatedBy; }

public Integer getCompletedCount() { return completedCount; }
public void setCompletedCount(Integer completedCount) { this.completedCount = completedCount; }
```

- [ ] **Step 5: Verify & leave unstaged**

Run: `mvn -f spring-social/pom.xml clean compile`
Expected: `BUILD SUCCESS`.
Manual check: confirm the two migration files exist with today's date prefix and the entity compiles with the new accessors. Do NOT commit/stage.

---

## Task 2: Pluggable cohort aggregator (interface + placeholder impl)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/dashboard/cohort/CohortInsightPayload.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/dashboard/cohort/CohortInsightAggregator.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/dashboard/cohort/PlaceholderCohortInsightAggregator.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/dashboard/cohort/PlaceholderCohortInsightAggregatorTest.java`

**Interfaces:**
- Consumes: `com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result` and its nested `ScoredDimension` (public fields `name`, `normPct`).
- Produces (consumed by Tasks 4, 5): `CohortInsightAggregator.aggregate(Long instituteCode, Long assessmentId, List<Navigator360Result> perStudent) -> CohortInsightPayload`; `CohortInsightAggregator.logicVersion() -> String`; `CohortInsightPayload` with public fields `studentCount` (int), `riasecAverage` (List<CohortDimension>), `logicVersion` (String), `note` (String); nested `CohortInsightPayload.CohortDimension` with public fields `name` (String), `avgNormPct` (double).

- [ ] **Step 1: Write the failing test**

Create `PlaceholderCohortInsightAggregatorTest.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;

class PlaceholderCohortInsightAggregatorTest {

    private Navigator360Result studentWithRiasec(double realisticPct, double investigativePct) {
        Navigator360Result r = new Navigator360Result();
        ScoredDimension realistic = new ScoredDimension();
        realistic.name = "Realistic";
        realistic.normPct = realisticPct;
        ScoredDimension investigative = new ScoredDimension();
        investigative.name = "Investigative";
        investigative.normPct = investigativePct;
        r.riasec = new ArrayList<>(Arrays.asList(realistic, investigative));
        return r;
    }

    @Test
    void aggregatesStudentCountAndAveragesRiasecByDimensionName() {
        PlaceholderCohortInsightAggregator agg = new PlaceholderCohortInsightAggregator();
        List<Navigator360Result> students = Arrays.asList(
                studentWithRiasec(40.0, 60.0),
                studentWithRiasec(60.0, 80.0));

        CohortInsightPayload payload = agg.aggregate(1L, 5L, students);

        assertThat(payload.studentCount).isEqualTo(2);
        assertThat(payload.logicVersion).isEqualTo(agg.logicVersion());
        assertThat(payload.riasecAverage)
                .extracting(d -> d.name)
                .containsExactlyInAnyOrder("Realistic", "Investigative");
        CohortInsightPayload.CohortDimension realistic = payload.riasecAverage.stream()
                .filter(d -> d.name.equals("Realistic")).findFirst().orElseThrow(AssertionError::new);
        assertThat(realistic.avgNormPct).isEqualTo(50.0); // (40 + 60) / 2
    }

    @Test
    void emptyCohortProducesZeroCountAndEmptyAverages() {
        PlaceholderCohortInsightAggregator agg = new PlaceholderCohortInsightAggregator();
        CohortInsightPayload payload = agg.aggregate(1L, 5L, new ArrayList<>());
        assertThat(payload.studentCount).isEqualTo(0);
        assertThat(payload.riasecAverage).isEmpty();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -f spring-social/pom.xml test -Dtest=PlaceholderCohortInsightAggregatorTest`
Expected: FAIL — compilation error (`CohortInsightPayload`, `CohortInsightAggregator`, `PlaceholderCohortInsightAggregator` do not exist).

- [ ] **Step 3: Write the payload DTO**

Create `CohortInsightPayload.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import java.util.ArrayList;
import java.util.List;

/**
 * Cohort-level insight payload stored as JSON in school_report.report_data.
 * PLACEHOLDER SHAPE: the real Navigator-360-style cohort schema replaces this
 * behind the same {@link CohortInsightAggregator} interface (bump logicVersion).
 */
public class CohortInsightPayload {

    public int studentCount;
    public List<CohortDimension> riasecAverage = new ArrayList<>();
    public String logicVersion;
    public String note;

    public static class CohortDimension {
        public String name;
        public double avgNormPct;

        public CohortDimension() {}

        public CohortDimension(String name, double avgNormPct) {
            this.name = name;
            this.avgNormPct = avgNormPct;
        }
    }
}
```

- [ ] **Step 4: Write the interface**

Create `CohortInsightAggregator.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import java.util.List;

import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;

/**
 * Pluggable cohort aggregation. Operates over already-precomputed per-student
 * Navigator360Result objects for one (institute, assessment) and emits one payload.
 * The real cohort formulas implement this interface later; until then a placeholder
 * implementation stands in. Implementations MUST be deterministic for a given input.
 */
public interface CohortInsightAggregator {

    CohortInsightPayload aggregate(Long instituteCode, Long assessmentId, List<Navigator360Result> perStudent);

    /** Stamped onto every generation so stale-logic payloads are detectable. */
    String logicVersion();
}
```

- [ ] **Step 5: Write the placeholder implementation**

Create `PlaceholderCohortInsightAggregator.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;

/**
 * PLACEHOLDER v0 aggregator. Produces a minimal but real payload (student count +
 * per-dimension average RIASEC normPct) purely to prove the end-to-end pipeline.
 * Replace with the real Navigator-360-style cohort logic later (new @Component with
 * @Primary, or swap this class) and bump LOGIC_VERSION.
 */
@Component
public class PlaceholderCohortInsightAggregator implements CohortInsightAggregator {

    public static final String LOGIC_VERSION = "placeholder-v0";

    @Override
    public String logicVersion() {
        return LOGIC_VERSION;
    }

    @Override
    public CohortInsightPayload aggregate(Long instituteCode, Long assessmentId, List<Navigator360Result> perStudent) {
        CohortInsightPayload payload = new CohortInsightPayload();
        payload.logicVersion = LOGIC_VERSION;
        payload.studentCount = perStudent == null ? 0 : perStudent.size();
        payload.note = "Placeholder cohort aggregation. Real cohort formulas not yet implemented.";

        if (perStudent == null || perStudent.isEmpty()) {
            return payload;
        }

        // Average normPct per RIASEC dimension name across all students who have that dimension.
        Map<String, double[]> sums = new LinkedHashMap<>(); // name -> [sum, count]
        for (Navigator360Result r : perStudent) {
            if (r == null || r.riasec == null) {
                continue;
            }
            for (ScoredDimension d : r.riasec) {
                if (d == null || d.name == null) {
                    continue;
                }
                double[] acc = sums.computeIfAbsent(d.name, k -> new double[2]);
                acc[0] += d.normPct;
                acc[1] += 1;
            }
        }

        List<CohortInsightPayload.CohortDimension> avgs = new ArrayList<>();
        for (Map.Entry<String, double[]> e : sums.entrySet()) {
            double count = e.getValue()[1];
            double avg = count == 0 ? 0.0 : e.getValue()[0] / count;
            avgs.add(new CohortInsightPayload.CohortDimension(e.getKey(), avg));
        }
        payload.riasecAverage = avgs;
        return payload;
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `mvn -f spring-social/pom.xml test -Dtest=PlaceholderCohortInsightAggregatorTest`
Expected: PASS (both tests).

- [ ] **Step 7: Verify & leave unstaged** — confirm green; do NOT commit/stage.

---

## Task 3: Repository queries for cohort source data

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/repository/Career9/GeneratedReportRepository.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/repository/Career9/StudentAssessmentMappingRepository.java`

**Interfaces:**
- Produces (consumed by Task 4):
  - `GeneratedReportRepository.findPagerReportsByInstituteAndAssessment(Long instituteCode, Long assessmentId) -> List<GeneratedReport>` — pager reports with non-null navigator JSON for an institute+assessment.
  - `StudentAssessmentMappingRepository.countCompletedByInstituteAndAssessment(Long instituteCode, Long assessmentId) -> long`.

JPQL is validated by Hibernate at application startup; the codebase has no `@DataJpaTest` harness, so verification here is compile-only. The behavior is exercised through Task 4's service test (with the repo mocked) and at runtime.

- [ ] **Step 1: Add the GeneratedReport query**

In `GeneratedReportRepository.java`, add the import and method:

```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

```java
@Query("SELECT gr FROM GeneratedReport gr "
     + "WHERE gr.assessmentId = :assessmentId "
     + "AND gr.typeOfReport = 'pager' "
     + "AND gr.navigatorDashboardJson IS NOT NULL "
     + "AND gr.userStudent.institute.instituteCode = :instituteCode")
List<GeneratedReport> findPagerReportsByInstituteAndAssessment(
        @Param("instituteCode") Long instituteCode,
        @Param("assessmentId") Long assessmentId);
```

(`java.util.List` is already imported in this repository per its existing methods.)

- [ ] **Step 2: Add the completed-count query**

In `StudentAssessmentMappingRepository.java`, add imports (if absent) and method:

```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

```java
@Query("SELECT COUNT(m) FROM StudentAssessmentMapping m "
     + "WHERE m.assessmentId = :assessmentId "
     + "AND m.status = 'completed' "
     + "AND m.userStudent.institute.instituteCode = :instituteCode")
long countCompletedByInstituteAndAssessment(
        @Param("instituteCode") Long instituteCode,
        @Param("assessmentId") Long assessmentId);
```

- [ ] **Step 3: Verify & leave unstaged**

Run: `mvn -f spring-social/pom.xml clean compile`
Expected: `BUILD SUCCESS`. Do NOT commit/stage.

---

## Task 4: Cohort generation service (orchestration + async + status)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/dashboard/cohort/CohortInsightView.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/dashboard/cohort/CohortInsightGenerationService.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/dashboard/cohort/CohortInsightGenerationServiceTest.java`

**Interfaces:**
- Consumes: `SchoolReportRepository.findByInstituteCodeAndAssessmentId(Long, Long)`, `GeneratedReportRepository.findPagerReportsByInstituteAndAssessment(Long, Long)` (Task 3), `StudentAssessmentMappingRepository.countCompletedByInstituteAndAssessment(Long, Long)` (Task 3), `CohortInsightAggregator` (Task 2), `SchoolReport` accessors (Task 1), `ObjectMapper`.
- Produces (consumed by Task 5):
  - `markPending(Long instituteCode, Long assessmentId, Long generatedBy) -> boolean` (true if newly enqueued; false if a run is already PENDING/GENERATING).
  - `runGenerationAsync(Long instituteCode, Long assessmentId) -> void` (`@Async`).
  - `generateInternal(Long instituteCode, Long assessmentId) -> void` (synchronous core; unit-tested).
  - `getView(Long instituteCode, Long assessmentId) -> CohortInsightView`.
  - `CohortInsightView` public fields: `instituteCode` (Long), `assessmentId` (Long), `status` (String), `logicVersion` (String), `includedCount` (Integer), `completedCount` (Integer), `newSinceGeneration` (int), `computedAt` (Date), `payload` (CohortInsightPayload, null unless GENERATED), `currentLogicVersion` (String), `logicStale` (boolean).
  - Status string constants: `STATUS_PENDING="PENDING"`, `STATUS_GENERATING="GENERATING"`, `STATUS_GENERATED="GENERATED"`, `STATUS_FAILED="FAILED"`.

- [ ] **Step 1: Write the read DTO**

Create `CohortInsightView.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import java.util.Date;

/** What the read endpoint returns for one (institute, assessment) card/detail. */
public class CohortInsightView {
    public Long instituteCode;
    public Long assessmentId;
    public String status;             // null = NOT_GENERATED; else PENDING/GENERATING/GENERATED/FAILED
    public String logicVersion;       // version stamped on the stored payload
    public String currentLogicVersion;// current aggregator version (for stale comparison)
    public boolean logicStale;        // stored logicVersion != current aggregator version
    public Integer includedCount;     // students folded into the stored generation
    public Integer completedCount;    // completed-count at generation time
    public int newSinceGeneration;    // current completed-count - includedCount (>=0)
    public Date computedAt;           // school_report.updatedAt
    public CohortInsightPayload payload; // non-null only when GENERATED
}
```

- [ ] **Step 2: Write the failing test**

Create `CohortInsightGenerationServiceTest.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.SchoolReport;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.SchoolReportRepository;
import com.kccitm.api.repository.Career9.StudentAssessmentMappingRepository;

class CohortInsightGenerationServiceTest {

    private SchoolReportRepository schoolReportRepository;
    private GeneratedReportRepository generatedReportRepository;
    private StudentAssessmentMappingRepository mappingRepository;
    private CohortInsightGenerationService service;

    @BeforeEach
    void setUp() {
        schoolReportRepository = mock(SchoolReportRepository.class);
        generatedReportRepository = mock(GeneratedReportRepository.class);
        mappingRepository = mock(StudentAssessmentMappingRepository.class);
        service = new CohortInsightGenerationService(
                schoolReportRepository,
                generatedReportRepository,
                mappingRepository,
                new PlaceholderCohortInsightAggregator(),
                new ObjectMapper());
    }

    private GeneratedReport reportWithRiasec(double realisticPct) {
        GeneratedReport gr = new GeneratedReport();
        gr.setNavigatorDashboardJson(
                "{\"riasec\":[{\"name\":\"Realistic\",\"normPct\":" + realisticPct + "}]}");
        return gr;
    }

    @Test
    void generateInternalWritesPayloadCoverageAndGeneratedStatus() throws Exception {
        SchoolReport existing = new SchoolReport();
        existing.setInstituteCode(1L);
        existing.setAssessmentId(5L);
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(existing));
        when(generatedReportRepository.findPagerReportsByInstituteAndAssessment(1L, 5L))
                .thenReturn(Arrays.asList(reportWithRiasec(40.0), reportWithRiasec(60.0)));
        when(mappingRepository.countCompletedByInstituteAndAssessment(1L, 5L)).thenReturn(3L);
        when(schoolReportRepository.save(any(SchoolReport.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.generateInternal(1L, 5L);

        ArgumentCaptor<SchoolReport> captor = ArgumentCaptor.forClass(SchoolReport.class);
        // last save is the GENERATED write
        org.mockito.Mockito.verify(schoolReportRepository, org.mockito.Mockito.atLeastOnce())
                .save(captor.capture());
        SchoolReport saved = captor.getValue();
        assertThat(saved.getGenerationStatus()).isEqualTo(CohortInsightGenerationService.STATUS_GENERATED);
        assertThat(saved.getCompletedCount()).isEqualTo(3);
        assertThat(saved.getStudentsWithScores()).isEqualTo(2);
        assertThat(saved.getLogicVersion()).isEqualTo(PlaceholderCohortInsightAggregator.LOGIC_VERSION);

        CohortInsightPayload payload = new ObjectMapper()
                .readValue(saved.getReportData(), CohortInsightPayload.class);
        assertThat(payload.studentCount).isEqualTo(2);
    }

    @Test
    void generateInternalSetsFailedStatusWhenSourceLoadThrows() {
        SchoolReport existing = new SchoolReport();
        existing.setInstituteCode(1L);
        existing.setAssessmentId(5L);
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(existing));
        when(generatedReportRepository.findPagerReportsByInstituteAndAssessment(1L, 5L))
                .thenThrow(new RuntimeException("db down"));
        when(schoolReportRepository.save(any(SchoolReport.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.generateInternal(1L, 5L);

        ArgumentCaptor<SchoolReport> captor = ArgumentCaptor.forClass(SchoolReport.class);
        org.mockito.Mockito.verify(schoolReportRepository, org.mockito.Mockito.atLeastOnce())
                .save(captor.capture());
        assertThat(captor.getValue().getGenerationStatus())
                .isEqualTo(CohortInsightGenerationService.STATUS_FAILED);
    }

    @Test
    void markPendingReturnsFalseWhenAlreadyGenerating() {
        SchoolReport existing = new SchoolReport();
        existing.setGenerationStatus(CohortInsightGenerationService.STATUS_GENERATING);
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(existing));

        boolean enqueued = service.markPending(1L, 5L, 99L);

        assertThat(enqueued).isFalse();
    }

    @Test
    void getViewComputesNewSinceGenerationAndLogicStaleness() throws Exception {
        SchoolReport sr = new SchoolReport();
        sr.setInstituteCode(1L);
        sr.setAssessmentId(5L);
        sr.setGenerationStatus(CohortInsightGenerationService.STATUS_GENERATED);
        sr.setLogicVersion("old-logic");
        sr.setStudentsWithScores(2);
        sr.setCompletedCount(2);
        CohortInsightPayload p = new CohortInsightPayload();
        p.studentCount = 2;
        sr.setReportData(new ObjectMapper().writeValueAsString(p));
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(sr));
        when(mappingRepository.countCompletedByInstituteAndAssessment(1L, 5L)).thenReturn(5L);

        CohortInsightView view = service.getView(1L, 5L);

        assertThat(view.status).isEqualTo(CohortInsightGenerationService.STATUS_GENERATED);
        assertThat(view.newSinceGeneration).isEqualTo(3); // 5 current - 2 included
        assertThat(view.logicStale).isTrue();             // "old-logic" != placeholder-v0
        assertThat(view.payload).isNotNull();
        assertThat(view.payload.studentCount).isEqualTo(2);
    }

    @Test
    void getViewReturnsNotGeneratedWhenNoRow() {
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.empty());
        CohortInsightView view = service.getView(1L, 5L);
        assertThat(view.status).isNull();
        assertThat(view.payload).isNull();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `mvn -f spring-social/pom.xml test -Dtest=CohortInsightGenerationServiceTest`
Expected: FAIL — `CohortInsightGenerationService` does not exist.

- [ ] **Step 4: Write the service**

Create `CohortInsightGenerationService.java`:

```java
package com.kccitm.api.service.dashboard.cohort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.SchoolReport;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.SchoolReportRepository;
import com.kccitm.api.repository.Career9.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;

/**
 * Orchestrates on-demand cohort-insight generation for one (institute, assessment).
 * Source = already-precomputed per-student Navigator360Result JSONs; output = one
 * payload stored in school_report. Generation runs async; reads are pure lookups.
 */
@Service
public class CohortInsightGenerationService {

    private static final Logger log = LoggerFactory.getLogger(CohortInsightGenerationService.class);

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_GENERATING = "GENERATING";
    public static final String STATUS_GENERATED = "GENERATED";
    public static final String STATUS_FAILED = "FAILED";

    private final SchoolReportRepository schoolReportRepository;
    private final GeneratedReportRepository generatedReportRepository;
    private final StudentAssessmentMappingRepository mappingRepository;
    private final CohortInsightAggregator aggregator;
    private final ObjectMapper objectMapper;

    public CohortInsightGenerationService(
            SchoolReportRepository schoolReportRepository,
            GeneratedReportRepository generatedReportRepository,
            StudentAssessmentMappingRepository mappingRepository,
            CohortInsightAggregator aggregator,
            ObjectMapper objectMapper) {
        this.schoolReportRepository = schoolReportRepository;
        this.generatedReportRepository = generatedReportRepository;
        this.mappingRepository = mappingRepository;
        this.aggregator = aggregator;
        this.objectMapper = objectMapper;
    }

    /**
     * Mark a generation as enqueued (PENDING). Returns false (no-op) if a run is
     * already PENDING or GENERATING — the duplicate-click guard.
     */
    @Transactional
    public boolean markPending(Long instituteCode, Long assessmentId, Long generatedBy) {
        SchoolReport row = schoolReportRepository
                .findByInstituteCodeAndAssessmentId(instituteCode, assessmentId)
                .orElseGet(() -> {
                    SchoolReport sr = new SchoolReport();
                    sr.setInstituteCode(instituteCode);
                    sr.setAssessmentId(assessmentId);
                    return sr;
                });

        String status = row.getGenerationStatus();
        if (STATUS_PENDING.equals(status) || STATUS_GENERATING.equals(status)) {
            return false;
        }
        row.setGenerationStatus(STATUS_PENDING);
        row.setGeneratedBy(generatedBy);
        schoolReportRepository.save(row);
        return true;
    }

    /** Async entry point — returns immediately to the HTTP thread. */
    @Async("applicationTaskExecutor")
    public void runGenerationAsync(Long instituteCode, Long assessmentId) {
        try {
            generateInternal(instituteCode, assessmentId);
        } catch (Exception ex) {
            log.error("Cohort insight generation failed institute={} assessment={}",
                    instituteCode, assessmentId, ex);
        }
    }

    /** Synchronous generation core (unit-tested). */
    @Transactional
    public void generateInternal(Long instituteCode, Long assessmentId) {
        SchoolReport row = schoolReportRepository
                .findByInstituteCodeAndAssessmentId(instituteCode, assessmentId)
                .orElseGet(() -> {
                    SchoolReport sr = new SchoolReport();
                    sr.setInstituteCode(instituteCode);
                    sr.setAssessmentId(assessmentId);
                    return sr;
                });

        // Guard: if another pass already flipped to GENERATING, don't double-run.
        if (STATUS_GENERATING.equals(row.getGenerationStatus())) {
            log.info("Cohort generation already in progress institute={} assessment={}", instituteCode, assessmentId);
            return;
        }
        row.setGenerationStatus(STATUS_GENERATING);
        schoolReportRepository.save(row);

        try {
            List<GeneratedReport> reports =
                    generatedReportRepository.findPagerReportsByInstituteAndAssessment(instituteCode, assessmentId);

            List<Navigator360Result> perStudent = new ArrayList<>();
            for (GeneratedReport gr : reports) {
                String json = gr.getNavigatorDashboardJson();
                if (json == null || json.isEmpty()) {
                    continue;
                }
                try {
                    perStudent.add(objectMapper.readValue(json, Navigator360Result.class));
                } catch (Exception parseEx) {
                    log.warn("Skipping unparseable navigator JSON report={}", gr.getGeneratedReportId(), parseEx);
                }
            }

            long completed = mappingRepository.countCompletedByInstituteAndAssessment(instituteCode, assessmentId);
            CohortInsightPayload payload = aggregator.aggregate(instituteCode, assessmentId, perStudent);

            row.setReportData(objectMapper.writeValueAsString(payload));
            row.setLogicVersion(aggregator.logicVersion());
            row.setStudentsWithScores(perStudent.size());
            row.setCompletedCount((int) completed);
            row.setTotalStudents((int) completed);
            row.setGenerationStatus(STATUS_GENERATED);
            schoolReportRepository.save(row);
            log.info("Cohort insight generated institute={} assessment={} included={} completed={}",
                    instituteCode, assessmentId, perStudent.size(), completed);
        } catch (Exception ex) {
            row.setGenerationStatus(STATUS_FAILED);
            schoolReportRepository.save(row);
            log.error("Cohort insight generation error institute={} assessment={}", instituteCode, assessmentId, ex);
        }
    }

    /** Read path — pure lookup + freshness/staleness computation. No heavy work. */
    @Transactional(readOnly = true)
    public CohortInsightView getView(Long instituteCode, Long assessmentId) {
        CohortInsightView view = new CohortInsightView();
        view.instituteCode = instituteCode;
        view.assessmentId = assessmentId;
        view.currentLogicVersion = aggregator.logicVersion();

        Optional<SchoolReport> opt =
                schoolReportRepository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId);
        if (!opt.isPresent()) {
            return view; // status null => NOT_GENERATED
        }
        SchoolReport sr = opt.get();
        view.status = sr.getGenerationStatus();
        view.logicVersion = sr.getLogicVersion();
        view.includedCount = sr.getStudentsWithScores();
        view.completedCount = sr.getCompletedCount();
        view.computedAt = sr.getUpdatedAt();
        view.logicStale = sr.getLogicVersion() != null
                && !sr.getLogicVersion().equals(view.currentLogicVersion);

        long currentCompleted = mappingRepository.countCompletedByInstituteAndAssessment(instituteCode, assessmentId);
        int included = view.includedCount == null ? 0 : view.includedCount;
        view.newSinceGeneration = (int) Math.max(0, currentCompleted - included);

        if (STATUS_GENERATED.equals(sr.getGenerationStatus()) && sr.getReportData() != null) {
            try {
                view.payload = objectMapper.readValue(sr.getReportData(), CohortInsightPayload.class);
            } catch (Exception ex) {
                log.warn("Failed to parse stored cohort payload institute={} assessment={}",
                        instituteCode, assessmentId, ex);
            }
        }
        return view;
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `mvn -f spring-social/pom.xml test -Dtest=CohortInsightGenerationServiceTest`
Expected: PASS (all five tests).

- [ ] **Step 6: Verify & leave unstaged** — confirm green; do NOT commit/stage.

---

## Task 5: REST controller (generate / read / list)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/dashboard/CohortInsightController.java`
- Test: `spring-social/src/test/java/com/kccitm/api/controller/dashboard/CohortInsightControllerTest.java`

**Interfaces:**
- Consumes: `CohortInsightGenerationService` (Task 4); current user id via the same mechanism existing controllers use (see Step 4 note).
- Produces (consumed by Task 6 frontend):
  - `POST /dashboard/cohort-insights/{instituteCode}/{assessmentId}/generate` (perm `dashboard.school.insights.generate`) → 202 `{ "enqueued": true|false }`.
  - `GET /dashboard/cohort-insights/{instituteCode}/{assessmentId}` (perm `dashboard.school.insights.read`, institute-scoped) → `CohortInsightView`.

- [ ] **Step 1: Write the failing test**

Create `CohortInsightControllerTest.java`:

```java
package com.kccitm.api.controller.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import com.kccitm.api.service.dashboard.cohort.CohortInsightGenerationService;
import com.kccitm.api.service.dashboard.cohort.CohortInsightView;

class CohortInsightControllerTest {

    private CohortInsightGenerationService service;
    private CohortInsightController controller;

    @BeforeEach
    void setUp() {
        service = mock(CohortInsightGenerationService.class);
        controller = new CohortInsightController(service);
    }

    @Test
    void generateEnqueuesAndDispatchesAsyncWhenNewlyPending() {
        when(service.markPending(1L, 5L, null)).thenReturn(true);

        ResponseEntity<?> resp = controller.generate(1, 5L);

        assertThat(resp.getStatusCodeValue()).isEqualTo(202);
        verify(service).runGenerationAsync(1L, 5L);
    }

    @Test
    void generateDoesNotDispatchAsyncWhenAlreadyRunning() {
        when(service.markPending(1L, 5L, null)).thenReturn(false);

        ResponseEntity<?> resp = controller.generate(1, 5L);

        assertThat(resp.getStatusCodeValue()).isEqualTo(202);
        verify(service, never()).runGenerationAsync(eq(1L), eq(5L));
    }

    @Test
    void getReturnsViewFromService() {
        CohortInsightView view = new CohortInsightView();
        view.status = CohortInsightGenerationService.STATUS_GENERATED;
        when(service.getView(1L, 5L)).thenReturn(view);

        ResponseEntity<CohortInsightView> resp = controller.get(1, 5L);

        assertThat(resp.getStatusCodeValue()).isEqualTo(200);
        assertThat(resp.getBody().status).isEqualTo(CohortInsightGenerationService.STATUS_GENERATED);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -f spring-social/pom.xml test -Dtest=CohortInsightControllerTest`
Expected: FAIL — `CohortInsightController` does not exist.

- [ ] **Step 3: Write the controller**

Create `CohortInsightController.java`:

```java
package com.kccitm.api.controller.dashboard;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.dashboard.cohort.CohortInsightGenerationService;
import com.kccitm.api.service.dashboard.cohort.CohortInsightView;

import java.util.Collections;

@RestController
@RequestMapping("/dashboard/cohort-insights")
public class CohortInsightController {

    private final CohortInsightGenerationService service;

    public CohortInsightController(CohortInsightGenerationService service) {
        this.service = service;
    }

    /**
     * Superadmin-only. Enqueues async generation; returns 202 immediately.
     * instituteCode is Integer here to bind the @auth scope; converted to Long for the service.
     */
    @PostMapping("/{instituteCode}/{assessmentId}/generate")
    @PreAuthorize("@auth.allows('dashboard.school.insights.generate')")
    public ResponseEntity<?> generate(@PathVariable Integer instituteCode,
                                      @PathVariable Long assessmentId) {
        Long inst = instituteCode.longValue();
        Long currentUserId = currentUserIdOrNull();
        boolean enqueued = service.markPending(inst, assessmentId, currentUserId);
        if (enqueued) {
            service.runGenerationAsync(inst, assessmentId);
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Collections.singletonMap("enqueued", enqueued));
    }

    /** School-admin read, scoped to their institute via @auth. */
    @GetMapping("/{instituteCode}/{assessmentId}")
    @PreAuthorize("@auth.allows('dashboard.school.insights.read', #instituteCode)")
    public ResponseEntity<CohortInsightView> get(@PathVariable Integer instituteCode,
                                                 @PathVariable Long assessmentId) {
        return ResponseEntity.ok(service.getView(instituteCode.longValue(), assessmentId));
    }

    private Long currentUserIdOrNull() {
        // Generation does not depend on the actor id (it is recorded for audit only).
        // If this codebase exposes the current user id via a principal/util, wire it here;
        // otherwise null is acceptable for the audit stamp. See Step 4 note.
        return null;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -f spring-social/pom.xml test -Dtest=CohortInsightControllerTest`
Expected: PASS (all three tests).

> **Note on `currentUserIdOrNull()`:** the tests pass `null` for `generatedBy`. If you want the audit stamp populated, look at how a sibling controller reads the authenticated principal (e.g. `SecurityContextHolder.getContext().getAuthentication().getPrincipal()` cast to `UserPrincipal`, then `.getId()`/`.getUserId()`), and return that. This is optional polish — the feature works with `null`. Update the test's `markPending(1L, 5L, null)` stubs to match if you change the signature usage.

- [ ] **Step 5: Verify & leave unstaged** — confirm green; do NOT commit/stage.

---

## Task 6: Frontend API client

**Files:**
- Create: `react-social/src/app/pages/SchoolAdmin/CohortInsights_APIs.ts`

**Interfaces:**
- Produces (consumed by Task 7): `generateCohortInsight(instituteCode, assessmentId)`, `getCohortInsight(instituteCode, assessmentId)`, and the `CohortInsightView`/`CohortInsightPayload` TS types mirroring Task 4's DTOs.

- [ ] **Step 1: Write the API client**

Create `CohortInsights_APIs.ts` (mirror the axios pattern from `BetReportData_APIs.ts` — base URL from env, bare `axios`):

```typescript
import axios from "axios";

const BASE = `${process.env.REACT_APP_API_URL || "http://localhost:8080"}/dashboard/cohort-insights`;

export interface CohortDimension {
  name: string;
  avgNormPct: number;
}

export interface CohortInsightPayload {
  studentCount: number;
  riasecAverage: CohortDimension[];
  logicVersion: string;
  note?: string;
}

export interface CohortInsightView {
  instituteCode: number;
  assessmentId: number;
  status: "PENDING" | "GENERATING" | "GENERATED" | "FAILED" | null;
  logicVersion: string | null;
  currentLogicVersion: string;
  logicStale: boolean;
  includedCount: number | null;
  completedCount: number | null;
  newSinceGeneration: number;
  computedAt: string | null;
  payload: CohortInsightPayload | null;
}

/** Superadmin: enqueue async generation. Returns { enqueued }. */
export function generateCohortInsight(instituteCode: number, assessmentId: number) {
  return axios.post<{ enqueued: boolean }>(
    `${BASE}/${instituteCode}/${assessmentId}/generate`,
  );
}

/** School admin: read the stored cohort insight view for one assessment card. */
export function getCohortInsight(instituteCode: number, assessmentId: number) {
  return axios.get<CohortInsightView>(`${BASE}/${instituteCode}/${assessmentId}`);
}
```

- [ ] **Step 2: Verify & leave unstaged**

Run: `cd react-social && npx tsc --noEmit`
Expected: no new type errors from this file. Do NOT commit/stage.

---

## Task 7: Frontend cohort insights page

**Files:**
- Create: `react-social/src/app/pages/SchoolAdmin/CohortInsightsPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `../../modules/auth/core/Auth` (provides `currentUser` with `superAdmin`, `scopes`); `getCohortInsight`/`generateCohortInsight` (Task 6).
- The list of which assessments to show as cards: for the scaffold, accept assessment ids via a constant/prop list and render one card each. (Wiring the real per-institute assessment list is a follow-up; this page proves the card states + read/generate flow.)

> The page reads the current institute from `currentUser?.scopes?.[0]?.instituteCode` (see the SchoolDashboardPage pattern). If your auth context exposes the institute differently, adjust that single line.

- [ ] **Step 1: Write the page component**

Create `CohortInsightsPage.tsx`:

```tsx
import { FC, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../modules/auth/core/Auth";
import {
  CohortInsightView,
  generateCohortInsight,
  getCohortInsight,
} from "./CohortInsights_APIs";

// Scaffold: the assessments to render as cards. Replace with the institute's
// real assessment list (fetch by institute) in a follow-up.
const ASSESSMENT_CARDS: { assessmentId: number; name: string }[] = [
  { assessmentId: 1, name: "Assessment 1" },
];

const statusLabel = (v: CohortInsightView | undefined): string => {
  if (!v || v.status === null) return "Not generated";
  switch (v.status) {
    case "PENDING":
    case "GENERATING":
      return "Generating…";
    case "GENERATED":
      return "Ready";
    case "FAILED":
      return "Generation failed";
    default:
      return "Unknown";
  }
};

const CohortInsightCard: FC<{
  instituteCode: number;
  assessmentId: number;
  name: string;
  canGenerate: boolean;
}> = ({ instituteCode, assessmentId, name, canGenerate }) => {
  const [view, setView] = useState<CohortInsightView | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getCohortInsight(instituteCode, assessmentId)
      .then((r) => setView(r.data))
      .catch(() => setView(undefined))
      .finally(() => setLoading(false));
  }, [instituteCode, assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const onGenerate = () => {
    generateCohortInsight(instituteCode, assessmentId).then(() => {
      // Re-poll after enqueue so the card moves to Generating → Ready.
      setTimeout(load, 1500);
    });
  };

  return (
    <div style={{ border: "1px solid #e2e2e2", borderRadius: 8, padding: 16, minWidth: 280 }}>
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div style={{ color: "#666", margin: "4px 0" }}>
        {loading ? "Loading…" : statusLabel(view)}
      </div>

      {view && view.status === "GENERATED" && (
        <>
          <div style={{ fontSize: 12, color: "#888" }}>
            Generated{view.computedAt ? ` ${new Date(view.computedAt).toLocaleString()}` : ""} from{" "}
            {view.includedCount ?? 0} of {view.completedCount ?? 0} completed
            {view.newSinceGeneration > 0 ? ` · ${view.newSinceGeneration} new completions since` : ""}
          </div>
          {view.logicStale && (
            <div style={{ fontSize: 12, color: "#b8860b" }}>
              Computed with an older logic version — regenerate recommended.
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <strong>Students:</strong> {view.payload?.studentCount ?? 0}
            <ul style={{ marginTop: 4 }}>
              {(view.payload?.riasecAverage ?? []).map((d) => (
                <li key={d.name}>
                  {d.name}: {d.avgNormPct.toFixed(1)}
                </li>
              ))}
            </ul>
            {view.payload?.note && (
              <div style={{ fontSize: 11, color: "#999" }}>{view.payload.note}</div>
            )}
          </div>
        </>
      )}

      {canGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={view?.status === "PENDING" || view?.status === "GENERATING"}
          style={{ marginTop: 12 }}
        >
          {view && view.status ? "Regenerate" : "Generate"}
        </button>
      )}
    </div>
  );
};

const CohortInsightsPage: FC = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.superAdmin === true;
  const instituteCode: number | undefined = currentUser?.scopes?.[0]?.instituteCode;

  if (!instituteCode) {
    return <div style={{ padding: 24 }}>No institute is associated with your account.</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>School Cohort Insights</h2>
      <p style={{ color: "#666" }}>
        Cohort-level Navigator 360 insights for your school. Insights are generated on demand
        {isSuperAdmin ? " — use Generate/Regenerate below." : " by an administrator."}
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        {ASSESSMENT_CARDS.map((c) => (
          <CohortInsightCard
            key={c.assessmentId}
            instituteCode={instituteCode}
            assessmentId={c.assessmentId}
            name={c.name}
            canGenerate={isSuperAdmin}
          />
        ))}
      </div>
    </div>
  );
};

export default CohortInsightsPage;
```

- [ ] **Step 2: Verify & leave unstaged**

Run: `cd react-social && npx tsc --noEmit`
Expected: no new type errors. If `useAuth`'s `currentUser` type doesn't declare `scopes`/`superAdmin`, read the actual `Auth.tsx`/`_models` type and adjust the field access (these fields exist at runtime per the auth exploration; the type may need the optional-chaining you already have or a small type widening). Do NOT commit/stage.

---

## Task 8: Wire route + sidebar menu

**Files:**
- Modify: `react-social/src/app/routing/PrivateRoutes.tsx`
- Modify: the sidebar/menu component (locate at execution time — search for where existing menu items like "report-generation" or "School Dashboard" are listed, e.g. under `react-social/src/_metronic/layout/components/` or a `AsideMenuMain`/`MasterLayout` file).

- [ ] **Step 1: Add the lazy import + route**

In `PrivateRoutes.tsx`, add the lazy import near the other `lazy(() => import(...))` declarations:

```tsx
const CohortInsightsPage = lazy(() => import("../pages/SchoolAdmin/CohortInsightsPage"));
```

Add the route inside the authorized-layout `<Route>` block, mirroring the existing `RequirePermission` + `SuspensedView` pattern:

```tsx
<Route
  path="/school-admin/cohort-insights"
  element={
    <RequirePermission perm="dashboard.school.insights.read">
      <SuspensedView>
        <CohortInsightsPage />
      </SuspensedView>
    </RequirePermission>
  }
/>
```

> Use the exact `RequirePermission` prop name the file already uses (the exploration saw `perm="..."`). If it differs (e.g. `permission=`), match the existing usage in this same file.

- [ ] **Step 2: Add the sidebar menu link**

Locate the sidebar menu definition (search the layout components for an existing entry such as the School Dashboard or Report Generation link). Add a link to `/school-admin/cohort-insights` labeled "Cohort Insights", copying the surrounding item's structure (icon/title/`to` props). Gate it with the same permission/role check sibling items use if the menu supports it.

- [ ] **Step 3: Verify & leave unstaged**

Run: `cd react-social && npx tsc --noEmit`
Expected: no new type errors.
Manual check (optional, requires running the app): log in, navigate to `/school-admin/cohort-insights`, confirm the page renders cards in the "Not generated" state; as superadmin, click Generate and confirm the card transitions to Generating → Ready. Do NOT commit/stage.

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-24-school-cohort-insights-dashboard-design.md`):
- §4 decision 1 (on-demand generation) → Tasks 4, 5. ✅
- §4 decision 2 (superadmin only) → Task 5 generate endpoint perm `dashboard.school.insights.generate`. ✅
- §4 decision 3 (async) → Task 4 `runGenerationAsync` `@Async`. ✅
- §4 decision 4 (per institute×assessment) → path vars + repo queries (Tasks 3–5). ✅
- §4 decision 5 (per-assessment cards) → Task 7 card-per-assessment. ✅
- §4 decision 6 (read = stored only) → Task 4 `getView` does no aggregation. ✅
- §4 decision 7 (coverage = completed) → Task 3 `countCompletedByInstituteAndAssessment` + Task 4 `completedCount`. ✅
- §4 decision 8 (freshness/coverage stamps) → `completedCount`/`studentsWithScores`/`updatedAt` + `newSinceGeneration` (Tasks 1, 4). ✅
- §4 decision 9 (logicVersion) → `logic_version` column + `logicStale` (Tasks 1, 4). ✅
- §4 decision 10 (extend SchoolReport) → Task 1 (no new table). ✅
- §4 decision 11 (full scaffold + pluggable logic) → Task 2 interface + placeholder; Tasks 3–8 scaffold. ✅
- §5.1 card states (Not generated / Generating / Ready) → Task 7 `statusLabel`. ✅
- §7 permissions (generate superadmin, read school admin) → Tasks 1, 5. ✅
- §10 risks: stale-no-warning → `newSinceGeneration`/`logicStale` banner; heavy sync gen → async; dead logic → logicVersion; empty state → "Not generated"; placeholder visibility → payload `note`. ✅

**Deferred by design (not gaps):** real cohort formulas (placeholder stands in); the real per-institute assessment list feeding the cards (Task 7 uses a constant list — flagged inline); populating `aiInsights` (out of scope per spec §11).

**Placeholder scan:** No "TBD"/"implement later" in code steps. The two inline "if your project differs, adjust" notes (frontend npm script, `RequirePermission` prop name, auth field access) are real fallback instructions tied to a concrete primary value, not placeholders.

**Type consistency:** `CohortInsightPayload` fields (`studentCount`, `riasecAverage`, `logicVersion`, `note`) and `CohortDimension` (`name`, `avgNormPct`) match across Tasks 2, 4, 6. `CohortInsightView` fields match between Task 4 (Java) and Task 6 (TS). Status constants (`PENDING`/`GENERATING`/`GENERATED`/`FAILED`) consistent across Tasks 4–7. Service method names (`markPending`, `runGenerationAsync`, `generateInternal`, `getView`) consistent between Tasks 4 and 5.
