package com.kccitm.api.service.email.mails;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.kccitm.api.service.email.mails.CounsellingMails.Session;
import com.kccitm.api.service.email.theme.Brand;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import com.kccitm.api.service.email.theme.MailRenderer;

/**
 * Every session reminder must put the same facts in front of the reader,
 * whichever offset it goes out on: the 15-minute and 5-minute notices should
 * not carry less than the 12-hour one did.
 */
class ReminderParityTest {

    private static final Brand BRAND =
            Brand.standard("https://cdn.career-9.com/logo.png", "support@career-9.net", "https://career-9.com", 2026);

    private static final List<String> STUDENT_LABELS =
            Arrays.asList("in 12 hours", "in 4 hours", "in 2 hours", "in 15 minutes");

    /** The rows a student must see on every reminder. */
    private static final List<String> STUDENT_ROWS = Arrays.asList(
            "School: Dalimss Sunbeam Rohania", "Class: 10", "Date: Mon, 22 Sep 2026",
            "Time: 4:00 PM", "Counsellor: Dr. Mira Desai", "Mode:");

    /** The rows a counsellor must see on every reminder. */
    private static final List<String> COUNSELLOR_ROWS = Arrays.asList(
            "Student: Ritisha Reddy", "School: Dalimss Sunbeam Rohania", "Class: 10",
            "Date: Mon, 22 Sep 2026", "Time: 4:00 PM", "Mode:");

    private static Session session(MailLink join) {
        return new Session("Mon, 22 Sep 2026", "4:00 PM – 4:45 PM IST", "45",
                "Dr. Mira Desai", join == null ? "In-person · Career-9 Centre" : "Online (Google Meet)",
                "Dalimss Sunbeam Rohania", "10", "Harvest Career Navigator 2026", "Ritisha Reddy",
                join, MailLink.of("https://career-9.com/r/xyz", "report"));
    }

    private static Session online() {
        return session(MailLink.of("https://meet.google.com/abc-defg-hij", "meeting"));
    }

    private static String text(Mail mail) {
        return new MailRenderer().render(mail, BRAND).text;
    }

    /** Replaces an offset label, in either case, with a placeholder. */
    private static String blankOffset(String body, String label) {
        return body.replace(label, "<OFFSET>").replace(label.toUpperCase(), "<OFFSET>");
    }

    private static void assertCarries(String what, Mail mail, List<String> rows) {
        String body = text(mail);
        for (String row : rows) {
            assertTrue(body.contains(row), what + " is missing \"" + row + "\"");
        }
    }

    @Test
    void everyStudentReminderCarriesTheSameDetails() {
        Session s = online();
        for (String label : STUDENT_LABELS) {
            assertCarries("student reminder " + label,
                    CounsellingMails.reminderStudent("Ritisha", label, s), STUDENT_ROWS);
        }
        assertCarries("the 5-minute student reminder",
                CounsellingMails.joinNowStudent("Ritisha", s), STUDENT_ROWS);
    }

    @Test
    void everyStudentReminderOffersTheReportLink() {
        Session s = online();
        for (String label : STUDENT_LABELS) {
            assertTrue(text(CounsellingMails.reminderStudent("Ritisha", label, s))
                            .contains("Open your assessment report"),
                    "no report link at " + label);
        }
        assertTrue(text(CounsellingMails.joinNowStudent("Ritisha", s))
                        .contains("Open your assessment report"),
                "the 5-minute reminder must offer the report link too");
    }

    /** The counsellor's own offsets, mirroring COUNSELLOR_OFFSETS. */
    private static final List<String> COUNSELLOR_LABELS =
            Arrays.asList("in 12 hours", "in 2 hours", "in 15 minutes");

    @Test
    void everyCounsellorReminderCarriesTheSameDetails() {
        Session s = online();
        for (String label : COUNSELLOR_LABELS) {
            assertCarries("counsellor reminder " + label,
                    CounsellingMails.reminderCounsellor("Mira", "Ritisha Reddy", label, s), COUNSELLOR_ROWS);
        }
        assertCarries("the 5-minute counsellor reminder",
                CounsellingMails.joinNowCounsellor("Mira", "Ritisha Reddy", s), COUNSELLOR_ROWS);
    }

    /** An in-person session still gets the full table — only the join button drops out. */
    @Test
    void theInPersonJoinNowMailKeepsItsDetails() {
        Mail m = CounsellingMails.joinNowStudent("Ritisha", session(null));
        assertCarries("the in-person 5-minute reminder", m, STUDENT_ROWS);
        assertTrue(text(m).contains("Career-9 Centre"), "venue missing");
    }

    /**
     * The counsellor's 12-hour reminder must read exactly like their 2-hour and
     * 15-minute ones — same template, same rows, only the offset wording differs.
     */
    @Test
    void theCounsellorTwelveHourReminderMatchesTheOthers() {
        Session s = online();
        String twelve = text(CounsellingMails.reminderCounsellor("Mira", "Ritisha Reddy", "in 12 hours", s));
        for (String label : Arrays.asList("in 2 hours", "in 15 minutes")) {
            String other = text(CounsellingMails.reminderCounsellor("Mira", "Ritisha Reddy", label, s));
            // Normalise the offset wording out of both; what is left must be
            // identical. The rendered title uppercases it, so both cases go.
            assertEquals(blankOffset(other, label), blankOffset(twelve, "in 12 hours"),
                    "the 12-hour counsellor reminder differs from the " + label + " one");
        }
    }

    @Test
    void theCounsellorTwelveHourSubjectFollowsTheSamePattern() {
        Session s = online();
        for (String label : COUNSELLOR_LABELS) {
            assertEquals("Reminder: session " + label + " with Ritisha Reddy",
                    CounsellingMails.reminderCounsellor("Mira", "Ritisha Reddy", label, s).getSubject());
        }
    }

    /** Each offset still says which one it is. */
    @Test
    void eachReminderNamesItsOwnOffset() {
        Session s = online();
        for (String label : STUDENT_LABELS) {
            assertEquals("Your counselling session is " + label,
                    CounsellingMails.reminderStudent("Ritisha", label, s).getSubject());
        }
        assertEquals("Your counselling session starts in 5 minutes — join now",
                CounsellingMails.joinNowStudent("Ritisha", s).getSubject());
    }
}
