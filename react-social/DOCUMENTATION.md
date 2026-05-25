# Career-Nine Admin Dashboard - Complete Documentation

> **Last Updated:** 2026-03-12
> **For:** Both technical (developers) and non-technical (admins, product managers, testers) audiences
> **Tech Stack:** React 18, TypeScript, Material-UI, Bootstrap 5, Metronic Layout System
> **Dev Server:** Port 3000 | **API Base:** Configured via `REACT_APP_API_URL`

---

## How to Read This Document

Each page section is structured with:
- **What It Is** - Plain English explanation of purpose and value
- **How It Works** - Step-by-step user workflow with exact button labels and screen elements
- **Technical Reference** - File paths, API endpoints, data models, state management (for developers)

> Sections marked with **[DEV]** are intended for developers. Non-technical readers can skip these.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Dashboard](#3-dashboard)
4. [Institute Management](#4-institute-management)
   - 4.1 [Institute](#41-institute)
   - 4.2 [Contact Person](#42-contact-person)
   - 4.3 [Data Download](#43-data-download)
   - 4.4 [Group Student Admin](#44-group-student-admin)
   - 4.5 [Group Student School](#45-group-student-school)
   - 4.6 [Assigned Students](#46-assigned-students)
   - 4.7 [Board](#47-board)
   - 4.8 [Add Students in Bulk](#48-add-students-in-bulk)
   - 4.9 [Student's List & Profile](#49-students-list--profile)
5. [Questionnaire Management](#5-questionnaire-management)
   - 5.1 [Create Questionnaire](#51-create-questionnaire)
   - 5.2 [Questionnaire List](#52-questionnaire-list)
   - 5.3 [Tools](#53-tools)
   - 5.4 [Game List](#54-game-list)
6. [Qualities](#6-qualities)
   - 6.1 [Measured Qualities](#61-measured-qualities)
   - 6.2 [Measured Quality Types](#62-measured-quality-types)
7. [User Registration](#7-user-registration)
8. [Assessment Section](#8-assessment-section)
   - 8.1 [Assessments](#81-assessments)
   - 8.2 [Assessment Questions](#82-assessment-questions)
   - 8.3 [Assessment Sections](#83-assessment-sections)
   - 8.4 [Demographic Fields](#84-demographic-fields)
   - 8.5 [Offline Upload](#85-offline-upload)
   - 8.6 [Text Response Mapping](#86-text-response-mapping)
9. [Reports](#9-reports)
   - 9.1 [Reports & Exports](#91-reports--exports)
   - 9.2 [Report Generation](#92-report-generation)
10. [Teacher](#10-teacher)
    - 10.1 [Class Teacher Dashboard](#101-class-teacher-dashboard)
    - 10.2 [Principal Dashboard](#102-principal-dashboard)
    - 10.3 [Faculty Registration Details](#103-faculty-registration-details)
    - 10.4 [Faculty Registration Form](#104-faculty-registration-form)
11. [Roles & Users](#11-roles--users)
    - 11.1 [Role](#111-role)
    - 11.2 [Users (Team Members)](#112-users-team-members)
    - 11.3 [Role - Role Group](#113-role---role-group)
    - 11.4 [Role - User](#114-role---user)
12. [Career](#12-career)
13. [Activity Log](#13-activity-log)
14. [Leads](#14-leads)
15. [Related Pages](#15-related-pages)
    - 15.1 [Student Dashboard](#151-student-dashboard)
    - 15.2 [Institute Dashboard](#152-institute-dashboard)
16. [Appendices](#16-appendices)

---

## 1. Application Overview

### What It Is

The Career-Nine Admin Dashboard is the central control panel for the entire Career-Nine educational assessment platform. Think of it as the "back office" where administrators, school principals, and staff manage everything: schools, students, assessments, questions, reports, and user access.

The platform helps schools conduct psychometric assessments on students to understand their cognitive abilities, personality types, and career aptitude. The admin dashboard is where all this is set up and managed.

### Who Uses It

| User Type | What They Do |
|-----------|-------------|
| **Super Admin** | Full access - manages all schools, assessments, roles, and system settings |
| **School Principal** | Manages their school's students, views dashboards and reports |
| **Class Teacher** | Views class-level performance analytics |
| **Registrar** | Handles student and faculty registrations |
| **Contact Person** | School coordinator assigned to manage student groups |

### How the Sidebar Menu is Organized

When you log in, the left sidebar shows menu sections based on your role. You only see pages you have permission to access. The sections are:

1. **Dashboard** - Overview with charts and KPIs
2. **Institute** - Manage schools, contacts, students, boards
3. **Questionnaire** - Build and manage assessment questionnaires
4. **Qualities** - Define what psychological qualities are measured
5. **Registration** - Manage user accounts
6. **Assessment Section** - Manage assessments, questions, sections
7. **Reports** - Export scores and generate reports
8. **Teacher** - Teacher/Principal dashboards and faculty registration
9. **Roles** - Manage system roles and user permissions
10. **Career** - Define career options linked to assessment results
11. **Admin** - Activity logs
12. **Leads** - Track sales/recruitment leads

### [DEV] Architecture

```
react-social/src/
├── app/
│   ├── modules/           # Feature modules (auth, role, roleUser)
│   ├── pages/             # 40+ feature pages (each with API/, components/)
│   ├── routing/
│   │   ├── AppRoutes.tsx      # Top-level routes (public + private)
│   │   └── PrivateRoutes.tsx  # Authenticated routes with role checks
│   ├── firebase.ts            # Firebase initialization
│   └── model/                 # TypeScript interfaces
├── _metronic/
│   ├── layout/                # Master layout, aside menu, header, footer
│   │   └── components/aside/AsideMenuMain.tsx  # Sidebar menu definition
│   └── partials/              # Reusable UI widgets
└── index.tsx
```

**Key Libraries:**
- `MDBDataTableV5` (mdbreact) - Data tables with sorting, pagination, search
- `Formik` + `Yup` - Form state management and validation
- `React Bootstrap Modal` - All popup dialogs
- `Axios` - HTTP client with Bearer token auth
- `ApexCharts` / `Recharts` - Charts and visualizations
- `XLSX` - Excel file generation and parsing
- `React-Select` - Multi-select dropdowns

**Route Protection:** All private routes are wrapped in `<AuthorizedLayout>` which checks if the current URL path exists in the user's `authorityUrls` array. Menu items in `AsideMenuMain.tsx` use the same `allowed("/path")` check.

---

## 2. Authentication & Authorization

### What It Is

Before using the dashboard, users must log in. The system supports logging in with Google, GitHub, or Facebook accounts (OAuth2). After login, the system checks what pages the user is allowed to access based on their assigned roles.

### How It Works

1. User clicks "Login with Google" (or GitHub/Facebook) on the login page
2. They authenticate with their provider account
3. The backend generates a **JWT token** (valid for 10 days) and sends it back
4. The dashboard stores this token and includes it in every API request
5. The sidebar only shows menu items the user has permission to access
6. If a user tries to access a URL they don't have permission for, they are redirected

### [DEV] Technical Details

- **JWT Token:** Stored in browser, sent as `Authorization: Bearer <token>` header
- **Token Expiry:** 864,000,000ms (10 days)
- **Always-allowed routes (bypass role check):** `/dashboard`, `/auth`, `/login`, `/student-login`, `/studentAssessment`, `/allotted-assessment`, `/general-instructions`, `/demographics`, `/login/reset-password`
- **Permission check:** `isUrlAllowed(path, authorityUrls)` in `AsideMenuMain.tsx` supports wildcard patterns (e.g., `/school/*`)
- **Auth files:** `src/app/modules/auth/`

---

## 3. Dashboard

**Menu Location:** Dashboard (always visible)
**URL:** `/dashboard`

### What It Is

The main landing page after login. It shows a high-level overview of the platform with charts, statistics, and key performance indicators. The dashboard adapts based on the user's role - a principal sees school-wide metrics, a teacher sees class-level data, and a student sees their personal progress.

### What You See on Screen

**Role Switcher** - Three toggle buttons at the top: "Principal", "Teacher", "Student"

**For Principal View:**
- 4 stat cards: "Total students" (642), "Career readiness" (78%), "Exploration complete" (68%), "Need attention" (24)
- Grade Distribution donut chart (Grades 8-12 enrollment)
- Career Aspiration vs Suitability heatmap (7 career categories)
- Personality Profiles radar chart (RIASEC: Social, Enterprising, Investigative, Artistic, Conventional)
- Intelligence Types bar chart (Logical, Intrapersonal, Interpersonal, Visual-Spatial, Naturalistic, Linguistic, Kinesthetic, Musical)
- Values Heatmap across assessment levels

**For Teacher View:** Similar but scoped to teacher's classes

**For Student View:** Personal scorecard with percentiles, action steps, and progress bars

> **Note:** This dashboard currently uses sample/demo data. It is not connected to live backend APIs yet.

### [DEV] Technical Reference

- **File:** `src/app/pages/demo-dashboard-v2/dashboard-admin.tsx`
- **Charts:** ApexCharts (donut, heatmap, radar, bar)
- **State:** `DashboardRole = "principal" | "teacher" | "student"` toggle
- **Data:** Hardcoded sample data in component (no API calls)
- **Color palette:** Primary `#667eea`, Success `#10b981`, Info `#3b82f6`, Warning `#f59e0b`, Danger `#ef4444`

---

## 4. Institute Management

This section covers all pages for managing schools (called "institutes" in the system), their contacts, students, boards, and organizational hierarchy.

### 4.1 Institute

**Menu Location:** Institute > Institute Management > Institute
**URL:** `/college`

#### What It Is

This is the central page for managing all schools/institutes in the system. Each institute has a name, code, address, and can be configured with contact persons, education boards, sessions (academic years), classes, sections, and assessment mappings.

#### What You See on Screen

**Page Header:** "Institutes List" with a blue "Add Institute" button (school icon)

**Data Table** with columns:
| Column | Description |
|--------|-------------|
| Name | School/institute name |
| Code | Unique institute code |
| Address | Physical address |
| Actions | Edit, Delete, Dashboard link, and a dropdown with more actions |

**The "Actions" dropdown for each institute contains:**
1. **Add Course** - Opens the Course management page for this institute
2. **Info** - Opens a popup to link contact persons and education boards to the institute
3. **Add Details** - Opens a popup to manage the Session > Class > Section hierarchy (e.g., "2025-2026" > "Class 10" > "Section A")
4. **Assign Roles** - Opens a popup to assign roles (Principal, Coordinator, Teacher, etc.) to contact persons
5. **Assessment Mapping** - Opens a popup to link assessments to specific classes/sections and generate registration URLs

#### How to Add a New Institute

1. Click the blue **"Add Institute"** button
2. A popup appears titled **"Add College"** with these fields:
   - **College Name** (required) - e.g., "Delhi Public School"
   - **Institute Code** (required) - e.g., "DPS001"
   - **Institute Address** (required) - e.g., "Sector 24, Gurgaon"
   - **Maximum Students** (required) - e.g., "500"
   - **Maximum Contact Persons** (required) - e.g., "10"
3. Click **"Submit"** to create the institute
4. The page refreshes and shows the new institute in the table

#### How to Link Contact Persons and Boards (Info Modal)

1. Click **"Info"** from the Actions dropdown for any institute
2. A popup titled **"Map Board & Contact Person(s)"** appears with 2 steps:

   **Step 1: Select Contact Person(s)**
   - Click the dropdown button "Select contact person(s)"
   - A scrollable list appears with checkboxes for each contact person
   - Each shows: Name, email, phone, gender, designation
   - Check the ones you want to associate with this institute
   - Selected count shows as a green badge

   **Step 2: Select Board(s)**
   - Only enabled after Step 1 (at least one contact selected)
   - Click "Select board(s)" dropdown
   - Check the boards (CBSE, ICSE, State Board, etc.)

3. Click **"Save Selection"** to apply the mappings

#### How to Set Up Session/Class/Section Hierarchy (Add Details Modal)

1. Click **"Add Details"** from the Actions dropdown
2. A large popup titled **"Institute Details"** appears with 3 cascading dropdowns:

   **Adding a New Session:**
   - Click the "Session" dropdown
   - Type a name (e.g., "2025-26") in the input field
   - Click the **"+"** button to add it

   **Adding a Grade/Class:**
   - Select a session first
   - Click the "Grade" dropdown
   - Type a grade name (e.g., "Class 10")
   - Click **"+"** to add

   **Adding a Section:**
   - Select a session and grade first
   - Click the "Section" dropdown
   - Type a section name (e.g., "Section A")
   - Click **"+"** to add

3. The bottom of the popup shows a table of all existing data
4. Each row can be edited (pencil icon) or deleted (trash icon)
5. Deleting shows a confirmation dialog before proceeding

#### How to Map Assessments to Classes (Assessment Mapping Modal)

1. Click **"Assessment Mapping"** from the Actions dropdown
2. A popup titled **"Assessment Mapping - {Institute Name}"** appears

   **Creating a New Mapping:**
   - Select an **Assessment** from the dropdown
   - Choose a **Level**: Session, Class, or Section
   - Select the corresponding Session/Class/Section dropdowns
   - Click **"Create Mapping"**

   **Managing Existing Mappings:**
   - A table shows all existing mappings with columns: Assessment, Level, Details, Status, URL, Actions
   - **Status** can be toggled between "Active" (green) and "Inactive" (gray) by clicking the badge
   - **URL** column has a copy button that copies a student registration URL to clipboard (shows "Copied!" for 2 seconds)
   - **Delete** button removes a mapping (with browser confirmation)

#### [DEV] Technical Reference

**Files:**
```
pages/College/
├── CollegePage.tsx                         # Main page (6 state vars)
├── CollegeTable.tsx                        # Data table (9 state vars, filters display=true only)
├── API/College_APIs.ts                     # All API functions
└── components/
    ├── CollegeCreateModal.tsx              # Formik + Yup, 5 required fields
    ├── CollegeEditModal.tsx                # Same fields, instituteCode disabled
    ├── CollegeInfoModal.tsx                # 2-step contact/board mapping (10 state vars)
    ├── CollegeSectionSessionGradeModal.tsx # Session/Class/Section CRUD (19 state vars)
    ├── CollegeAssignRoleModal.tsx          # Role assignment per contact (10 state vars)
    ├── AssessmentMappingModal.tsx          # Assessment-to-level mapping (7 state vars)
    └── StudentUploadModal.tsx             # Bulk student Excel upload
```

**API Endpoints:**
```
GET    /instituteDetail/get                              # List all institutes
POST   /instituteDetail/update                           # Create/update institute
GET    /instituteDetail/delete/{id}                      # Delete institute
POST   /instituteDetail/map-contacts-boards              # Map contacts & boards
GET    /instituteDetail/get-mappings/{instituteCode}     # Get existing mappings
POST   /schoolSession/create                             # Create session
GET    /schoolSession/getByInstituteCode/{code}          # Get hierarchy
PUT    /schoolSession/update/{id}                        # Update session
DELETE /schoolSession/delete/{id}                        # Delete session
POST   /schoolSession/class/create | /section/create     # Create class/section
PUT    /schoolSession/class/update/{id} | /section/update/{id}
DELETE /schoolSession/class/delete/{id} | /section/delete/{id}
POST   /assessment-mapping/create                        # Create mapping
DELETE /assessment-mapping/delete/{id}                   # Delete mapping
PUT    /assessment-mapping/update/{id}                   # Toggle active status
GET    /assessment-mapping/by-institute/{instituteId}    # Get mappings
```

**Validation (Yup):** All 5 fields required with messages like "College Name is required"
**CSS:** Forms use `form-control-lg form-control-solid`, errors use `is-invalid text-danger`

---

### 4.2 Contact Person

**Menu Location:** Institute > Institute Management > Add Contact Person Information
**URL:** `/contact-person`

#### What It Is

Contact persons are school staff (principals, coordinators, teachers) who serve as points of contact for the institute. They can be assigned to manage student groups and receive notifications.

#### What You See on Screen

**Page Header:** "Contact Person Information" with "Add Contact Person" button

**Data Table** with columns: Contact Person Name | Email | Phone Number | Actions (Edit, Delete)

#### How to Add Contact Person(s)

1. Click **"Add Contact Person"** - navigates to a new page
2. The page titled **"Add Contact Person Information"** shows a card for each contact person
3. You can add **multiple contacts at once** using the **"+"** button or remove with **"-"**
4. For each contact, fill in:
   - **Contact Person Name** (required) - Dropdown of registered users. When you select a user, email/phone/organization auto-fill
   - **Email** (required)
   - **Phone Number** (required)
   - **Organisation** (optional)
   - **Designation** (optional)
   - **Date of Birth** (optional)
5. Click **"Submit"** to create all contacts
6. You are redirected back to the contact person list

#### How to Edit a Contact Person

1. Click the blue **Edit** (pencil icon) button on any row
2. A popup titled **"Edit Contact Person"** appears with:
   - **Contact Person Name** (disabled - cannot change)
   - **Email** (required)
   - **Phone Number** (required)
   - **Gender** (required - Male/Female/Other dropdown)
   - **Designation** (required)
3. Click **"Submit"** to save changes

#### [DEV] Technical Reference

**Files:** `pages/ContactPerson/` with `ContactPersonPage.tsx`, `ContactPersonTable.tsx`, `ContactPersonCreatePage.tsx`, `ContactPersonEditModal.tsx`

**API:**
```
GET    /contact-person/getAll            # List all
POST   /contact-person/create            # Create
PUT    /contact-person/update/{id}       # Update
DELETE /contact-person/delete/{id}       # Delete
GET    /user/registered-users            # For dropdown auto-fill
```

---

### 4.3 Data Download

**Menu Location:** Institute > Institute Management > Data Download
**URL:** `/group-student`

#### What It Is

This page is the primary tool for managing student assessments and downloading student data. You select an institute, see all enrolled students, assign assessments to them, and download their answers, demographics, game results, and proctoring data as Excel files.

#### What You See on Screen

**Top Section:** Institute dropdown ("Select Institute")

**Action Buttons (appear after selecting institute):**
- **"Filters"** - Opens advanced filtering panel
- **"Clear All"** - Removes all active filters (appears only when filters are active)
- **"Download All Answers"** - Downloads all student answers as Excel
- **"Download All Data"** - Downloads proctoring data as Excel

**Students Table** with columns:
| Column | Description |
|--------|-------------|
| User ID | System-generated ID (blue badge) |
| Username | Login username |
| Roll Number | School roll number |
| Control Number | Optional identifier |
| Student Name | Full name |
| Allotted Assessment | Dropdown to assign a new assessment |
| Phone Number | Contact (or "Not Available") |
| DOB | Date of birth (or "Not Available") |
| Assessments | "View (N)" button showing count of assigned assessments |
| Actions | "Dashboard" button linking to student's individual dashboard |

#### How to Assign Assessments to Students

1. Select an institute from the dropdown
2. In the **"Allotted Assessment"** column, choose an assessment from the dropdown for each student
   - Already-assigned assessments show as disabled with "(Assigned)" suffix
3. A green **"Save Changes"** button appears at the bottom when you make changes
4. Click **"Save Changes"** to submit all assignments at once

#### How to Use the Filter Panel

1. Click the **"Filters"** button (it turns from light to dark when active)
2. A panel appears on the left with filter categories:
   - **Assessment** - Filter by specific assessments
   - **Session** - Filter by academic year
   - **Grade** - Filter by class/grade
   - **Section** - Filter by section
   - **Status** - Filter by: "Not Started" (orange), "In Progress" (blue), "Completed" (green)
3. Check/uncheck options in each category
4. Use **"Select All"** / **"Deselect All"** per category
5. Click **"Apply Filters"** to apply, or **"Reset Filters"** to clear
6. Active filters show as colored tags above the table

#### How to View a Student's Assessments

1. Click the **"View (N)"** button for any student
2. A popup titled **"Assigned Assessments"** appears showing each assessment as a card with:
   - Assessment name and status badge (green=Completed, blue=In Progress, orange=Not Started)
   - Three buttons per assessment:
     - **"Demographics"** - View demographic data collected for this student
     - **"Download"** - Preview and download answers as Excel
     - **"Reset"** - Reset the assessment (disabled if already "Not Started")

#### How to Reset an Assessment

1. Click **"Reset"** on any assessment in the student's assessment popup
2. **First confirmation:** "You are about to reset {Assessment Name} for {Student Name}. Do you want to continue?" - Click **"Proceed"**
3. **Second confirmation:** "Are you sure you want to reset {Assessment Name}? This will delete all saved answers and scores." - Click **"Reset Assessment"**
4. The assessment status resets to "Not Started" and all answers/scores are deleted

#### How to Download All Answers (Bulk)

1. Click **"Download All Answers"** button
2. A large popup titled **"All Students Answer Sheet"** appears showing:
   - Summary: Filtered student count, row count, institute name, game data availability
   - Warning if unmapped text responses exist (orange box)
   - Preview table showing first 5 question columns and first 50 rows
3. Click **"Download Excel"** to generate the file
4. Excel includes: S.No, Student Name, User ID, Assessment, all demographic fields, all question answers, game data columns
5. Filename: `{InstituteName}_All_Answers_{timestamp}.xlsx`

#### [DEV] Technical Reference

**File:** `pages/GroupStudent/GroupStudentPage.tsx` (40+ state variables)

**Key State Groups:**
- Institute & Students: `institutes`, `selectedInstitute`, `students`, `loading`, `query`
- Assessment Management: `assessments`, `selectedStudents`, `hasChanges`, `saving`
- Filter Panel: `showFilterPanel`, `pendingAssessmentIds/Sessions/Grades/Sections/Statuses` (Set<>), `appliedAssessmentIds/...`
- Modals: `showAssessmentModal`, `showDownloadModal`, `showBulkDownloadModal`, `showResetModal`, `showDemographicsModal`
- Download: `downloadLoading`, `downloadAnswers`, `bulkDownloadAnswers`, `bulkGameResults`, `bulkDemographicData`

**API Endpoints:**
```
GET  /student-info/getStudentsWithMappingByInstituteId/{id}
POST /student-info/bulkAlotAssessment
GET  /student-info/getStudentAnswersWithDetails
POST /student-info/getBulkStudentAnswersWithDetails
POST /student-demographics/bulk-fields
GET  /assessments/getAll
POST /assessment-proctoring/export-excel
GET  /game-results/getAll
POST /student-info/resetAssessment
```

**Color System:**
- Primary actions: `linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)`
- Download All Data: `linear-gradient(135deg, #e63946 0%, #a4133c 100%)`
- Save Changes: `linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)`
- Status Not Started: `#d97706`, In Progress: `#2563eb`, Completed: `#059669`
- Filter tags: Assessment=blue, Session=green, Grade=orange, Section=purple

---

### 4.4 Group Student Admin

**Menu Location:** Institute > Institute Management > Group Student Information Admin
**URL:** `/admin/group-student`

#### What It Is

Nearly identical to the Data Download page (Section 4.3) with the same features: institute selection, student table, assessment assignment, filtering, downloading answers/demographics/proctoring data, and resetting assessments.

The difference is this page is intended for system administrators who manage all institutes.

#### [DEV] Technical Reference

**File:** `pages/GroupStudent/GroupStudentAdminPage.tsx` - Same structure and state as `GroupStudentPage.tsx`

---

### 4.5 Group Student School

**Menu Location:** Institute > Institute Management > Group Student Information School
**URL:** `/school/group-student?instituteId={id}`

#### What It Is

The school-level version of the Group Student page, used by school principals and coordinators. It has all the same features as the Admin page PLUS two additional capabilities:

1. **Group Together** - Assign selected students to a contact person (e.g., a class teacher)
2. **URL Parameter Support** - Can pre-select the institute from the URL query parameter

#### Additional Feature: Group Together

1. Select students by checking their checkboxes in the table
2. A blue **"Group Together"** button appears showing "{N} student(s) selected"
3. Click it to open the **"Group Together"** popup
4. Select a **Contact Person (Admin)** from the dropdown (shows name, designation, email)
5. Click **"Assign"**
6. On success: "{N} student(s) assigned to {Contact Name}. A notification email has been sent."

#### [DEV] Technical Reference

**File:** `pages/GroupStudent/GroupStudentSchoolPage.tsx`

**Additional State (beyond Admin page):**
```typescript
showGroupModal, contactPersons, contactPersonsLoading,
selectedContactPersonId, groupAssigning, groupSuccessMsg
```

**Additional API Endpoints:**
```
GET  /contact-person/by-institute/{instituteCode}
POST /contact-person/assign-students   # Body: { contactPersonId, userStudentIds[], instituteId }
```

---

### 4.6 Assigned Students

**Menu Location:** Institute > Institute Management > Assigned Students
**URL:** `/school/assigned-students?instituteId={id}`

#### What It Is

A read-only page that shows which students have been assigned to which contact person within an institute. Used by principals to verify student-teacher assignments.

#### How It Works

1. The page reads the `instituteId` from the URL
   - If missing, shows a yellow warning: "No institute selected. Please navigate here from the institute dashboard."
2. A dropdown shows all contact persons for that institute (with name and designation)
3. Select a contact person to see their assigned students
4. A table appears showing: Name, Username, Roll No., Control No., Class, Section, DOB, Phone, Assigned At

#### [DEV] Technical Reference

**File:** `pages/GroupStudent/AssignedStudentsPage.tsx`

**API:**
```
GET /instituteDetail/get-mappings/{instituteCode}           # Get contact persons
GET /contact-person/{contactPersonId}/assigned-students      # Get students
```

Table columns are **dynamically shown** - a column only appears if at least one student has data for that field.

---

### 4.7 Board

**Menu Location:** Institute > Institute Management > Board
**URL:** `/board`

#### What It Is

Manage education boards (CBSE, ICSE, State Board, etc.) that institutes can affiliate with. Boards are linked to institutes through the Institute "Info" modal.

#### How It Works

- **Page shows:** "Board List" header with "Add Board" button
- **Table:** Board Name | Actions (Edit, Delete)
- **Add Board:** Click "Add Board" > Enter board name > Click "Save Changes"
- **Edit Board:** Click pencil icon > Modify name > Save
- **Delete Board:** Click trash icon > Board is deleted
- Only boards with `display=true` are shown in the table

#### [DEV] Technical Reference

**Files:** `pages/Board/BoardPage.tsx`, `BoardTable.tsx`, `BoardCreateModal.tsx`, `BoardEditModal.tsx`

**API:** `GET /board/get` | `POST /board/update` | `GET /board/delete/{id}`

---

### 4.8 Add Students in Bulk

**Menu Location:** Institute > Institute Management > Add Students in Bulk
**URL:** `/upload-excel`

#### What It Is

Upload an Excel file to create many students at once, instead of adding them one by one. The system reads the Excel columns, lets you map them to the right fields, and creates all students automatically.

#### Step-by-Step Workflow

1. **Select Institute** - Choose the school from the dropdown
2. **Select Assessment** - Choose which assessment to assign to these students
3. **(Optional) Pre-select Session/Grade/Section** - If all students belong to the same class
4. **Upload Excel File** - Drag and drop or browse for a `.xlsx`, `.xls`, or `.csv` file
5. **Map Columns** - The system shows your Excel column headers. For each one, select the matching database field:
   - name, schoolRollNumber, controlNumber, phoneNumber, email, address, studentDob, sessionYear, className, sectionName
   - Or choose "Ignore this column" to skip it
   - A badge shows "{mapped} of {total} mapped"
6. **Preview Data** - Click "Preview Data" to see how the data will be imported
7. **Submit** - Click "Submit {N} Students" to create all students
8. **Results** - Shows "Upload Complete! Successful: {N}, Skipped: {N}"

If a session/class/section from the Excel doesn't exist yet, the system creates it automatically via the `resolve-or-create` API.

#### [DEV] Technical Reference

**File:** `pages/UploadExcelFile/UploadExcelFile.tsx`

**API:**
```
GET  /instituteDetail/get                       # List institutes
GET  /assessments/getAll                        # List assessments
GET  /schoolSession/getByInstituteCode/{code}   # Session hierarchy
POST /schoolSession/resolve-or-create           # Auto-create section if needed
POST /student-info/add                          # Create student (called per student)
```

---

### 4.9 Student's List & Profile

**Menu Location:** Institute > Institute Management > Student's List & Profile
**URL:** `/studentlist`

#### What It Is

View all students for the currently selected institute, assign assessments, download answer sheets, reset assessments, and create new students.

#### What You See on Screen

- **Search bar:** "Search by name or roll number"
- **Filter badge:** "Showing {N} students"
- **"Add Student"** button

**Table columns:** Roll Number | Name | Control Number | Assigned Assessments (count) | Actions (Download, Reset)

**Assessment Dropdown:** Each row has a dropdown to assign a new assessment. Already-assigned assessments show "(Assigned)" and are disabled.

#### How to Add a New Student

1. Click **"Add Student"**
2. Fill in: Name, Roll Number, Control Number, Phone, Email, DOB
3. Select Session > Class > Section (cascading dropdowns)
4. Optionally assign an assessment
5. Submit to create the student

#### [DEV] Technical Reference

**File:** `pages/StudentInformation/StudentsList.tsx`

**API:**
```
GET  /student-info/getStudentsWithMappingByInstituteId/{id}
GET  /assessments/getAll
POST /student-info/bulkAlotAssessment
POST /student-info/getBulkStudentAnswersWithDetails
POST /student-info/resetAssessment
POST /student-info/add
GET  /assessments/get/list-ids
GET  /schoolSession/getByInstituteCode/{code}
```

---

## 5. Questionnaire Management

### 5.1 Create Questionnaire

**Menu Location:** Questionnaire > Questionnaire Management > Create Questionnaire
**URL:** `/questionare/create`

#### What It Is

The questionnaire builder page where you create structured assessments. A questionnaire consists of a name, tool, language(s), sections, and questions assigned to each section. This is one of the most complex pages in the system.

#### How to Create a Questionnaire

1. **Basic Information:**
   - Enter **Questionnaire Name** (required)
   - Write **Instructions** (per language)
   - Select **Pricing**: Free or Paid (if paid, enter price)
   - Select **Questionnaire Type**: General or BET Assessment
   - Select a **Tool** (psychometric tool this questionnaire measures)

2. **Language Configuration:**
   - Select one or more languages (English is default)
   - Instructions can be written per language

3. **Section Selection:**
   - Choose sections from the available list (at least one required)
   - Each section can have its own instructions and time limit

4. **Question Assignment:**
   - For each section, select questions from the question bank
   - Set the order of questions within each section
   - Configure game-based sections if applicable

5. Click **Submit** to create the questionnaire

#### Validation Rules

- Questionnaire name is required
- At least one language must be selected
- At least one section must be selected
- Tool is required
- Questionnaire type is required
- If paid, price must be positive

#### [DEV] Technical Reference

**File:** `pages/CreateAssessment/components/questionaire/QuestionareCreateSinglePage.tsx` (~73KB, largest file)

**API:**
```
POST /api/questionnaire/create
GET  /assessment-questions/getAll          # Question bank
GET  /question-sections/getAll            # Available sections
GET  /tools/getAll                        # Available tools
GET  /language-supported/getAll           # Supported languages
GET  /game-table/getAll                   # Available games
```

**Validation Schema (Yup):**
- `name`: required
- `isFree`: required
- `price`: required & positive when `isFree === "false"`
- `languages`: array, min 1
- `questionnaireType`: required
- `toolId`: required
- `sectionIds`: array, min 1

---

### 5.2 Questionnaire List

**Menu Location:** Questionnaire > Questionnaire Management > Questionare List
**URL:** `/questionaire/List`

#### What It Is

A table listing all created questionnaires with their details. From here you can edit or create new questionnaires.

#### What You See on Screen

- **Card title:** "Questionaires" with subtitle "List of all created questionaires"
- **"Create Questionaire"** button
- **Table columns:** ID | Name | Mode (Online/Offline) | Category (General/BET Assessment) | Pricing (Free/Paid) | Actions (Edit)

#### [DEV] Technical Reference

**File:** `pages/CreateAssessment/components/questionaire/QuestionaireListPage.tsx`

**API:** `GET /api/questionnaire/get/list` (projection, lightweight)
**Table:** MDBDataTableV5 with entries [5, 10, 20], default 10

---

### 5.3 Tools

**Menu Location:** Questionnaire > Questionnaire Management > Tools
**URL:** `/tools`

#### What It Is

Psychometric tools are the measurement instruments used in assessments. Each tool has a name, description, and can be linked to measured qualities. For example, "RIASEC Personality Assessment" is a tool that measures qualities like Social, Enterprising, Investigative, etc.

#### How It Works

- **Page shows:** "Tools" header with "Add Tool" button
- **Table columns:** Tool Name (300px) | Tool Price (150px) | Tool Type (150px) | Actions (Edit, Deactivate)
- **Create/Edit fields:** Tool Name, Price Type (Free/Paid dropdown), Price amount (if paid)

#### [DEV] Technical Reference

**Files:** `pages/Tool/CreateTool.tsx`, `ToolTable.tsx`, `ToolCreatePage.tsx`, `ToolEditPage.tsx`

**API:**
```
GET    /tools/getAll
POST   /tools/create
PUT    /tools/update/{id}
DELETE /tools/delete/{id}
POST   /tools/{toolId}/measured-qualities/{qualityId}   # Link quality
DELETE /tools/{toolId}/measured-qualities/{qualityId}    # Unlink
GET    /tools/{toolId}/measured-qualities                # Get linked
```

---

### 5.4 Game List

**Menu Location:** Questionnaire > Questionnaire Management > Game List
**URL:** `/game-list`

#### What It Is

Games are interactive assessment activities (like cognitive tests) that can be embedded within questionnaire sections. Each game has a name and a unique code used to reference it.

#### How It Works

- **Table columns:** Game ID | Game Name | Game Code | Actions (Edit, Delete)
- **Add Game popup:** Fields: "Game Name" (required) and "Game Code" (required, number)
- **Buttons:** "Close" and "Save Changes"

#### [DEV] Technical Reference

**File:** `pages/Games/GamePage.tsx`, `GameTable.tsx`, `GameCreateModal.tsx`

**API:** `GET /game-table/getAll` | `POST /game-table/add` | `DELETE /game-table/delete/{id}` | `POST /game-table/update/{id}`

---

## 6. Qualities

### Understanding the Quality Hierarchy

The scoring system works like this:

```
Tool (e.g., "RIASEC Assessment")
  └── Measured Quality (e.g., "Personality")
        └── Measured Quality Type (e.g., "Social", "Enterprising", "Investigative")
              └── Option Score (e.g., "Option A gives +3 to Social")
                    └── Career Link (e.g., "Social" type links to "Counselor" career)
```

### 6.1 Measured Qualities

**Menu Location:** Qualities > Qualities > Measured Qualities
**URL:** `/measured-qualities`

#### What It Is

Measured Qualities are the top-level psychological attributes being assessed. For example, "Personality", "Intelligence", "Values" are measured qualities. Each quality can contain multiple quality types (subtypes).

#### What You See on Screen

- **Page:** "Measured Qualities" with "Add Measured Qualities" button
- **Table columns:** Quality Name (200px) | Quality Description (150px) | Display Name (150px) | Actions (Edit, Delete) | Tools (multi-select dropdown)
- **Inline Tool Assignment:** Each row has a multi-select dropdown to link/unlink tools in real-time (changes save immediately via API)

#### [DEV] Technical Reference

**Files:** `pages/MeasuredQualities/MeasuredQualities.tsx`, `MeasuredQualitiesTable.tsx`, `MeasuredQualitiesCreatePage.tsx`, `MeasuredQualitiesEditPage.tsx`

**API:**
```
GET    /measured-qualities/getAll
POST   /measured-qualities/create
PUT    /measured-qualities/update/{id}
DELETE /measured-qualities/delete/{id}          # Nullifies dependent types
POST   /measured-qualities/{qId}/tools/{tId}   # Link tool (real-time)
DELETE /measured-qualities/{qId}/tools/{tId}    # Unlink tool (real-time)
```

---

### 6.2 Measured Quality Types

**Menu Location:** Qualities > Qualities > Measured Quality Types
**URL:** `/measured-quality-types`

#### What It Is

Measured Quality Types are the specific dimensions within a quality. For example, under the "Personality" quality, types might be "Social", "Enterprising", "Investigative", "Artistic", "Conventional", "Realistic" (the RIASEC model). These types are what get scored when students answer questions.

#### What You See on Screen

- **Filter Dropdown** above the table: "Filter by Measured Quality" with options: All, Unassigned, or specific quality names
- **Table columns:** Quality Type Name (300px) | Description (150px) | Display Name (150px) | Measured Quality (200px, dropdown) | Actions (Edit, Delete)
- **Inline Quality Assignment:** Each row has a dropdown to assign/unassign the type to a parent quality (options: "Select Quality", "None", or quality names)

#### [DEV] Technical Reference

**Files:** `pages/MeasuredQualityTypes/CreateMeasuredQualityTypes.tsx`, `MeasuredQualityTypesTable.tsx`, `MeasuredQualityTypesCreatePage.tsx`, `MeasuredQualityTypesEditPage.tsx`

**API:**
```
GET    /measured-quality-types/getAll
POST   /measured-quality-types/create
PUT    /measured-quality-types/update/{id}
DELETE /measured-quality-types/delete/{id}
PUT    /measured-quality-types/{typeId}/assign-quality/{qualityId}
PUT    /measured-quality-types/{typeId}/remove-quality
POST   /measured-quality-types/{typeId}/careers/{careerId}    # Link career
DELETE /measured-quality-types/{typeId}/careers/{careerId}    # Unlink career
```

---

## 7. User Registration

**Menu Location:** Registration > User Registration > User Registration
**URL:** `/user-registrations`

### What It Is

View and manage all registered system users (admins, school staff, etc.). Users register via OAuth2 (Google/GitHub/Facebook). This page lets you activate/deactivate users, edit their details, and map them to institutes.

### What You See on Screen

- **Card header:** "Users List" with subtitle "Manage and monitor user registrations" and user count badge
- **Table columns:** S.No | Name | Email | Phone | Organisation | Designation | Status | Actions
- **Status Badges:** "Active" (green) or "Inactive" (yellow)
- **Action Buttons per row:**
  - **Deactivate/Activate** toggle button with loading spinner
  - **Edit** (pencil icon) - opens edit popup
  - **Map to College** (building icon) - opens college mapping popup

### College Mapping Popup

When you click "Map to College" for a user:
1. Popup title: "College Mapping - {user name}"
2. Select an institute from the dropdown
3. Click "Map to Institute"
4. The mapping appears below showing institute name and code
5. Optionally add granular **Access Levels** (Session > Class > Section)
6. Click "Add Access" to set specific access restrictions

### [DEV] Technical Reference

**File:** `pages/Users/components/UserRegistration.tsx`, `UserCollegeMappingModal.tsx`

**API:**
```
GET  /user/registered-users             # All users
POST /user/toggle-active/{userId}       # Toggle active status
```

---

## 8. Assessment Section

### 8.1 Assessments

**Menu Location:** Assessment Section > Assessment Section > Assessments
**URL:** `/assessments`

#### What It Is

Assessments are the actual test instances that students take. An assessment links to a questionnaire and can be configured with start/end dates, mode (online/offline), pricing, timer settings, and demographic fields to collect.

#### What You See on Screen

- **Page:** "Assessments" with "Create Assessment" button
- **Table columns:** Assessment Name (300px) | Start Date (150px) | Actions
- **Actions per row:**
  - **Edit** (pencil) - Navigate to edit page (disabled if locked)
  - **Lock/Unlock** (padlock icon) - Yellow when locked, gray when unlocked
  - **Deactivate** (trash) - Soft-deletes with confirmation
  - **Download OMR Sheet** (file icon) - Generates offline answer sheet

**Locked Assessment Alert:** If you try to edit a locked assessment: "This assessment is locked and cannot be edited as there is an active assessment going on."

#### Creating an Assessment

**Quick Create (Modal):**
1. Click "Create Assessment"
2. Enter: Assessment Name, Mode (Online/Offline radio buttons), Select College
3. Click "Continue" to proceed to multi-step creation

**Full Edit/Create Page** (`/assessments/create` or `/assessments/edit/{id}`):**
- **Assessment Name** (required text field)
- **Settings Card:**
  - Start Date, End Date (date pickers)
  - Is Active (toggle switch)
  - Mode of Assessment Online (toggle switch)
  - Show Timer to Students (toggle switch, default on)
- **Select Questionnaire** - Radio button cards showing all available questionnaires. Selected one shows blue border and "Selected" badge
- **Demographic Fields Configuration** (edit mode only) - Collapsible section to configure which demographic fields students must fill before starting the assessment

#### Demographic Fields Configuration

This expandable section lets you choose which information to collect from students:
- **Left column:** All available fields (SYSTEM fields in blue badge, CUSTOM fields in green badge)
- **Right column:** Selected fields with drag-up/down buttons and configuration:
  - Checkbox: "Mandatory" (required or optional)
  - Text input: "Custom label override"
- Click **"Save Demographic Configuration"** to save

#### [DEV] Technical Reference

**Files:**
```
pages/CreateAssessment/
├── Assessment.tsx                                    # List page
├── components/assessment/
│   ├── AssessmentTable.tsx                          # Table with lock/unlock/OMR
│   ├── AssessmentCreateModal.tsx                    # Quick create (5 fields)
│   ├── AssessmentEditandCreatePage.tsx             # Full edit/create with questionnaire selection
│   └── AssessmentDemographicConfig.tsx             # Two-column field selector
```

**API:**
```
GET    /assessments/getAll | /get/list
GET    /assessments/getById/{id}
POST   /assessments/create
PUT    /assessments/update/{id}
DELETE /assessments/delete/{id}
PUT    /assessments/{id}/lock | /unlock
GET    /assessments/getby/{id}              # Get linked questionnaire
```

---

### 8.2 Assessment Questions

**Menu Location:** Assessment Section > Assessment Section > Assessment Questions
**URL:** `/assessment-questions`

#### What It Is

The question bank - all questions used across assessments are managed here. You can create, edit, delete, translate, bulk import/export, and manage question scoring (linking measured quality types to answer options).

#### What You See on Screen

**Page Header:** "Assessment Questions" with two buttons:
- **"Recycle Bin"** (red outline) - Opens deleted questions
- **"Add Question"** (blue) - Navigate to create page

**Action Bar above table:**
- **"Download Excel"** (green) - Export all questions with MQT scores to Excel
- **"Download Template"** (blue) - Download blank Excel template with sample data and legend
- **"Upload Excel"** (blue) - Bulk import questions from Excel
- **Section Filter Dropdown** - Filter by section (persists to session storage)
- **Search Input** - "Search question text..." (real-time filtering)

**Table columns:** # | Question Text (300px) | Question Type (150px) | Section (150px) | Actions
**Default pagination:** 100 entries per page (options: 100, 150, 200, 500)

**Actions per question:**
- **Edit** (pencil icon) - Navigate to edit page
- **Translate** (lightbulb icon) - Open translation popup
- **Delete** (trash icon) - Soft-delete to recycle bin

#### How to Create a Question

1. Click "Add Question" > Navigate to `/assessment-questions/create`
2. Fill in:
   - **Question Text** (required, textarea)
   - **Question Type** (required, dropdown: Multiple Choice, Single Choice, Ranking)
   - **Section** (required, dropdown of all sections)
   - **Max Options Allowed** (optional, number)
3. Add **Options** (at least 1):
   - Each option has: Text input, optional Description, optional Image
   - **MQT Scoring:** Click the "MQT" dropdown button on each option to assign measured quality type scores
     - Check MQT types to include
     - Enter score value (0-100) for each checked type
4. Click Submit

#### Bulk Upload from Excel

1. Click **"Upload Excel"** to open the popup
2. Select a `.xlsx` or `.xls` file (warning if > 5MB)
3. System parses the file - "Successfully parsed X questions from Excel file"
4. **Preview/Edit Mode:** Navigate through questions with **"Previous"** / **"Next"** buttons
   - Edit question text, type, section, options, MQT scores
   - Question counter shows "Question X of Y"
5. Click **"Submit All (X questions)"** to upload
6. **Results:** Shows "Success: X" and "Failed: Y" with error details

**Excel Column Format:**
| Column | Description |
|--------|-------------|
| Question Text | The question content |
| Question Type | single-choice, multiple-choice, ranking |
| Section ID | Which section this belongs to |
| Max Options Allowed | Maximum selectable answers |
| Option 1-6: Text, Description, Is Correct | Option data |
| Option 1-6: MQTs | Format: "MQTName:Score,MQTName:Score" |

#### Translation

1. Click the lightbulb icon on any question
2. Popup titled **"Translate Question"** opens
3. Select target language from dropdown
4. Options:
   - **"Translate All"** button (green) - AI-translates question + all options at once
   - Translate individually: Click **"Translate"** button next to each field
5. Review translations in the input fields
6. Click **"Submit"** to save

#### Recycle Bin

1. Click **"Recycle Bin"** button
2. Popup shows soft-deleted questions in a table: # | Question Text | Type | Section | Actions
3. Per row: **"Restore"** (green) or **"Permanent Delete"** (red)
4. Permanent delete shows confirmation: "Are you sure? This action cannot be undone."

#### [DEV] Technical Reference

**Files:**
```
pages/AssesmentQuestions/
├── CreateQuestion.tsx                          # Main page
├── API/Question_APIs.ts                       # CRUD APIs
├── API/Translate_APIs.ts                      # Translation APIs
└── components/
    ├── QuestionTable.tsx                      # Table + search + filter + actions
    ├── QuestionCreatePage.tsx                 # Create form with MQT scoring
    ├── QuestionEditPage.tsx                   # Edit form
    ├── QuestionBulkUploadModal.tsx            # Excel upload with preview
    ├── QuestionLanguageModal.tsx              # Translation modal
    └── QuestionRecycleBinModal.tsx            # Deleted questions management
```

**API:**
```
GET    /assessment-questions/getAll | /getAllList
POST   /assessment-questions/create
PUT    /assessment-questions/update/{id}
DELETE /assessment-questions/delete/{id}           # Soft delete
GET    /assessment-questions/deleted                # Get deleted
PUT    /assessment-questions/restore/{id}           # Restore
DELETE /assessment-questions/permanent-delete/{id}  # Hard delete
GET    /assessment-questions/export-excel
POST   /assessment-questions/import-excel
POST   /translate/match-text-to-option              # AI translation
```

---

### 8.3 Assessment Sections

**Menu Location:** Assessment Section > Assessment Section > Assessment Sections
**URL:** `/question-sections`

#### What It Is

Sections organize questions into groups within an assessment (e.g., "Personality", "Cognitive Skills", "Values"). Questions are assigned to sections, and students navigate through sections during the assessment.

#### How It Works

- **Page:** "Assessment Sections" with "Add Section" button
- **Table columns:** Section Name (300px) | Section Description (150px) | Actions (Edit, Delete)
- **Create/Edit:** Simple form with Section Name and Section Description fields

#### [DEV] Technical Reference

**Files:** `pages/QuestionSections/CreateQuestionSection.tsx`, `QuestionSectionTable.tsx`, `QuestionSectionCreatePage.tsx`, `QuestionSectionEditPage.tsx`

**API:** `GET /question-sections/getAll` | `POST /create` | `PUT /update/{id}` | `DELETE /delete/{id}`

---

### 8.4 Demographic Fields

**Menu Location:** Assessment Section > Assessment Section > Demographic Fields
**URL:** `/demographic-fields`

#### What It Is

Demographic fields define what personal information to collect from students before they start an assessment (e.g., gender, family type, number of siblings). Fields can be system-generated (mapped to existing student data) or custom-defined.

#### How to Create a Field

1. Click **"+ Create New Field"**
2. Choose **Field Source:**
   - **CUSTOM** - Define your own field
   - **SYSTEM** - Map to existing student data (name, gender, class, board, etc.)
3. Fill in:
   - **Field Name** (auto-generated slug for system fields)
   - **Display Label** (what students see)
   - **Data Type:** TEXT, SELECT_SINGLE, SELECT_MULTI, NUMBER, or DATE
   - **Placeholder** text
4. For **TEXT** type: Optional regex validation, error message, min/max length
5. For **NUMBER** type: Optional min/max value
6. For **SELECT** types: Add option rows with Value (stored) and Label (displayed)
7. Click **"Create Field"**

#### [DEV] Technical Reference

**Files:** `pages/DemographicFields/DemographicFieldsPage.tsx`, `DemographicFieldTable.tsx`, `DemographicFieldCreatePage.tsx`, `DemographicFieldEditPage.tsx`

**API:** `GET /demographic-fields/getAll` | `/getActive` | `POST /create` | `PUT /update/{id}` | `DELETE /delete/{id}`

---

### 8.5 Offline Upload

**Menu Location:** Assessment Section > Assessment Section > Offline Upload
**URL:** `/offline-assessment-upload`

#### What It Is

For assessments conducted on paper (OMR sheets), this page lets you upload the scanned/digitized results from an Excel file and map them to the correct questions in the system. The system then calculates scores automatically.

#### Step-by-Step Workflow

1. **Select School** from dropdown
2. **Select Assessment** from dropdown (filtered by school)
3. **Upload Excel file** containing student responses
4. **Map columns:** The system shows your Excel headers alongside database questions. Map each Excel column to the corresponding question using dropdown selectors
   - "Roll Number" column auto-detects if named conventionally
   - Duplicate column mapping is prevented
5. Click **"Apply Mapping & Preview"**
6. **Preview:** See parsed data with inline editing capability
   - The system detects answer formats: Numbers (1-6), Letters (A-F), Yes/No
   - Blank cells = skipped
   - Invalid formats show errors per row
7. **Edit** any roll number or answer value directly in the preview table
8. Click **Submit** to upload all responses
9. View results: matched/failed students with error details

#### [DEV] Technical Reference

**File:** `pages/OfflineAssessmentUpload/OfflineAssessmentUploadPage.tsx`

**API:**
```
GET  /assessment-mapping/by-institute/{instituteId}
GET  /assessment-answer/offline-mapping/{assessmentId}
POST /assessment-answer/bulk-submit-by-rollnumber
```

---

### 8.6 Text Response Mapping

**Menu Location:** Assessment Section > Assessment Section > Text Response Mapping
**URL:** `/text-response-mapping`

#### What It Is

When students write free-text answers instead of selecting options (common in offline assessments), this page helps map those text responses to the correct predefined options. It includes an AI-powered suggestion system that can auto-match text to options.

#### How It Works

1. **Select Assessment** from dropdown
2. The page shows all unique text responses grouped by question, with:
   - Question text (truncated with tooltip)
   - The text response (shown as a badge)
   - Count of students who gave this response
   - Status badge: "Mapped" (green), "Unsaved" (yellow), or "Unmapped" (red)
3. **For each response, you can:**
   - Click **"AI Suggest"** - The system uses AI to recommend the best matching option (shows reason)
   - Manually select from the **"Map to Option"** dropdown
   - Click **"Save"** to persist the mapping
4. **Bulk Actions:**
   - **"AI Auto-Map Unmapped ({N})"** - Processes all unmapped responses with AI at once
   - **"Recalculate Scores"** - Updates all student raw scores after mapping changes

#### [DEV] Technical Reference

**File:** `pages/TextResponseMapping/TextResponseMappingPage.tsx`

**API:**
```
GET  /assessment-answer/text-responses/{assessmentId}
PUT  /assessment-answer/map-text-response
POST /assessment-answer/recalculate-scores/{assessmentId}
POST /translate/match-text-to-option           # Single AI suggestion
POST /translate/match-text-to-options-bulk      # Bulk AI suggestion
```

---

## 9. Reports

### 9.1 Reports & Exports

**Menu Location:** Reports > Reports & Exports
**URL:** `/reports`

#### What It Is

Bulk export student assessment scores to Excel. Select a school and assessment, then download a spreadsheet with all students' scores across all measured quality types.

#### How It Works

1. **Select Institute** from dropdown (shows student count with loading indicator)
2. **Select Assessment** from dropdown (shows only active assessments)
3. Click **"Export All Scores to Excel"** (green button)
4. Downloads file: `{InstituteName}_{AssessmentName}_scores.xlsx`

**Excel Contents:** Student Name | Roll Number | Class | DOB | {MQT 1 Score} | {MQT 2 Score} | ... (dynamic columns based on assessment's measured quality types)

#### [DEV] Technical Reference

**File:** `pages/Reports/ReportsPage.tsx`

**API:** `POST /exports/exportScoresByInstitute` returns blob (XLSX file)

---

### 9.2 Report Generation

**Menu Location:** Reports > Report Generation
**URL:** `/report-generation`

#### What It Is

An advanced multi-step wizard for generating detailed reports with comprehensive filtering. Unlike the simple export above, this allows filtering by grade, section, status, and student name before generating.

#### Three-Step Wizard

**Step 1: Select School** - Dropdown to choose institute

**Step 2: Select Assessment** - Dropdown filtered by selected school

**Step 3: Filter Students** - A split-panel interface with:
- **Left sidebar (220px):** Four filter categories with checkboxes:
  - Grade/Class (single select dropdown)
  - Section (single select dropdown)
  - Status (multi-select: Completed=green, Ongoing=blue, Not Started=orange)
  - Name (text search: "Type to search...")
- **Right panel:** Filter controls for the selected category

**Summary Bar:** Shows "{School Name} > {Assessment Name}" with student count badge

**Results Table:** # | Checkbox | Name | Username | Roll No. | Control No. | Grade | Section | Status

**Action:** Select students via checkboxes > Click **"Generate Report ({N})"**

#### [DEV] Technical Reference

**File:** `pages/ReportGeneration/ReportGenerationPage.tsx`

**API:**
```
GET /college/getList
GET /assessments/getAll
GET /student-info/getStudentsWithMappingByInstituteId/{id}
GET /school-session/getBySessions/{instituteId}
```

**UI Details:** Step circles are 28x28px, active color `#4361ee`, inactive `#e0e0e0`. Status badge colors use rgba with 0.15 opacity. Left sidebar has 3px left border on active item.

---

## 10. Teacher

### 10.1 Class Teacher Dashboard

**Menu Location:** Teacher > Dashboards > Class Teacher Dashboard
**URL:** `/teacher/class-dashboard`

#### What It Is

A comprehensive analytics dashboard for class teachers showing student performance, assessment completion rates, and cognitive development trends across four tabbed views.

#### Tab Views

**1. Overview Tab**
- **Class Info Bar (5 cards):** Total Students (blue), Present Today (green), Absent Today (red), Average Attendance (orange), Assessment Filter dropdown (purple)
- **Performance Metrics:** Average Score, Highest Score, Lowest Score, Median Score (color-coded cards)
- **Completion Rate Trend:** Line chart showing completion over time (blue line, stroke width 3px)
- **Additional Metrics:** Assessments This Month, Pending Grading, New Alerts

**2. Student Performance Tab**
- **Performance Distribution:** Bar chart with 5 color-coded bars
- **Top Performers:** List with trophy icons and scores
- **Students Needing Attention:** Highlighted list with alert styling

**3. Assessment Completion Tab**
- Metrics: Overall Completion Rate, Total/Pending Assignments
- **Assessment Table:** Assessment Name | Total Students | Completed | Completion Rate (progress bar) | Due Date
- Color coding: 90%+ = green, 75%+ = orange, <75% = red

**4. Cognitive Trends Tab**
- **Radar Chart:** Attention, Working Memory, Cognitive Flexibility, Problem Solving
- **Bar Chart:** Social-Emotional Skills
- **Line Chart:** Progress over time (3 lines: Cognitive, Social-Emotional, Overall)

#### [DEV] Technical Reference

**File:** `pages/ClassTeacherDashboard/ClassTeacherDashboard.tsx` + `ClassTeacherDashboard.css`

**Charts:** All built with Recharts (LineChart, BarChart, PieChart, RadarChart)

**API:**
```
GET /teacher/dashboard/complete/{teacherId}
GET /teacher/dashboard/class-overview/{teacherId}
GET /teacher/dashboard/student-performance/{teacherId}
GET /teacher/dashboard/assessment-completion/{teacherId}
GET /teacher/dashboard/cognitive-trends/{teacherId}
GET /teacher/dashboard/assessments
```

---

### 10.2 Principal Dashboard

**Menu Location:** Teacher > Dashboards > Principal Dashboard
**URL:** `/principal/dashboard`

#### What It Is

A school-wide analytics dashboard for principals showing participation rates, personality type distributions, intelligence profiles, career trends, and student-level profiles.

#### Navigation Tabs (7 tabs)

1. **Overview** - Key metrics (Total Students, Assessed, Completion Rate, Need High Support, Avg Career Clarity) + Career Clarity pie chart
2. **Participation** - Classroom and student participation rates
3. **Personality** - RIASEC analysis (Doer, Thinker, Creator, Helper, Persuader, Organizer) by grade groups
4. **Intelligence & Abilities** - Intelligence type distributions
5. **Career Trends & Clarity** - Career pathway analysis, top careers per grade group
6. **Student Profiles** - Individual student data with support level badges
7. **Recommendations** - Action items and suggestions

**Grade Groups:** "6th-8th (Insight Navigator)", "9th-10th (Stream Navigator)", "11th-12th (Career Navigator)"

> **Note:** Currently uses sample/dummy data for demonstration.

#### [DEV] Technical Reference

**File:** `pages/PrincipalDashboard/PrincipalDashboard.tsx`

**Charts:** Recharts (Bar, Pie, Radar, Line). Career Clarity Pie: High(25%)=#10b981, Moderate(38%)=#f59e0b, Low(37%)=#ef4444

---

### 10.3 Faculty Registration Details

**Menu Location:** Teacher > Teachers Registration > Registrations List
**URL:** `/faculty/registration-details`

#### What It Is

Lists all registered faculty members with their details, status, and email actions.

#### What You See on Screen

- **MUI DataTable** with columns: Name | College ID | Father/Husband Name | Official Email | Details | Status | Designation | Department
- **Status Badges:**
  - Accepted: green "Accepted"
  - Mail Sent: green "Mail Sent"
  - Faculty Updated: yellow "Faculty Updated" (row highlighted yellow #FFF8DD)
  - Rejected: red "Rejected"
- **Email Action:** "Send Mail" button per row to email faculty their ID card

#### [DEV] Technical Reference

**File:** `pages/FacultyRegistration/FacultyRegistrationDetails.tsx`

**API:** `GET /faculty/getAll` | `POST /faculty/sendIdEmail/{id}`

---

### 10.4 Faculty Registration Form

**Menu Location:** Teacher > Teachers Registration > Registration Form
**URL:** `/faculty/registration-form`

#### What It Is

A comprehensive registration form for new faculty/teachers with webcam photo capture and extensive validation.

#### Form Fields

| Field | Required | Validation |
|-------|----------|------------|
| Webcam Photo | Yes | Must capture from webcam |
| First Name | Yes | Required |
| Middle Name | No | - |
| Last Name | Yes | Required |
| Phone Number | Yes | Exactly 10 digits |
| Date of Birth | Yes | Must be 17+ years old |
| Personal Email | Yes | Checked for uniqueness against database |
| Father/Husband Name | Yes | Required |
| Category | Yes | Dropdown from API |
| Gender | Yes | Dropdown from API |
| Aadhar Card No. | No | Exactly 12 digits |
| Permanent Address | Yes | Required |
| Current Address | Yes | Required |
| Educational Qualifications | Yes | Required |
| Teaching Experience | Yes | Required |
| Pan Card Number | Yes | Required |
| Bank Account Number | Yes | Required |
| IFSC Code | Yes | Required |
| Bank Name | Yes | Required |
| Designation | Yes | Dropdown |
| Department | Yes | Dropdown |

**Email Validation:** When user enters email, it's checked in real-time against the database. If already used, shows: "This Email Id is Already In Use"

#### [DEV] Technical Reference

**File:** `pages/FacultyRegistration/FacultyRegistrationForm.tsx`

**API:**
```
GET  /category/getAll | /gender/getAll    # Dropdown data
POST /emailChecker                         # Email uniqueness
POST /file/upload                          # Photo upload
POST /faculty/upsert                       # Save faculty
```

---

## 11. Roles & Users

### 11.1 Role

**Menu Location:** Roles > Roles and Users > Role
**URL:** `/roles/role`

#### What It Is

Define system roles. Each role has a name and a URL path that it grants access to. For example, a "Manage Institutes" role might have URL "/college".

#### How It Works

- **Header:** "Roles List :"
- **Form Section:** "To Create Role :"
  - "Enter Role Name" (required)
  - "Enter URL" (required, must start with "/")
  - Submit button (checkmark icon)
- Existing roles shown as cards with name and URL

#### [DEV] Technical Reference

**Files:** `modules/role/Role.tsx`, `RoleTable.tsx`

**API:** `GET /role/getAll` | `POST /role/create`

**Validation:** Name required, URL must match `/^[/]/`

---

### 11.2 Users (Team Members)

**Menu Location:** Roles > Roles and Users > Users
**URL:** `/roles/users`

#### What It Is

Manage team members (contact persons) and their role assignments. This page shows all contacts with inline role management.

#### What You See on Screen

- **Title:** "Team Members" with subtitle "Overview of all team members and roles"
- **Search:** "Search users" input
- **Filter:** "Active Users" checkbox
- **Count:** "{N} members"
- **Table:** Member (40%) | Roles (35%) | Status (15%) | Actions (10%)
- **Role Management:** Each row has a multi-select dropdown to add/remove roles with "Done" and "Clear" buttons
- **Status Badges:** Active (green), Pending (yellow), Deleted (red)
- **Actions:** Edit, Remove
- **Footer:** "Cancel" and "Save Selection" buttons

#### [DEV] Technical Reference

**File:** `pages/Users/components/Users.tsx`

**API:** `GET /contact-person/` | `GET /role/get` | `PUT /college/{id}`

---

### 11.3 Role - Role Group

**Menu Location:** Roles > Roles and Users > Role - Role Group
**URL:** `/roles/role_roleGroup`

#### What It Is

Create role groups (bundles of roles). Instead of assigning 10 individual roles to a user, you create a "Principal" role group containing all principal-related roles, then assign the group.

#### How It Works

- **Header:** "Role Group-Role List :"
- **Form:** "To Create Role Group-Role Mapping :"
  - "Enter Role Group Name" (required)
  - Multi-select dropdown: "Assign Roles" (uses React-Select)
  - Submit button (checkmark icon)
- **Existing groups** shown as editable cards with delete option

#### [DEV] Technical Reference

**File:** `modules/role_roleGroup/Role_RoleGroup.tsx`

**API:** `GET /role/get` | `GET /rolegroup/get` | `POST /rolegroup/update` | `GET /rolegroup/delete/{id}`

---

### 11.4 Role - User

**Menu Location:** Roles > Roles and Users > Role - User
**URL:** `/roles/roleUser`

#### What It Is

Search for users by name and assign role groups to them. This is how you grant permissions to specific users.

#### How It Works

1. **Search:** Enter a user name and click Submit
2. **Results:** Shows matched users with their current role groups
3. **Assign:** Use multi-select dropdown to add role groups to each user
4. **Save** the assignments

#### [DEV] Technical Reference

**Files:** `modules/roleUser/RoleUser1.tsx`, `RoleUserTable1.tsx`

**API:** `GET /role-group/getAll` | `GET /user/search/{name}` | `POST /user-role-group-mapping/create`

---

## 12. Career

**Menu Location:** Career (standalone)
**URL:** `/career`

### What It Is

Define career options (e.g., "Software Engineer", "Doctor", "Architect") that are linked to measured quality types. When students complete assessments, their quality type scores are matched against career requirements to generate career recommendations.

### How It Works

- **Page:** "Careers" with "Add Career" button
- **Table columns:** Title (200px) | Description (200px) | Actions (Edit, Delete) | MeasuredQualityTypes (multi-select with checkboxes)
- **Create/Edit fields:** Title (required), Description (required)
- **Quality Type Linking:** In the table, use the multi-select dropdown to link quality types (e.g., linking "Software Engineer" to high scores in "Logical" and "Problem Solving" quality types)

### [DEV] Technical Reference

**Files:** `pages/Career/CareerPage.tsx`, `CareerTable.tsx`, `CareerCreatePage.tsx`, `CareerEditPage.tsx`

**API:**
```
GET    /career/getAll | /get/{id}
POST   /career/create
PUT    /career/update/{id}
DELETE /career/delete/{id}
POST   /measured-quality-types/{typeId}/careers/{careerId}    # Link
DELETE /measured-quality-types/{typeId}/careers/{careerId}    # Unlink
```

---

## 13. Activity Log

**Menu Location:** Admin > Activity Log
**URL:** `/activity-log`

### What It Is

Track all user login activity across the system. See who logged in, when, from which IP address and device. Also view which URLs each user accessed.

### How It Works

1. Set **Start Date** and **End Date**
2. Click **"Fetch Logs"**
3. **Table shows:** # | User Name | Email | Organisation | IP Address (badge) | Device/System | Login Time
4. Click **"View URLs"** on any row to see which pages that user accessed (opens a popup)

**Empty state:** "No login activity found for the selected date range."

### [DEV] Technical Reference

**File:** `pages/ActivityLog/ActivityLogPage.tsx`, `UrlAccessModal.tsx`

**API:**
```
GET /activity-log/logins?startDate={start}&endDate={end}
GET /activity-log/urls/{userId}?startDate={start}&endDate={end}
```

---

## 14. Leads

**Menu Location:** Leads (standalone)
**URL:** `/leads`

### What It Is

Track and manage sales/recruitment leads - schools, parents, and students who have expressed interest. Includes Odoo CRM sync status tracking, advanced filtering, Excel export, and email functionality.

### What You See on Screen

**Filters (6-column layout):**
- Lead Type: All/School/Parent/Student
- Odoo Status: All/Pending/Synced/Failed
- Date From / Date To (date pickers)
- Search: "Name, email, phone..." (multi-field search)
- Clear button (appears when filters active)

**Summary:** Shows filtered count with badge, e.g., "42 (of 156 total)"

**Action Buttons:**
- **"Download Excel"** (green gradient) - Exports filtered leads as `.xlsx`
- **"Email Excel"** (blue gradient) - Opens popup to enter recipient email(s), sends filtered leads

**Table columns:** S.No | Full Name | Email | Phone | Designation | School Name | City | CBSE Aff. No | Total Students | Classes Offered | Type | Source | Odoo Status | Extras | Created At

**Badge Colors:**
- Lead Type: School=blue, Parent=green, Student=orange
- Odoo Status: Synced=green, Pending=orange, Failed=red

**Email Popup:**
- Title: "Email Leads Export"
- Enter recipient email (supports comma-separated multiple)
- Shows "{N} leads will be included" info
- Buttons: "Cancel" and "Send Email"

**Empty State:** Large inbox icon with "No leads captured yet." or "No leads match the current filters."

### [DEV] Technical Reference

**File:** `pages/Leads/LeadsPage.tsx`

**API:** `GET /leads/getAll` | `POST /leads/email-export`

**Excel:** Uses XLSX library, includes all columns + dynamic "extras" JSON fields. Filename: `Leads_Export_{timestamp}.xlsx`

---

## 15. Related Pages

These pages are not directly in the sidebar menu but are navigated to from other pages.

### 15.1 Student Dashboard

**URL:** `/student-dashboard/:studentId`
**Accessed from:** Student's List "Dashboard" button, or Group Student "Dashboard" button

#### What It Is

A comprehensive individual student report showing their assessment results across cognitive, social, and self-management dimensions with rich visualizations.

#### What You See on Screen

**Header:** Career-9 logo, student info bar (name, grade, section, board, family type, siblings), assessment selector dropdown

**Metrics:** Total Assessments | Completed | Pending | Completion Rate (%)

**Four Tab Views:**

1. **Overview** - Summary charts for all domains
2. **Cognitive Development** - Attention (d-prime score), Working Memory, Cognitive Flexibility with score displays and interpretations
3. **Social Development** - Social insights, values ranking, environmental awareness
4. **Self Management** - Self-efficacy, resilience, growth mindset

**Result Cards show:** Score display "{score}/{maxScore}", Level badge (Low/Moderate/High with color coding), Interpretation text

**Buttons:** "Download Report", "View Results" (for BET assessments, exports to Excel), "Go Back"

#### [DEV] Technical Reference

**File:** `pages/StudentDashboard/StudentDashboard.tsx`

**Charts:** Recharts (RadarChart, PieChart, BarChart, RadialBarChart)

**API:**
```
GET  /student/{studentId}
GET  /assessment/student/{studentId}
GET  /assessment/{assessmentId}/results/{studentId}
POST /assessment/export-excel
```

---

### 15.2 Institute Dashboard

**URL:** `/school/principal/dashboard/:id`
**Accessed from:** Institute table "Dashboard" button

A high-level institutional view with student lists, metric cards, and navigation shortcuts. Stores `instituteId` in localStorage for session persistence across pages.

---

## 16. Appendices

### Appendix A: Complete Route Map

| Route | Component | Menu Section |
|-------|-----------|-------------|
| `/dashboard` | DashboardAdminPage | Dashboard |
| `/college` | CollegePage | Institute |
| `/contact-person` | ContactPersonPage | Institute |
| `/group-student` | GroupStudentPage | Institute |
| `/admin/group-student` | GroupStudentAdminPage | Institute |
| `/school/group-student` | GroupStudentSchoolPage | Institute |
| `/school/assigned-students` | AssignedStudentsPage | Institute |
| `/board` | BoardPage | Institute |
| `/upload-excel` | UploadExcelFile | Institute |
| `/studentlist` | StudentsList | Institute |
| `/questionare/create` | QuestionareCreateSinglePage | Questionnaire |
| `/questionaire/List` | QuestionaireListPage | Questionnaire |
| `/tools` | CreateTool | Questionnaire |
| `/game-list` | GamePage | Questionnaire |
| `/measured-qualities` | MeasuredQualities | Qualities |
| `/measured-quality-types` | CreateMeasuredQualityTypes | Qualities |
| `/user-registrations` | UserRegistration | Registration |
| `/assessments` | Assessment | Assessment |
| `/assessment-questions` | CreateQuestion | Assessment |
| `/question-sections` | QuestionSectionPage | Assessment |
| `/demographic-fields` | DemographicFieldsPage | Assessment |
| `/offline-assessment-upload` | OfflineAssessmentUploadPage | Assessment |
| `/text-response-mapping` | TextResponseMappingPage | Assessment |
| `/reports` | ReportsPage | Reports |
| `/report-generation` | ReportGenerationPage | Reports |
| `/teacher/class-dashboard` | ClassTeacherDashboard | Teacher |
| `/principal/dashboard` | PrincipalDashboard | Teacher |
| `/faculty/registration-details` | FacultyRegistrationDetails | Teacher |
| `/faculty/registration-form` | FacultyRegistrationForm | Teacher |
| `/roles/role` | Role | Roles |
| `/roles/users` | Users | Roles |
| `/roles/role_roleGroup` | Role_RoleGroup | Roles |
| `/roles/roleUser` | RoleUser | Roles |
| `/career` | CareerPage | Career |
| `/activity-log` | ActivityLogPage | Admin |
| `/leads` | LeadsPage | Leads |
| `/student-dashboard/:studentId` | StudentDashboard | (Related) |
| `/school/principal/dashboard/:id` | InstituteDashboard | (Related) |

### Appendix B: Assessment Scoring Flow

```
Tool (e.g., "RIASEC Assessment")
  └── Measured Quality (e.g., "Personality")
        └── Measured Quality Type (e.g., "Social")
              └── Option Score (e.g., "Option A = +3 for Social")

Assessment → Questionnaire → Section → Question → Option
                                                      ↓
                                              Student selects Option A
                                                      ↓
                                            Raw Score: Social += 3
                                                      ↓
                                          Career Match: "Social" → "Counselor"
```

### Appendix C: Data Flow

```
Admin Dashboard (react-social, port 3000)
        ↓ HTTP/REST (Bearer token auth)
Spring Boot API (port 8091 dev / 8080 docker)
        ↓
  ┌─────┼──────────────┐
  │     │              │
MySQL  Google       Translator
(3306) Services    Service (Node.js)
       (Auth,      (AI text matching,
       Storage)    translations)
```

### Appendix D: UI Color Reference

| Purpose | Color | Usage |
|---------|-------|-------|
| Primary Blue | `#4361ee` | Buttons, links, active states |
| Dark Blue | `#3a0ca3` | Gradient endpoints |
| Success Green | `#10b981` / `#059669` | Success badges, save buttons |
| Warning Orange | `#f59e0b` / `#d97706` | Warning badges, pending states |
| Danger Red | `#ef4444` / `#e63946` | Error badges, delete buttons |
| Purple | `#7209b7` / `#8b5cf6` | Bulk download, section filter tags |
| Dark Text | `#1a1a2e` | Primary headings |
| Medium Text | `#333` / `#555` | Body text |
| Muted Text | `#999` / `#a0aec0` | Placeholder, secondary info |
| Light Background | `#f8f9fa` | Cards, alternating rows |
| Border | `#e0e0e0` / `#f0f0f0` | Input borders, dividers |

### Appendix E: Technology Stack

| Technology | Purpose |
|------------|---------|
| React 18 | Core SPA framework |
| TypeScript | Type safety |
| Material-UI (MUI) | DataTable, Select, Checkbox |
| Bootstrap 5 | Grid, cards, modals, badges |
| Metronic | Layout system, sidebar, theme |
| Formik + Yup | Form state + validation |
| Axios | HTTP client |
| React Router v6 | Client-side routing |
| MDBReact | `MDBDataTableV5` data tables |
| ApexCharts | Dashboard charts |
| Recharts | Teacher/Student dashboard charts |
| XLSX | Excel generation/parsing |
| Firebase | Analytics, Firestore game data |
| React-Select | Multi-select dropdowns |
| react-webcam | Webcam capture in registration |
