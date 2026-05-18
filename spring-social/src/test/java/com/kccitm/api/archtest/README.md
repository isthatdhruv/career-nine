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

## Current state: DISABLED

The test is `@Disabled` (JUnit 5) while Plans 15-03 / 15-04 / 15-05 are still
rolling out annotations across ~99 controllers. Plan 15-06 removes the
`@Disabled` annotation. From that point on, CI fails if any new endpoint is
added without `@PreAuthorize`.

Shipping the test enabled now would mean broken CI for the entire Wave 2
window — there is no realistic universe where Plans 15-03/04/05 all finish
+ merge in a single commit.

## To run locally

```
cd spring-social
# Comment out @Disabled in ControllerPreAuthorizeCoverageTest, then:
mvn test -Dtest=ControllerPreAuthorizeCoverageTest
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

## See also

- Plan 15-01: `AuthorizationService` and `PermissionCodeValidator`
- Plans 15-03 / 15-04 / 15-05: roll out `@PreAuthorize` across all ~99 controllers
- Plan 15-06: removes the `@Disabled` annotation here and turns this test into a build gate
- `.planning/ROADMAP.md` Phase 15
