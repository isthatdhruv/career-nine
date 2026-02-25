# Codebase Structure

**Analysis Date:** 2026-02-06

## Directory Layout

```
career-nine/
├── spring-social/                  # Spring Boot REST API backend
│   ├── src/main/java/com/kccitm/api/
│   │   ├── controller/career9/     # REST endpoints (19+ controllers)
│   │   ├── service/                # Business logic & integrations (20+ services)
│   │   ├── repository/Career9/     # JPA repository interfaces (30+ repos)
│   │   ├── model/career9/          # JPA entities (25+ entities)
│   │   ├── security/               # Auth filters, JWT, OAuth2 handlers
│   │   ├── config/                 # Spring configuration, CORS, Security, Properties
│   │   ├── exception/              # Custom exception classes
│   │   ├── util/                   # Utility functions
│   │   ├── payload/                # Request/response DTOs
│   │   └── Pdf/                    # PDF generation
│   ├── src/main/resources/
│   │   ├── application.yml         # Profile-based configuration
│   │   └── keystore.p12            # SSL certificate
│   └── pom.xml                     # Maven dependencies
│
├── react-social/                   # React 18 TypeScript frontend SPA
│   ├── src/
│   │   ├── index.tsx               # App entry point
│   │   ├── app/
│   │   │   ├── App.tsx             # Root layout wrapper
│   │   │   ├── pages/              # Feature pages (42+ pages)
│   │   │   │   ├── StudentInformation/
│   │   │   │   ├── AssesmentQuestions/
│   │   │   │   ├── StudentOnlineAssessment/
│   │   │   │   ├── CreateAssessment/
│   │   │   │   ├── ... (38 more pages)
│   │   │   ├── modules/            # Shared features (auth, roles, profiles, accounts)
│   │   │   │   ├── auth/           # Authentication context & OAuth2 handling
│   │   │   │   ├── role/
│   │   │   │   ├── roleUser/
│   │   │   │   └── accounts/
│   │   │   ├── routing/            # React Router configuration
│   │   │   │   ├── AppRoutes.tsx   # Public + private routes
│   │   │   │   └── PrivateRoutes.tsx
│   │   │   ├── components/         # Shared components (OMR, etc.)
│   │   │   ├── model/              # TypeScript interfaces
│   │   │   └── firebase.ts         # Firebase SDK config
│   │   ├── _metronic/              # Metronic UI framework
│   │   │   ├── layout/             # Layout system, splash screen
│   │   │   ├── assets/             # SCSS styles, fonts
│   │   │   ├── i18n/               # Internationalization
│   │   │   └── helpers/
│   │   └── setupTests.ts
│   ├── public/
│   ├── package.json                # npm dependencies
│   └── .env, .env.staging, .env.production
│
├── translator-service/             # Node.js translation microservice
│   └── (language translation endpoint)
│
├── online-Assement/               # Standalone assessment module
│
├── docker-compose.yml              # Docker configuration (MySQL + API)
├── CLAUDE.md                       # Development guidelines
├── BULK_UPLOAD_INSTRUCTIONS.md     # Question bulk upload documentation
└── career-9.sql, Dump*.sql        # Database schema & seed data
```

## Directory Purposes

**Backend - Controllers (`spring-social/src/main/java/com/kccitm/api/controller/career9/`):**
- Purpose: REST endpoint definitions
- Contains: 19+ controller classes for assessments, questions, scoring, languages, institutions
- Key files: `AssessmentTableController.java`, `AssessmentQuestionController.java`, `AssessmentAnswerController.java`, `QuestionnaireController.java`, `ToolController.java`, `MeasuredQualityTypesController.java`, `StudentController.java`

**Backend - Services (`spring-social/src/main/java/com/kccitm/api/service/`):**
- Purpose: Business logic, external integrations
- Contains: Google API handlers, PDF generation, student email services, CSV readers
- Key files: `GoogleDirectoryService.java`, `GoogleCloudAPI.java`, `PdfService.java`, `StudentGoogleEmailGenerateService.java`, `CsvReaderImp.java`

**Backend - Repositories (`spring-social/src/main/java/com/kccitm/api/repository/Career9/`):**
- Purpose: Database abstraction via Spring Data JPA
- Contains: 30+ repository interfaces with custom query methods
- Key files: `AssessmentTableRepository.java`, `StudentAssessmentMappingRepository.java`, `MeasuredQualityTypesRepository.java`, `QuestionnaireRepository.java`
- Subdirectories: `Questionaire/` (new questionnaire system), `School/` (institute management)

**Backend - Models (`spring-social/src/main/java/com/kccitm/api/model/career9/`):**
- Purpose: JPA entity definitions
- Contains: 25+ entity classes
- Key files: `AssessmentTable.java`, `StudentAssessmentMapping.java`, `Questionnaire.java`, `AssessmentQuestions.java`, `MeasuredQualityTypes.java`, `UserStudent.java`
- Subdirectories: `Questionaire/` (new assessment entities), `school/` (institute entities)

**Backend - Security (`spring-social/src/main/java/com/kccitm/api/security/`):**
- Purpose: Authentication and authorization
- Contains: JWT token provider, OAuth2 handlers, custom user details service
- Key files: `TokenProvider.java`, `TokenAuthenticationFilter.java`, `CustomOAuth2UserService.java`, `OAuth2AuthenticationSuccessHandler.java`, `UserPrincipal.java`
- Subdirectories: `oauth2/` (OAuth2 providers & handlers)

**Backend - Configuration (`spring-social/src/main/java/com/kccitm/api/config/`):**
- Purpose: Spring Boot configuration
- Key files: `SecurityConfig.java` (JWT + OAuth2), `WebMvcConfig.java` (CORS), `AppProperties.java` (config properties), `HtmlToPdfConverter.java`, `MandrillConfig.java`

**Frontend - Pages (`react-social/src/app/pages/`):**
- Purpose: Feature-specific page components
- Contains: 42+ page directories, each with optional API/, components/ subdirectories
- Major pages: `StudentOnlineAssessment/` (test-taking UI), `AssesmentQuestions/` (question management with bulk upload), `StudentInformation/` (student CRUD), `CreateAssessment/` (assessment setup), `Login/` (OAuth2 login), `dashboard/`, `Reports/`

**Frontend - Page Structure Pattern:**
- Layout: `PageName/`
  - `API/` directory: API call functions (e.g., `Student_APIs.ts`, `Question_APIs.ts`)
  - `components/` directory: Modals, tables, forms (e.g., `CreateStudentModal.tsx`, `QuestionTable.tsx`)
  - Main file: `PageName.tsx` or `PageNamePage.tsx` or specific feature file

**Frontend - Modules (`react-social/src/app/modules/`):**
- Purpose: Shared features across pages
- Key modules:
  - `auth/core/`: Auth context, JWT handling, user request
  - `role/`: Role-based access control
  - `roleUser/`: User-role relationships
  - `profile/`: User profile management
  - `accounts/`: Account management
  - `widgets/`, `wizards/`, `errors/`: UI components & templates

**Frontend - Routing (`react-social/src/app/routing/`):**
- Purpose: React Router configuration
- Key files:
  - `AppRoutes.tsx`: Public routes (login, registration, OAuth2 redirect), private route wrapper
  - `PrivateRoutes.tsx`: Protected routes requiring authentication, role-based route guards

**Frontend - Models (`react-social/src/app/model/`):**
- Purpose: TypeScript interfaces for API contracts
- Key files: `AssessmentQuestion.interface.ts`, `AssessmentQuestionOption.interface.ts`, `MeasuredQualityType.interface.ts`, `Tool.interface.ts`

**Configuration Files (`spring-social/src/main/resources/`):**
- `application.yml`: Spring profiles (dev/staging/production) with datasource, OAuth2, JWT, CORS, Google API configs
- Profile-specific: Each profile has separate datasource, Firebase, Mandrill configs

## Key File Locations

**Entry Points:**
- Backend: `src/main/java/com/kccitm/api/SpringSocialApplication.java` (Spring Boot application class)
- Frontend: `src/index.tsx` (React root render), `src/app/App.tsx` (root layout)
- Auth redirect: `src/app/pages/authRedirectPage.tsx` (OAuth2 callback handler)

**Configuration:**
- Backend: `spring-social/src/main/resources/application.yml` (all profiles)
- Backend: `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java` (JWT + OAuth2 setup)
- Frontend: `react-social/src/app/modules/auth/core/Auth.tsx` (auth context), `AuthHelpers.ts` (token storage)
- Frontend: `.env`, `.env.staging`, `.env.production` (API URL by environment)

**Core Logic:**
- Question import/export: `src/main/java/com/kccitm/api/controller/career9/AssessmentQuestionController.java` (/export-excel, /import-excel)
- Question bulk upload modal: `src/app/pages/AssesmentQuestions/components/QuestionBulkUploadModal.tsx`
- Assessment answer submission: `src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java` (/submit)
- Assessment status tracking: `src/main/java/com/kccitm/api/model/career9/StudentAssessmentMapping.java`

**Testing:**
- Backend: `src/test/java/` (JUnit + Spring Boot Test)
- Frontend: `**/*.test.tsx`, `**/*.spec.tsx` files alongside components
- Test setup: `src/setupTests.ts`

## Naming Conventions

**Files:**
- Controllers: `[Entity]Controller.java` (e.g., `AssessmentTableController.java`)
- Services: `[Feature]Service.java` (interface), `[Feature]ServiceImpl.java` (implementation)
- Repositories: `[Entity]Repository.java` (e.g., `StudentAssessmentMappingRepository.java`)
- Entities: `[Entity].java` (e.g., `AssessmentTable.java`)
- React components: PascalCase (e.g., `StudentOnlineAssessment.tsx`, `QuestionBulkUploadModal.tsx`)
- React pages: `PageName.tsx` or `PageNamePage.tsx`
- API functions: `[Feature]_APIs.ts` or `[Feature]_APIs.tsx` (e.g., `Student_APIs.tsx`, `Question_APIs.ts`)
- TypeScript interfaces: `[Entity].interface.ts` (e.g., `AssessmentQuestion.interface.ts`)

**Directories:**
- Packages: lowercase, kebab-case for compound (e.g., `career9`, `Questionaire`)
- React feature folders: PascalCase (e.g., `StudentInformation/`, `AssesmentQuestions/`)
- Subdirectories: Functional grouping (e.g., `API/`, `components/`, `oauth2/`)

**Java Classes:**
- Entities: Singular or compound (e.g., `AssessmentTable`, `StudentAssessmentMapping`)
- Enums: UPPERCASE (e.g., assessment status values)
- Generics: `<T>` for type, `<K, V>` for maps

## Where to Add New Code

**New Feature (Full CRUD):**
- Backend JPA entity: `spring-social/src/main/java/com/kccitm/api/model/career9/[Entity].java`
- Backend repository: `spring-social/src/main/java/com/kccitm/api/repository/Career9/[Entity]Repository.java`
- Backend controller: `spring-social/src/main/java/com/kccitm/api/controller/career9/[Entity]Controller.java` (endpoints: /getAll, /get/{id}, /create, /update/{id}, /delete/{id})
- Frontend page: `react-social/src/app/pages/[Feature]/` with:
  - `[Feature]Page.tsx` (main page container)
  - `API/[Feature]_APIs.ts` (axios calls)
  - `components/[Feature]Table.tsx` (data display)
  - `components/[Feature]Modal.tsx` (create/edit)

**New Component/Modal:**
- Create in `react-social/src/app/pages/[Feature]/components/[ComponentName].tsx`
- Export from `components/index.ts` barrel file
- Import in feature page and use as `<ComponentName />`

**Utilities:**
- Shared helpers: `react-social/src/app/modules/[module]/` or `src/_metronic/helpers/`
- Backend utilities: `spring-social/src/main/java/com/kccitm/api/util/`

**Models/Interfaces:**
- TypeScript: `react-social/src/app/model/[Entity].interface.ts`
- Backend: `spring-social/src/main/java/com/kccitm/api/model/career9/[Entity].java`

**Services (Backend Business Logic):**
- Location: `spring-social/src/main/java/com/kccitm/api/service/[FeatureName]Service.java` (interface + Impl)
- Pattern: Define interface in same directory, create [FeatureName]ServiceImpl.java
- Inject in controllers via @Autowired

## Special Directories

**Google Integration Files:**
- Location: `spring-social/src/main/resources/` (not in repo, must be added locally)
- Files: `google.json` (service account), `firebase-service-account.json` (Firebase admin)
- Generated: No, manually created from Google Cloud Console
- Committed: No, listed in .gitignore

**Temporary/Generated Files:**
- Build output: `spring-social/target/`, `react-social/build/`
- Dependencies: `spring-social/` has Maven cached deps, `react-social/node_modules/`
- Generated: Yes
- Committed: No, listed in .gitignore

**Database Files:**
- Location: Root directory
- Files: `career-9.sql` (schema), `Dump*.sql` (seed data)
- Generated: No (checked in)
- Committed: Yes, for environment setup

**Configuration Directories:**
- `.planning/codebase/` - Codebase analysis documents (created by GSD mapper)
- `.claude/` - Claude development workspace files
- `.vscode/` - VS Code workspace settings

**Frontend Build Outputs:**
- `react-social/build/` - Production build output (generated)
- `react-social/.env.production` - Production environment variables (not committed, example provided)

---

*Structure analysis: 2026-02-06*
