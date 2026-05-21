# Career-Nine Frontend — Pages, Backend API Calls & Auth Handling

Audit of `react-social/src/app` on branch `attribute-based-auth`. For every feature
page / module: (A) the backend HTTP calls it makes and (B) how the page's *code*
handles authentication & authorization. Source-cited throughout as `path:line`.

> **Method note:** This is a static read of the source. Calls are catalogued from each
> page's `API/*_APIs.ts` file plus inline `axios.*` calls in components. Backend
> controller mapping is inferred from the endpoint path against the Spring `spring-social`
> conventions documented in `CLAUDE.md`; a few endpoints (`/admin/tracker/*`,
> `/entitlement/*`, `/firebase-mapping/*`, `/api/*` counselling) are newer than that doc
> and were mapped by path prefix.

---

## 1. Global Architecture — Routing, Axios & Auth

### 1.1 Axios / token plumbing (the single most important fact)

- **One global axios instance** is configured once at boot: `src/index.tsx:34` calls
  `setupAxios(axios)` (`src/app/modules/auth/core/AuthHelpers.ts:76`).
- **Almost every API file** does `import axios from "axios"` and `const API_URL =
  process.env.REACT_APP_API_URL`. They therefore all inherit the global interceptors —
  there is no per-page axios config for auth. Pages do **not** attach tokens themselves.
- Auth transport is **cookie-based (Phase 16/18)**, not bearer headers:
  - `axios.defaults.withCredentials = true` (`AuthHelpers.ts:78`) → the HttpOnly `cn_at`
    cookie rides on every request.
  - **Request interceptor** (`AuthHelpers.ts:82`): on POST/PUT/PATCH/DELETE it copies the
    JS-readable `cn_csrf` cookie into the `X-CSRF-Token` header.
  - **Response interceptor** (`AuthHelpers.ts:104`): `401` → silent `POST /auth/refresh`
    (deduped via a single in-flight promise) then retry once; on repeat-401 or refresh
    failure → toast + `window.location.href="/auth"`. `403` → toast + redirect to a
    persona `/permission-denied` page. `5xx` → toast. `400/409` pass through to the caller.
- **Exceptions that bypass the global instance:**
  - `StudentLogin/API/assessmentApi.ts` — its own `axios.create()` instance that injects
    `X-Assessment-Session / X-Assessment-Student-Id / X-Assessment-Id` headers from
    session/localStorage (`assessmentApi.ts:20-49`). **Explicitly `@deprecated`** (header
    comment lines 1-14); retained for the legacy assessment flow.
  - A few files hardcode a base URL instead of `REACT_APP_API_URL`:
    - `PrincipalDashboard/API/PrincipalDashboard_APIs.ts:3` → `http://localhost:8080/api/principal/dashboard` (hardcoded).
    - `AssesmentQuestions/API/Translate_APIs.ts:2,47` → `http://localhost:5000` — the **Node translation/match microservice**, no auth, separate service.
    - `StudentInformation/Student_APIs.tsx:5` & `StudentInfo_APIs.ts:4` → file-fetch URL `http://192.168.146.239:8080/util/` (hardcoded internal IP).
    - Several files use `process.env.REACT_APP_API_URL || 'http://localhost:8080'` / `:8091` fallbacks (cosmetic; prod sets the env var).

### 1.2 Auth model (RBAC + ABAC + URL whitelist)

- `User` shape (`auth/core/_models.ts`): `permissions[]`, `scopes[{i,s,c,x}]`, `urls[]`,
  `superAdmin`. Hydrated from **`GET /auth/me`** at boot (`Auth.tsx:87`, `AuthInit`).
- `useAuth().can(perm, scope)` → `allows()` (`auth/core/permissions.ts:25`): super-admin
  bypasses everything; else must hold `perm`; if a scope is supplied at least one user
  scope row must match every non-null dimension.
- **Route guard** `<RequirePermission perm scope>` (`auth/components/RequirePermission.tsx`):
  intersection of (a) `can(perm)` **and** (b) `urlAllowed(currentUser.urls, pathname)`
  (`permissions.ts:100`). Fails → renders `<RequestAccessPage>`. Super-admin bypasses both.
- **Declarative UI gate** `<Can perm>` (`auth/components/Can.tsx`) and hook `useCan()`
  (`auth/core/useCan.ts`) exist but are used **only in the side menu** (see §1.4) — no
  feature page uses `<Can>`/`useCan()` for per-button gating.

### 1.3 Route registration & guard status

- Top router `AppRoutes.tsx`. If `currentUser` is falsy → only `auth/*` + redirect to
  `/auth`; else mounts `<PrivateRoutes/>` (`AppRoutes.tsx:320`).
- `PrivateRoutes.tsx` wraps the admin shell in `<AuthorizedLayout>` (just `MasterLayout`,
  no URL-pattern enforcement — `PrivateRoutes.tsx:102`). **Per-route** auth is the
  `<RequirePermission>` wrapper on each `<Route>`. Routes intentionally left **unguarded**
  for any logged-in user: `/dashboard`, `/game-list`, and the entire `/student/*` portal
  block inside PrivateRoutes (Phase-17/19 decision, `PrivateRoutes.tsx:87-100,440-480`).
- **Public routes** (no login) live in `AppRoutes.tsx` under `<App/>`: `/student-details`,
  `/oauth2/redirect`, `/permission-denied`, `/thankyou`, `/student/registration-form`,
  `/student/registration-existing`, `/faculty/registration-form`, `/re-fillForm/*`,
  `/school-register/:token`, `/payment-register/:transactionId`, `/principal/dashboard`,
  `classroom/*`, and several `ExternalRedirect`/landing redirects (`/allotted-assessment`,
  `/demographics`, `/student-login`, `/c/:slug`, `/payment-status`, `/assessment-register/:token`).
- **Persona portals** are standalone route trees with their **own role guards**, not
  `RequirePermission`:
  - `/student/*` → `StudentRoutes.tsx`; `StudentAuthGuard` (line 56) requires `currentUser`
    + role `STUDENT|B2C_STUDENT` (super-admin bypass); `StudentInfoGuard` (line 91) forces
    profile completion.
  - `/counsellor/*` → `CounsellorRoutes.tsx`; `CounsellorAuthGuard` (line 58) requires
    role `COUNSELLOR` (super-admin bypass).
  - Note: the SAME student-portal pages are ALSO mounted **unguarded** inside
    `PrivateRoutes.tsx:441-480` (`/student/login`, `/student/dashboard`, etc.). The
    role-guarded copies are the `StudentRoutes` ones at `/student/*` via `AppRoutes`.

### 1.4 Menu gating (`_metronic/.../aside/AsideMenuMain.tsx`)

- Computes group-visibility flags with `can(...)` (lines 34-104) and wraps individual
  items in `<Can perm=...>` (lines 131+). This hides menu entries the user can't use, but
  it is **cosmetic** — the route guard + backend are the real gates.

---

## 2. Per-Page Inventory

Route guard column legend: **RP=`<RequirePermission perm>`**, **Public=no auth**,
**LoggedIn=mounted in PrivateRoutes without RP**, **RoleGuard=persona guard**.
All calls use the global axios instance (cookie+CSRF) unless noted.

### 2.1 Dashboards

**Admin Dashboard** — `demo-dashboard-v2/dashboard-admin.tsx` · route `/dashboard`
(LoggedIn, no RP) · API: `demo-dashboard-v2/dashboard-admin.api.ts`

| Method | Endpoint | Backend | Trigger |
|---|---|---|---|
| GET | `/dashboard/admin/snapshot` | DashboardController | load |
| POST | `/dashboard/admin/snapshot/refresh` | DashboardController | refresh btn |
| GET | `/student-info/getAll`, `/instituteDetail/get`, `/api/counsellor/getAll`, `/assessments/getAll`, `/generated-reports/getAll`, `/activity-log/logins`, `/student-info/getStudentsWithMappingByInstituteId/{id}`, `/student-info/getAllStudentsWithMapping`, `/api/counselling-appointment/getAll`, `/api/counselling-rating/summary-by-counsellor` | various | granular fallbacks |

**Institute / School Dashboard** — `dashboard/InstituteDashboard.tsx`,
`dashboard/SchoolDashboardPage.tsx` · routes `/school/principal/dashboard/:id`,
`/dashboard/school/:id` (RP `institute.read`).

**Principal Dashboard** — `PrincipalDashboard/PrincipalDashboard.tsx` · route
`/principal/dashboard` (**Public**, in AppRoutes) · API hardcodes
`http://localhost:8080/api/principal/dashboard`:

| Method | Endpoint | Trigger |
|---|---|---|
| GET | `/api/principal/dashboard/data/{principalId}?assessmentId=` | load |
| GET | `/api/principal/dashboard/{overview,assessment-performance,classwise-performance,teacher-activity,enrollment-trends}/{id}`, `/assessments` | section loads |

**Class Teacher Dashboard** — `ClassTeacherDashboard/ClassTeacherDashboard.tsx` · route
`/teacher/class-dashboard` (RP `student.read`) · API `ClassTeacherDashboard_APIs.ts`:
GET `/teacher/dashboard/{complete,class-overview,student-performance,assessment-completion,cognitive-trends,assessments}/{teacherId}`.

### 2.2 Assessment authoring

**Assessments list / create wizard** — `CreateAssessment/*` · routes `/assessments` (RP
`assessment.read`), `/assessments/create*`, `/assessments/edit/:id`, `/questionare/*`
(RP `assessment.create`) · API `Create_Assessment_APIs.ts`, `Create_Questionaire_APIs.ts`,
`Assessment_Demographics_APIs.ts`.

| Method | Endpoint | Backend |
|---|---|---|
| GET | `/assessments/getAll`, `/assessments/get/list`, `/assessments/getById/{id}`, `/assessments/getby/{id}`, `/assessments/deleted`, `/assessments/is-locked-by-questionnaire/{id}`, `/assessments/is-locked-by-question/{id}` | AssessmentTableController |
| POST/PUT/DELETE | `/assessments/create`, `/assessments/update/{id}`, `/assessments/delete/{id}`, `/assessments/{id}` (soft), `/assessments/{id}/lock`, `/assessments/{id}/unlock`, `/assessments/restore/{id}`, `/assessments/permanent-delete/{id}` | AssessmentTableController |
| GET/POST/PUT/DELETE | `/api/questionnaire/get`, `/get/list`, `/getbyid/{id}`, `/create`, `/update/{id}`, `/delete/{id}`, `/deleted`, `/restore/{id}`, `/permanent-delete/{id}` | QuestionnaireController |
| GET | `/language-supported/getAll` | LanguagesSupportedController |
| GET/POST/DELETE | `/assessment-demographics/getByAssessment/{id}`, `/save`, `/remove/{aid}/{fid}` | AssessmentDemographics |

**Assessment Questions** — `AssesmentQuestions/*` · routes `/assessment-questions`
(RP `assessment.read`), `.../create|edit/:id|duplicates` (RP `assessment.create`) ·
API `Question_APIs.ts`, `Language_APIs.ts`, `Translate_APIs.ts`.

| Method | Endpoint | Backend |
|---|---|---|
| GET | `/assessment-questions/getAll`, `/getAllList`, `/get/{id}`, `/mqt-counts`, `/deleted`, `/{id}/measured-quality-types`, `/export-excel` (blob) | AssessmentQuestionController |
| POST/PUT/DELETE | `/assessment-questions/create`, `/update/{id}`, `/delete/{id}`, `/restore/{id}`, `/permanent-delete/{id}`, `/import-excel` (multipart) | " |
| POST/DELETE | `/measured-quality-types/{tid}/assessment-questions/{qid}` | MeasuredQualityTypes |
| POST | `/option-scores/create` | OptionScoreController |
| POST/DELETE | `/question-media/upload`, `/question-media/delete` | QuestionMedia |
| GET/POST | `/language-supported/getAll`, `/language-supported/get/{id}`, `/language-question/create-with-options` | Language controllers |
| POST | `localhost:5000/translate/{question,option,all}`, `localhost:5000/match/{option,options-bulk}` | **Node microservice, no auth** |

**Question Sections** — `QuestionSections/*` + `OnlineAssement/QuestionSections/*` · routes
`/question-sections*` (RP read/create) · API `Question_Section_APIs.ts`: GET
`/question-sections/{getAll,getAllList,get/{id},deleted}`, POST `/create`, PUT
`/update/{id}`, `/restore/{id}`, DELETE `/delete/{id}`, `/permanent-delete/{id}`.

**Tools / Measured Qualities / MQ Types / Careers / Lists / Demographic Fields / Games** —
all RP `assessment.read` (view) / `assessment.create` (mutations); Games at `/game-list`
is **LoggedIn (no RP)**.

| Page (route) | API file | Endpoints (base) |
|---|---|---|
| Tool `/tools` | `Tool_APIs.ts` | GET `/tools/getAll`,`/get/`; POST `/tools/create`; PUT `/tools/update/{id}`; DELETE `/tools/delete/` |
| MeasuredQualities `/measured-qualities` | `Measured_Qualities_APIs.ts` | `/measured-qualities/{getAll,get/,create,update/{id},delete/,deleted,restore/{id},permanent-delete/{id}}`; `/tools/{tid}/measured-qualities/{qid}` (POST/DELETE); GET `/measured-qualities/{qid}/tools`; GET `/tools/getAll` |
| MQ Types `/measured-quality-types` | `Measured_Quality_Types_APIs.ts` | `/measured-quality-types/{getAll,get/,create,update/{id},delete/,deleted,restore/{id},permanent-delete/{id}}`; PUT `/{tid}/assign-quality/{qid}`, `/{tid}/remove-quality` |
| Career `/career` | `Career_APIs.ts` | `/career/{getAll,get/{id},create,update/{id},delete/{id}}`; `/career/{id}/measured-quality-types`; POST/DELETE `/measured-quality-types/{tid}/careers/{cid}`; GET `/measured-quality-types/getAll` |
| List `/list` | `List_APIs.ts` | `/list/{getAll,get/,create,update/{id},delete/}` |
| DemographicFields `/demographic-fields` | `DemographicField_APIs.ts` | `/demographic-fields/{getAll,getActive,get/{id},create,update/{id},delete/{id}}` |
| Games `/game-list` | `GAME_APIs.ts` | GET `/game-table/getAll`; POST `/game-table/add`,`/update/{id}`; DELETE `/game-table/delete/{id}` |

### 2.3 Academic structure (Institute / Branch / Course / Batch / Session / Section / Board / Contact / College)

All RP `institute.read` (view) / `institute.write` (mutations). Note: Board/Branch/Batch/
Course/Section "update"/"delete" use **POST/GET** (not PUT/DELETE) and wrap body as
`{values}` — a legacy convention.

| Page (route) | API file | Endpoints |
|---|---|---|
| Board `/board` | `Board_APIs.ts` | GET `/board/get`; POST `/board/update`; GET `/board/delete/{id}` |
| Branch `/branch` | `Branch_APIs.ts` | GET `/instituteBranch/get`,`/getbyCourseId/{id}`; POST `/instituteBranch/update`; GET `/instituteBranch/delete/{id}` |
| Batch `/batch` | `Batch_APIs.ts` | GET `/instituteBatch/get`,`/instituteBranch/getbybranchid/{id}`; POST `/instituteBranchBatchMapping/update`; GET `/instituteBatch/delete/{id}` |
| Course `/course` | `Course_APIs.ts` | GET `/instituteCourse/get`,`/getbyCollegeId/{id}`; POST `/instituteCourse/update`; GET `/instituteCourse/delete/{id}` |
| Section `/section` | `Section_APIs.ts` | GET `/section/get`; POST `/section/update`; GET `/section/delete/{id}` |
| Session `/session` | `Session_APIs.ts` | GET `/instituteSession/get`,`/getbyBatchId/{id}`; POST `/instituteSession/update`; GET `/instituteSession/delete/{id}` |
| College `/college` | `College_APIs.ts` | GET `/instituteDetail/{get,get/list,getbyid/{id},deleted,restore/{id},get-mappings/{code}}`; POST `/instituteDetail/{update,map-contacts-boards}`; GET `/instituteDetail/delete/{id}`; schoolSession session/class/section CRUD (`/schoolSession/{create,update/{id},delete/{id},class/*,section/*,getByInstituteCode/{code},resolve-or-create}`) |
| College limits modal `College/components/InstituteLimitsModal.tsx` | inline | PUT `/instituteDetail/{id}/limits` |
| ContactPerson `/contact-person` | `Contact_Person_APIs.ts` | `/contact-person/{getAll,get/{id},create,update/{id},delete/{id}}`; report-status & messaging: GET `/{id}/report-status/{aid}`, `/report-status-by-institute/{code}/{aid}`; POST `/send-reports`, `/send-reports-by-institute`, `/send-report-email`, `/send-whatsapp`, `/send-whatsapp-bulk` |

### 2.4 Students & Groups

| Page (route) | Guard | API file | Endpoints |
|---|---|---|---|
| GroupStudent `/group-student` | RP `student.read` | `StudentInfo_APIs.ts` (+ `useScopedAssessments`) | see below |
| StudentManagement `/student-management` | RP `student_management.read` | `StudentInfo_APIs.ts` | subset (no data-export) |
| StudentList `/student-list` | RP `student.read` | `StudentInfo_APIs.ts` | view-only |
| GroupStudent (school) `/school/group-student` | RP `student.read` | | |
| AssignedStudents `/school/assigned-students` | RP `student.read` | | |
| StudentsList `/studentlist`, `/school/principal/dashboard/studentList` | RP `student.read` | `Student_APIs.tsx` | |
| StudentProfile `/studentprofile` | RP `student.read` | | |
| Create group/student `/school/group/create` (RP `group.write`), `/school/student/create` (RP `student.write`) | | `dashboard/widgets/*` | |
| Upload Excel `/upload-excel` | RP `student.write` | | |

`StudentInfo_APIs.ts` (the workhorse) — base `/student-info` + `/assessments` +
`/student-demographics` + `/assessment-proctoring` + `/contact-person` + report endpoints:

| Method | Endpoint |
|---|---|
| GET | `/student-info/{getAll,getByInstituteId/{id},getStudentsWithMappingByInstituteId/{id},getStudentScores,getStudentAnswersWithDetails,bet-report/{iid}/{aid},exportScoresByInstitute/{id}}` |
| POST | `/student-info/{add,update,delete/{id},updateDemographics,bulkAlotAssessment,bulkRemoveAssessment,getBulkStudentAnswersWithDetails,resetAssessment,send-login-credentials}` |
| GET | `/assessments/{get/list-summary,get/list-ids}` |
| POST | `/student-demographics/bulk-fields`; GET `/student-demographics/fields/{aid}/{uid}` |
| POST | `/assessment-proctoring/getBulkProctoringData`, `/export-excel` (blob) |
| GET | `/game-results/getAll`; POST `/bet-report-data/one-click-report`, `/navigator-report-data/one-click-report`, `/pager-report-data/one-click-report` |
| GET | `/generated-reports/by-student/{uid}`; `/contact-person/by-institute/{code}`; POST `/contact-person/assign-students` |
| Student_APIs.tsx (legacy registrar) | `/student/{get,getbyid/{id},update,emailChecker,get-check}`, `/studnet-confirmation/update`, `/gender/get`, `/category/get`, `/temporary-student/getbyEmail`, `/util/file-upload`, `/util/file-delete/...`, `/generate_pdf?id=`, `/email-validation-official(+confermation)`, `/google-api/{groupemail/get,email/get}`, file-fetch `192.168.146.239:8080/util/file-get/getbyname` |

Inline modals: `StudentInformation/EmailVerification.tsx` POST `/api/verify-email`;
`ResetAssessmentModal.tsx` uses `StudentInfo_APIs.resetAssessment`.

### 2.5 Reports

| Page (route) | Guard | API file | Endpoints (base) |
|---|---|---|---|
| ReportGeneration `/report-generation` | RP `report.read` | `GeneratedReport_APIs.ts`, `ReportTemplate_APIs.ts` | `/generated-reports/*` (CRUD, by-student/-assessment, toggle-visibility, one-click, deletes); `/report-templates/*` (upload multipart, by-assessment, parse-placeholders, preview, generate-pdf(-bulk) blob) |
| BetReportGeneration `/bet-report-generation` | RP `report.read` | `BetReportData_APIs.ts` | `/bet-report-data/{generate-live,by-assessment/{id},by-student/{id},export-excel/{id},generate-reports,export-mqt-scores,download/{u}/{a},download-zip,school-report(+/save,/get)}`; `/general-assessment/export-excel/*`; `/contact-person/{email-recipients/{id},send-report-email}` |
| NavigatorReportGeneration `/navigator-report-generation` | RP `report.read` | `NavigatorReportData_APIs.ts` | `/navigator-report-data/{generate,generate-export,by-assessment/{id},eligible/{id},ineligible/{id},export-excel/{id},generate-reports,reset/*,download/{u}/{a},download-zip}` |
| UnifiedReportManagement `/unified-report-management` | RP `report.read` | `UnifiedReport_APIs.ts` (dispatcher over Bet/Navigator) | (no new endpoints; routes to the two above) |
| SendReports `/send-reports` | RP `report.export` | | |
| Reports `/reports` | RP `report.read` | | |
| ReportsHub `/reports-hub` | RP `report.read` | `ReportZip_APIs.ts`, `navigator360/Navigator360API.ts`, `AdminAssessmentEdit/AdminAssessmentEdit_APIs.ts` | POST `/report-zip/upload` (multipart), DELETE `/report-zip/delete`; GET `/navigator-report-data/navigator-360/scores/{sid}/{aid}` |
| AdminAssessmentEdit `/admin-assessment-edit/:aid/:sid` | RP `assessment.create` | `AdminAssessmentEdit_APIs.ts` | GET `/assessments/getby/{aid}`, `/assessments/getById/{aid}`, `/assessment-answer/getByStudent/{sid}`; POST `/assessment-answer/admin-submit` |

### 2.6 Mapping / Offline / Text / Old data / Score debug

| Page (route) | Guard | Endpoints |
|---|---|---|
| AssessmentMapping `/assessment-mapping` | RP `assessment.create` | POST `/assessment-mapping/create`; GET `/getByInstitute/{code}(+/assessments)`; PUT `/update/{id}`; DELETE `/delete/{id}`; GET `/assessments/get/list-summary`; **Public** `/assessment-mapping/public/info/{token}`, POST `/public/register/{token}` |
| OfflineAssessmentUpload `/offline-assessment-upload`, OMR `/omr-data-upload` | RP `assessment.create` | GET `/assessment-answer/offline-mapping/{aid}`; POST `/assessment-answer/{bulk-submit,bulk-submit-with-students,bulk-submit-by-rollnumber}`; `/omr-column-mapping/{get/{aid}/{iid},save,get-by-questionnaire/{qid},getAll}` |
| TextResponseMapping `/text-response-mapping` | RP `assessment.create` | GET `/assessment-answer/text-responses/{aid}`; PUT `/map-text-response`; POST `/recalculate-scores/{aid}`; GET `/assessments/get/list` |
| OldDataMapping `/old-data-mapping` | RP `assessment.create` | `/firebase-mapping/*` (invalidate-cache, fetch-school-data, save(+batch), getAll, getByType/{t}, check, students-by-institute/{code}, fetch-user-data, fetch-unique-questions, import-students, import-mapped-answers, force-complete-status, question-mappings/*, detect-unmapped/{aid}, delete-firebase-students/{code}); `/instituteDetail/*`, `/schoolSession/*`, `/assessments/*`, `/assessment-questions/getAll` |
| ScoreDebug `/score-debug` | RP `assessment.create` | inline GET `/instituteDetail/get/list`, `/assessments/get/list` |

### 2.7 Users, Roles & Permissions

| Page (route) | Guard | Endpoints |
|---|---|---|
| RolesAndPermissions `/user-management/roles/manage` | RP `role.assign` | inline: GET `/role/get`, `/rolegroup/get`, `/permission/introspect`; POST `/rolegroup/update`; GET `/rolegroup/delete/{id}`; PUT `/role/update`, `/role/{id}/permissions`, `/role/{id}/urls`; DELETE `/role/delete/{id}` |
| UserManagement `/user-management/users/manage` | RP `user.write` | inline: GET `/rolegroup/get`, `/user/registered-users`; POST `/user/toggle-active/{id}`, `/user/toggle-super-admin/{id}`, `/userrolegroupmapping/update`, `/user/update-details/{id}`; GET `/userrolegroupmapping/delete/{id}` |
| (legacy redirects) `/roles/role*`, `/roles/users`, `/user-registrations` | redirect → above | n/a |
| Users module `Users/components/*` | (mounted via mgmt) | `UserMapping_APIs.ts`: POST `/contact-person/{map-to-college,access-level/create,assign-students}`; GET `/contact-person/by-user/{id}`, `/access-level/by-contact/{id}`; DELETE `/contact-person/unmap/{id}`, `/access-level/delete/{id}` |
| role / role_roleGroup / roleUser modules | (legacy) | `Role_APIs.ts` `/role/{get,getbyid/,update,delete/}`; `Role_RoleGroup_APIs.ts` `/rolegroup/{get,update,delete/}`; `roleUser_APIs.ts` `/user/*`, `/userrole/*`, `/userrolegroupmapping/*`, `/roleurl/createRole`, `/google-api/password-reset/update` |
| apps/user-management (Metronic demo) | n/a | `_requests.ts` uses **`REACT_APP_THEME_API_URL`** (`/users/query`, `/user/{id}`) — a separate demo backend, likely unused in prod |

### 2.8 B2C / Payments / Promo

| Page (route) | Guard | Endpoints (base) |
|---|---|---|
| B2C PricingTier `/b2c/pricing-tiers` | RP `campaign.write` | `/pricing-tier/{getAll,getActive,get/{id},create,update/{id},delete/{id}}` |
| B2C Campaign `/b2c/campaigns(+/create,/edit/:id)` | RP `campaign.read`/`campaign.write` | `/campaign/{getAll,get/{id},get/by-slug/{slug},create,update/{id},delete/{id},{id}/resolved/{aid},{id}/assessment,assessment/{mid}(+/tier),assessment/tier/{id}}`; GET `/instituteDetail/get/list` |
| B2C Tracker `/b2c/tracker` | RP `campaign.read` | `/admin/tracker/{payments,allotments,allotments/{id},service-activity,summary,report-errors}`; POST `/admin/tracker/payments/{id}/{resend-link,reset,check-status}`, `/report-errors/{id}/{retry,dismiss}`; `/payment/{id}/send-email`; `/entitlement/{id}/{resend/{svc},extend,revoke}`; GET `/assessment-answer/admin-view/{uid}/{aid}`; `/user-student/{id}/institute/{code}/assign-primary`; (Membership_APIs) `/user-student/{id}/institutes`, `/institute/*`, `/institute-detail/{code}/students` |
| PaymentTracking `/payment-tracking` | RP `payment.refund` | `Payment_APIs.ts`: POST `/payment/generate-link`, `/{id}/{send-nudge,resend-welcome,send-email,send-whatsapp}`; GET `/payment/transactions(+/by-mapping/{id})`, `/payment/{id}/notifications` |
| PaymentRegister `/payment-register/:txnId` | **Public** | GET `/payment/webhook/info/{txnId}`; POST `/payment/webhook/register/{txnId}` |
| PromoCode `/promo-codes` | RP `payment.refund` | `/promo-codes/{create,getAll,update/{id},delete/{id},public/validate,{id}/campaigns}` |

### 2.9 Counselling (admin + counsellor + student) — all `/api/...` base

Admin pages RP `user.write`: CounsellorManagement `/admin/counsellors`, ManageStudents
`/admin/counselling-students`, SlotManagement `/admin/counselling-slots`,
CounsellingNotifications `/admin/counselling-notifications`. Counsellor pages: dashboard
`/counsellor/dashboard` (RP `counselling.read`), availability/session-notes (RP
`user.write`). Student pages `/student/counselling(+/book)` — **LoggedIn / StudentRoutes**.
The `/counsellor/*` **portal** uses `CounsellorRoutes` RoleGuard (role `COUNSELLOR`).

| API file | Base | Key endpoints |
|---|---|---|
| AppointmentAPI | `/api/counselling-appointment` | book, queue, assign/{id}, confirm/{id}, decline/{id}, cancel/{id}, reschedule/{id}, set-meeting-link/{id}, by-student/{id}, by-counsellor/{id}, stats |
| AvailabilityTemplateAPI | `/api/availability-template` | create, get/by-counsellor/{id}, update/{id}, delete/{id}, toggle-active/{id} |
| BlockDateRequestAPI | `/api/block-date-request` | submit, pending, by-counsellor/{id}, approve/{id}, reject/{id} |
| CounsellingActivityAPI | `/api/counselling-activity` | recent, unread-count, mark-all-read |
| CounsellorAPI | `/api/counsellor` | create, getAll, getActive, get/{id}, get/by-user/{id}, update/{id}, toggle-active/{id} |
| CounsellorInstituteAPI | `/api/counsellor-institute` | getAll, by-institute/{code}, by-counsellor/{id}, allocate, deallocate/{id} |
| EligibilityAPI | `/api/counselling/eligibility/{sid}` | GET |
| NotificationAPI | `/api/notifications` | my, unread-count, mark-read/{id}, mark-all-read |
| RatingAPI | `/api/counselling-rating` | create, by-appointment/{id}, pending-for-student/{id}, by-counsellor/{id} |
| SessionNotesAPI | `/api/session-notes` | create, get/{aid}, update/{id} |
| SlotAPI | `/api/counselling-slot` | available, create-manual, block-date, delete/{id}, by-counsellor/{id} |
| SlotConfigurationAPI | `/api/slot-configuration` | create, getAll, delete/{id}, apply, cleanup-legacy |
| StudentCounsellorMappingAPI | `/api/student-counsellor-mapping` | assign, by-counsellor/{id}, by-student/{id}, getAll, deactivate/{id}, bulk-assign |
| StudentManagementAPI | `/api/student-management` | by-institute/{code}, counselling-allowed/{uid}, reports-visible/{uid} |

Inline counsellor-portal calls: `CounsellorProfilePage.tsx` PUT
`/api/counsellor/update/{id}`, POST `/api/counsellor/upload-photo/{id}`;
`CounsellorRegisterPanel.tsx`/`CounsellorRegistrationPage.tsx` POST `/counsellor-media/upload`,
`/api/counsellor/self-register`; `CounsellorLoginPanel.tsx`/`CounsellorDashboardLogin.tsx`
POST `/auth/login` then GET `/auth/me`; `CounsellorAvailabilityPage.tsx` direct
`/api/availability-template/*`; `components/StudentProfileCard.tsx` POST
`/assessment-answer/dashboard`. Admin `CounsellorManagementPage`/`ManageStudentsPage`
inline GET `/instituteDetail/get`.

### 2.10 Student portal

Routes (RoleGuard via `StudentRoutes`, `/student/*`): login, student-info, dashboard,
navigator-360, assessments, reports, counselling. (Duplicated unguarded copies live in
PrivateRoutes per §1.3.)

- `StudentDashboardLogin.tsx` — POST `/user/student-auth` (username+DOB, withCredentials);
  relies on cn_at cookie thereafter; references `/auth/me`.
- `StudentInfoForm.tsx` — PUT `/student-portal/update-info/{userStudentId}`; `/auth/me`.
- `StudentDashboard/API/Dashboard_APIs.ts` — POST `/assessment-answer/dashboard`; GET
  `/game-results/get/{sid}`, `/student-info/getDemographics/{sid}`,
  `/student-demographics/fields/{aid}/{sid}`, `/assessments/student/{sid}`,
  `/dashboard/{game-results,assessment-scores,self-management}/{sid}`,
  `/general-assessment/{dashboard,process,status}/{sid}/{aid}`, `/reports/student/{sid}/pdf`.
- `StudentReports.tsx` uses `GeneratedReport_APIs.getVisibleReportsForStudent` →
  GET `/generated-reports/student/{uid}`.

### 2.11 Other admin pages

| Page (route) | Guard | API | Endpoints |
|---|---|---|---|
| ActivityLog `/activity-log` | RP `permission.grant` | `ActivityLog_APIs.ts` | GET `/activity-log/logins`, `/activity-log/urls/{userId}` |
| CommunicationLogs `/communication-logs` | RP `permission.grant` | `CommunicationLogs_APIs.ts` | GET `/communication-logs` |
| LiveTracking `/live-tracking` | RP `student.read` | `LiveTracking_APIs.ts` | GET `/assessments/{id}/live-tracking(-lite)`, `/assessment-answer/{redis-partials,redis-partial-detail,pending-persistence,submission-failure-detail,submitted-detail}`; POST `/assessment-answer/{flush-partial-to-db,submit-from-redis,reconcile,cleanup-redis,retry-now}`, `/student/resetAssessment` |
| Leads `/leads` | RP `user.read` | `Leads_APIs.ts` | GET `/leads/getAll`; POST `/leads/email-export` (multipart) |
| CareerSuggestion `/career-suggestion` | RP `career.read` (route body commented out) | `CareerSuggestion_APIs.ts` | GET `/career-suggestion/{suggest,compare}/{sid}/{aid}`, `/career-suggestion/assessment/{aid}/students`, `/assessments/getAll` |
| GoogleGroups `/google-groups`,`/groups`,`/group` | RP `group.read` | `GoogleGroup_APIs.ts` | `/google-api/{groupemail/get,group-member/get/,group-member-delete/get/,group-delete/get/,group/add}`; institute lookups; `/{course,batch,session,section,branch}-group/update` |
| BatchGoogle `/batchgoogle` | RP `group.write` | `BatchGoogle_API.ts` | GET `/instituteBranch/get`, `/google-api/group/get/{name}` |
| OldStudentEmail `/old-student-email` | RP `user.read` | `OldStudentEmail_API.tsx` | GET `/google-api/username/get/{id}`; POST `/google-api/password-reset/update` |
| Forgot-Password `/forgotpassword` | LoggedIn | `Forgotpassword_API.tsx` | same `/google-api/*` as above |
| UploadExcelFile `/upload-excel` | RP `student.write` | (uses StudentInfo APIs + useScopedAssessments) | |

### 2.12 Public registration & university result

- **SchoolRegistration** `/school-register/:token` (Public) — `SchoolRegistration_APIs.ts`:
  admin config CRUD `/school-registration/config/*`, link mgmt `/school-registration/link/*`,
  and **public** `/school-registration/public/{info/{token},register/{token},verify-details/{token}}`.
- **StudentRegistration** `/student/registration-form`,`-existing`, `/re-fillForm/*`,
  `/student/uni-roll-no/update` (Public) — `StudentRegistration/Student_APIs.ts` (same legacy
  `/student/*`, `/util/*`, `/generate_pdf`, `/email-validation-official*`,
  `/google-api/*` set as §2.4), plus file-fetch at `192.168.146.239:8080`.
- **FacultyRegistration** `/faculty/registration-form`,`-details`, `/registrar/verification/faculty`
  (Public form / RP `user.*` for details) — `Faculty_APIs.ts`:
  `/faculty/{get,getbyid/{id},update,emailChecker}`, `/gender/get`, `/category/get`,
  `/util/file-upload`, `/util/file-delete/...`, `/generate_pdf_faculty?id=&email=`.
- **UniversityResult** `/student/university/{result-list,result-dashboard,result}` (RP
  `student.read`) — `UniversityResult/*` (lazy).
- **DemographicDetails** `StudentLogin/DemographicDetailsPage.tsx` (reached via
  `/demographics` external redirect / assessment flow) — GET
  `/student-info/getDemographics/{uid}`, POST `/student-info/updateDemographics`;
  `StudentDemographic_APIs.ts`: `/student-demographics/{fields/{aid}/{uid},submit,status/{aid}/{uid}}`.

---

## 3. Master Endpoint Table (frontend → backend)

Grouped by controller/path-prefix. `{x}` = path param. All via global axios (cookie+CSRF)
unless flagged.

### Auth
- POST `/auth/login`, POST `/auth/logout`, GET `/auth/me`, POST `/auth/oauth-exchange`,
  POST `/auth/refresh` (interceptor), POST `/forgot_password`.

### Assessments (`/assessments`)
- GET `/getAll`, `/get/list`, `/get/list-summary`, `/get/list-ids`, `/getById/{id}`,
  `/getby/{id}`, `/get/by-institute/{code}`, `/find-by-same-questionnaire/{id}`, `/deleted`,
  `/student/{sid}`, `/{id}`, `/{id}/live-tracking`, `/{id}/live-tracking-lite`,
  `/is-locked-by-questionnaire/{id}`, `/is-locked-by-question/{id}`.
- POST `/create`, `/startAssessment`. PUT `/update/{id}`, `/{id}/lock`, `/{id}/unlock`,
  `/restore/{id}`, `/{id}/reset-policy`. DELETE `/delete/{id}`, `/{id}`, `/permanent-delete/{id}`.

### Questionnaire (`/api/questionnaire`)
- GET `/get`, `/get/list`, `/getbyid/{id}`, `/deleted`. POST `/create`. PUT `/update/{id}`,
  `/restore/{id}`. DELETE `/delete/{id}`, `/permanent-delete/{id}`.

### Assessment Questions / Options / Sections / Demographics
- `/assessment-questions/{getAll,getAllList,get/{id},mqt-counts,deleted,{id}/measured-quality-types,export-excel,create,update/{id},delete/{id},restore/{id},permanent-delete/{id},import-excel}`
- `/question-sections/{getAll,getAllList,get/{id},deleted,create,update/{id},delete/{id},restore/{id},permanent-delete/{id}}`
- `/option-scores/create`; `/question-media/{upload,delete}`
- `/assessment-demographics/{getByAssessment/{id},save,remove/{aid}/{fid}}`
- `/demographic-fields/{getAll,getActive,get/{id},create,update/{id},delete/{id}}`
- `/language-supported/{getAll,get/{id}}`, `/language-question/create-with-options`

### Assessment Answers (`/assessment-answer`)
- GET `/getByStudent/{sid}`, `/text-responses/{aid}`, `/redis-partials`, `/redis-partial-detail`,
  `/pending-persistence`, `/submission-failure-detail`, `/submitted-detail`, `/offline-mapping/{aid}`,
  `/admin-view/{uid}/{aid}`.
- POST `/admin-submit`, `/dashboard`, `/bulk-submit(+-with-students,-by-rollnumber)`,
  `/flush-partial-to-db`, `/submit-from-redis`, `/reconcile`, `/cleanup-redis`, `/retry-now`.
- PUT `/map-text-response`. POST `/recalculate-scores/{aid}`.

### Scoring metadata
- `/tools/{getAll,get/{id},create,update/{id},delete/{id},{tid}/measured-qualities/{qid}}`
- `/measured-qualities/{getAll,get/{id},create,update/{id},delete/{id},deleted,restore/{id},permanent-delete/{id},{qid}/tools}`
- `/measured-quality-types/{getAll,get/{id},create,update/{id},delete/{id},deleted,restore/{id},permanent-delete/{id},{tid}/assign-quality/{qid},{tid}/remove-quality,{tid}/careers/{cid},{tid}/assessment-questions/{qid}}`
- `/career/{getAll,get/{id},create,update/{id},delete/{id},{id}/measured-quality-types}`
- `/list/{getAll,get/{id},create,update/{id},delete/{id}}`; `/game-table/{getAll,add,update/{id},delete/{id}}`

### Reports
- `/generated-reports/{getAll,get/{id},by-student/{uid}(+/type/{t},/assessment/{aid}/type/{t}),by-assessment/{aid}(+/type/{t}),student/{uid},toggle-visibility,create,update/{id},delete/{id},one-click}`
- `/report-templates/{upload,by-assessment/{aid},get/{id},update/{id},delete/{id},parse-placeholders/{id},available-fields,preview,generate-pdf,generate-pdf-bulk}`
- `/bet-report-data/{generate-live,by-assessment/{aid},by-student/{uid},export-excel/{aid},generate-reports,export-mqt-scores,download/{u}/{a},download-zip,school-report,school-report/save,school-report/get/{code}/{aid},one-click-report}`
- `/navigator-report-data/{generate,generate-export,by-assessment/{aid},eligible/{aid},ineligible/{aid},export-excel/{aid},generate-reports,reset/student/{u}/assessment/{a},reset/assessment/{aid},download/{u}/{a},download-zip,navigator-360/scores/{sid}/{aid},one-click-report}`
- `/pager-report-data/one-click-report`; `/general-assessment/{export-excel/{aid}(+/student/{uid}),dashboard/{sid}/{aid},process/{sid}/{aid},status/{sid}/{aid}}`
- `/report-zip/{upload,delete}`; `/reports/student/{sid}/pdf`

### Academic / Institute
- `/instituteDetail/{get,get/list,getbyid/{id},update,delete/{id},deleted,restore/{id},map-contacts-boards,get-mappings/{code},{id}/limits}`
- `/instituteBranch/{get,getbyCourseId/{id},getbybranchid/{id},update,delete/{id}}`;
  `/instituteCourse/{get,getbyCollegeId/{id},update,delete/{id}}`;
  `/instituteBatch/{get,getbyid/{id},delete/{id}}`; `/instituteBranchBatchMapping/update`;
  `/instituteSession/{get,getbyBatchId/{id},update,delete/{id}}`;
  `/board/{get,update,delete/{id}}`; `/section/{get,update,delete/{id}}`
- `/schoolSession/{create,update/{id},delete/{id},getByInstituteCode/{code},resolve-or-create,class/{create,update/{id},delete/{id}},section/{create,update/{id},delete/{id}}}`
- `/institute-detail/{code}/students`; `/user-student/{id}/{institutes,institute,institute/{code}/{drop,undrop,set-primary,assign-primary}}`

### Contact Person / Messaging
- `/contact-person/{getAll,get/{id},create,update/{id},delete/{id},by-institute/{code},by-user/{uid},map-to-college,unmap/{id},assign-students,access-level/{create,by-contact/{id},delete/{id}},{id}/report-status/{aid},report-status-by-institute/{code}/{aid},send-reports,send-reports-by-institute,send-report-email,send-whatsapp,send-whatsapp-bulk,email-recipients/{uid}}`

### Users / Roles / Permissions
- `/user/{get,getbyid/{id},update,delete/{id},registered-users,toggle-active/{id},toggle-super-admin/{id},update-details/{id},student-auth}`
- `/role/{get,getbyid/{id},update,delete/{id},{id}/permissions,{id}/urls}`;
  `/rolegroup/{get,update,delete/{id}}`; `/permission/introspect`
- `/userrole/{get/{id},update/{email}}`; `/userrolegroupmapping/{get,update,delete/{id}}`;
  `/roleurl/createRole`
- `/google-api/{username/get/{id},password-reset/update,groupemail/get,email/get,group-member/get/,group-member-delete/get/,group-delete/get/,group/add,group/get/{name}}`
- `/{course,batch,session,section,branch}-group/update`

### Student / Faculty (legacy registrar)
- `/student/{get,getbyid/{id},update,emailChecker,get-check,resetAssessment}`; `/studnet-confirmation/update`;
  `/temporary-student/getbyEmail`; `/gender/get`; `/category/get`;
  `/student-info/{getAll,getByInstituteId/{id},getStudentsWithMappingByInstituteId/{id},getAllStudentsWithMapping,add,update,delete/{id},updateDemographics,bulkAlotAssessment,bulkRemoveAssessment,getStudentAnswersWithDetails,getBulkStudentAnswersWithDetails,getStudentScores,exportScoresByInstitute/{id},resetAssessment,send-login-credentials,getDemographics/{sid},bet-report/{iid}/{aid}}`
- `/student-portal/update-info/{uid}`; `/student-demographics/{fields/{aid}/{uid},bulk-fields,submit,status/{aid}/{uid}}`
- `/faculty/{get,getbyid/{id},update,emailChecker}`; `/generate_pdf`, `/generate_pdf_faculty`;
  `/email-validation-official(+-confermation)`; `/util/{file-upload,file-delete/...}`;
  file-fetch `http://192.168.146.239:8080/util/file-get/getbyname` (hardcoded)
- `/assessment-proctoring/{getBulkProctoringData,export-excel}`; `/game-results/{getAll,get/{sid}}`

### B2C / Payments / Promo / Tracker / Entitlement
- `/pricing-tier/{getAll,getActive,get/{id},create,update/{id},delete/{id}}`
- `/campaign/{getAll,get/{id},get/by-slug/{slug},create,update/{id},delete/{id},{id}/resolved/{aid},{id}/assessment,assessment/{mid},assessment/{mid}/tier,assessment/tier/{id}}`
- `/payment/{generate-link,transactions,transactions/by-mapping/{id},{id}/send-nudge,{id}/resend-welcome,{id}/send-email,{id}/send-whatsapp,{id}/notifications,webhook/info/{txn},webhook/register/{txn}}`
- `/promo-codes/{create,getAll,update/{id},delete/{id},public/validate,{id}/campaigns}`
- `/admin/tracker/{payments,allotments,allotments/{id},service-activity,summary,report-errors,payments/{id}/resend-link,payments/{id}/reset,payments/{id}/check-status,report-errors/{id}/retry,report-errors/{id}/dismiss}`
- `/entitlement/{id}/{resend/{svc},extend,revoke}`
- `/assessment-mapping/{create,getByInstitute/{code},getByInstitute/{code}/assessments,update/{id},delete/{id},public/info/{token},public/register/{token}}`

### Counselling (`/api/*`)
- See §2.9 table — `/api/{counselling-appointment,availability-template,block-date-request,counselling-activity,counsellor,counsellor-institute,counselling/eligibility,notifications,counselling-rating,session-notes,counselling-slot,slot-configuration,student-counsellor-mapping,student-management}/*`
- `/api/counsellor/{update/{id},upload-photo/{id},self-register}`; `/counsellor-media/upload`

### Dashboards / Activity / Logs / Leads / Misc
- `/dashboard/{admin/snapshot,admin/snapshot/refresh,game-results/{sid},assessment-scores/{sid},self-management/{sid}}`
- `/api/principal/dashboard/*` (hardcoded localhost:8080)
- `/teacher/dashboard/{complete/{id},class-overview/{id},student-performance/{id},assessment-completion/{id},cognitive-trends/{id},assessments}`
- `/activity-log/{logins,urls/{uid}}`; `/communication-logs`; `/leads/{getAll,email-export}`
- `/career-suggestion/{suggest/{s}/{a},compare/{s}/{a},assessment/{aid}/students}`
- `/school-registration/{config/*,link/*,public/*}`
- `/firebase-mapping/*` (OldDataMapping); `/omr-column-mapping/*`
- `/api/verify-email` (EmailVerification.tsx)

### External / non-Spring
- `localhost:5000/translate/*` & `localhost:5000/match/*` (Node microservice, no auth)
- `REACT_APP_THEME_API_URL/users/query`, `/user/{id}` (Metronic demo backend)
- `REACT_APP_ASSESSMENT_APP_URL` external redirects (no API call)

---

## 4. Auth Observations & Risk Notes

1. **Auth is centralized and cookie-based.** No page reads/writes tokens; the global
   interceptor (`AuthHelpers.ts`) handles cn_at/cn_csrf attachment, 401-refresh-retry, and
   403→permission-denied redirects. This is the strongest part of the design.

2. **Client-side action gating is essentially absent in feature pages.** `<Can>`/`useCan()`
   are wired only into `AsideMenuMain.tsx`. Inside pages, every button (delete role, reset
   payment, toggle super-admin, send reports, generate PDFs, etc.) renders unconditionally
   once the route's `RequirePermission` lets the user in — there is no finer-grained UI gate.
   Security depends entirely on (a) the route-level perm and (b) the backend enforcing the
   same perm. For coarse routes like `/user-management/users/manage` (RP `user.write`) this
   means any `user.write` holder sees the **toggle-super-admin** button; the backend must be
   the real guard for that privileged op.

3. **Routes mounted without `RequirePermission` (any logged-in user):** `/dashboard`,
   `/game-list`, `/forgotpassword`, and the duplicated `/student/*` portal block inside
   `PrivateRoutes.tsx:441-480`. The admin Dashboard fans out to ~10 endpoints with no
   per-route perm — relies on backend scoping.

4. **Public (no-auth) routes that hit the backend:** `/payment-register/:txn`
   (`/payment/webhook/{info,register}`), `/school-register/:token`, the student/faculty
   registration forms, `/principal/dashboard` (and its hardcoded localhost API), and the
   `assessment-mapping public` + `school-registration public` + `promo-codes/public/validate`
   endpoints. These must be intentionally public on the backend.

5. **`/principal/dashboard` is public AND hardcodes `http://localhost:8080`**
   (`PrincipalDashboard_APIs.ts:3`) — broken in any non-local deployment and unauthenticated.

6. **Hardcoded internal IP `192.168.146.239:8080`** for student/faculty file-fetch
   (`Student_APIs.tsx:5`, `StudentInfo_APIs.ts:4`, `StudentRegistration/Student_APIs.ts`,
   `Faculty_APIs.ts`) — environment-specific, will fail off that LAN.

7. **Deprecated `assessmentApi` instance** (`StudentLogin/API/assessmentApi.ts`) still
   injects `X-Assessment-*` headers from `sessionStorage`/`localStorage` and bypasses the
   cookie/CSRF interceptor. Its header comment marks it for removal; any page still importing
   it (legacy assessment flow) does not get the standard 401-refresh/403 handling.

8. **Persona guards are role-string checks, not perm checks.** `StudentAuthGuard` /
   `CounsellorAuthGuard` gate on `currentUser.roles` containing `STUDENT`/`B2C_STUDENT` /
   `COUNSELLOR` (with super-admin bypass). They do not consult `urls[]` or `permissions[]`,
   so the student/counsellor portals are role-gated while the admin app is perm+URL-gated —
   two different models in one app.

9. **Duplicate student-portal mounts.** The same pages exist both unguarded in
   `PrivateRoutes` (`/student/*`) and role-guarded in `StudentRoutes` (`/student/*` via
   AppRoutes' `/counsellor/*`-style standalone tree is counsellor; student tree is reached
   through PrivateRoutes). The unguarded copies in PrivateRoutes weaken the role guard's
   intent for logged-in admin users.

10. **Translation calls go to a separate Node service** (`localhost:5000`) with no auth and
    a hardcoded host — used by the question authoring/translation UI.
