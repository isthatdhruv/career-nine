# Counselling Flow & Functionality — Change Log

This document describes everything changed across this work cycle for the **counselling** feature set in Career‑9, grouped by feature with the exact files, behaviour, and operational notes.

> **Status:** Backend compiles cleanly (`mvnw compile`, exit 0). Assessment app (`career-nine-assessment`) typechecks cleanly. `react-social` could not be standalone type‑checked due to a **pre‑existing** `tsconfig` issue (`ignoreDeprecations` requires TS 5.x but the repo pins 4.6.3); its build runs through react‑scripts. Nothing has been runtime‑tested yet — see [Verification checklist](#verification-checklist).

---

## Table of contents
1. [Round 1 — Online/Offline counselling + booking details](#round-1)
2. [Round 2 — Reminders, OTP check‑in, calendar, dashboard](#round-2)
3. [Round 3 — B2C "best flow" refinements](#round-3)
4. [Database migrations](#database-migrations)
5. [New backend endpoints](#new-backend-endpoints)
6. [Scheduled jobs (cron)](#scheduled-jobs)
7. [Environment variables](#environment-variables)
8. [Notification channel policy](#notification-channel-policy)
9. [Full file inventory](#full-file-inventory)
10. [Verification checklist](#verification-checklist)
11. [Known limitations / risks](#known-limitations--risks)
12. [Offline records](#offline-records)

---

<a name="round-1"></a>
## 1. Round 1 — Online/Offline counselling + booking details

### Intent
- A slot can be **Online** or **Offline (in‑person)**.
- On booking: **Online → an auto‑generated meeting link**; **Offline → the counsellor's office address** — delivered in the confirmation email.
- The student fills **basic contact details** when choosing a session.
- Counselling stays gated by payment (the existing entitlement already enforces pay‑before‑book).

### What changed

**Data model**
- `counselling_slot.mode` (`ONLINE` | `OFFLINE`).
- `availability_template.mode` — recurring templates carry a mode; materialized slots inherit it.
- `counsellors.office_address` — shared with the student for offline sessions.
- `counselling_appointment`: `mode`, `location` (office address snapshot), `student_contact_name`, `student_contact_email`, `student_contact_phone`, `preferred_contact_method`.

**Backend behaviour**
- `BookingService.bookSlot(...)` now:
  - accepts a `BookingContact` (name/email/phone/preferred method),
  - snapshots `mode` from the slot,
  - **Online** → generates a meeting link via the existing `MeetingLinkService`,
  - **Offline** → copies the counsellor's `officeAddress` into the appointment's `location`,
  - sends a **mode‑aware confirmation** (link vs venue).
- `SlotMaterializationService` propagates `template.mode → slot.mode`.
- `CounsellorService`/`CounsellorController` accept and persist `officeAddress` (self‑register + profile update).
- `CampaignPublicController` returns `mode` in the public slot list and accepts the contact fields on `/counselling/book`.

**Frontend**
- Assessment app `CounsellingSlotPicker.tsx`: online/in‑person **badge** per slot, a **basic‑contact form** (name + phone required), and sends the contact payload on booking.
- Counsellor portal: **mode selector** on the recurring‑template and manual‑slot forms; **office‑address field** on the counsellor profile.

---

<a name="round-2"></a>
## 2. Round 2 — Reminders, OTP check‑in, calendar, dashboard

### Intent
- Multi‑offset reminders to students and counsellors.
- 8pm day‑before digest to counsellors.
- WhatsApp + in‑app + email (WhatsApp primary, email fallback).
- OTP check‑in at the start of a session (counsellor enters the student's code).
- Calendar invite (`.ics`) on the confirmation.
- Counsellor dashboard summary (today / booked / free / upcoming / completed).
- (Admin counsellor assignment kept at **institute level** — already supported; no new model.)

### What changed

**Reminders (reworked `ReminderSchedulerService`)**
- **Student:** 12h / 4h / 2h / 15min before the session.
- **Counsellor:** 2h / 15min before.
- Runs **every 5 minutes**; each `(appointment, audience, offset)` is recorded in `counselling_reminder_sent`, so re‑runs never double‑send.
- A "window" rule means a **late booking** (e.g. 30 min out) only receives the offsets it can still satisfy — it is not spammed with all four.

**8pm day‑before digest**
- Daily `20:00` cron emails each counsellor the next day's session list, plus a short WhatsApp summary.

**OTP check‑in**
- New `CheckinOtpService` + endpoints. Counsellor clicks **Start session** → a random 6‑digit code (BCrypt‑hashed, 15‑min expiry, 5‑attempt cap) is sent to the student → counsellor enters it → appointment becomes `IN_PROGRESS` with `attended` / `session_started_at` / `checkin_verified_at` recorded.

**Calendar**
- New `IcsService` builds an `.ics` invite (IST→UTC, with a 2h alarm) attached to the confirmation email.

**WhatsApp**
- New reusable `WhatsAppService` (AiSensy, the provider already used elsewhere). Channel‑agnostic dispatch added to `CounsellingNotificationService`.

**Counsellor dashboard summary**
- New endpoint feeds today's sessions + booked/free slots this week + upcoming/completed/pending counts.
- Dashboard page shows the stat cards and a **Start session → enter code → Verify** check‑in flow on today's confirmed sessions.

**Slot concurrency** — verified the existing protection is sufficient: `BookingService.bookSlot` runs in a transaction, checks `status == AVAILABLE`, flips to `REQUESTED`, and `CounsellingSlot` has `@Version` optimistic locking. A slot booked by one student becomes unbookable for everyone else; a simultaneous second booker gets a clean conflict error. **No change required.**

---

<a name="round-3"></a>
## 3. Round 3 — B2C "best flow" refinements

### Intent
Make the counselling step **unmissable** within the two B2C journeys:
- **Path A (pay first):** select a counselling tier → pay → take assessment → on completion, choose a session.
- **Path B (assess first):** take assessment → choose a counselling tier → pay → choose a session.

Both already converged on the thank‑you page's `counsellingActive` gate; the refinements make the session step active and guided.

### What changed

1. **Auto‑open the session picker** — on the thank‑you page, when the student has active counselling with unused sessions and no booking yet, the slot picker opens automatically (once per page load; **skippable** — closing it lets them book later).
2. **Prominent CTA** — the counselling tile shows a **"NEXT STEP"** badge and reads **"Choose your counselling time."**
3. **Deep‑link after payment** — the existing post‑payment redirect returns to the completed page, where the auto‑open fires (no extra redirect code).
4. **Unbooked‑counselling nudge** — daily `10:30am` job nudges students who have an active counselling entitlement with unused sessions, granted >24h ago, not yet nudged. Sent **once per entitlement** (WhatsApp → email → in‑app).

---

<a name="database-migrations"></a>
## 4. Database migrations (Flyway)

| Version | File | Adds |
|---|---|---|
| `V20260603002` | `..._counselling_mode_and_contact.sql` | `counselling_slot.mode`, `availability_template.mode`, `counsellors.office_address`, `counselling_appointment` mode/location/contact columns |
| `V20260603003` | `..._counselling_reminders_otp_checkin.sql` | `counselling_reminder_sent` table, `counselling_checkin_otp` table, `counselling_appointment` check‑in columns (`session_started_at`, `checkin_verified_at`, `attended`) |
| `V20260603004` | `..._counselling_booking_nudge.sql` | `student_entitlements.counselling_nudge_sent_at` |

All migrations are **additive** (new tables / nullable / defaulted columns); existing rows are unaffected. The legacy `reminder_24h_sent` / `reminder_1h_sent` flags on `counselling_appointment` are left in place (no longer written).

---

<a name="new-backend-endpoints"></a>
## 5. New backend endpoints

| Method & path | Purpose |
|---|---|
| `POST /api/counselling-appointment/start/{id}` | Counsellor triggers check‑in → generates + sends OTP to the student |
| `POST /api/counselling-appointment/verify-checkin/{id}` | Counsellor submits the student's OTP → marks `IN_PROGRESS` + attendance |
| `GET /api/counsellor/{id}/dashboard-summary` | Today's sessions + booked/free/upcoming/completed/pending counts |

Existing public booking endpoint `POST /campaign/public/counselling/book` now also accepts `contactName`, `contactPhone`, `contactEmail`, `preferredContactMethod`; the public slot list returns `mode`.

---

<a name="scheduled-jobs"></a>
## 6. Scheduled jobs (cron) — `ReminderSchedulerService`

| Cron | Job | Notes |
|---|---|---|
| `0 */5 * * * *` | Student (12h/4h/2h/15m) + counsellor (2h/15m) reminders | Idempotent via `counselling_reminder_sent`; windowed firing |
| `0 0 20 * * *` | Counsellor day‑before digest | Groups tomorrow's sessions per counsellor |
| `0 30 10 * * *` | Unbooked‑counselling nudge | Once per entitlement, >24h after grant |

Scheduling is active via the app's existing `@EnableScheduling`.

---

<a name="environment-variables"></a>
## 7. Environment variables

WhatsApp uses AiSensy. Required for live WhatsApp delivery (otherwise everything falls back to email):

| Variable | Default | Used for |
|---|---|---|
| `AISENSY_API_KEY` | — (required for WhatsApp) | Auth to AiSensy |
| `AISENSY_COUNSELLING_REMINDER_CAMPAIGN` | `counselling_reminder` | Session reminders |
| `AISENSY_COUNSELLING_OTP_CAMPAIGN` | `counselling_otp` | Check‑in OTP |
| `AISENSY_COUNSELLING_CONFIRMATION_CAMPAIGN` | `counselling_confirmation` | Booking confirmation |
| `AISENSY_COUNSELLOR_DIGEST_CAMPAIGN` | `counsellor_daily_digest` | Day‑before digest |
| `AISENSY_COUNSELLING_NUDGE_CAMPAIGN` | `counselling_booking_nudge` | Unbooked nudge |

> Each campaign name must map to a **Meta‑approved AiSensy template**, and the template's positional params must match what we send (reminders: `[name, whenLabel, dateTime]`; OTP: `[name, code]`; confirmation: `[name, dateTime, mode]`; digest: `[name, date, count]`; nudge: `[name, sessionsRemaining]`).

The `.ics` confirmation email is sent via `OdooEmailService` (`SmtpEmailRequest` with attachment); if that sender is unavailable it falls back to a plain Mandrill text email (no attachment).

---

<a name="notification-channel-policy"></a>
## 8. Notification channel policy

- **Reminders / OTP / nudge:** WhatsApp first → **email fallback** if WhatsApp isn't configured or the send fails → plus in‑app notification.
- **Booking confirmation:** always email (so the `.ics` attaches) **and** a best‑effort WhatsApp.
- In‑app notifications use the existing `counselling_notification` system (polled by `NotificationBell`).

---

<a name="full-file-inventory"></a>
## 9. Full file inventory

### New backend files
```
spring-social/src/main/resources/db/migration/V20260603002__counselling_mode_and_contact.sql
spring-social/src/main/resources/db/migration/V20260603003__counselling_reminders_otp_checkin.sql
spring-social/src/main/resources/db/migration/V20260603004__counselling_booking_nudge.sql
spring-social/.../model/career9/counselling/CounsellingReminderSent.java
spring-social/.../model/career9/counselling/CounsellingCheckinOtp.java
spring-social/.../repository/Career9/counselling/CounsellingReminderSentRepository.java
spring-social/.../repository/Career9/counselling/CounsellingCheckinOtpRepository.java
spring-social/.../service/counselling/WhatsAppService.java
spring-social/.../service/counselling/IcsService.java
spring-social/.../service/counselling/CheckinOtpService.java
```

### Modified backend files
```
spring-social/.../model/career9/counselling/CounsellingSlot.java          (mode)
spring-social/.../model/career9/counselling/AvailabilityTemplate.java     (mode)
spring-social/.../model/career9/counselling/Counsellor.java               (officeAddress)
spring-social/.../model/career9/counselling/CounsellingAppointment.java   (mode/location/contact + check-in)
spring-social/.../model/career9/b2c/StudentEntitlement.java               (counsellingNudgeSentAt)
spring-social/.../repository/Career9/counselling/CounsellingAppointmentRepository.java
spring-social/.../repository/Career9/b2c/StudentEntitlementRepository.java
spring-social/.../service/counselling/BookingService.java
spring-social/.../service/counselling/SlotMaterializationService.java
spring-social/.../service/counselling/CounsellorService.java
spring-social/.../service/counselling/CounsellingNotificationService.java
spring-social/.../service/counselling/ReminderSchedulerService.java
spring-social/.../controller/career9/b2c/CampaignPublicController.java
spring-social/.../controller/career9/counselling/AvailabilityTemplateController.java
spring-social/.../controller/career9/counselling/CounsellingAppointmentController.java
spring-social/.../controller/career9/counselling/CounsellorController.java
```

### Modified frontend files
```
career-nine-assessment/src/api-clients/campaignAPI.ts                     (contact fields on book)
career-nine-assessment/src/components/CounsellingSlotPicker.tsx           (mode badge + contact form)
career-nine-assessment/src/pages/ThankYouPage.tsx                         (auto-open picker + NEXT STEP CTA)
react-social/src/app/pages/Counselling/API/AppointmentAPI.ts             (start/verify/summary)
react-social/src/app/pages/Counselling/counsellor/CounsellorDashboardPage.tsx (summary cards + OTP check-in)
react-social/src/app/pages/Counselling/counsellor/components/RecurringTemplateForm.tsx (mode)
react-social/src/app/pages/Counselling/counsellor/components/ManualSlotForm.tsx        (mode)
react-social/src/app/pages/CounsellorDashboard/CounsellorProfilePage.tsx               (office address)
```

---

<a name="verification-checklist"></a>
## 10. Verification checklist (not yet runtime‑tested)

**Highest risk first**
1. **Migrations apply** cleanly on a real MySQL (V20260603002/003/004); confirm the new tables/columns exist.
2. **Counsellor portal auth** — the new counsellor endpoints (`/start`, `/verify-checkin`, `/{id}/dashboard-summary`) are `@PreAuthorize`‑guarded. Confirm the counsellor session actually carries those permissions (there was a noted gap where the portal "trusts the client"). Also confirm the **"Counsellor profile not found"** issue (counsellor↔user linkage) is resolved — it blocks profile/office‑address/dashboard.
3. **Slot‑creation forms** — the template/manual‑slot forms POST flat keys that may not match the bound entity; confirm slots actually save **with a counsellor and the chosen mode**.
4. **AiSensy templates** — confirm a real WhatsApp arrives and param order matches; otherwise confirm clean email fallback.

**Core flows**
5. Online booking → email has meeting link + working `.ics` at the correct IST time.
6. Offline booking → email shows the counsellor's office address.
7. Concurrent booking of the same slot → exactly one succeeds.
8. OTP: start → student receives code → verify → `IN_PROGRESS`; test expiry, wrong‑code lockout, resend.
9. Reminders fire at ~12h/4h/2h/15m (student) and 2h/15m (counsellor), each once (check `counselling_reminder_sent`); late booking isn't spammed.
10. 8pm digest lists tomorrow's sessions per counsellor.
11. Dashboard summary counts are correct.
12. Thank‑you page auto‑opens the picker for paid counselling; "NEXT STEP" CTA shows.
13. Nudge sends once for an unbooked, paid counselling entitlement after 24h.

---

<a name="known-limitations--risks"></a>
## 11. Known limitations / risks

- **Online links are placeholder** `meet.google.com` room codes (per the chosen "auto‑generated" approach) — not real scheduled meetings.
- **Auto‑open is skippable** by default (not mandatory). Can be made blocking on request.
- **Calendar** is an `.ics` attachment (no Google Calendar API/OAuth sync).
- **react-social** can't be standalone type‑checked (pre‑existing `tsconfig`/TS‑version mismatch); rely on the react‑scripts build.
- **Reminders** use a ±7‑minute window around each offset; if the scheduler is down for an entire window, that offset is skipped (idempotency still prevents duplicates).
- **No explicit "complete session"** action yet — OTP marks a session `IN_PROGRESS`; closing it out isn't wired.
- **Pre‑existing dead link:** the counsellor sidebar's **"Reports"** item points to `/counsellor/reports`, which has no route and redirects to login. Not introduced by these changes; flagged for cleanup.

---

<a name="offline-records"></a>
## 12. Offline records

### Intent
Some schools run counselling themselves: the school sets the timetable and an offline counsellor sees the students in person. None of the online machinery applies (published slots, student booking, OTP check-in, the 5‑minute sweep), so before this change there was no way to record that a student had been counselled, and nothing downstream (principal dashboard, admin cards, student history, report release) could see it.

An admin flags a counsellor as **offline** on the counsellor profile. That counsellor gets one page, `/counsellor/offline-sessions`, where they:
- see every student of the school(s) they are mapped to, filtered by assessment, class and section;
- take a student over with **Map to me**, whether the student is unmapped or mapped to someone else;
- **Mark done** for a student mapped to them, per assessment, with an optional OTP and optional photos of the paper counselling sheet.

Marking done emails the student (and the parent, when one is on file). There is no rating prompt. A counsellor cannot undo a record; only an admin can revert one. A live online booking for the same assessment is cancelled silently when the student is marked done: no mail, the slot is released, nothing is credited back.

### How a session is stored
An offline session is an ordinary `counselling_appointment` row with `status = COMPLETED`, `mode = OFFLINE`, `origin = 'OFFLINE_RECORD'` and the new `assessment_id` set. Keeping it an appointment means photos (`session_notes_photo`), the audit log, the principal dashboard's `findCounselledStudentIds`, the admin cards, student history and report release all work without changes.

`slot_id` is NOT NULL and about 20 JPQL queries inner-join `a.slot`, so each record gets a slot of its own.

**Synthetic slot convention** (one per record, never shared, never bookable):

| Field | Value |
|---|---|
| `counsellor` | the recording counsellor |
| `date` | the session date the counsellor picked (today back to today−30, never future) |
| `start_time` / `end_time` | `00:00` / `00:00` |
| `duration_minutes` | `0` |
| `mode` | `OFFLINE` |
| `status` | `COMPLETED` (`CANCELLED` after an admin revert) |
| `is_blocked` | `true` |
| `is_manually_created` | `true` |
| `block_reason` | `OFFLINE_RECORD` |

The slot is saved before the appointment (there is no cascade). Code that needs to recognise one should match `block_reason = 'OFFLINE_RECORD'`: that survives a revert, where `status` alone does not.

"Done for this assessment" means a COMPLETED appointment tied to the assessment, either through `assessment_id` or through the entitlement it was booked on (`CounsellingAppointmentRepository.findLatestCompletedForAssessment`). New online bookings are stamped with `assessment_id` where it is known (campaign bookings from the entitlement, admin bulk allotment from the cohort, and reschedules carry it forward), so a future online completion counts as done too.

### The origin predicate rule
Normal bookings have `origin = NULL`. Every filter that excludes offline records **must be null-safe**:

```sql
(a.origin IS NULL OR a.origin <> 'OFFLINE_RECORD')
```

A bare `a.origin <> 'OFFLINE_RECORD'` is false for NULL and would silently drop every ordinary booking. In Java, use `CounsellingAppointment.isOfflineRecord()`, which is null-safe. `OverviewQuery.notOfflineRecord(alias)` wraps the predicate for the admin overview.

Where offline records are excluded, and why:

| Reader | Behaviour |
|---|---|
| Rating prompt (`CounsellingRatingRepository.findUnratedCompletedAppointmentsForStudent`) | Excluded: the student never booked the session. |
| Admin overview "Scheduled by students" (`AdminOverviewService.counsellingBooked`, all three counts, plus its drill-down) | Excluded: a record is not a booking. The sessions and completed cards still count it. |
| Counsellor portal list `GET /api/counselling-appointment/by-counsellor/{id}` | Excluded unless `?includeOffline=true`, because those screens poll and fetch notes per completed row. |
| Counsellor dashboard summary "today" list | Excluded (nothing to start or check in). `completedCount` still includes them. |
| Student history `by-student` | Reverted records (`OFFLINE_RECORD` + `CANCELLED`) are hidden. |
| Admin bulk allotment preview | Students already done for the assessment go in a read-only `alreadyCounselled` bucket (it wins over "already booked"); confirm drops them on the server and reports them as unbooked with a reason. |
| Rebook with counsellor / reschedule | COMPLETED sessions and offline records are refused. |
| Slot materialization, blocked-date approval | A blocked COMPLETED or `OFFLINE_RECORD` slot does not mark the day as blocked; the approve loop never cancels a COMPLETED slot. |

Typed session notes on an offline record skip the check-in and slot-end gates. Instead, the caller must be the record's own counsellor (identified by the signed-in principal, not the `userId` parameter) or an admin holding `counselling.appointment.delete`, and the record must be COMPLETED. The session-complete mail and in-app notice are not sent again.

Purging a student reads the synthetic slot ids while the appointments still exist, deletes the slots after the appointments (the slot is the FK parent), and deletes the student's `counselling_otp_guard` row.

### OTP
The OTP is optional. When one is typed, it is checked against the student's DOB-derived code by `OtpGuardService`, in its own transaction so the failure counter really commits. Three wrong codes within 15 minutes (`app.counselling.checkin-max-attempts`) lock the OTP for 15 minutes; ten in total lock it for good. A student with no DOB gets `OTP_NO_DOB`, and the `1111` fallback is never accepted as proof. The counsellor can always save without the OTP; the record then has `checkin_verified_at = NULL` and shows "OTP not verified".

### Endpoints (`/api/offline-counselling`)

| Method & path | Purpose |
|---|---|
| `GET /context` | Always 200: `{offline, counsellorId, name, institutes}`; `offline:false` for anyone who is not an active offline counsellor. |
| `GET /assessments?instituteCode=` | Assessments allotted in that school. |
| `GET /students?instituteCode=&assessmentId=` | The student list (native SQL; no DOB, phone or email). |
| `POST /map-to-me` | Take over up to 500 students. |
| `POST /mark-done` | Record the session (optional OTP). |
| `POST /admin/{appointmentId}/revert` | Admin only (`counselling.appointment.delete`, hard-checked). |
| `PUT /admin/counsellor/{counsellorId}/offline` | Admin only (`counsellor.create`, hard-checked). |

Every gate is an in-code check off the principal, because `auth.enforce-mode: log-only` makes `@PreAuthorize` a no-op.

### Hardening shipped alongside
- `POST /api/counsellor-institute/allocate` and `DELETE /deallocate/{id}` are hard-checked (`counsellor_institute_mapping.create` / `.delete`, or super-admin). A counsellor's active mappings are the allow-list the offline page trusts, and before this a counsellor could add schools to their own list.
- "Open as Counsellor" (`POST /admin/impersonate/counsellor/{id}`) now needs `counsellor.create` (admin-only) instead of `counsellor.update` (which every counsellor holds), and refuses a counsellor whose login is a super-admin.
- `appointment.counsellor` and the student mapping's `counsellor` no longer serialise the counsellor's bank, government-id, agreement, rate or login fields, and `assignedBy` is narrowed to `{id, name}`. `appointment.slot.counsellor` still serialises the full counsellor; that is not fixed yet.

### Migration
`V20260928001__offline_counselling.sql` adds `counsellors.is_offline`, `counselling_appointment.assessment_id` and `origin` (plus index `idx_ca_student_assessment`), dedupes `student_counsellor_mapping` and adds `UNIQUE uk_scm_student(student_id)`, and creates `counselling_otp_guard`. Every statement is guarded on `information_schema`, so it is safe to re-run and safe on a database where Hibernate added the columns first.

### Known limitations
- The principal dashboard's "students counselled" is a release-time snapshot; offline records appear after a re-release or refresh.
- The thank-you page still offers online booking to students of offline schools.
- Admin impersonation tabs are recorded as the counsellor (the token has no impersonator claim).

---

*Generated as a summary of the counselling flow changes. All changes are in the working tree and have not been committed.*
