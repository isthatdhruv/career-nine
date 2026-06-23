# Email Sources — Where Emails Are Sent & Why

_Last updated: 2026-06-23 — reflects the Odoo → Gmail migration (all active transactional
email now goes through the Gmail transport; Odoo is no longer used by any live flow)._

This document lists every place the backend (`spring-social`) sends an email, the purpose of
each email, the trigger, and the transport in use.

---

## 1. Transports (the senders)

| Transport | Class | From address | Status |
|---|---|---|---|
| **Gmail API** | `GmailApiEmailServiceImpl` (`@Primary` impl of `SmtpEmailService`) | `notifications@career-9.net` (`GMAIL_SENDER`), domain-wide-delegation impersonation via `firebase-service-account.json` | **ACTIVE** — backs every `SmtpEmailService` injection; all transactional mail |
| **SMTP** | `SmtpEmailServiceImpl` (`smtp.gmail.com:587`) | `spring.mail.username` (`SMTP_USERNAME`) | **DORMANT** — only registers when `app.email.provider=smtp` (set nowhere; DigitalOcean blocks outbound SMTP ports) |
| **Mandrill** | `EmailService`, `StudentGoogleEmailGenerateServiceImpl`, counselling fallback | caller-supplied / `noreply@kccitm.edu.in` / `support@kccitm.email` | **LEGACY** — hard-coded, almost-certainly-stale API keys; wired but likely non-delivering |
| **Odoo** | `OdooEmailService` (JSON-RPC `mail.mail`) | `ODOO_USERNAME` envelope, header `"Career-9" <odooUsername>` | **UNUSED** by active flows — only the dormant `OdooEmailSender` (report pipeline, `REPORT_EMAIL_TRANSPORT=odoo`, off by default) |

**Report pipeline** uses dedicated synchronous senders selected by `REPORT_EMAIL_TRANSPORT`
(default `gmail`): `GmailReportEmailSender` (active) vs `OdooEmailSender` (opt-in, dormant).

> Note: `SmtpEmailService` is the abstraction. Because the SMTP impl is gated off and
> `GmailApiEmailServiceImpl` is `@Primary`, **every `SmtpEmailService` call resolves to the
> Gmail API** — the only Gmail transport that delivers on DigitalOcean. Flipping
> `app.email.provider=smtp` would switch these same calls to raw `smtp.gmail.com` with no code
> change.

---

## 2. Account / Auth

Source files: `AuthController`, `UserController`, `EmailController`

| Source (trigger) | Purpose | Transport |
|---|---|---|
| `POST /auth/signup` | "Account under review" welcome | Gmail |
| `POST /auth/forgot-password` | Password reset link (60-min token) | Gmail _(was Odoo)_ |
| `POST /auth/reset-password` | Password-reset confirmation | Gmail _(was Odoo)_ |
| `POST /user/{id}/admin-reset-password` | Admin emails the new plaintext password | Gmail _(was Odoo)_ |
| `POST /user/toggle-active/{id}` | "Account Activated" notice | Gmail |
| `POST /email/send-with-attachment` | Admin generic email utility | Gmail |
| `GET /email-test/get` | Admin diagnostic test email | Mandrill |

## 3. Credentials & report distribution

Source files: `LoginCredentialsEmailService`, `ContactPersonController`, `LeadController`

| Source (trigger) | Purpose | Transport |
|---|---|---|
| `POST /send-login-credentials` (bulk admin) | Student login credentials (username + DOB-as-password) | Gmail _(was Odoo)_ |
| `POST /leads/capture` (STUDENT lead) | Auto-provisioned login credentials | Gmail _(was Odoo)_ |
| `POST /leads/email-export` | Admin lead export (Excel attachment) | Gmail |
| `POST /contact-person/assign-students` | "Students assigned to you" | Gmail _(was Odoo)_ |
| `POST /contact-person/send-report-email` | Ad-hoc HTML report email | Gmail _(was Odoo)_ |
| `POST /contact-person/send-reports` + `…-by-institute` | Bundled report ZIP to contact person | Gmail _(was Odoo)_ |

## 4. Assessment & B2C entitlement

Source files: `AssessmentCompletionEmailService`, `NotificationDispatcher` / `EntitlementService`

| Source (trigger) | Purpose | Transport |
|---|---|---|
| Assessment submit (completion) | "You've completed {assessment}" | Gmail _(was Odoo)_ |
| Payment webhook / free campaign register | B2C welcome + assessment magic-link + credentials | Gmail _(was Odoo)_ |
| Assessment completion (entitlement) | "Final report ready" / "1-pager ready" link | Gmail _(was Odoo)_ |
| Cron `0 23 * * * *` (hourly) | Unstarted-assessment nudge | Gmail _(was Odoo)_ |
| `POST /entitlement/{id}/resend/{type}` | Admin resend any service link | Gmail _(was Odoo)_ |
| `POST /admin/tracker/report-errors/{id}/retry` | Resend final-report after fix | Gmail _(was Odoo)_ |

## 5. Report PDF pipeline (Kafka)

Source files: `GmailReportEmailSender` (default), `OdooEmailSender` (dormant opt-in)

| Source (trigger) | Purpose | Transport |
|---|---|---|
| Kafka `report.email` after completion (whitelabel students only) | Co-branded "Your {school} report is ready" + **PDF attachment** | Gmail (default) |

> `OdooEmailSender` only activates when `REPORT_EMAIL_TRANSPORT=odoo` (set nowhere), so report
> emails already go via Gmail.

## 6. Payments (B2B / School)

Source file: `PaymentEmailService` — all Gmail

| Source (trigger) | Purpose |
|---|---|
| Razorpay `payment_link.paid` webhook | "Payment Successful" + credentials |
| Razorpay failed / expired / cancelled | Retry-payment nudge |
| `POST /payment/{id}/send-nudge` | Manual "complete your payment" |
| `POST /payment/{id}/send-email` | Send pay link to student |
| `POST /payment/{id}/resend-welcome` | Resend welcome to paid student |

## 7. B2B / School registration & campaign

Source files: `AssessmentInstituteMappingController`, `SchoolRegistrationController`, `CampaignPublicController` — Gmail

| Source (trigger) | Purpose |
|---|---|
| `POST /assessment-mapping/public/register/{token}` (free/promo) | Registration credentials |
| `POST /school-registration/public/register/{token}` (free) | Registration credentials |
| `POST /campaign/public/counselling-request` | Forward notice to Career-9 support staff |

## 8. Reminders

Source file: `ReminderSender` — Gmail _(was Odoo)_

| Source (trigger) | Purpose |
|---|---|
| `POST /reminders/manual/send` | Manual reminder (assessment-mapping / generic) |
| Scheduled feeder | **Disabled** (`@Scheduled` commented out) |

## 9. Counselling

Source file: `CounsellingNotificationService`

| Source (trigger) | Purpose | Transport |
|---|---|---|
| Booking auto-confirm | Confirmation **+ .ics** invite | **Gmail** _(was Odoo)_ — Mandrill fallback |
| `PUT /assign/{id}` | "Session assigned" → counsellor | Mandrill |
| `PUT /confirm/{id}` | "Session confirmed" → student | Mandrill |
| `PUT /cancel/{id}` | Cancellation → student / counsellor | Mandrill |
| Block-date approval (no replacement) | "Please rebook" → student | Mandrill |
| `PUT /reschedule/{id}` | Reschedule → student | Mandrill |
| Session notes saved | "Remarks available" → student | Mandrill |
| Cron `*/5 min` | Session reminders (student / parent / counsellor, WhatsApp-first) | Mandrill |
| `POST /start/{id}` | Check-in OTP (WhatsApp-first) | Mandrill |
| Cron `8pm` | Counsellor daily digest | Mandrill |
| Cron `10:30am` | Counselling booking nudge | Mandrill |
| Cron `*/5 min` lifecycle | No-show notice | Mandrill |

## 10. Legacy KCCITM (separate college product)

Source files: `StudentService`, `FacultyService`, `GoogleAdminController` / `StudentGoogleEmailGenerateServiceImpl` — all Mandrill

| Source (trigger) | Purpose |
|---|---|
| `POST /password-reset/update` | Google Workspace password reset (plaintext pw) |
| `POST student/update` (SI / RR / SU states) | Registration ack / rejection / completion |
| `GET /generate_pdf`, `GET /generate_id_card` | Welcome (official email + pw + ID card) / ID card |
| `GET /email-validation-official` | Email-verification OTP |
| `POST faculty/update` + `GET /generate_pdf_faculty` | Faculty registration / welcome (same set as students) |

---

## 11. Summary by transport (current state)

- **Gmail** (`GmailApiEmailServiceImpl` via the `SmtpEmailService` interface, From
  `notifications@career-9.net`): **all transactional mail** — auth, credentials, payments, B2C
  entitlement, registration, reminders, report PDFs, contact-person reports, and the counselling
  booking `.ics` confirmation.
- **Mandrill** (legacy, From `noreply@kccitm.edu.in` / `support@kccitm.email`, stale hard-coded
  keys): all KCCITM college flows + every counselling lifecycle/reminder email + the admin test
  endpoint + the counselling booking fallback.
- **Odoo**: no longer used by any active flow (only the dormant `OdooEmailSender`, off by default).

## 12. Dead code & risks

**Dead (never invoked):**
- `CounsellingNotificationService.sendBookingReceivedEmail` — no callers
- `CounsellingNotificationService.sendBlockDateRequestEmail` (would email hard-coded `admin@career-9.net`) — no callers
- `EmailService.sendMessageUsingTemplatesAndAttachment` — no callers; attachment was never wired onto the message anyway

**Security / correctness:**
- **Hard-coded Mandrill API keys** in `EmailService` and `MandrillConfig` — leaked credentials; rotate/remove.
- **Plaintext passwords emailed** in two flows: admin-reset (`/user/{id}/admin-reset-password`) and the KCCITM Google-Workspace reset (`/password-reset/update`).
- **Bug:** `/user/toggle-active/{id}` always sends "Account Activated" even when deactivating.
- **Bug:** the hourly B2C nudge cap counts `serviceType='nudge'` but sends log `'assessment_invite'`, so the per-entitlement cap counter never increments.
- `EntitlementService.upgradePending` sends the welcome email with **no `countSent` idempotency guard**, unlike `activateOnPayment`.
