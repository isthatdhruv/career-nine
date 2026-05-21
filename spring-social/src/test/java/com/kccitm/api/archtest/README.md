# Controller @PreAuthorize Coverage Test

`ControllerPreAuthorizeCoverageTest` enforces that every public HTTP endpoint
(`@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`,
`@RequestMapping`) on every `@RestController` / `@Controller` in
`com.kccitm.api.controller..` carries a `@PreAuthorize` annotation.

## Why

Spring Security's URL-pattern matching is brittle and easy to bypass with a
typo. Method-level `@PreAuthorize` is the source of truth for endpoint
authorization. The ArchUnit test makes "you forgot the annotation" a build
failure instead of a security incident.

The test is a **build-time invariant** — it asserts the annotations are
*present*, independent of whether `SecurityConfig` is in LOG-ONLY or ENFORCE
mode. It will keep firing in CI even after Phase 17 flips runtime to enforce.

## Current state: ENABLED

The test is **enabled** (Plan 15-06 removed `@Disabled`). Any controller mapping
method added without `@PreAuthorize` — and not in the `EXCLUSIONS` allow-list —
fails the build.

> **Auth remediation Phase 0 (Task 0.2):** `DashboardSnapshotController`
> (`/dashboard/admin/snapshot` + `/refresh`) previously had no `@PreAuthorize` and
> was not excluded, so this gate was red (audit CRIT-D). Both methods are now
> annotated (`dashboard.admin.read` / `dashboard.admin.refresh`), restoring a green
> baseline. **CI note:** there is no `.github/workflows` in this repo today, so the
> "runs on every PR" guarantee is an infrastructure action outside the codebase —
> wire `mvn -Dtest=ControllerPreAuthorizeCoverageTest,PermissionCatalogSeedCoverageTest test`
> into the PR pipeline so these build-time invariants actually gate merges.

## To run locally

```
cd spring-social
mvn -Dtest=ControllerPreAuthorizeCoverageTest test
```

The failure message lists each missing method as
`com.kccitm.api.controller.X#method` — grep-friendly for the executors of
Plans 15-03 / 15-04 / 15-05.

## Exclusions

A small allow-list of endpoints is exempt from the requirement. Each
exclusion has a one-line justification in the source code's `EXCLUSIONS`
set. Current entries:

- `AuthController#login` / `#signup` / `#refresh` / `#logout` / `#me` —
  these ESTABLISH the auth context; they cannot also consume it.
- `PaymentWebhookController#handleWebhook` — authenticated by Razorpay
  HMAC signature, not user JWT.
- `HeartbeatController#ping` — anonymous, configured in `SecurityConfig`.
- `LeadController#captureLead` — public marketing form (Phase 13 confirmed).

To add an exclusion: edit `EXCLUSIONS` in
`ControllerPreAuthorizeCoverageTest.java` and include a one-line
justification. Keep the list minimal — a too-permissive exclusion list
defeats the purpose of the gate.

## Adding new endpoints

Always include `@PreAuthorize` referencing a `PermissionCode` enum constant:

```java
@GetMapping("/getbyid/{id}")
@PreAuthorize("@auth.allows('student.read', #instituteId)")
public Student getById(@PathVariable Long id, @RequestParam Integer instituteId) { ... }
```

`AuthorizationService` (Plan 15-01) resolves the SpEL `@auth` bean; the
`PermissionCodeValidator` fails startup if the permission literal is not a
member of the `PermissionCode` enum (Phase 14).

---

# Permission Catalog Seed Coverage Test (Phase 0, Task 0.4)

`PermissionCatalogSeedCoverageTest` is the companion build-time invariant. It parses
the Flyway migrations and asserts that **every `PermissionCode` enum value is seeded
into the `permission` table** by some `INSERT INTO permission` statement.

## Why a second test

`PermissionCodeValidator` (boot-time) catches *controller → enum* drift: an
`@auth.allows('typo')` literal that is not an enum member fails startup. It does
**not** catch *enum → DB* drift: a code that exists in the enum but was never seeded
is invisible at runtime, so no role can be granted it. Once `auth.enforce-mode` flips
to `enforce` (remediation Phase 6), every endpoint gated on an unseeded code would
403 for non-super-admins. This test makes that a build failure instead.

```
cd spring-social
mvn -Dtest=PermissionCatalogSeedCoverageTest test
```

## Not covered: grant coverage (needs live data — Phase 6 soak)

Neither build-time test can verify a seeded code is actually **granted** to a role
group that real users belong to. Run this diagnostic against the target DB during the
sandbox soak, before flipping `enforce`, to find permission codes referenced by
`@PreAuthorize` that no role currently grants (super-admins bypass, so they are not a
substitute for a real grant):

```sql
-- Codes that exist in the catalog but are granted to NO role.
SELECT p.code
FROM permission p
LEFT JOIN role_permission rp ON rp.permission_id = p.id
WHERE rp.permission_id IS NULL
ORDER BY p.code;
```

Any code in that list which a legitimate (non-super-admin) flow needs must be granted
to the appropriate role group before the `enforce` flip, or that flow breaks.

## See also

- Plan 15-01: `AuthorizationService` and `PermissionCodeValidator`
- Plans 15-03 / 15-04 / 15-05: roll out `@PreAuthorize` across all ~99 controllers
- Plan 15-06: removes the `@Disabled` annotation here and turns this test into a build gate
- `docs/AUTH_REMEDIATION_PLAN.md` Phase 0 (Tasks 0.1–0.4)
- `.planning/ROADMAP.md` Phase 15
