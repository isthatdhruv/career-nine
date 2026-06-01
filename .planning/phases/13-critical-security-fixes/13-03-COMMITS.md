# Phase 13-03 Draft Commit Messages

User commits manually (project memory: `feedback_no_auto_commits.md`). Each line below is a one-line commit message draft staged for the user. Files for each commit are listed under the message.

---

## Task 1 — Add @PostConstruct startup validator to RazorpayService

```
feat(13-03): fail-fast on empty RAZORPAY_WEBHOOK_SECRET in production/staging/sandbox profiles
```

Files staged:
- `spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java`

What changed:
- Added `javax.annotation.PostConstruct`, `java.util.Arrays`, `org.springframework.beans.factory.annotation.Autowired`, `org.springframework.core.env.Environment` imports
- Added `@Autowired private Environment environment` field
- Added `@PostConstruct public void validateWebhookSecret()` method that throws `IllegalStateException` at startup when the active profile is one of `production`, `staging`, `sandbox` AND `webhookSecret` is null/empty; logs WARN (does not throw) in dev profile when empty
- Did NOT modify `verifyWebhookSignature()`, `validateConfig()`, `createPaymentLink()`, `getAuthHeaders()`, `bytesToHex()`, `getKeyId()`

---

## Task 2 — Verify application.yml webhook-secret externalization (no-op pass)

No files staged. Plan 13-01 already landed all four `${RAZORPAY_WEBHOOK_SECRET}` entries (dev/production/sandbox/staging) without defaults, and the new staging `app.razorpay.webhook-secret` block. Verified via:
- `grep -cE '\${RAZORPAY_WEBHOOK_SECRET}' application.yml` → 4
- `grep -E 'RAZORPAY_WEBHOOK_SECRET:[^}]' application.yml` → 0 matches
- `grep -F 'Career-9@123' application.yml` → 0 matches
- Staging profile block confirmed at lines 683-684

No commit needed for Task 2.

---

## Final plan-completion commit (docs only)

```
docs(13-03): complete Razorpay webhook fail-fast plan — SUMMARY + STATE
```

Files staged (with `git add -f` since `.planning/` is gitignored):
- `.planning/phases/13-critical-security-fixes/13-03-SUMMARY.md` (new)
- `.planning/phases/13-critical-security-fixes/13-03-COMMITS.md` (new)
- `.planning/STATE.md` (current position advanced 1/3 → 2/3, last-activity / session-continuity updated, 4 new decisions appended)

Note: STATE.md and `.planning/*` are gitignored — the user may prefer to keep these artifacts untracked. If so, skip the docs commit; the staged files remain as a paper-trail in the working tree.
