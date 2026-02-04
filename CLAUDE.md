# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Career-Nine is a full-stack educational platform for student assessment, career guidance, and academic management. It consists of a Spring Boot REST API backend, React TypeScript frontend, and a Node.js translation microservice.

**Tech Stack:**
- Backend: Spring Boot 2.5.5, Java 11, MySQL 5.7+
- Frontend: React 18, TypeScript, Material-UI, Bootstrap 5
- Build Tools: Maven (backend), npm/react-scripts (frontend)

## Architecture

### Three-Tier Monolithic Application

```
React SPA (port 3000)
    ↓ HTTP/REST
Spring Boot API (port 8091 dev, 8080 docker)
    ↓ JDBC
MySQL Database (port 3306)
```

**Backend Structure (Spring Boot):**
- `controller/` - REST endpoints (47+ controllers)
- `service/` - Business logic (24 services)
- `repository/` - JPA repositories (73+ repositories)
- `model/` - JPA entities
- `security/` - OAuth2 + JWT authentication
- `config/` - Application configuration

**Frontend Structure (React):**
- `pages/` - Feature pages (40+ pages)
- `modules/` - Feature modules (role, roleUser)
- `_metronic/` - UI framework/layout system
- `routing/` - React Router configuration
- `model/` - TypeScript interfaces

### Key Subdomains

**Academic Management:** Institute, Branch, Course, Section, Session, Batch structure

**Assessment System:**
- `AssessmentTable` - Assessment definitions
- `AssessmentQuestions` - Question bank with language support
- `Questionnaire` - Structured questionnaires with sections
- `MeasuredQualityTypes` - Scoring dimensions
- `StudentAssessmentMapping` - Student-assessment relationships

**User Management:**
- Multi-provider OAuth2 (Google, GitHub, Facebook)
- JWT token-based authentication
- Role-based access control
- Google Workspace integration (Groups, Directory)

## Development Commands

### Backend (Spring Boot)

**Local Development:**
```bash
cd spring-social

# Run with dev profile (uses localhost MySQL)
mvn spring-boot:run

# Run with specific profile
mvn spring-boot:run -Dspring-boot.run.profiles=staging

# Build JAR
mvn clean package

# Run tests
mvn test

# Run single test class
mvn test -Dtest=ControllerTest

# Skip tests during build
mvn clean package -DskipTests
```

**Configuration:**
- Dev profile: `application.yml` (spring.profiles: dev)
- Database: `kareer-9` database on localhost:3306
- Server port: 8091
- Default credentials: root/Career-qCsfeuECc3MW

### Frontend (React)

```bash
cd react-social

# Install dependencies
npm install

# Start dev server (port 3000)
npm start

# Build for production
npm run build

# Build with staging environment
npm run build:stage

# Build with production environment
npm run build:production

# Run tests
npm test

# Lint check
npm run lint

# Format code
npm run format
```

**Environment-specific builds:**
- `staging.env` - Staging environment variables
- `production.env` - Production environment variables

### Docker Deployment

```bash
# Create shared network (required)
docker network create career_shared_net

# Start MySQL + Spring Boot API
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker logs -f <container_name>

# Rebuild and restart
docker-compose up -d --build
```

**Docker Services:**
- `mysql_db_api` - MySQL 5.7+ (port 3306, database: career-9)
- `api` - Spring Boot JAR (port 8080)

## Database Configuration

**Database Name:** `kareer-9` (dev) / `career-9` (docker/staging)

**Connection Details:**
- Dev: `jdbc:mysql://localhost:3306/kareer-9`
- Docker: `jdbc:mysql://mysql_db_api:3306/career-9`
- User: `root`
- Password: `Career-qCsfeuECc3MW`

**Hibernate DDL:** `update` (auto-creates/updates tables)

**Note:** The database names are inconsistent (`kareer-9` vs `career-9`). Dev profile uses `kareer-9` while Docker/staging uses `career-9`.

## API Patterns

### Controller Conventions

**REST Endpoint Patterns:**
```java
@RestController
@RequestMapping("/entity-name")
public class EntityController {
    @GetMapping("/getAll")           // List all
    @GetMapping("/get/{id}")         // Get by ID
    @PostMapping("/create")          // Create new
    @PutMapping("/update/{id}")      // Update existing
    @DeleteMapping("/delete/{id}")   // Delete
}
```

**Response Patterns:**
- Use `ResponseEntity<T>` for explicit status codes
- Return `ResponseEntity.ok(data)` for successful responses
- Return `ResponseEntity.notFound().build()` for missing entities
- Return `ResponseEntity.status(HttpStatus.X).body(message)` for errors

### Repository Patterns

**Standard JPA Repository:**
```java
public interface EntityRepository extends JpaRepository<Entity, Long> {
    // Custom query methods
    List<Entity> findByProperty(String property);
    Optional<Entity> findByUniqueField(String field);
}
```

**Common Queries:** Use Spring Data JPA method naming conventions

### Career9 Controllers & Endpoints

All career9 controllers are located in `controller/career9/` package.

#### Questionnaire Management

**QuestionnaireController** (`/api/questionnaire`)
- `POST /create` - Create questionnaire with sections, questions, languages
- `GET /get` - Get all questionnaires with full data
- `GET /get/list` - Get questionnaire list (projection)
- `GET /getbyid/{id}` - Get questionnaire by ID
- `PUT /update/{id}` - Update questionnaire (handles complex nested updates)
- `DELETE /delete/{id}` - Delete questionnaire
- `POST /questionnaire-lelo` - Get questionnaire by ID (legacy endpoint)

**QuestionnaireLanguageController** (`/api/questionnaire-language`)
- `POST /create` - Create questionnaire language settings
- `GET /getAll` - Get all questionnaire languages
- `GET /getbyid/{id}` - Get by ID
- `PUT /update/{id}` - Update language settings
- `DELETE /delete/{id}` - Delete language settings

#### Assessment Management

**AssessmentTableController** (`/assessments`)
- `POST /create` - Create assessment instance (links to questionnaire)
- `GET /getAll` - Get all assessments
- `GET /get/list` - Get assessment list
- `GET /{id}` - Get assessment status (isActive)
- `GET /getById/{id}` - Get assessment details by ID
- `GET /getby/{id}` - Get questionnaire for assessment
- `GET /{assessmentId}/student/{userStudentId}` - Get assessment status for student
- `GET /student/{userStudentId}` - Get all assessments for student
- `GET /get/list-ids` - Get assessment ID-name map
- `POST /startAssessment` - Start assessment (sets status to "ongoing")
- `PUT /update/{id}` - Update assessment
- `DELETE /{id}` - Delete assessment

**AssessmentQuestionController** (`/assessment-questions`)
- `GET /getAll` - Get all questions (with caching)
- `GET /getAllList` - Get questions projection (without options/scores)
- `GET /get/{id}` - Get question by ID
- `POST /create` - Create assessment question
- `PUT /update/{id}` - Update question (replaces options entirely)
- `DELETE /delete/{id}` - Delete question
- `GET /export-excel` - Export all questions to Excel (with MQT scores)
- `POST /import-excel` - Import questions from Excel (bulk create/update)

**AssessmentQuestionOptionsController** (`/assessment-question-options`)
- `GET /getAll` - Get all options
- `GET /get/{id}` - Get option by ID
- `GET /by-question/{questionId}` - Get options for question
- `POST /create` - Create option
- `PUT /update/{id}` - Update option
- `DELETE /delete/{id}` - Delete option

**AssessmentAnswerController** (`/assessment-answer`)
- `GET /getAll` - Get all assessment answers
- `GET /getByStudent/{studentId}` - Get answers for student
- `POST /submit` - Submit student answers and calculate raw scores

Key features:
- Validates UserStudent and AssessmentTable existence
- Creates/updates StudentAssessmentMapping with status
- Saves each answer to AssessmentAnswer table
- Accumulates scores from OptionScoreBasedOnMEasuredQualityTypes
- Deletes old AssessmentRawScore entries for the mapping
- Saves new AssessmentRawScore entries per MeasuredQualityType

#### Scoring System

**ToolController** (`/tools`)
- `GET /getAll` - Get all psychometric tools
- `GET /get/{id}` - Get tool by ID
- `POST /create` - Create tool (auto-sets price=0 if free)
- `PUT /update/{id}` - Update tool
- `DELETE /delete/{id}` - Delete tool (clears measured quality mappings)
- `POST /{toolId}/measured-qualities/{qualityId}` - Add quality to tool
- `DELETE /{toolId}/measured-qualities/{qualityId}` - Remove quality from tool
- `GET /{toolId}/measured-qualities` - Get tool's measured qualities

**MeasuredQualitiesController** (`/measured-qualities`)
- `GET /getAll` - Get all measured qualities
- `GET /get/{id}` - Get quality by ID
- `POST /create` - Create measured quality
- `PUT /update/{id}` - Update quality (name, description, displayName)
- `DELETE /delete/{id}` - Delete quality (nullifies child types)
- `POST /{qualityId}/tools/{toolId}` - Add tool to quality
- `DELETE /{qualityId}/tools/{toolId}` - Remove tool from quality
- `GET /{qualityId}/tools` - Get quality's tools

**MeasuredQualityTypesController** (`/measured-quality-types`)
- `GET /getAll` - Get all quality types
- `GET /get/{id}` - Get type by ID
- `POST /create` - Create quality type
- `PUT /update/{id}` - Update type (name, description, displayName)
- `DELETE /delete/{id}` - Delete type (nullifies option scores)
- `POST /{typeId}/careers/{careerId}` - Add career to type
- `DELETE /{typeId}/careers/{careerId}` - Remove career from type
- `GET /{typeId}/careers` - Get type's careers
- `PUT /{typeId}/assign-quality/{qualityId}` - Assign type to quality
- `PUT /{typeId}/remove-quality` - Remove type from quality

**OptionScoreController** (`/option-scores`)
- `GET /getAll` - Get all option scores
- `GET /get/{id}` - Get score by ID
- `POST /create` - Create option scores (batch)
- `PUT /update/{id}` - Update option score
- `DELETE /delete/{id}` - Delete option score

**CareerController** (`/career`)
- `GET /getAll` - Get all careers
- `GET /get/{id}` - Get career by ID
- `GET /{id}/measured-quality-types` - Get quality types for career
- `POST /create` - Create career
- `PUT /update/{id}` - Update career (title, description)
- `DELETE /delete/{id}` - Delete career (clears quality type mappings)

#### Multi-Language Support

**LanguagesSupportedController** (`/language-supported`)
- `GET /getAll` - Get all supported languages
- `GET /get/{id}` - Get language by ID
- `POST /create` - Create supported language

**LanguageQuestionController** (`/language-question`)
- `GET /getAll` - Get all language questions
- `GET /get/{id}` - Get language question by ID
- `POST /create` - Create language question (simple)
- `POST /create-with-options` - Create language question with options (replaces existing)

Key behavior:
- Deletes existing translations for same questionId + languageId
- Sets bidirectional relationships for options
- Links options to language and languageQuestion

**LanguageOptionsController** (`/language-options`)
- Similar CRUD for language options

#### Section Management

**QuestionSectionController** (`/question-sections`)
- `GET /getAll` - Get all sections
- `GET /getAllList` - Get sections projection
- `GET /get/{id}` - Get section by ID
- `GET /{id}/questions` - Get questions in section
- `POST /create` - Create section
- `PUT /update/{id}` - Update section (name, description)
- `DELETE /delete/{id}` - Delete section (nullifies question.section)

#### Student Management

**StudentController** (`/student/*`)
- `GET /student/get` - Get all students
- `GET /student/getbyid/{id}` - Get student by ID with full data
- `POST /student/save-csv` - Save student from CSV
- `POST /student/update` - Update student registration
- `POST /student-email/update` - Generate official email
- `GET /generate_pdf` - Generate student ID card PDF
- `GET /generate_id_card` - Generate and email ID card
- `POST /student/getSavetoDatabase` - Bulk save students
- `POST /student/emailChecker` - Check if email exists
- `GET /email-validation-official` - Validate kccitm.edu.in email
- `GET /email-validation-official-confermation` - Verify OTP

Key integrations:
- Google Admin API for user/group management
- Mandrill for email sending
- PDF generation service
- Google Cloud Storage for file uploads

#### Institute Management

**InstituteDetailController** (`/institute-detail` or similar)
- CRUD for institutes/schools
- Manages institute sessions, courses, contact persons

**SchoolSessionController** (`/school-session` or similar)
- Session management for schools

#### Game Integration

**GameTableController** (`/game-table` or similar)
- CRUD for game-based assessment options

### Authentication Flow

**OAuth2 Providers:** Google, GitHub, Facebook

**JWT Token:**
- Secret: Configured in `application.yml` (app.auth.tokenSecret)
- Expiration: 864000000ms (10 days)
- Header: `Authorization: Bearer <token>`

**Authorized Redirect URIs:** Configured per profile in `application.yml`

## Frontend Patterns

### Component Structure

**Page Components:** Located in `src/app/pages/[Feature]/`

**Typical Page Structure:**
```
Feature/
├── FeaturePage.tsx          // Main page container
├── API/
│   └── Feature_APIs.ts      // API calls with axios
└── components/
    ├── FeatureTable.tsx     // Data table
    ├── FeatureCreateModal.tsx
    ├── FeatureEditPage.tsx
    └── index.ts             // Barrel exports
```

### API Integration

**Base URL Configuration:**
- Set via environment variables
- Axios instance configured in API files
- Common pattern: `axios.get/post/put/delete`

**Typical API File:**
```typescript
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091';

export function getAllEntities() {
  return axios.get(`${BASE_URL}/entity-name/getAll`);
}

export function getEntityById(id: number) {
  return axios.get(`${BASE_URL}/entity-name/get/${id}`);
}
```

### Routing

**Main Routes:** Defined in `src/app/routing/AppRoutes.tsx` and `PrivateRoutes.tsx`

**Private Routes:** Wrapped in authentication check

**Layout:** Uses Metronic layout system (`_metronic/layout/`)

## Key Integrations

### Google Cloud Services

**Required Files:**
- `google.json` - Service account credentials (in classpath)
- `firebase-service-account.json` - Firebase admin SDK

**Capabilities:**
- Cloud Storage for file uploads
- Admin Directory API for user/group management
- OAuth2 authentication

### Firebase

**Project ID:** `career-library`

**Frontend Integration:** Firebase SDK initialized in `src/app/firebase.ts`

### Email Service

**Provider:** Mandrill (transactional email)

**API Key:** Configured in `application.yml` (app.mandrill)

### PDF Generation

**Libraries:**
- iTextPDF 5.5.13
- OpenHTMLtoPDF 1.0.10
- Flying Saucer 9.1.20

**Service:** `PdfServiceImpl` handles HTML-to-PDF conversion

## Common Development Tasks

### Adding a New Entity

1. **Backend:**
   - Create JPA entity in `model/` package
   - Create repository interface in `repository/` package
   - Create controller in `controller/` package
   - Add service layer if business logic is needed

2. **Frontend:**
   - Create TypeScript interface in `model/` directory
   - Create API functions in `pages/[Feature]/API/`
   - Create page component and table component
   - Add routing in `AppRoutes.tsx` or `PrivateRoutes.tsx`
   - Add menu item in `AsideMenuMain.tsx`

### Working with Assessments/Questionnaires

**Assessment System has two parallel implementations:**

1. **Legacy Assessment System:**
   - `AssessmentTable` - Main assessment definitions
   - `AssessmentQuestions` - Questions with options
   - `AssessmentQuestionOptions` - Answer options with scoring
   - Located in standard `career9/` package

2. **New Questionnaire System:**
   - `Questionnaire` - Structured assessments
   - `QuestionnaireSection` - Sections within questionnaires
   - `QuestionnaireQuestion` - Questions linked to sections
   - `QuestionnaireLanguage` - Multi-language support
   - Located in `career9/Questionaire/` package

**Note:** When working with assessments, clarify which system is being used.

### Database Migrations

**Hibernate Auto-Update:** Enabled (`ddl-auto: update`)

**Manual Migrations:** Place SQL files in project root if needed (e.g., `Dump20260130 (1).sql`)

**Caution:** Auto-update doesn't handle column renames or complex schema changes. Test in dev first.

## Testing

### Backend Tests

**Framework:** Spring Boot Test + JUnit

**Location:** `src/test/java/`

**Run all tests:** `mvn test`

**Run specific test:** `mvn test -Dtest=ClassName`

### Frontend Tests

**Framework:** React Testing Library + Jest

**Run tests:** `npm test`

**Test files:** `*.test.tsx` or `*.spec.tsx`

## Git Workflow

**Main Branch:** `main`

**Current Branch:** Can vary (e.g., `dhruv-from-palak`)

**Commit Style:** Follow existing patterns (e.g., "Added Feature to manually add a student")

## Troubleshooting

### Backend Won't Start

- Verify MySQL is running on port 3306
- Check database exists: `kareer-9` (dev) or `career-9` (docker)
- Verify credentials: root/Career-qCsfeuECc3MW
- Check `google.json` exists in classpath
- Verify Java 11 is installed: `java -version`

### Frontend Build Fails

- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version compatibility with React 18
- Verify environment file exists if using `npm run build:stage/production`

### Docker Issues

- Ensure network exists: `docker network create career_shared_net`
- Check port conflicts (3306, 8080)
- View logs: `docker logs <container_name>`
- Rebuild images: `docker-compose up -d --build`

### CORS Errors

- Check `application.yml` → `app.cors.allowedOrigins`
- Add frontend URL to allowed origins for current profile
- Verify OAuth2 redirect URIs match frontend URL

## Important Notes

- **Never commit `application.yml` with real credentials** - Use environment variables or profile-specific configs
- **Database naming inconsistency:** Dev uses `kareer-9`, Docker/staging uses `career-9`
- **Port mismatch:** Dev runs on 8091, Docker runs on 8080
- **Google credentials required:** Backend won't fully start without `google.json` and Firebase config
- **Profile matters:** Always specify correct Spring profile (dev/staging/production)
