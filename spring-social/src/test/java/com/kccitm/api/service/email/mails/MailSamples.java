package com.kccitm.api.service.email.mails;

import java.util.LinkedHashMap;
import java.util.Map;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import com.kccitm.api.service.email.theme.MailLinks;

/** Every live mail with sample values, keyed by catalogue id. Grows one module at a time. */
public final class MailSamples {
    public static final String SHORT = "https://api.career-9.com/s/Kx7Pq2M";
    static final String FIRST = "Aarav", STUDENT = "Aarav Sharma", COUNSELLOR = "Priya Iyer", ASSESSMENT = "Career Discovery Assessment",
            SCHOOL = "Delhi Public School, Noida", DATE = "Thursday, 18 Sep 2026", TIME = "4:30 – 5:00 PM IST", MODE = "Online (Google Meet)";
    private MailSamples() { }

    /** What MailLinks.of would produce for this url, without a database. */
    public static MailLink L(String url) {
        return MailLinks.isLong(url) ? MailLink.of(SHORT, "api.career-9.com/s/Kx7Pq2M") : MailLink.plain(url);
    }
    static final MailLink SIGN_IN = L("https://dashboard.career-9.com/auth");
    static final MailLink LOGIN = L("https://assessment.career-9.com/student-login");
    static final MailLink MAGIC = L("https://assessment.career-9.com/assessment/start?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79");
    static final MailLink JOIN = L("https://meet.google.com/abc-defg-hij");
    static final MailLink SESSIONS = L("https://dashboard.career-9.com/counselling/my-sessions");
    static final MailLink PORTAL = L("https://dashboard.career-9.com/counsellor/sessions");
    static final MailLink REPORT = L("https://storage-c9.sgp1.cdn.digitaloceanspaces.com/reports/2026/09/aarav-sharma-career-report.html");
    static final MailLink PAYMENT_RETRY = L("https://dashboard.career-9.com/payment-register/pay_Q7x9AbC1234567890abcdef");

    public static Map<String, Mail> all() {
        Map<String, Mail> m = new LinkedHashMap<>();
        m.put("login-credentials", AccountMails.loginCredentials("Career-9", FIRST, "20260412", "15-05-2010", SIGN_IN));
        m.put("school-registration-success", AccountMails.registrationSuccess(FIRST, ASSESSMENT, "20260412", "15-05-2010", LOGIN));
        m.put("account-welcome", AccountMails.accountWelcome(FIRST));
        m.put("password-reset-link", AccountMails.passwordResetLink(FIRST, 60, L("https://dashboard.career-9.com/auth/reset-password/3f9c1c2e-6b1a-4a8e-9a0f-1b2c3d4e5f60")));
        m.put("password-reset-confirm", AccountMails.passwordResetConfirm(FIRST, SIGN_IN));
        m.put("admin-password-reset", AccountMails.adminPasswordReset("Meera", "Tq7#kd2p", SIGN_IN));
        m.put("account-activated", AccountMails.accountActivated("Meera", SIGN_IN));
        m.put("payment-success-welcome", PaymentMails.paymentReceived(FIRST, ASSESSMENT, "20260412", "15-05-2010", LOGIN));
        m.put("payment-success-resend", PaymentMails.welcomeResend(FIRST, ASSESSMENT, "20260412", "15-05-2010", MAGIC, LOGIN));
        m.put("payment-success-resend-no-entitlement", PaymentMails.welcomeResend(FIRST, ASSESSMENT, "20260412", "15-05-2010", null, LOGIN));
        m.put("payment-failed-cancelled-expired", PaymentMails.paymentFailed(FIRST, ASSESSMENT, "1,499", PaymentMails.Outcome.FAILED, PAYMENT_RETRY));
        m.put("payment-failed-cancelled-expired-expired", PaymentMails.paymentFailed(FIRST, ASSESSMENT, "1,499", PaymentMails.Outcome.EXPIRED, PAYMENT_RETRY));
        m.put("payment-failed-cancelled-expired-cancelled", PaymentMails.paymentFailed(FIRST, ASSESSMENT, "1,499", PaymentMails.Outcome.CANCELLED, PAYMENT_RETRY));
        m.put("payment-pending-nudge", PaymentMails.paymentPending(FIRST, ASSESSMENT, "1,499", PAYMENT_RETRY));
        m.put("payment-link", PaymentMails.paymentLink(FIRST, ASSESSMENT, "1,499", PAYMENT_RETRY));
        m.put("assessment-completion", ReportMails.assessmentCompletion(FIRST, ASSESSMENT, "20260412", "15-05-2010", SIGN_IN));
        m.put("report-ready-pipeline", ReportMails.reportReady(FIRST, "Career-9", REPORT, L("https://storage-c9.sgp1.cdn.digitaloceanspaces.com/reports/2026/09/aarav-sharma-career-report.pdf"), true, L("https://assessment.career-9.com/counselling-booking/eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig")));
        m.put("counsellor-report-ready", ReportMails.counsellorReportReady(COUNSELLOR, STUDENT, ASSESSMENT, REPORT));
        m.put("booked-session-report-ready", ReportMails.bookedSessionReportReady(STUDENT, DATE, REPORT));
        m.put("counsellor-report-release", ReportMails.reportReleased(FIRST, COUNSELLOR, REPORT));
        m.put("contact-person-reports-zip", ReportMails.reportsZip("Suresh Menon", SCHOOL, ASSESSMENT, "Navigator", java.util.Arrays.asList("Aarav Sharma", "Diya Patel", "Kabir Rao"), 3, java.util.Collections.emptyList()));
        m.put("school-dashboard-ready", ReportMails.schoolDashboardReady("Suresh Menon", SCHOOL, ASSESSMENT, L("https://dashboard.career-9.com/school-dashboard")));
        m.put("b2c-welcome-assessment-link", EntitlementMails.welcome(FIRST, "20260412", "15-05-2010", MAGIC, LOGIN));
        m.put("b2c-assessment-invite-resend", EntitlementMails.assessmentLink(FIRST, ASSESSMENT, MAGIC));
        m.put("b2c-dashboard-access", EntitlementMails.dashboardAccess(FIRST, L("https://dashboard.career-9.com/student/sso?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
        m.put("b2c-lms-access", EntitlementMails.learningAccess(FIRST, L("https://dashboard.career-9.com/lms/launch?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
        m.put("b2c-counselling-book-link", EntitlementMails.bookingLink(FIRST, L("https://dashboard.career-9.com/counselling/book?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
        CounsellingMails.Session S = new CounsellingMails.Session(DATE, TIME, "30", COUNSELLOR, MODE, SCHOOL, ASSESSMENT, STUDENT, JOIN, REPORT);
        CounsellingMails.Session OLD = new CounsellingMails.Session("Tuesday, 16 Sep 2026", "3:00 – 3:30 PM IST", "30", COUNSELLOR, MODE, SCHOOL, ASSESSMENT, STUDENT, null, null);
        MailLink RESCHEDULE = L("https://assessment.career-9.com/counselling-reschedule/eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig");
        m.put("counselling-booking-confirmation", CounsellingMails.bookingConfirmation(FIRST, S, L("https://calendar.google.com/calendar/render?action=TEMPLATE&text=Career-9+Counselling&dates=20260918T110000Z/20260918T113000Z")));
        m.put("counselling-assigned-to-counsellor", CounsellingMails.assignedToCounsellor(COUNSELLOR, "Wants help choosing a stream after Class 10", S, PORTAL));
        m.put("counselling-confirmed-to-student", CounsellingMails.confirmedToStudent(FIRST, S));
        m.put("counselling-cancelled-notice", CounsellingMails.cancelledNotice(FIRST, S, "the student", "counsellor unavailable", SESSIONS, "View my sessions"));
        m.put("counselling-student-cancellation-confirmation", CounsellingMails.studentCancellationConfirmation(FIRST, S, 1, true, SESSIONS));
        m.put("counselling-student-cancellation-confirmation-not-credited", CounsellingMails.studentCancellationConfirmation(FIRST, S, 0, false, SESSIONS));
        m.put("counselling-admin-cancellation", CounsellingMails.adminCancellationStudent(FIRST, S, SESSIONS));
        m.put("counselling-admin-cancellation-counsellor", CounsellingMails.adminCancellationCounsellor(COUNSELLOR, STUDENT, S, PORTAL));
        m.put("counselling-self-reschedule", CounsellingMails.selfReschedule(FIRST, "Your counsellor was unable to join your session on Tuesday, 16 Sep at 3:00 PM.", "counsellor unavailable", RESCHEDULE));
        m.put("counselling-rescheduled", CounsellingMails.rescheduledStudent(FIRST, OLD, S));
        m.put("counselling-rescheduled-counsellor", CounsellingMails.rescheduledCounsellor(COUNSELLOR, STUDENT, OLD, S));
        m.put("counselling-counsellor-swapped", CounsellingMails.counsellorSwapped(FIRST, S, "Rohit Verma"));
        m.put("counselling-session-shifted", CounsellingMails.sessionShifted(FIRST, S, "3:00 – 3:30 PM IST", RESCHEDULE));
        m.put("counsellor-deactivated-student", CounsellingMails.counsellorDeactivatedStudent(FIRST, S, RESCHEDULE));
        return m;
    }
}
