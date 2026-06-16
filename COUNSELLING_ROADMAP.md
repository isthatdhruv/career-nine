# Counselling Slot-Booking — Roadmap & Decision Record

> Status as of 2026-06-09. Owner: hiba-sameer. This captures the agreed design for the
> post-assessment counselling slot-booking flow and the counsellor portal. Most of the
> infrastructure already exists in the repo (models, endpoints, notification channels);
> the work below is **finishing, correcting, and testing** — not greenfield.

## 1. The flow (target)

1. Student completes an assessment.
2. If their entitlement has counselling active with sessions remaining, they are offered
   slot booking (in-app today; **tokenized email link** to be finished).
3. **Payment happens before the session** — slot is held, payment confirms the booking.
4. Student picks a slot → booking is created → reflects in that counsellor's portal.
5. Confirmation email + `.ics` calendar invite is sent to the assessment email.
   - **Online** → meeting link in the email + reminders.
   - **Offline** → counsellor's office address (entered by the counsellor in their profile).
6. Reminders (WhatsApp via AiSensy), **mode-aware** (carry link or address):
   - **Student:** 12h / 4h / 2h / 15min before.
   - **Counsellor:** 8pm day-before digest email + 2 WhatsApp reminders before.
7. At session start the counsellor verifies the student via OTP (already built).
8. **At the slot's end time** (time-driven):
   - OTP was verified → status `COMPLETED`, slot freed, dashboard updates.
   - OTP never verified → status `MISSED`, slot freed, student emailed
     "you didn't attend" + a link to re-book if they still want counselling.

## 2. Decisions (locked)

| Topic | Decision |
|---|---|
| Slot authority | **Counsellor creates their own slots**; **admin gates eligibility** — decides which counsellor(s) may counsel for a given assessment. (Not central admin scheduling.) |
| Session completion | Time-driven at slot end: verified → COMPLETED + free slot |
| No-show | Time-driven at slot end: unverified → MISSED + free slot + "did not attend" email with re-book link |
| Payment | **Pay before counselling** — flow is **pick slot → pay → confirmed** (slot soft-held during payment; matches the held-slot + Razorpay columns in V20260609003) |
| No-show × payment | **Always rebookable, no forfeit** — a session is only truly consumed on COMPLETED; MISSED/CANCELLED credits the session back so the student can rebook |
| Concurrency | Soft-hold: mark slot REQUESTED with a short TTL on open; release if not completed; final commit still guarded by optimistic `@Version` lock |
| Student reminders | 4: 12h / 4h / 2h / 15min, **mode-aware** (link for online, address for offline) |
| Counsellor reminders | 8pm day-before digest email + 2 WhatsApp reminders |
| Online vs offline | Online → meeting link (email + reminders); Offline → counsellor office address |
| Calendar | `.ics` attachment for v1; revisit real Google Calendar API later |
| Auth | Unify on the User-backed `/auth/login` cookie session (the "Phase 19" direction); fix the counsellor↔user linkage |

## 3. Build phases (dependency order)

- **Phase 0 — This document.** ✅
- **Phase 1 — Fix counsellor↔user auth linkage.** Everything depends on the portal knowing
  who the logged-in counsellor is. Root cause: counsellors exist in the `counsellors` table
  with their own `password_hash` but with **no linked `User` row / no `user_id`**, while the
  frontend resolves the counsellor via `getCounsellorByUserId(currentUser.id)` off the unified
  `/auth/login` session. The bridge is never populated → "Counsellor profile not found".
- **Phase 2 — Lifecycle engine.** Single end-of-slot scheduled sweep: COMPLETED / MISSED +
  free slot + no-show email with re-book link. Makes the dashboard update "as counselling happens".
- **Phase 3 — Booking entry + integrity.** Tokenized email booking link + soft-hold concurrency
  + pay-before-booking. All touch the booking moment, done together.
- **Phase 4 — Admin assignment layer.** Lightweight counsellor↔assessment eligibility screen.
- **Phase 5 — Notifications.** Make the 4+2 reminders mode-aware (inject link/address), then
  test the entire chain end-to-end (booking → confirmation → reminders → digest → OTP → no-show).
- **Phase 6 — Calendar polish.** Ship `.ics`; assess Google Calendar API as a later upgrade.

## 4. Key code locations

- Backend models: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/`
  (`Counsellor`, `CounsellingSlot`, `CounsellingAppointment`, `AvailabilityTemplate`, ...)
- Backend controllers: `.../controller/career9/counselling/`
- Backend services: `.../service/counselling/`
  (`BookingService`, `ReminderSchedulerService`, `CounsellingNotificationService`,
  `WhatsAppService`, `IcsService`, `CheckinOtpService`, `MeetingLinkService`, ...)
- Auth: `.../controller/AuthController.java`, `.../security/` (cookie session, JWT, RBAC/ABAC)
- Counsellor portal (React): `react-social/src/app/pages/CounsellorDashboard/` and
  `react-social/src/app/pages/Counselling/`
- Student slot picker (assessment app): `career-nine-assessment/src/components/CounsellingSlotPicker.tsx`

## 5. Known gaps / risks (live)

- Counsellor↔User linkage missing (Phase 1).
- No session-completion transition yet (Phase 2).
- `MeetingLinkService` generates placeholder Meet rooms, not real scheduled meetings.
- PAY_LATER/pay-before booking only partially wired (DB columns exist).
- Notification chain coded but never runtime-tested.
- Counsellor sidebar "Reports" link 404s (dead link).
