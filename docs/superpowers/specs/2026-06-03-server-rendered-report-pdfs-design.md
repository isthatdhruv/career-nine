# Server-Rendered Report PDFs — Design

**Date:** 2026-06-03
**Status:** Approved (pending final spec review)

## Problem

The admin **Reports Hub** "Download" button currently converts a report's HTML to PDF
**client-side** using `html2canvas` + `jsPDF`
([htmlToPdf.ts](../../../react-social/src/app/pages/ReportGeneration/utils/htmlToPdf.ts),
[GenerateReportsModal.tsx](../../../react-social/src/app/pages/ReportsHub/components/GenerateReportsModal.tsx)).
This approach is **rasterized and inconsistent across browsers/devices**: it screenshots the
DOM into a canvas, so output depends on device DPI, browser canvas behavior, locally available
fonts, and CORS. Quality and layout differ per user, and the PDF text is not selectable.

We want PDFs that are **identical for every user** and faithful to the report design.

## Key findings that constrain the solution

1. **The report templates require a real browser engine.** Inspection of the live templates on
   DigitalOcean Spaces shows heavy use of modern CSS:

   | Template | Flexbox | Grid | CSS vars | @font-face | gradients | multi-page |
   |---|---|---|---|---|---|---|
   | pager/insight | 11× | 3× | – | 2× | 5× | yes (`.page`) |
   | pager/career | 11× | 3× | – | 2× | 5× | yes |
   | legacy/insight | 80× | – | 9× | – | 45× | yes |
   | bet/default | 40× | – | 17× | 2× | 4× | yes |

   The existing Java renderers (**OpenHTMLtoPDF** in
   [ReportTemplateController.htmlToPdf](../../../spring-social/src/main/java/com/kccitm/api/controller/career9/ReportTemplateController.java),
   **Flying Saucer** in `PdfServiceImpl`) support only CSS 2.1 + partial CSS3 — **no Flexbox,
   no Grid**. They would render these templates as broken, collapsed layouts. This is why the
   original developer screenshotted the browser instead of using the existing server PDF endpoint.

2. **Consistency requires a single fixed rendering engine** — not each user's browser. The only
   engine that renders these templates faithfully is **Chromium**.

3. **Client-side Chromium-equivalent options were eliminated:** WeasyPrint cannot run in-browser
   (native Pango/Cairo deps, no WASM wheels); `@react-pdf/renderer`/Typst would require rebuilding
   every template and break the "upload an HTML template directly" feature.

4. **Templates render some charts client-side via JS.**
   [ReportService](../../../spring-social/src/main/java/com/kccitm/api/service/b2c/report/ReportService.java)
   embeds a `chartDataJson` blob in `<script type="application/json">` for templates to draw
   per-student charts in the browser. The renderer must therefore **execute JS and wait for charts
   to settle** before capturing the PDF.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Where to render | **Server-side Chromium** | Only engine faithful to the templates; one engine ⇒ consistent for all users. |
| D2 | Which renderer | **Gotenberg** (self-hosted Docker, wraps headless Chromium) | No Node lifecycle to manage; one HTTP call. Self-hosted because reports contain **minors' assessment data** — it must never leave our infra (rules out managed PDF APIs). |
| D3 | When to render | **Eager at generation time**, but **asynchronously** | The PDF is produced as part of generating a report (end state: HTML **and** PDF both stored on Spaces), but rendering is decoupled from the request so bulk generation pays no toll. |
| D4 | Async dispatch + tracking | **DB-backed job queue** drained by a scheduled poller | Durable (survives restarts, auto-retry), per-report queryable tracking, no message broker, multi-instance safe via row-locking, and extractable to a standalone worker microservice later with zero logic change. |
| D5 | Download UX | Reports Hub downloads the **stored PDF directly from Spaces** (CDN link); also offers **download of the HTML** version | Instant download, zero client compute, consistent. |
| D6 | Bulk ZIP | **Client-side JSZip of the stored PDFs** | The PDFs already exist on the CDN; bundling is just fetch + zip. Removes `html2canvas`/`jsPDF` entirely. (A server-side zip endpoint remains a future option.) |

Gotenberg **is** the rendering microservice (it runs Chromium). The Spring backend's per-PDF
cost is only I/O (one HTTP call out + streaming the PDF bytes to Spaces), kept off the request
path and bounded by a global concurrency cap.

## Architecture

### Backend flow

```
Bulk/single generate (HTTP request)
  └─ ReportService.generate()                       [mostly unchanged]
       1–5. compute calc data, fill template
       6.   upload filled HTML → reportUrl          (existing)
       6b.  upsert generated_report:                (CHANGED)
              report_url = reportUrl
              pdf_status = pending, pdf_url = null   (overwrites any prior pdf_url)
       6c.  upsert pdf_render_job (status=PENDING)   (NEW)
       →    return immediately (HTML ready)

Scheduled poller  (off the request path, in-process for now)
  └─ claim N PENDING jobs (FOR UPDATE SKIP LOCKED, N = cap − inFlight)
       for each job:
         mark RENDERING (set lease_until)
         PDF bytes = GotenbergClient.renderUrl(report_url)
         pdf_url   = spacesService.uploadBytes(pdf, "application/pdf", folder, name.pdf)
         update generated_report: pdf_url, pdf_status = READY
         mark job DONE
       on error: attempts++, requeue (PENDING, backoff) until maxAttempts,
                 then FAILED + last_error; generated_report.pdf_status = FAILED
       stale recovery: RENDERING rows past lease_until → reset to PENDING
```

The PDF is written to the **same Spaces folder** as the HTML with the **same deterministic
filename** + `.pdf`. Because the name is deterministic per (student, template), a `force`
regeneration overwrites both HTML and PDF in lockstep — no extra invalidation logic.

### New / changed components

**Backend (spring-social):**
- `GotenbergClient` (new) — `renderUrl(String url): byte[]`. POSTs to Gotenberg
  `/forms/chromium/convert/url` with `printBackground=true`, `preferCssPageSize=true`,
  zero margins, and a wait strategy (`waitDelay` or `waitForExpression`) so client-side charts
  finish before capture. Configured via `app.gotenberg.url`.
- `PdfRenderJob` entity + `pdf_render_job` table (new) — see Data model.
- `PdfRenderJobRepository` (new) — claim query using `FOR UPDATE SKIP LOCKED`, plus
  stale-lease recovery query.
- `PdfRenderWorker` (new) — `@Scheduled` poller; bounded global concurrency; orchestrates
  render → upload → status update; retry/backoff; stale recovery.
- `ReportService.generate()` (changed) — after HTML upload, set `pdf_status = PENDING` and
  enqueue/refresh a `pdf_render_job`; no inline rendering.
- `GeneratedReport` (changed) — add `pdf_url`, `pdf_status` columns + accessors.
- `ReportResult` (changed) — add `pdfUrl`, `pdfStatus`.
- Status endpoint — extend the existing "generated reports for assessment" fetch to include
  `pdfUrl` + `pdfStatus`; add a **re-enqueue (retry)** endpoint for FAILED PDFs.
- Flyway migration `V20260603xxx__generated_report_pdf_and_render_jobs.sql`.

**Infra:**
- Gotenberg container added to docker-compose (internal network only); `app.gotenberg.url`
  config property.

**Frontend (react-social):**
- Report entry types — add `pdfUrl`, `pdfStatus`.
- Reports Hub + Generate Modal:
  - **Download PDF** → direct link to `pdfUrl` when `READY`; badge "PDF rendering…" when
    `PENDING`/`RENDERING`; "PDF failed — retry" when `FAILED` (calls re-enqueue endpoint).
  - **Download HTML** → direct link to `reportUrl` (new).
  - **Preview** → unchanged (opens `reportUrl`).
  - Poll the status endpoint to update PDF badges live (mirrors the existing ZipJob UX).
  - **Bulk ZIP** → fetch `READY` `pdfUrl`s and bundle with JSZip; skip/flag not-ready ones.
- Remove `htmlToPdfBlob` (html2canvas/jsPDF) and its callers in the Generate Modal. Keep JSZip.

## Data model

`generated_report` (add columns):
- `pdf_url VARCHAR(4096)` — Spaces URL of the rendered PDF (null until READY).
- `pdf_status VARCHAR(50) NOT NULL DEFAULT 'notRequested'` —
  `notRequested | pending | rendering | ready | failed`.
  The migration backfills existing rows to `notRequested` (they have HTML but no PDF/job, so they
  must **not** appear as "rendering"). `generate()` flips it to `pending` when it enqueues a job.
  The UI treats `notRequested` as "no PDF yet — regenerate to produce one".

`pdf_render_job` (new table):
- `pdf_render_job_id` PK
- `generated_report_id` FK → `generated_report` (unique: one active job per report)
- `report_url VARCHAR(4096)` — the HTML URL to render
- `status VARCHAR(50)` — `pending | rendering | done | failed`
- `attempts INT DEFAULT 0`, `max_attempts INT DEFAULT 3`
- `last_error TEXT NULL`
- `lease_until TIMESTAMP NULL` — set when claimed; stale rows past this are recovered
- `created_at`, `updated_at`

## Error handling & edge cases

- **Gotenberg unavailable / render error:** the job retries with backoff up to `max_attempts`,
  then `FAILED` with `last_error`; the report's `pdf_status = FAILED`. **Report generation itself
  never fails for a PDF problem** — the HTML is already stored and usable; the UI offers HTML
  download + retry.
- **Regeneration (`force`):** re-fills/overwrites HTML, resets `pdf_status = PENDING`, and
  refreshes the existing job to `PENDING` (no duplicate job; overwrites the same `.pdf` on render).
- **Bulk burst:** generation only enqueues; the poller drains at a bounded global concurrency cap
  so Gotenberg is never overwhelmed.
- **Restart mid-batch:** jobs are durable rows; the poller resumes; `RENDERING` rows past their
  lease are reset to `PENDING`.
- **Multi-instance:** `FOR UPDATE SKIP LOCKED` lets multiple app instances drain the same queue
  without double-processing.
- **Charts not settled:** Gotenberg wait strategy ensures JS-rendered charts are captured.

## Testing

- **Unit:** `GotenbergClient` (mocked HTTP); poller claim/retry/stale-recovery logic;
  `ReportService.generate` sets `pending` + enqueues exactly one job.
- **Integration:** generate ⇒ job row created + `pdf_status=pending`; poller (mock Gotenberg) ⇒
  `pdf_url` set + `READY` + job `DONE`; failure path ⇒ retries then `FAILED`.
- **Frontend:** Download buttons reflect `pdfStatus`; ZIP bundles only `READY` PDFs and flags
  the rest.

## Scope / YAGNI

- **In:** Gotenberg container; DB-backed render queue + in-process poller; `pdf_url`/`pdf_status`
  on `generated_report`; PDF + HTML downloads from Spaces; client-side ZIP of stored PDFs; removal
  of the client-side html2canvas/jsPDF path.
- **Out (future):** message broker / standalone worker microservice (poller is extractable later);
  managed PDF API; server-side ZIP endpoint; PDF lifecycle/TTL expiry.
- **Unchanged:** the existing HTML compute-and-store pipeline; Preview-opens-HTML behavior.

## Migration path to a true microservice (later, only if volume demands)

1. Lift `PdfRenderWorker` into a standalone process pointing at the same `pdf_render_job` table
   (zero logic change).
2. Optionally swap the DB-claim for a message broker. The DB status table remains the tracking
   source either way (brokers aren't queryable per report).
