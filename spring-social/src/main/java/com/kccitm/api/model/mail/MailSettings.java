package com.kccitm.api.model.mail;

import java.util.Date;

/** Typed view of the {@code mail_setting} rows. Defaults keep the engine off and the ceiling under Google's cap. */
public class MailSettings {
    public boolean engineEnabled = false;
    public int dailyCeilingPerAccount = 1800;
    public int reserveForImmediate = 300;
    public int paceSendsPerSecond = 1;
    public String quietHoursStart;   // "HH:mm" or null
    public String quietHoursEnd;     // "HH:mm" or null
    public String timezone = "Asia/Kolkata";
    public String stagingSinkEmail;
    public Date updatedAt;
}
