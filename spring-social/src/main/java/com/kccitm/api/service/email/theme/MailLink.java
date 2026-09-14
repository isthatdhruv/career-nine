package com.kccitm.api.service.email.theme;

/** Where a button goes and what the fallback line under it shows. The display never carries a token. */
public final class MailLink {
    private final String href;
    private final String display;

    private MailLink(String href, String display) { this.href = href; this.display = display; }

    public static MailLink of(String href, String display) { return new MailLink(href, display); }

    /** A short public page address: shown as-is without the scheme. */
    public static MailLink plain(String url) {
        return new MailLink(url, url == null ? "" : url.replaceFirst("^https?://", ""));
    }

    public String getHref() { return href; }
    public String getDisplay() { return display; }
}
