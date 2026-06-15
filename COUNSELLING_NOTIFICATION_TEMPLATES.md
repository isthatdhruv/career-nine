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
Career-Nine Team
```

---

## 2. Session reminder (student & counsellor)

- **AiSensy campaign name:** `counselling_reminder`
  (override via `AISENSY_COUNSELLING_REMINDER_CAMPAIGN`)
- **Meta category:** UTILITY
- **Parameters (in order):**
  - `{{1}}` — name (student or counsellor)
  - `{{2}}` — when label (e.g. `in 12 hours`)
  - `{{3}}` — date + time + how-to-attend (e.g. `June 17, 2026 3:00 PM — Join online: <link>`)

**WhatsApp template body:**

```
Hi {{1}}, a reminder: your Career-9 counselling session is {{2}}.

🗓 {{3}}

See you soon!
```

---

## 3. Check-in OTP

- **AiSensy campaign name:** `counselling_otp`
  (override via `AISENSY_COUNSELLING_OTP_CAMPAIGN`)
- **Meta category:** AUTHENTICATION (or UTILITY if AUTH is unavailable)
- **Parameters (in order):**
  - `{{1}}` — student name
  - `{{2}}` — OTP code

**WhatsApp template body:**

```
Hi {{1}}, your Career-9 counselling check-in code is {{2}}.

Share it with your counsellor to start your session. It expires in 15 minutes.
```

---

## 4. Booking nudge / no-show ("you still have a session to book")

- **AiSensy campaign name:** `counselling_booking_nudge`
  (override via `AISENSY_COUNSELLING_NUDGE_CAMPAIGN`)
- **Meta category:** UTILITY
- **Parameters (in order):**
  - `{{1}}` — student name
  - `{{2}}` — sessions remaining (count)

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

**WhatsApp template body:**

```
Hi {{1}}, you have {{3}} counselling session(s) scheduled for {{2}}. Check
your email for the full list. Please be available on time.
```

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
