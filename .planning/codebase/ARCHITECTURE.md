# Architecture

**Analysis Date:** 2026-03-06

## Pattern: Three-Tier Monolithic Application

```
React SPA (Frontend - port 3000/5173)
    ↓ HTTP/REST (Axios + JWT)
Spring Boot 2.5.5 REST API (Backend - port 8091 dev / 8080 docker)
    ↓ JDBC/JPA (HikariCP)
MySQL 5.7+ Database (port 3306/3307)
```

**Key Characteristics:**
- Frontend: Single Page Application (React 18 + TypeScript)
- Backend: Monolithic Spring Boot REST API
- Database: MySQL with Hibernate ORM (DDL auto-update)
- Authentication: OAuth2 (Google, GitHub, Facebook) + JWT tokens
- Deployment: Docker Compose orchestration

## Application Layers

### 1. Controller Layer (REST Endpoints)

47+ controllers organized by domain:

- `controller/career9/` - Career-Nine specific (assessment, student, scoring)
- `controller/career9/Questionaire/` - Questionnaire management
- `controller/dashboard/` - Dashboard aggregation
- `controller/teacher/` - Teacher-specific
- `controller/principal/` - Principal-specific
- Root controllers: `AuthController`, `UserController`, `StudentInfoController`

**REST Endpoint Pattern:**
```java
@RestController
@RequestMapping("/entity-name")
public class EntityController {
    @GetMapping("/getAll")           // List all
    @GetMapping("/get/{id}")         // Get by ID
    @PostMapping("/create")          // Create
    @PutMapping("/update/{id}")      // Update
    @DeleteMapping("/delete/{id}")   // Delete
}
```

### 2. Service Layer (Business Logic)

30+ services with interface + implementation pattern:

- `EmailService` / `SmtpEmailServiceImpl` / `GmailApiEmailServiceImpl`
- `PdfService` / `PdfServiceImpl` / `StudentPdfServiceImpl`
- `GoogleCloudAPI` / `GoogleCloudAPIImpl`
- `GoogleDirectoryService` / `GoogleDirectoryServiceImpl`
- `StudentService`, `UserService`, `FacultyService`
- `FirebaseService`, `OdooLeadService`
- `DashboardService`, `ClassTeacherDashboardService`, `PrincipalDashboardService`

**Note:** Many controllers bypass the service layer and access repositories directly.

### 3. Repository Layer (Data Access)

83 JPA repositories extending `JpaRepository<Entity, ID>`:

- `repository/Career9/` - Career-Nine domain repositories
- `repository/Career9/Questionaire/` - Questionnaire repositories
- `repository/Career9/School/` - Institute/school repositories
- Root repositories: `UserRepository`, `RoleRepository`, etc.

### 4. Model Layer (JPA Entities)

112 JPA entities organized by domain:

- `model/career9/` - Assessment, scoring, student entities
- `model/career9/Questionaire/` - Questionnaire system entities
- `model/career9/school/` - Institute/school structure
- `model/userDefinedModel/` - Custom DTOs/response objects
- Root models: `User`, `Role`, `Group`, academic structure entities

## Authentication Flow

```
1. User clicks OAuth2 login (Google/GitHub/Facebook)
   ↓
2. Redirected to OAuth2 provider
   ↓
3. Provider redirects to /oauth2/redirect with auth code
   ↓
4. CustomOAuth2UserService processes user info
   ↓
5. OAuth2AuthenticationSuccessHandler generates JWT
   ↓
6. JWT token sent to frontend via redirect URL
   ↓
7. Frontend stores token in localStorage (AuthInit.tsx)
   ↓
8. Axios interceptor adds Authorization header to all requests
   ↓
9. TokenAuthenticationFilter validates JWT on each request
```

**Key Security Classes:**
- `SecurityConfig.java` - OAuth2 + JWT + CORS configuration
- `TokenProvider.java` - JWT generation/validation
- `TokenAuthenticationFilter.java` - Request authentication
- `CustomOAuth2UserService.java` - OAuth2 user processing
- `OAuth2AuthenticationSuccessHandler.java` - Post-auth redirect

## Assessment System Architecture

### Two Parallel Systems

**Legacy Assessment System:**
```
AssessmentTable (assessment definition)
  ↓ has many
AssessmentQuestions (question bank)
  ↓ has many
AssessmentQuestionOptions (answer options)
  ↓ scored by
OptionScoreBasedOnMEasuredQualityTypes (MQT scores)
  ↓ aggregated into
AssessmentRawScore (computed scores per student)
```

**New Questionnaire System:**
```
Questionnaire (structured assessment)
  ↓ has many
QuestionnaireSection (sections with instructions)
  ↓ has many
QuestionnaireQuestion (questions linked to sections)
  ↓ supports
QuestionnaireLanguage (multi-language settings)
```

**Shared between systems:**
- `StudentAssessmentMapping` - Links students to assessments
- `AssessmentAnswer` - Stores student responses
- `AssessmentRawScore` - Stores computed scores

### Scoring Flow

```
Student submits answers (AssessmentAnswerController /submit)
  ↓
Validate student + assessment exist
  ↓
Create/update StudentAssessmentMapping
  ↓
Save each answer to AssessmentAnswer table
  ↓
Look up OptionScoreBasedOnMEasuredQualityTypes for each selected option
  ↓
Accumulate scores by MeasuredQualityType
  ↓
Delete old AssessmentRawScore entries for this mapping
  ↓
Save new AssessmentRawScore entries per MQT
```

### Multi-Language Support

```
LanguageSupported (available languages)
  ↓
LanguageQuestion (translated question text)
  ↓
LanguageOptions (translated option text)
```

## Frontend Architecture

### Routing Structure

**AppRoutes.tsx** - Top-level routes:
- Public: Login, registration, OAuth2 redirect
- Assessment: Student login, assessment taking
- Authenticated: Wrapped in `<PrivateRoutes />`

**PrivateRoutes.tsx** - Protected routes:
- Role-based access via `currentUser.authorityUrls`
- Wildcard patterns (e.g., `/dashboard/*`)
- `ALWAYS_ALLOWED` routes bypass permission checks
- 401 redirect for unauthorized access

### Component Structure Pattern

```
Feature/
├── FeaturePage.tsx              (Main page - data fetching, loading state)
├── API/
│   └── Feature_APIs.ts          (Axios API calls with BASE_URL)
└── components/
    ├── FeatureTable.tsx         (Data table with CRUD buttons)
    ├── FeatureCreatePage.tsx    (Create form with Formik/Yup)
    ├── FeatureEditPage.tsx      (Edit form, pre-filled from URL params)
    └── index.ts                 (Barrel export)
```

### State Management

- **Auth State:** React Context (AuthContext.tsx + useAuth hook)
- **Server State:** React Query for data fetching/caching
- **Form State:** Formik + Yup validation
- **Assessment State:** AssessmentContext.tsx (student assessment flow)
- **No Redux** - all state via hooks and context

### UI Framework

- **Layout:** Metronic theme (`_metronic/layout/MasterLayout.tsx`)
- **Components:** Mix of Material-UI and React Bootstrap
- **Styling:** Bootstrap 5 + SCSS + Metronic custom styles
- **Internationalization:** React Intl (Metronic i18n provider)

## Data Flow: Request → Response

### Example: Create Assessment Question

**Frontend:**
```
User fills form → Submit
  → CreateQuestionPage.tsx calls CreateAssessmentQuestionData(values)
  → axios.post("${API_URL}/assessment-questions/create", values)
  → Request sent with Authorization: Bearer <token>
```

**Backend:**
```
TokenAuthenticationFilter validates JWT
  → AssessmentQuestionController.create() receives request
  → Controller processes DTO, handles business logic
  → AssessmentQuestionRepository.save(entity)
  → Hibernate executes SQL INSERT
  → ResponseEntity<AssessmentQuestion> returned
```

**Frontend:**
```
Response received
  → UI updates (table refreshes, modal closes)
  → Success feedback shown
```

## Entity Relationship Patterns

**One-to-Many:**
- Tool → Questionnaire
- Assessment → AssessmentQuestion
- Questionnaire → QuestionnaireSection → QuestionnaireQuestion

**Many-to-Many:**
- Career ↔ MeasuredQualityTypes
- Tool ↔ MeasuredQualities

**One-to-One:**
- User → StudentInfo
- AssessmentTable → Questionnaire

## Caching Strategy

- **Backend:** Caffeine in-memory cache (500 items, 10min TTL)
- **Cached:** assessmentQuestions, assessmentDetails, measuredQualityTypes, questionnaireQuestions
- **Frontend:** React Query with default stale time

## Key Entry Points

| Entry Point | Location |
|-------------|----------|
| Backend Main | `spring-social/src/main/java/com/kccitm/api/SpringSocialApplication.java` |
| Frontend Main | `react-social/src/index.tsx` |
| Root Component | `react-social/src/app/App.tsx` |
| Routes | `react-social/src/app/routing/AppRoutes.tsx` |
| Private Routes | `react-social/src/app/routing/PrivateRoutes.tsx` |
| Security Config | `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java` |
| App Config | `spring-social/src/main/resources/application.yml` |
| Docker | `docker-compose.yml` |