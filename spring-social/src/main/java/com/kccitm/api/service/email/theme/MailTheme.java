package com.kccitm.api.service.email.theme;

/** The approved tokens. Change a value here and every mail changes; nothing else may hold a colour. */
public final class MailTheme {
    public static final String PRIMARY = "#1B5E20";
    public static final String ACCENT = "#66BB6A";
    public static final String INK = "#1F2A24";
    public static final String MUTED = "#5C6B62";
    public static final String FAINT = "#8A9790";
    public static final String BORDER = "#DDE3DF";
    public static final String PANEL = "#F3F6F4";
    public static final String GROUND = "#EEF1EF";
    public static final String WHITE = "#FFFFFF";
    public static final String FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    public static final String MONO = "Consolas,'Courier New',monospace";
    /** Attribute on the outer shell table; the dispatcher uses it to avoid wrapping twice. */
    public static final String SHELL_MARKER = "data-c9-shell=\"a3\"";
    public static final int MAX_SUBJECT = 60;
    public static final int MAX_PREHEADER = 90;
    /** A URL longer than this, or one carrying a token, is shortened before it is shown. */
    public static final int LONG_LINK = 60;
    private MailTheme() { }
}
