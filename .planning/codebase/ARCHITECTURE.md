# Architecture

**Analysis Date:** 2026-02-06

## Pattern Overview

**Overall:** Three-Tier Client-Server Monolithic Architecture with OAuth2-based Authentication

**Key Characteristics:**
- Stateless REST API backend with JWT token authentication
- Single-Page Application frontend with context-based state management
- MySQL relational database with Hibernate ORM
- Multi-provider OAuth2 (Google, GitHub, Facebook) for user authentication
- Dual assessment systems: legacy AssessmentTable + new Questionnaire model

## Layers

**Presentation Layer (Frontend):**
- Purpose: React SPA providing user interface for assessment, student management, and reporting
- Location: `src/app/pages/`, `src/app/modules/`
- Contains: Page components, modals, forms, routing configuration
- Depends on: HTTP REST API via axios, React Router, Context APIs for state
- Used by: End users (students, faculty, admins)

**API Layer (Controllers):**
- Purpose: REST endpoints exposing business operations
- Location: `src/main/java/com/kccitm/api/controller/career9/`
- Contains: Spring RestControllers with @GetMapping, @PostMapping, @PutMapping, @DeleteMapping endpoints
- Depends on: Services, repositories, security filters
- Used by: Frontend application via HTTP

**Service Layer:**
- Purpose: Business logic, Google API integrations, PDF/email generation
- Location: `src/main/java/com/kccitm/api/service/`
- Contains: Service interfaces and implementations for Google Directory API, Cloud Storage, PDF generation, email (Mandrill)
- Depends on: Repositories, external SDKs (Google Admin SDK, iTextPDF, Mandrill)
- Used by: Controllers for complex operations (student email generation, PDF cards, Google Groups)

**Repository Layer (Data Access):**
- Purpose: Database abstraction via Spring Data JPA
- Location: `src/main/java/com/kccitm/api/repository/Career9/`
- Contains: JPA repository interfaces with custom query methods
- Depends on: JPA, Hibernate, MySQL dialect
- Used by: Services and controllers for CRUD and custom queries

**Domain Model (Entities):**
- Purpose: JPA entities representing database tables
- Location: `src/main/java/com/kccitm/api/model/career9/`
- Contains: Entity classes with @Entity, @Table, @JoinColumn annotations
- Depends on: JPA annotations, Hibernate
- Used by: Repositories for ORM mapping

**Security Layer:**
- Purpose: Authentication, authorization, OAuth2 handling
- Location: `src/main/java/com/kccitm/api/security/`
- Contains: JWT token handling, OAuth2 user service, authentication filters, user principals
- Depends on: Spring Security, JWT library
- Used by: Security configuration for request filtering

## Data Flow

**Authentication Flow:**
1. User initiates OAuth2 login (Google/GitHub/Facebook) via frontend
2. Frontend receives auth token from OAuth2 provider callback (`/oauth2/redirect`)
3. Spring Security processes OAuth2 callback → CustomOAuth2UserService loads/creates User
4. OAuth2AuthenticationSuccessHandler generates JWT token
5. Token stored in localStorage (frontend) and used in subsequent API calls via Authorization header
6. TokenAuthenticationFilter validates JWT on each request

**Assessment Completion Flow:**
1. Student loads StudentOnlineAssessment page
2. Frontend fetches available assessments via `/assessments/student/{userStudentId}`
3. Student starts assessment → calls `/assessments/startAssessment` (sets status to "ongoing")
4. Student answers questions → submitted to `/assessment-answer/submit`
5. Backend validates UserStudent + AssessmentTable, creates StudentAssessmentMapping
6. Calculates raw scores from OptionScoreBasedOnMEasuredQualityTypes
7. Saves AssessmentRawScore entries per MeasuredQualityType
8. Returns scores to frontend for result display

**Question Management Flow:**
1. Admin uploads Excel via QuestionBulkUploadModal
2. Frontend parses Excel → displays preview with Next/Previous navigation
3. Admin edits questions, options, MQT scores in modal
4. Submits all questions → each question calls `/assessment-questions/create`
5. Backend processes question with options and MQT score mappings
6. Returns results to frontend for confirmation

**State Management - Frontend:**
- Global auth state: `AuthContext` → stores JWT token, current user
- Page-level state: React useState, individual page contexts
- Assessment state: `AssessmentProvider` context for test-taking flow
- Data context: `DataProvider` for games module

**State Management - Backend:**
- Stateless: All state in request/response, JWT contains user identity
- Database: AssessmentTable, StudentAssessmentMapping track assessment progress
- Session: None (disabled in SecurityConfig)

## Key Abstractions

**Assessment (Dual Model):**
- Purpose: Represents evaluations students take
- Examples: `src/main/java/com/kccitm/api/model/career9/AssessmentTable.java`, `Questionnaire.java`
- Pattern: AssessmentTable links to Questionnaire; legacy system also has standalone AssessmentQuestions
- Flow: Assessment → StudentAssessmentMapping → AssessmentAnswer (responses) → AssessmentRawScore (results)

**Measured Quality Types (MQT):**
- Purpose: Psychometric scoring dimensions (e.g., "Leadership", "Problem-Solving")
- Examples: `MeasuredQualityTypes.java`, `MeasuredQualities.java`
- Pattern: Questions → Options → OptionScoreBasedOnMeasuredQualityTypes (mapping scores to QT)
- Tree: Tool → MeasuredQualities → MeasuredQualityTypes

**Student Entities:**
- Purpose: Represent student records in system
- Examples: `UserStudent.java`, `StudentInfo.java`
- Pattern: UserStudent (OAuth2 user account), StudentInfo (registration details), linked via student ID

**Language Support:**
- Purpose: Multi-language content storage
- Examples: `LanguageQuestion.java`, `LanguageOption.java`, `QuestionnaireLanguage.java`
- Pattern: Question/Option → LanguageQuestion/LanguageOption (translations by language ID)

**Google Integration:**
- Purpose: Directory API, Groups, Cloud Storage
- Examples: `GoogleDirectoryService.java`, `GoogleGroupHandler.java`, `GoogleCloudAPI.java`
- Pattern: Service interfaces with Impl classes; configured via google.json service account

## Entry Points

**Backend Application Entry:**
- Location: `src/main/java/com/kccitm/api/SpringSocialApplication.java`
- Triggers: Spring Boot main() method on server start
- Responsibilities: Initialize Spring context, enable configuration properties (AppProperties)

**Frontend Application Entry:**
- Location: `src/index.tsx`
- Triggers: React app mount to DOM root element
- Responsibilities: Initialize providers (QueryClient, AuthProvider, AssessmentProvider, BrowserRouter), setup axios interceptors

**Auth Redirect Entry:**
- Location: `src/app/pages/authRedirectPage.tsx`
- Triggers: OAuth2 callback from provider (`/oauth2/redirect` route)
- Responsibilities: Extract JWT token from URL query, save to context, redirect to authenticated page

**Assessment Start Entry:**
- Location: `src/app/pages/StudentOnlineAssessment/StudentOnlineAssessment.tsx`
- Triggers: Student navigates to assessment taking page
- Responsibilities: Load assessments, initialize assessment context, render question UI

## Error Handling

**Strategy:** Exception-driven with HTTP status codes mapping

**Patterns:**
- Custom exceptions in `src/main/java/com/kccitm/api/exception/`: ResourceNotFoundException (404), BadRequestException (400), OAuth2AuthenticationProcessingException
- @ResponseStatus annotations map exceptions to HTTP status codes
- Controllers return ResponseEntity with explicit status: `.ok()`, `.notFound()`, `.status(HttpStatus.X)`
- Frontend axios interceptors (AuthHelpers) handle 401 → logout flow
- Frontend try-catch blocks in API calls with error console logging

## Cross-Cutting Concerns

**Logging:** Console.log in frontend components; SLF4J (Spring default) in backend with show-sql: true for Hibernate queries

**Validation:**
- Frontend: FormBuilder/Formik-style form handling in modals
- Backend: JPA entity validation, null checks before operations

**Authentication:**
- Frontend: JWT token stored in localStorage, checked in AuthInit on app load
- Backend: SecurityConfig → TokenAuthenticationFilter validates JWT on each request, UsernamePasswordAuthenticationFilter for OAuth2

**Authorization:**
- Method-level: @PreAuthorize, @Secured annotations (enabled in SecurityConfig)
- Role-based: Current user roles checked in UserPrincipal from token claims

**CORS:**
- Configured in WebMvcConfig.java
- Allowed origins from application.yml (dev/staging profiles have different origins)

---

*Architecture analysis: 2026-02-06*
