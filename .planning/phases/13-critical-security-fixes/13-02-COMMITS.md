# Phase 13-02 — Draft Commit Messages

User commits manually (project memory `feedback_no_auto_commits.md`). All listed files are already `git add`-staged. Review the diff, then commit each block separately or squash as preferred.

---

## BREAKING CHANGE — pre-merge review required

This plan tightens the Spring Security `permitAll()` allowlist to the exact 11 patterns mandated by ROADMAP success criterion #3. As a consequence, **three previously-public paths now require an authenticated request**:

| Path                          | Previous status | New status      | Known impact                                                                                                       |
| ----------------------------- | --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/assessments/prefetch/**`    | public          | `authenticated()` | **`career-nine-assessment` student app will start returning 401** on prefetch. Fix deferred — `docs/AUTH_REDESIGN_PLAN.md §9` (assessment-auth phase). |
| `/leads/capture`              | public          | `authenticated()` | Marketing form / external lead-capture integrations that POST without a JWT will return 401. **Confirm with product** before shipping. |
| `/bet-report-data/public/**`  | public          | `authenticated()` | Any anonymous report viewer / external integration hitting this will return 401. **Confirm with product**.         |

**Decision gate is at commit time.** Inspect the staged diff, decide whether to ship now or `git reset HEAD spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java spring-social/src/main/resources/application.yml` to defer.

Additional behaviour changes:
- `StrictHttpFirewall` now uses all defaults — semicolons, URL-encoded slashes, double-slashes, and non-standard HTTP verbs (TRACE/CONNECT) are rejected with 400 instead of being passed through.
- CORS `allowedHeaders` is an explicit 7-header allowlist; `*` no longer reflected.
- Production profile CORS no longer trusts `http://localhost:5173` (kept on dev/sandbox).
- `/actuator/*` moved behind auth — if a load balancer / k8s probe hits `/actuator/health` anonymously, it will now 401. See Notes in plan for the unblocking one-liner.

---

## Task 1 — Shrink permitAll, enforce anyRequest().authenticated()

**Staged file:**
- `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java`

**Draft commit message (one line):**

```
security(13-02): shrink SecurityConfig permitAll to 11 ROADMAP-mandated paths; everything else requires auth
```

---

## Task 2 — Default StrictHttpFirewall + explicit CORS allowedHeaders + drop localhost:5173 from prod CORS

**Staged files:**
- `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java` (firewall bean + CORS headers — same file as Task 1; one combined diff)
- `spring-social/src/main/resources/application.yml` (production CORS allowedOrigins; staged with `-f` because the file is gitignored — see 13-01-SUMMARY §"application.yml is gitignored")

**Draft commit messages (one line each):**

```
security(13-02): restore StrictHttpFirewall defaults; reject semicolons, encoded slashes, TRACE
```

```
security(13-02): explicit CORS allowedHeaders allowlist (7 headers); stop reflecting '*'
```

```
security(13-02): drop http://localhost:5173 from production CORS allowedOrigins
```

(Or squash all three Task 2 commits into one — `security(13-02): harden firewall + CORS headers + prod CORS origins` — at the user's preference.)

---

## Final docs commit (planning artifacts)

**Staged files (force-added because `.planning/` is gitignored):**
- `.planning/phases/13-critical-security-fixes/13-02-SUMMARY.md`
- `.planning/phases/13-critical-security-fixes/13-02-COMMITS.md`
- `.planning/STATE.md` (advanced to 3/3, decisions appended)

**Draft commit message (one line):**

```
docs(13-02): complete Spring Security filter-chain hardening plan
```

---

## Suggested commit sequence (if not squashing)

```bash
# 1. Task 1
git commit -m "security(13-02): shrink SecurityConfig permitAll to 11 ROADMAP-mandated paths; everything else requires auth"
# (only SecurityConfig.java authorizeRequests block is in this commit; the firewall+CORS edits are in the same file but in different hunks — split with `git add -p` or just include them all)

# OR — single combined commit (recommended given everything is on the same hardening theme):
git commit -m "security(13-02): tighten filter chain — shrink permitAll, restore StrictHttpFirewall defaults, explicit CORS headers, drop localhost:5173 from prod origins"
```

