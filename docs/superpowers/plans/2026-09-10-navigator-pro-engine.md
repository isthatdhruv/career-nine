# Navigator Pro Report Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `navigator_pro` report engine: score a student's Navigator Pro answers from the stored MQT option scores, apply gates R1–R5, compute cohort norms and bands, and emit the placeholder map, plugged into the existing unified report pipeline.

**Architecture:** A new package `com.kccitm.api.service.b2c.navigatorpro` holds one `PlaceholderCalculator` entry point (`NavigatorProCalculationService`) and four pure collaborators (construct map, scorer, norms, content) plus a questionnaire index for the schema check. Constructs are identified by measured-quality-type (MQT) name through `mqt-map.yml`; reversal is already in the stored scores, so the engine only sums. Suppression is a new exception that `ReportService` records as a `suppressed` row; on-submit generation is skipped for manual-only engines via a property.

**Tech Stack:** Java 11, Spring Boot 2.5.5, Spring Data JPA (MySQL), SnakeYAML (bundled with Boot), JUnit 5 + Mockito + AssertJ, Flyway migrations, React/TypeScript admin (`react-social`).

**Spec:** `docs/superpowers/specs/2026-09-10-navigator-pro-engine-design.md`

## Global Constraints

- Engine code is exactly `navigator_pro`; engine version tag is exactly `navigator_pro-v1`.
- No reverse-scoring step anywhere; no marks table on the classpath; the workbook in `navigator-pro/` is never read by code.
- Nothing internal (validity flag count) goes into the placeholder map: `ReportService` embeds the whole map in the page.
- Student-facing band labels are only `Strong`, `Developing`, `Early`; emitted text never contains the words low, poor, weak, average, below average, least motivated, fail.
- Unsupplied copy renders as an empty string, never a placeholder token.
- Percentile bands: P ≥ 75 Strong, 25 ≤ P < 75 Developing, P < 25 Early, decided on the unrounded percentile. Sub-domain bars: raw ≥ 67 green/Strong, 34–66 amber/Developing, ≤ 33 red/Early.
- n-gates: percentiles suppressed below `percentile-min-n` (30); zone cuts 50/50 and `norms_provisional` true below `norms-min-n` (60).
- Backend tests run from `spring-social`: `mvn -o -q -Dtest=<ClassName> -DfailIfNoTests=false test`. Frontend check: `cd react-social && npm run typecheck` (58-error baseline; only the error count must not grow).
- Commit after every task; commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File Structure

Backend package `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/`:

| File | Responsibility |
|---|---|
| `NavigatorProConstructMap.java` | Loads `mqt-map.yml`; MQT name → construct key; expected counts and ranges; labels |
| `Contribution.java`, `ValueRank.java` | Immutable input rows for the scorer |
| `NavigatorProScores.java` | Scorer output holder |
| `NavigatorProScorer.java` | Pure scoring: rows → indices, families, checks, flags, incomplete list |
| `NavigatorProNorms.java` | Pure cohort maths: percentile rank, medians, bands, RAG, zone, precision |
| `NavigatorProContent.java` | Verbatim copy from the content workbook |
| `NavigatorProQuestionnaireIndex.java` | Schema check: questionnaire → question→construct index + problems |
| `NavigatorProCalculationService.java` | The `PlaceholderCalculator`; repositories, gates, caches, placeholder map |

Resource: `spring-social/src/main/resources/navigator-pro/mqt-map.yml`.

Touched elsewhere: `service/b2c/report/ReportSuppressedException.java` (new), `EngineVersions.java`, `ReportService.java`, `pipeline/ReportGenerateConsumer.java`, `pipeline/ReportPipelineProducer.java`, `controller/career9/report/UnifiedReportController.java`, `model/career9/GeneratedReport.java`, `repository/Career9/AssessmentAnswerRepository.java`, migration `V20260910001__generated_report_suppression_reason.sql`, `application.yml`, `docs/engine-versions.md`, `react-social/src/app/pages/ReportTemplates/ReportTemplatesPage.tsx`, `react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx`, `react-social/src/app/pages/ReportGeneration/API/GeneratedReport_APIs.ts`.

Tests under `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/` (one per class, plus `NavigatorProFixtures`), additions to the two pipeline tests, and a new `ReportServiceSuppressionTest` under `service/b2c/report/`.

---

### Task 1: Construct map resource and loader

**Files:**
- Create: `spring-social/src/main/resources/navigator-pro/mqt-map.yml`
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProConstructMap.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProConstructMapTest.java`

**Interfaces:**
- Produces: `NavigatorProConstructMap` (Spring `@Component`, also `new NavigatorProConstructMap()` in tests) with `Optional<String> constructFor(String mqtName)`, `Construct get(String key)`, `Collection<Construct> all()`, `String label(String key)`, `static String normalize(String)`, and the constant lists `FACTOR_KEYS`, `FAMILY_KEYS`, `SUB_KEYS`, `CHECK_KEYS`, `DOMAIN_KEYS`, `VALIDITY`, `ATTENTION`. `Construct` has public final fields `key, label, mqts, questions, min, max`.

- [x] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NavigatorProConstructMapTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();

    @Test
    void loadsAllThirtyThreeConstructsFromClasspath() {
        assertThat(map.all()).hasSize(33);
        assertThat(map.get("fs_tp").questions).isEqualTo(6);
        assertThat(map.get("d_pe").max).isEqualTo(5);
        assertThat(map.get("attention").mqts).containsExactly("Personality- Validity");
        assertThat(map.label("fam_r")).isEqualTo("Hands-on");
    }

    @Test
    void resolvesMqtNamesIgnoringCaseAndWhitespace() {
        assertThat(map.constructFor("  doer ")).contains("fam_r");
        assertThat(map.constructFor("personality-  validity")).contains("attention");
        assertThat(map.constructFor("Quality, Testing & Operations")).contains("d_qt");
        assertThat(map.constructFor("Grit")).isEmpty();
        assertThat(map.constructFor(null)).isEmpty();
    }

    @Test
    void rejectsFileWithoutConstructsBlock() {
        assertThatThrownBy(() -> new NavigatorProConstructMap(
                new ByteArrayInputStream("foo: 1".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("constructs");
    }

    @Test
    void rejectsOneMqtFeedingTwoConstructs() {
        String yaml = "constructs:\n"
                + "  f_id: { label: A, mqts: [\"Internal Drive\"], questions: 4, min: 1, max: 5 }\n"
                + "  f_st: { label: B, mqts: [\"internal drive\"], questions: 3, min: 1, max: 5 }\n";
        assertThatThrownBy(() -> new NavigatorProConstructMap(
                new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("feeds both");
    }

    @Test
    void rejectsMissingRequiredConstruct() {
        String yaml = "constructs:\n"
                + "  f_id: { label: A, mqts: [\"Internal Drive\"], questions: 4, min: 1, max: 5 }\n";
        assertThatThrownBy(() -> new NavigatorProConstructMap(
                new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("f_st");
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProConstructMapTest -DfailIfNoTests=false test`
Expected: compilation FAILURE, `cannot find symbol: class NavigatorProConstructMap`.

- [x] **Step 3: Write the resource**

Create `spring-social/src/main/resources/navigator-pro/mqt-map.yml`:

```yaml
# Navigator Pro construct map.
# Which measured-quality-type (MQT) names feed each construct, how many questions
# each construct must have in the questionnaire, and the score range every stored
# option score must lie in. Renaming an MQT in the admin = editing this file.
# Reversal lives in the stored scores; the engine only sums.
constructs:
  f_id:      { label: "Internal Drive",       mqts: ["Internal Drive"],        questions: 4, min: 1, max: 5 }
  f_st:      { label: "Sustained Tenacity",   mqts: ["Sustained Tenacity"],    questions: 3, min: 1, max: 5 }
  f_ae:      { label: "Adaptive Execution",   mqts: ["Adaptive Execution"],    questions: 4, min: 1, max: 5 }
  validity:  { label: "Validity",             mqts: ["Validity"],              questions: 3, min: 1, max: 5 }
  attention: { label: "Attention check",      mqts: ["Personality- Validity"], questions: 1, min: 0, max: 1 }
  fam_r:     { label: "Hands-on",             mqts: ["Doer"],                  questions: 6, min: 0, max: 1 }
  fam_i:     { label: "Analytical",           mqts: ["Thinker"],               questions: 6, min: 0, max: 1 }
  fam_a:     { label: "Creative",             mqts: ["Creator"],               questions: 6, min: 0, max: 1 }
  fam_s:     { label: "Social",               mqts: ["Helper"],                questions: 6, min: 0, max: 1 }
  fam_e:     { label: "Enterprising",         mqts: ["Persuader"],             questions: 6, min: 0, max: 1 }
  fam_c:     { label: "Organising",           mqts: ["Organizer"],             questions: 6, min: 0, max: 1 }
  fs_nd:     { label: "Numbers & data",             mqts: ["Numbers & data"],             questions: 4, min: 1, max: 4 }
  fs_di:     { label: "Digital & information",      mqts: ["Digital & information"],      questions: 4, min: 1, max: 4 }
  fs_tp:     { label: "Thinking & problem-solving", mqts: ["Thinking & problem-solving"], questions: 6, min: 1, max: 4 }
  fs_ci:     { label: "Creating & improving",       mqts: ["Creating & improving"],       questions: 4, min: 1, max: 4 }
  fs_gd:     { label: "Getting things done",        mqts: ["Getting things done"],        questions: 4, min: 1, max: 4 }
  chk_num:   { label: "Applied numeracy",   mqts: ["Numeracy"],          questions: 1, min: 0, max: 1 }
  chk_dat:   { label: "Data reading",       mqts: ["Data reading"],      questions: 1, min: 0, max: 1 }
  chk_cau:   { label: "Causal reasoning",   mqts: ["Causal reasoning"],  questions: 1, min: 0, max: 1 }
  chk_src:   { label: "Source judgment",    mqts: ["Source judgment"],   questions: 1, min: 0, max: 1 }
  chk_spr:   { label: "Spreadsheet logic",  mqts: ["Spreadsheet logic"], questions: 1, min: 0, max: 1 }
  d_sd:      { label: "Software Development",              mqts: ["Software Development"],              questions: 1, min: 1, max: 5 }
  d_da:      { label: "Data & AI",                         mqts: ["Data & AI"],                         questions: 1, min: 1, max: 5 }
  d_si:      { label: "Systems & Infrastructure",          mqts: ["Systems & Infrastructure"],          questions: 1, min: 1, max: 5 }
  d_cy:      { label: "Cybersecurity",                     mqts: ["Cybersecurity"],                     questions: 1, min: 1, max: 5 }
  d_ux:      { label: "Product & UX Design",               mqts: ["Product & UX Design"],               questions: 1, min: 1, max: 5 }
  d_ee:      { label: "Electronics & Embedded",            mqts: ["Electronics & Embedded"],            questions: 1, min: 1, max: 5 }
  d_pe:      { label: "Power & Energy",                    mqts: ["Power & Energy"],                    questions: 1, min: 1, max: 5 }
  d_md:      { label: "Mechanical Design & Manufacturing", mqts: ["Mechanical Design & Manufacturing"], questions: 1, min: 1, max: 5 }
  d_cs:      { label: "Civil & Structural",                mqts: ["Civil & Structural"],                questions: 1, min: 1, max: 5 }
  d_pc:      { label: "Process & Chemical",                mqts: ["Process & Chemical"],                questions: 1, min: 1, max: 5 }
  d_qt:      { label: "Quality, Testing & Operations",     mqts: ["Quality, Testing & Operations"],     questions: 1, min: 1, max: 5 }
  d_tb:      { label: "Technical Business & Consulting",   mqts: ["Technical Business & Consulting"],   questions: 1, min: 1, max: 5 }
```

- [x] **Step 4: Write the loader**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

/**
 * Which measured-quality-type (MQT) names feed each Navigator Pro construct.
 * Loaded once from {@code navigator-pro/mqt-map.yml}. A question belongs to a
 * construct because its options carry scores under that construct's MQT; nothing
 * is identified by item code or excel header.
 */
@Component
public class NavigatorProConstructMap {

    public static final List<String> FACTOR_KEYS = List.of("f_id", "f_st", "f_ae");
    public static final List<String> FAMILY_KEYS = List.of("fam_r", "fam_i", "fam_a", "fam_s", "fam_e", "fam_c");
    public static final List<String> SUB_KEYS    = List.of("fs_nd", "fs_di", "fs_tp", "fs_ci", "fs_gd");
    public static final List<String> CHECK_KEYS  = List.of("chk_num", "chk_dat", "chk_cau", "chk_src", "chk_spr");
    public static final List<String> DOMAIN_KEYS = List.of("d_sd", "d_da", "d_si", "d_cy", "d_ux", "d_ee",
                                                           "d_pe", "d_md", "d_cs", "d_pc", "d_qt", "d_tb");
    public static final String VALIDITY  = "validity";
    public static final String ATTENTION = "attention";

    public static final class Construct {
        public final String key;
        public final String label;
        public final List<String> mqts;
        public final int questions;
        public final int min;
        public final int max;

        Construct(String key, String label, List<String> mqts, int questions, int min, int max) {
            this.key = key; this.label = label; this.mqts = List.copyOf(mqts);
            this.questions = questions; this.min = min; this.max = max;
        }
    }

    private final Map<String, Construct> byKey = new LinkedHashMap<>();
    private final Map<String, String> keyByMqt = new HashMap<>();

    public NavigatorProConstructMap() {
        this(NavigatorProConstructMap.class.getResourceAsStream("/navigator-pro/mqt-map.yml"));
    }

    @SuppressWarnings("unchecked")
    NavigatorProConstructMap(InputStream in) {
        if (in == null) {
            throw new IllegalStateException("navigator-pro/mqt-map.yml missing from classpath");
        }
        Object root = new Yaml().load(in);
        Object constructs = root instanceof Map ? ((Map<String, Object>) root).get("constructs") : null;
        if (!(constructs instanceof Map)) {
            throw new IllegalStateException("mqt-map.yml: top-level 'constructs' map missing");
        }
        for (Map.Entry<String, Object> e : ((Map<String, Object>) constructs).entrySet()) {
            Map<String, Object> c = (Map<String, Object>) e.getValue();
            List<String> mqts = (List<String>) c.get("mqts");
            if (mqts == null || mqts.isEmpty()) {
                throw new IllegalStateException("mqt-map.yml: construct " + e.getKey() + " has no mqts");
            }
            Construct cons = new Construct(e.getKey(), String.valueOf(c.get("label")), mqts,
                    ((Number) c.get("questions")).intValue(),
                    ((Number) c.get("min")).intValue(),
                    ((Number) c.get("max")).intValue());
            byKey.put(cons.key, cons);
            for (String m : mqts) {
                String prev = keyByMqt.put(normalize(m), cons.key);
                if (prev != null) {
                    throw new IllegalStateException("mqt-map.yml: MQT '" + m + "' feeds both "
                            + prev + " and " + cons.key);
                }
            }
        }
        List<String> required = new ArrayList<>(FACTOR_KEYS);
        required.add(VALIDITY);
        required.add(ATTENTION);
        required.addAll(FAMILY_KEYS);
        required.addAll(SUB_KEYS);
        required.addAll(CHECK_KEYS);
        required.addAll(DOMAIN_KEYS);
        for (String k : required) {
            if (!byKey.containsKey(k)) {
                throw new IllegalStateException("mqt-map.yml: construct '" + k + "' missing");
            }
        }
    }

    /** Trim, collapse inner whitespace, lower-case — the only normalisation applied to MQT names. */
    public static String normalize(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public Optional<String> constructFor(String mqtName) {
        return Optional.ofNullable(keyByMqt.get(normalize(mqtName)));
    }

    public Construct get(String key) {
        Construct c = byKey.get(key);
        if (c == null) throw new IllegalArgumentException("unknown construct " + key);
        return c;
    }

    public Collection<Construct> all() {
        return Collections.unmodifiableCollection(byKey.values());
    }

    public String label(String key) {
        return get(key).label;
    }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProConstructMapTest -DfailIfNoTests=false test`
Expected: PASS (5 tests).

- [x] **Step 6: Commit**

```bash
git add spring-social/src/main/resources/navigator-pro/mqt-map.yml \
  spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProConstructMap.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProConstructMapTest.java
git commit -m "navpro: construct map resource and loader (MQT name -> construct)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure scorer with golden fixtures

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/Contribution.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/ValueRank.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProScores.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProScorer.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProScorerTest.java`

**Interfaces:**
- Consumes: `NavigatorProConstructMap` (Task 1).
- Produces: `new Contribution(String construct, long questionId, int score)`; `new ValueRank(int rank, String optionText)`; `new NavigatorProScorer(NavigatorProConstructMap map, double flatGap).score(List<Contribution> rows, List<ValueRank> values, Map<String, Set<Long>> expected)` returning `NavigatorProScores` with `double get(String key)` for keys `f_id, f_st, f_ae, drive, foundation, skill, fs_*, d_*, fam_*`, `Map<String,Boolean> checks`, `int reasoning`, `String topFamily, secondFamily`, `boolean flat`, `List<String> values`, `boolean valuesMissing`, `int validityFlags`, `boolean attentionPassed`, `List<String> incomplete`, `double maxFamily()`, `double maxDomain()`.

- [x] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class NavigatorProScorerTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();
    private final NavigatorProScorer scorer = new NavigatorProScorer(map, 10.0);

    /** Mutable fixture: rows + the expected question ids per construct. */
    private static final class Fx {
        final List<Contribution> rows = new ArrayList<>();
        final Map<String, Set<Long>> expected = new HashMap<>();
        final List<ValueRank> values = new ArrayList<>();
        long nextQ = 1;

        /** One question per score under {@code construct}; registers each question id as expected. */
        void add(String construct, int... scores) {
            for (int sc : scores) {
                long q = nextQ++;
                rows.add(new Contribution(construct, q, sc));
                expected.computeIfAbsent(construct, k -> new HashSet<>()).add(q);
            }
        }

        /** Fill every construct with one score per question, repeated per scale. */
        void fillAll(int agree, int freq, int mcq, int intensity, int yes, int validity, int attention) {
            for (String k : NavigatorProConstructMap.FACTOR_KEYS) add(k, repeat(agree, k.equals("f_st") ? 3 : 4));
            add(NavigatorProConstructMap.VALIDITY, repeat(validity, 3));
            add(NavigatorProConstructMap.ATTENTION, attention);
            for (String k : NavigatorProConstructMap.FAMILY_KEYS) add(k, repeat(yes, 6));
            for (String k : NavigatorProConstructMap.SUB_KEYS) add(k, repeat(freq, k.equals("fs_tp") ? 6 : 4));
            for (String k : NavigatorProConstructMap.CHECK_KEYS) add(k, mcq);
            for (String k : NavigatorProConstructMap.DOMAIN_KEYS) add(k, intensity);
        }

        static int[] repeat(int v, int n) { int[] a = new int[n]; java.util.Arrays.fill(a, v); return a; }
    }

    private NavigatorProScores score(Fx fx) {
        return scorer.score(fx.rows, fx.values, fx.expected);
    }

    @Test
    void maxFixture_scoresEverythingAtHundred() {
        Fx fx = new Fx();
        fx.fillAll(5, 4, 1, 5, 1, 1, 1);
        NavigatorProScores s = score(fx);
        assertThat(s.get("f_id")).isEqualTo(100.0);
        assertThat(s.get("f_st")).isEqualTo(100.0);
        assertThat(s.get("f_ae")).isEqualTo(100.0);
        assertThat(s.get("drive")).isEqualTo(100.0);
        assertThat(s.get("foundation")).isEqualTo(100.0);
        assertThat(s.get("fs_tp")).isEqualTo(100.0);
        assertThat(s.reasoning).isEqualTo(5);
        assertThat(s.get("skill")).isEqualTo(100.0);
        assertThat(s.get("d_pe")).isEqualTo(100.0);
        assertThat(s.get("fam_r")).isEqualTo(100.0);
        assertThat(s.validityFlags).isZero();
        assertThat(s.attentionPassed).isTrue();
        assertThat(s.incomplete).isEmpty();
    }

    @Test
    void minFixture_scoresEverythingAtZero() {
        Fx fx = new Fx();
        fx.fillAll(1, 1, 0, 1, 0, 1, 1);
        NavigatorProScores s = score(fx);
        assertThat(s.get("drive")).isZero();
        assertThat(s.get("foundation")).isZero();
        assertThat(s.get("fs_gd")).isZero();
        assertThat(s.reasoning).isZero();
        assertThat(s.checks.values()).containsOnly(false);
        assertThat(s.get("skill")).isZero();
        assertThat(s.get("fam_c")).isZero();
        assertThat(s.maxFamily()).isZero();
        assertThat(s.maxDomain()).isZero();
    }

    @Test
    void reverseItem_isJustItsStoredScore_andDriveIsTheUnionOfFactorRows() {
        Fx fx = new Fx();
        fx.add("f_id", 4, 4, 4, 4);   // Σ16 → (16−4)/16 = 75
        fx.add("f_st", 5, 4, 2);      // Σ11 → (11−3)/12 = 66.67
        fx.add("f_ae", 5, 5, 1, 5);   // reverse item stored 1 → Σ16 → 75
        NavigatorProScores s = score(fx);
        assertThat(s.get("f_id")).isEqualTo(75.0);
        assertThat(s.get("f_st")).isCloseTo(66.667, within(0.01));
        assertThat(s.get("f_ae")).isEqualTo(75.0);
        assertThat(s.get("drive")).isCloseTo((43 - 11) * 100.0 / 44, within(0.0001));
    }

    @Test
    void validityFlags_countRowsAtFourOrAbove() {
        Fx a = new Fx(); a.add(NavigatorProConstructMap.VALIDITY, 4, 5, 1);
        assertThat(score(a).validityFlags).isEqualTo(2);
        Fx b = new Fx(); b.add(NavigatorProConstructMap.VALIDITY, 2, 2, 5);
        assertThat(score(b).validityFlags).isEqualTo(1);
        Fx c = new Fx(); c.add(NavigatorProConstructMap.VALIDITY, 3, 3, 3);
        assertThat(score(c).validityFlags).isZero();
    }

    @Test
    void attention_passesOnlyOnScoreOne() {
        Fx yes = new Fx(); yes.add(NavigatorProConstructMap.ATTENTION, 0);
        assertThat(score(yes).attentionPassed).isFalse();
        Fx no = new Fx(); no.add(NavigatorProConstructMap.ATTENTION, 1);
        assertThat(score(no).attentionPassed).isTrue();
        assertThat(score(new Fx()).attentionPassed).isFalse();
    }

    @Test
    void families_shapeIsDifferentiatedWhenGapReachesTen() {
        Fx fx = new Fx();
        fx.add("fam_r", 1, 1, 1, 1, 1, 0);   // 83.3
        fx.add("fam_i", 1, 1, 1, 0, 0, 0);   // 50
        fx.add("fam_a", 1, 1, 0, 0, 0, 0);
        fx.add("fam_s", 1, 1, 0, 0, 0, 0);
        fx.add("fam_e", 1, 1, 1, 0, 0, 0);
        fx.add("fam_c", 1, 0, 0, 0, 0, 0);
        NavigatorProScores s = score(fx);
        assertThat(s.topFamily).isEqualTo("fam_r");
        assertThat(s.secondFamily).isEqualTo("fam_i");
        assertThat(s.flat).isFalse();
        assertThat(s.maxFamily()).isCloseTo(83.333, within(0.01));
    }

    @Test
    void families_shapeIsFlatOnTie() {
        Fx fx = new Fx();
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) fx.add(k, 1, 1, 1, 0, 0, 0);
        assertThat(score(fx).flat).isTrue();
    }

    @Test
    void subDomains_useTheirOwnK() {
        Fx fx = new Fx();
        fx.add("fs_nd", 4, 4, 3, 2);            // Σ13 → (13−4)/12 = 75
        fx.add("fs_tp", 4, 4, 3, 3, 3, 2);      // Σ19 → (19−6)/18 = 72.2
        NavigatorProScores s = score(fx);
        assertThat(s.get("fs_nd")).isEqualTo(75.0);
        assertThat(s.get("fs_tp")).isCloseTo(72.222, within(0.01));
    }

    @Test
    void reasoning_countsCorrectChecksAndReportsEachChip() {
        Fx fx = new Fx();
        fx.add("chk_num", 1); fx.add("chk_dat", 1); fx.add("chk_cau", 1); fx.add("chk_src", 1); fx.add("chk_spr", 0);
        NavigatorProScores s = score(fx);
        assertThat(s.reasoning).isEqualTo(4);
        assertThat(s.checks.get("chk_spr")).isFalse();
        assertThat(s.checks.get("chk_num")).isTrue();
    }

    @Test
    void domains_ratingAndSkillIndex() {
        Fx fx = new Fx();
        int[] m = {5, 4, 4, 3, 3, 3, 3, 2, 3, 2, 3, 3}; // Σ38 → (38−12)/48 = 54.17
        int i = 0;
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) fx.add(k, m[i++]);
        NavigatorProScores s = score(fx);
        assertThat(s.get("d_sd")).isEqualTo(100.0);
        assertThat(s.get("d_da")).isEqualTo(75.0);
        assertThat(s.get("skill")).isCloseTo(54.167, within(0.01));
        assertThat(s.maxDomain()).isEqualTo(100.0);
    }

    @Test
    void incomplete_listsSkippedAndDuplicatedQuestions() {
        Fx fx = new Fx();
        fx.add("f_id", 4, 4, 4, 4);
        long skipped = 99L;
        fx.expected.get("f_id").add(skipped);                       // expected but never answered
        fx.rows.add(new Contribution("f_id", 1L, 4));               // question 1 answered twice
        NavigatorProScores s = score(fx);
        assertThat(s.incomplete).containsExactlyInAnyOrder("f_id:99:missing", "f_id:1:duplicate");
    }

    @Test
    void values_orderedByRankAndMissingBelowFour() {
        Fx fx = new Fx();
        fx.values.add(new ValueRank(3, "C"));
        fx.values.add(new ValueRank(1, "A"));
        fx.values.add(new ValueRank(4, "D"));
        fx.values.add(new ValueRank(2, "B"));
        NavigatorProScores s = score(fx);
        assertThat(s.values).containsExactly("A", "B", "C", "D");
        assertThat(s.valuesMissing).isFalse();

        Fx three = new Fx();
        three.values.add(new ValueRank(1, "A"));
        three.values.add(new ValueRank(2, "B"));
        three.values.add(new ValueRank(3, "C"));
        assertThat(score(three).valuesMissing).isTrue();
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProScorerTest -DfailIfNoTests=false test`
Expected: compilation FAILURE (`Contribution`, `ValueRank`, `NavigatorProScorer` not found).

- [x] **Step 3: Write the input rows and output holder**

`Contribution.java`:

```java
package com.kccitm.api.service.b2c.navigatorpro;

/** One answered question's score under one construct (reversal already applied in the stored score). */
public final class Contribution {
    public final String construct;
    public final long questionId;
    public final int score;

    public Contribution(String construct, long questionId, int score) {
        this.construct = construct;
        this.questionId = questionId;
        this.score = score;
    }
}
```

`ValueRank.java`:

```java
package com.kccitm.api.service.b2c.navigatorpro;

/** One ranked option of the Work Values question: rank 1 = most important. */
public final class ValueRank {
    public final int rank;
    public final String optionText;

    public ValueRank(int rank, String optionText) {
        this.rank = rank;
        this.optionText = optionText;
    }
}
```

`NavigatorProScores.java`:

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Scorer output. Indices are 0–100 doubles, rounded only at display time. */
public final class NavigatorProScores {

    /** f_id, f_st, f_ae, drive, foundation, skill, fs_*, d_*, fam_* → 0–100. */
    public final Map<String, Double> index = new LinkedHashMap<>();
    /** chk_* → correct. */
    public final Map<String, Boolean> checks = new LinkedHashMap<>();
    public int reasoning;

    public String topFamily;
    public String secondFamily;
    public boolean flat;

    public final List<String> values = new ArrayList<>();
    public boolean valuesMissing;

    /** Internal only — never placed in the placeholder map. */
    public int validityFlags;
    public boolean attentionPassed;

    /** "construct:questionId:missing" / "construct:questionId:duplicate". */
    public final List<String> incomplete = new ArrayList<>();

    public double get(String key) {
        return index.getOrDefault(key, 0.0);
    }

    public double maxFamily() {
        return NavigatorProConstructMap.FAMILY_KEYS.stream().mapToDouble(this::get).max().orElse(0.0);
    }

    public double maxDomain() {
        return NavigatorProConstructMap.DOMAIN_KEYS.stream().mapToDouble(this::get).max().orElse(0.0);
    }
}
```

- [x] **Step 4: Write the scorer**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap.Construct;

/**
 * Pure scoring: contribution rows → indices, families, checks, flags, incomplete
 * list. No I/O. Σ per construct is the plain sum of matched rows; the stored MQT
 * scores already carry any reversal.
 */
public final class NavigatorProScorer {

    /** A validity row scoring this or higher is one flag (scores are oriented high = suspicious). */
    public static final int VALIDITY_FLAG_SCORE = 4;

    private final NavigatorProConstructMap map;
    private final double flatGap;

    public NavigatorProScorer(NavigatorProConstructMap map, double flatGap) {
        this.map = map;
        this.flatGap = flatGap;
    }

    public NavigatorProScores score(List<Contribution> rows, List<ValueRank> values,
                                    Map<String, Set<Long>> expected) {
        NavigatorProScores s = new NavigatorProScores();

        Map<String, Integer> sum = new HashMap<>();
        Map<String, List<Integer>> perRow = new HashMap<>();
        Map<String, Map<Long, Integer>> countByQuestion = new HashMap<>();
        for (Contribution r : rows) {
            sum.merge(r.construct, r.score, Integer::sum);
            perRow.computeIfAbsent(r.construct, k -> new ArrayList<>()).add(r.score);
            countByQuestion.computeIfAbsent(r.construct, k -> new HashMap<>()).merge(r.questionId, 1, Integer::sum);
        }

        // Completeness: every expected question exactly once.
        for (Construct c : map.all()) {
            Map<Long, Integer> got = countByQuestion.getOrDefault(c.key, Map.of());
            for (Long q : new TreeMap<>(toMap(expected.getOrDefault(c.key, Set.of()))).keySet()) {
                int n = got.getOrDefault(q, 0);
                if (n == 0) s.incomplete.add(c.key + ":" + q + ":missing");
                else if (n > 1) s.incomplete.add(c.key + ":" + q + ":duplicate");
            }
        }

        // Factors and drive: floor = questions × 1, range = questions × 4.
        int factorSum = 0;
        int factorQuestions = 0;
        for (String k : NavigatorProConstructMap.FACTOR_KEYS) {
            Construct c = map.get(k);
            s.index.put(k, scale(sum.getOrDefault(k, 0), c.questions, c.questions * 4));
            factorSum += sum.getOrDefault(k, 0);
            factorQuestions += c.questions;
        }
        s.index.put("drive", scale(factorSum, factorQuestions, factorQuestions * 4));

        // Foundation sub-domains: (Σ − k)/(3k); foundation over all 22.
        int subSum = 0;
        int subQuestions = 0;
        for (String k : NavigatorProConstructMap.SUB_KEYS) {
            Construct c = map.get(k);
            s.index.put(k, scale(sum.getOrDefault(k, 0), c.questions, c.questions * 3));
            subSum += sum.getOrDefault(k, 0);
            subQuestions += c.questions;
        }
        s.index.put("foundation", scale(subSum, subQuestions, subQuestions * 3));

        // Reasoning checks: the single row is correct when it scores 1.
        int correct = 0;
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            List<Integer> r = perRow.getOrDefault(k, List.of());
            boolean ok = r.size() == 1 && r.get(0) == 1;
            s.checks.put(k, ok);
            if (ok) correct++;
        }
        s.reasoning = correct;

        // Specialized domains: (m − 1)/4; skill over all 12.
        int domSum = 0;
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) {
            s.index.put(k, scale(sum.getOrDefault(k, 0), 1, 4));
            domSum += sum.getOrDefault(k, 0);
        }
        int domains = NavigatorProConstructMap.DOMAIN_KEYS.size();
        s.index.put("skill", scale(domSum, domains, domains * 4));

        // Families: Yes-count / questions × 100.
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) {
            Construct c = map.get(k);
            s.index.put(k, sum.getOrDefault(k, 0) * 100.0 / c.questions);
        }
        List<String> ranked = new ArrayList<>(NavigatorProConstructMap.FAMILY_KEYS);
        ranked.sort(Comparator.comparingDouble((String k) -> s.get(k)).reversed());
        s.topFamily = ranked.get(0);
        s.secondFamily = ranked.get(1);
        s.flat = (s.get(s.topFamily) - s.get(s.secondFamily)) < flatGap;

        // Values: rank order 1..4.
        List<ValueRank> sorted = new ArrayList<>(values);
        sorted.sort(Comparator.comparingInt(v -> v.rank));
        for (ValueRank v : sorted) {
            if (v.rank >= 1 && v.rank <= 4 && s.values.size() < 4) s.values.add(v.optionText);
        }
        s.valuesMissing = s.values.size() < 4;

        // Validity and attention.
        s.validityFlags = (int) perRow.getOrDefault(NavigatorProConstructMap.VALIDITY, List.of())
                .stream().filter(v -> v >= VALIDITY_FLAG_SCORE).count();
        List<Integer> att = perRow.getOrDefault(NavigatorProConstructMap.ATTENTION, List.of());
        s.attentionPassed = att.size() == 1 && att.get(0) == 1;

        return s;
    }

    private static double scale(int sum, int floor, int range) {
        return range == 0 ? 0.0 : (sum - floor) * 100.0 / range;
    }

    private static Map<Long, Boolean> toMap(Set<Long> ids) {
        Map<Long, Boolean> m = new HashMap<>();
        for (Long id : ids) m.put(id, Boolean.TRUE);
        return m;
    }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProScorerTest -DfailIfNoTests=false test`
Expected: PASS (12 tests).

- [x] **Step 6: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/Contribution.java \
  spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/ValueRank.java \
  spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProScores.java \
  spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProScorer.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProScorerTest.java
git commit -m "navpro: pure scorer with golden fixtures (sums of MQT scores, gates inputs)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Cohort norms, bands, RAG, zone

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProNorms.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProNormsTest.java`

**Interfaces:**
- Produces: `NavigatorProNorms.Member(long userStudentId, Map<String, Double> metrics)`; `NavigatorProNorms.METRICS` = `drive, f_id, f_st, f_ae, foundation, skill, reasoning`; `static NormSet build(List<Member>, int percentileMinN, int normsMinN)`; `NormSet` fields `n, prec, percentilesSuppressed, provisional, driveCut, skillCut` and `Double percentile(String metric, double x)` (null when suppressed); statics `percentileRank(double[] sorted, double x)`, `median(double[] sorted)`, `band(double p)`, `ragBand(double raw)`, `ragColour(double raw)`, `zone(double drive, double skill, double driveCut, double skillCut)`, `precision(int n)`.

- [x] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NavigatorProNormsTest {

    private static NavigatorProNorms.Member member(long id, double drive, double skill) {
        return new NavigatorProNorms.Member(id, Map.of(
                "drive", drive, "f_id", drive, "f_st", drive, "f_ae", drive,
                "foundation", skill, "skill", skill, "reasoning", 3.0));
    }

    private static List<NavigatorProNorms.Member> cohort(int n) {
        List<NavigatorProNorms.Member> m = new ArrayList<>();
        for (int i = 0; i < n; i++) m.add(member(i, 10 + i, 90 - i));
        return m;
    }

    @Test
    void percentileRank_usesMidrankOnTies() {
        double[] sorted = {10, 20, 20, 30};
        assertThat(NavigatorProNorms.percentileRank(sorted, 20)).isEqualTo(50.0);
        assertThat(NavigatorProNorms.percentileRank(sorted, 30)).isEqualTo(87.5);
        assertThat(NavigatorProNorms.percentileRank(sorted, 5)).isZero();
        assertThat(NavigatorProNorms.percentileRank(sorted, 40)).isEqualTo(100.0);
    }

    @Test
    void band_isDecidedOnTheUnroundedPercentile() {
        assertThat(NavigatorProNorms.band(74.9)).isEqualTo("Developing");
        assertThat(NavigatorProNorms.band(75.0)).isEqualTo("Strong");
        assertThat(NavigatorProNorms.band(24.99)).isEqualTo("Early");
        assertThat(NavigatorProNorms.band(25.0)).isEqualTo("Developing");
    }

    @Test
    void rag_usesRawThresholds() {
        assertThat(NavigatorProNorms.ragBand(67)).isEqualTo("Strong");
        assertThat(NavigatorProNorms.ragColour(67)).isEqualTo("green");
        assertThat(NavigatorProNorms.ragBand(66.4)).isEqualTo("Developing");
        assertThat(NavigatorProNorms.ragColour(34)).isEqualTo("amber");
        assertThat(NavigatorProNorms.ragBand(33.9)).isEqualTo("Early");
        assertThat(NavigatorProNorms.ragColour(0)).isEqualTo("red");
    }

    @Test
    void precision_isRoundedHundredOverRootN() {
        assertThat(NavigatorProNorms.precision(84)).isEqualTo(11);
        assertThat(NavigatorProNorms.precision(100)).isEqualTo(10);
        assertThat(NavigatorProNorms.precision(0)).isZero();
    }

    @Test
    void median_ofEvenCountIsMeanOfMiddleTwo() {
        assertThat(NavigatorProNorms.median(new double[]{1, 2, 3, 4})).isEqualTo(2.5);
        assertThat(NavigatorProNorms.median(new double[]{1, 2, 3})).isEqualTo(2.0);
    }

    @Test
    void zone_treatsTheCutAsAbove() {
        assertThat(NavigatorProNorms.zone(50, 50, 50, 50)).isEqualTo("Ready to accelerate");
        assertThat(NavigatorProNorms.zone(60, 40, 50, 50)).isEqualTo("Driven, still building");
        assertThat(NavigatorProNorms.zone(40, 60, 50, 50)).isEqualTo("Skilled, needs a spark");
        assertThat(NavigatorProNorms.zone(40, 40, 50, 50)).isEqualTo("Starting the journey");
    }

    @Test
    void below30_percentilesSuppressedAndProvisionalCuts() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(cohort(29), 30, 60);
        assertThat(n.n).isEqualTo(29);
        assertThat(n.percentilesSuppressed).isTrue();
        assertThat(n.provisional).isTrue();
        assertThat(n.driveCut).isEqualTo(50.0);
        assertThat(n.skillCut).isEqualTo(50.0);
        assertThat(n.percentile("drive", 20)).isNull();
    }

    @Test
    void between30And59_percentilesOnButCutsProvisional() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(cohort(59), 30, 60);
        assertThat(n.percentilesSuppressed).isFalse();
        assertThat(n.provisional).isTrue();
        assertThat(n.driveCut).isEqualTo(50.0);
        assertThat(n.percentile("drive", 10)).isCloseTo(100.0 * 0.5 / 59, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void atLeast60_cutsAreCohortMedians() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(cohort(60), 30, 60);
        assertThat(n.provisional).isFalse();
        assertThat(n.driveCut).isEqualTo(39.5);   // drives 10..69 → median (39+40)/2
        assertThat(n.skillCut).isEqualTo(60.5);   // skills 90..31 → median (60+61)/2
        assertThat(n.prec).isEqualTo(13);          // round(100/√60)
    }

    @Test
    void emptyCohort_isSafe() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(List.of(), 30, 60);
        assertThat(n.n).isZero();
        assertThat(n.percentilesSuppressed).isTrue();
        assertThat(n.percentile("skill", 1)).isNull();
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProNormsTest -DfailIfNoTests=false test`
Expected: compilation FAILURE (`NavigatorProNorms` not found).

- [x] **Step 3: Write the implementation**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Cohort maths for one assessment: empirical percentile rank (midrank on ties),
 * medians as quadrant cuts, n-gates, precision, bands. Pure and static; the
 * calculation service owns caching.
 */
public final class NavigatorProNorms {

    public static final List<String> METRICS =
            List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning");

    public static final String ZONE_READY    = "Ready to accelerate";
    public static final String ZONE_DRIVEN   = "Driven, still building";
    public static final String ZONE_SKILLED  = "Skilled, needs a spark";
    public static final String ZONE_STARTING = "Starting the journey";

    private NavigatorProNorms() {}

    public static final class Member {
        public final long userStudentId;
        public final Map<String, Double> metrics;

        public Member(long userStudentId, Map<String, Double> metrics) {
            this.userStudentId = userStudentId;
            this.metrics = Map.copyOf(metrics);
        }
    }

    public static final class NormSet {
        public final int n;
        public final int prec;
        public final boolean percentilesSuppressed;
        public final boolean provisional;
        public final double driveCut;
        public final double skillCut;
        private final Map<String, double[]> sorted;

        NormSet(int n, int prec, boolean percentilesSuppressed, boolean provisional,
                double driveCut, double skillCut, Map<String, double[]> sorted) {
            this.n = n; this.prec = prec; this.percentilesSuppressed = percentilesSuppressed;
            this.provisional = provisional; this.driveCut = driveCut; this.skillCut = skillCut;
            this.sorted = sorted;
        }

        /** Percentile of {@code x} for {@code metric}, or null while percentiles are suppressed. */
        public Double percentile(String metric, double x) {
            if (percentilesSuppressed) return null;
            double[] v = sorted.get(metric);
            if (v == null || v.length == 0) return null;
            return percentileRank(v, x);
        }
    }

    public static NormSet build(List<Member> members, int percentileMinN, int normsMinN) {
        int n = members.size();
        Map<String, double[]> sorted = new HashMap<>();
        for (String metric : METRICS) {
            double[] v = new double[n];
            for (int i = 0; i < n; i++) v[i] = members.get(i).metrics.getOrDefault(metric, 0.0);
            Arrays.sort(v);
            sorted.put(metric, v);
        }
        boolean suppressed = n < percentileMinN;
        boolean provisional = n < normsMinN;
        double driveCut = provisional ? 50.0 : median(sorted.get("drive"));
        double skillCut = provisional ? 50.0 : median(sorted.get("skill"));
        return new NormSet(n, precision(n), suppressed, provisional, driveCut, skillCut, sorted);
    }

    /** Midrank percentile: 100 × (below + 0.5 × equal) / n. */
    public static double percentileRank(double[] sorted, double x) {
        if (sorted.length == 0) return 0.0;
        int below = 0, equal = 0;
        for (double v : sorted) {
            if (v < x) below++;
            else if (v == x) equal++;
        }
        return 100.0 * (below + 0.5 * equal) / sorted.length;
    }

    public static double median(double[] sorted) {
        int n = sorted.length;
        if (n == 0) return 0.0;
        return n % 2 == 1 ? sorted[n / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
    }

    public static int precision(int n) {
        return n <= 0 ? 0 : (int) Math.round(100.0 / Math.sqrt(n));
    }

    /** Percentile-only band on the UNROUNDED percentile. */
    public static String band(double percentile) {
        if (percentile >= 75.0) return "Strong";
        if (percentile >= 25.0) return "Developing";
        return "Early";
    }

    /** Raw-threshold band for the foundation sub-domain bars. */
    public static String ragBand(double raw) {
        if (raw >= 67.0) return "Strong";
        if (raw >= 34.0) return "Developing";
        return "Early";
    }

    public static String ragColour(double raw) {
        if (raw >= 67.0) return "green";
        if (raw >= 34.0) return "amber";
        return "red";
    }

    /** "At the cut" counts as above. */
    public static String zone(double drive, double skill, double driveCut, double skillCut) {
        boolean d = drive >= driveCut;
        boolean s = skill >= skillCut;
        if (d && s) return ZONE_READY;
        if (d) return ZONE_DRIVEN;
        if (s) return ZONE_SKILLED;
        return ZONE_STARTING;
    }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProNormsTest -DfailIfNoTests=false test`
Expected: PASS (10 tests).

- [x] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProNorms.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProNormsTest.java
git commit -m "navpro: cohort norms — midrank percentiles, n-gates, bands, RAG, zone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Content (verbatim copy)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProContent.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProContentTest.java`

**Interfaces:**
- Produces: static `bandParagraph(String indexKey, String band)` for index keys `drive, f_id, f_st, f_ae, foundation, skill, reasoning` and bands `Strong/Developing/Early`; `factorDefinition(String factorKey)`; `zoneCopy(String zone)`; `firstStep(String subKey)`; `Optional<ValueRow> value(String optionText)` with `ValueRow.icon/title/why`; `String banner()`; `precisionLine(int prec, int n)`; `factorCallout(String topLabel, int topP, String bottomLabel, int bottomP, int prec)`; `howToRead(String firstName)`; constants `COVER_CAPTION, COVER_FOOTER_TEMPLATE, ABOUT_CAREER9, ABOUT_REPORT, SECTOR_CAVEAT, RING_DRIVE, RING_FOUNDATION, RING_SKILL, RING_REASONING`.

- [x] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NavigatorProContentTest {

    @Test
    void everyIndexHasThreeBandParagraphs() {
        for (String key : List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning")) {
            for (String band : List.of("Strong", "Developing", "Early")) {
                assertThat(NavigatorProContent.bandParagraph(key, band))
                        .as(key + "/" + band).isNotBlank();
            }
        }
        assertThat(NavigatorProContent.bandParagraph("drive", "")).isEmpty();
        assertThat(NavigatorProContent.bandParagraph("nope", "Strong")).isEmpty();
    }

    @Test
    void bandParagraphsNeverUseForbiddenWords() {
        for (String key : List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning")) {
            for (String band : List.of("Strong", "Developing", "Early")) {
                String t = NavigatorProContent.bandParagraph(key, band).toLowerCase();
                assertThat(t).doesNotContain(" poor", " weak ", "below average", "least motivated", "fail");
            }
        }
    }

    @Test
    void valuesLookupJoinsOnExactOptionText() {
        NavigatorProContent.ValueRow v = NavigatorProContent.value("Good pay and benefits").orElseThrow();
        assertThat(v.icon).isEqualTo("💰");
        assertThat(v.title).isEqualTo("Good pay and benefits");
        assertThat(v.why).startsWith("Honest and practical");
        assertThat(NavigatorProContent.value("  Good pay and benefits ")).isPresent();
        assertThat(NavigatorProContent.value("good pay and benefits")).isEmpty();
        assertThat(NavigatorProContent.value(null)).isEmpty();
        assertThat(NavigatorProContent.VALUE_TEXTS).hasSize(12);
    }

    @Test
    void bannerAndDefinitionsAndStatics() {
        assertThat(NavigatorProContent.banner()).contains("THIS REPORT MAY BE BIASED").contains("#c0392b");
        assertThat(NavigatorProContent.factorDefinition("f_st")).startsWith("your staying power");
        assertThat(NavigatorProContent.zoneCopy("Ready to accelerate")).isNotBlank();
        assertThat(NavigatorProContent.zoneCopy("Starting the journey")).isEmpty();
        assertThat(NavigatorProContent.firstStep("fs_gd")).isNotBlank();
        assertThat(NavigatorProContent.firstStep("fs_nd")).isEmpty();
        assertThat(NavigatorProContent.precisionLine(11, 84)).isEqualTo(
                "Percentiles carry about ±11 in a batch of 84 — read levels, not points.");
        assertThat(NavigatorProContent.factorCallout("Adaptive Execution", 86, "Sustained Tenacity", 78, 11))
                .contains("Adaptive Execution (P86)").contains("Sustained Tenacity (P78)").contains("±11");
        assertThat(NavigatorProContent.howToRead("Priya")).startsWith("How to read this report, Priya:");
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProContentTest -DfailIfNoTests=false test`
Expected: compilation FAILURE (`NavigatorProContent` not found).

- [x] **Step 3: Write the content class**

Texts are verbatim from `Report_Content_Logic.xlsx` (sheets 2, 3, 4, 6) and the sample report. Texts the workbook references but does not contain are empty strings on purpose (see spec §14).

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Verbatim student-facing copy for the Navigator Pro report. Pure lookups, no I/O. */
public final class NavigatorProContent {

    private NavigatorProContent() {}

    public static final class ValueRow {
        public final String icon;
        public final String title;
        public final String why;

        ValueRow(String icon, String title, String why) {
            this.icon = icon; this.title = title; this.why = why;
        }
    }

    // ── Static blocks (content sheet 2) ───────────────────────────────────────
    public static final String COVER_CAPTION =
            "Your three drive factors, drawn as your own constellation — no two students share this shape.";
    /** Use with String.format(COVER_FOOTER_TEMPLATE, firstName). */
    public static final String COVER_FOOTER_TEMPLATE =
            "A mirror and a map, not a verdict — re-measured every semester. Confidential: for %s and authorised mentors. Career-9 · career-9.com";
    public static final String RING_DRIVE      = "11 behaviours, 3 factors";
    public static final String RING_FOUNDATION = "22 everyday habits";
    public static final String RING_SKILL      = "self-rated, 12 domains";
    public static final String RING_REASONING  = "5 objective checks";
    public static final String ABOUT_CAREER9 =
            "Career-9 builds career intelligence for Indian institutions. Navigator Pro treats career development as a measured, semester-by-semester journey — validated psychometrics plus India-specific career mapping, so you act on evidence instead of guesswork.";
    public static final String ABOUT_REPORT =
            "A guidance report reflecting your current psychometric profile — drive, interests, foundation skills and work values. A strategic compass for specialisation and early-career choices; final decisions should also weigh market trends, finances and personal circumstances.";
    public static final String SECTOR_CAVEAT =
            "Computed from your domain fits — bioengineering, for example, blends process, electronics, data and quality. Indicative; explore in the Career Library and with your counsellor.";

    public static String howToRead(String firstName) {
        return "How to read this report, " + firstName + ": scores describe behaviour, and behaviour moves — the next reading measures what changed. "
                + "* Specialisation and emerging-sector mappings are being validated with industry practitioners; treat direction outputs as doors to explore with your counsellor. "
                + "Counselling is part of this programme, not an add-on.";
    }

    public static String precisionLine(int prec, int n) {
        return "Percentiles carry about ±" + prec + " in a batch of " + n + " — read levels, not points.";
    }

    // ── Factor definitions (content sheet 2, page 3) ──────────────────────────
    private static final Map<String, String> FACTOR_DEFINITIONS = Map.of(
            "f_id", "how strongly you start from within, without being pushed.",
            "f_st", "your staying power when work gets long or boring.",
            "f_ae", "how you adjust and still finish when things change.");

    public static String factorDefinition(String factorKey) {
        return FACTOR_DEFINITIONS.getOrDefault(factorKey, "");
    }

    /** Content sheet 3, "Factor callout". */
    public static String factorCallout(String topLabel, int topP, String bottomLabel, int bottomP, int prec) {
        return "Reading your drive: build plans around " + topLabel + " (P" + topP + ") — it works without willpower. "
                + "Your lowest, " + bottomLabel + " (P" + bottomP + "), moves fastest with one small scheduled rep a week. "
                + "Percentiles carry ±" + prec + " — read levels, not points.";
    }

    // ── Band paragraphs (content sheet 6) ─────────────────────────────────────
    private static final Map<String, String> BANDS = new LinkedHashMap<>();
    static {
        BANDS.put("drive|Strong", "Your drive sits in the top quarter of your batch — starting, persisting and adapting are already habits. Aim it: pick one goal per semester big enough to deserve this engine.");
        BANDS.put("drive|Developing", "Your drive is in the batch mainstream — it shows up, and it grows fastest with structure: fixed weekly slots for self-chosen work beat waiting for motivation.");
        BANDS.put("drive|Early", "Your drive behaviours are still warming up compared with your batch — normal at first year, and the most movable number in this report. One tiny self-started task a week is how it moves.");
        BANDS.put("f_id|Strong", "You start from within — you rarely need a push. Protect this by choosing work you can begin without permission.");
        BANDS.put("f_id|Developing", "You start when the path is clear. Reduce friction: decide the night before what tomorrow's first task is.");
        BANDS.put("f_id|Early", "Starting is currently the hard part. Shrink the start: two-minute versions of tasks, begun daily, rebuild this fastest.");
        BANDS.put("f_st|Strong", "Your staying power is a top-quarter asset — long or boring stretches don't shake you off. Choose at least one long project; you're built for compound payoffs.");
        BANDS.put("f_st|Developing", "You persist when progress is visible. Make it visible on purpose — a simple done-list per week keeps you in the game.");
        BANDS.put("f_st|Early", "Energy fades before the finish right now. Shorter scopes, public checkpoints, one thing finished before the next begins.");
        BANDS.put("f_ae|Strong", "When plans change you adjust and still deliver — the rarest of the three factors. Volunteer where requirements shift; you shine there.");
        BANDS.put("f_ae|Developing", "You handle change with some cost. Practise the reset: when plans break, write the new plan in five lines before feelings vote.");
        BANDS.put("f_ae|Early", "Changes currently knock work off course. Build the habit of Plan B thinking: for each task, note one thing that could change and what you'd do.");
        BANDS.put("foundation|Strong", "Your everyday work habits lead the batch — things get logged, calculated, finished. This is the multiplier on everything else you build.");
        BANDS.put("foundation|Developing", "Your habits are batch-typical. Pick ONE of the five areas and make it weekly — habits move one at a time, not five at once.");
        BANDS.put("foundation|Early", "The habit layer is thin so far — which is why it's the first thing your plan targets. Eight honest weeks on one area moves a band.");
        BANDS.put("skill|Strong", "You've already touched more career skills than three-quarters of your batch. Convert exposure into receipts: builds, certificates, repos.");
        BANDS.put("skill|Developing", "Typical first-year exposure. Your top-rated domain is the cheapest place to go deep first.");
        BANDS.put("skill|Early", "Low exposure so far — expected at entry, and the easiest gap to close: one workshop or small build changes this number fast.");
        BANDS.put("reasoning|Strong", "Your objective checks lead the batch — you compute, read data and judge sources better than most. Trust it, and lend it: explaining to others locks it in.");
        BANDS.put("reasoning|Developing", "Most checks landed. Review the one(s) that didn't — each ✘ names an exact, learnable skill.");
        BANDS.put("reasoning|Early", "Several checks missed — each one is a specific, teachable skill, not a talent verdict. The ladder in your plan starts precisely there.");
    }

    public static String bandParagraph(String indexKey, String band) {
        return BANDS.getOrDefault(indexKey + "|" + band, "");
    }

    // ── Zone copy: only "Ready to accelerate" is available (sample report); the
    // other three are go-live inputs and render empty until supplied. ────────
    private static final Map<String, String> ZONE_COPY = Map.of(
            NavigatorProNorms.ZONE_READY,
            "High drive meets real skill. Push now — competitions, internships, certifications; this zone converts effort into outcomes fastest.");

    public static String zoneCopy(String zone) {
        return ZONE_COPY.getOrDefault(zone, "");
    }

    // ── Lowest-bar first step: only "Getting things done" is available (sample). ─
    private static final Map<String, String> FIRST_STEP = Map.of(
            "fs_gd", "one small real task in it weekly — logged, not heroic. Eight weeks moves a band.");

    public static String firstStep(String subKey) {
        return FIRST_STEP.getOrDefault(subKey, "");
    }

    // ── Response-quality banner (content sheet 3) ─────────────────────────────
    public static String banner() {
        return "<div class=\"response-quality-banner\" style=\"background:#c0392b;color:#ffffff;font-weight:700;"
                + "padding:12px 16px;width:100%;box-sizing:border-box;\">"
                + "⚠ THIS REPORT MAY BE BIASED — READ WITH CARE. Your answers on the built-in check questions suggest "
                + "this reading may not fully reflect your typical behaviour. Every direction in this report is provisional, "
                + "and reviewing it with your counsellor is required before acting on any of it.</div>";
    }

    // ── Values lookup (content sheet 4), joined on exact option text ──────────
    public static final List<String> VALUE_TEXTS = List.of(
            "Work that keeps me curious and interested",
            "Work where I keep learning new things",
            "Freedom to decide how I do my work",
            "A steady job I can count on for years",
            "Clear expectations and a predictable routine",
            "Good pay and benefits",
            "Being recognised as good at what I do",
            "Work that my family and community respect",
            "Moving up to positions of greater responsibility",
            "Having influence over decisions that matter",
            "Work that serves something bigger than myself",
            "Work that makes life better for other people");

    private static final Map<String, ValueRow> VALUES = new LinkedHashMap<>();
    static {
        VALUES.put(VALUE_TEXTS.get(0),  new ValueRow("🔍", "Curious, interesting work", "People who choose interest over comfort learn faster and burn out less — interest is renewable fuel."));
        VALUES.put(VALUE_TEXTS.get(1),  new ValueRow("📚", "Keep learning new things", "Careers now reward learning speed over degrees — this value predicts thriving in changing fields."));
        VALUES.put(VALUE_TEXTS.get(2),  new ValueRow("🕊️", "Freedom in how you work", "Autonomy-driven people do their best work with room to choose methods — and chafe under micromanagement."));
        VALUES.put(VALUE_TEXTS.get(3),  new ValueRow("🛡️", "A steady, dependable job", "Stability lets you build long-term skills and plans without churn anxiety."));
        VALUES.put(VALUE_TEXTS.get(4),  new ValueRow("🧭", "Clear expectations, clear routine", "Structure-seekers excel where consistency is the product — operations, QA, compliance."));
        VALUES.put(VALUE_TEXTS.get(5),  new ValueRow("💰", "Good pay and benefits", "Honest and practical — pair it with a growth value so comfort never becomes golden handcuffs."));
        VALUES.put(VALUE_TEXTS.get(6),  new ValueRow("🏅", "Recognition for your skill", "Being seen drives mastery — choose environments that celebrate craft publicly."));
        VALUES.put(VALUE_TEXTS.get(7),  new ValueRow("🏠", "Family and community respect", "This value carries real weight in India — visible standing sustains motivation."));
        VALUES.put(VALUE_TEXTS.get(8),  new ValueRow("📈", "Moving up, taking charge", "Advancement-driven people need ladders — growing organisations feed them."));
        VALUES.put(VALUE_TEXTS.get(9),  new ValueRow("🎯", "Influence over decisions", "Agency-seekers should head toward ownership early — product, projects, entrepreneurship."));
        VALUES.put(VALUE_TEXTS.get(10), new ValueRow("🌉", "Serving something bigger", "Purpose beyond self is the most durable motivator on hard days."));
        VALUES.put(VALUE_TEXTS.get(11), new ValueRow("🤝", "Making life better for others", "Impact-driven engineers thrive where the user is visible."));
    }

    /** Exact (trimmed, whitespace-collapsed, case-sensitive) join on the option text. */
    public static Optional<ValueRow> value(String optionText) {
        if (optionText == null) return Optional.empty();
        return Optional.ofNullable(VALUES.get(optionText.trim().replaceAll("\\s+", " ")));
    }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProContentTest -DfailIfNoTests=false test`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProContent.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProContentTest.java
git commit -m "navpro: verbatim report copy (bands, values, banner, definitions)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Questionnaire index (schema check) and test fixtures

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProQuestionnaireIndex.java`
- Create (test helper): `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProFixtures.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProQuestionnaireIndexTest.java`

**Interfaces:**
- Consumes: `NavigatorProConstructMap` (Task 1); JPA entities `QuestionnaireQuestion` (`getQuestionnaireQuestionId()`, `getQuestion()`), `AssessmentQuestions` (`getQuestionType()`, `getOptions()`), `AssessmentQuestionOptions` (`getOptionId()`, `getOptionText()`, `getOptionScores()`), `OptionScoreBasedOnMEasuredQualityTypes` (`getScore()`, `getMeasuredQualityType()`), `MeasuredQualityTypes` (`getMeasuredQualityTypeName()`).
- Produces: `static NavigatorProQuestionnaireIndex build(NavigatorProConstructMap map, long questionnaireId, List<QuestionnaireQuestion> questions, Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId)` with public final `questionnaireId`, `Map<Long,String> constructByQuestion` (questionnaireQuestionId → construct key), `Map<String,Set<Long>> questionsByConstruct`, `Long rankingQuestionId`, `List<String> problems`, `boolean valid()`.
- Produces (tests): `NavigatorProFixtures.validQuestionnaire()` with fields `map, questions, scoresByOptionId, byConstruct, ranking`, methods `scoresFor(List<Long> optionIds)`, `answer(UserStudent, QuestionnaireQuestion, int optionIndex)`, `rankingAnswers(UserStudent, int... optionIndexes)`, `completeAnswers(UserStudent, int agreeIdx, int freqIdx, int mcqIdx, int intensityIdx, int yesIdx, int validityIdx, int attentionIdx, int... valueIdx)`.

- [x] **Step 1: Write the fixtures helper**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap.Construct;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** In-memory Navigator Pro questionnaire on the September bank shape, built from the construct map. */
public final class NavigatorProFixtures {

    public final NavigatorProConstructMap map = new NavigatorProConstructMap();
    public final List<QuestionnaireQuestion> questions = new ArrayList<>();
    public final Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId = new HashMap<>();
    public final Map<String, List<QuestionnaireQuestion>> byConstruct = new LinkedHashMap<>();
    public QuestionnaireQuestion ranking;

    private long nextQuestion = 100;
    private long nextOption = 1000;

    public static NavigatorProFixtures validQuestionnaire() {
        NavigatorProFixtures f = new NavigatorProFixtures();
        for (Construct c : f.map.all()) {
            for (int i = 0; i < c.questions; i++) {
                f.byConstruct.computeIfAbsent(c.key, k -> new ArrayList<>())
                        .add(f.question(c.mqts.get(0), scaleFor(c)));
            }
        }
        f.ranking = f.rankingQuestion();
        return f;
    }

    /** Stored option scores in option order, per construct scale. */
    static int[] scaleFor(Construct c) {
        if (c.key.equals(NavigatorProConstructMap.ATTENTION)) return new int[]{0, 1};      // Yes / No
        if (c.key.startsWith("chk_")) return new int[]{1, 0, 0, 0};                       // key first
        if (c.key.startsWith("fam_")) return new int[]{1, 0};                             // Yes / No
        if (c.max == 4) return new int[]{1, 2, 3, 4};                                     // Never … Regularly
        return new int[]{1, 2, 3, 4, 5};                                                  // agreement / intensity
    }

    /** One single-choice question whose options score {@code scores} under {@code mqtName}. */
    public QuestionnaireQuestion question(String mqtName, int[] scores) {
        AssessmentQuestions q = new AssessmentQuestions();
        q.setQuestionId(nextQuestion);
        q.setQuestionType("single-choice");
        q.setQuestionText("q" + nextQuestion);
        MeasuredQualityTypes mqt = new MeasuredQualityTypes();
        mqt.setMeasuredQualityTypeName(mqtName);
        List<AssessmentQuestionOptions> opts = new ArrayList<>();
        for (int i = 0; i < scores.length; i++) {
            AssessmentQuestionOptions o = new AssessmentQuestionOptions();
            o.setOptionId(nextOption++);
            o.setOptionText("opt" + i);
            o.setQuestion(q);
            OptionScoreBasedOnMEasuredQualityTypes s = new OptionScoreBasedOnMEasuredQualityTypes();
            s.setScore(scores[i]);
            s.setMeasuredQualityType(mqt);
            s.setQuestion_option(o);
            o.setOptionScores(new ArrayList<>(List.of(s)));
            scoresByOptionId.put(o.getOptionId(), new ArrayList<>(List.of(s)));
            opts.add(o);
        }
        q.setOptions(opts);
        QuestionnaireQuestion qq = new QuestionnaireQuestion();
        qq.setQuestionnaireQuestionId(10_000 + nextQuestion);
        qq.setQuestion(q);
        nextQuestion++;
        questions.add(qq);
        return qq;
    }

    private QuestionnaireQuestion rankingQuestion() {
        AssessmentQuestions q = new AssessmentQuestions();
        q.setQuestionId(nextQuestion);
        q.setQuestionType("ranking");
        q.setQuestionText("Choose the four that matter most");
        List<AssessmentQuestionOptions> opts = new ArrayList<>();
        for (String text : NavigatorProContent.VALUE_TEXTS) {
            AssessmentQuestionOptions o = new AssessmentQuestionOptions();
            o.setOptionId(nextOption++);
            o.setOptionText(text);
            o.setQuestion(q);
            o.setOptionScores(new ArrayList<>());
            opts.add(o);
        }
        q.setOptions(opts);
        QuestionnaireQuestion qq = new QuestionnaireQuestion();
        qq.setQuestionnaireQuestionId(10_000 + nextQuestion);
        qq.setQuestion(q);
        nextQuestion++;
        questions.add(qq);
        return qq;
    }

    /** What OptionScoreBasedOnMeasuredQualityTypesRepository.findByOptionIdIn would return. */
    public List<OptionScoreBasedOnMEasuredQualityTypes> scoresFor(List<Long> optionIds) {
        List<OptionScoreBasedOnMEasuredQualityTypes> out = new ArrayList<>();
        for (Long id : optionIds) out.addAll(scoresByOptionId.getOrDefault(id, List.of()));
        return out;
    }

    public AssessmentAnswer answer(UserStudent us, QuestionnaireQuestion qq, int optionIndex) {
        AssessmentAnswer a = new AssessmentAnswer();
        a.setUserStudent(us);
        a.setQuestionnaireQuestion(qq);
        a.setOption(qq.getQuestion().getOptions().get(optionIndex));
        return a;
    }

    /** Ranking rows: first index = rank 1. */
    public List<AssessmentAnswer> rankingAnswers(UserStudent us, int... optionIndexes) {
        List<AssessmentAnswer> out = new ArrayList<>();
        for (int i = 0; i < optionIndexes.length; i++) {
            AssessmentAnswer a = answer(us, ranking, optionIndexes[i]);
            a.setRankOrder(i + 1);
            out.add(a);
        }
        return out;
    }

    /** Every scored question answered once, by construct family, plus the ranking rows. */
    public List<AssessmentAnswer> completeAnswers(UserStudent us, int agreeIdx, int freqIdx, int mcqIdx,
                                                  int intensityIdx, int yesIdx, int validityIdx,
                                                  int attentionIdx, int... valueIdx) {
        List<AssessmentAnswer> out = new ArrayList<>();
        for (Map.Entry<String, List<QuestionnaireQuestion>> e : byConstruct.entrySet()) {
            String k = e.getKey();
            int idx;
            if (k.equals(NavigatorProConstructMap.VALIDITY)) idx = validityIdx;
            else if (k.equals(NavigatorProConstructMap.ATTENTION)) idx = attentionIdx;
            else if (k.startsWith("f_")) idx = agreeIdx;
            else if (k.startsWith("fam_")) idx = yesIdx;
            else if (k.startsWith("fs_")) idx = freqIdx;
            else if (k.startsWith("chk_")) idx = mcqIdx;
            else idx = intensityIdx;
            for (QuestionnaireQuestion qq : e.getValue()) out.add(answer(us, qq, idx));
        }
        out.addAll(rankingAnswers(us, valueIdx));
        return out;
    }
}
```

- [x] **Step 2: Write the failing test**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NavigatorProQuestionnaireIndexTest {

    private NavigatorProQuestionnaireIndex build(NavigatorProFixtures fx) {
        return NavigatorProQuestionnaireIndex.build(fx.map, 20L, fx.questions, fx.scoresByOptionId);
    }

    @Test
    void validQuestionnaire_indexesEveryConstruct() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).isEmpty();
        assertThat(ix.valid()).isTrue();
        assertThat(ix.questionsByConstruct.get("fs_tp")).hasSize(6);
        assertThat(ix.questionsByConstruct.get("d_pe")).hasSize(1);
        assertThat(ix.constructByQuestion).hasSize(90);
        assertThat(ix.rankingQuestionId).isEqualTo(fx.ranking.getQuestionnaireQuestionId());
    }

    @Test
    void missingQuestion_isReportedWithLabelAndExpectedCount() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        fx.questions.remove(fx.byConstruct.get("chk_spr").get(0));
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.valid()).isFalse();
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("Spreadsheet logic").contains("0 question(s) scored, expected 1"));
    }

    @Test
    void optionWithoutScore_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        QuestionnaireQuestion qq = fx.byConstruct.get("f_id").get(0);
        AssessmentQuestionOptions last = qq.getQuestion().getOptions().get(4);
        fx.scoresByOptionId.put(last.getOptionId(), new ArrayList<>());
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("1 option(s) without a score under Internal Drive"));
    }

    @Test
    void scoreOutOfRange_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        QuestionnaireQuestion qq = fx.byConstruct.get("fam_r").get(0);
        fx.scoresByOptionId.get(qq.getQuestion().getOptions().get(0).getOptionId()).get(0).setScore(2);
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("scores 2 under Hands-on (allowed 0-1)"));
    }

    @Test
    void questionFeedingTwoConstructs_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        QuestionnaireQuestion qq = fx.byConstruct.get("f_id").get(0);
        MeasuredQualityTypes other = new MeasuredQualityTypes();
        other.setMeasuredQualityTypeName("Sustained Tenacity");
        for (AssessmentQuestionOptions o : qq.getQuestion().getOptions()) {
            OptionScoreBasedOnMEasuredQualityTypes s = new OptionScoreBasedOnMEasuredQualityTypes();
            s.setScore(3);
            s.setMeasuredQualityType(other);
            fx.scoresByOptionId.get(o.getOptionId()).add(s);
        }
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("feeds several constructs"));
    }

    @Test
    void unmappedMqt_isIgnored() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        fx.question("Grit", new int[]{1, 2, 3, 4, 5});   // old pilot type, not in the map
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.valid()).isTrue();
    }

    @Test
    void twoRankingQuestions_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        fx.questions.add(fx.ranking);   // same question listed twice
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("exactly one ranking question, found 2"));
        assertThat(ix.rankingQuestionId).isNull();
    }
}
```

- [x] **Step 3: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProQuestionnaireIndexTest -DfailIfNoTests=false test`
Expected: compilation FAILURE (`NavigatorProQuestionnaireIndex` not found).

- [x] **Step 4: Write the index**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap.Construct;

/**
 * Per-questionnaire schema check. Assigns every question to the construct its
 * options are scored under, and lists every way the questionnaire deviates from
 * the September bank shape. A non-empty {@link #problems} means "not on the bank"
 * (an admin problem), which is reported as a routing error — never as a student
 * being incomplete.
 */
public final class NavigatorProQuestionnaireIndex {

    public final long questionnaireId;
    /** questionnaireQuestionId → construct key. */
    public final Map<Long, String> constructByQuestion;
    public final Map<String, Set<Long>> questionsByConstruct;
    /** questionnaireQuestionId of the single ranking question, or null when the check failed. */
    public final Long rankingQuestionId;
    public final List<String> problems;

    private NavigatorProQuestionnaireIndex(long questionnaireId, Map<Long, String> constructByQuestion,
                                           Map<String, Set<Long>> questionsByConstruct,
                                           Long rankingQuestionId, List<String> problems) {
        this.questionnaireId = questionnaireId;
        this.constructByQuestion = Collections.unmodifiableMap(constructByQuestion);
        this.questionsByConstruct = Collections.unmodifiableMap(questionsByConstruct);
        this.rankingQuestionId = rankingQuestionId;
        this.problems = Collections.unmodifiableList(problems);
    }

    public boolean valid() {
        return problems.isEmpty();
    }

    public static NavigatorProQuestionnaireIndex build(
            NavigatorProConstructMap map, long questionnaireId,
            List<QuestionnaireQuestion> questions,
            Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId) {

        Map<Long, String> byQuestion = new HashMap<>();
        Map<String, Set<Long>> byConstruct = new TreeMap<>();
        List<String> problems = new ArrayList<>();
        List<Long> rankingIds = new ArrayList<>();

        for (QuestionnaireQuestion qq : questions) {
            AssessmentQuestions q = qq.getQuestion();
            if (q == null || qq.getQuestionnaireQuestionId() == null) continue;
            long qqId = qq.getQuestionnaireQuestionId();
            List<AssessmentQuestionOptions> options = q.getOptions() == null ? List.of() : q.getOptions();

            if ("ranking".equalsIgnoreCase(q.getQuestionType())) {
                rankingIds.add(qqId);
                if (options.size() != 12) {
                    problems.add("ranking question " + qqId + " has " + options.size() + " options, expected 12");
                }
                continue;
            }

            Set<String> constructs = new TreeSet<>();
            Map<String, Integer> scoredOptions = new HashMap<>();
            for (AssessmentQuestionOptions o : options) {
                for (OptionScoreBasedOnMEasuredQualityTypes s : scoresByOptionId.getOrDefault(o.getOptionId(), List.of())) {
                    if (s.getMeasuredQualityType() == null || s.getScore() == null) continue;
                    Optional<String> key = map.constructFor(s.getMeasuredQualityType().getMeasuredQualityTypeName());
                    if (key.isEmpty()) continue;
                    constructs.add(key.get());
                    scoredOptions.merge(key.get(), 1, Integer::sum);
                    Construct c = map.get(key.get());
                    if (s.getScore() < c.min || s.getScore() > c.max) {
                        problems.add("question " + qqId + " option '" + o.getOptionText() + "' scores " + s.getScore()
                                + " under " + c.label + " (allowed " + c.min + "-" + c.max + ")");
                    }
                }
            }
            if (constructs.isEmpty()) continue;                 // not a Navigator Pro construct → ignored
            if (constructs.size() > 1) {
                problems.add("question " + qqId + " feeds several constructs " + constructs);
                continue;
            }
            String key = constructs.iterator().next();
            int unscored = options.size() - scoredOptions.getOrDefault(key, 0);
            if (unscored > 0) {
                problems.add("question " + qqId + " has " + unscored + " option(s) without a score under " + map.label(key));
            }
            byQuestion.put(qqId, key);
            byConstruct.computeIfAbsent(key, k -> new TreeSet<>()).add(qqId);
        }

        for (Construct c : map.all()) {
            int n = byConstruct.getOrDefault(c.key, Set.of()).size();
            if (n != c.questions) {
                problems.add(c.label + " " + c.mqts + ": " + n + " question(s) scored, expected " + c.questions);
            }
        }
        if (rankingIds.size() != 1) {
            problems.add("expected exactly one ranking question, found " + rankingIds.size());
        }
        return new NavigatorProQuestionnaireIndex(questionnaireId, byQuestion, byConstruct,
                rankingIds.size() == 1 ? rankingIds.get(0) : null, problems);
    }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProQuestionnaireIndexTest -DfailIfNoTests=false test`
Expected: PASS (7 tests).

- [x] **Step 6: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProQuestionnaireIndex.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProFixtures.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProQuestionnaireIndexTest.java
git commit -m "navpro: questionnaire schema check (question -> construct index, problems list)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Suppression plumbing (exception, entity column, ReportService, worker, controller)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportSuppressedException.java`
- Create: `spring-social/src/main/resources/db/migration/V20260910001__generated_report_suppression_reason.sql`
- Modify: `spring-social/src/main/java/com/kccitm/api/model/career9/GeneratedReport.java` (after the `pdfStatus` field, ~line 88)
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportService.java:143` (the `strategy.calculate` call) and `upsertGeneratedReport` (~line 356)
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumer.java:166` (catch chain)
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportController.java:77` and `:132` (catch chains)
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/ReportServiceSuppressionTest.java` (new)
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumerTest.java` (add one test)

**Interfaces:**
- Produces: `ReportSuppressedException(String ruleCode, String reason)` (unchecked) with `getRuleCode()`, `getReason()`; `GeneratedReport.getSuppressionReason()/setSuppressionReason(String)`; generated_report status value `"suppressed"`.

- [x] **Step 1: Write the failing consumer test**

Add to `ReportGenerateConsumerTest` (imports: `com.kccitm.api.service.b2c.report.ReportSuppressedException`, `static org.assertj.core.api.Assertions.assertThatCode`):

```java
    @Test
    void suppressedReport_isAckedWithoutRetryOrDlt() throws Exception {
        when(reportService.generate(5L, 9L, null, false))
                .thenThrow(new ReportSuppressedException("R1", "attention check not passed"));
        assertThatCode(() -> consumer.onGenerate(json(false, "a@b.c", "all", null, false)))
                .doesNotThrowAnyException();
        verify(kafkaTemplate, never()).send(anyString(), anyString(), anyString());
        verify(generatedReportRepository, never()).save(any());
    }
```

- [x] **Step 2: Write the failing ReportService test**

```java
package com.kccitm.api.service.b2c.report;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;
import com.kccitm.api.repository.Career9.report.CalculatedReportDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportServiceSuppressionTest {

    @Mock SanityCheckService sanityCheckService;
    @Mock AssessmentTableRepository assessmentTableRepository;
    @Mock AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Mock CalculatedReportDataRepository calculatedReportDataRepository;
    @Mock GeneratedReportRepository generatedReportRepository;
    @Mock UserStudentRepository userStudentRepository;
    @Mock PlaceholderCalculator strategy;
    @InjectMocks ReportService service;

    @BeforeEach
    void wire() {
        when(strategy.typeCode()).thenReturn("navigator_pro");
        when(strategy.usesIntermediary()).thenReturn(false);
        when(strategy.engineVersion()).thenReturn("navigator_pro-v1");
        ReflectionTestUtils.setField(service, "allStrategies", List.of(strategy));
        service.init();

        when(sanityCheckService.existsAndComplete(5L, 9L)).thenReturn(SanityCheckService.SanityResult.pass());
        when(assessmentTableRepository.existsById(9L)).thenReturn(true);
        ReportTemplate template = mock(ReportTemplate.class);
        when(template.getEngineCode()).thenReturn("navigator_pro");
        when(template.getReportTemplateId()).thenReturn(7L);
        AssessmentReportTemplate link = mock(AssessmentReportTemplate.class);
        when(link.getReportTemplate()).thenReturn(template);
        when(assessmentReportTemplateRepository.findByAssessmentIdAndIsDefaultTrue(9L)).thenReturn(Optional.of(link));
        when(calculatedReportDataRepository.findByUserStudentIdAndAssessmentIdAndReportTemplate_Id(5L, 9L, 7L))
                .thenReturn(Optional.empty());
        when(generatedReportRepository.findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(5L, 9L, 7L))
                .thenReturn(Optional.empty());
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findById(5L)).thenReturn(Optional.of(us));
        when(generatedReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void suppression_recordsRowAndRethrows() {
        when(strategy.calculate(5L, 9L, null))
                .thenThrow(new ReportSuppressedException("R1", "attention check not passed"));

        assertThatThrownBy(() -> service.generate(5L, 9L, null, false))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R1"));

        ArgumentCaptor<GeneratedReport> saved = ArgumentCaptor.forClass(GeneratedReport.class);
        verify(generatedReportRepository).save(saved.capture());
        GeneratedReport gr = saved.getValue();
        assertThat(gr.getReportStatus()).isEqualTo("suppressed");
        assertThat(gr.getSuppressionReason()).isEqualTo("R1: attention check not passed");
        assertThat(gr.getTypeOfReport()).isEqualTo("navigator_pro");
        assertThat(gr.getAssessmentId()).isEqualTo(9L);
        verify(calculatedReportDataRepository, org.mockito.Mockito.never()).save(any());
    }
}
```

- [x] **Step 3: Run both tests to verify they fail**

Run: `cd spring-social && mvn -o -q -Dtest='ReportServiceSuppressionTest,ReportGenerateConsumerTest' -DfailIfNoTests=false test`
Expected: compilation FAILURE (`ReportSuppressedException` not found).

- [x] **Step 4: Add the exception**

```java
package com.kccitm.api.service.b2c.report;

/**
 * A strategy decided the report must not be generated (Navigator Pro gates
 * R1–R5). ReportService records a {@code suppressed} generated_report row and
 * rethrows; the worker acknowledges without retry; the controller returns 422.
 */
public class ReportSuppressedException extends RuntimeException {

    private final String ruleCode;
    private final String reason;

    public ReportSuppressedException(String ruleCode, String reason) {
        super(ruleCode + ": " + reason);
        this.ruleCode = ruleCode;
        this.reason = reason;
    }

    public String getRuleCode() { return ruleCode; }
    public String getReason() { return reason; }
}
```

- [x] **Step 5: Add the migration and entity column**

`V20260910001__generated_report_suppression_reason.sql`:

```sql
-- Navigator Pro gates (R1 attention, R3 weak peak, R4 no signal, R5 incomplete)
-- decline to generate a report. The row keeps report_status = 'suppressed' and
-- this column carries "<rule>: <reason>" so the Reports Hub can show why, and
-- the suppressed list doubles as the counselling queue until that is automated.
ALTER TABLE generated_report
  ADD COLUMN suppression_reason VARCHAR(500) NULL AFTER pdf_status;
```

In `GeneratedReport.java`, directly after the `pdfStatus` field:

```java
    // "<rule>: <reason>" when report_status = "suppressed" (Navigator Pro gates); null otherwise.
    @Column(name = "suppression_reason", length = 500)
    private String suppressionReason;

    public String getSuppressionReason() { return suppressionReason; }
    public void setSuppressionReason(String suppressionReason) { this.suppressionReason = suppressionReason; }
```

(Update the status comment above `reportStatus` to `// "notGenerated", "queued", "generated", "failed", "suppressed"`.)

- [x] **Step 6: ReportService — record and rethrow**

Replace in `generate` (the `else` branch of step 4):

```java
            Map<String, Object> placeholders = strategy.calculate(userStudentId, assessmentId, intermediary);
```

with

```java
            Map<String, Object> placeholders;
            try {
                placeholders = strategy.calculate(userStudentId, assessmentId, intermediary);
            } catch (ReportSuppressedException e) {
                markSuppressed(userStudentId, assessmentId, template, e);
                throw e;
            }
```

In `upsertGeneratedReport`, after `gr.setReportStatus("generated");` add `gr.setSuppressionReason(null);`.

Add the helper next to `upsertGeneratedReport`:

```java
    /**
     * A strategy gate declined to generate (Navigator Pro R1–R5). Keep a row so the
     * Reports Hub can show the reason; never write calculated_report_data. Best-effort:
     * a persistence failure here must not mask the suppression itself.
     */
    private void markSuppressed(Long userStudentId, Long assessmentId, ReportTemplate template,
                                ReportSuppressedException e) {
        try {
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
            gr.setReportStatus("suppressed");
            String reason = e.getRuleCode() + ": " + e.getReason();
            gr.setSuppressionReason(reason.length() > 500 ? reason.substring(0, 500) : reason);
            gr.setUpdatedAt(new Date());
            generatedReportRepository.save(gr);
            logger.info("Report suppressed ({}) student={} assessment={} template={}",
                    e.getRuleCode(), userStudentId, assessmentId, template.getReportTemplateId());
        } catch (Exception ex) {
            logger.warn("Could not record suppression student={} assessment={}: {}",
                    userStudentId, assessmentId, ex.getMessage());
        }
    }
```

- [x] **Step 7: Worker — acknowledge**

In `ReportGenerateConsumer.onGenerate`, insert before `} catch (ReportRoutingException e) {`:

```java
        } catch (ReportSuppressedException e) {
            // A gate declined the report on purpose (Navigator Pro R1–R5). The row is
            // already marked "suppressed" by ReportService; nothing to retry, nothing
            // for the DLT, no email.
            logger.warn("Report suppressed ({}) student={} assessment={}: {}",
                    e.getRuleCode(), ev.userStudentId, ev.assessmentId, e.getReason());
            return;
```

Add the import `com.kccitm.api.service.b2c.report.ReportSuppressedException`.

- [x] **Step 8: Controller — 422 and bulk row**

In `UnifiedReportController.generate`, insert before `} catch (ReportRoutingException ex) {`:

```java
        } catch (ReportSuppressedException ex) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(UnifiedReportResponse.failed(ex.getRuleCode(), ex.getReason()));
```

In the bulk loop, insert before `} catch (ReportRoutingException ex) {`:

```java
            } catch (ReportSuppressedException ex) {
                row.put("status", "suppressed"); row.put("code", ex.getRuleCode()); row.put("message", ex.getReason());
```

Add the import `com.kccitm.api.service.b2c.report.ReportSuppressedException`.

- [x] **Step 9: Run the tests**

Run: `cd spring-social && mvn -o -q -Dtest='ReportServiceSuppressionTest,ReportGenerateConsumerTest' -DfailIfNoTests=false test`
Expected: PASS (all consumer tests plus the new one; 1 ReportService test).

- [x] **Step 10: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportSuppressedException.java \
  spring-social/src/main/resources/db/migration/V20260910001__generated_report_suppression_reason.sql \
  spring-social/src/main/java/com/kccitm/api/model/career9/GeneratedReport.java \
  spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportService.java \
  spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumer.java \
  spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportController.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/report/ReportServiceSuppressionTest.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumerTest.java
git commit -m "report: suppressed status — ReportSuppressedException recorded on generated_report, acked by worker, 422 in API

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The calculation service (engine registration, gates, norms cache, placeholder map)

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/EngineVersions.java` (add constant)
- Modify: `docs/engine-versions.md` (add section)
- Modify: `spring-social/src/main/java/com/kccitm/api/repository/Career9/AssessmentAnswerRepository.java` (add query)
- Modify: `spring-social/src/main/resources/application.yml` (add `app.navigator-pro` block under `app:`)
- Create: `spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProCalculationService.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProCalculationServiceTest.java`

**Interfaces:**
- Consumes: Tasks 1–6 (`NavigatorProConstructMap`, `NavigatorProScorer`, `NavigatorProScores`, `NavigatorProNorms`, `NavigatorProContent`, `NavigatorProQuestionnaireIndex`, `NavigatorProFixtures`, `ReportSuppressedException`); existing `PlaceholderCalculator`, `IntermediaryScoresPayload`, `ReportRoutingException`; repositories `AssessmentAnswerRepository.findByUserStudentIdAndAssessmentIdWithDetails(Long, Long)`, `AssessmentTableRepository.findById`, `QuestionnaireQuestionRepository.findByQuestionnaireIdWithOptions(Long)`, `OptionScoreBasedOnMeasuredQualityTypesRepository.findByOptionIdIn(List<Long>)`, `StudentAssessmentMappingRepository.findCompletedForAssessment(Long)`, `.findFirstByUserStudentUserStudentIdAndAssessmentId(Long, Long)`, `.findByUserStudentUserStudentId(Long)`, `UserStudentRepository.findByIdWithStudentInfo(Long)`, `AssessmentReportTemplateRepository.findByAssessmentIdAndIsDefaultTrue(Long)`.
- Produces: `EngineVersions.NAVIGATOR_PRO_V1 = "navigator_pro-v1"`; `AssessmentAnswerRepository.findAllByAssessmentIdWithScores(Long)`; the Spring bean `NavigatorProCalculationService` (type code `navigator_pro`).

- [x] **Step 1: Engine version, doc line, repository query, properties**

`EngineVersions.java`, after `PAGER_V1`:

```java
    /** Bumped when NavigatorProCalculationService's placeholder mapping or NavigatorProScorer changes. */
    public static final String NAVIGATOR_PRO_V1 = "navigator_pro-v1";
```

`docs/engine-versions.md`, append:

```markdown
## navigator_pro

- **navigator_pro-v1** (2026-09-10) — initial `NavigatorProCalculationService` mapping
  (MQT option scores → factors, foundation, reasoning, skill, families, values,
  cohort percentiles, bands, zone; blend keys reserved).
```

`AssessmentAnswerRepository.java`, add after `findAllByAssessmentIdForExport`:

```java
       /**
        * Every answer of an assessment with option, option scores and MQT eagerly
        * loaded — the Navigator Pro cohort pass runs on the report-worker thread
        * with no open session, so nothing may be lazy here.
        */
       @Query("SELECT DISTINCT aa FROM AssessmentAnswer aa " +
              "LEFT JOIN FETCH aa.option o " +
              "LEFT JOIN FETCH o.optionScores os " +
              "LEFT JOIN FETCH os.measuredQualityType mqt " +
              "LEFT JOIN FETCH aa.questionnaireQuestion qq " +
              "LEFT JOIN FETCH aa.userStudent " +
              "WHERE aa.assessment.id = :assessmentId")
       List<AssessmentAnswer> findAllByAssessmentIdWithScores(@Param("assessmentId") Long assessmentId);
```

`application.yml`, inside the existing `app:` block (after `fileTempFolder: classpath:temp`):

```yaml
  navigator-pro:
    # Navigator Pro report engine. Thresholds mirror Report_Logic_Spec.xlsx; the
    # QR on page 5 targets the Career Library and must be live before a batch ships.
    career-library-url: ${APP_NAVIGATOR_PRO_CAREER_LIBRARY_URL:}
    flat-gap: 10
    weak-peak: 50
    no-signal-domain: 50
    banner-flag-count: 2
    norms-min-n: 60
    percentile-min-n: 30
```

- [x] **Step 2: Write the failing test**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.report.ReportRoutingException;
import com.kccitm.api.service.b2c.report.ReportSuppressedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NavigatorProCalculationServiceTest {

    @Mock AssessmentAnswerRepository answerRepository;
    @Mock AssessmentTableRepository assessmentTableRepository;
    @Mock QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Mock OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    @Mock StudentAssessmentMappingRepository mappingRepository;
    @Mock UserStudentRepository userStudentRepository;
    @Mock AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Spy NavigatorProConstructMap map = new NavigatorProConstructMap();
    @InjectMocks NavigatorProCalculationService service;

    NavigatorProFixtures fx;
    UserStudent student;
    StudentAssessmentMapping mapping;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "careerLibraryUrl", "https://career-9.com/library");
        ReflectionTestUtils.setField(service, "flatGap", 10.0);
        ReflectionTestUtils.setField(service, "weakPeak", 50.0);
        ReflectionTestUtils.setField(service, "noSignalDomain", 50.0);
        ReflectionTestUtils.setField(service, "bannerFlagCount", 2);
        ReflectionTestUtils.setField(service, "normsMinN", 60);
        ReflectionTestUtils.setField(service, "percentileMinN", 30);

        fx = NavigatorProFixtures.validQuestionnaire();
        AssessmentTable a = new AssessmentTable();
        Questionnaire qn = new Questionnaire();
        qn.setQuestionnaireId(20L);
        a.setQuestionnaire(qn);
        when(assessmentTableRepository.findById(9L)).thenReturn(Optional.of(a));
        when(questionnaireQuestionRepository.findByQuestionnaireIdWithOptions(20L)).thenReturn(fx.questions);
        when(optionScoreRepository.findByOptionIdIn(anyList())).thenAnswer(inv -> fx.scoresFor(inv.getArgument(0)));

        student = new UserStudent();
        student.setUserStudentId(5L);
        StudentInfo si = new StudentInfo();
        si.setName("Priya Sharma");
        si.setSchoolRollNumber("R-42");
        student.setStudentInfo(si);
        InstituteDetail inst = new InstituteDetail();
        inst.setInstituteName("Sample Institute of Technology");
        student.setInstitute(inst);
        when(userStudentRepository.findByIdWithStudentInfo(5L)).thenReturn(Optional.of(student));

        mapping = new StudentAssessmentMapping();
        mapping.setStatus("completed");
        mapping.setAssessmentId(9L);
        mapping.setUserStudent(student);
        mapping.setCompletedAt(new Date());
        when(mappingRepository.findFirstByUserStudentUserStudentIdAndAssessmentId(5L, 9L)).thenReturn(Optional.of(mapping));
        when(mappingRepository.findCompletedForAssessment(9L)).thenReturn(List.of(mapping));
        when(mappingRepository.findByUserStudentUserStudentId(5L)).thenReturn(List.of(mapping));
    }

    private void answers(List<AssessmentAnswer> rows) {
        when(answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(5L, 9L)).thenReturn(new ArrayList<>(rows));
        when(answerRepository.findAllByAssessmentIdWithScores(9L)).thenReturn(rows);
    }

    @Test
    void completeStudent_smallCohort_fillsEveryKeyWithRawOnly() {
        // agree idx 3 → 4 each; freq idx 2 → 3; mcq idx 0 → correct; intensity idx 3 → 4;
        // yes idx 0 → Yes; validity idx 0 → 1 (no flag); attention idx 1 → No (pass); values 1,9,5,10.
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10));

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("student_name")).isEqualTo("Priya Sharma");
        assertThat(p.get("first_name")).isEqualTo("Priya");
        assertThat(p.get("student_id")).isEqualTo("R-42");
        assertThat(p.get("college")).isEqualTo("Sample Institute of Technology");
        assertThat(p.get("reading_no")).isEqualTo(1);
        assertThat(p.get("batch_n")).isEqualTo(1);
        assertThat(p.get("career_library_url")).isEqualTo("https://career-9.com/library");

        assertThat(p.get("f_id")).isEqualTo(75);
        assertThat(p.get("drive")).isEqualTo(75);
        assertThat(p.get("foundation")).isEqualTo(67);
        assertThat(p.get("fs_gd")).isEqualTo(67);
        assertThat(p.get("fs_gd_rag")).isEqualTo("amber");      // 66.67 raw → Developing
        assertThat(p.get("fs_gd_band")).isEqualTo("Developing");
        assertThat(p.get("reasoning")).isEqualTo(5);
        assertThat(p.get("reasoning_display")).isEqualTo("5/5");
        assertThat(p.get("chk_spr_mark")).isEqualTo("✔");
        assertThat(p.get("skill")).isEqualTo(75);
        assertThat(p.get("d_pe")).isEqualTo(75);
        assertThat(p.get("fam_r")).isEqualTo(100);
        assertThat(p.get("profile_shape")).isEqualTo("Flat");

        // n = 1 → percentiles suppressed, provisional cuts
        assertThat(p.get("percentiles_suppressed")).isEqualTo(true);
        assertThat(p.get("norms_provisional")).isEqualTo(true);
        assertThat(p.get("p_id")).isEqualTo("");
        assertThat(p.get("drive_band")).isEqualTo("");
        assertThat(p.get("drive_text")).isEqualTo("");
        assertThat(p.get("factor_callout")).isEqualTo("");
        assertThat(p.get("zone")).isEqualTo("Ready to accelerate");
        assertThat((String) p.get("zone_note")).contains("provisional cut");

        assertThat(p.get("value_1")).isEqualTo("Keep learning new things");
        assertThat(p.get("value_2_icon")).isEqualTo("🎯");
        assertThat(p.get("value_4")).isEqualTo("Serving something bigger");

        assertThat(p.get("response_quality_banner")).isEqualTo("");
        assertThat(p.get("counselling_mandatory")).isEqualTo(false);
        assertThat(p.get("explorer")).isEqualTo(false);
        assertThat(p.get("top1")).isEqualTo("");
        assertThat(p).doesNotContainKey("validity_flags");
        assertThat(p).containsKeys("def_id", "def_st", "def_ae", "lowest_bar", "lowest_bar_step",
                "zone_copy", "drive_median", "skill_median", "prec", "reading_date", "move_3");
    }

    @Test
    void attentionFailed_isR1() {
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 0, 1, 9, 5, 10));   // attention idx 0 = Yes
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R1"));
    }

    @Test
    void skippedQuestion_isR5() {
        List<AssessmentAnswer> rows = fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10);
        rows.removeIf(a -> a.getQuestionnaireQuestion() == fx.byConstruct.get("f_id").get(0));
        answers(rows);
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R5"));
    }

    @Test
    void weakPeak_isR3() {
        // yes idx 1 = No everywhere → all families 0 → flat; make one family differentiated but under 50.
        List<AssessmentAnswer> rows = fx.completeAnswers(student, 3, 2, 0, 3, 1, 0, 1, 1, 9, 5, 10);
        rows.removeIf(a -> a.getQuestionnaireQuestion() == fx.byConstruct.get("fam_r").get(0)
                || a.getQuestionnaireQuestion() == fx.byConstruct.get("fam_r").get(1));
        rows.add(fx.answer(student, fx.byConstruct.get("fam_r").get(0), 0));   // Yes
        rows.add(fx.answer(student, fx.byConstruct.get("fam_r").get(1), 0));   // Yes → fam_r 33, others 0
        answers(rows);
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R3"));
    }

    @Test
    void flatNoDomainNoValues_isR4() {
        // yes idx 1 → all families 0 (flat); intensity idx 0 → all domains 0; no ranking rows.
        answers(fx.completeAnswers(student, 3, 2, 0, 0, 1, 0, 1));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R4"));
    }

    @Test
    void twoValidityFlags_setBannerAndMandatoryCounselling() {
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 4, 1, 1, 9, 5, 10));   // validity idx 4 → score 5 ×3
        Map<String, Object> p = service.calculate(5L, 9L, null);
        assertThat((String) p.get("response_quality_banner")).contains("MAY BE BIASED");
        assertThat(p.get("counselling_mandatory")).isEqualTo(true);
    }

    @Test
    void staleQuestionnaire_isRoutingError() {
        fx.questions.remove(fx.byConstruct.get("chk_spr").get(0));
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportRoutingException.class)
                .hasMessageContaining("Spreadsheet logic");
    }

    @Test
    void cohortOfSixty_yieldsPercentilesBandsAndMedianCuts() {
        // 60 students: the target plus 59 clones with identical answers → every percentile is 50 (midrank).
        List<AssessmentAnswer> mine = fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10);
        List<AssessmentAnswer> all = new ArrayList<>(mine);
        List<StudentAssessmentMapping> completed = new ArrayList<>(List.of(mapping));
        for (long id = 100; id < 159; id++) {
            UserStudent other = new UserStudent();
            other.setUserStudentId(id);
            all.addAll(fx.completeAnswers(other, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10));
            StudentAssessmentMapping m = new StudentAssessmentMapping();
            m.setStatus("completed"); m.setAssessmentId(9L); m.setUserStudent(other); m.setCompletedAt(new Date());
            completed.add(m);
        }
        when(answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(5L, 9L)).thenReturn(new ArrayList<>(mine));
        when(answerRepository.findAllByAssessmentIdWithScores(9L)).thenReturn(all);
        when(mappingRepository.findCompletedForAssessment(9L)).thenReturn(completed);

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("batch_n")).isEqualTo(60);
        assertThat(p.get("percentiles_suppressed")).isEqualTo(false);
        assertThat(p.get("norms_provisional")).isEqualTo(false);
        assertThat(p.get("p_id")).isEqualTo(50);
        assertThat(p.get("p_id_text")).isEqualTo("P50");
        assertThat(p.get("drive_band")).isEqualTo("Developing");
        assertThat((String) p.get("drive_text")).startsWith("Your drive is in the batch mainstream");
        assertThat(p.get("drive_median")).isEqualTo(75);
        assertThat((String) p.get("factor_callout")).contains("(P50)").contains("±13");
        assertThat((String) p.get("zone_note")).contains("batch median");
    }
}
```

- [x] **Step 3: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProCalculationServiceTest -DfailIfNoTests=false test`
Expected: compilation FAILURE (`NavigatorProCalculationService` not found).

- [x] **Step 4: Write the service**

```java
package com.kccitm.api.service.b2c.navigatorpro;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProNorms.NormSet;
import com.kccitm.api.service.b2c.report.EngineVersions;
import com.kccitm.api.service.b2c.report.IntermediaryScoresPayload;
import com.kccitm.api.service.b2c.report.PlaceholderCalculator;
import com.kccitm.api.service.b2c.report.ReportRoutingException;
import com.kccitm.api.service.b2c.report.ReportSuppressedException;

/**
 * Navigator Pro engine (engineCode {@code navigator_pro}). Scores from the stored
 * MQT option scores (reversal already applied there), applies gates R1–R5,
 * computes cohort norms per assessment and emits the placeholder map. Runs on the
 * report-worker thread with no open session: every query here fetches eagerly.
 */
@Component
public class NavigatorProCalculationService implements PlaceholderCalculator {

    private static final Logger logger = LoggerFactory.getLogger(NavigatorProCalculationService.class);
    static final long NORMS_TTL_MS = 60_000L;

    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Autowired private NavigatorProConstructMap map;

    @Value("${app.navigator-pro.career-library-url:}") private String careerLibraryUrl;
    @Value("${app.navigator-pro.flat-gap:10}")          private double flatGap;
    @Value("${app.navigator-pro.weak-peak:50}")         private double weakPeak;
    @Value("${app.navigator-pro.no-signal-domain:50}")  private double noSignalDomain;
    @Value("${app.navigator-pro.banner-flag-count:2}")  private int bannerFlagCount;
    @Value("${app.navigator-pro.norms-min-n:60}")       private int normsMinN;
    @Value("${app.navigator-pro.percentile-min-n:30}")  private int percentileMinN;

    private final Map<Long, NavigatorProQuestionnaireIndex> indexCache = new ConcurrentHashMap<>();
    private final Map<Long, CachedNorms> normsCache = new ConcurrentHashMap<>();

    private static final class CachedNorms {
        final int completedCount; final long at; final NormSet norms;
        CachedNorms(int completedCount, long at, NormSet norms) { this.completedCount = completedCount; this.at = at; this.norms = norms; }
    }

    private static final List<String> RESERVED_TEXT_KEYS = List.of(
            "top1", "top2", "top3", "top1_score", "top2_score", "top3_score", "gap12",
            "sector_1", "sector_2", "sector_3", "sector_1_fit", "sector_2_fit", "sector_3_fit",
            "tier_line", "rank_copy_1", "rank_copy_2", "rank_copy_3", "cta_variant", "cta_text",
            "one_line", "move_1", "move_2", "move_3");

    @Override public String typeCode()        { return "navigator_pro"; }
    @Override public String engineVersion()   { return EngineVersions.NAVIGATOR_PRO_V1; }
    @Override public boolean usesIntermediary() { return false; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId, IntermediaryScoresPayload intermediary) {
        NavigatorProQuestionnaireIndex index = indexFor(assessmentId);
        NavigatorProScorer scorer = new NavigatorProScorer(map, flatGap);

        List<AssessmentAnswer> answers = answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);
        NavigatorProScores s = scorer.score(contributions(index, answers), valueRanks(index, answers), index.questionsByConstruct);

        String[] gate = gate(s);
        if (gate != null) {
            if (!s.incomplete.isEmpty()) {
                logger.info("Navigator Pro incomplete student={} assessment={}: {}", userStudentId, assessmentId, s.incomplete);
            }
            throw new ReportSuppressedException(gate[0], gate[1]);
        }

        NormSet norms = normsFor(assessmentId, index, scorer);
        return placeholders(userStudentId, assessmentId, s, norms);
    }

    // ── schema check ─────────────────────────────────────────────────────────

    NavigatorProQuestionnaireIndex indexFor(Long assessmentId) {
        NavigatorProQuestionnaireIndex ix = indexCache.get(assessmentId);
        if (ix != null && ix.valid()) return ix;
        AssessmentTable a = assessmentTableRepository.findById(assessmentId).orElse(null);
        Long questionnaireId = (a != null && a.getQuestionnaire() != null) ? a.getQuestionnaire().getQuestionnaireId() : null;
        if (questionnaireId == null) {
            throw new ReportRoutingException("Assessment " + assessmentId + " has no questionnaire");
        }
        List<QuestionnaireQuestion> questions = questionnaireQuestionRepository.findByQuestionnaireIdWithOptions(questionnaireId);
        List<Long> optionIds = new ArrayList<>();
        for (QuestionnaireQuestion qq : questions) {
            if (qq.getQuestion() == null || qq.getQuestion().getOptions() == null) continue;
            for (AssessmentQuestionOptions o : qq.getQuestion().getOptions()) optionIds.add(o.getOptionId());
        }
        Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId = new HashMap<>();
        if (!optionIds.isEmpty()) {
            for (OptionScoreBasedOnMEasuredQualityTypes sc : optionScoreRepository.findByOptionIdIn(optionIds)) {
                if (sc.getQuestion_option() == null) continue;
                scoresByOptionId.computeIfAbsent(sc.getQuestion_option().getOptionId(), k -> new ArrayList<>()).add(sc);
            }
        }
        ix = NavigatorProQuestionnaireIndex.build(map, questionnaireId, questions, scoresByOptionId);
        if (!ix.valid()) {
            throw new ReportRoutingException("Questionnaire " + questionnaireId + " is not on the Navigator Pro bank: "
                    + String.join("; ", ix.problems));
        }
        indexCache.put(assessmentId, ix);
        return ix;
    }

    // ── answers → scorer input ───────────────────────────────────────────────

    List<Contribution> contributions(NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
        List<Contribution> out = new ArrayList<>();
        for (AssessmentAnswer a : answers) {
            QuestionnaireQuestion qq = a.getQuestionnaireQuestion();
            if (qq == null || qq.getQuestionnaireQuestionId() == null) continue;
            String construct = index.constructByQuestion.get(qq.getQuestionnaireQuestionId());
            if (construct == null) continue;
            AssessmentQuestionOptions option = a.getOption() != null ? a.getOption() : a.getMappedOption();
            if (option == null || option.getOptionScores() == null) continue;
            for (OptionScoreBasedOnMEasuredQualityTypes sc : option.getOptionScores()) {
                if (sc.getMeasuredQualityType() == null || sc.getScore() == null) continue;
                Optional<String> key = map.constructFor(sc.getMeasuredQualityType().getMeasuredQualityTypeName());
                if (key.isPresent() && key.get().equals(construct)) {
                    out.add(new Contribution(construct, qq.getQuestionnaireQuestionId(), sc.getScore()));
                    break;   // one contribution per answered question
                }
            }
        }
        return out;
    }

    List<ValueRank> valueRanks(NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
        List<ValueRank> out = new ArrayList<>();
        if (index.rankingQuestionId == null) return out;
        for (AssessmentAnswer a : answers) {
            QuestionnaireQuestion qq = a.getQuestionnaireQuestion();
            if (qq == null || !index.rankingQuestionId.equals(qq.getQuestionnaireQuestionId())) continue;
            AssessmentQuestionOptions option = a.getOption() != null ? a.getOption() : a.getMappedOption();
            if (a.getRankOrder() == null || option == null) continue;
            out.add(new ValueRank(a.getRankOrder(), option.getOptionText()));
        }
        return out;
    }

    // ── gates ────────────────────────────────────────────────────────────────

    /** {code, reason} for the first tripped suppressing gate, else null. R2 never suppresses. */
    String[] gate(NavigatorProScores s) {
        if (!s.attentionPassed) return new String[]{"R1", "attention check not passed"};
        if (!s.incomplete.isEmpty()) return new String[]{"R5", s.incomplete.size() + " scored question(s) unanswered or duplicated"};
        if (!s.flat && s.maxFamily() < weakPeak) return new String[]{"R3", "peak interest family below " + (int) weakPeak};
        if (s.flat && s.maxDomain() < noSignalDomain && s.valuesMissing) return new String[]{"R4", "flat interests, no domain rating at or above " + (int) noSignalDomain + ", values missing"};
        return null;
    }

    // ── cohort norms ─────────────────────────────────────────────────────────

    NormSet normsFor(Long assessmentId, NavigatorProQuestionnaireIndex index, NavigatorProScorer scorer) {
        List<StudentAssessmentMapping> completed = mappingRepository.findCompletedForAssessment(assessmentId);
        CachedNorms cached = normsCache.get(assessmentId);
        long now = System.currentTimeMillis();
        if (cached != null && cached.completedCount == completed.size() && now - cached.at < NORMS_TTL_MS) {
            return cached.norms;
        }
        Set<Long> completedIds = new HashSet<>();
        for (StudentAssessmentMapping m : completed) {
            if (m.getUserStudent() != null && m.getUserStudent().getUserStudentId() != null) completedIds.add(m.getUserStudent().getUserStudentId());
        }
        Map<Long, List<AssessmentAnswer>> byStudent = new HashMap<>();
        for (AssessmentAnswer a : answerRepository.findAllByAssessmentIdWithScores(assessmentId)) {
            if (a.getUserStudent() == null || a.getUserStudent().getUserStudentId() == null) continue;
            byStudent.computeIfAbsent(a.getUserStudent().getUserStudentId(), k -> new ArrayList<>()).add(a);
        }
        List<NavigatorProNorms.Member> members = new ArrayList<>();
        for (Long sid : completedIds) {
            List<AssessmentAnswer> rows = byStudent.getOrDefault(sid, List.of());
            NavigatorProScores s = scorer.score(contributions(index, rows), valueRanks(index, rows), index.questionsByConstruct);
            if (gate(s) != null) continue;
            Map<String, Double> metrics = new HashMap<>();
            for (String metric : NavigatorProNorms.METRICS) {
                metrics.put(metric, metric.equals("reasoning") ? (double) s.reasoning : s.get(metric));
            }
            members.add(new NavigatorProNorms.Member(sid, metrics));
        }
        NormSet norms = NavigatorProNorms.build(members, percentileMinN, normsMinN);
        normsCache.put(assessmentId, new CachedNorms(completed.size(), now, norms));
        return norms;
    }

    // ── placeholders ─────────────────────────────────────────────────────────

    Map<String, Object> placeholders(Long userStudentId, Long assessmentId, NavigatorProScores s, NormSet norms) {
        Map<String, Object> p = new LinkedHashMap<>();

        // Identity and batch
        UserStudent us = userStudentRepository.findByIdWithStudentInfo(userStudentId).orElse(null);
        StudentInfo si = us != null ? us.getStudentInfo() : null;
        String name = si != null && si.getName() != null ? si.getName().trim() : "";
        p.put("student_name", name);
        p.put("first_name", name.isEmpty() ? "" : name.split("\\s+")[0]);
        p.put("student_id", studentId(si, userStudentId));
        p.put("college", us != null && us.getInstitute() != null && us.getInstitute().getInstituteName() != null
                ? us.getInstitute().getInstituteName() : "");
        StudentAssessmentMapping mapping = mappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId).orElse(null);
        Date completedAt = mapping != null ? mapping.getCompletedAt() : null;
        p.put("reading_no", readingNo(userStudentId, assessmentId, completedAt));
        p.put("reading_date", completedAt == null ? "" : new SimpleDateFormat("d MMM yyyy", Locale.ENGLISH).format(completedAt));
        p.put("batch_n", norms.n);
        p.put("prec", norms.prec);
        p.put("career_library_url", careerLibraryUrl == null ? "" : careerLibraryUrl);

        // Drive and factors
        boolean pct = !norms.percentilesSuppressed;
        p.put("drive", r(s.get("drive")));
        putIndexBand(p, "drive", s.get("drive"), norms);
        Map<String, Double> factorP = new LinkedHashMap<>();
        for (String k : NavigatorProConstructMap.FACTOR_KEYS) {
            p.put(k, r(s.get(k)));
            Double pk = norms.percentile(k, s.get(k));
            factorP.put(k, pk);
            p.put("p_" + k.substring(2), pk == null ? "" : r(pk));
            p.put("p_" + k.substring(2) + "_text", pk == null ? "" : "P" + r(pk));
            putIndexBand(p, k, s.get(k), norms);
            p.put("def_" + k.substring(2), NavigatorProContent.factorDefinition(k));
        }
        List<String> order = new ArrayList<>(NavigatorProConstructMap.FACTOR_KEYS);
        Comparator<String> byValue = pct
                ? Comparator.comparingDouble((String k) -> factorP.get(k)).thenComparingDouble(s::get)
                : Comparator.comparingDouble(s::get);
        order.sort(byValue.reversed());
        String top = order.get(0), bottom = order.get(order.size() - 1);
        p.put("top_factor", map.label(top));
        p.put("bottom_factor", map.label(bottom));
        p.put("top_factor_p", pct ? r(factorP.get(top)) : "");
        p.put("bottom_factor_p", pct ? r(factorP.get(bottom)) : "");
        p.put("factor_callout", pct
                ? NavigatorProContent.factorCallout(map.label(top), r(factorP.get(top)), map.label(bottom), r(factorP.get(bottom)), norms.prec)
                : "");

        // Foundation
        p.put("foundation", r(s.get("foundation")));
        putIndexBand(p, "foundation", s.get("foundation"), norms);
        String lowest = null;
        for (String k : NavigatorProConstructMap.SUB_KEYS) {
            double v = s.get(k);
            p.put(k, r(v));
            p.put(k + "_band", NavigatorProNorms.ragBand(v));
            p.put(k + "_rag", NavigatorProNorms.ragColour(v));
            if (lowest == null || v < s.get(lowest)) lowest = k;
        }
        p.put("lowest_bar", map.label(lowest));
        p.put("lowest_bar_step", NavigatorProContent.firstStep(lowest));

        // Reasoning
        p.put("reasoning", s.reasoning);
        p.put("reasoning_display", s.reasoning + "/5");
        putIndexBand(p, "reasoning", s.reasoning, norms);
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            boolean ok = Boolean.TRUE.equals(s.checks.get(k));
            p.put(k, ok);
            p.put(k + "_mark", ok ? "✔" : "✘");
        }

        // Skill and domains
        p.put("skill", r(s.get("skill")));
        Double skillP = norms.percentile("skill", s.get("skill"));
        p.put("skill_p", skillP == null ? "" : r(skillP));
        putIndexBand(p, "skill", s.get("skill"), norms);
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) p.put(k, r(s.get(k)));

        // Interests
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) p.put(k, r(s.get(k)));
        p.put("top_family", map.label(s.topFamily));
        p.put("second_family", map.label(s.secondFamily));
        p.put("profile_shape", s.flat ? "Flat" : "Differentiated");

        // Zone
        String zone = NavigatorProNorms.zone(s.get("drive"), s.get("skill"), norms.driveCut, norms.skillCut);
        p.put("zone", zone);
        p.put("zone_copy", NavigatorProContent.zoneCopy(zone));
        String cut = norms.provisional ? "provisional cut" : "batch median";
        p.put("zone_note", "Drive " + r(s.get("drive")) + " (" + (s.get("drive") >= norms.driveCut ? "above" : "below") + " the " + cut + ") — skill "
                + r(s.get("skill")) + " (" + (s.get("skill") >= norms.skillCut ? "above" : "below") + " " + cut + ").");
        p.put("drive_median", r(norms.driveCut));
        p.put("skill_median", r(norms.skillCut));
        p.put("norms_provisional", norms.provisional);
        p.put("percentiles_suppressed", norms.percentilesSuppressed);

        // Values
        for (int i = 1; i <= 4; i++) {
            Optional<NavigatorProContent.ValueRow> v = (!s.valuesMissing && s.values.size() >= i)
                    ? NavigatorProContent.value(s.values.get(i - 1)) : Optional.empty();
            p.put("value_" + i, v.map(x -> x.title).orElse(""));
            p.put("value_" + i + "_icon", v.map(x -> x.icon).orElse(""));
            p.put("value_" + i + "_why", v.map(x -> x.why).orElse(""));
        }

        // Response quality (the flag count itself never enters the map)
        boolean banner = s.validityFlags >= bannerFlagCount;
        p.put("response_quality_banner", banner ? NavigatorProContent.banner() : "");
        p.put("counselling_mandatory", banner);
        if (s.validityFlags > 0) {
            logger.info("Navigator Pro validity flags={} student={} assessment={}", s.validityFlags, userStudentId, assessmentId);
        }

        // Static copy
        p.put("cover_caption", NavigatorProContent.COVER_CAPTION);
        p.put("cover_footer", String.format(NavigatorProContent.COVER_FOOTER_TEMPLATE, p.get("first_name")));
        p.put("about_career9", NavigatorProContent.ABOUT_CAREER9);
        p.put("about_report", NavigatorProContent.ABOUT_REPORT);
        p.put("how_to_read", NavigatorProContent.howToRead((String) p.get("first_name")));
        p.put("precision_line", NavigatorProContent.precisionLine(norms.prec, norms.n));
        p.put("sector_caveat", NavigatorProContent.SECTOR_CAVEAT);
        p.put("ring_drive", NavigatorProContent.RING_DRIVE);
        p.put("ring_foundation", NavigatorProContent.RING_FOUNDATION);
        p.put("ring_skill", NavigatorProContent.RING_SKILL);
        p.put("ring_reasoning", NavigatorProContent.RING_REASONING);

        // Reserved for phase 2 (blend, sectors, R6)
        p.put("explorer", false);
        p.put("tie", false);
        for (String k : RESERVED_TEXT_KEYS) p.put(k, "");
        return p;
    }

    /** Percentile band + paragraph for an index key; both empty while percentiles are suppressed. */
    private void putIndexBand(Map<String, Object> p, String key, double raw, NormSet norms) {
        Double pk = norms.percentile(key, raw);
        String band = pk == null ? "" : NavigatorProNorms.band(pk);
        p.put(key + "_band", band);
        p.put(key + "_text", band.isEmpty() ? "" : NavigatorProContent.bandParagraph(key, band));
    }

    private static String studentId(StudentInfo si, Long userStudentId) {
        if (si != null) {
            if (si.getSchoolRollNumber() != null && !si.getSchoolRollNumber().trim().isEmpty()) return si.getSchoolRollNumber().trim();
            if (si.getCareerNineRollNumber() != null && !si.getCareerNineRollNumber().trim().isEmpty()) return si.getCareerNineRollNumber().trim();
        }
        return String.valueOf(userStudentId);
    }

    /** 1 + the student's earlier completed assessments whose default template runs this engine. */
    private int readingNo(Long userStudentId, Long assessmentId, Date completedAt) {
        int earlier = 0;
        try {
            for (StudentAssessmentMapping m : mappingRepository.findByUserStudentUserStudentId(userStudentId)) {
                if (m.getAssessmentId() == null || m.getAssessmentId().equals(assessmentId)) continue;
                if (!"completed".equalsIgnoreCase(m.getStatus())) continue;
                if (completedAt != null && m.getCompletedAt() != null && !m.getCompletedAt().before(completedAt)) continue;
                boolean navPro = assessmentReportTemplateRepository.findByAssessmentIdAndIsDefaultTrue(m.getAssessmentId())
                        .map(AssessmentReportTemplate::getReportTemplate)
                        .map(t -> typeCode().equalsIgnoreCase(t.getEngineCode()))
                        .orElse(false);
                if (navPro) earlier++;
            }
        } catch (Exception e) {
            logger.warn("reading_no fell back to 1 for student {}: {}", userStudentId, e.getMessage());
        }
        return 1 + earlier;
    }

    private static int r(double v) {
        return (int) Math.round(v);
    }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd spring-social && mvn -o -q -Dtest=NavigatorProCalculationServiceTest -DfailIfNoTests=false test`
Expected: PASS (8 tests). If `foundation` asserts 67 but you get 68, check `NavigatorProFixtures.scaleFor`: freq idx 2 must score 3 on every sub-domain question (Σ = 66 → (66−22)/66 = 66.67 → 67).

- [x] **Step 6: Boot-wire check**

Run: `cd spring-social && mvn -o -q -DskipTests compile`
Expected: BUILD SUCCESS. Then start nothing; the `ReportService` init log line `ReportService initialized with engines: [..., navigator_pro]` will confirm registration at the next backend start (Task 10).

- [x] **Step 7: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/report/EngineVersions.java docs/engine-versions.md \
  spring-social/src/main/java/com/kccitm/api/repository/Career9/AssessmentAnswerRepository.java \
  spring-social/src/main/resources/application.yml \
  spring-social/src/main/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProCalculationService.java \
  spring-social/src/test/java/com/kccitm/api/service/b2c/navigatorpro/NavigatorProCalculationServiceTest.java
git commit -m "navpro: NavigatorProCalculationService — engine registration, gates, cohort norms, placeholder map

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Manual-only engines skip on-submit generation

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducer.java:53-70`
- Modify: `spring-social/src/main/resources/application.yml` (the `report.pipeline` block, ~line 170)
- Test: `spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducerTest.java` (add three tests)

**Interfaces:**
- Consumes: `ReportService.resolveTemplate(Long assessmentId, Long reportTemplateId)` (public, existing), `ReportTemplate.getEngineCode()`, `ReportRoutingException`.
- Produces: property `report.pipeline.manual-only-engines` (default `navigator_pro`); package-private `boolean isManualOnly(Long assessmentId)` on the producer.

- [x] **Step 1: Write the failing tests**

Add to `ReportPipelineProducerTest` (imports: `com.kccitm.api.model.career9.ReportTemplate`, `com.kccitm.api.service.b2c.report.ReportService`, `com.kccitm.api.service.b2c.report.ReportRoutingException`, `org.springframework.test.util.ReflectionTestUtils`, `static org.mockito.ArgumentMatchers.anyString`, `static org.mockito.Mockito.never`; add the field `@Mock ReportService reportService;` next to the other mocks):

```java
    private ReportTemplate templateWithEngine(String engine) {
        ReportTemplate t = mock(ReportTemplate.class);
        when(t.getEngineCode()).thenReturn(engine);
        return t;
    }

    @Test
    void enqueue_skipsOnSubmitForManualOnlyEngine() {
        ReflectionTestUtils.setField(producer, "enabled", true);
        ReflectionTestUtils.setField(producer, "manualOnlyEngines", "navigator_pro");
        ReportTemplate t = templateWithEngine("navigator_pro");   // stub the template BEFORE the outer when(): nested stubbing throws
        when(reportService.resolveTemplate(9L, null)).thenReturn(t);
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);

        assertThat(producer.enqueue(us, 9L)).isTrue();

        verify(kafkaTemplate, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void enqueue_stillPublishesForOtherEngines() throws Exception {
        ReflectionTestUtils.setField(producer, "enabled", true);
        ReflectionTestUtils.setField(producer, "manualOnlyEngines", "navigator_pro");
        ReportTemplate t = templateWithEngine("pager");   // stub the template BEFORE the outer when(): nested stubbing throws
        when(reportService.resolveTemplate(9L, null)).thenReturn(t);
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findByIdWithStudentInfo(5L)).thenReturn(Optional.of(us));
        BrandingDto brand = mock(BrandingDto.class);
        when(brand.isWhitelabel()).thenReturn(false);
        when(brandingService.forInstitute(any())).thenReturn(brand);

        assertThat(producer.enqueue(us, 9L)).isTrue();

        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_GENERATE), eq("5:9"), anyString());
    }

    @Test
    void enqueue_publishesWhenNoTemplateIsMapped() {
        ReflectionTestUtils.setField(producer, "enabled", true);
        ReflectionTestUtils.setField(producer, "manualOnlyEngines", "navigator_pro");
        when(reportService.resolveTemplate(9L, null)).thenThrow(new ReportRoutingException("none"));
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findByIdWithStudentInfo(5L)).thenReturn(Optional.of(us));
        BrandingDto brand = mock(BrandingDto.class);
        when(brand.isWhitelabel()).thenReturn(false);
        when(brandingService.forInstitute(any())).thenReturn(brand);

        assertThat(producer.enqueue(us, 9L)).isTrue();

        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_GENERATE), eq("5:9"), anyString());
    }
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -o -q -Dtest=ReportPipelineProducerTest -DfailIfNoTests=false test`
Expected: compilation FAILURE (`manualOnlyEngines` field absent → the `enqueue_skipsOnSubmitForManualOnlyEngine` test fails at `setField`, or the send verification fails).

- [x] **Step 3: Implement the gate**

In `ReportPipelineProducer`, add after the `enabled` field:

```java
    /**
     * Engine codes whose reports are generated only from the admin Generate Queue.
     * On-submit completion skips them (cohort norms need the whole batch first).
     * Comma-separated; empty disables the gate.
     */
    @Value("${report.pipeline.manual-only-engines:navigator_pro}")
    private String manualOnlyEngines;

    @Autowired @org.springframework.context.annotation.Lazy
    private com.kccitm.api.service.b2c.report.ReportService reportService;
```

In `enqueue`, directly after the `if (!enabled || userStudentArg == null || assessmentId == null) { return false; }` block:

```java
        if (isManualOnly(assessmentId)) {
            logger.info("Report pipeline: on-submit generation skipped (manual-only engine) student={} assessment={}",
                    userStudentArg.getUserStudentId(), assessmentId);
            return true;   // handled: the legacy auto-gen must not run either
        }
```

Add the helper:

```java
    /** True when the assessment's default template runs an engine listed in report.pipeline.manual-only-engines. */
    boolean isManualOnly(Long assessmentId) {
        java.util.Set<String> engines = new java.util.HashSet<>();
        if (manualOnlyEngines != null) {
            for (String e : manualOnlyEngines.split(",")) {
                if (!e.trim().isEmpty()) engines.add(e.trim().toLowerCase(java.util.Locale.ROOT));
            }
        }
        if (engines.isEmpty() || reportService == null) return false;
        try {
            com.kccitm.api.model.career9.ReportTemplate t = reportService.resolveTemplate(assessmentId, null);
            return t != null && t.getEngineCode() != null
                    && engines.contains(t.getEngineCode().trim().toLowerCase(java.util.Locale.ROOT));
        } catch (com.kccitm.api.service.b2c.report.ReportRoutingException e) {
            return false;   // no template mapped → let the worker apply its benign skip
        }
    }
```

In `application.yml`, inside `report.pipeline` after `email-transport`:

```yaml
    # Engines generated only from the admin Generate Queue (on-submit skip). Remove an
    # engine here to turn its auto-generation on. Empty = gate off.
    manual-only-engines: ${REPORT_MANUAL_ONLY_ENGINES:navigator_pro}
```

- [x] **Step 4: Run the tests**

Run: `cd spring-social && mvn -o -q -Dtest=ReportPipelineProducerTest -DfailIfNoTests=false test`
Expected: PASS (existing tests plus 3 new).

- [x] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducer.java \
  spring-social/src/main/resources/application.yml \
  spring-social/src/test/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducerTest.java
git commit -m "pipeline: manual-only engines skip on-submit generation (navigator_pro by default)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Admin UI — engine option and suppressed status

**Files:**
- Modify: `react-social/src/app/pages/ReportTemplates/ReportTemplatesPage.tsx:13`
- Modify: `react-social/src/app/pages/ReportGeneration/API/GeneratedReport_APIs.ts:6-19`
- Modify: `react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx` (the `ReportData` type ~line 74, the map builder ~line 366, the badge ~line 1410 and ~line 1450)

**Interfaces:**
- Consumes: backend `GET /generated-reports/by-assessment/{id}` now serialises `suppressionReason` (entity field from Task 6) and `reportStatus === "suppressed"`.

- [x] **Step 1: Engine list**

In `ReportTemplatesPage.tsx` change line 13 to:

```ts
const ENGINES = ["bet", "pager", "legacy", "navigator_pro"];
```

- [x] **Step 2: API type**

In `GeneratedReport_APIs.ts` update the interface:

```ts
  typeOfReport: string; // engineCode: "bet" | "pager" | "legacy" | "navigator_pro"
  reportTemplateId?: number | null;
  reportStatus: string; // "notGenerated" | "queued" | "generated" | "failed" | "suppressed"
  suppressionReason?: string | null; // "<rule>: <reason>" when reportStatus === "suppressed"
```

- [x] **Step 3: Reports Hub**

In the `ReportData` type add `suppressionReason?: string | null;` after `pdfStatus`.

In the map builder (the `map.set(id, {...})` call) add `suppressionReason: gr.suppressionReason ?? null,` after `pdfStatus: gr.pdfStatus ?? "notRequested",`.

Replace the `rsc` line

```ts
                      const rsc = hasReport ? { bg: "#dcfce7", color: "#059669" } : { bg: "#fef3c7", color: "#d97706" };
```

with

```ts
                      const isSuppressed = reportStatus === "suppressed";
                      const rsc = hasReport ? { bg: "#dcfce7", color: "#059669" }
                        : isSuppressed ? { bg: "#fee2e2", color: "#b91c1c" }
                        : { bg: "#fef3c7", color: "#d97706" };
```

and replace the badge cell

```tsx
                          <td style={tdStyle}>{statusBadge(rsc.bg, rsc.color, hasReport ? "Generated" : "Not Generated")}</td>
```

with

```tsx
                          <td style={tdStyle} title={isSuppressed ? (rd?.suppressionReason || "Suppressed") : undefined}>
                            {statusBadge(rsc.bg, rsc.color, hasReport ? "Generated" : isSuppressed ? "Suppressed" : "Not Generated")}
                          </td>
```

- [x] **Step 4: Type-check**

Run: `cd react-social && npm run typecheck 2>&1 | tail -3`
Expected: the same 58-error baseline (the count printed must not exceed 58; none of the errors may name the three edited files).

- [x] **Step 5: Commit**

```bash
git add react-social/src/app/pages/ReportTemplates/ReportTemplatesPage.tsx \
  react-social/src/app/pages/ReportGeneration/API/GeneratedReport_APIs.ts \
  react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx
git commit -m "admin: navigator_pro engine option; Reports Hub shows suppressed reports with reason

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Full verification

**Files:** none new.

- [x] **Step 1: Backend suite**

Run: `cd spring-social && mvn -o -q test 2>&1 | tail -15`
Expected: `BUILD SUCCESS`; the previous baseline was 157 tests, now 157 + 5 + 12 + 10 + 4 + 7 + 1 + 1 + 8 + 3 = 208 tests, 0 failures, 0 errors. Any failure is fixed before continuing.

- [x] **Step 2: Boot registration**

Run the backend the way the project's `run` skill or `docker-compose.yml` does (dev profile against the local MySQL on port 3306) and grep the startup log:

```bash
grep -E "ReportService initialized with engines|Flyway|V20260910001" <backend log>
```

Expected: the engines line lists `navigator_pro`; Flyway applied `V20260910001`. Stop the backend afterwards.

- [x] **Step 3: Pilot questionnaire yields the schema error**

With the backend running and an admin token, call the synchronous endpoint for a student who completed assessment 58 ("Navigator Pro Internal Testing") after mapping a `navigator_pro` template to it:

```bash
curl -s -X POST "$API/generate-report-unified" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"userStudentId": <id>, "assessmentId": 58, "force": true}'
```

Expected: HTTP 422 with `code: "ROUTING"` and a message naming `Internal Drive`, `Validity`, `Numeracy` and the other missing constructs. Record the exact message in the commit body of Step 5.

- [x] **Step 4: Typecheck baseline**

Run: `cd react-social && npm run typecheck 2>&1 | tail -3`
Expected: 58 errors, none in the edited files.

- [x] **Step 5: Commit any fixes and record the verification**

```bash
git add -A spring-social/src react-social/src docs
git commit -m "navpro: verification pass — full suite green, engine registered, pilot questionnaire rejected by schema check

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Skip the commit if nothing changed; the evidence goes in the task report instead.)
