# Technical Debt & Concerns

**Analysis Date:** 2026-03-06

## Summary

| Category | Severity | Count | Key Examples |
|----------|----------|-------|--------------|
| Security | CRITICAL | 12+ | Hardcoded credentials, CORS issues |
| Deprecated Tech | CRITICAL | 5 | Spring Boot 2.5.5 EOL, javax.* imports |
| Code Quality | HIGH | 100+ | Field injection, large classes, System.out.println |
| Database | HIGH | 8+ | Missing validation, N+1 queries, naming inconsistency |
| Performance | MEDIUM | 5+ | Small cache, eager loading, blocking IO |
| Testing | CRITICAL | 0 | No tests at all (backend or frontend) |
| Documentation | MEDIUM | 3+ | No API docs, no migration guide |

---

## 1. CRITICAL SECURITY ISSUES

### Hardcoded Credentials in Source Control

**File:** `spring-social/src/main/resources/application.yml`

Credentials exposed across all profiles:
- Database passwords in plaintext (dev, staging, production)
- Google OAuth2 Client IDs and Secrets
- Facebook and GitHub OAuth2 Secrets
- JWT Token Secret in plaintext
- Mandrill API key (`WXX3fC00pJTZgonjnVvkgQ`)
- Odoo CRM credentials
- Production database password

**Also:** `.env` file contains SMTP password in plaintext.

**Risk:** CRITICAL - All credentials in git history even if removed now.
**Fix:** Migrate ALL secrets to environment variables. Use Spring Cloud Config or HashiCorp Vault.

### Hardcoded Test Password in Code

**File:** `spring-social/src/main/java/com/kccitm/api/service/GoogleAPIAdminImpl.java` (line ~97)
- `newUser.setPassword("Google.com1");` hardcoded for new Google Workspace users.

### CORS Configuration Too Permissive

**File:** `application.yml`
- Dev profile mixes localhost origins with production domains
- `https://*.career-9.com` allows all subdomains
- `allowCredentials = true` likely set
- No CSRF token protection

### JWT Token Expiration Too Long

- Expiration: 864,000,000ms (10 days)
- Stolen tokens valid for 10 days
- No refresh token pattern implemented
- **Fix:** Reduce to 1-4 hours, implement refresh tokens.

### Missing Security Features

- No rate limiting on any endpoint
- No CSRF protection for state-changing operations
- No HSTS headers or HTTPS redirect enforcement
- OAuth2 requests admin.directory.* scopes for all users (overprivileged)

---

## 2. DEPRECATED & OUTDATED DEPENDENCIES

### Spring Boot 2.5.5 (EOL)

**File:** `spring-social/pom.xml` (line 18)
- Released June 2021, EOL November 2022
- No security patches available
- Uses `javax.persistence.*` / `javax.servlet.*` (deprecated, replaced by `jakarta.*`)
- **Fix:** Upgrade to Spring Boot 3.x (requires Java 17+) or at minimum 2.7.x

### Outdated Libraries

| Library | Current | Latest | Risk |
|---------|---------|--------|------|
| commons-io | 2.11.0 | 2.15+ | Known vulnerabilities |
| gson | 2.9.0 | 2.10+ | Security updates |
| jsoup | 1.15.4 | 1.17+ | Security updates |
| jjwt | 0.11.2 | 0.12+ | Security improvements |
| axios (frontend) | 0.26.1 | 1.6+ | 2+ years old, security issues |
| react-query | 3.38.0 | @tanstack/react-query 5.x | Renamed package |
| react-scripts | 5.0.1 | - | EOL concerns |
| mysql-connector-java | (unspecified) | - | No version pinned |

---

## 3. CODE QUALITY & ARCHITECTURE

### Field Injection Anti-pattern (262+ instances)

Found in 79+ files. Should use constructor injection.

**Worst offenders:**
- `StudentController.java`: 19 `@Autowired` fields (lines 14-111)
- `StudentService.java`: 11 `@Autowired` fields (lines 13-77)
- `SecurityConfig.java`: lines 37-47

### Overly Large Controllers

- `StudentController.java`: 590+ lines - contains bulk save, CSV parsing, PDF generation, email sending, registration logic
- `AssessmentAnswerController.java`: Complex scoring logic mixed with HTTP handling
- **Fix:** Extract business logic into service classes

### System.out.println Instead of Logging (82+ instances)

**Critical files:**
- `StudentController.java` (lines 128, 148-149, 175)
- `FacultyContoller.java` (multiple instances)
- `StudentInfoController.java` (11 instances)
- `UniversityMarkController.java` (14 instances)

**Risk:** Logs won't go to proper logging framework in production.

### Bare Exception Catching (29+ instances)

Pattern: `catch (Exception e)` throughout codebase - swallows specific exceptions, masks bugs.

### No Global Exception Handler

- No `@ControllerAdvice` for centralized error handling
- Inconsistent error responses across controllers
- Some return null, some return 404, some throw RuntimeException

### Console Logging in Frontend (374 instances)

`console.error`/`console.warn` throughout `/react-social/src/app/pages/` - sensitive data may leak to browser console.

### Unresolved TODOs (28+ instances)

Scattered across `UserStudent.java`, `DataController.java`, `GoogleAPIAdminImpl.java`, etc.

---

## 4. DATABASE & PERSISTENCE ISSUES

### No Database Migration Tool

**File:** `application.yml` - `ddl-auto: update`
- Auto-migrations don't handle renames, deletes, or constraint changes
- No rollback capability
- **Fix:** Implement Flyway or Liquibase

### Database Naming Inconsistency

| Environment | Database Name |
|-------------|--------------|
| Dev | `career-9` |
| Docker/Staging | `career-9` |
| Production | `kcc_student` |

### Missing Input Validation

- Only 15 occurrences of `@NotNull`, `@NotBlank`, `@Valid` across entire codebase
- `StudentController` - no input validation on POST endpoints
- `AssessmentAnswerController` - manual `Map<String, Object>` casting instead of typed DTOs
- **Risk:** Untrusted data reaches database directly

### N+1 Query Problems

- 39 `findAll()` methods in repositories without `JOIN FETCH`
- Controllers call `findAll()` then iterate over relationships
- **Risk:** Loading 1000 students could trigger 1000+ separate queries

### Eager Loading Issues

**File:** `AssessmentAnswer.java` (lines 36-62)
- All relationships set to `FetchType.EAGER`
- 21 instances of `CascadeType.ALL` or `orphanRemoval=true`
- **Risk:** Loading entire object graphs, memory pressure

### Missing NOT NULL Constraints

- Only 15 validation annotations vs 50+ entity fields
- Database constraints not visible in entity mappings
- **Risk:** Invalid data persists silently

### Transaction Boundary Issues

- Services use `@Autowired` fields but not all methods are `@Transactional`
- **Risk:** `LazyInitializationException` when accessing lazy relationships outside transaction

---

## 5. PERFORMANCE ISSUES

### Limited Caching

- Cache config: Only 4 cache names, max 500 items
- With 50,000+ students, most queries bypass cache
- **Fix:** Increase cache size, add more cacheable queries

### File System Access in Controllers

**File:** `AssessmentTableController.java` (lines 63-119)
- Creates JSON snapshots on disk for locked assessments in `assessment-cache` directory
- **Risk:** Path traversal potential, disk space issues

### Blocking IO in Request Threads

- Email sending, PDF generation block the request thread
- `StudentController` POST `/student/update` blocks on email send
- **Fix:** Use `@Async`, message queues (RabbitMQ, Kafka)

### Inefficient Data Transfer

- `Map<String, Object>` used instead of DTOs in `AssessmentAnswerController`
- No pagination on many `findAll()` endpoints
- Runtime type checking instead of compile-time safety

---

## 6. FRAGILE & TIGHTLY COUPLED AREAS

### Assessment Scoring System

**Files:** `AssessmentAnswerController`, `OptionScoreBasedOnMeasuredQualityTypesRepository`
- Race condition handling via catching `DataIntegrityViolationException`
- Works but fragile - should use database-level constraints + proper locking

### Google Workspace Integration

- `StudentController` directly calls `GoogleAPIAdmin` - if Google API fails, student operations fail
- **Fix:** Decouple with async event processing, fallback behavior

### Dual Language Systems

- `LanguageQuestion` + `LanguageOption` (simple system)
- `QuestionnaireLanguage` + translations (complex system)
- Duplicate logic, inconsistent translations
- **Fix:** Consolidate into single translation system

### Dual Assessment Systems

- Legacy: `AssessmentTable` / `AssessmentQuestions` / `AssessmentQuestionOptions`
- New: `Questionnaire` / `QuestionnaireSection` / `QuestionnaireQuestion`
- Both active, creating confusion about which system to use

---

## 7. TESTING GAPS

| Test Type | Status |
|-----------|--------|
| Unit Tests (Backend) | None - test directory empty |
| Unit Tests (Frontend) | None - 0 test files |
| Integration Tests | None |
| End-to-End Tests | None (no Cypress/Playwright/Selenium) |
| Load/Performance Tests | None |
| **Total Coverage** | **0%** |

---

## 8. BUILD & DEPLOYMENT CONCERNS

### Docker Configuration

- Manual `docker network create career_shared_net` required before compose
- No health checks in service definitions
- No backup strategy documented for MySQL

### Build Configuration

- No validation of required environment variables
- No build-time secret stripping
- Frontend dependencies may not be locked (package-lock.json status unclear)

### Conflicting Dependencies

- `jackson-databind` inherited vs explicit versions
- Multiple `commons-io` declarations in pom.xml
- Potentially unused frontend deps: `draft-js`, `openai`, `jspdf`

---

## 9. MISSING BEST PRACTICES

| Practice | Status |
|----------|--------|
| Service layer abstraction | Partial - some controllers access repos directly |
| Async processing | Missing - blocking IO everywhere |
| API versioning | Missing - all on `/api/` directly |
| Structured logging | Missing - no JSON logs |
| Metrics/observability | Missing - no Micrometer, no tracing |
| API documentation | Missing - no Swagger/OpenAPI |
| Secrets management | Missing - credentials in git |
| Error boundaries (React) | Missing - single error crashes app |
| TypeScript strict mode | Partial - `noImplicitAny: false` |

---

## Immediate Actions Required

1. **Extract credentials to environment variables** (SECURITY CRITICAL)
2. **Remove hardcoded OAuth secrets** from application.yml
3. **Upgrade Spring Boot** to at least 2.7.x (or 3.x with jakarta.*)
4. **Add minimal test suite** (10-15 core integration tests)
5. **Add input validation** to DTOs and entity classes
6. **Implement `@ControllerAdvice`** for centralized exception handling
7. **Replace System.out.println** with SLF4J logging
8. **Implement database migrations** with Flyway or Liquibase