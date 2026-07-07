# Generate Queue — admin report generation via Kafka + report-worker

**Date:** 2026-07-07
**Status:** Approved (design), not yet implemented
**Branch:** main (working tree only — do NOT commit, per user instruction)

## Goal

Give admins a ReportsHub option to generate/regenerate pager reports through the
existing Kafka `report.generate` pipeline (executed by the report-worker
container) instead of the synchronous `/generate-report-unified` HTTP path, with
per-student status visible in the UI.

## Background

Today only the automatic on-submission pipeline uses Kafka
(`ReportPipelineProducer.enqueue` → `report.generate` →
`ReportGenerateConsumer` → `ReportService.generate(sid, aid, null, false)`).
All ReportsHub buttons call the synchronous endpoints in the API container.
The consumer emails whitelabel students after generating; email idempotency is
a 7-day Redis marker keyed `report:sent:<sid>:<aid>`.

## Decisions (from brainstorming)

- **Approach:** extend the existing pipeline (no new topic, no job table).
- **`force` and email are fully orthogonal.** `force` controls recalculation
  only. All four combinations of `force` × email toggle are valid.
- **Email toggle:** default OFF; confirmation dialog required to switch ON;
  when ON, every student with an address is emailed **regardless of
  whitelabel**.
- **Template picker:** same dropdown as the sync modal; the chosen
  `reportTemplateId` travels in the event.
- **Status:** polling (no SSE/WebSocket).
- **Mixed selections** (students with and without existing reports, or
  incomplete assessments) must be handled — see Error handling.

## Backend

### ReportGenerateEvent — new optional fields

| Field | Type | Legacy default | Meaning |
|---|---|---|---|
| `force` | boolean | `false` | `true` = recompute intermediary scores + placeholders; `false` = reuse cached placeholders, re-render template + PDF only |
| `reportTemplateId` | Long (nullable) | `null` | explicit template; `null` = assessment default |
| `emailMode` | String | `"auto"` | `"auto"` = whitelabel-gated (on-submission behavior) · `"none"` = never email · `"all"` = email every student with an address, whitelabel ignored |
| `batchId` | String (nullable) | `null` | set per admin enqueue action; folded into the email idempotency key |

Legacy JSON events (missing fields) deserialize to the defaults above —
byte-for-byte today's behavior. The on-submission producer keeps sending
events without these fields (implicit `auto`).

### New endpoints (UnifiedReportController)

Both `@PreAuthorize("@auth.allows('generated_report.create')")` + per-student
institute ABAC, mirroring the sync endpoints.

- `POST /generate-report-unified/enqueue`
  Body: `{userStudentId, assessmentId, reportTemplateId?, force, emailMode}`
- `POST /generate-report-unified/enqueue/bulk`
  Body: `{userStudentIds: [], assessmentId, reportTemplateId?, force, emailMode}`
  One Kafka message per student; all share one server-generated `batchId`.

Behavior per student, in order:
1. Validate student + assessment exist (404) and, when `reportTemplateId`
   given, that it is mapped to the assessment (400) — fail fast instead of a
   benign worker skip.
2. Publish the event via a new `ReportPipelineProducer` admin overload
   (reuses existing branding/recipient resolution). Kafka send failure → 502,
   and the row is NOT stamped queued.
3. Upsert `generated_report` row → `reportStatus="queued"` (create if absent).
4. Return `202 {queued: n, batchId}` immediately.

`emailMode` values accepted from the admin endpoints: `"none"` and `"all"`
only (`"auto"` is reserved for legacy/on-submission events).

### ReportGenerateConsumer changes

- Call `reportService.generate(ev.userStudentId, ev.assessmentId,
  ev.reportTemplateId, ev.force)` (was hardcoded `null, false`).
- Email decision:
  - `all` → email if recipient address exists (whitelabel ignored)
  - `none` → never email
  - `auto` (or missing) → existing whitelabel-gated logic, unchanged
- Terminal failures (non-retryable sanity codes) and the `@DltHandler` flip the
  `generated_report` row to `reportStatus="failed"`. Retryable errors leave it
  `"queued"` while Kafka retries.
- Retry classification otherwise unchanged (scores-not-ready / NOT_COMPLETED →
  retry; no-template → benign skip; unknown → retry).

### ReportEmailEvent / idempotency

`batchId` propagates from `ReportGenerateEvent` into `ReportEmailEvent`.
`ReportEmailIdempotency` key becomes `report:sent:<sid>:<aid>[:<batchId>]` —
legacy events (null batchId) keep the exact key used today. Each admin batch
can therefore email once even within the 7-day sent window, while retries
inside the batch stay deduplicated.

## Frontend

### ReportsHubPage

New **"Generate Queue"** button beside the existing "Generate Reports" button
(same per-assessment context), opening `GenerateQueueModal`.

### GenerateQueueModal (new component, sibling of GenerateReportsModal)

Same layout as the sync modal: template dropdown, same student list, same
status chips, same progress bar, and the same **Download PDF Zip** button
(reuses `zipStoredPdfs` unchanged — client-side, not queued).

Per-student actions (+ bulk equivalents at top):
- **Regenerate ✕** → enqueue `force=true`
- **Regenerate** → enqueue `force=false`
- **Download PDF** → existing stored-PDF download

Zip guard: the zip downloads whatever PDFs are currently in Spaces. If any
chip in the current batch is still `queued`, the zip button first confirms
("N reports still regenerating — zip current versions anyway?").

Email toggle — "Email these students":
- Default OFF on every modal open (never persisted).
- Switching ON opens a confirmation dialog stating the student count and that
  whitelabel is ignored; engages only on confirm.
- Maps to `emailMode: "all"` (on) / `"none"` (off) for every enqueue.

### Status polling

- After any enqueue, poll `getGeneratedReportsByAssessment` every ~4 s.
- Rows are unique per (student, assessment, template): each chip tracks the
  row matching the modal's selected `reportTemplateId` (or the assessment's
  default template when none is picked), ignoring rows for other templates
  and legacy System-B rows that carry no template reference.
- Chips: `queued` (spinner) → `generated` / `failed`.
- Batch completion detected by comparing row `updatedAt` against the enqueue
  timestamp (not status alone — most rows are already `"generated"` before a
  regenerate batch starts).
- Progress bar = resolved/enqueued for the current batch.
- Polling stops when nothing is queued, the modal closes, or after a
  ~10-minute cap; at the cap, still-queued students get a warning chip hinting
  the report-worker may not be running (it is commented out in local
  docker-compose, so this state is reachable in dev).
- Poll request errors are retried silently; last known state stays on screen.

## Error handling summary

| Scenario | Outcome |
|---|---|
| Student/assessment unknown at enqueue | 404, nothing queued |
| Template not mapped at enqueue | 400, nothing queued |
| Kafka send fails at enqueue | 502, row NOT stamped queued |
| Student has no report yet | Row created as `queued`; `force=false` computes fresh anyway (first-time generation) |
| Student never completed assessment | Worker retries NOT_COMPLETED, then DLT → row `failed` → definitive ✕ chip |
| PDF render fails in worker | Existing behavior: HTML saved, `pdf_status=failed`, retry endpoint available |
| Email fails | Existing email retry/DLT machinery; idempotency releases lock on failure |
| Worker not running | Rows stay `queued`; UI warns at poll cap |

## Compatibility & deployment

- Legacy events deserialize to today's behavior; on-submission pipeline
  untouched.
- API and worker are the same jar — deploy both containers together.
- New `reportStatus` value `"queued"` joins
  `notGenerated | generated | failed`; student-facing lists filter on
  `"generated"` and are unaffected.

## Testing

- Unit: event deserialization defaults from legacy JSON; consumer email
  decision matrix (`auto`×whitelabel±, `none`, `all`±address); force/template
  passthrough; idempotency key with/without batchId.
- Backend compiles; existing suite passes. Frontend `tsc --noEmit` clean for
  touched files.
- Manual end-to-end (enqueue → worker → poll) requires local Kafka + the
  `report-worker` profile.

## Out of scope

- SSE/WebSocket status push.
- Changes to the on-submission pipeline behavior.
- BET / legacy report families (queue modal drives the unified endpoint, which
  routes by template engineCode — pager is the primary target).
- Queue introspection UI (lag, DLT browser).
