package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;

/** Seed bodies for reminder_config. Admins edit these on the Reminder Management page; the dispatcher adds the shell. */
public final class ReminderMails {
    private ReminderMails() { }
    public static Mail assessmentMapping() {
        return Mail.builder().subject("Reminder: complete {{assessmentName}}").preheader("Your assessment from {{instituteName}} is waiting for you.")
            .title("Your assessment is waiting").p("Hi {{studentName}},")
            .p("You have an assessment, <b>{{assessmentName}}</b>, assigned by <b>{{instituteName}}</b> that you have not started yet. Complete it when you have 30&ndash;40 quiet minutes.")
            .button(MailLink.of("{{link}}", ""), "Start my assessment").signature().build();
    }
    public static Mail assessmentInviteB2c() {
        return Mail.builder().subject("Reminder: complete your career assessment").preheader("Your {{assessmentName}} is waiting. Start it with one tap.")
            .title("Your assessment is waiting").p("Hi {{studentName}},")
            .p("You have not started <b>{{assessmentName}}</b> yet. It takes 30&ndash;40 minutes and you can pause and resume.")
            .button(MailLink.of("{{link}}", ""), "Start my assessment").signature().build();
    }
    public static Mail counselling24h() {
        return Mail.builder().subject("Your counselling session is tomorrow").preheader("{{appointmentTime}} with {{counsellorName}}. Join link inside.")
            .title("Your counselling session is tomorrow").p("Hi {{studentName}},")
            .p("Your session with <b>{{counsellorName}}</b> is scheduled for <b>{{appointmentTime}}</b>.")
            .details(new Mail.Row("Time", "{{appointmentTime}}"), new Mail.Row("Counsellor", "{{counsellorName}}"))
            .button(MailLink.of("{{meetingUrl}}", ""), "Join the session").small("The link becomes active 10 minutes before the start.").signature().build();
    }
    public static Mail counselling1h() {
        return Mail.builder().subject("Your counselling session starts in an hour").preheader("Starts at {{appointmentTime}}. Join link inside.")
            .title("Your session starts in an hour").p("Hi {{studentName}},")
            .p("Your counselling session starts at <b>{{appointmentTime}}</b>.")
            .button(MailLink.of("{{meetingUrl}}", ""), "Join the session").small("Join a few minutes early so the session can start on time.").signature().build();
    }
}
