# Product Design Requirement Document
## Career-Nine — Psychometric Assessment Platform

**Version:** 1.0
**Date:** 2026-03-16
**Status:** Draft

---

## 1. Executive Summary

Career-Nine is a multilingual psychometric assessment platform designed for students across India's schools and colleges. The platform enables institutes to administer standardised psychometric assessments, collect responses in multiple Indian languages, compute scores across measured quality dimensions, and generate actionable career-guidance reports for students and school administrators.

---

## 2. Problem Statement

Indian school students lack accessible, localised psychometric tools for career self-discovery. Existing solutions are predominantly English-only, making them inaccessible to the majority of India's student population. School counsellors and administrators need data-driven dashboards to track cohort progress and generate individual student reports at scale.

**Core problems:**
- No affordable, localised psychometric assessment for Tier 2/3 India
- Manual counselling is unscalable across large schools
- Assessment data sits siloed — not linked to actionable career recommendations
- Language barriers prevent meaningful self-reflection in mother tongue

---

## 3. Product Vision

> *Enable every Indian student to understand their strengths and discover aligned career paths — in their own language.*

---

## 4. Users & Personas

### 4.1 Super Admin (Career-Nine Team)
- Manages assessment content, tools, measured qualities, and scoring schemas
- Creates and assigns assessments to institutes
- Manages supported languages and question translations

### 4.2 Institute Admin / School Counsellor
- Assigns assessments to student cohorts
- Monitors completion status across grades and sections
- Generates batch reports per class or for individual students
- Needs Hindi/regional language UI support

### 4.3 Student
- Takes assessments on a laptop/desktop (mobile access restricted)
- Can choose their preferred language for the assessment interface
- Receives a personalised report on career alignment

---

## 5. Platform Architecture (Current State)

```
Student Browser (React SPA — port 3000)
         │
         ▼ REST API (JWT + OAuth2)
Spring Boot API (port 8091 dev / 8080 prod)
         │
         ▼ JDBC / JPA
MySQL 5.7+ (database: kareer-9)
```

### Key Subsystems
| Subsystem | Purpose |
|---|---|
| Assessment Engine | Question delivery, session management, answer collection |
| Questionnaire Builder | Admin tool to structure assessments (sections, questions) |
| Scoring Engine | Calculates raw scores per measured quality type on submission |
| Multi-Language Support | Stores translated questions/options per language |
| Report Generation | Admin selects cohort → filters → generates reports |
| Career Mapping | Links quality type scores to career recommendations |

---

## 6. Core Features

### 6.1 Assessment Administration

**6.1.1 Assessment Lifecycle**
- **Create**: Link a Questionnaire to an Assessment instance; set active period, timer, lock status
- **Assign**: Map assessments to students via `StudentAssessmentMapping`
- **Monitor**: Track status per student — `notstarted | ongoing | completed`
- **Lock**: Generate immutable JSON snapshot of assessment to preserve historical responses

**6.1.2 Assessment Modes**
- Online (browser-based, proctored by device lock)
- Offline (paper-based, manual score entry — future scope)

**6.1.3 Student Session Security**
- Session token issued on assessment start (`X-Assessment-Session` header)
- Token bound to `userStudentId` + `assessmentId`
- Device restriction: desktop/laptop only; mobile/tablet blocked

**6.1.4 Demographics Collection**
- Optional pre-assessment demographic form per assessment
- Configurable fields per assessment (name, gender, address, etc.)

---

### 6.2 Question & Questionnaire Management

**6.2.1 Question Bank**
- Rich question metadata: `questionType`, `maxOptionsAllowed`, `section`
- Up to 6 options per question (Excel import) or unlimited via UI
- Option-level: text, description, image (Base64), game link, `isCorrect` flag
- Soft delete with recycle bin (recover deleted questions)
- Bulk Excel import/export with MQT score columns

**6.2.2 Questionnaire Structure**
```
Questionnaire
  ├── QuestionnaireSection (1..N)
  │     └── QuestionnaireQuestion (ordered, linked to Question Bank)
  └── QuestionnaireLanguage (language settings)
```

**6.2.3 Scoring Schema per Option**
- Each option can carry scores for multiple `MeasuredQualityTypes`
- Format: `MQT_Name : Score` pairs per option
- Scores aggregated on submission into `AssessmentRawScore` records

---

### 6.3 Multilingual Assessment — India-First

This is a core product differentiator. India has 22 official languages and hundreds of regional dialects. The platform supports a structured multi-language content model.

#### 6.3.1 Language Model
```
LanguagesSupported (e.g., Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Odia, English)
  └── LanguageQuestion (translated question text per original question)
        └── LanguageOption (translated option text per original option)
```

#### 6.3.2 Translation Workflow
1. Admin creates original question (English base)
2. Admin adds translations per language via **Translation Panel**
3. `POST /language-question/create-with-options` — stores translated Q + all options atomically
4. On re-translation: old translations for the same (question, language) pair are deleted and replaced

#### 6.3.3 Student Language Selection
- Student selects preferred language before or at assessment start
- Assessment renders questions and options in selected language
- Falls back to English if translation not yet available
- Language preference persisted in session

#### 6.3.4 Target Languages (Priority Order)
| Priority | Language | Script | States |
|---|---|---|---|
| P0 | Hindi | Devanagari | UP, Bihar, MP, Rajasthan, Delhi, Haryana |
| P0 | English | Latin | Pan-India (CBSE/ICSE medium) |
| P1 | Marathi | Devanagari | Maharashtra |
| P1 | Telugu | Telugu | Andhra Pradesh, Telangana |
| P1 | Tamil | Tamil | Tamil Nadu |
| P2 | Bengali | Bengali | West Bengal |
| P2 | Gujarati | Gujarati | Gujarat |
| P2 | Kannada | Kannada | Karnataka |
| P2 | Malayalam | Malayalam | Kerala |
| P3 | Punjabi | Gurmukhi | Punjab |
| P3 | Odia | Odia | Odisha |

#### 6.3.5 RTL & Font Requirements
- All Indian scripts require font loading (Google Fonts or bundled)
- No RTL languages in current scope (Urdu is future scope)
- Proper Unicode rendering for Devanagari conjuncts

#### 6.3.6 Admin UI Localisation
- Phase 1: Admin UI remains English
- Phase 2: Hindi admin interface (common request from government school partners)

---

### 6.4 Scoring & Quality Dimensions

#### 6.4.1 Hierarchy
```
Tool (Psychometric Test — e.g., "Career Interest Inventory")
  └── MeasuredQuality (e.g., "Leadership", "Analytical Thinking")
        └── MeasuredQualityType (sub-dimension — e.g., "Decision Making", "Risk Appetite")
              ├── OptionScore (per option, per quality type)
              └── Career (career recommendations linked to this quality type)
```

#### 6.4.2 Score Calculation on Submission
1. Student submits assessment
2. For each selected option → fetch all `OptionScoreBasedOnMeasuredQualityTypes`
3. Aggregate scores per `MeasuredQualityType`
4. Delete old `AssessmentRawScore` records for this `StudentAssessmentMapping`
5. Insert new `AssessmentRawScore` rows

#### 6.4.3 Score Output
- Raw score per quality type per student per assessment
- Not normalised at current stage (percentile/standardised scores — future scope)
- Career match derived from quality types with highest raw scores

---

### 6.5 Report Generation

#### 6.5.1 Admin Report Wizard (Current)
3-step workflow:
1. **Select School** — dropdown of all institutes
2. **Select Assessment** — dropdown of all assessments
3. **Filter Students** — multi-filter panel:
   - Name / Username / Roll Number search
   - Grade / Class filter
   - Section filter
   - Status: Completed | In Progress | Not Started

Student table shows: Name, Username, Roll No., Control No., Grade, Section, Status

#### 6.5.2 Report Actions (Planned)
- **Generate Report** button for selected students
- Individual student PDF report (career guidance output)
- Batch Excel export (student scores per quality type)
- Cohort-level aggregate charts

#### 6.5.3 Student-Facing Report
- Personal score breakdown per quality dimension
- Career recommendations with descriptions
- Rendered in student's chosen language
- PDF downloadable and emailable (via Mandrill integration)

#### 6.5.4 Report Content Structure
```
Student Report
├── Header: Student name, roll no., school, assessment name, date
├── Score Summary: Bar chart of raw scores per MeasuredQuality
├── Quality Deep Dive: Per MeasuredQualityType breakdown
├── Career Recommendations: Top 3–5 careers with match rationale
├── Counsellor Note: Space for school counsellor to add personalised comment
└── Footer: School branding + Career-Nine logo
```

---

### 6.6 Student Experience

#### 6.6.1 Assessment List Page
- View all assigned assessments with status badges
- Status: Completed (green) / Ongoing (blue) / Not Started (orange) / Inactive (grey)
- Click to start — blocked if inactive or device is mobile/tablet

#### 6.6.2 Assessment Interface
- Clean, distraction-free question layout
- Language selector (dropdown)
- Timer display (if enabled by admin)
- Option images supported (Base64 encoded)
- Game-linked options for interactive assessments
- Save-later capability (if enabled)
- Auto-resume from last answered question on re-entry

#### 6.6.3 Post-Submission
- Confirmation screen with completion message (in selected language)
- Link to view report (if report is available immediately)

---

## 7. Non-Functional Requirements

### 7.1 Performance
- Student assessment page must load in < 2 seconds on 4G
- Supports 500 concurrent students per assessment session
- API response for assessment data < 500ms
- Pagination on admin tables (25/50/100 rows)

### 7.2 Accessibility
- WCAG 2.1 AA compliance for student-facing pages
- Keyboard-navigable assessment interface
- Font size minimum 16px for all Indian script text (scripts like Devanagari need larger sizes for legibility)

### 7.3 Security
- JWT token expiry: 10 days
- Assessment session token per student per assessment
- No question data cached client-side beyond active session
- SQL injection prevention via JPA parameterised queries
- No mobile/tablet access to assessment (device fingerprint check)

### 7.4 Availability
- 99.5% uptime during school exam periods (Oct–Nov, Feb–Mar)
- MySQL auto-backup daily

### 7.5 Data Integrity
- Assessment answers idempotent — submitting twice returns 409 Conflict
- Locked assessment snapshots preserve historical scoring schemas
- Soft deletes only on question bank (recycle bin recovery)

---

## 8. Integration Points

| Integration | Purpose | Provider |
|---|---|---|
| OAuth2 (Google, GitHub, Facebook) | Student/Admin login | Google, GitHub, Facebook |
| Google Admin Directory API | Student email provisioning | Google Workspace |
| Google Cloud Storage | File/image uploads | Google Cloud |
| Firebase | Real-time features, push | Firebase (project: career-library) |
| Mandrill | Transactional email (reports, OTPs) | Mandrill |
| PDF Generation | Student report PDF | iTextPDF + OpenHTMLtoPDF |
| Excel I/O | Question bulk import/export | Apache POI (backend) |

---

## 9. Admin Tooling Summary

| Feature | Location | Status |
|---|---|---|
| Assessment CRUD | `/assessments` | Live |
| Question Bank CRUD + Excel Bulk Upload | `/assessment-questions` | Live |
| Questionnaire Builder (sections, ordering) | `/api/questionnaire` | Live |
| Measured Quality / Type / Tool Management | `/measured-qualities`, `/tools` | Live |
| Career Management | `/career` | Live |
| Translation Panel (Q + Options) | `/language-question` | Live |
| Language Management | `/language-supported` | Live |
| Report Generation Wizard | `/ReportGeneration` (frontend) | UI done, generate action pending |
| Student Roster Management | `/student/*` | Live |
| Institute / School Management | `/institute-detail` | Live |

---

## 10. Known Gaps & Backlog

| Gap | Priority | Notes |
|---|---|---|
| Report PDF generation from Report Generation page | High | Button exists, backend action not wired |
| Batch Excel score export per cohort | High | Admin high-value use case |
| Percentile/normalised scoring | Medium | Raw scores only at present |
| Student-facing report page | Medium | Backend data ready, no frontend report view |
| Hindi admin UI | Medium | Requested by government school partners |
| Mobile-responsive student assessment | Low | Currently blocked on mobile |
| Offline / paper-based score ingestion | Low | Manual entry flow not built |
| Report localisation (report in student's chosen language) | High | Content model supports it, PDF generation does not |
| Urdu / RTL language support | Low | No current partner demand |
| Assessment analytics dashboard (cohort trends) | Medium | Planned |

---

## 11. Language-Specific UX Considerations for India

### 11.1 Script Rendering
- Ensure web fonts for all supported scripts are loaded (Noto Sans family covers all Indian scripts)
- Test with native speakers — Google Translate output is insufficient for psychometric assessments (context matters)
- Questions must be professionally translated, not machine-translated

### 11.2 Cultural Adaptation
- Career categories must reflect Indian career ecosystem (IAS, Engineering, Medicine, Agriculture, etc.)
- Question phrasing must avoid culturally specific Western idioms
- Example frames should use Indian contexts (village, urban market, school competition — not "school prom" or "baseball")

### 11.3 Assessment Naming
- Assessment names should be available in regional language (e.g., "करियर रुचि परीक्षण" for Hindi)
- Report titles and section headings should render in student's chosen language

### 11.4 Number Formatting
- Use Indian number system where appropriate (lakh, crore) in score/report context
- Dates in DD/MM/YYYY format

---

## 12. Success Metrics

| Metric | Target |
|---|---|
| % Assessments completed (started → submitted) | > 85% |
| Assessment delivery in regional language | > 60% of students choose non-English |
| Time for admin to generate batch report (100 students) | < 2 minutes |
| Student report PDF generation success rate | > 99% |
| Translation coverage (questions with Hindi translation) | 100% by launch |
| Average assessment load time | < 2 seconds |
| Institute admin satisfaction (NPS) | > 50 |

---

## 13. Phased Rollout

### Phase 1 — Foundation (Current)
- English-only assessment delivery
- Admin management tools operational
- Raw scoring and career mapping live
- Report Generation UI (student selection + filter)

### Phase 2 — Multilingual Launch
- Hindi + 4 regional languages (Marathi, Telugu, Tamil, Bengali)
- Translation management panel for admins
- Student language selector in assessment flow
- Report PDF generation from admin report wizard

### Phase 3 — Insights & Scale
- Student-facing report view (web + PDF)
- Batch Excel score export for admin
- Cohort analytics dashboard
- Normalised/percentile scoring
- Hindi admin interface

### Phase 4 — Expansion
- Full 11-language coverage
- Mobile-responsive assessment (tablet support)
- Offline score ingestion
- API for third-party institute integrations

---

## 14. Glossary

| Term | Definition |
|---|---|
| Assessment | A configured instance of a Questionnaire assigned to students |
| Questionnaire | A structured set of sections and questions used in assessments |
| MeasuredQuality | A high-level psychological dimension (e.g., "Leadership") |
| MeasuredQualityType | A sub-dimension within a quality (e.g., "Decision Making") |
| Tool | A psychometric test instrument that measures specific qualities |
| OptionScore | A score value assigned to an answer option for a specific quality type |
| RawScore | Aggregated score per quality type for a student on an assessment |
| Career Mapping | Association between quality types and career recommendations |
| StudentAssessmentMapping | The record linking a student to an assessment with status |
| Institute | A school or college registered on the platform |
| Session Token | A short-lived token that secures an active assessment session |
