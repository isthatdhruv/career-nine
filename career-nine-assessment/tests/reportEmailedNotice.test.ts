import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowReportEmailedNotice } from '../src/utils/reportEmailedNotice.ts';

// Mirrors the backend rule in ReportGenerateConsumer: a report is emailed when the
// institute is whitelabel, OR the assessment's "email report" toggle is on, OR the
// student paid for a tier that includes the final report — and never while the
// report is held for counsellor release. The paid B2C flow, however, already tells the
// student "we've also sent it to your email" on its own report-ready line, so this card
// stays out of the way there: one message, never both.
const nobodyEmailed = {
  loaded: true,
  whitelabel: false,
  emailReportEnabled: false,
  paidFinalReport: false,
  heldForCounsellor: false,
};

test('hidden for a school student when the assessment email toggle is off', () => {
  assert.equal(shouldShowReportEmailedNotice(nobodyEmailed), false);
});

test('shown when the assessment email toggle is on', () => {
  assert.equal(shouldShowReportEmailedNotice({ ...nobodyEmailed, emailReportEnabled: true }), true);
});

test('shown for a whitelabel school even with the toggle off', () => {
  assert.equal(shouldShowReportEmailedNotice({ ...nobodyEmailed, whitelabel: true }), true);
});

test('hidden for a paid B2C student — the report-ready line already says it was emailed', () => {
  assert.equal(shouldShowReportEmailedNotice({ ...nobodyEmailed, paidFinalReport: true }), false);
});

test('hidden for a paid B2C student even when whitelabel or the toggle would also apply (one message, not two)', () => {
  assert.equal(
    shouldShowReportEmailedNotice({ ...nobodyEmailed, paidFinalReport: true, whitelabel: true, emailReportEnabled: true }),
    false,
  );
});

test('hidden while branding or upgrade-info are still loading, even if the toggle is on', () => {
  assert.equal(
    shouldShowReportEmailedNotice({ ...nobodyEmailed, loaded: false, emailReportEnabled: true, whitelabel: true }),
    false,
  );
});

test('hidden when the report is held for counsellor release, whatever else is true', () => {
  assert.equal(
    shouldShowReportEmailedNotice({
      loaded: true,
      whitelabel: true,
      emailReportEnabled: true,
      paidFinalReport: true,
      heldForCounsellor: true,
    }),
    false,
  );
});
