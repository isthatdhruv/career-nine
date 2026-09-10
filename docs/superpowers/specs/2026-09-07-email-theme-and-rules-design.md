# Email theme and rules — design

**Date:** 2026-09-07 · **Status:** approved content, implementation pending · **Scope:** spring-social, react-social (admin template editor only)

The platform sends 70 distinct emails across five visual dialects. Fifteen print raw URLs, seven hardcode production hosts, sixteen use gradients Outlook drops, thirty-three have no preheader, and five are plain text. This design introduces one theme layer that every mail renders through, a fixed rule set enforced by the build, and rewrites every mail onto it. The approved before/after content lives in the catalogue artifact (`https://claude.ai/code/artifact/ca5bdbaa-c8d1-451a-bbfa-d03e9ebed256`); its specs are the source of truth for copy and structure and are mirrored in `scratchpad/mail_specs.py` at implementation time.

## 1. Decisions already made

| Decision | Value |
|---|---|
| Shell | A3: grey ground `#EEF1EF`, 560px white card, 6px corners, 8px `#1B5E20` strip, white logo row (logo 127×48 left, "Help: support@…" right), body padding 28px, footer below the card in 12px faint text |
| Colour | primary `#1B5E20` (strip, buttons, links); accent `#66BB6A` (notice rule only); ink `#1F2A24`, muted `#5C6B62`, faint `#8A9790`, hairline `#DDE3DF`, panel `#F3F6F4` |
| Type | `'Segoe UI',Roboto,Helvetica,Arial,sans-serif`; codes `Consolas,'Courier New',monospace`; title 20px, body 15px, note 13px, footer 12px |
| Logo | PNG at 2× (254×96) on the Spaces CDN under a versioned name, referenced by `app.mail.logo-url`; never a data URI, never SVG/WebP |
| Footer | `Career-9 · Ensuring Career Success` / `Questions? Write to {support}` / `© {year} Career-9. All rights reserved. · {site}` |
| Whitelabel | same shell; school logo 36px + name + "Powered by Career-9" replace the logo row; footer line 1 becomes `Sent by Career-9 on behalf of {school}` |
| Emoji | kept in the six mails that have them today, as entities; none in subjects/preheaders; none added |
| Retired | 4 dead counselling mails, both 1-pager mails, the second report mail (merged into Report ready) → 63 live mails |

## 2. The rules (what the build enforces)

1. No long link ever appears as visible text. Links are buttons or labelled links; any URL over 60 characters or carrying a token is shortened; the "Or open:" line shows the short form only.
2. No hardcoded hosts. URLs come from `LinkBuilder` or config.
3. One shell. Every mail renders in it, including admin-edited templates, admin-composed mails and reminder_config bodies; the dispatcher wraps anything that arrives without it.
4. Tables and inline styles only. No gradients, shadows, web fonts, `<style>`, or images other than logos.
5. At most one primary button, at most one outline secondary. Labels are verb phrases.
6. Preheader on every mail, ≤ 90 characters.
7. Plain-text part on every mail, generated from the same blocks.
8. Fixed voice: "Hi {first name}," or "Hello,"; sentence-case subject and title ≤ 60 characters, no exclamation marks; sign-off "Regards, Career-9 Team"; bodies never mention replying or not replying.
9. Credentials only in the credentials panel, never in subject or preheader.
10. Blocks escape; callers never build HTML strings.
11. Whitelabel is the shell's job; callers pass the institute.
12. Internal mails use the shell with an Internal tag, a facts table, one button to the admin page.
13. Dead code goes; text-only mails are converted.
14. Enforced by the build (§7).

## 3. Architecture

New package `com.kccitm.api.service.email.theme`:

```
theme/
  MailTheme          tokens (colours, fonts, sizes) as constants
  Mail               immutable value: subject, preheader, List<Block>, cta count helpers
  Mail.Builder       title() p() small() details() credentials() code() action() outline()
                     links() notice() list() steps() table() internal() signature() build()
  Block              sealed-style hierarchy (one class per block kind); each renders html(ctx) and text(ctx)
  MailRenderer       @Service: Rendered render(Mail, Brand) → html (shell + blocks) and text
  MailShell          shell markup: standard and whitelabel variants, preheader div, footer
  Brand              logoUrl / schoolName / whitelabel + support email, site URL, year (built by BrandResolver)
  BrandResolver      @Service: Brand for(InstituteDetail | instituteCode | userStudentId) via InstituteBrandingService + config
  MailLink           value: href + display + shortened flag; MailLinks.of(url) applies the policy via ShortLinkService
  MailHtml           esc(), escAttr(), entity helpers (package-private)
```

- `Mail` is pure data and `Block.html/text` are pure functions, so every mail can be rendered in a unit test without Spring. Services build a `Mail` and hand it to `EmailDispatchService`.
- `EmailSendRequest` gains `Mail mail` and `Brand brand` (optional). When `mail` is set, the dispatcher renders it (`MailRenderer`) into `htmlContent`/`textContent` and uses `mail.subject()` unless a DB template overrides.
- `MailLinks.of(url)`: if `url.length() > 60` or it matches `[?&](t|token|e)=`, mint a short code via `ShortLinkService.codeFor` and display `api.host/s/{code}`; otherwise display the URL without scheme. Shortening never throws; on failure the full URL is used and the rule test still passes because the display string is derived, not authored. Hardcoded production hosts are a build failure (§7).

### Dispatcher wrap

`EmailDispatchService.buildMessage` gets one new step: if the outgoing HTML does not contain the shell marker (`data-c9-shell="a3"` on the outer table), wrap it with `MailShell.wrapForeign(html, brand)`, which puts the foreign HTML into the card body, adds preheader (first 90 chars of visible text), footer, and a generated text part (tag-stripped). This covers: DB `email_template` bodies, `reminder_config` bodies, admin-composed contact-person mails, the leads export and generic attachment sends, and the template test. Foreign HTML also passes through `MailLinks.rewrite(html)`, which shortens every `href` over 60 characters and replaces visible long URLs with the short form.

### Placeholders and admin templates

- `EmailPlaceholder.EMAIL_HEADER` / `EMAIL_FOOTER` are removed from every type's palette and resolve to `""` for existing templates (the shell provides both). `PlaceholderResolver` keeps `school_name`, `logo_url`, `dashboard_link`.
- `EmailTemplateService.preview` renders through the wrap so the editor shows the real shell.
- `EmailTemplateSeeder` seeds the new bodies (LOGIN_CREDENTIALS, LEAD_NOTIFICATION, LEAD_WELCOME) built from the theme (`Mail` rendered to body-only HTML with `{{tokens}}`).
- `MailSeedUpgrader` (an `ApplicationRunner` after the seeder) replaces the three seeded `email_template` bodies and the four `reminder_config` bodies **only where the row still equals the old seed** (trimmed string equality against constants kept in `LegacySeeds`). Edited rows are left alone and get the shell from the dispatcher wrap. No Flyway migration.
- `react-social` `EmailTemplateEditorModal`: no code change needed beyond the palette shrinking (it reads the catalog endpoint); the preview iframe already shows server-rendered HTML.

### Whitelabel

`BrandResolver` wraps `InstituteBrandingService.forInstitute/forInstituteCode/forUserStudent` and adds config values. `InstituteBrandingService.emailHeaderHtml/emailFooterHtml` are deleted once no caller remains.

### Configuration

```
app.mail.logo-url:      ${APP_MAIL_LOGO_URL:https://storage-c9.sgp1.cdn.digitaloceanspaces.com/branding/career-9-email-v1.png}
app.mail.site-url:      https://career-9.com
app.support.email:      support@career-9.net   (exists)
app.shortLinks.enabled: true                   (exists)
```

## 4. Mail inventory after the rewrite

Builders move out of controllers into per-module `*Mails` classes that return `Mail`:

| Module | Class | Mails |
|---|---|---|
| Auth & accounts | `AccountMails` | login credentials, registration success (one builder, two triggers), account welcome, password reset link, password reset confirm, admin password reset, account activated |
| Payments | `PaymentMails` | payment received (credentials), welcome resend (credentials + magic link when an entitlement exists, else sign-in), failed/expired/cancelled (one builder, variant in subject and first line), pending nudge, payment link |
| Reports | `ReportMails` | assessment completion, report ready (pipeline + admin resend + pipeline-disabled path), counsellor report ready, booked-session report ready, counsellor report release, contact-person reports ZIP, school dashboard ready |
| B2C | `EntitlementMails` | welcome (magic link + credentials), assessment link resend/nudge, dashboard access, learning access, counselling booking link |
| Counselling | `CounsellingMails` | 24 live counselling mails (`CounsellingEmailHtml` is deleted; `greenPage` family deleted) |
| Leads & internal | `LeadMails`, `InternalMails` | lead alert, lead welcome, counsellor deactivated alert, counselling request forwarded, account test |
| Reminders | `ReminderMails` | seeds for the four reminder_config rows |

Retired: `sendBookingReceivedEmail`, `sendCounsellorLeaveCancellationEmail`, `sendBlockDateRequestEmail`, `notifyStudentNoShow`, the `one_pager` resend case and the one-pager completion send, `EntitlementService.simpleHtml`, `welcomeEmailHtml`, `ReportEmailComposer` (replaced by `ReportMails.reportReady`), the `final_report` resend path's own body.

### Behaviour changes bundled with the rewrite

- `account-activated` sends only on activation.
- `counselling-reminder-fallback` uses the offset label once ("in 12 hours", not "in in 12 hours").
- B2C nudges are logged as `nudge`, so the 2-nudge cap works.
- The 10:30 booking-nudge run sends one mail per student, not two.
- Student cancellation confirmation always carries a text part, .ics or not.
- Counsellor-deactivated admin alert is logged under `COUNSELLOR_DEACTIVATED_ALERT`.
- `reminder-assessment-mapping` passes the real assessment name and the sign-in link (today `Assessment #id` and an empty link).
- Registration-success mails escape their values.

Not in scope (phase 2): idempotency of automatic report mails on retries/re-queues; WhatsApp templates; the assessment app's thank-you page still showing the 1-pager.

## 5. Data flow

```
Service → XxxMails.build(dto…) → Mail            (pure)
        → EmailSendRequest{type, to, mail, brand hint, attachments}
        → EmailDispatchService.send
             resolveAccount, resolveTemplate
             buildMessage: template ? render(template, ctx) → wrapForeign
                                    : MailRenderer.render(mail, brand)   (html + text)
             MailLinks.rewrite on foreign html
             log, send (sync/async)
```

`GmailReportEmailSender` (report-worker) keeps its own sending but calls `MailRenderer` for the body and `MailShell.wrapForeign` for template overrides, so the pipeline mail is identical to the dispatcher path.

## 6. Error handling

- Short-link minting is best-effort (existing contract); a failure yields the long URL in the href and a display of the host + path, never the token.
- `MailRenderer` never throws on null values: null text renders as empty, null rows are skipped, a null URL drops the block and logs a warning (a mail must not fail because a link was missing; the rule test catches it at build time instead).
- `wrapForeign` on unparseable HTML falls back to escaping the content as text inside the card.

## 7. Testing

- `MailMarkupArchTest` (ArchUnit, next to `EmailDispatchRoutingTest`): outside `service.email.theme`, no class's string constants may contain `<html`, `<table`, `<div style`, `linear-gradient`, `assessment.career-9.com`, `dashboard.career-9.com`, or `api.career-9.com`. Allowed list: the theme package, `ShortLinkController.expiredPage`, `EmailTemplateSeeder` (bodies come from the theme).
- `MailCatalogueTest` (JUnit, no Spring): a `MailSamples` class builds every live mail with sample DTOs; for each: exactly one preheader ≤ 90 chars, subject ≤ 60 chars without `!`, ≤ 1 primary and ≤ 1 outline button, no `http` substring in the text part except short links and plain-page URLs, text part non-empty, HTML contains the shell marker, no `{{` left unresolved. It also writes `target/mail-samples/{id}.html` so the catalogue can be regenerated from Java.
- `MailLinksTest`: shorten policy boundaries (60 chars, token query), failure fallback.
- `EmailDispatchWrapTest`: a foreign HTML body is wrapped once; an already-shelled body is not wrapped twice; long hrefs are rewritten.
- Existing `EmailDispatchRoutingTest` unchanged.

## 8. Rollout

1. Theme layer + dispatcher wrap + tests (no caller changes yet; all mails already gain the shell via wrap).
2. Module rewrites in this order: auth/accounts, payments, reports, B2C, counselling, leads/internal, reminders. Each module compiles and passes `MailCatalogueTest` before the next.
3. Retirements and behaviour fixes.
4. Migration for seeds; placeholder palette change; seeder update.
5. Upload `career-9-email-v1.png` to the CDN; set `APP_MAIL_LOGO_URL` per environment; restart backend; send one mail per module through the admin test surface.
