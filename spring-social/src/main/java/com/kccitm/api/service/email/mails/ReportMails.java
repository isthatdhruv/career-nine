package com.kccitm.api.service.email.mails;

import java.util.ArrayList;
import java.util.List;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

public final class ReportMails {
    private ReportMails() { }

    public static Mail assessmentCompletion(String firstName, String assessmentName, String username, String dob, MailLink dashboard) {
        Mail.Builder m = Mail.builder().subject("You've completed " + assessmentName)
            .preheader("Your report is being prepared. Here is what happens next.")
            .title("Assessment complete &#10003;").p(hi(firstName))
            .p("Great work. You have completed " + b(assessmentName) + ".");
        if (username != null || dob != null) m.credentials("Use these to sign in to your dashboard.", new Mail.Row("Username", username), new Mail.Row("DOB", dob));
        return m.steps(new Mail.Step("Your report is being generated", "Your responses are being analysed across six career dimensions to build your personalised Career Report."),
                       new Mail.Step("Check your dashboard", "Sign in to see your career matches, strengths and detailed insights once the report is ready."),
                       new Mail.Step("Talk to a career expert", "Book a session from your dashboard any time to go through your results with a counsellor."))
            .action(dashboard, "Go to my dashboard").signature().build();
    }

    /** The one report mail: pipeline, pipeline-disabled path and admin resend. pdf/booking may be null. */
    public static Mail reportReady(String firstName, String brandName, MailLink report, MailLink pdf, boolean pdfAttached, MailLink booking) {
        Mail.Builder m = Mail.builder().subject("Your " + brandName + " report is ready")
            .preheader("Your personalised report is ready to read. Open it from this email.")
            .title("&#127881; Your career assessment is complete")
            .p("Hi " + v(firstName) + ", now comes the exciting part&hellip;")
            .list("&#128269; What does your report say about " + b("you") + "?", "&#128161; What are your natural strengths?",
                  "&#127919; Which careers match your personality and abilities?", "&#128640; What could you work on to get closer to your goals?")
            .p("Your personalised " + b(brandName + " Report") + " is ready, filled with insights about your strengths, interests, abilities and career possibilities.")
            .action(report, "View my report");
        if (pdf != null) m.links(pdfAttached ? "Your detailed report is also attached to this email as a PDF." : null, pdf, "Download as PDF");
        else m.small(pdfAttached ? "Your detailed report is also attached to this email as a PDF." : "Open your full report using the button above.");
        m.p("But remember, the report is just the beginning &#127775;");
        if (booking != null) {
            m.p(b("&#128640; Your next step.") + " Now it&rsquo;s time to understand what these insights mean for your future. Get your report interpreted by an expert in a 1:1 online session:")
             .list("&#10024; Explore career options that fit " + b("you"), "&#10024; Discover your strengths and improvement areas",
                   "&#10024; Get clarity on your next academic step", "&#10024; Ask anything about your future. No question is too small")
             .outline(booking, "Book my counselling session");
        }
        return m.p("Your future is not a guess. It&rsquo;s a journey, and " + v(brandName) + " is here to help you navigate it.").signature().build();
    }

    public static Mail counsellorReportReady(String counsellorName, String studentName, String assessmentName, MailLink report) {
        return Mail.builder().subject("Report ready: " + studentName)
            .preheader(studentName + " has finished " + assessmentName + ". Read it before your session.")
            .title("Report ready: " + v(studentName)).p(hi(counsellorName))
            .p(b(studentName) + " has completed " + b(assessmentName) + " and the report is ready.")
            .action(report, "Open report")
            .small("Please look through it before your session so you can go straight to what matters.").signature().build();
    }

    public static Mail bookedSessionReportReady(String studentName, String sessionDate, MailLink report) {
        String when = sessionDate == null ? "" : " on " + b(sessionDate);
        return Mail.builder().subject("Report ready for your counselling session")
            .preheader(studentName + "'s report is ready ahead of the session" + (sessionDate == null ? "." : " on " + sessionDate + "."))
            .title("Assessment report ready").p("Hello,")
            .p("The assessment report for " + b(studentName) + " is now ready, ahead of the counselling session" + when + ".")
            .action(report, "Open report")
            .small("Please read it before the session so the time can be spent on what matters most.").signature().build();
    }

    public static Mail reportReleased(String firstName, String releasedBy, MailLink report) {
        String by = releasedBy == null || releasedBy.isEmpty() ? "" : " by " + b(releasedBy);
        return Mail.builder().subject("Your assessment report is ready")
            .preheader(releasedBy == null ? "Released after your counselling session." : "Released by " + releasedBy + " after your counselling session.")
            .title("Your assessment report is ready").p(hi(firstName))
            .p("Your assessment report has been released" + by + " following your counselling session.")
            .action(report, "Open my report")
            .small("Take your time with it, and come back to your counsellor with anything you would like explained further.").signature().build();
    }

    public static Mail reportsZip(String contactName, String instituteName, String assessmentName, String reportType, List<String> included, int noReportCount, List<String> failed) {
        List<String[]> rows = new ArrayList<>(); int i = 1;
        for (String s : included) rows.add(new String[]{String.valueOf(i++), s});
        Mail.Builder m = Mail.builder().subject(reportType + " reports: " + instituteName)
            .preheader(included.size() + " student reports for " + assessmentName + " are attached as a ZIP.")
            .title("Student reports attached").p(hi(contactName))
            .p("The " + b(reportType) + " reports for " + b(assessmentName) + " are attached as a ZIP file. Extract it to open each student&rsquo;s report.")
            .details(new Mail.Row("School", instituteName), new Mail.Row("Assessment", assessmentName), new Mail.Row("Report type", reportType), new Mail.Row("Reports included", included.size() + " students"))
            .table(new String[]{"#", "Student"}, rows);
        if (!failed.isEmpty()) m.notice("Could not download reports for: " + v(String.join(", ", failed)) + ".");
        if (noReportCount > 0) m.notice(noReportCount + " students do not have a generated report yet and are not included.");
        return m.signature().build();
    }

    public static Mail schoolDashboardReady(String contactName, String instituteName, String assessmentName, MailLink dashboard) {
        return Mail.builder().subject("Your school dashboard is ready: " + instituteName)
            .preheader("Insights from " + assessmentName + " across your students are live.")
            .title("Your school dashboard is live").p(contactName == null || contactName.isEmpty() ? "Hello," : hi(contactName))
            .p("The Career-9 school dashboard for " + b(instituteName) + " is now live. It summarises what " + b(assessmentName) + " found across your students: where they are heading, where they will need support, and what the school can do about it.")
            .action(dashboard, "Open your dashboard")
            .steps(new Mail.Step("Sign in", "Use the account we set up for you, then choose Reports &rarr; School Dashboard from the menu on the left."),
                   new Mail.Step("Filter", "The page opens on the whole school. The filters at the top narrow it to a grade, section or group; figures and written analysis both change to match."),
                   new Mail.Step("Start at the top", "The statement and the three cards under it are the findings we think need action first. The full analysis below explains each one with the figures it is based on."))
            .notice("Every figure comes from students who completed and were scored on the assessment. Cohorts too small to describe safely are left without written analysis on purpose.")
            .small("If a figure looks off, a class is missing, or the page will not open, write to support@career-9.net with the school name and the grade or section you were viewing.")
            .signature().build();
    }
}
