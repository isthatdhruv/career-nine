# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Career-Nine is a full-stack educational platform for student assessment, career guidance, and academic management. It consists of a Spring Boot REST API backend, React TypeScript frontend, and a Node.js translation microservice.

**Tech Stack:**
- Backend: Spring Boot 2.5.5, Java 11, MySQL 5.7+
- Frontend: React 18.0.0, TypeScript 4.6.3, Material-UI, Bootstrap 5.2.2
- Translation Service: Node.js/Express with OpenAI API integration
- Build Tools: Maven (backend), npm/react-scripts 5.0.1 (frontend)

**Node/npm Requirements:**
- Node.js: Compatible with React 18 (Node 14+ recommended)
- Package manager: npm or yarn

## Architecture

### Three-Tier Monolithic Application

```
React SPA (port 3000)
    ↓ HTTP/REST
Spring Boot API (port 8091 dev, 8080 docker)
    ↓ JDBC
MySQL Database (port 3306)

Translation Service (Node.js/Express)
    ↓ OpenAI API
    (Used for multi-language content translation)
```

**Backend Structure (Spring Boot):**
- `controller/` - REST endpoints (47+ controllers)
  - `controller/career9/` - Career9-specific endpoints (assessments, questionnaires, scoring)
  - `controller/career9/Questionaire/` - New questionnaire system
- `service/` - Business logic (24 services)
- `repository/` - JPA repositories (73+ repositories)
- `model/` - JPA entities
  - `model/career9/` - Career9-specific entities
- `security/` - OAuth2 + JWT authentication
- `config/` - Application configuration
- `Pdf/` - PDF generation services
- `util/` - Utility classes

**Frontend Structure (React):**
- `src/app/pages/` - Feature pages (40+ pages)
  - Each feature typically has: `FeaturePage.tsx`, `API/Feature_APIs.ts`, `components/`
- `src/app/modules/` - Feature modules (role, roleUser)
- `src/app/_metronic/` - Metronic UI framework/layout system
- `src/app/routing/` - React Router configuration (`AppRoutes.tsx`, `PrivateRoutes.tsx`)
- `src/app/model/` - TypeScript interfaces
- `public/` - Static assets (favicon, media, game-scenes)

**Translation Service:**
- `translator-service/index.js` - Express server with OpenAI integration
- Used for translating assessment content across languages

### Key Subdomains

**Academic Management:**
- Institute, Branch, Course, Section, Session, Batch structure
- College sections, grades, and session management
- Student registration and bulk imports

**Assessment System (Dual Implementation):**

1. **Legacy Assessment System** (in `career9/` package):
   - `AssessmentTable` - Assessment definitions
   - `AssessmentQuestions` - Question bank with language support
   - `AssessmentQuestionOptions` - Answer options with scoring
   - `AssessmentAnswer` - Student answers
   - `AssessmentRawScore` - Raw scoring results

2. **New Questionnaire System** (in `career9/Questionaire/` package):
   - `Questionnaire` - Structured questionnaires
   - `QuestionnaireSection` - Sections within questionnaires
   - `QuestionnaireQuestion` - Questions linked to sections
   - `QuestionnaireLanguage` - Multi-language support

**Scoring & Career Guidance:**
- `MeasuredQualities` - High-level quality dimensions
- `MeasuredQualityTypes` - Specific scoring types
- `OptionScoreBasedOnMeasuredQualityTypes` - Option-level scoring
- `Career` - Career paths linked to quality types
- `Tool` - Psychometric tools

**User Management:**
- Multi-provider OAuth2 (Google, GitHub, Facebook)
- JWT token-based authentication (10-day expiration)
- Role-based access control
- Google Workspace integration (Groups, Directory API)

## Development Commands

### Backend (Spring Boot)

**Local Development:**
```bash
cd spring-social

# Run with dev profile (default)
mvn spring-boot:run

# Run with specific profile
mvn spring-boot:run -Dspring-boot.run.profiles=staging

# Build JAR
mvn clean package

# Build without tests
mvn clean package -DskipTests

# Run tests
mvn test

# Run single test class
mvn test -Dtest=ClassName

# Clean build directory
mvn clean
```

**Configuration:**
- Dev profile: `application.yml` (spring.profiles.active: dev)
- Database: `kareer-9` on 192.168.10.73:3306 (or localhost:3306 if configured)
- Server port: 8091 (dev), 8080 (docker/staging)
- Default credentials: root/Career-qCsfeuECc3MW

**Required Files for Backend:**
- `src/main/resources/google.json` - Google Cloud service account credentials
- `src/main/resources/firebase-service-account.json` - Firebase admin SDK credentials
- Backend will NOT start properly without these files

### Frontend (React)

**Development:**
```bash
cd react-social

# Install dependencies
npm install
# or
yarn install

# Start dev server (port 3000)
npm start

# Start with staging environment
npm run start:staging

# Build for production
npm run build

# Build with staging environment variables
npm run build:stage

# Build with production environment variables
npm run build:production

# Run tests
npm test

# Lint check
npm run lint

# Format code with Prettier
npm run format

# Eject (one-way operation, use with caution)
npm run eject
```

**Environment Configuration:**
- `staging.env` - Staging environment variables (used by env-cmd)
- `production.env` - Production environment variables (used by env-cmd)
- Default dev: Uses hardcoded defaults or `.env` file

**Environment Variables:**
- `REACT_APP_API_URL` - Backend API base URL (default: http://localhost:8091)

### Translation Service

**Setup & Run:**
```bash
cd translator-service

# Install dependencies
npm install

# Run service (default port varies, check index.js)
node index.js

# Run with nodemon for development
npx nodemon index.js
```

**Configuration:**
- Uses OpenAI API for translation
- Requires `.env` file with OpenAI credentials
- Provides REST endpoints for translating assessment content

### Docker Deployment

**Initial Setup:**
```bash
# Create shared network (required, do this first)
docker network create career_shared_net
```

**Running Services:**
```bash
# Start all services (MySQL + Spring Boot API)
docker-compose up -d

# Start and rebuild images
docker-compose up -d --build

# Stop services
docker-compose down

# View logs
docker logs -f mysql_db_api
docker logs -f api

# Follow logs for all services
docker-compose logs -f
```

**Docker Services:**
- `mysql_db_api` - MySQL latest (port 3306, database: career-9)
  - Persists data to `mysql_data` volume
- `api` - Spring Boot JAR (port 8080)
  - Built from `spring-social/dockerfile`

**Note:** Frontend docker service is commented out in docker-compose.yml

## Database Configuration

**Database Names (Inconsistency):**
- Dev: `kareer-9`
- Docker/Staging: `career-9`

**Connection Details:**
- Dev: `jdbc:mysql://192.168.10.73:3306/kareer-9` (or localhost if configured)
- Docker: `jdbc:mysql://mysql_db_api:3306/career-9`
- User: `root`
- Password: `Career-qCsfeuECc3MW`

**Hibernate Configuration:**
- DDL Auto: `update` (automatically creates/updates tables)
- Dialect: MySQL5InnoDBDialect
- Show SQL: true (in dev mode)

**Database Migration:**
- Hibernate auto-update handles most schema changes
- Manual SQL files can be placed in project root (e.g., `Dump20260130 (1).sql`, `career-9.sql`)
- **Caution:** Auto-update doesn't handle column renames, data migrations, or complex changes

## API Patterns

### Controller Conventions

**Standard REST Endpoint Pattern:**
```java
@RestController
@RequestMapping("/entity-name")
public class EntityController {

    @GetMapping("/getAll")           // List all entities
    @GetMapping("/get/{id}")         // Get entity by ID
    @GetMapping("/getAllList")       // Get projection/summary list
    @PostMapping("/create")          // Create new entity
    @PutMapping("/update/{id}")      // Update existing entity
    @DeleteMapping("/delete/{id}")   // Delete entity by ID
}
```

**Response Patterns:**
- Success: `ResponseEntity.ok(data)` or `ResponseEntity.ok().build()`
- Not Found: `ResponseEntity.notFound().build()`
- Created: `ResponseEntity.status(HttpStatus.CREATED).body(data)`
- Error: `ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorMessage)`

### Repository Patterns

**Standard JPA Repository:**
```java
public interface EntityRepository extends JpaRepository<Entity, Long> {
    // Spring Data JPA method naming conventions
    List<Entity> findByProperty(String property);
    Optional<Entity> findByUniqueField(String field);
    List<Entity> findByPropertyAndStatus(String property, String status);

    // Custom queries with @Query annotation
    @Query("SELECT e FROM Entity e WHERE e.field = :value")
    List<Entity> customQuery(@Param("value") String value);
}
```

### Career9 Controllers & Endpoints

All career9 controllers are in `com.kccitm.api.controller.career9` package.

#### Questionnaire Management

**QuestionnaireController** (`/api/questionnaire`)
- `POST /create` - Create questionnaire with sections, questions, languages
  - Accepts nested structure with sections and questions
  - Sets up bidirectional relationships
- `GET /get` - Get all questionnaires with full data
- `GET /get/list` - Get questionnaire list (projection, less data)
- `GET /getbyid/{id}` - Get questionnaire by ID
- `PUT /update/{id}` - Update questionnaire
  - Handles complex nested updates
  - Updates sections, questions, and relationships
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
- `POST /create` - Create assessment instance
  - Links assessment to questionnaire
  - Sets up student-assessment mappings
- `GET /getAll` - Get all assessments
- `GET /get/list` - Get assessment list
- `GET /{id}` - Get assessment active status (returns isActive boolean)
- `GET /getById/{id}` - Get full assessment details by ID
- `GET /getby/{id}` - Get questionnaire for assessment
- `GET /{assessmentId}/student/{userStudentId}` - Get assessment status for specific student
- `GET /student/{userStudentId}` - Get all assessments for student
- `GET /get/list-ids` - Get map of assessment IDs to names
- `POST /startAssessment` - Start assessment (sets status to "ongoing")
- `PUT /update/{id}` - Update assessment
- `DELETE /{id}` - Delete assessment

**AssessmentQuestionController** (`/assessment-questions`)
- `GET /getAll` - Get all questions (with caching via @Cacheable)
- `GET /getAllList` - Get questions projection (without options/scores, lighter)
- `GET /get/{id}` - Get question by ID with full details
- `POST /create` - Create assessment question with options and scores
- `PUT /update/{id}` - Update question
  - **Important:** Replaces all options entirely (deletes old, creates new)
- `DELETE /delete/{id}` - Delete question
- `GET /export-excel` - Export all questions to Excel file
  - Includes question details, options, and MQT scores
  - Format: One row per question with up to 6 options
- `POST /import-excel` - Import questions from Excel (bulk create/update)
  - Accepts multipart file upload
  - Validates and processes each question

**Bulk Upload Feature (Frontend):**
- **Component:** `QuestionBulkUploadModal.tsx` (in `react-social/src/app/pages/AssesmentQuestions/components/`)
- **Integration:** Button in `QuestionTable.tsx`
- **Documentation:** See `/BULK_UPLOAD_INSTRUCTIONS.md` for detailed usage

**Key Features:**
- Upload Excel → Parse → Preview/Edit → Submit
- Navigate through questions with Next/Previous
- Edit questions, options, MQT scores before submission
- Download blank template with sample data
- Progress tracking and error reporting

**Excel Format:**
- Columns: Question Text, Question Type, Section ID, Max Options Allowed
- Options: Option 1-6 (Text, Description, Is Correct, MQTs)
- MQT Format: `MQTName:Score,MQTName:Score` (e.g., "Analytical:10,Creativity:5")
- **Limitations:** Images not supported, max 6 options in Excel (can add more in modal)

**Excel Parsing:**
- Uses `xlsx` library (client-side parsing)
- Validates required columns
- Converts MQT string format to structured data

**AssessmentQuestionOptionsController** (`/assessment-question-options`)
- `GET /getAll` - Get all options
- `GET /get/{id}` - Get option by ID
- `GET /by-question/{questionId}` - Get all options for a question
- `POST /create` - Create new option
- `PUT /update/{id}` - Update option
- `DELETE /delete/{id}` - Delete option

**AssessmentAnswerController** (`/assessment-answer`)
- `GET /getAll` - Get all assessment answers
- `GET /getByStudent/{studentId}` - Get answers for specific student
- `POST /submit` - Submit student answers and calculate scores

**Submit Answer Flow:**
1. Validates UserStudent and AssessmentTable existence
2. Creates/updates StudentAssessmentMapping with status "completed"
3. Saves each answer to AssessmentAnswer table
4. Accumulates scores from OptionScoreBasedOnMeasuredQualityTypes
5. Deletes old AssessmentRawScore entries for this mapping
6. Saves new AssessmentRawScore entries per MeasuredQualityType

#### Scoring System

**ToolController** (`/tools`)
- `GET /getAll` - Get all psychometric tools
- `GET /get/{id}` - Get tool by ID
- `POST /create` - Create tool (auto-sets price=0 if isFree=true)
- `PUT /update/{id}` - Update tool
- `DELETE /delete/{id}` - Delete tool (clears measured quality mappings)
- `POST /{toolId}/measured-qualities/{qualityId}` - Add measured quality to tool
- `DELETE /{toolId}/measured-qualities/{qualityId}` - Remove quality from tool
- `GET /{toolId}/measured-qualities` - Get tool's measured qualities

**MeasuredQualitiesController** (`/measured-qualities`)
- `GET /getAll` - Get all measured qualities
- `GET /get/{id}` - Get quality by ID
- `POST /create` - Create measured quality
- `PUT /update/{id}` - Update quality (name, description, displayName)
- `DELETE /delete/{id}` - Delete quality (sets child types' quality to null)
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
- `POST /create` - Create option scores (supports batch creation)
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
- `POST /create` - Create language question (simple version)
- `POST /create-with-options` - Create language question with options

**Create-with-options Behavior:**
- Deletes existing translations for same questionId + languageId
- Sets bidirectional relationships between question and options
- Links options to both language and languageQuestion entities

**LanguageOptionsController** (`/language-options`)
- Standard CRUD for language-specific option translations

#### Section Management

**QuestionSectionController** (`/question-sections`)
- `GET /getAll` - Get all sections with full data
- `GET /getAllList` - Get sections projection (lighter, summary view)
- `GET /get/{id}` - Get section by ID
- `GET /{id}/questions` - Get all questions in section
- `POST /create` - Create section
- `PUT /update/{id}` - Update section (name, description)
- `DELETE /delete/{id}` - Delete section (sets questions' section to null)

#### Student Management

**StudentController** (`/student/*`)
- `GET /student/get` - Get all students
- `GET /student/getbyid/{id}` - Get student by ID with full data
- `POST /student/save-csv` - Save student from CSV import
- `POST /student/update` - Update student registration
- `POST /student-email/update` - Generate official email (@kccitm.edu.in)
- `GET /generate_pdf` - Generate student ID card PDF
- `GET /generate_id_card` - Generate and email ID card to student
- `POST /student/getSavetoDatabase` - Bulk save students
- `POST /student/emailChecker` - Check if email already exists
- `GET /email-validation-official` - Send OTP for kccitm.edu.in email validation
- `GET /email-validation-official-confermation` - Verify OTP

**Key Integrations:**
- Google Admin API (user/group management)
- Mandrill (transactional email)
- PDF generation service (iTextPDF, OpenHTMLtoPDF)
- Google Cloud Storage (file uploads)

#### School/College Management

**SchoolSessionController** (`/school-session`)
- Session management for schools
- Links to classes, sections, and grades

**InstituteDetailController** (`/institute-detail`)
- CRUD for institutes/schools
- Manages contact persons, courses, sessions

**CollegeSectionSessionGradeController**
- Manages grade mappings for college sections within sessions

### Authentication Flow

**OAuth2 Providers:** Google, GitHub, Facebook

**JWT Token:**
- Secret: Configured in `application.yml` (app.auth.tokenSecret)
- Expiration: 864000000ms (10 days)
- Header: `Authorization: Bearer <token>`

**Authorized Redirect URIs:**
- Configured per profile in `application.yml` (app.oauth2.authorizedRedirectUris)
- Must match frontend URL for OAuth flow to work

**Google OAuth Scopes:**
- email, profile
- admin.directory.user (Google Workspace user management)
- admin.directory.group (Google Workspace group management)
- admin.directory.orgunit (Organizational units)

## Frontend Patterns

### Component Structure

**Typical Page Structure:**
```
src/app/pages/Feature/
├── FeaturePage.tsx              // Main page container
├── API/
│   └── Feature_APIs.ts          // Axios API calls
└── components/
    ├── FeatureTable.tsx         // Data table (often MUI DataTable)
    ├── FeatureCreateModal.tsx   // Create modal
    ├── FeatureEditPage.tsx      // Edit page/modal
    └── index.ts                 // Barrel exports
```

### API Integration Pattern

**API File Structure:**
```typescript
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091';

export function getAllEntities() {
  return axios.get(`${BASE_URL}/entity-name/getAll`);
}

export function getEntityById(id: number) {
  return axios.get(`${BASE_URL}/entity-name/get/${id}`);
}

export function createEntity(data: EntityType) {
  return axios.post(`${BASE_URL}/entity-name/create`, data);
}

export function updateEntity(id: number, data: EntityType) {
  return axios.put(`${BASE_URL}/entity-name/update/${id}`, data);
}

export function deleteEntity(id: number) {
  return axios.delete(`${BASE_URL}/entity-name/delete/${id}`);
}
```

### Routing

**Route Configuration:**
- `src/app/routing/AppRoutes.tsx` - Main application routes
- `src/app/routing/PrivateRoutes.tsx` - Authenticated routes
- Uses React Router v6 (react-router-dom 6.3.0)

**Layout System:**
- `src/app/_metronic/layout/` - Metronic layout components
- `AsideMenuMain.tsx` - Sidebar navigation menu

### Common Libraries

**UI Components:**
- Material-UI (@mui/material) - Primary component library
- Bootstrap 5.2.2 - Grid system and utilities
- React Bootstrap 2.5.0-beta.1 - Bootstrap components

**Data Display:**
- mui-datatables 4.3.0 - Feature-rich data tables
- react-table 7.7.0 - Headless table library
- ApexCharts 3.35.0 - Charts and graphs

**Forms:**
- Formik 2.2.9 - Form state management
- Yup 0.32.11 - Schema validation

**File Handling:**
- xlsx 0.18.5 - Excel file parsing/generation
- react-csv-reader 3.5.2 - CSV file import

**Rich Text:**
- react-draft-wysiwyg 1.15.0 - WYSIWYG editor
- draft-js 0.11.7 - Rich text editor framework

## Key Integrations

### Google Cloud Services

**Required Configuration Files:**
- `spring-social/src/main/resources/google.json` - Service account credentials
- `spring-social/src/main/resources/firebase-service-account.json` - Firebase admin SDK

**Capabilities:**
- Cloud Storage for file uploads
- Admin Directory API for user/group management
- OAuth2 authentication (Google sign-in)

**Project Configuration:**
- Service account must have appropriate IAM roles
- Credentials file must be in classpath

### Firebase

**Project ID:** `career-library`

**Frontend Integration:**
- Initialized in `src/app/firebase.ts`
- Firebase SDK version: 12.8.0

**Backend Integration:**
- Firebase Admin SDK for server-side operations
- Used for authentication, storage, etc.

### Email Service (Mandrill)

**Provider:** Mandrill by Mailchimp

**Configuration:**
- API Key: Configured in `application.yml` (app.mandrill)
- Used for transactional emails (student ID cards, verification, etc.)

### PDF Generation

**Libraries:**
- iTextPDF 5.5.13 - PDF creation
- OpenHTMLtoPDF 1.0.10 - HTML to PDF conversion
- Flying Saucer 9.1.20 - CSS rendering for PDFs

**Service Implementation:**
- `PdfServiceImpl` - Main PDF generation service
- Handles student ID cards, reports, etc.
- Converts HTML templates to PDF

### Translation Service (OpenAI)

**Integration:**
- Node.js microservice using OpenAI API
- Provides REST endpoints for content translation
- Used for multi-language assessment content

## Common Development Tasks

### Adding a New Entity

**Backend Steps:**
1. Create JPA entity class in `com.kccitm.api.model` package
   - Add JPA annotations (@Entity, @Table, @Id, etc.)
   - Define relationships (@ManyToOne, @OneToMany, etc.)
2. Create repository interface in `com.kccitm.api.repository` package
   - Extend `JpaRepository<Entity, Long>`
   - Add custom query methods as needed
3. Create controller in `com.kccitm.api.controller` package
   - Follow standard REST endpoint pattern
   - Use `@RestController` and `@RequestMapping`
4. (Optional) Create service layer in `com.kccitm.api.service` if complex business logic

**Frontend Steps:**
1. Create TypeScript interface in `src/app/model/` directory
2. Create API functions in `src/app/pages/[Feature]/API/Feature_APIs.ts`
3. Create page component: `src/app/pages/[Feature]/FeaturePage.tsx`
4. Create table component: `src/app/pages/[Feature]/components/FeatureTable.tsx`
5. Create modals/forms for create/edit operations
6. Add route in `src/app/routing/AppRoutes.tsx` or `PrivateRoutes.tsx`
7. Add menu item in `src/app/_metronic/layout/components/aside/AsideMenuMain.tsx`

### Working with Assessment Systems

**Two Parallel Implementations:**

1. **Legacy Assessment System** (`career9/` package):
   - Use for existing assessments
   - Entities: AssessmentTable, AssessmentQuestions, AssessmentQuestionOptions
   - More established, widely used

2. **New Questionnaire System** (`career9/Questionaire/` package):
   - Use for new structured questionnaires
   - Entities: Questionnaire, QuestionnaireSection, QuestionnaireQuestion
   - Better multi-language support
   - More structured section-based approach

**When to use which:**
- Legacy system: Simple assessments, backward compatibility
- New system: Complex multi-section questionnaires, multi-language requirements
- **Important:** Clarify which system to use when implementing new features

### Excel Import/Export

**Backend:**
- Use Apache POI libraries (included in dependencies)
- Export endpoint pattern: `GET /export-excel` returns file
- Import endpoint pattern: `POST /import-excel` with MultipartFile

**Frontend:**
- Use `xlsx` library for client-side parsing
- Template download: Generate Excel with sample data
- Upload flow: Parse → Preview → Edit → Submit
- See `QuestionBulkUploadModal.tsx` for reference implementation

### Database Migrations

**Automatic Migrations:**
- Hibernate DDL auto-update is ENABLED (`ddl-auto: update`)
- Automatically creates tables and adds new columns
- Does NOT handle: column renames, data migrations, complex schema changes

**Manual Migrations:**
- Place SQL dump files in project root
- Import manually: `mysql -u root -p kareer-9 < Dump20260130.sql`
- Test in dev before applying to staging/production

**Best Practices:**
- Always test schema changes in dev first
- Backup database before major changes
- For production, consider disabling auto-update and using Flyway/Liquibase

## Testing

### Backend Tests

**Framework:** Spring Boot Test + JUnit

**Location:** `spring-social/src/test/java/`

**Commands:**
```bash
# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=ControllerTest

# Run specific test method
mvn test -Dtest=ControllerTest#testMethod

# Skip tests during build
mvn clean package -DskipTests
```

### Frontend Tests

**Framework:** React Testing Library + Jest

**Location:** Test files alongside components (`.test.tsx`, `.spec.tsx`)

**Commands:**
```bash
# Run tests in interactive watch mode
npm test

# Run all tests once
npm test -- --watchAll=false

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test FeatureTable.test.tsx
```

## Git Workflow

**Main Branch:** `main`

**Feature Branch Pattern:** Various (e.g., `dhruv-from-palak`, `utkrisht`)

**Commit Message Style:**
- Follow existing patterns
- Examples: "Added Feature to manually add a student", "fixed question mqt at creation"
- Generally descriptive but informal

## Troubleshooting

### Backend Won't Start

**Check:**
1. MySQL is running: `sudo systemctl status mysql` or `docker ps`
2. Database exists: `mysql -u root -p` then `SHOW DATABASES;`
   - Should see `kareer-9` (dev) or `career-9` (docker)
3. Credentials correct: root/Career-qCsfeuECc3MW
4. Google credentials exist: `spring-social/src/main/resources/google.json`
5. Firebase credentials exist: `spring-social/src/main/resources/firebase-service-account.json`
6. Java version: `java -version` (should be Java 11)
7. Port 8091 not in use: `lsof -i :8091` or `netstat -an | grep 8091`

**Common Errors:**
- `Access denied for user 'root'@'localhost'` → Check password
- `Unknown database 'kareer-9'` → Create database or check name
- `FileNotFoundException: google.json` → Add credentials file to resources
- `Port 8091 is already in use` → Kill process or change port

### Frontend Build Fails

**Solutions:**
1. Clear node_modules: `rm -rf node_modules package-lock.json && npm install`
2. Check Node version: `node -v` (should be 14+, compatible with React 18)
3. Clear build cache: `rm -rf build/`
4. Verify environment file exists (if using build:stage or build:production)
5. Check for TypeScript errors: `npx tsc --noEmit`

**Common Errors:**
- `Module not found` → Run `npm install`
- `TypeScript compilation error` → Fix type errors in code
- `Heap out of memory` → Increase Node memory: `export NODE_OPTIONS="--max-old-space-size=4096"`

### Docker Issues

**Solutions:**
1. Network doesn't exist: `docker network create career_shared_net`
2. Port conflicts:
   - MySQL (3306): `lsof -i :3306` - stop local MySQL or change port
   - API (8080): `lsof -i :8080` - stop other services
3. Check logs: `docker-compose logs -f` or `docker logs <container_name>`
4. Rebuild images: `docker-compose down && docker-compose up -d --build`
5. Clean start: `docker-compose down -v` (WARNING: deletes volumes/data)

**Check container status:**
```bash
docker ps                          # Running containers
docker ps -a                       # All containers
docker-compose ps                  # Compose services
```

### CORS Errors

**Backend Configuration:**
- Check `application.yml` → `app.cors.allowedOrigins`
- Add frontend URL to allowed origins for current profile
- Format: `http://localhost:3000,http://192.168.0.204:3000`

**OAuth2 Redirects:**
- Verify `app.oauth2.authorizedRedirectUris` includes frontend URL
- Must match exactly (including port and protocol)

**Common Issues:**
- Frontend running on different port than configured
- Missing trailing slash or extra trailing slash
- HTTP vs HTTPS mismatch

### Excel Upload Not Working

**Frontend:**
1. Check file size (large files may need backend config)
2. Verify Excel format (.xlsx or .xls)
3. Check browser console for parsing errors
4. Validate required columns exist

**Backend:**
1. Check multipart file upload config in Spring Boot
2. Verify temp directory has write permissions
3. Check max file size settings in application.yml

### Translation Service Issues

**Check:**
1. Service is running: `ps aux | grep node` or check specific port
2. OpenAI API key is configured in .env file
3. Network connectivity to OpenAI API
4. API rate limits not exceeded

## Important Notes

**Security:**
- **Never commit `application.yml` with real credentials** to public repos
- Use environment variables or profile-specific configs for sensitive data
- Keep `google.json` and `firebase-service-account.json` in .gitignore

**Known Inconsistencies:**
- **Database naming:** Dev uses `kareer-9`, Docker/staging uses `career-9`
- **Port mismatch:** Dev runs on 8091, Docker/staging runs on 8080
- **Database host:** Dev profile currently points to 192.168.10.73, not localhost

**Required Dependencies:**
- Google credentials REQUIRED for backend to start
- Firebase credentials REQUIRED for full functionality
- MySQL must be running before starting backend

**Profile Management:**
- Always specify correct Spring profile (dev/staging/production)
- Default profile is `dev` (defined in application.yml)
- Different profiles have different database configs, ports, CORS settings

**Assessment System:**
- Two parallel implementations exist (legacy vs new questionnaire)
- Legacy system more widely used currently
- New system has better structure for multi-language and sections
- Check which system is being used before making changes

**Excel Features:**
- Bulk upload supports up to 6 options per question in Excel
- Additional options can be added in preview modal
- MQT format: `MQTName:Score,MQTName:Score`
- Images NOT supported in Excel import
