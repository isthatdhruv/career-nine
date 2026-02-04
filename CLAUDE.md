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
