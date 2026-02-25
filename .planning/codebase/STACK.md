# Technology Stack

**Analysis Date:** 2026-02-06

## Languages

**Primary:**
- Java 11 - Backend API (Spring Boot)
- TypeScript 4.6.3 - React frontend type safety
- JavaScript (ES5/ESNext) - React frontend runtime, Node.js translator service

**Secondary:**
- YAML - Spring Boot configuration
- SQL - MySQL database queries
- HTML/CSS - Frontend views (Bootstrap 5, SCSS)

## Runtime

**Environment:**
- Java 11 (JDK) - Spring Boot backend runtime
- Node.js 16.17.0 - Frontend build and translator service runtime (specified in `.nvmrc`)
- npm 8.x (implicit from Node 16.17.0)

**Package Manager:**
- Maven 3.x (configured in `spring-social/pom.xml`) - Backend dependency management
- npm - Frontend and translator service dependency management
- Lockfile: `react-social/package-lock.json` and `translator-service/package-lock.json` (assumed, standard npm)

## Frameworks

**Core Backend:**
- Spring Boot 2.5.5 - REST API framework, IoC container
- Spring Security OAuth2 Client - OAuth2 authentication (Google, GitHub, Facebook)
- Spring Data JPA 2.5.5 - ORM and database abstraction
- Hibernate - JPA implementation for MySQL

**Core Frontend:**
- React 18.0.0 - UI framework and component library
- React Router DOM 6.3.0 - Client-side routing (`src/app/routing/AppRoutes.tsx`)
- React Bootstrap 2.5.0-beta.1 - Bootstrap component library
- React Query 3.38.0 - Server state management and data fetching
- TypeScript 4.6.3 - Static type checking

**UI & Styling:**
- Bootstrap 5.2.2 - CSS framework and grid system
- SASS 1.50.1 - CSS preprocessor
- Material-UI (@mui/material 5.10.11) - Material Design components
- Chart.js 3.7.1 - Data visualization
- ApexCharts 3.35.0 - Advanced charting library
- Lucide React 0.562.0 - Icon library

**Testing & Build:**
- React Scripts 5.0.1 - Create React App build tool (dev server, webpack, Babel)
- Jest (implicit from react-scripts) - Frontend unit testing
- React Testing Library - Component testing
- Spring Boot Test - Backend testing framework
- JUnit & Spring Security Test - Backend unit and security testing

**Build & Dev Tools:**
- Maven (Spring Boot projects) - Compile, test, package backend
- Webpack 5.74.0 - Module bundler for advanced builds
- Prettier 2.6.2 - Code formatter (configured with `npm run format`)
- ESLint (implicit from react-scripts) - Code linting
- TypeScript Compiler 4.6.3 - TypeScript to JavaScript transpilation
- env-cmd 11.0.0 - Environment-based build execution (`npm run build:stage`, `npm run build:production`)

**Translation & Utilities:**
- Express 5.1.0 - Node.js web framework for translator microservice
- Axios 0.26.1 (frontend), 1.12.2 (translator) - HTTP client for API calls
- Formik 2.2.9 - Form state management
- Yup 0.32.11 - Form validation schema
- React Intl 5.25.0 - Internationalization and localization
- Draft.js 0.11.7 - Rich text editing
- OpenAI 5.22.0 (frontend & translator) - ChatGPT API client

**PDF Generation:**
- iTextPDF 5.5.13 - PDF generation from content
- OpenHTMLtoPDF 1.0.10 - HTML to PDF conversion
- Flying Saucer 9.1.20 - XML/HTML rendering engine

**Data Handling:**
- XLSX 0.18.5 - Excel file reading and writing (bulk question upload)
- Apache POI 5.2.3 - Excel generation and parsing (backend)
- Gson 2.9.0 - JSON serialization/deserialization
- Jackson Databind - JSON processing

**Authentication & Security:**
- JJWT 0.11.2 (jjwt-api, jjwt-impl, jjwt-jackson) - JWT token generation and validation
- Spring Security OAuth2 Client - OAuth2 provider integration

**Google Cloud & APIs:**
- Google Cloud Storage Client - File upload/download to GCS
- Google API Client 1.31.1 - Google Workspace API integration
- Google OAuth Client Jetty 1.23.0 - OAuth2 authentication
- Google Admin Directory API 1.32.1 - User and group management
- Google Zxing 3.3.0 - QR code generation and reading

**Email & Messaging:**
- Mandrill Client 1.1 - Email delivery API (deprecated, but in use)
- Lutung 0.0.8 - Mandrill API wrapper

**Code Quality & Utilities:**
- Commons IO 2.11.0 - File and I/O utilities
- JSoup 1.15.4 - HTML parsing
- Nodemon 3.1.10 - Auto-restart translator service during development
- Dotenv 17.2.2 - Environment variable loading

## Configuration

**Environment:**
- `application.yml` at `spring-social/src/main/resources/application.yml` - Spring Boot profile-based configuration
- `.env` files for React frontend:
  - `.env.development` - Dev API URL and settings
  - `staging.env` - Staging environment build
  - `production.env` - Production environment build
  - Pattern: `REACT_APP_*` variables for runtime access
- Profile support: `dev` (default), `staging`, `production`

**Key Configuration Properties:**
- `REACT_APP_API_URL` - Backend API endpoint
- `REACT_APP_URL` - Frontend application URL
- `REACT_APP_COMPLIER` - Code compiler service URL (Judge0)
- `TRANSLATE_APP_API_URL` - Translator microservice endpoint
- `MYSQL_DATABASE` - Database name (`kareer-9` dev, `career-9` docker/staging)
- `app.mandrill` - Mandrill API key
- `app.firebase.project-id` - Firebase project identifier
- `app.auth.tokenSecret` - JWT token signing secret
- `app.auth.tokenExpirationMsec` - JWT expiration (864000000ms = 10 days)

**Build:**
- `pom.xml` - Maven build configuration for Spring Boot backend
- `.babelrc` (implicit in react-scripts) - JavaScript transpilation
- TypeScript configuration: `react-social/tsconfig.json` (target: ES5, module: ESNext)

## Platform Requirements

**Development:**
- Java 11+ JDK installed
- Maven 3.5+ for backend builds
- Node.js 16.17.0 (via nvm or direct install)
- npm 8.x or compatible
- MySQL 5.7+ running locally (port 3306) with database `kareer-9`
- Google Cloud credentials (google.json in classpath)
- Firebase service account credentials

**Production/Staging:**
- Docker with Docker Compose support
- MySQL 5.7+ (containerized or remote)
- Java 11 runtime in container
- Node.js 16.x runtime (for translator service if deployed separately)
- Nginx or reverse proxy for frontend serving
- TLS certificates for HTTPS (configured via Spring Boot SSL settings, commented in `application.yml`)

## Development Commands Summary

**Backend:**
```bash
mvn spring-boot:run                    # Run with dev profile
mvn spring-boot:run -Dspring-boot.run.profiles=staging  # Run with staging profile
mvn clean package                      # Build JAR (default skips tests)
mvn test                               # Run all tests
```

**Frontend:**
```bash
npm start                              # Dev server on port 3000
npm run build                          # Production build
npm run build:stage                    # Staging build with staging.env
npm run build:production               # Production build with production.env
npm test                               # Run Jest tests
npm run format                         # Format code with Prettier
npm run lint                           # Check formatting with Prettier
```

**Docker Deployment:**
```bash
docker-compose up -d                   # Start MySQL and Spring Boot API
docker-compose down                    # Stop services
```

---

*Stack analysis: 2026-02-06*
