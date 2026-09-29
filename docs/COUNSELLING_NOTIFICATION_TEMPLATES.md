# Counselling Notification Templates

Canonical source for the WhatsApp and email content the counselling flow sends.

- **Email** bodies live **in code** (`CounsellingNotificationService`) and are sent via
  Mandrill — they work without extra setup. They are reproduced here for reference.
- **WhatsApp** messages are sent via **AiSensy** (Meta WhatsApp Business). The message
  body is **NOT** in this codebase — it must exist as a **Meta-approved template**
  ("campaign") in the AiSensy dashboard with the **exact name** below and the **exact
  number of parameters**, in order. If the template is missing/unapproved, or
  `AISENSY_API_KEY` is unset, WhatsApp is silently skipped and only the email is sent.

The code passes parameters **positionally** — AiSensy fills `{{1}}`, `{{2}}`, … from the
`templateParams` list in order. The mappings below come from
`CounsellingNotificationService` (the `whatsAppService.sendTemplate(...)` calls).

---

## 1. Booking confirmation  ← the one the post-assessment flow uses

- **AiSensy campaign name:** `counselling_confirmation`
  (override via `AISENSY_COUNSELLING_CONFIRMATION_CAMPAIGN`)
- **Meta category:** UTILITY
- **Parameters (in order):**
  - `{{1}}` — student name
  - `{{2}}` — date + time (e.g. `June 17, 2026 3:00 PM`)
  - `{{3}}` — mode (`Online` or `In-person`)
  - `{{4}}` — who the session is with (counsellor name; the student's name on the counsellor's copy)
  - `{{5}}` — how to attend (`Join online: <link>` or `Venue: <address>`)

**WhatsApp template body to create in AiSensy:**

```
Hi {{1}}, your Career-9 counselling session is confirmed! 🎉

🗓 {{2}}
💬 Mode: {{3}}

We've also emailed you the full details, including how to join. Please be on
time — your counsellor is looking forward to meeting you!
```

**Email (already sent in code — for reference):**

- Subject: `Counselling Session Confirmed`
- Body:
```
Dear {name},

Your counselling session has been confirmed.

  Date: {date}
  Time: {time}
  Mode: {Online | In-person}
  {Meeting link: ... | Venue: ...}

Add to Google Calendar: {link}

A calendar invite is also attached so you can add this to any calendar.

Regards,
Career-9 Team
```

---

## 2. Session reminder (student & counsellor)

- **AiSensy campaign name:** `counselling_reminder`
  (override via `AISENSY_COUNSELLING_REMINDER_CAMPAIGN`)
- **Meta category:** UTILITY
- **Parameters (in order):**
  - `{{1}}` — name (student or counsellor)
  - `{{2}}` — when label (e.g. `in 12 hours`)
  - `{{3}}` — date + time (e.g. `June 17, 2026 3:00 PM`)
  - `{{4}}` — who the session is with (counsellor name; the student's name on the counsellor's copy)
  - `{{5}}` — how to attend (`Join online: <link>` or `Venue: <address>`)

**WhatsApp template body:**

```
Hi {{1}}, a reminder: your Career-9 counselling session is {{2}}.

🗓 {{3}}

See you soon!
```

---

## 3. Check-in OTP

- **AiSensy campaign name:** `counselling_otp`
  (override via `AISENSY_COUNSELLING_OTP_CAMPAIGN`) — points at the approved template
  `counselling_checkin_code`
- **Meta category:** AUTHENTICATION. Meta rejects a code inside a UTILITY template
  (`INCORRECT_CATEGORY`), so this uses Meta's fixed format: "`{{1}}` is your verification
  code." + security disclaimer + **Copy code** button, no expiry line (the code never expires).
- **Parameters:** `{{1}}` — the code. Sent by `WhatsAppService.sendAuthCode`, which also passes
  the code as the Copy Code button's parameter (URL button, index 0).

---

## 4. Booking nudge / no-show ("you still have a session to book")

- **AiSensy campaign name:** `counselling_booking_nudge`
  (override via `AISENSY_COUNSELLING_NUDGE_CAMPAIGN`)
- **Meta category:** UTILITY
- **Parameters (in order):**
  - `{{1}}` — student name
  - `{{2}}` — sessions remaining (count)
  - `{{3}}` — booking link (no login needed)

**WhatsApp template body:**

```
Hi {{1}}, you still have {{2}} Career-9 counselling session(s) waiting to be
booked. Log in and pick a time that works for you — it's a great next step
for your career.
```

---

## 5. Counsellor daily digest

- **AiSensy campaign name:** `counsellor_daily_digest`
  (override via `AISENSY_COUNSELLOR_DIGEST_CAMPAIGN`)
- **Meta category:** UTILITY
- **Parameters (in order):**
  - `{{1}}` — counsellor name
  - `{{2}}` — date label
  - `{{3}}` — number of sessions
  - `{{4}}` — counsellor dashboard link

**WhatsApp template body:**

```
Hi {{1}}, you have {{3}} counselling session(s) scheduled for {{2}}. Check
your email for the full list. Please be available on time.
```

---

## 6. Everything else — `career9_notification`

Every other email (reschedule, cancellation, session complete, payments, reports, account
mails…) goes out on this one generic template (see `WhatsAppCampaigns`).

- `{{1}}` — recipient name
- `{{2}}` — the email's subject
- `{{3}}` — the email's opening lines
- `{{4}}` — the email's first link (the portal URL when the email has none)

---

## Setup checklist

1. In the **AiSensy dashboard**, create one campaign per section above, using the
   **exact campaign name** and **exact `{{n}}` count**, then submit each for Meta
   approval. (At minimum, do `counselling_confirmation` for the post-assessment flow.)
2. Set `AISENSY_API_KEY` in `.env.production` (AiSensy → Manage → API Key).
3. If you name a campaign differently, set the matching
   `AISENSY_COUNSELLING_*` override in `.env.production`.
4. Restart the `api` container so it reads the new env vars.
5. Verify in logs after a booking:
   - `WhatsApp 'counselling_confirmation' sent to 91XXXXXXXXXX`
   - `Email sent to …: status=sent`
</content>
</invoke>

---

## 7. Per-event Utility templates (cost: Utility ₹0.145 vs the Marketing generic ₹1.09)

Filled by `WhatsAppDispatchService#eventParams`: `{{1}}` recipient name, then the facts the
caller passes to `WhatsAppMessage#onEvent`, then the email's main link (first web button in its
HTML) unless the caller sets `withLink`. Campaign name = template name.

| Template | Parameters | Sent for |
|---|---|---|
| `career9_registration_done` | name, link | LOGIN_CREDENTIALS, STUDENT_ID_EMAIL, ACCOUNT_WELCOME, ENTITLEMENT_GRANTED |
| `career9_assessment_pending` | name, link | ENTITLEMENT_REMINDER |
| `career9_assessment_completed` | name, link | ASSESSMENT_COMPLETION |
| `career9_report_ready` | name, link | REPORT_READY, CONTACT_PERSON_REPORT |
| `career9_payment_received` | name, link | PAYMENT_SUCCESS |
| `career9_payment_failed` | name, link | PAYMENT_FAILED |
| `career9_payment_due` | name, link | PAYMENT_REMINDER, PAYMENT_LINK |
| `career9_password_reset` | name, link | PASSWORD_RESET, ADMIN_PASSWORD_RESET |
| `career9_password_changed` | name, link | PASSWORD_RESET_CONFIRM |
| `career9_account_activated` | name, link | ACCOUNT_ACTIVATED |
| `counselling_cancelled` | name, date+time, link | every cancellation |
| `counselling_rescheduled` | name, new date+time, link | reschedule, session shifted |
| `counselling_pick_new_slot` | name, date+time, link | self-reschedule, counsellor deactivated |
| `counselling_counsellor_changed` | name, date+time, counsellor, link | counsellor swapped |
| `counselling_session_assigned` | counsellor, date+time, student, link | assigned to counsellor |
| `counselling_checkin_pending` | name, date+time, link | check-in prompts |
| `counselling_marked_absent` | name, date+time, link | marked absent |
| `counselling_session_completed` | name, date+time, portal link | session complete |
| `counselling_booking_invite` | name, link | admin booking invite |

Session summaries and "counsellor confirmed" now reuse `counselling_confirmation` (5 params).
Everything else (internal alerts, dispute outcome, school/B2B mails) stays on the generic.
