# Codebase Concerns

**Analysis Date:** 2026-02-06

## Tech Debt

**Unhandled Exception Blocks:**
- Issue: Multiple catch blocks use `e.printStackTrace()` instead of proper logging or error responses
- Files:
  - `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentController.java` (lines 403, 406)
  - `spring-social/src/main/java/com/kccitm/api/controller/StudentInfoController.java` (lines 270, 320, 382, 429, 498, 642)
  - `spring-social/src/main/java/com/kccitm/api/service/PdfServiceImpl.java` (lines 63, 92)
  - `spring-social/src/main/java/com/kccitm/api/service/CsvReaderImp.java` (line 25)
- Impact: Errors silently printed to stdout, not tracked in logging systems or returned to clients; debugging difficult in production
- Fix approach: Replace with proper SLF4J logging and meaningful error responses to API clients

**Generic TODO Comments Without Context:**
- Issue: Auto-generated catch blocks left with placeholder TODOs instead of proper implementation
- Files:
  - `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentController.java` (lines 403, 406, 454, 489)
  - `spring-social/src/main/java/com/kccitm/api/controller/DataController.java` (line 26)
  - `react-social/src/app/pages/StudentInformation/EmailVerification.tsx` (lines 20, 23)
- Impact: Incomplete exception handling leaves code path behavior unclear; client-side verification missing error notifications
- Fix approach: Complete all TODO items with specific logic or create issue tickets for deferred work

**Dangerous List Access Pattern (.get(0)):**
- Issue: Unsafe direct list access without checking if list is empty, causing IndexOutOfBoundsException at runtime
- Files:
  - `spring-social/src/main/java/com/kccitm/api/service/GoogleAPIAdminImpl.java` (lines 185, 238, 304, 307, 309)
  - `spring-social/src/main/java/com/kccitm/api/controller/UserRoleGroupMappingController.java` (lines 103, 105, 106)
  - `spring-social/src/main/java/com/kccitm/api/controller/GoogleAdminController.java` (lines 89, 98, 106)
  - `spring-social/src/main/java/com/kccitm/api/controller/RoleRoleGroupMappingController.java` (lines 68, 94)
  - `spring-social/src/main/java/com/kccitm/api/controller/InstituteBranchController.java` (line 43)
- Impact: Application crashes with unhandled exceptions when list results are empty; no defensive programming for optional results
- Fix approach: Replace all `.get(0)` with proper Optional handling or use `.isEmpty()` checks before access

---

## Known Bugs

**Database Name Inconsistency (kareer-9 vs career-9):**
- Symptoms: Development environment uses `kareer-9` while Docker/staging uses `career-9`; typo inconsistency creates confusion and potential migration errors
- Files: `spring-social/src/main/resources/application.yml`
  - Dev profile (line 18): `jdbc:mysql://localhost:3306/kareer-9`
  - Staging profile (line 100): `jdbc:mysql://mysql_db_api:3306/career-9`
- Trigger: Switching between dev and staging deployments; developers unfamiliar with the typo
- Workaround: Ensure both databases exist with both names or standardize on one name across all profiles
- Priority: High - causes environment-specific failures

**Incomplete Frontend Error Handling:**
- Symptoms: API error responses in `EmailVerification.tsx` are caught but not handled; users receive no feedback
- Files: `react-social/src/app/pages/StudentInformation/EmailVerification.tsx` (lines 20-23)
- Trigger: Any API call failure (network, validation, server error)
- Current state: Error caught but TODO comments indicate handler missing
- Fix approach: Implement proper error notification (toast, modal, or state-based message)

**Null Pointer Risk in Assessment Answer Submission:**
- Symptoms: `AssessmentAnswerController.submitAssessmentAnswers()` assumes all extracted values exist without null checks
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java` (line 80)
- Trigger: Malformed submission data missing required fields (e.g., `userStudentId`, `assessmentId`)
- Current behavior: Results in NumberFormatException or NullPointerException instead of validation error response

---

## Security Considerations

**Hardcoded Credentials in Configuration:**
- Risk: OAuth2 client secrets and API keys exposed in source code (`application.yml`)
- Files: `spring-social/src/main/resources/application.yml`
  - Google OAuth2: Lines 35-36 (clientId, clientSecret)
  - Facebook OAuth2: Lines 47-48 (clientId, clientSecret)
  - GitHub OAuth2: Lines 54-55 (clientId, clientSecret)
  - Mandrill API Key: Line 91
  - JWT Token Secret: Line 72
- Current mitigation: File is checked into git, but `.gitignore` should prevent this
- Recommendations:
  - Move all credentials to environment variables
  - Use Spring Cloud Config or AWS Secrets Manager
  - Rotate all exposed OAuth2 credentials immediately
  - Add pre-commit hook to prevent credential commits

**SQL Injection Risk in Dynamic Queries:**
- Risk: While repository layer uses parameterized queries, some manual query construction may exist
- Files: Search for raw SQL queries in service layer
- Recommendations:
  - Audit all `@Query` annotations for string concatenation
  - Use JPA criteria API or JPQL with parameter binding exclusively

**Overly Permissive CORS Configuration:**
- Risk: CORS allowedOrigins includes broad patterns including IPs and multiple environments
- Files: `spring-social/src/main/resources/application.yml` (line 75)
- Current: Multiple staging/prod domains mixed with localhost and test IPs
- Recommendations:
  - Segregate profiles: dev (localhost only), staging (staging domain), production (production domain)
  - Remove test IPs from production config

**JWT Token Expiration Too Long (10 days):**
- Risk: Token expiration set to 864000000ms = 10 days; longer window increases compromise damage
- Files: `spring-social/src/main/resources/application.yml` (line 73)
- Recommendations:
  - Reduce to 1-2 hours for access tokens
  - Implement refresh token flow for longer-lived sessions
  - Add token revocation support

---

## Performance Bottlenecks

**Manual File-Based Caching Without Invalidation:**
- Problem: Assessment questions cached to `cache/assessment_questions.json` but no TTL or invalidation strategy
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentQuestionController.java` (lines 62-63, 74-89)
- Cause: Static cache file written to disk; stale data served until application restart or manual file deletion
- Risk: Updated questions don't appear to users without restart; no way to invalidate on demand
- Improvement path:
  - Implement Spring Cache abstraction with Redis
  - Add `@CacheEvict` on update/delete operations
  - Set reasonable TTL (5-30 minutes depending on change frequency)

**N+1 Query Pattern in Assessment Scoring:**
- Problem: `AssessmentAnswerController.submitAssessmentAnswers()` likely iterates questions/answers and loads related objects one-by-one
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java` (lines 75-120+)
- Cause: Not using eager loading or batch queries for option scores and measured quality mappings
- Impact: Single assessment submission with 50 questions = 50+ individual queries instead of 1-2 joins
- Improvement path:
  - Use `@EntityGraph` or `LEFT JOIN FETCH` in repository queries
  - Batch load option scores by assessment ID
  - Consider query optimization for scoring calculations

**Large Model Classes Without Proper Indexing:**
- Problem: Large entity models like `Student` (1191 lines) and `CheckRegistrationFeild` (980 lines) have many column properties
- Files:
  - `spring-social/src/main/java/com/kccitm/api/model/Student.java` (1191 lines)
  - `spring-social/src/main/java/com/kccitm/api/model/CheckRegistrationFeild.java` (980 lines)
- Cause: Over-normalized database schema requiring all attributes fetched for every query
- Impact: Slow list endpoints; high memory usage; no selective projection queries
- Improvement path:
  - Create database indexes on frequently searched columns (email, enrollment number)
  - Implement DTOs for list operations to reduce payload
  - Consider schema normalization to reduce attribute count per entity

**Excessive Debug Logging (console.log in React):**
- Problem: 297 `console.log()` calls across 84 frontend files left in production code
- Impact: Memory leaks in browser; performance degradation on logging-heavy components; sensitive data may be logged
- Improvement path:
  - Implement debug flag to enable/disable logging by environment
  - Use proper logging library (e.g., winston, loglevel)
  - Remove or comment out development-only console.logs

---

## Fragile Areas

**Student Information Registration Flow:**
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentController.java`
- Why fragile:
  - Heavy dependency on Google Admin API integration; fails silently if Google is unavailable
  - Nested try-catch blocks with TODO comments hide real error causes
  - Assumes email addresses exist and are unique without validation
  - No transactional consistency: student saved to DB even if Google group add fails
- Safe modification:
  - Add explicit Google API availability check at start of flow
  - Wrap entire flow in transaction with rollback on any failure
  - Add detailed validation with meaningful error messages
- Test coverage: Likely missing integration tests for Google API failure scenarios

**Assessment Answer Submission and Scoring:**
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java`
- Why fragile:
  - Assumes `userStudentId` and `assessmentId` exist without validation
  - No constraint on answer format or value ranges
  - Score calculation logic not visible; possible inconsistency between frontend and backend
  - Deletes previous raw scores without archival; data loss on resubmission
- Safe modification:
  - Add explicit existence checks with meaningful 404/400 responses
  - Validate answer data against question type before saving
  - Implement soft deletes or audit trail for score changes
  - Add logging for all score calculations for debugging

**Questionnaire Update Logic (Complex Nested Relationships):**
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/Questionaire/QuestionnaireController.java` (385 lines)
- Why fragile:
  - Updates questionnaire with sections, questions, and languages in single operation
  - No clear definition of what "update" means (replace all vs merge)
  - Orphaned sections/questions not cleaned up explicitly
  - Language translations may be lost if not included in update payload
- Safe modification:
  - Separate concerns: allow section, question, and language updates independently
  - Implement explicit delete operations for removed items
  - Add tests for edge cases: null sections, empty questions, missing translations
  - Log all structural changes for audit trail

---

## Scaling Limits

**Database Connection Pool:**
- Current capacity: Not explicitly configured; uses Spring Data defaults (10-20 connections)
- Limit: Each assessment submission opens multiple connections for cascading queries; peak load (100 students) = pool exhaustion
- Scaling path:
  - Configure `spring.datasource.hikari.maximum-pool-size` explicitly
  - Implement connection monitoring and alerting
  - Consider read replicas for reporting queries
  - Implement query result caching to reduce connection demand

**File System Cache (assessment_questions.json):**
- Current capacity: Single 5MB+ JSON file served from disk
- Limit: File read/write contention under concurrent API requests; grows unbounded
- Scaling path:
  - Move cache to Redis for distributed access
  - Implement cache eviction policy and TTL
  - Add cache statistics monitoring

**Assessment Results Storage:**
- Current: All raw scores stored in `AssessmentRawScore` table without partitioning
- Limit: Linear scan performance degrades as rows grow; potential growth to 1M+ rows
- Scaling path:
  - Implement table partitioning by assessment ID or date
  - Archive old results to separate schema
  - Create appropriate indexes on (userStudentId, assessmentId)

**OAuth2 Token Storage:**
- Current: JWT tokens are stateless (good) but no token revocation list
- Limit: Cannot invalidate compromised tokens without restart
- Scaling path:
  - Implement Redis-backed token blacklist
  - Add logout functionality that revokes tokens
  - Consider shorter token expiration (currently 10 days)

---

## Dependencies at Risk

**jQuery (via Metronic Theme):**
- Risk: jQuery is legacy; modern React should not use jQuery for DOM manipulation
- Impact: Potential conflicts with React state management; maintenance burden
- Files: `react-social/src/_metronic/` (theme integration)
- Migration plan: Gradually replace jQuery utilities with React hooks and native DOM APIs

**Outdated Spring Boot Version (2.5.5):**
- Risk: Released June 2021; many security patches and features available in 3.x
- Impact: Missing security updates; inability to use modern Spring ecosystem features
- Recommendations:
  - Plan migration to Spring Boot 3.x (Java 17+)
  - Address breaking changes in authentication filters, data access layer
  - Update all transitive dependencies

**Direct Use of iTextPDF for PDF Generation:**
- Risk: iTextPDF requires licensing compliance for commercial use; license terms may conflict with project goals
- Files: `spring-social/src/main/java/com/kccitm/api/service/PdfServiceImpl.java` (and iTextPDF 5.5.13)
- Alternative: Consider Apache PDFBox (LGPL) or OpenPDF (LGPL, open-source fork of iText)

**Mandrill Email Service Dependency:**
- Risk: MailChimp (Mandrill owner) may discontinue service; no warning of deprecation
- Files: Dependency in `application.yml` (line 91 shows API key); usage in `StudentController.java`, `EmailService.java`
- Migration plan: Implement email service abstraction layer; evaluate AWS SES, SendGrid, or self-hosted solution

---

## Missing Critical Features

**Authentication Audit Trail:**
- Problem: No audit log of who accessed what and when; cannot investigate unauthorized access
- Impact: Compliance gap; security investigations impossible
- Recommendation: Implement aspect-based audit logging for all OAuth2 authentication events

**Data Validation Framework:**
- Problem: Validation scattered across controllers with no consistent pattern
- Impact: Inconsistent error messages; malformed data reaches database
- Recommendation: Implement Spring Validation annotations (`@Valid`) with custom validators

**Graceful Error Responses:**
- Problem: Many endpoints return raw exceptions instead of standardized error responses
- Impact: Frontend cannot reliably parse error messages; inconsistent error handling
- Recommendation: Implement `@RestControllerAdvice` with standardized error DTO

---

## Test Coverage Gaps

**StudentController Endpoints - No Tests:**
- What's not tested: Email verification, PDF generation, Google API integration, bulk student import
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentController.java`
- Risk: Regressions in critical student onboarding flow undetected; Google API failures discovered in production
- Priority: High

**AssessmentAnswerController.submitAssessmentAnswers - No Validation Tests:**
- What's not tested: Null submissions, missing students, invalid assessment IDs, score calculation accuracy
- Files: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java`
- Risk: Data integrity issues, score miscalculations affect student results; bugs only found after submission
- Priority: High

**Frontend Assessment Component - No Integration Tests:**
- What's not tested: Form state management, answer submission flow, error handling, multi-page navigation
- Files: `react-social/src/app/pages/StudentOnlineAssessment/`
- Risk: Assessment flows break without detection; user-facing bugs only caught in QA/production
- Priority: Medium

**OAuth2 Security Flows - No Tests:**
- What's not tested: Token validation, redirect URI matching, provider-specific error handling
- Files: `spring-social/src/main/java/com/kccitm/api/security/oauth2/`
- Risk: Security bypasses or token leaks undetected; authentication regressions in updates
- Priority: High

**Database Migration Tests:**
- What's not tested: Hibernate schema updates with real database; custom migrations
- Files: Uses Hibernate `ddl-auto: update` without testing
- Risk: Schema mismatches between environments; data loss on certain updates
- Priority: Medium

---

*Concerns audit: 2026-02-06*
