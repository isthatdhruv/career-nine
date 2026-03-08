# Technology Stack

**Analysis Date:** 2026-03-06

## Languages & Runtimes

| Component | Language | Version |
|-----------|----------|---------|
| Backend API | Java | 11 |
| Admin Frontend | TypeScript | 4.6.3 |
| Assessment Frontend | TypeScript | ~5.9.3 |
| Translator Service | JavaScript (Node.js) | 16.17.0 |

## Core Frameworks

### Backend (Spring Boot)

| Framework | Version | Purpose |
|-----------|---------|---------|
| Spring Boot | 2.5.5 | Application framework |
| Spring Security | (Boot managed) | OAuth2 + JWT authentication |
| Spring Data JPA | (Boot managed) | ORM / database access |
| Spring Boot Mail | (Boot managed) | Email integration |
| Spring Cache + Caffeine | (Boot managed) | In-memory caching |
| Hibernate | (Boot managed) | JPA implementation |

### Admin Frontend (React - CRA)

| Framework | Version | Purpose |
|-----------|---------|---------|
| React | 18.0.0 | UI framework |
| React Router DOM | 6.3.0 | Client-side routing |
| Material-UI (@mui/material) | 5.10.11 | UI component library |
| React Bootstrap | 2.5.0-beta.1 | UI components |
| Bootstrap | 5.2.2 | CSS framework |
| Axios | 0.26.1 | HTTP client |
| React Query | 3.38.0 | Server state management |
| Formik | 2.2.9 | Form state management |
| Yup | 0.32.11 | Form validation |

### Assessment Frontend (Vite)

| Framework | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI framework |
| React Router DOM | 6.30.3 | Client-side routing |
| Vite | 7.3.1 | Build tool / dev server |
| MediaPipe | 0.10.22 | Face mesh detection (proctoring) |
| WebGazer | 3.4.0 | Eye tracking |
| Firebase | 12.8.0 | Real-time data sync |

### Translator Microservice

| Framework | Version | Purpose |
|-----------|---------|---------|
| Express.js | 5.1.0 | HTTP server |
| OpenAI SDK | 5.22.1 | GPT-3.5-turbo translation |
| Axios | 1.12.2 | HTTP client |

## Key Backend Dependencies

**Authentication & Security:**
- JJWT: 0.11.2 (JWT token generation/validation)
- Spring Security OAuth2 Client

**Google Cloud Platform:**
- Google Cloud Storage (BOM 26.1.0)
- Firebase Admin SDK: 9.2.0
- Google APIs Client: 1.31.1
- Google Admin Directory API: directory_v1-rev20211221-1.32.1
- Google Gmail API: v1-rev20220404-2.0.0

**Email:**
- Mandrill Client: 1.1 + Lutung: 0.0.8 (transactional email)
- Spring Boot Mail (Gmail SMTP)

**PDF & Document Processing:**
- iTextPDF: 5.5.13
- OpenHTMLToPDF: 1.0.10
- Flying Saucer PDF: 9.1.20
- Apache POI: 5.2.3 (Excel read/write)

**Other:**
- Google ZXing: 3.3.0 (QR code generation)
- Google Gson: 2.9.0
- JSoup: 1.15.4 (HTML parsing)
- Apache Commons IO: 2.11.0
- OpenAI Java: 0.31.0 (AI integration)

## Key Frontend Dependencies

**Data & Export:**
- XLSX: 0.18.5 (Excel processing)
- jsPDF: 4.2.0 (PDF generation)
- React CSV Reader: 3.5.2

**Charts & Visualization:**
- Chart.js: 3.7.1
- ApexCharts: 3.35.0

**Content Editing:**
- React Draft WYSIWYG: 1.15.0
- Draft.js: 0.11.7

**Utilities:**
- Moment.js: 2.30.1
- React Intl: 5.25.0 (i18n)
- Universal Cookie: 4.0.4

## Build Tools

| Tool | Version | Component |
|------|---------|-----------|
| Maven | 3.8.1 | Backend build |
| React Scripts (CRA) | 5.0.1 | Admin frontend build |
| Vite | 7.3.1 | Assessment frontend build |
| env-cmd | 10.1.0 | Environment-based builds |
| Prettier | 2.6.2 | Code formatting (frontend) |
| ESLint | (CRA default) | Linting (frontend) |

## Docker Configuration

**Backend Dockerfile:** Multi-stage build
- Build stage: `maven:3.8.1-jdk-11-slim`
- Runtime stage: `eclipse-temurin:11-jre-focal`
- JVM args: `-Xms2g -Xmx4g`

**Docker Compose Services:**
- `mysql_db_api`: MySQL latest, port 3306, 3GB memory limit, persistent volume
- `api`: Spring Boot JAR, port 8080, 4GB memory limit
- Network: `career_shared_net` (external, must pre-create)

## Environment Configurations

### Dev Profile
- Backend port: 8091
- Database: `jdbc:mysql://localhost:3307/career-9`
- Hikari pool: 30 max, 10 min-idle
- Show SQL: true
- Caffeine cache: 500 items, 10min TTL

### Staging Profile
- Backend port: 8080
- Database: `jdbc:mysql://mysql_db_api:3306/career-9`
- Hikari pool: 50 max, 20 min-idle
- Show SQL: false
- Tomcat: 300 max threads, 50 min-spare

### Production Profile
- Backend port: 8080
- Database: `jdbc:mysql://easylearning.guru:3310/kcc_student`
- Hikari pool: 30 max, 10 min-idle
- Show SQL: true

### Frontend Environment URLs

| Env | API URL | App URL |
|-----|---------|---------|
| Dev | http://localhost:8080 | http://localhost:3000 |
| Staging | https://staging.api.kccitm.in | https://staging.student.kccitm.in |
| Production | https://api.career-9.com | https://dashboard.career-9.com |

### Assessment App URLs

| Env | API URL |
|-----|---------|
| Dev | http://localhost:8080 |
| Staging | https://staging.api.kccitm.in |
| Production | https://api.career-9.com |

## Database Configuration

**Engine:** MySQL 5.7+ (Docker uses latest)

**Database Names (inconsistent):**
- Dev: `career-9` (was `kareer-9` historically)
- Docker/Staging: `career-9`
- Production: `kcc_student`

**Hibernate Settings (all profiles):**
- DDL Auto: `update` (auto schema migration)
- Naming Strategy: EJB3NamingStrategy
- Dialect: MySQL5InnoDBDialect
- Batch Size: 30
- Order Inserts/Updates: true

## Caching

- **Type:** Caffeine (in-memory)
- **Spec:** maximumSize=500, expireAfterWrite=600s
- **Cached Collections:** assessmentQuestions, assessmentDetails, measuredQualityTypes, questionnaireQuestions