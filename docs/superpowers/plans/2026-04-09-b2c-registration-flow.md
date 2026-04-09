# B2C Registration & Assessment Flow — Implementation Plan

## Overview

A self-service registration flow via QR/Link for B2C scenarios (events, school parent groups). Students scan a QR or open a link, register, pay, take assessment, book counselling, and provide feedback — all without admin intervention.

---

## The Full Student Journey (8 Stages)

```
Stage 1: QR/Link Landing Page (Tool Selection)
    ↓
Stage 2: Student Registration Form (capture details)
    ↓
Stage 3: Payment (Razorpay) — with "Skip" for Career-9 staff
    ↓
Stage 4: Assessment Access (redirect to assessment)
    ↓
Stage 5: Assessment Completion → Congrats Message
    ↓
Stage 6: Book Counselling Slot (date/time picker, 4-5 days out)
    ↓
Stage 7: Counselling Payment (if applicable)
    ↓
Stage 8: Feedback + Thank You
```

Each stage triggers backend events: SMS, calendar updates, emails.

---

## Stage 1: QR/Link Landing Page

### What the student sees
A branded page with Career-9 logo showing tool options as cards/tabs:

```
┌──────────────────────────────────────────────────┐
│           [Career-9 Logo]                        │
│                                                  │
│   Choose Your Assessment                         │
│                                                  │
│   ┌─────────────────────┐  ┌──────────────────┐  │
│   │  🧠 BET             │  │  🧭 Navigator    │  │
│   │  Grades 6, 7, 8     │  │     360          │  │
│   │                     │  │  Grades 9, 10    │  │
│   │  [Register Now →]   │  │                  │  │
│   └─────────────────────┘  │  [Register Now →]│  │
│                            └──────────────────┘  │
│   ┌─────────────────────┐                        │
│   │  🎯 Navigator 360+  │                        │
│   │  Grades 11, 12      │                        │
│   │                     │                        │
│   │  [Register Now →]   │                        │
│   └─────────────────────┘                        │
│                                                  │
│   Powered by Career-9                            │
└──────────────────────────────────────────────────┘
```

### QR Code / Printable Design
- A4-printable page with Career-9 branding, QR code, and URL
- QR points to: `https://assessment.career-9.com/register`
- Or tool-specific: `https://assessment.career-9.com/register?tool=bet`
- Design should include: Career-9 logo, tool name, grade range, QR, short URL

### Backend
- New entity: `RegistrationLink` — stores link config (tool, grades, event name, created by, active)
- Each link has a unique slug: `/register/evt-2026-delhi` or `/register?ref=xyz`
- Admin can create links from dashboard with tool + grade config

### Files to Create
- **Frontend**: `pages/B2CRegistration/ToolSelectionPage.tsx`
- **Frontend**: `pages/B2CRegistration/components/ToolCard.tsx`
- **Backend**: `model/career9/RegistrationLink.java`
- **Backend**: `controller/career9/B2CRegistrationController.java`
- **Route**: Public route in `AppRoutes.tsx` at `/register/:slug?`

---

## Stage 2: Student Registration Form

### What the student sees
After selecting a tool, a clean form captures:

| Field | Required | Notes |
|-------|----------|-------|
| Full Name | Yes | |
| Email | Yes | For login + communications |
| Phone | Yes | For SMS notifications |
| Date of Birth | Yes | Used as password + age verification for grade |
| Gender | Yes | |
| Grade/Class | Yes | Pre-filled from tool selection |
| School Name | Optional | Free text |
| City | Optional | |
| Parent Name | Optional | For minors |
| Parent Phone | Optional | For event communication |

### Backend
- Saves to `StudentRegistration` entity (new — not the existing `StudentInfo` yet)
- Validates: duplicate email check, age vs grade sanity check
- Generates a `registrationToken` for the rest of the flow
- Triggers: SMS to student phone ("Registration received, proceed to payment")

### Files to Create
- **Frontend**: `pages/B2CRegistration/RegistrationFormPage.tsx`
- **Backend**: `model/career9/B2CStudentRegistration.java` (holds all registration data + flow state)
- **Backend**: Endpoint `POST /b2c/register` in `B2CRegistrationController.java`

---

## Stage 3: Payment

### What the student sees
- Amount shown based on tool selected
- "Pay Now" button → redirects to Razorpay payment page
- **"Skip Payment"** button visible ONLY if a Career-9 staff user ID is detected (via URL param `?staff=true` + staff login verification)

### How it connects to existing Razorpay implementation
- Reuses `RazorpayService.createPaymentLink()` we already built
- Reuses `PaymentTransaction` entity for tracking
- Reuses `PaymentWebhookController` for callback handling
- New: After payment success, instead of creating student from webhook (current flow), the B2C flow already has the registration data — so webhook just marks payment as done and triggers student provisioning

### Skip Payment Flow (Staff)
- Staff enters their Career-9 email on a modal
- Backend verifies email exists in User table with staff role
- If verified, skips payment and proceeds directly to assessment access
- Logged in `PaymentTransaction` with status `"staff_skip"` and `sentBy` field

### Files to Modify/Create
- **Frontend**: `pages/B2CRegistration/PaymentPage.tsx`
- **Frontend**: `pages/B2CRegistration/components/StaffSkipModal.tsx`
- **Backend**: New endpoint `POST /b2c/skip-payment` (staff verification)
- **Backend**: Modify webhook to detect B2C registrations and use stored registration data

---

## Stage 4: Assessment Access

### What the student sees
After payment (or skip):
- "Payment Successful!" confirmation (reuse `PaymentStatusPage` design)
- Auto-provisions: User account, StudentInfo, UserStudent, StudentAssessmentMapping
- Shows login credentials (username + DOB as password)
- "Start Assessment" button → redirects to assessment app

### Backend
- Reuses existing `createStudentAndAllotAssessment()` logic from `PaymentWebhookController`
- Sends welcome email (async) via `PaymentEmailService`
- Sends SMS with credentials

### Files to Modify
- **Frontend**: Extend `PaymentStatusPage.tsx` with "Start Assessment" CTA
- **Backend**: Student provisioning triggered from B2C flow context

---

## Stage 5: Assessment Completion

### What the student sees
After submitting the assessment:
- Congrats message with animation
- "What's Next" section explaining counselling

### Backend
- `AssessmentCompletionEmailService` already exists — extend it
- Trigger SMS: "Assessment completed! Book your counselling slot."
- Update `B2CStudentRegistration.flowState` to `"assessment_completed"`

### Files to Modify
- **Frontend**: New `pages/B2CRegistration/AssessmentCompletePage.tsx`
- **Backend**: Extend assessment submission handler to trigger B2C next-step notifications

---

## Stage 6: Book Counselling Slot

### What the student sees
- Calendar view showing available slots (4-5 days from registration date onwards)
- Time slots (e.g., 30-min blocks from 9 AM - 6 PM)
- Select date + time → Confirm booking

### Backend
- New entity: `CounsellingSlot` — date, time, capacity, booked count
- New entity: `CounsellingBooking` — student, slot, status
- Endpoints:
  - `GET /b2c/counselling/available-slots` — returns open slots
  - `POST /b2c/counselling/book` — books a slot
- Triggers:
  - SMS: "Counselling booked for {date} at {time}"
  - Google Calendar event creation (if Google integration is available)
  - Email with calendar invite (.ics attachment)

### Files to Create
- **Frontend**: `pages/B2CRegistration/BookCounsellingPage.tsx`
- **Frontend**: `pages/B2CRegistration/components/SlotPicker.tsx`
- **Backend**: `model/career9/CounsellingSlot.java`
- **Backend**: `model/career9/CounsellingBooking.java`
- **Backend**: `repository/Career9/CounsellingSlotRepository.java`
- **Backend**: `repository/Career9/CounsellingBookingRepository.java`
- **Backend**: `controller/career9/CounsellingController.java`

---

## Stage 7: Counselling Payment

### What the student sees
- If counselling requires payment: show amount + Razorpay pay button
- If free (included in package): skip this step
- Confirmation page after payment

### Backend
- Reuses `RazorpayService.createPaymentLink()` — same as assessment payment
- New `PaymentTransaction` with `type = "counselling"` (add field to entity)
- Reuses `PaymentWebhookController` (add counselling-specific handling)

### Files to Modify
- **Frontend**: `pages/B2CRegistration/CounsellingPaymentPage.tsx`
- **Backend**: Add `paymentType` field to `PaymentTransaction` (distinguish assessment vs counselling)

---

## Stage 8: Feedback + Thank You

### What the student sees
After counselling (or after assessment if no counselling):
- Star rating for: Assessment experience, App experience
- "Would you recommend Career-9?" (NPS-style 1-10)
- Free text feedback
- Thank You message with social share options

### Backend
- New entity: `StudentFeedback` — studentId, ratings, NPS score, text, timestamp
- Endpoint: `POST /b2c/feedback`
- Triggers: Thank you email + SMS

### Files to Create
- **Frontend**: `pages/B2CRegistration/FeedbackPage.tsx`
- **Backend**: `model/career9/StudentFeedback.java`
- **Backend**: `repository/Career9/StudentFeedbackRepository.java`

---

## Notifications Matrix

| Event | Email | SMS | Calendar |
|-------|-------|-----|----------|
| Registration submitted | Yes | Yes | - |
| Payment successful | Yes (with credentials) | Yes | - |
| Payment failed | Yes (retry link) | Yes | - |
| Assessment allotted | Yes (login link) | - | - |
| Assessment completed | Yes (congrats) | Yes (book counselling CTA) | - |
| Counselling booked | Yes (details) | Yes | Yes (.ics + Google) |
| Counselling payment done | Yes | Yes | - |
| Counselling reminder (1 day before) | Yes | Yes | - |
| Feedback request (after counselling) | Yes | Yes | - |

---

## New Entities Summary

| Entity | Purpose |
|--------|---------|
| `RegistrationLink` | Admin-created QR/link config (tool, grades, event) |
| `B2CStudentRegistration` | Full registration data + flow state tracking |
| `CounsellingSlot` | Available counselling time slots |
| `CounsellingBooking` | Student ↔ slot mapping |
| `StudentFeedback` | Post-assessment/counselling feedback |

---

## Reuses from Current Implementation

| Component | How it's reused |
|-----------|----------------|
| `RazorpayService` | Creates payment links (assessment + counselling) |
| `PaymentTransaction` | Tracks all payments (add `paymentType` field) |
| `PaymentWebhookController` | Handles all Razorpay callbacks |
| `PaymentEmailService` | All async email sending |
| `PaymentStatusPage` | Payment confirmation UI (extend with CTA) |
| `PaymentNotificationLog` | Logs all email/WhatsApp sends |
| Student creation flow | User → StudentInfo → UserStudent → Assessment mapping |

---

## Implementation Phases

### Phase 1: Core Registration Flow (Stages 1-4)
- QR/Link landing page with tool selection
- Registration form
- Payment integration (reuse existing)
- Student provisioning + assessment access
- Staff skip payment
- **Estimated: 8-10 tasks**

### Phase 2: Post-Assessment Flow (Stages 5-6)
- Assessment completion page
- Counselling slot management (admin + student)
- Booking system with calendar integration
- **Estimated: 6-8 tasks**

### Phase 3: Counselling Payment + Feedback (Stages 7-8)
- Counselling payment
- Feedback collection
- Thank you flow
- **Estimated: 4-5 tasks**

### Phase 4: QR Design + Print Assets
- A4 printable QR pages for each tool
- Branded design matching Career-9 website
- PDF generation endpoint for admin to download
- **Estimated: 2-3 tasks**

### Phase 5: SMS + Calendar Integration
- SMS service integration (MSG91 / Twilio / similar)
- Google Calendar event creation
- .ics file generation for email attachments
- Automated reminders (counselling day-before)
- **Estimated: 4-5 tasks**

---

## Key Design Decisions Needed

1. **SMS Provider**: Which SMS gateway? MSG91, Twilio, or existing Mandrill?
2. **Counselling Slots**: Who manages availability? Admin-created slots vs auto-generated?
3. **Pricing Config**: Hardcoded per tool or admin-configurable? Different prices for events vs online?
4. **Staff Skip Verification**: Simple email check or full staff login?
5. **Assessment App**: Does the student stay in `dashboard.career-9.com` or redirect to `assessment.career-9.com`?
6. **Counselling Platform**: Video call (Zoom/Meet link) or in-person only?

---

## Frontend Route Map

```
/register                    → Tool Selection (public)
/register/:slug              → Tool Selection with pre-config (public)
/register/form               → Registration Form (public)
/register/payment            → Payment Page (public)
/register/payment-status     → Payment Status (public, reuse existing)
/register/assessment-access  → Credentials + Start Assessment (public)
/register/complete           → Assessment Complete + Congrats (public)
/register/book-counselling   → Slot Picker (public)
/register/counselling-payment → Counselling Payment (public)
/register/feedback           → Feedback Form (public)
/register/thank-you          → Thank You (public)
```

All routes are public (no login required) — the student navigates the entire flow unauthenticated. Flow state is tracked via `registrationToken` in URL params or session storage.
