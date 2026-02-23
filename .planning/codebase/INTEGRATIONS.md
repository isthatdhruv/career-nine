# External Integrations

**Analysis Date:** 2026-02-06

## APIs & External Services

**Authentication & OAuth2:**
- Google OAuth2 - Multi-provider OAuth2 authentication
  - SDK/Client: Spring Security OAuth2 Client (backend), Firebase SDK (frontend)
  - Scope: `email`, `profile`, `https://www.googleapis.com/auth/admin.directory.user`, `https://www.googleapis.com/auth/admin.directory.group`, `https://www.googleapis.com/auth/admin.directory.orgunit`
  - Dev Client ID: `101961828065-ak601ssij07ugrffovuns8v2adrqvtqd.apps.googleusercontent.com`
  - Production Client ID: `701038408648-gnmlifdksik4mqu2as5vpgpe64l8m55b.apps.googleusercontent.com`
  - Redirect URI: Environment-specific (see `spring-social/src/main/resources/application.yml`)

- GitHub OAuth2 - Alternative authentication provider
  - Client ID: `d3e47fc2ddd966fa4352`
  - Scope: `user:email`, `read:user`

- Facebook OAuth2 - Alternative authentication provider
  - Client ID: `121189305185277`
  - Scope: `email`, `public_profile`
  - Custom endpoints: Facebook v3.0 API

**Text Translation:**
- OpenAI ChatGPT - Multi-language question and option translation
  - SDK/Client: `openai` npm package (v5.22.0 frontend, v5.22.1 translator)
  - Model: `gpt-3.5-turbo`
  - Endpoint: `https://api.openai.com/v1/chat/completions`
  - Auth: Environment variable `OPENAI_API_KEY` (in translator service `.env`)
  - Usage: Translation of assessment questions and options via `translator-service/index.js`
  - Translator endpoints:
    - `POST /translate/question` - Translate single question
    - `POST /translate/option` - Translate single option
    - `POST /translate/all` - Translate question + options batch
  - Frontend integration: Through translator microservice at `TRANSLATE_APP_API_URL`

**External Compilers/Judges:**
- Judge0 Code Compiler - Code execution and compilation
  - API URL: `REACT_APP_COMPLIER` environment variable
  - Dev: `http://35.196.122.199`
  - Staging: `https://judge0.api.kccitm.in`
  - Purpose: Code testing and evaluation within assessment system

**LeetCode:**
- LeetCode Platform - External coding platform integration (frontend)
  - CORS configured for: `https://leetcode.com`
  - Purpose: Linked problem references or embedded content

## Data Storage

**Databases:**
- MySQL 5.7+ (primary database)
  - Dev Connection: `jdbc:mysql://localhost:3306/kareer-9` (database: `kareer-9`)
  - Docker/Staging Connection: `jdbc:mysql://mysql_db_api:3306/career-9` (database: `career-9`)
  - Production Connection: `jdbc:mysql://easylearning.guru:3310/kcc_student` (database: `kcc_student`)
  - Credentials: root / `Career-qCsfeuECc3MW`
  - Client: Hibernate ORM with Spring Data JPA
  - DDL Strategy: `hibernate.ddl-auto: update` (auto-creates/updates schema)
  - Dialect: MySQL5InnoDBDialect

- Firebase Firestore (frontend)
  - Project ID: `career-9-assessment` (frontend) / `career-library` (backend)
  - Service: `getFirestore(app)` in `react-social/src/app/firebase.ts`
  - Purpose: Real-time data synchronization and client-side caching

**File Storage:**
- Google Cloud Storage (GCS)
  - Client: `com.google.cloud:google-cloud-storage`
  - Auth: Service account via `google.json` (classpath resource)
  - Configuration: `app.googleAPIJSON: classpath:google.json`
  - Usage: File uploads for student documents, assessment attachments
  - Backend service: `UtilController` at `spring-social/src/main/java/com/kccitm/api/controller/UtilController.java`

**Caching:**
- No explicit caching framework detected (Redis/Memcached not in dependencies)
- HTTP caching via response headers may be used

## Authentication & Identity

**Auth Provider:**
- OAuth2 (multi-provider)
  - Google, GitHub, Facebook supported
  - Flow: Redirect → Provider Consent → Token Exchange → JWT Generation

- Custom JWT-based Authentication
  - Library: JJWT (Java JWT)
  - Token Secret: `04ca023b39512e46d0c2cf4b48d5aac61d34302994c87ed4eff225dcf3b0a218739f3897051a057f9b846a69ea2927a587044164b7bae5e1306219d50b588cb1`
  - Expiration: 864000000ms (10 days)
  - Header: `Authorization: Bearer <token>`
  - Storage: Frontend stores token in secure location (likely localStorage or cookie)

**Google Workspace Integration:**
- Google Admin Directory API - User and group management
  - Service: `GoogleAPIAdminImpl` at `spring-social/src/main/java/com/kccitm/api/service/GoogleAPIAdminImpl.java`
  - Capabilities:
    - Create/read/update/delete users
    - Create/read/update/delete groups
    - Manage organizational units
    - Manage group members
  - Usage: Student email generation (kccitm.edu.in domain), group assignments
  - Implementation: `GoogleAdminController` at `spring-social/src/main/java/com/kccitm/api/controller/GoogleAdminController.java`

**Email Validation:**
- Official KCCITM Email Validation (kccitm.edu.in)
  - Endpoints:
    - `GET /email-validation-official` - Validate email format
    - `GET /email-validation-official-confermation` - OTP verification
  - Controller: `StudentController` at `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentController.java`

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Spring Boot built-in logging
  - Dev profile: `show-sql: true` (SQL statement logging)
  - Staging/Prod: `show-sql: false`
  - Format: Standard Spring Boot log output to console/file

**Metrics:**
- Spring Boot Actuator (dependency present: `spring-boot-starter-actuator`)
  - Endpoints available but not detailed in config (default: `/actuator`)
  - Purpose: Health checks, metrics, environment info

## CI/CD & Deployment

**Hosting:**
- Development: Local Docker (docker-compose.yml orchestrates MySQL + Spring Boot)
- Staging: Cloud-hosted (Docker containers on infrastructure)
- Production: Remote MySQL server (easylearning.guru:3310) with Spring Boot API

**Container Orchestration:**
- Docker Compose (v3.3)
  - Services: `mysql_db_api` (MySQL 5.7+), `api` (Spring Boot JAR)
  - Network: `career_shared_net` (custom bridge network)
  - Build context: `./spring-social/dockerfile` for API
  - Frontend: Not containerized in compose (commented out)

**CI Pipeline:**
- Not detected - No GitHub Actions, Jenkins, GitLab CI config files found

**Build Artifacts:**
- Backend: JAR file (`demo.jar`) produced by Maven, packaged in Docker image
- Frontend: Static build output (webpack bundle) in `build/` directory (not containerized)

## Environment Configuration

**Required Environment Variables:**

Frontend (React):
- `REACT_APP_API_URL` - Backend API base URL
- `REACT_APP_URL` - Frontend application URL
- `REACT_APP_COMPLIER` - Code compiler/judge service URL
- `TRANSLATE_APP_API_URL` - Translator microservice endpoint
- `NODE_ENV` - `development`, `staging`, or `production`

Backend (Spring Boot):
- Spring profiles: `dev` (default), `staging`, `production`
- Database credentials (in `application.yml` per profile)
- `app.mandrill` - Mandrill API key for email
- `app.auth.tokenSecret` - JWT signing secret
- Google OAuth2 credentials (clientId, clientSecret, redirectUri)
- Facebook OAuth2 credentials
- GitHub OAuth2 credentials

Translator Microservice (Node.js):
- `OPENAI_API_KEY` - OpenAI API key for ChatGPT access
- `PORT` - Server port (default: 5000)
- `CORS_ORIGIN` - Allowed origin (default: `http://localhost:3000`)

**Secrets Location:**
- `application.yml` (committed, contains dev credentials - **security risk**)
- `.env` files in react-social (development only, not in production)
- Environment variables for production deployments (passed to Docker containers)
- `.env` in translator-service (not committed, contains OPENAI_API_KEY)

**Security Notes:**
- ⚠️ Dev credentials exposed in `application.yml` (Client IDs, secrets, DB passwords, JWT secret)
- ⚠️ OAuth2 redirect URIs include multiple development IPs/domains in staging config
- ⚠️ Mandrill API key visible in `application.yml`
- Firebase credentials should be stored securely in backend `.env` or vault

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints for external services

**Outgoing:**
- Assessment Result Delivery - Students receive assessment results via Mandrill email
- Student Notifications - Automated emails for status updates (email generation, ID cards, etc.)

**Email Endpoints:**
- EmailService implementation at `spring-social/src/main/java/com/kccitm/api/service/EmailService.java`
- Mandrill integration for transactional emails
- Student ID card PDF generation and email delivery
- Official email notification for kccitm.edu.in accounts

## Assessment System Integrations

**Questionnaire-Based Assessment:**
- Structured question banks linked via `AssessmentTable` and `Questionnaire` entities
- Language support for internationalization
- Scoring via `MeasuredQualityTypes` and `OptionScoreBasedOnMeasuredQualityTypes`

**Excel Import/Export:**
- Bulk question upload via Excel (XLSX format)
- Endpoint: `POST /assessment-questions/import-excel`
- Features: Parse Excel → Create questions with options and MQT scores
- Export endpoint: `GET /assessment-questions/export-excel`
- Library: Apache POI 5.2.3 (backend), XLSX 0.18.5 (frontend)

**QR Code Generation:**
- Student ID cards include QR codes
- Library: Google Zxing (barcode/QR code)
- Service: `StudentPdfService` at `spring-social/src/main/java/com/kccitm/api/service/StudentPdfService.java`

## Session & Role Management

**Role-Based Access Control:**
- Role and RoleUser entities with permission hierarchy
- Authentication flow validates roles before endpoint access
- Frontend routing checks roles in `PrivateRoutes.tsx`

**Session Management:**
- JWT-based (stateless)
- Token stored in frontend (client-side session)
- No server-side session store (token validation per request)

---

*Integration audit: 2026-02-06*
