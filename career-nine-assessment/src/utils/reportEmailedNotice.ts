/**
 * Decides whether the thank-you page may show the green card
 * "Report sent to your registered email".
 *
 * Mirrors the backend rule in ReportGenerateConsumer: the pipeline mails a report
 * when the institute is whitelabel, OR the assessment's "email report" toggle is
 * on, OR the student paid for a tier that includes the final report. A tier that
 * hands the report to the counsellor overrides all of those — nothing is mailed
 * until the counsellor releases it, so nothing is promised here either.
 *
 * The paid B2C flow is the one exception to "show it when it's true": that path
 * already tells the student "we've also sent it to your email" on its report-ready
 * line, right beside the Download button and only once the report exists. So the
 * card yields to it — one message, never both — even when whitelabel or the toggle
 * would also apply.
 *
 * `loaded` must be true only once BOTH the branding call (whitelabel + toggle)
 * and upgrade-info (paid tier) have resolved, so the card never flashes in or
 * out while the page is still finding out.
 */
export type ReportEmailedNoticeInput = {
    loaded: boolean;
    whitelabel: boolean;
    emailReportEnabled: boolean;
    /** Paid B2C student whose active tier includes the final report. */
    paidFinalReport: boolean;
    heldForCounsellor: boolean;
};

export function shouldShowReportEmailedNotice(input: ReportEmailedNoticeInput): boolean {
    if (!input.loaded) return false;
    if (input.heldForCounsellor) return false;
    // The B2C report flow owns the "sent to your email" message on that path.
    if (input.paidFinalReport) return false;
    return input.whitelabel || input.emailReportEnabled;
}
