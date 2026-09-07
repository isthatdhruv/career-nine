package com.kccitm.api.service.email.mails;

import java.util.ArrayList;
import java.util.List;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

/** Counselling lifecycle mails: booking, confirmation, cancellation, reschedule. Pure: facts in, Mail out. */
public final class CounsellingMails {
    private CounsellingMails() { }
    static final String EARLY = "Please join a few minutes before the start time.";
    static final String SUPPORT = "support@career-9.net";

    /** The facts of a session, already formatted. Nullable fields are simply not shown. */
    public static final class Session {
        public final String date, time, duration, counsellor, mode, school, assessment, student;
        public final MailLink join, report;
        public Session(String date, String time, String duration, String counsellor, String mode, String school, String assessment, String student, MailLink join, MailLink report) {
            this.date = date; this.time = time; this.duration = duration; this.counsellor = counsellor; this.mode = mode;
            this.school = school; this.assessment = assessment; this.student = student; this.join = join; this.report = report;
        }
    }
    static Mail.Row[] rows(Session s, boolean withStudent, boolean withSchool) {
        List<Mail.Row> r = new ArrayList<>();
        if (withStudent) r.add(new Mail.Row("Student", s.student));
        if (withSchool) { r.add(new Mail.Row("School", s.school)); r.add(new Mail.Row("Assessment", s.assessment)); }
        r.add(new Mail.Row("Date", s.date)); r.add(new Mail.Row("Time", s.time));
        r.add(new Mail.Row("Counsellor", s.counsellor)); r.add(new Mail.Row("Mode", s.mode));
        return r.toArray(new Mail.Row[0]);
    }

    public static Mail bookingConfirmation(String firstName, Session s, MailLink calendar) {
        return Mail.builder().subject("Your counselling session is booked")
            .preheader(s.date + ", " + s.time + " with " + s.counsellor + ". Join link inside.")
            .title("It&rsquo;s official &#127881; Your counselling session is booked")
            .p("Hi " + v(firstName) + " &#128075;")
            .p("You&rsquo;ve taken an important step towards understanding your strengths, exploring possibilities, and getting clarity about your future. &#128640;")
            .details(rows(s, true, true))
            .action(s.join, "Join the session").outline(calendar, "Add to Google Calendar")
            .small("A calendar invite is also attached so you can add this to any calendar.")
            .p(b("&#128161; Come curious. Leave clear.") + " This is your session, so bring all your questions:")
            .list("&#129300; &ldquo;Which career is right for me?&rdquo;", "&#127919; &ldquo;What am I really good at?&rdquo;",
                  "&#128218; &ldquo;Which subjects should I choose?&rdquo;", "&#128640; &ldquo;What options do I have after school or college?&rdquo;")
            .p("Ask. Explore. Challenge. Discover. Your Career-9 report has the insights. Now, let&rsquo;s turn those insights into possibilities. &#128153;")
            .small("Need to make a change? Write to " + SUPPORT + " before the session so we can put it right.")
            .signature().build();
    }

    public static Mail assignedToCounsellor(String counsellorName, String reason, Session s, MailLink confirm) {
        List<Mail.Row> r = new ArrayList<>(); r.add(new Mail.Row("Reason", reason));
        for (Mail.Row x : rows(s, true, true)) if (!"Counsellor".equals(x.label)) r.add(x);
        return Mail.builder().subject("New counselling session assigned to you")
            .preheader(s.student + ", " + s.date + " at " + s.time + ". Please review and confirm.")
            .title("New session assigned to you").p(hi(counsellorName))
            .p("A new counselling session has been assigned to you.").details(r)
            .action(confirm, "Review and confirm").links(null, s.report, "Open the assessment report")
            .small("Once you confirm, the student receives the meeting details.").signature().build();
    }

    public static Mail confirmedToStudent(String firstName, Session s) {
        return Mail.builder().subject("Your counselling session is confirmed")
            .preheader(s.date + " at " + s.time + ". Join link inside.")
            .title("Your counselling session is confirmed").p(hi(firstName))
            .p("Your counselling session has been confirmed.")
            .details(new Mail.Row("Date", s.date), new Mail.Row("Time", s.time), new Mail.Row("Duration", s.duration == null ? null : s.duration + " minutes"), new Mail.Row("Mode", s.mode))
            .action(s.join, "Join the session").small(EARLY).signature().build();
    }

    public static Mail cancelledNotice(String firstName, Session s, String cancelledBy, String reason, MailLink sessions, String buttonLabel) {
        Mail.Builder m = Mail.builder().subject("Counselling session cancelled")
            .preheader(s.date + ", " + s.time + ": cancelled by " + cancelledBy + ".")
            .title("Counselling session cancelled").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " has been cancelled by " + b(cancelledBy) + ".");
        if (reason != null && !reason.isEmpty()) m.notice("Reason given: " + v(reason));
        return m.action(sessions, buttonLabel).small("If you have any questions, write to " + SUPPORT + ".").signature().build();
    }

    public static Mail studentCancellationConfirmation(String firstName, Session s, int changesLeft, boolean creditedBack, MailLink sessions) {
        String left = " You have " + b(String.valueOf(changesLeft)) + " free change" + (changesLeft == 1 ? "" : "s") + " left.";
        // A cancellation that was not credited back costs her a session; saying it was returned
        // when it was not is the one thing this mail must never do.
        String notice = creditedBack
                ? "Your session has been returned to your plan, so you can book again." + left
                : "This cancellation used one of your sessions, so it has not been returned to your plan." + left;
        return Mail.builder().subject("Your counselling session has been cancelled")
            .preheader("Cancelled as you asked. You have " + changesLeft + " free change" + (changesLeft == 1 ? "" : "s") + " left.")
            .title("Your session has been cancelled").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " has been cancelled as you requested.")
            .notice(notice)
            .p("Ready to pick a new time?").action(sessions, "Book a new time").signature().build();
    }

    public static Mail adminCancellationStudent(String firstName, Session s, MailLink sessions) {
        return Mail.builder().subject("Your counselling session has been cancelled")
            .preheader("Cancelled by the Career-9 team. Your entitlement is unaffected.")
            .title("Your session has been cancelled").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " has been cancelled by the Career-9 team.")
            .notice("This does not affect your counselling entitlement. Our team will be in touch shortly to arrange a new time.")
            .p("Prefer not to wait?").action(sessions, "Pick a new time")
            .small("We apologise for the inconvenience.").signature().build();
    }

    public static Mail adminCancellationCounsellor(String counsellorName, String studentName, Session s, MailLink portal) {
        return Mail.builder().subject("A counselling session has been cancelled")
            .preheader("The " + s.time + " session on " + s.date + " has been cancelled.")
            .title("A counselling session has been cancelled").p(hi(counsellorName))
            .p("The counselling session with " + b(studentName) + " on " + b(s.date) + " at " + b(s.time) + " has been cancelled by the Career-9 team.")
            .details(new Mail.Row("Student", studentName), new Mail.Row("Date", s.date), new Mail.Row("Time", s.time))
            .action(portal, "Open my dashboard").small("Nothing is required from you.").signature().build();
    }

    public static Mail selfReschedule(String firstName, String opening, String reason, MailLink reschedule) {
        Mail.Builder m = Mail.builder().subject("Please pick a new time for your counselling session")
            .preheader("Your session has not been cancelled. Choose a new slot, no login needed.")
            .title("Pick a new time for your session").p(hi(firstName)).p(v(opening));
        if (reason != null && !reason.isEmpty()) m.notice("Reason: " + v(reason));
        return m.p("Your session has " + b("not") + " been cancelled. Please pick a new slot that suits you; no login is needed.")
            .action(reschedule, "Pick a new slot")
            .small("Once you choose a time, your session is confirmed instantly and you will get the meeting details by email. We are sorry for the inconvenience.")
            .signature().build();
    }

    static Mail.Row[] rescheduleRows(Session old, Session s, boolean withStudent) {
        List<Mail.Row> r = new ArrayList<>();
        if (withStudent) r.add(new Mail.Row("Student", s.student));
        r.add(new Mail.Row("Previously", old.date + ", " + old.time));
        r.add(new Mail.Row("New date", s.date)); r.add(new Mail.Row("New time", s.time));
        r.add(new Mail.Row("Counsellor", s.counsellor)); r.add(new Mail.Row("Mode", s.mode));
        return r.toArray(new Mail.Row[0]);
    }
    public static Mail rescheduledStudent(String firstName, Session old, Session s) {
        return Mail.builder().subject("Your counselling session has been rescheduled")
            .preheader("Now " + s.date + " at " + s.time + ". Updated join link inside.")
            .title("Your session has been rescheduled").p(hi(firstName))
            .p("Your counselling session has moved. Here is the new schedule.").details(rescheduleRows(old, s, false))
            .action(s.join, "Join the session").small("Please update your calendar and join a few minutes before the start time.").signature().build();
    }
    public static Mail rescheduledCounsellor(String counsellorName, String studentName, Session old, Session s) {
        return Mail.builder().subject("A counselling session has been rescheduled")
            .preheader(studentName + ": now " + s.date + " at " + s.time + ".")
            .title("A session has been rescheduled").p(hi(counsellorName))
            .p("The counselling session with " + b(studentName) + " has moved. Here is the new schedule.").details(rescheduleRows(old, s, true))
            .action(s.join, "Join the session").links(null, s.report, "Open the assessment report").signature().build();
    }

    public static Mail counsellorSwapped(String firstName, Session s, String newCounsellor) {
        // An in-person session has no join link, so the mail must point at the details panel
        // instead of promising a link that is never rendered — and the "join early" note, which
        // is about a meeting room, has no meaning when the student is walking to a venue.
        Mail.Builder m = Mail.builder().subject("Your session is confirmed with updated details")
            .preheader("Same time, different counsellor. Use the updated join link.")
            .title("Your session is confirmed, with updated details").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " is going ahead exactly as planned. The time has not changed.")
            .p(s.join != null
                    ? "A different counsellor, " + b(newCounsellor) + ", will now be taking it, so please use the updated joining link below."
                    : "A different counsellor, " + b(newCounsellor) + ", will now be taking it. The venue is unchanged; the details are below.")
            .details(new Mail.Row("Date", s.date), new Mail.Row("Time", s.time),
                     new Mail.Row("Counsellor", newCounsellor), new Mail.Row("Mode", s.mode));
        if (s.join != null) m.action(s.join, "Join the session").small(EARLY);
        return m.signature().build();
    }

    public static Mail sessionShifted(String firstName, Session s, String oldTime, MailLink reschedule) {
        return Mail.builder().subject("Your counselling session has moved to " + s.time)
            .preheader("Moved from " + oldTime + " to " + s.time + " on " + s.date + ".")
            .title("Your counselling session has moved").p(hi(firstName))
            .p("Your counsellor is no longer available at " + b(oldTime) + ", so we have moved your session to " + b(s.time) + " on " + b(s.date) + ".")
            .action(s.join, "Join the session")
            .p("If the new time does not suit you, you can pick another one. Choosing your own time uses one of your free changes.")
            .outline(reschedule, "Choose another time").small("We are sorry for the disruption.").signature().build();
    }

    public static Mail counsellorDeactivatedStudent(String firstName, Session s, MailLink reschedule) {
        return Mail.builder().subject("Your counselling session has been cancelled")
            .preheader("Your counsellor is no longer available. Choose a new time right away, no login needed.")
            .title("Your session has been cancelled").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " has been cancelled by the Career-9 team, as your counsellor is no longer available.")
            .notice("This does not affect your counselling entitlement. Another counsellor is available, so you can choose a new time right away.")
            .action(reschedule, "Pick a new slot")
            .small("No login is needed; the link opens your booking page directly. If you would rather we arranged it for you, write to " + SUPPORT + ". We apologise for the inconvenience.")
            .signature().build();
    }
}
