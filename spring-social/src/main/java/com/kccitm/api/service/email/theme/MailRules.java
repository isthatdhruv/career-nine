package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** The rules a mail can break on its own (the shell handles the rest). Used by MailCatalogueTest and logged by the dispatcher. */
public final class MailRules {
    private static final Pattern REPLY = Pattern.compile("(?i)reply to this (e-?mail|address)|do not reply|don.t reply");
    private static final Pattern RAW_URL = Pattern.compile("https?://");
    private static final Pattern TOKEN = Pattern.compile("[?&](t|token|e|code)=");
    private MailRules() { }

    public static List<String> violations(Mail m) {
        List<String> v = new ArrayList<>();
        String subject = m.getSubject() == null ? "" : m.getSubject();
        if (subject.length() > MailTheme.MAX_SUBJECT) v.add("subject over 60 characters: " + subject);
        if (subject.contains("!")) v.add("exclamation mark in subject");
        String pre = m.getPreheader() == null ? "" : m.getPreheader();
        if (pre.isEmpty()) v.add("no preheader");
        if (pre.length() > MailTheme.MAX_PREHEADER) v.add("preheader over 90 characters");
        long primary = m.primaryActions(), secondary = m.secondaryActions();
        if (primary > 1) v.add(primary + " primary buttons");
        if (secondary > 1) v.add(secondary + " secondary buttons");
        for (Block b : m.getBlocks()) {
            String text = b.text() == null ? "" : b.text();
            if (b instanceof Blocks.Action || b instanceof Blocks.Button || b instanceof Blocks.Outline || b instanceof Blocks.Links) {
                if (TOKEN.matcher(text).find() || text.length() > 200) v.add("link display carries a token or is too long: " + text);
                continue;
            }
            if (RAW_URL.matcher(text).find()) v.add("raw URL in body text: " + text);
            if (REPLY.matcher(text).find()) v.add("body talks about replying: " + text);
        }
        return v;
    }
}
