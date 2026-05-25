# Directory Structure

**Analysis Date:** 2026-03-06

## Top-Level Layout

```
career-nine/
├── spring-social/              (Spring Boot backend API)
├── react-social/               (React admin frontend - CRA)
├── career-nine-assessment/     (Vite assessment frontend)
├── translator/                 (Node.js translation microservice)
├── docker-compose.yml          (Container orchestration)
├── CLAUDE.md                   (AI assistant instructions)
├── .planning/                  (Project planning docs)
└── Dump20260130 (1).sql        (Database schema dump)
```

## Backend Structure (`spring-social/`)

```
spring-social/
├── src/main/java/com/kccitm/api/
│   ├── SpringSocialApplication.java
│   │
│   ├── controller/                          (47+ REST controllers)
│   │   ├── career9/                         (Career-Nine domain)
│   │   │   ├── Questionaire/                (Questionnaire mgmt)
│   │   │   │   ├── QuestionnaireController.java
│   │   │   │   └── QuestionnaireLanguageController.java
│   │   │   ├── AssessmentTableController.java
│   │   │   ├── AssessmentQuestionController.java
│   │   │   ├── AssessmentQuestionOptionsController.java
│   │   │   ├── AssessmentAnswerController.java
│   │   │   ├── AssessmentDemographicMappingController.java
│   │   │   ├── AssessmentInstituteMappingController.java
│   │   │   ├── AssessmentProctoringController.java
│   │   │   ├── CareerController.java
│   │   │   ├── MeasuredQualitiesController.java
│   │   │   ├── MeasuredQualityTypesController.java
│   │   │   ├── OptionScoreController.java
│   │   │   ├── ToolController.java
│   │   │   ├── StudentController.java
│   │   │   ├── QuestionSectionController.java
│   │   │   ├── LanguageQuestionController.java
│   │   │   ├── LanguageOptionsController.java
│   │   │   ├── LanguagesSupportedController.java
│   │   │   ├── GameTableController.java
│   │   │   ├── GameResultsController.java
│   │   │   ├── DemographicFieldController.java
│   │   │   ├── StudentDemographicResponseController.java
│   │   │   ├── InstituteDetailController.java
│   │   │   ├── SchoolSessionController.java
│   │   │   ├── LeadController.java
│   │   │   └── UserActivityLogController.java
│   │   ├── dashboard/
│   │   │   └── DashboardController.java
│   │   ├── teacher/
│   │   │   └── ClassTeacherDashboardController.java
│   │   ├── principal/
│   │   │   └── PrincipalDashboardController.java
│   │   ├── AuthController.java
│   │   ├── UserController.java
│   │   ├── RoleController.java
│   │   ├── GroupController.java
│   │   ├── StudentInfoController.java
│   │   ├── EmailController.java
│   │   ├── GoogleAdminController.java
│   │   ├── GoogleGroupsController.java
│   │   └── ReportGenerationController.java
│   │
│   ├── service/                             (30+ services)
│   │   ├── dashboard/
│   │   │   └── DashboardService.java
│   │   ├── teacher/
│   │   │   └── ClassTeacherDashboardService.java
│   │   ├── principal/
│   │   │   └── PrincipalDashboardService.java
│   │   ├── EmailService.java
│   │   ├── SmtpEmailServiceImpl.java
│   │   ├── GmailApiEmailServiceImpl.java
│   │   ├── PdfServiceImpl.java
│   │   ├── StudentPdfServiceImpl.java
│   │   ├── FirebaseService.java
│   │   ├── GoogleAPIAdminImpl.java
│   │   ├── GoogleCloudAPIImpl.java
│   │   ├── GoogleDirectoryServiceImpl.java
│   │   ├── OdooLeadService.java
│   │   ├── UserService.java
│   │   ├── StudentService.java
│   │   ├── FacultyService.java
│   │   └── CareerNineRollNumberService.java
│   │
│   ├── repository/                          (83 JPA repositories)
│   │   ├── Career9/                         (Career-Nine domain)
│   │   │   ├── Questionaire/
│   │   │   │   ├── QuestionnaireRepository.java
│   │   │   │   ├── QuestionnaireQuestionRepository.java
│   │   │   │   ├── QuestionnaireLanguageRepository.java
│   │   │   │   ├── QuestionnaireSectionRepository.java
│   │   │   │   └── AssessmentAnswerRepository.java
│   │   │   ├── School/
│   │   │   │   └── InstituteDetailRepository.java
│   │   │   ├── AssessmentTableRepository.java
│   │   │   ├── AssessmentQuestionRepository.java
│   │   │   ├── AssessmentAnswerRepository.java
│   │   │   ├── AssessmentRawScoreRepository.java
│   │   │   ├── StudentAssessmentMappingRepository.java
│   │   │   ├── CareerRepository.java
│   │   │   ├── MeasuredQualitiesRepository.java
│   │   │   ├── MeasuredQualityTypesRepository.java
│   │   │   ├── OptionScoreBasedOnMeasuredQualityTypesRepository.java
│   │   │   ├── ToolRepository.java
│   │   │   ├── UserStudentRepository.java
│   │   │   └── StudentInfoRepository.java
│   │   ├── UserRepository.java
│   │   └── RoleRepository.java
│   │
│   ├── model/                               (112 JPA entities)
│   │   ├── career9/
│   │   │   ├── Questionaire/
│   │   │   │   ├── Questionnaire.java
│   │   │   │   ├── QuestionnaireSection.java
│   │   │   │   ├── QuestionnaireQuestion.java
│   │   │   │   ├── QuestionnaireLanguage.java
│   │   │   │   └── QuestionnaireSectionInstruction.java
│   │   │   ├── school/
│   │   │   │   ├── InstituteDetail.java
│   │   │   │   ├── SchoolSession.java
│   │   │   │   ├── SchoolClasses.java
│   │   │   │   └── SchoolSections.java
│   │   │   ├── AssessmentTable.java
│   │   │   ├── AssessmentQuestions.java
│   │   │   ├── AssessmentQuestionOptions.java
│   │   │   ├── AssessmentAnswer.java
│   │   │   ├── AssessmentRawScore.java
│   │   │   ├── StudentAssessmentMapping.java
│   │   │   ├── Career.java
│   │   │   ├── MeasuredQualities.java
│   │   │   ├── MeasuredQualityTypes.java
│   │   │   ├── OptionScoreBasedOnMEasuredQualityTypes.java
│   │   │   ├── Tool.java
│   │   │   ├── UserStudent.java
│   │   │   ├── StudentInfo.java
│   │   │   └── GameTable.java
│   │   ├── userDefinedModel/
│   │   │   └── StudentDashboardResponse.java
│   │   ├── User.java
│   │   ├── Role.java
│   │   ├── Group.java
│   │   └── AuthProvider.java (ENUM)
│   │
│   ├── security/
│   │   ├── CustomUserDetailsService.java
│   │   ├── RestAuthenticationEntryPoint.java
│   │   ├── TokenAuthenticationFilter.java
│   │   ├── TokenProvider.java
│   │   └── oauth2/
│   │       ├── CustomOAuth2UserService.java
│   │       ├── OAuth2AuthenticationSuccessHandler.java
│   │       ├── OAuth2AuthenticationFailureHandler.java
│   │       ├── HttpCookieOAuth2AuthorizationRequestRepository.java
│   │       └── user/
│   │           ├── OAuth2UserInfo.java
│   │           ├── GoogleOAuth2UserInfo.java
│   │           ├── GitHubOAuth2UserInfo.java
│   │           └── FacebookOAuth2UserInfo.java
│   │
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── WebMvcConfig.java
│   │   ├── AppProperties.java
│   │   ├── CacheConfig.java
│   │   ├── FirebaseConfig.java
│   │   ├── SmtpMailConfig.java
│   │   ├── MandrillConfig.java
│   │   ├── HtmlToPdfConverter.java
│   │   └── HttpsRedirectConfig.java
│   │
│   ├── exception/
│   │   ├── ResourceNotFoundException.java
│   │   ├── BadRequestException.java
│   │   ├── OAuth2AuthenticationProcessingException.java
│   │   └── EmailSendException.java
│   │
│   ├── util/
│   ├── payload/
│   └── Pdf/
│
├── src/main/resources/
│   ├── application.yml              (Multi-profile config)
│   ├── firebase-service-account.json
│   └── keystore.p12
│
├── pom.xml
└── Dockerfile
```

## Admin Frontend Structure (`react-social/`)

```
react-social/
├── src/
│   ├── index.tsx                            (Entry point)
│   ├── app/
│   │   ├── App.tsx                          (Root component)
│   │   ├── firebase.ts                      (Firebase init)
│   │   │
│   │   ├── routing/
│   │   │   ├── AppRoutes.tsx               (Public + auth routes)
│   │   │   └── PrivateRoutes.tsx           (Role-based protected routes)
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/                        (Auth context & hooks)
│   │   │   │   ├── AuthContext.tsx
│   │   │   │   ├── AuthInit.tsx
│   │   │   │   ├── useAuth.tsx
│   │   │   │   ├── AuthPage.tsx
│   │   │   │   └── Logout.tsx
│   │   │   ├── role/
│   │   │   ├── roleUser/
│   │   │   ├── errors/
│   │   │   │   ├── Error401.tsx
│   │   │   │   ├── Error403.tsx
│   │   │   │   ├── Error404.tsx
│   │   │   │   └── ErrorsPage.tsx
│   │   │   ├── apps/
│   │   │   ├── accounts/
│   │   │   ├── profile/
│   │   │   ├── wizards/
│   │   │   └── widgets/
│   │   │
│   │   ├── pages/                           (52 feature pages)
│   │   │   ├── Career/
│   │   │   │   ├── CareerPage.tsx
│   │   │   │   ├── API/Career_APIs.ts
│   │   │   │   └── components/
│   │   │   │       ├── CareerTable.tsx
│   │   │   │       ├── CareerCreatePage.tsx
│   │   │   │       ├── CareerEditPage.tsx
│   │   │   │       └── index.ts
│   │   │   ├── CreateAssessment/
│   │   │   │   ├── Assessment.tsx
│   │   │   │   ├── API/
│   │   │   │   └── components/
│   │   │   │       ├── questionaire/
│   │   │   │       ├── assessment/
│   │   │   │       ├── AssessmentSection.tsx
│   │   │   │       └── AssessmentQuestion.tsx
│   │   │   ├── AssesmentQuestions/
│   │   │   │   ├── API/AssesmentQuestion_APIs.ts
│   │   │   │   └── components/
│   │   │   │       ├── QuestionTable.tsx
│   │   │   │       ├── QuestionBulkUploadModal.tsx
│   │   │   │       ├── QuestionCreateModal.tsx
│   │   │   │       └── QuestionEditModal.tsx
│   │   │   ├── Tool/
│   │   │   ├── MeasuredQualities/
│   │   │   ├── MeasuredQualityTypes/
│   │   │   ├── QuestionSections/
│   │   │   ├── DemographicFields/
│   │   │   ├── StudentLogin/
│   │   │   │   ├── StudentLoginPage.tsx
│   │   │   │   ├── AllottedAssessmentPage.tsx
│   │   │   │   ├── DemographicDetailsPage.tsx
│   │   │   │   └── AssessmentContext.tsx
│   │   │   ├── OnlineAssement/
│   │   │   ├── StudentRegistration/
│   │   │   ├── FacultyRegistration/
│   │   │   ├── StudentInformation/
│   │   │   ├── StudentDashboard/
│   │   │   ├── ClassTeacherDashboard/
│   │   │   ├── PrincipalDashboard/
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardWrapper.tsx
│   │   │   │   ├── SchoolDashboardPage.tsx
│   │   │   │   ├── InstituteDashboard.tsx
│   │   │   │   └── widgets/
│   │   │   ├── Group/
│   │   │   ├── GroupStudent/
│   │   │   ├── Users/
│   │   │   ├── Reports/
│   │   │   ├── ActivityLog/
│   │   │   ├── Leads/
│   │   │   ├── Games/
│   │   │   ├── UniversityResult/
│   │   │   ├── ContactPerson/
│   │   │   ├── Branch/
│   │   │   ├── Batch/
│   │   │   ├── Course/
│   │   │   ├── Session/
│   │   │   ├── GoogleGroups/
│   │   │   ├── AssessmentMapping/
│   │   │   └── Login/
│   │   │
│   │   ├── model/                           (TypeScript interfaces)
│   │   ├── components/
│   │   │   └── omr/
│   │   └── styles/
│   │
│   ├── _metronic/                           (UI framework)
│   │   ├── layout/
│   │   │   ├── MasterLayout.tsx
│   │   │   ├── MasterInit.tsx
│   │   │   └── core/
│   │   ├── partials/
│   │   │   ├── layout/header/
│   │   │   ├── layout/sidebar/
│   │   │   ├── layout/footer/
│   │   │   ├── modals/
│   │   │   └── widgets/
│   │   ├── assets/
│   │   ├── helpers/
│   │   └── i18n/
│   │
│   ├── types/
│   └── firebase.ts
│
├── public/
├── package.json
├── tsconfig.json
├── .env.development
├── staging.env
├── production.env
└── dockerfile
```

## Assessment Frontend (`career-nine-assessment/`)

Separate Vite-based React app for student assessment taking:
- React 19, TypeScript 5.9, Vite 7.3
- MediaPipe (face detection) + WebGazer (eye tracking) for proctoring
- Firebase integration for real-time sync
- PWA support with offline caching

## Translator Service (`translator/`)

Node.js Express microservice:
- Port 5000
- OpenAI GPT-3.5-turbo for Hindi translations
- Endpoints: `/translate/question`, `/translate/option`

## Naming Conventions

### Backend (Java)

| Type | Convention | Example |
|------|-----------|---------|
| Packages | lowercase | `com.kccitm.api.controller.career9` |
| Classes | PascalCase | `CareerController`, `AssessmentTable` |
| Controllers | `{Entity}Controller` | `CareerController.java` |
| Services | `{Entity}Service` / `{Entity}ServiceImpl` | `PdfService.java` / `PdfServiceImpl.java` |
| Repositories | `{Entity}Repository` | `CareerRepository.java` |
| Entities | PascalCase singular | `Career.java`, `Tool.java` |
| REST paths | kebab-case | `/assessment-questions`, `/measured-quality-types` |
| Methods | camelCase verb+noun | `getAllCareers()`, `createCareer()` |

**Inconsistencies:**
- Repository package: `Career9/` (PascalCase) vs controller: `career9/` (lowercase)
- Misspelling: `Questionaire/` (missing 'n')
- Entity naming: `OptionScoreBasedOnMEasuredQualityTypes` (typo in 'MEasured')

### Frontend (TypeScript/React)

| Type | Convention | Example |
|------|-----------|---------|
| Directories | PascalCase | `Career/`, `CreateAssessment/` |
| Pages | PascalCase + `Page` | `CareerPage.tsx` |
| Components | PascalCase | `CareerTable.tsx`, `QuestionCreateModal.tsx` |
| API files | `{Feature}_APIs.ts` | `Career_APIs.ts` |
| API functions | PascalCase verb+noun | `ReadCareersData()`, `CreateCareerData()` |
| Interfaces | PascalCase | `Career.ts`, `Assessment.ts` |
| Context | `{Feature}Context.tsx` | `AssessmentContext.tsx` |
| Barrel exports | `index.ts` | Component directory exports |

## How to Add New Features

### Adding a New Backend Entity

1. **Create Entity** in `model/career9/`:
   ```java
   @Entity @Table(name = "entity_name")
   public class EntityName { ... }
   ```

2. **Create Repository** in `repository/Career9/`:
   ```java
   public interface EntityNameRepository extends JpaRepository<EntityName, Long> { }
   ```

3. **Create Controller** in `controller/career9/`:
   ```java
   @RestController @RequestMapping("/entity-name")
   public class EntityNameController { }
   ```

4. **(Optional) Create Service** in `service/`:
   - Interface + implementation for complex business logic

5. **Update SecurityConfig** if endpoint needs public access

### Adding a New Frontend Page

1. **Create directory** `pages/{FeatureName}/`

2. **Create API file** `pages/{FeatureName}/API/{FeatureName}_APIs.ts`:
   ```typescript
   const BASE_URL = process.env.REACT_APP_API_URL;
   export function ReadFeatureData() { return axios.get(`${BASE_URL}/entity-name/getAll`); }
   ```

3. **Create page components** in `pages/{FeatureName}/components/`:
   - `FeatureTable.tsx` - Data table
   - `FeatureCreatePage.tsx` - Create form
   - `FeatureEditPage.tsx` - Edit form
   - `index.ts` - Barrel export

4. **Create main page** `pages/{FeatureName}/FeaturePage.tsx`

5. **Add route** in `routing/PrivateRoutes.tsx`:
   ```tsx
   <Route path="/feature/*" element={<FeaturePage />} />
   ```

6. **Add menu item** in `_metronic/partials/layout/sidebar/AsideMenuMain.tsx`

## Configuration File Locations

| File | Purpose |
|------|---------|
| `spring-social/src/main/resources/application.yml` | Backend config (all profiles) |
| `spring-social/pom.xml` | Backend dependencies |
| `react-social/package.json` | Frontend dependencies |
| `react-social/tsconfig.json` | TypeScript config |
| `react-social/.env.development` | Dev environment vars |
| `react-social/staging.env` | Staging environment vars |
| `react-social/production.env` | Production environment vars |
| `docker-compose.yml` | Container orchestration |
| `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java` | Security/CORS/OAuth2 |
| `spring-social/src/main/resources/firebase-service-account.json` | Firebase credentials |