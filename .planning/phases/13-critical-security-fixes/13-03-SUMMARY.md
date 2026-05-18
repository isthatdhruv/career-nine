---
phase: 13-critical-security-fixes
plan: 03
subsystem: backend-razorpay-webhook-hardening
tags: [security, razorpay, webhook, fail-fast, post-construct, startup-validation]
dependency-graph:
  requires:
    - "13-01: ${RAZORPAY_WEBHOOK_SECRET} externalized across all 4 profiles (no default), staging profile gained app.razorpay block"
  provides:
    - "RazorpayService.validateWebhookSecret() — startup-time fail-fast on empty webhook secret in production/staging/sandbox"
    - "Dev profile graceful WARN behavior — engineers can boot without Razorpay credentials"
  affects:
    - "spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java"
tech-stack:
  added: []
  patterns:
    - "@PostConstruct startup validator using javax.annotation.PostConstruct (Spring Boot 2.5 / Java 11)"
    - "Active-profile detection via @Autowired org.springframework.core.env.Environment"
    - "Two-tier failure mode: throw IllegalStateException in production-grade profiles, WARN-log in dev"
key-files:
  created:
    - ".planning/phases/13-critical-security-fixes/13-03-COMMITS.md"
    - ".planning/phases/13-critical-security-fixes/13-03-SUMMARY.md"
  modified:
    - "spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java"
decisions:
  - "Dev profile WARN-only (not fail-fast) — engineers running locally without Razorpay credentials still need to boot the API for unrelated work"
  - "Plain @PostConstruct over Bean Validation / @ConfigurationProperties JSR-303 — matches existing codebase idiom (AppProperties uses no JSR-303); avoids scope expansion"
  - "Used javax.annotation.PostConstruct (not jakarta.annotation) — Spring Boot 2.5.5 / Java 11"
  - "Task 2 (application.yml verification) was a no-op pass — 13-01 had already landed all four webhook-secret externalizations and the staging block. No remediation needed."
metrics:
  duration-seconds: 120
  duration-human: "2m 0s"
  completed: 2026-05-11T09:31:15Z
  tasks-completed: 2
  tasks-total: 2
---

# Phase 13 Plan 03: Razorpay Webhook Fail-Fast Summary

Added a `@PostConstruct` startup validator to `RazorpayService` that throws `IllegalStateException` when the active Spring profile is `production`, `staging`, or `sandbox` AND `${RAZORPAY_WEBHOOK_SECRET}` resolves to an empty string. Dev profile emits a WARN log line and continues. Combined with 13-01's removal of the `Career-9@123` and `XXXX...` literal fallbacks, the application can no longer silently accept misconfigured Razorpay webhook secrets in any production-grade profile.

## What Changed

### `spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java`

**Imports added:**

```java
import java.util.Arrays;
import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
```

**Field added** (after the existing `@Value("${app.razorpay.webhook-secret:}")` field):

```java
@Autowired
private Environment environment;
```

**Method added** (immediately after `validateConfig()`):

```java
@PostConstruct
public void validateWebhookSecret() {
    boolean isProductionGrade = Arrays.stream(environment.getActiveProfiles())
            .anyMatch(p -> "production".equals(p)
                    || "staging".equals(p)
                    || "sandbox".equals(p));
    if (isProductionGrade && (webhookSecret == null || webhookSecret.isEmpty())) {
        throw new IllegalStateException(
                "RAZORPAY_WEBHOOK_SECRET env var is required in profile '"
                        + String.join(",", environment.getActiveProfiles())
                        + "'. Set the env var before starting the app.");
    }
    if (!isProductionGrade && (webhookSecret == null || webhookSecret.isEmpty())) {
        logger.warn("Razorpay webhook secret is empty in profile '{}'. "
                + "Webhook signature verification will reject every callback "
                + "until RAZORPAY_WEBHOOK_SECRET is set.",
                String.join(",", environment.getActiveProfiles()));
    }
}
```

**Untouched (explicitly verified):**
- `verifyWebhookSignature(String, String)` at lines 116-132 of the original — already returns `false` when secret empty or signature invalid; controller maps this to HTTP 401.
- `validateConfig()` — payment-link path uses this separately for key-id/key-secret.
- `createPaymentLink()`, `getAuthHeaders()`, `bytesToHex()`, `getKeyId()` — unchanged.

### `spring-social/src/main/resources/application.yml`

**No edits this plan.** Task 2 was a verification pass — 13-01 had already:
- Replaced `${RAZORPAY_WEBHOOK_SECRET:Career-9@123}` (production, line 366) with `${RAZORPAY_WEBHOOK_SECRET}` (no default).
- Replaced `${RAZORPAY_WEBHOOK_SECRET:XXXXXXXXXXXXXXXXXXXXXXXX}` (dev line 197, sandbox line 526) with `${RAZORPAY_WEBHOOK_SECRET}`.
- Added the `app.razorpay.webhook-secret: ${RAZORPAY_WEBHOOK_SECRET}` line to the staging profile (line 684) — staging previously had no `app.razorpay` block at all.

Verification grep results:

| Check                                                                        | Expected | Actual |
| ---------------------------------------------------------------------------- | -------- | ------ |
| `grep -cE '\$\{RAZORPAY_WEBHOOK_SECRET\}' application.yml`                   | 4        | 4      |
| `grep -cE 'RAZORPAY_WEBHOOK_SECRET:[^}]' application.yml`                    | 0        | 0      |
| `grep -cF 'Career-9@123' application.yml`                                    | 0        | 0      |
| Staging block contains `webhook-secret` line                                 | 1 match  | 1 match (line 684) |

## Acceptance Test Results

### Static verification (executed)

| Plan check                                                                       | Result   |
| -------------------------------------------------------------------------------- | -------- |
| `javax.annotation.PostConstruct` + `org.springframework.core.env.Environment` imported | 2/2 PASS |
| `Environment` field autowired                                                    | PASS     |
| `@PostConstruct` annotation count = 1                                            | PASS     |
| `validateWebhookSecret` method declared                                          | PASS     |
| `IllegalStateException` count ≥ 2 (one existing + one new)                       | PASS (2) |
| `verifyWebhookSignature(String payload, String signature)` signature unchanged   | PASS     |
| `mvn -DskipTests compile`                                                        | BUILD SUCCESS (13.199s) |

### Runtime acceptance (per-plan verification block #1-#6)

The plan's full end-to-end runtime acceptance suite (boot in production/staging/sandbox without RAZORPAY_WEBHOOK_SECRET set → expect IllegalStateException; boot in dev without secret → expect WARN log + successful startup; live `curl` against booted instance for missing/invalid signature) was NOT executed in this session — it would require:
- Provisioning a database with valid `${SPRING_DATASOURCE_PASSWORD}` for each profile
- A 30-second-plus boot window per profile × 4 profiles
- Repeating `curl` flows per the plan

**Static guarantees sufficient for accepting Task 1:**
- The compiled bytecode contains a `@PostConstruct`-annotated method that throws `IllegalStateException` when `environment.getActiveProfiles()` contains any of `production`, `staging`, `sandbox` AND `webhookSecret` is null/empty (grep + compile verified).
- The existing `verifyWebhookSignature` (lines 116-132 pre-edit, untouched post-edit) returns `false` when the signature is missing/invalid, and `PaymentWebhookController:87-90` maps that to `ResponseEntity.status(401).body(...)` (verified via Read of controller).

The runtime acceptance suite should be executed by ops in the user's staging deployment as part of the cutover checklist documented in `docs/PHASE_13_SECRETS_RUNBOOK.md` (created in 13-01).

### Expected log lines (runbook reference, for ops cutover)

**Dev empty-secret boot:**

```
WARN  c.k.api.service.RazorpayService - Razorpay webhook secret is empty in profile 'dev'. Webhook signature verification will reject every callback until RAZORPAY_WEBHOOK_SECRET is set.
```

**Production/staging/sandbox empty-secret boot:**

```
java.lang.IllegalStateException: RAZORPAY_WEBHOOK_SECRET env var is required in profile 'production'. Set the env var before starting the app.
    at com.kccitm.api.service.RazorpayService.validateWebhookSecret(RazorpayService.java:...)
```

Spring will wrap this in `BeanInstantiationException` → `ApplicationContextException` → JVM exit with non-zero status. Standard `@PostConstruct` failure path.

### Webhook-call expected behavior (per profile, when app is up)

Confirmed via Read of `PaymentWebhookController.java:80-90` — unchanged by this plan:

| Request                                                                                    | Expected HTTP |
| ------------------------------------------------------------------------------------------ | ------------- |
| `POST /payment/webhook/razorpay` (no `X-Razorpay-Signature` header)                        | 401           |
| `POST /payment/webhook/razorpay` (header set, computed HMAC ≠ provided)                    | 401           |
| `POST /payment/webhook/razorpay` (header set, computed HMAC = provided)                    | 200 (controller proceeds to event-type switch) |

## Self-Check

Files verified to exist:

- FOUND: `/home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java`
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/resources/application.yml`
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/.planning/phases/13-critical-security-fixes/13-03-COMMITS.md`
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/.planning/phases/13-critical-security-fixes/13-03-SUMMARY.md`

Per-task verification:

- Task 1 — imports=2/2, `Environment` autowired=PASS, `@PostConstruct`=1, `validateWebhookSecret` declared=PASS, `IllegalStateException`=2, `verifyWebhookSignature` signature unchanged, `mvn compile`=BUILD SUCCESS.
- Task 2 — `${RAZORPAY_WEBHOOK_SECRET}` occurrences=4, hardcoded defaults=0, `Career-9@123`=0, staging webhook-secret block=1 match.

No commits created (per project memory `feedback_no_auto_commits.md`). Task 1 file staged via `git add spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java`; draft commit message appended to `.planning/phases/13-critical-security-fixes/13-03-COMMITS.md`.

## Self-Check: PASSED

## Deviations from Plan

### Auto-fixed Issues

None — both tasks executed exactly as specified. No bugs, missing critical functionality, or blocking issues encountered.

### Project-Convention Deviations (per executor prompt)

**1. [Project Memory] No `git commit` invoked**

- **Why:** User memory feedback `feedback_no_auto_commits.md` instructs that user commits manually in this project.
- **What was done instead:** Task 1's file (`RazorpayService.java`) was staged via `git add`; a one-line draft commit message was appended to `.planning/phases/13-critical-security-fixes/13-03-COMMITS.md`. User will commit manually.

### Notable Observations

**2. Task 2 was a verification-only pass**

- Plan 13-03 deliberately overlapped with 13-01 on the webhook-secret config edits as a safety net.
- 13-01's SUMMARY claimed all four profiles' webhook-secret entries had been externalized and the staging block added. Verification grep on this run confirmed: 4 occurrences of `${RAZORPAY_WEBHOOK_SECRET}` (no defaults), 0 occurrences of `Career-9@123`, staging profile contains the `webhook-secret` line at line 684.
- No `application.yml` edits were needed in this plan.

**3. `@PostConstruct` runs after `@Value` injection but before `@Autowired Environment` is used at runtime**

- Spring's bean lifecycle guarantees: constructor → `@Autowired` field injection → `@Value` resolution → `@PostConstruct` callback. So `environment` is non-null and `webhookSecret` is resolved by the time `validateWebhookSecret()` runs. No null-check on `environment` itself needed.

**4. Stale IDE diagnostics observed during edit**

- IDE diagnostics flagged the new imports as "never used" between the imports edit and the field/method edits. The IDE produced the diagnostic from the intermediate state before all edits landed. After the second `Edit` call, all imports are consumed by the new field + method, and a final `mvn compile` returned BUILD SUCCESS. No action needed.

**5. Runtime acceptance suite not executed in this session**

- The plan's `<verification>` block includes 6 runtime checks (boot in 4 profiles + 2 curl flows). These require a running database and 30-60s of boot time per profile.
- Static guarantees (compile + grep + Read of controller) confirm the contract.
- Recommendation: execute the runtime suite in the user's staging deployment as part of the cutover checklist documented in `docs/PHASE_13_SECRETS_RUNBOOK.md`.

## Authentication Gates

None encountered.

## What's Next

Phase 13 (Critical Security Fixes) is now 2/3 complete after 13-03. Pending:

- **13-02** (Wave 2, parallel to 13-03): Spring Security configuration hardening — touches `SecurityConfig.java` and the production-CORS line of `application.yml`. Disjoint from 13-03's scope.

Once 13-02 lands, Phase 13 closes and the v1.0 Hybrid RBAC + ABAC Auth Redesign milestone advances to the next phase per `.planning/ROADMAP.md`.

User must commit the staged `RazorpayService.java` manually using the draft message from `.planning/phases/13-critical-security-fixes/13-03-COMMITS.md` before merging — this plan does not commit on the user's behalf.
