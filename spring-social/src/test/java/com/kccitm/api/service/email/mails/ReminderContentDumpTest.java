package com.kccitm.api.service.email.mails;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import com.kccitm.api.service.email.mails.CounsellingMails.Session;
import com.kccitm.api.service.email.theme.Brand;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import com.kccitm.api.service.email.theme.MailRenderer;

/**
 * Prints the counselling reminder mails exactly as they are sent, for review.
 * Not an assertion — run it with {@code -Ddump.reminders=true} to read the copy
 * without having to trigger a real send.
 */
@EnabledIfSystemProperty(named = "dump.reminders", matches = "true")
class ReminderContentDumpTest {

    private static final Brand BRAND =
            Brand.standard("https://cdn.career-9.com/logo.png", "support@career-9.net", "https://career-9.com", 2026);

    private static Session online() {
        return new Session("Mon, 22 Sep 2026", "4:00 PM – 4:45 PM IST", "45",
                "Dr. Mira Desai", "Online (Google Meet)", "Dalimss Sunbeam Rohania", "10",
                "Harvest Career Navigator 2026", "Ritisha Reddy",
                MailLink.of("https://meet.google.com/abc-defg-hij", "meeting"),
                MailLink.of("https://career-9.com/r/xyz", "report"));
    }

    private static Session offline() {
        Session o = online();
        return new Session(o.date, o.time, o.duration, o.counsellor,
                "In-person · Career-9 Centre, Varanasi", o.school, o.studentClass,
                o.assessment, o.student, null, o.report);
    }

    private void show(String heading, Mail mail) {
        MailRenderer renderer = new MailRenderer();
        MailRenderer.Rendered r = renderer.render(mail, BRAND);
        System.out.println("\n\n═══════════════════════════════════════════════════════════════");
        System.out.println(heading);
        System.out.println("═══════════════════════════════════════════════════════════════");
        System.out.println("SUBJECT: " + r.subject);
        System.out.println("PREHEADER: " + mail.getPreheader());
        System.out.println("---------------------------------------------------------------");
        System.out.println(r.text.trim());
    }

    @Test
    void dumpReminderMails() {
        Session s = online();
        List<String> labels = Arrays.asList("in 12 hours", "in 4 hours", "in 2 hours", "in 15 minutes");

        for (String label : labels) {
            show("STUDENT reminder — " + label, CounsellingMails.reminderStudent("Ritisha", label, s));
        }
        show("STUDENT reminder — in 5 minutes (JOIN NOW, online)", CounsellingMails.joinNowStudent("Ritisha", s));
        show("STUDENT reminder — in 5 minutes (JOIN NOW, in-person)", CounsellingMails.joinNowStudent("Ritisha", offline()));

        for (String label : Arrays.asList("in 12 hours", "in 2 hours", "in 15 minutes")) {
            show("COUNSELLOR reminder — " + label,
                    CounsellingMails.reminderCounsellor("Mira", "Ritisha Reddy", label, s));
        }
        show("COUNSELLOR reminder — in 5 minutes (JOIN NOW, online)",
                CounsellingMails.joinNowCounsellor("Mira", "Ritisha Reddy", s));

        show("COUNSELLOR reminder — in 5 minutes (JOIN NOW, in-person)",
                CounsellingMails.joinNowCounsellor("Mira", "Ritisha Reddy", offline()));

        // The 8pm day-before digest, also sent by ReminderSchedulerService.
        List<String[]> digestRows = Arrays.asList(
                new String[]{"10:00 AM", "Ritisha Reddy", "Online"},
                new String[]{"11:00 AM", "T. Lohitha", "Online"},
                new String[]{"2:30 PM", "Vedavyas", "In-person"});
        show("COUNSELLOR daily digest — 8pm the night before",
                CounsellingMails.dailyDigest("Mira", "Tue, 23 Sep 2026", digestRows,
                        MailLink.of("https://career-9.com/counsellor", "counsellor_portal")));

        // The WhatsApp that rides with each of these.
        System.out.println("\n\n═══════════════════════════════════════════════════════════════");
        System.out.println("WHATSAPP (campaign " + com.kccitm.api.service.whatsapp.WhatsAppCampaigns.COUNSELLING_REMINDER + ")");
        System.out.println("═══════════════════════════════════════════════════════════════");
        for (String label : Arrays.asList("in 12 hours", "in 15 minutes", "in 5 minutes")) {
            System.out.println("params " + Arrays.asList(
                    "Ritisha Reddy", label,
                    "22 Sep 2026 4:00 PM — Join: https://meet.google.com/abc-defg-hij"));
        }
    }
}
