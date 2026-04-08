# Counselling Scheduling System — Design Spec

## Overview

A self-hosted Calendly-like scheduling system for Career-Nine that enables students to book counselling sessions, counsellors to manage availability, and admins to coordinate assignments. The system is robust, customisable, and integrated with the existing platform.

## Requirements Summary

- **Students** see anonymous available slots (no counsellor names), book one, and receive a "request received" email
- **Admin** sees a request queue, assigns a counsellor, counsellor gets email notification
- **Counsellor** confirms or declines; on confirmation, student gets final email with date, time, and meeting link
- **Dashboards** for student and counsellor showing upcoming sessions, meeting links, join time, and past session remarks
- **Availability**: Hybrid model — recurring weekly templates + manual slot overrides
- **Slot duration**: Configurable per slot, buffer time managed by counsellor
- **Meeting links**: Auto-generate Google Meet (existing Google integration), with manual override
- **Session notes**: Structured fields (key points, action items, follow-up) + private counsellor-only notes
- **Cancellation**: 4-hour window enforced for all roles, anyone can cancel notifying others, counsellor can reschedule directly proposing a new slot, full audit log of all changes
- **Notifications**: Email (Mandrill) + in-app notification bell + automated reminders (24h, 1h before session)
- **Counsellors**: Standalone entity — can be internal staff or external professionals requiring onboarding

## Architecture

### Approach: Hybrid — Templates + Materialized Slots

Availability is stored as **templates** (recurring weekly rules) in one table. A **daily scheduled job** materializes them into concrete `CounsellingSlot` rows for a rolling 4-week window. Counsellors can also manually add or remove individual slots. Bookings reference concrete slot rows.

**Why this approach:**
- Fast queries — slots are real rows, just `SELECT WHERE status = 'AVAILABLE'`
- Templates are editable without affecting already-booked slots
- Manual overrides coexist naturally with auto-generated slots
- Directly maps to the hybrid availability requirement

---

## Data Model

### 1. Counsellor

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `user_id` | BIGINT FK → User | Linked platform user (nullable for pre-onboarding) |
| `name` | VARCHAR(255) | Full name |
| `email` | VARCHAR(255) | Contact email |
| `phone` | VARCHAR(20) | Phone number |
| `specializations` | TEXT | Comma-separated or JSON list of specializations |
| `bio` | TEXT | Professional bio |
| `is_external` | BOOLEAN | True if external professional |
| `onboarding_status` | ENUM | `PENDING`, `ACTIVE`, `INACTIVE` |
| `is_active` | BOOLEAN | Can receive assignments |
| `profile_image_url` | VARCHAR(500) | Profile photo URL |
| `created_at` | DATETIME | Record creation |
| `updated_at` | DATETIME | Last update |

### 2. AvailabilityTemplate

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `counsellor_id` | BIGINT FK → Counsellor | Owner |
| `day_of_week` | ENUM | `MONDAY` through `SUNDAY` |
| `start_time` | TIME | Availability window start |
| `end_time` | TIME | Availability window end |
| `default_slot_duration` | INT | Minutes per slot (e.g., 30, 45, 60) |
| `is_active` | BOOLEAN | Template enabled/disabled |
| `created_at` | DATETIME | Record creation |
| `updated_at` | DATETIME | Last update |

### 3. CounsellingSlot

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `counsellor_id` | BIGINT FK → Counsellor | Slot owner |
| `template_id` | BIGINT FK → AvailabilityTemplate | Source template (null if manually created) |
| `date` | DATE | Specific date |
| `start_time` | TIME | Slot start |
| `end_time` | TIME | Slot end |
| `duration_minutes` | INT | Duration in minutes |
| `status` | ENUM | `AVAILABLE`, `REQUESTED`, `ASSIGNED`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| `is_manually_created` | BOOLEAN | True if counsellor created manually |
| `is_blocked` | BOOLEAN | True if this date is blocked (prevents template materialization) |
| `block_reason` | VARCHAR(255) | Reason for blocking (e.g., "Public holiday") |
| `version` | INT | Optimistic locking version for concurrent booking protection |
| `created_at` | DATETIME | Record creation |

### 4. CounsellingAppointment

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `slot_id` | BIGINT FK → CounsellingSlot | Booked slot |
| `student_id` | BIGINT FK → UserStudent | Requesting student |
| `counsellor_id` | BIGINT FK → Counsellor | Assigned counsellor (null until assigned) |
| `assigned_by` | BIGINT FK → User | Admin who assigned |
| `status` | ENUM | `PENDING`, `ASSIGNED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `RESCHEDULED` |
| `student_reason` | TEXT | Reason provided by student |
| `meeting_link` | VARCHAR(500) | Google Meet or custom link |
| `meeting_link_source` | ENUM | `AUTO`, `MANUAL` |
| `reminder_24h_sent` | BOOLEAN | Tracks if 24h reminder sent |
| `reminder_1h_sent` | BOOLEAN | Tracks if 1h reminder sent |
| `created_at` | DATETIME | Booking time |
| `updated_at` | DATETIME | Last update |

### 5. SessionNotes

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `appointment_id` | BIGINT FK → CounsellingAppointment | Associated appointment |
| `key_discussion_points` | TEXT | What was discussed |
| `action_items` | TEXT | Tasks assigned to student |
| `recommended_next_session` | VARCHAR(255) | e.g., "In 2 weeks" |
| `followup_required` | BOOLEAN | Whether follow-up is needed |
| `public_remarks` | TEXT | Visible to student |
| `private_notes` | TEXT | Visible only to counsellor and admin |
| `created_at` | DATETIME | Record creation |
| `updated_at` | DATETIME | Last update |

### 6. AppointmentAuditLog

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `appointment_id` | BIGINT FK → CounsellingAppointment | Associated appointment |
| `action` | ENUM | `CREATED`, `ASSIGNED`, `CONFIRMED`, `CANCELLED`, `RESCHEDULED`, `DECLINED`, `COMPLETED`, `NOTES_ADDED` |
| `performed_by` | BIGINT FK → User | Who performed the action |
| `old_values` | TEXT (JSON) | Previous state snapshot |
| `new_values` | TEXT (JSON) | New state snapshot |
| `reason` | TEXT | Reason for change |
| `timestamp` | DATETIME | When action occurred |

### 7. Notification

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT PK | Auto-generated |
| `user_id` | BIGINT FK → User | Recipient |
| `type` | ENUM | `BOOKING_RECEIVED`, `ASSIGNED`, `CONFIRMED`, `CANCELLED`, `REMINDER_24H`, `REMINDER_1H`, `RESCHEDULED`, `DECLINED`, `SESSION_COMPLETE` |
| `title` | VARCHAR(255) | Short title |
| `message` | TEXT | Notification body |
| `reference_id` | BIGINT | ID of related entity |
| `reference_type` | VARCHAR(50) | Entity type (e.g., `APPOINTMENT`, `SLOT`) |
| `is_read` | BOOLEAN | Read status |
| `created_at` | DATETIME | Creation time |

### Entity Relationships

```
Counsellor (1) ──▶ (N) AvailabilityTemplate
Counsellor (1) ──▶ (N) CounsellingSlot
CounsellingSlot (1) ──▶ (0..1) CounsellingAppointment
CounsellingAppointment (1) ──▶ (0..1) SessionNotes
CounsellingAppointment (1) ──▶ (N) AppointmentAuditLog
User (1) ──▶ (N) Notification
UserStudent (1) ──▶ (N) CounsellingAppointment
```

---

## Booking Flow

### Complete Lifecycle

1. **Counsellor sets availability**
   - Creates recurring weekly templates (e.g., Mon/Wed/Fri 10AM-1PM, 30min slots)
   - Optionally adds manual individual slots or blocks specific dates

2. **System materializes slots**
   - Daily cron job (`SlotMaterializationService`) runs at midnight
   - Generates concrete `CounsellingSlot` rows from active templates for next 4 weeks
   - Skips dates that are blocked or already have slots from this template
   - Manually created slots are unaffected

3. **Student books a slot**
   - Views all `AVAILABLE` slots via week-view calendar (anonymous — no counsellor names shown)
   - Selects a slot, provides reason for counselling
   - Slot status → `REQUESTED`, Appointment created with status `PENDING`
   - Email sent to student: "Request Received"
   - In-app notification created for admin

4. **Admin assigns counsellor**
   - Views pending requests in admin queue
   - Selects a counsellor from dropdown (filtered to active counsellors)
   - Appointment status → `ASSIGNED`, Slot status → `ASSIGNED`
   - `counsellor_id` and `assigned_by` set on appointment
   - Email sent to counsellor: "New Session Assigned"
   - Audit log entry created

5. **Counsellor confirms or declines**
   - **Confirms**: Appointment/Slot → `CONFIRMED`, Google Meet link auto-generated, student gets confirmation email with date/time/link
   - **Declines**: Appointment goes back to admin queue (status reset to `PENDING`, counsellor_id cleared), admin notified

6. **Reminders fire**
   - Hourly cron job checks for confirmed appointments
   - 24 hours before: email + in-app notification to both parties
   - 1 hour before: email + in-app notification to both parties
   - Tracked via `reminder_24h_sent` and `reminder_1h_sent` flags

7. **Session happens**
   - Both parties join via meeting link shown on their dashboards
   - Dashboard shows countdown timer, join button, slot details

8. **Post-session**
   - Counsellor fills in session notes (structured fields + private notes)
   - Appointment/Slot status → `COMPLETED`
   - Student can view public remarks on their dashboard
   - Email sent to student: "Session Complete — View Remarks"

### Status Lifecycles

**Slot Status:**
```
AVAILABLE → REQUESTED → ASSIGNED → CONFIRMED → COMPLETED
    ↓           ↓           ↓           ↓
CANCELLED   CANCELLED   CANCELLED   CANCELLED
```

**Appointment Status:**
```
PENDING → ASSIGNED → CONFIRMED → COMPLETED
   ↓         ↓           ↓
CANCELLED  CANCELLED   CANCELLED
               ↓
          RESCHEDULED
```

### Cancellation Rules

- **4-hour cutoff**: No cancellations allowed when session is within 4 hours. Enforced server-side for all roles.
- **Who can cancel**: Student, Counsellor, or Admin — all other parties receive email + in-app notification.
- **On cancellation**: Slot returns to `CANCELLED` (not reusable). Audit log records who cancelled and why.

### Reschedule Flow

1. Counsellor initiates reschedule, selects a new available slot
2. Old appointment → `RESCHEDULED` status
3. New appointment created linked to new slot, auto-set to `CONFIRMED`
4. New Google Meet link generated
5. Student receives email: "Session Rescheduled" with old and new date/time
6. Audit log captures both old and new appointment references

---

## API Endpoints

### CounsellorController (`/api/counsellor`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/create` | Register new counsellor | Admin |
| GET | `/getAll` | List all active counsellors | Admin |
| GET | `/get/{id}` | Get counsellor profile | Admin, Self |
| PUT | `/update/{id}` | Update counsellor details | Admin, Self |
| PUT | `/toggle-active/{id}` | Activate/deactivate | Admin |
| GET | `/get/by-user/{userId}` | Get counsellor by User ID | Auth |

### AvailabilityTemplateController (`/api/availability-template`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/create` | Create recurring template | Counsellor |
| GET | `/get/by-counsellor/{counsellorId}` | Get templates | Counsellor, Admin |
| PUT | `/update/{id}` | Edit template | Counsellor |
| DELETE | `/delete/{id}` | Remove template | Counsellor |
| PUT | `/toggle-active/{id}` | Enable/disable | Counsellor |

### CounsellingSlotController (`/api/counselling-slot`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/available` | All AVAILABLE slots (anonymous) | Student |
| GET | `/available?week=2026-04-07` | Filter by week | Student |
| POST | `/create-manual` | Create individual slot | Counsellor |
| POST | `/block-date` | Block a date | Counsellor |
| DELETE | `/delete/{id}` | Remove available slot | Counsellor |
| GET | `/by-counsellor/{id}` | Counsellor's slots | Counsellor, Admin |

### CounsellingAppointmentController (`/api/counselling-appointment`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/book` | Student books slot | Student |
| GET | `/queue` | Pending requests | Admin |
| PUT | `/assign/{id}` | Assign counsellor | Admin |
| PUT | `/confirm/{id}` | Confirm appointment | Counsellor |
| PUT | `/decline/{id}` | Decline (back to queue) | Counsellor |
| PUT | `/cancel/{id}` | Cancel (4hr rule) | Student, Counsellor, Admin |
| PUT | `/reschedule/{id}` | Propose new slot | Counsellor |
| GET | `/by-student/{studentId}` | Student's appointments | Student |
| GET | `/by-counsellor/{counsellorId}` | Counsellor's schedule | Counsellor |
| GET | `/stats` | Dashboard stats | Admin |

### SessionNotesController (`/api/session-notes`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/create` | Add notes after session | Counsellor |
| GET | `/get/{appointmentId}` | Get notes (private filtered for students) | Counsellor, Student |
| PUT | `/update/{id}` | Update notes | Counsellor |

### NotificationController (`/api/notifications`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/my` | Current user's notifications | Auth |
| GET | `/unread-count` | Unread count for bell badge | Auth |
| PUT | `/mark-read/{id}` | Mark single as read | Auth |
| PUT | `/mark-all-read` | Mark all as read | Auth |

---

## Backend Services

| Service | Responsibility |
|---------|---------------|
| `CounsellorService` | CRUD operations, onboarding status management |
| `SlotMaterializationService` | `@Scheduled` daily cron — generates slots from active templates for rolling 4-week window. Skips blocked dates and existing slots. |
| `BookingService` | Core booking logic — validates slot availability, creates appointment, transitions slot status, sends "request received" notification |
| `AppointmentService` | Assignment, confirmation, decline, cancellation (with 4hr rule enforcement), reschedule flow |
| `MeetingLinkService` | Google Calendar API integration for auto-generating Meet links. Falls back to manual entry if API fails. |
| `SessionNotesService` | CRUD with access control — filters `private_notes` field when student requests notes |
| `NotificationService` | Creates in-app `Notification` records + triggers Mandrill transactional emails |
| `ReminderSchedulerService` | `@Scheduled` hourly cron — sends 24hr and 1hr reminders via email + in-app notification. Tracks sent status to prevent duplicates. |
| `AuditLogService` | Records every state change on appointments with old/new values, performer, timestamp, and reason |

---

## Notification System

### Email Templates (Mandrill)

| Trigger | Recipient | Subject |
|---------|-----------|---------|
| Student books slot | Student | "Counselling Request Received" |
| Admin assigns counsellor | Counsellor | "New Session Assigned to You" |
| Counsellor confirms | Student | "Counselling Session Confirmed" |
| Counsellor declines | Admin | "Session Declined — Needs Reassignment" |
| Anyone cancels | Other parties | "Counselling Session Cancelled" |
| Counsellor reschedules | Student | "Counselling Session Rescheduled" |
| 24 hours before | Both | "Reminder: Counselling Session Tomorrow" |
| 1 hour before | Both | "Reminder: Counselling Session in 1 Hour" |
| Session completed | Student | "Session Complete — View Counsellor Remarks" |

### In-App Notifications

- Stored in `Notification` table with `user_id`, `type`, `is_read`
- Frontend polls `/api/notifications/unread-count` every 30 seconds
- Bell icon in header shows unread count badge
- Dropdown displays recent notifications with click-to-navigate to relevant page

### Reminder Scheduler

- Runs every hour via `@Scheduled(cron = "0 0 * * * *")`
- Queries confirmed appointments where session time minus current time falls within 24h or 1h window
- Skips if `reminder_24h_sent` or `reminder_1h_sent` is already true
- Sends both email and in-app notification

---

## Frontend Architecture

### New Routes

| Route | Component | Access | Layout |
|-------|-----------|--------|--------|
| `/student/counselling` | StudentCounsellingPage | Student portal | StudentPortal layout |
| `/student/counselling/book` | SlotBookingPage | Student portal | StudentPortal layout |
| `/counsellor/dashboard` | CounsellorDashboardPage | Counsellor role | Metronic MasterLayout |
| `/counsellor/availability` | AvailabilityManagerPage | Counsellor role | Metronic MasterLayout |
| `/counsellor/session-notes/:id` | SessionNotesPage | Counsellor role | Metronic MasterLayout |
| `/admin/counselling-queue` | AdminCounsellingQueuePage | Admin role | Metronic MasterLayout |
| `/admin/counsellors` | CounsellorManagementPage | Admin role | Metronic MasterLayout |

### File Structure

```
react-social/src/app/pages/Counselling/
├── student/
│   ├── StudentCounsellingPage.tsx
│   ├── SlotBookingPage.tsx
│   └── components/
│       ├── UpcomingSessionCard.tsx
│       ├── PastSessionCard.tsx
│       ├── SlotGrid.tsx
│       └── BookingForm.tsx
├── counsellor/
│   ├── CounsellorDashboardPage.tsx
│   ├── AvailabilityManagerPage.tsx
│   ├── SessionNotesPage.tsx
│   └── components/
│       ├── ScheduleCard.tsx
│       ├── RecurringTemplateForm.tsx
│       ├── ManualSlotForm.tsx
│       ├── BlockDateForm.tsx
│       └── SessionNotesForm.tsx
├── admin/
│   ├── AdminCounsellingQueuePage.tsx
│   ├── CounsellorManagementPage.tsx
│   └── components/
│       ├── RequestQueueTable.tsx
│       ├── StatsBar.tsx
│       ├── AssignCounsellorDropdown.tsx
│       └── CounsellorForm.tsx
├── shared/
│   ├── NotificationBell.tsx
│   ├── StatusBadge.tsx
│   └── CountdownTimer.tsx
└── API/
    ├── CounsellorAPI.ts
    ├── SlotAPI.ts
    ├── AppointmentAPI.ts
    ├── SessionNotesAPI.ts
    └── NotificationAPI.ts
```

### UI Theme

Uses existing Career-Nine project theme:
- **Primary**: `#0C6B5A` (green) — confirmed states, primary actions, active tabs
- **Primary Dark**: `#084A3E` — hover states
- **Primary Light**: `#E0F2EE` — available slot backgrounds
- **Blue**: `#3B82F6` — info badges, Meet links, edit actions
- **Blue Light**: `#dbeafe` — assigned status background
- **Success**: `#36B37E` — completed states
- **Accent**: `#F59E0B` — warnings, "needs notes" indicators
- **Danger**: `#EF4444` — cancel actions, pending count
- **Background**: `#F2F7F5` — page backgrounds
- **Card**: `#FFFFFF` — card backgrounds
- **Text**: `#1A2B28` — primary text
- **Muted**: `#5C7A72` — secondary text
- **Border**: `#D1E5DF` — card borders, dividers
- **No purple anywhere**

### Integration Points

- **Student Portal**: Add "Counselling" card/tab to existing `StudentPortalDashboard.tsx` (replaces placeholder `BookCounselling.tsx`)
- **Admin Sidebar**: Add "Counselling Queue" and "Counsellors" menu items to `AsideMenuMain.tsx`
- **Counsellor Routes**: New role-based routes added to `PrivateRoutes.tsx`
- **Notification Bell**: Injected into StudentPortal header and Metronic MasterLayout header

---

## Testing Strategy

### Backend

- **Unit tests** for services: `BookingServiceTest`, `AppointmentServiceTest` (4hr cancellation rule, status transitions, reschedule flow)
- **Integration tests** for controllers: verify endpoint access control, request/response shapes
- **Cron job tests**: `SlotMaterializationServiceTest` (template to slot generation, blocked date handling, duplicate prevention)

### Frontend

- **Component tests**: SlotGrid renders available slots, BookingForm validates required fields
- **Integration tests**: Full booking flow from slot selection to confirmation display

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Student books already-taken slot | Server checks slot status before creating appointment. Returns 409 Conflict. |
| Cancel within 4 hours | Server rejects with 400 Bad Request and message explaining 4hr rule. |
| Google Meet API fails | Meeting link field left empty, counsellor prompted to add manual link. |
| Duplicate slot materialization | Cron job checks for existing slots with same counsellor + date + time before creating. |
| Counsellor declines | Appointment returns to admin queue, admin notified to reassign. |
| Concurrent booking race condition | Slot status check + update wrapped in `@Transactional` with optimistic locking via `@Version` on CounsellingSlot. |
