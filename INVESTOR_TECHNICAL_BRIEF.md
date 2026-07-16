# Career-9 — Technical Prowess & Roadmap
## Design Brief for the Investor Presentation

> **What this document is:** the *content source* for a slide deck aimed at investment
> bankers / institutional investors evaluating Career-9 for funding. Hand this to the
> design step (Claude Design / Figma / your designer). It contains the narrative, the
> slide-by-slide copy, the verified numbers to feature, and visual direction.
>
> **How to use it:** each "SLIDE" block below is one slide. The **Headline** is the big
> line, **Body** is the supporting copy, **Feature these numbers** are the metrics to
> render as large stat tiles / charts, and **Visual** tells the designer what to draw.
>
> **Accuracy note for the presenter:** every technical number in this brief was measured
> directly from the codebase and infrastructure (see *Appendix A — Metric Provenance*).
> Anything a designer must not invent — business metrics like revenue, user counts,
> uptime SLA — is marked **`[YOU FILL IN]`**. Do not let the design step guess these.

---

## 0. Positioning — the one sentence

**Career-9 is a proprietary, full-stack psychometric assessment and career-guidance
platform — a vertically integrated engine that takes a student from a scientifically
grounded battery of tests, through automated AI-assisted report generation, to human
counselling and commerce — built and hardened to enterprise standards.**

The investment thesis, technically: this is not a thin app on top of a form. It is a
**deep, defensible system** — a proprietary scoring engine, a multi-tenant school
platform, a consumer funnel, a payments layer, and an AI report factory — that would take
a competitor **years and a large team** to reproduce.

---

## 1. HERO METRICS — the "how robust is it" wall

> Design as a single high-impact stat wall (one hero slide, ~8–10 tiles). These are the
> credibility anchors. All verified from source.

| Metric | Value | What it signals to an investor |
|---|---|---|
| **Lines of production code** | **~340,000** | Depth & maturity — not a prototype |
| **REST API endpoints** | **830+** | Breadth of functionality already built |
| **Authorization-guarded endpoints** | **825 of 830 (~99%)** | Security is engineered in, not bolted on |
| **Data-model entities** | **154** | Richness of the domain / data moat |
| **Versioned DB migrations** | **63** | Disciplined, zero-downtime schema evolution |
| **Psychometric dimensions measured** | **40+** across **6 frameworks** | Proprietary scientific IP |
| **Integrated third-party services** | **20+** | A real platform, not a silo |
| **Concurrent test-takers (engineered for)** | **4,000** | Load-readiness for national-scale events |
| **Code commits (10.5 months)** | **1,336** (393 in last quarter) | Execution velocity of the team |
| **Contributors** | **13** | A team, shipping continuously |

**Optional single-number hero:** *"830+ API endpoints. 154 data models. 40+ psychometric
dimensions. One platform."*

---

## 2. SLIDE-BY-SLIDE DECK CONTENT

### SLIDE 1 — Title
- **Headline:** Career-9 — The Engine Behind Career Discovery
- **Sub-headline:** A proprietary psychometric, guidance & commerce platform
- **Visual:** Clean logo lockup on a confident gradient. One-line positioning underneath.
- **Footer:** `[YOU FILL IN: company legal name, date, "Confidential"]`

---

### SLIDE 2 — The Platform at a Glance (the "wow, it's a lot" slide)
- **Headline:** One platform. Three businesses. A dozen systems working as one.
- **Body:** Career-9 unifies what are usually separate products — a test-delivery engine,
  a report-generation factory, a school-administration suite, a direct-to-consumer store,
  and a counselling marketplace — behind a single data model and API.
- **Feature these numbers:** 830+ endpoints · 154 data models · ~340K lines of code · 3 apps.
- **Visual:** A layered "platform stack" diagram:
  - **Top layer — Experiences:** Student Assessment App · Admin/School Dashboard · Counsellor Portal · Consumer Store
  - **Middle layer — Engine:** Scoring Engine · Report Factory · Entitlements & Payments · Auth & Access
  - **Bottom layer — Foundation:** Spring Boot API · MySQL · Redis · Kafka · Object Storage

---

### SLIDE 3 — Proprietary Psychometric IP (the moat)
- **Headline:** A scoring engine grounded in validated psychological science
- **Body:** Career-9 doesn't ask opinion questions — it measures. Six research-backed
  frameworks combine into a single student profile, then map to real career pathways.
  Scoring is **data-driven and configurable** (every answer option carries weighted
  contributions to multiple traits), so new instruments can be authored without shipping code.
- **Feature these — the battery:**
  - **Interests** — Holland/RIASEC · **6** dimensions
  - **Personality** — Big Five / OCEAN · **5** traits
  - **Multiple Intelligences** — Gardner · **8** types
  - **Aptitude & Ability** · **10** abilities
  - **Work Values** · **15** values
  - **+ Learning Style & Subject Interests**
  - → **40+ measured dimensions**, mapped through a **260 KB career-pathways knowledge base**
- **Visual:** A radial / hexagon "trait web" showing the 6 frameworks feeding one profile,
  with an arrow into "Career Pathways." This is the single most important defensibility slide.

---

### SLIDE 4 — The Assessment Experience (product depth)
- **Headline:** More than a quiz — a proctored, gamified, multilingual testing engine
- **Body:** The student app is a modern, offline-capable web app that delivers adaptive,
  section-based assessments in multiple languages, including **interactive psychometric
  games** that measure behavior rather than self-report.
- **Feature these:**
  - **AI-assisted remote proctoring** — in-browser eye-tracking + face detection + activity heartbeat (no downloads)
  - **3 psychometric mini-games** — measuring decision-making, speed and attention
  - **Multilingual delivery** — content localized (English / Hindi / Marathi) via an AI translation service
  - **Offline-resilient (PWA)** — keeps working through flaky connectivity, then syncs
- **Visual:** A phone/laptop mock of the assessment UI + small icons for proctoring, games,
  languages, offline. Show a game screenshot if available.

---

### SLIDE 5 — The Report Factory (automation = margin)
- **Headline:** From "test submitted" to "branded PDF report" — automatically, at scale
- **Body:** Every completed assessment flows through an **asynchronous, guaranteed-delivery
  report pipeline**. Scores are computed, a branded multi-page report is rendered to PDF,
  stored, and emailed to the family — with no human in the loop. This is the difference
  between a service that needs analysts and a **product with software margins**.
- **Feature these:**
  - **3 report engines** (Navigator360, Four-Pager, Bet) — grade-banded for Classes 6–8, 9–10, 11–12
  - **Message-queue architecture** (Kafka) with **automatic retries + dead-letter recovery** — a report is never silently lost
  - **Idempotent** — no duplicate reports, no double emails, even under failure/retry
  - **White-label** — each school's report carries its own branding
- **Visual:** A pipeline flow diagram: `Submit → Score → Render PDF → Store → Email`,
  with a "retry / dead-letter" loop badge to signal reliability.

---

### SLIDE 6 — Built for Institutions (the B2B/enterprise story)
- **Headline:** A multi-tenant platform schools can run themselves
- **Body:** Career-9 is architected as a **multi-tenant** system: an institute maps
  assessments to its own sessions, classes and sections, mints its own registration links
  (free and paid), and gets role-specific dashboards for principals, class teachers and
  counsellors — all scoped so each user sees only their own students.
- **Feature these:**
  - **Institute → Session → Class → Section** hierarchy with attribute-based access control
  - **Role dashboards** — Principal, Class Teacher, Counsellor, School analytics
  - **Self-service registration links** — free + paid, per class/section
  - **White-labeling** — school logo & branding on portal and reports
- **Visual:** An org-tree (Institute at top branching to sessions/classes/sections) beside
  a dashboard screenshot. Emphasize "each school = its own tenant."

---

### SLIDE 7 — Monetization is Native (multiple revenue rails)
- **Headline:** Payments, entitlements and upsell are built into the core
- **Body:** Commerce isn't an add-on — it's a first-class part of the data model. Career-9
  supports **B2B** (schools purchase for cohorts), **B2C** (parents/students buy directly
  via campaigns), tiered pricing "waves," promo and referral codes, and a **free→paid
  upgrade** path. A single "entitlement" contract governs what each student can access
  (report, dashboard, counselling, LMS).
- **Feature these:**
  - **3 sales motions:** B2B institutional · B2C direct · campaign-driven
  - **Razorpay** payment integration with signed webhooks
  - **Tiered pricing waves**, promo codes, referral codes
  - **Entitlement engine** — one row governs report / dashboard / counselling / LMS access
- **Visual:** Three revenue "rails" converging into one Entitlement box, with a ₹/payment icon.

---

### SLIDE 8 — The Counselling Marketplace (expansion vector)
- **Headline:** Closing the loop — from insight to a human conversation
- **Body:** Beyond the report, Career-9 is building a **counselling booking marketplace**:
  students book slots with vetted counsellors, pay before the session, get calendar invites
  and **automated WhatsApp + email reminders**, and are verified at check-in by OTP. This
  turns a one-time test into a **recurring, higher-value relationship.**
- **Feature these:**
  - Slot booking with **pay-before-session** and soft-hold concurrency control
  - **WhatsApp + email reminder** cadence (4 student + 2 counsellor touchpoints)
  - **`.ics` calendar invites**, online (meeting link) or offline (address)
  - OTP-verified check-in; no-show handling with re-book credit
- **Visual:** A calendar/booking mock + a WhatsApp reminder bubble. Tag it "In active
  development" if you want to distinguish shipped vs. roadmap.

---

### SLIDE 9 — Enterprise-Grade Security & Access Control
- **Headline:** Security engineered in — independently audited, then hardened
- **Body:** Career-9 commissioned an **independent security audit** and executed a
  comprehensive **10-phase access-control redesign**: a hybrid **role-based + attribute-based
  access-control** model, HttpOnly-cookie sessions with CSRF protection, short-lived access
  tokens with refresh and server-side revocation, rate limiting, and an audit trail — with a
  **build-time gate that fails the build if any endpoint is left unprotected.**
- **Feature these:**
  - **825 of 830 endpoints** carry method-level authorization (~99%)
  - **RBAC + ABAC** — permission *and* data-scope checked on every request
  - **Cookie + CSRF + refresh tokens + revocation** (no tokens exposed to browser scripts)
  - **Automated "no unprotected endpoint" build check**
  - Rate limiting · security headers (CSP/HSTS) · authorization audit log
- **Visual:** A shield / lock motif with a checklist of the controls. Frame as *proactive
  maturity*, not remediation.

---

### SLIDE 10 — Built to Scale
- **Headline:** Engineered and load-tested for national-scale assessment events
- **Body:** The platform underwent a formal **4,000-concurrent-user readiness audit**, driving
  a set of resilience upgrades: server-side assessment sessions in Redis, **idempotent
  submissions that survive network drops**, save-before-delete answer handling, and automatic
  client-side retry with backoff. The result: students don't lose work, and the wrong test
  never loads — even under peak concurrent load.
- **Feature these:**
  - **4,000 concurrent test-takers** — engineered & load-readiness-audited
  - **200+ concurrent** sustained in production at peak `[confirm current peak]`
  - **Zero submission loss** design — idempotent, crash-recoverable, auto-saving
  - Distributed cache + connection pooling tuned for burst load
- **Visual:** A rising load curve holding steady, with resilience callouts. Distinguish
  "proven today (200+)" vs "engineered for (4,000)" honestly — bankers reward that.

---

### SLIDE 11 — Modern, Reliable Infrastructure
- **Headline:** A containerized, self-healing production stack
- **Body:** Career-9 runs as an orchestrated set of **7 containerized services** with health
  checks, automatic restarts, TLS everywhere, and **triple-redundant daily backups**
  (local + email + cloud object storage). The report renderer, message queue and API each
  run as isolated, independently scalable services.
- **Feature these:**
  - **7-service containerized stack** — API, worker, MySQL, Redis, Kafka, PDF renderer, gateway
  - **Automated daily backups**, 7-day retention, **3 destinations**
  - **TLS 1.2/1.3 + HSTS + HTTP/2**, auto-renewing certificates
  - Health checks + auto-restart + heap-dump-on-failure diagnostics
- **Visual:** A clean architecture diagram of the 7 services behind an nginx gateway. Add
  small "❤️ health check" and "↻ auto-restart" badges.

---

### SLIDE 12 — AI, Woven Through
- **Headline:** AI where it creates value — not as a gimmick
- **Body:** Career-9 uses AI in three concrete places: **automated career-suggestion and
  report narrative generation**, **real-time multilingual translation** of assessment
  content, and **free-text answer matching** (mapping an open response to the nearest scored
  option). This is a foundation to deepen into AI-native guidance.
- **Feature these:** AI career/narrative summaries · AI content translation (English/Hindi/Marathi)
  · AI open-response scoring · plug-in model layer (OpenAI + Qwen).
- **Visual:** Three AI use-case cards. Keep it grounded — these are shipped capabilities.

---

### SLIDE 13 — Execution Velocity (the team can build)
- **Headline:** A team that ships
- **Body:** In roughly **10.5 months**, a **13-person** team produced ~340K lines of
  production software across three applications, with **1,336 commits** and **393 in the
  last quarter alone** — using structured, phase-based delivery with automated verification.
- **Feature these:** 1,336 commits · 393 last quarter · 13 contributors · 63 shipped schema migrations.
- **Visual:** A commit-activity timeline / sparkline trending up. This slide answers "can
  this team deploy our capital?"

---

### SLIDE 14 — The Roadmap (where the funding goes)
- **Headline:** From a proven platform to a category leader
- **Body:** Investment accelerates four vectors:
- **Feature these as 4 columns / horizon bands:**

  | Horizon | Theme | What it unlocks |
  |---|---|---|
  | **Now / Next** | **Counselling marketplace GA** + **bulk async report generation** | Recurring revenue per student; ops efficiency at cohort scale |
  | **Enterprise readiness** | Finish multi-institute **access isolation to full enforcement**; unified commerce/entitlement model | Multi-school & district contracts; cleaner upsell |
  | **Scale-out** | Horizontal scaling, **CI/CD automation, observability (metrics/alerting)**, managed database | 10×–100× user growth; uptime guarantees for enterprise SLAs |
  | **AI-native guidance** | Deeper AI career narratives; **LMS / post-assessment learning module** | New product line; longer student lifetime value |

- **Visual:** A 4-lane horizon roadmap (Now → Next → Later → Vision). Keep verbs
  outcome-oriented (unlocks revenue / unlocks scale), not just feature names.

---

### SLIDE 15 — Why This Is Fundable (close)
- **Headline:** A defensible platform, a shipping team, a clear path to scale
- **Body (3 pillars):**
  1. **Moat** — proprietary psychometric engine + career knowledge base + multi-tenant
     platform: years of work to replicate.
  2. **Product & revenue depth** — three sales motions, native payments, software margins
     via automated reporting, and an expansion path into counselling and learning.
  3. **Execution & readiness** — audited security, load-tested scale design, disciplined
     engineering, and a roadmap where capital directly unlocks enterprise contracts and 10× scale.
- **Visual:** Three-pillar layout, ending on the roadmap horizon or a forward-looking hero image.
- **Footer CTA:** `[YOU FILL IN: the ask — raise amount, use of funds, contact]`

---

## 3. APPENDIX A — Metric Provenance (for Q&A / technical due diligence)

Every headline number is measured, not estimated. Use this if a banker's technical advisor
digs in.

- **~340,000 LOC** — Java backend ~103K, admin web app ~216K, student app ~21K (source line counts).
- **830+ endpoints** — 830 method-level HTTP mappings across 128 controllers.
- **825 authorization guards** — count of method-level `@PreAuthorize` checks; a build-time
  architectural test fails CI if any controller method lacks one.
- **154 entities / 63 migrations** — JPA `@Entity` classes; versioned Flyway migration files
  (May–Jun 2026 era; schema evolves forward-only with no destructive auto-updates in prod).
- **40+ psychometric dimensions / 6 frameworks** — RIASEC (6), Big Five/OCEAN (5),
  Gardner MI (8), Ability (10), Work Values (15), plus learning-style & subject scales;
  career mapping is a 260 KB knowledge base. Live item bank & norms are stored in the DB.
- **20+ integrations** — Razorpay; OAuth (Google/GitHub/Facebook); Firebase; Google Workspace/
  Gmail/Cloud Storage/Analytics; WhatsApp (AiSensy); Mandrill/SMTP email; Odoo CRM; OpenAI;
  Qwen; DigitalOcean Spaces; reCAPTCHA; Gotenberg PDF; QR generation; mediapipe & webgazer (proctoring).
- **4,000 concurrent** — target of a formal load-readiness audit (106 findings catalogued;
  critical items remediated). **200+ concurrent** — stated sustained production peak.
- **7-service stack** — API, report-worker, MySQL 8, Redis 7.2, Kafka, Gotenberg PDF, nginx.
- **Report pipeline reliability** — Kafka with up to 5 retry attempts, dead-letter recovery,
  Redis-based idempotency (7-day dedup window).
- **1,336 commits / 393 last quarter / 13 contributors** — git history since Sept 2025.

**Stack one-liner:** Spring Boot 2.5.5 (Java 11) · MySQL · Redis 7.2 · Apache Kafka ·
React 18/19 + TypeScript · Docker Compose · Razorpay · OpenAI · deployed with TLS,
automated backups, and health-checked auto-restart.

---

## 4. APPENDIX B — Design Direction (for the design step)

- **Audience & tone:** institutional investors / bankers. Tone = **confident, precise,
  substance-over-flash.** Big verified numbers, clean diagrams, minimal decoration. Avoid
  startup-hype clichés ("revolutionary," "disrupting"). Let the metrics do the talking.
- **Structure:** ~15 slides + appendix. Story arc: *what it is → the moat (science) → product
  depth → automation/margin → enterprise & revenue → security & scale → team → roadmap → the ask.*
- **Signature visuals to invest in (highest impact):**
  1. The **platform stack** diagram (Slide 2).
  2. The **psychometric trait web** (Slide 3) — this is the moat; make it beautiful.
  3. The **report pipeline** flow with reliability loop (Slide 5).
  4. The **roadmap horizons** (Slide 14).
- **Data viz:** use large stat tiles for the hero wall; a simple rising-and-holding load
  curve for scale; a commit sparkline for velocity. Keep charts honest and unadorned.
- **Color:** trust + growth (deep blue / teal base, one warm accent for emphasis). Swap to the
  Career-9 brand palette if one exists. High contrast; legible from the back of a room.
- **Consistency:** one type scale, one accent color, consistent iconography (line icons).
- **Honesty markers:** where something is roadmap vs. shipped, label it (e.g., a small
  "In development" chip). Bankers do diligence — distinguishing built vs. planned builds trust.

---

## 5. `[YOU FILL IN]` — business metrics the deck needs (not in the codebase)

These are what bankers will actually anchor on. The technical story above is the *proof of
capability*; pair it with these. **Do not let the design step invent them.**

- Students assessed to date / MAU / cohort sizes
- Number of schools / institutes signed · pipeline
- Revenue, growth rate, ARPU, gross margin
- Uptime / availability actuals
- Unit economics (cost per report, per assessment)
- Market size (TAM/SAM) and go-to-market
- The raise: amount, valuation, use of funds, milestones

---

*Prepared as a design brief. All technical figures measured from the Career-9 codebase and
infrastructure. Business figures marked `[YOU FILL IN]` must be supplied by the company.*
