# Testing

**Analysis Date:** 2026-03-06

## Current Status: No Tests

| Metric | Value |
|--------|-------|
| Backend unit tests | 0 |
| Frontend component tests | 0 |
| Integration tests | 0 |
| E2E tests | 0 |
| Total coverage | **0%** |
| CI/CD pipeline | Not configured |

## Test Frameworks (Installed but Unused)

### Backend

**Dependencies in `pom.xml`:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>

<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-test</artifactId>
    <scope>test</scope>
</dependency>
```

**Included via spring-boot-starter-test:**
- JUnit 5 (Jupiter)
- Mockito (mocking)
- AssertJ (fluent assertions)
- Hamcrest matchers
- JSONAssert

### Frontend

**Dependencies in `package.json`:**
```json
"@testing-library/jest-dom": "5.16.4",
"@testing-library/react": "13.1.1",
"@testing-library/user-event": "13.5.0"
```

**ESLint test config:**
```json
"eslintConfig": {
    "extends": ["react-app", "react-app/jest"]
}
```

## Test File Locations

### Backend
- **Expected location:** `spring-social/src/test/java/com/kccitm/api/`
- **Current state:** Directory exists but is **empty**

### Frontend
- **Expected location:** Alongside source files as `*.test.tsx` / `*.spec.tsx`
- **Current state:** **No test files found** anywhere in `react-social/src/`

## How to Run Tests

### Backend
```bash
cd spring-social

# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=AssessmentTableControllerTest

# Run with coverage (requires jacoco plugin)
mvn test jacoco:report

# Skip tests during build
mvn clean package -DskipTests
```

### Frontend
```bash
cd react-social

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

**Note:** Commands are functional but execute no tests.

## What Should Be Tested

### Backend Priority Areas

**Controllers (47+ endpoints):**
- CRUD operations (happy path + error cases)
- Input validation and error responses
- Authentication/authorization checks
- Cache behavior (`@Cacheable`, `@CacheEvict`)

**Critical Services:**
- `AssessmentAnswerController` — scoring logic, ranking calculations
- `StudentController` — registration, bulk save, PDF generation
- `QuestionnaireController` — complex nested updates
- `EmailService` — email sending workflows
- `TokenProvider` — JWT generation/validation

**Repositories:**
- Custom `@Query` methods
- Complex joins and aggregations

### Frontend Priority Areas

**Component Rendering:**
- Page components load and display data
- Tables render correct columns/rows
- Modals open/close properly

**User Interactions:**
- Form submission (create, edit)
- Button clicks (delete, export)
- Navigation between pages

**State Management:**
- Auth context (login/logout flow)
- Form validation (Formik + Yup)
- API error handling

## CI/CD Configuration

**Current state:** No CI/CD pipeline exists.

**No configuration files found:**
- No `.github/workflows/`
- No `.gitlab-ci.yml`
- No `Jenkinsfile`

**Build commands (manual only):**
```bash
# Backend
mvn clean package              # Includes tests
mvn clean package -DskipTests  # Skip tests

# Frontend
npm run build                  # Production
npm run build:stage            # Staging
npm run build:production       # Production with env

# Docker (no test step)
docker-compose up -d --build
```

## Testing Gaps & Risks

| Area | Risk Level | Impact |
|------|-----------|--------|
| Assessment scoring logic | CRITICAL | Incorrect student scores |
| OAuth2/JWT authentication | CRITICAL | Security bypass |
| Student registration flow | HIGH | Data integrity |
| Questionnaire CRUD | HIGH | Data loss on updates |
| Excel import/export | HIGH | Silent data corruption |
| PDF generation | MEDIUM | Broken ID cards |
| Email sending | MEDIUM | Lost notifications |
| Frontend form validation | MEDIUM | Invalid data submitted |
| Cache invalidation | MEDIUM | Stale data served |
| Google API integration | LOW | External dependency |