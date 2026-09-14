package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.kccitm.api.service.link.ShortLinkService;

/**
 * Rule 1 by construction: the only way to put a link in a mail. Anything long or carrying a token is
 * shortened; the display never shows a token even when shortening fails.
 */
@Service
public class MailLinks {
    private static final Pattern TOKEN_QUERY = Pattern.compile("[?&](t|token|e|code)=", Pattern.CASE_INSENSITIVE);
    private static final Pattern URL = Pattern.compile("https?://[^\\s\"'<>]+");

    @Autowired private ShortLinkService shortLinkService;
    @Value("${app.b2c.apiBaseUrl:https://api.career-9.com}") private String apiBaseUrl;

    public static boolean isLong(String url) {
        return url != null && (url.length() > MailTheme.LONG_LINK || TOKEN_QUERY.matcher(url).find());
    }

    public MailLink of(String url) { return of(url, "mail"); }

    public MailLink of(String url, String purpose) {
        if (url == null || url.isEmpty()) return null;
        if (!isLong(url)) return MailLink.plain(url);
        String code = shortLinkService.codeFor(url, purpose);
        if (code != null) {
            String shortUrl = apiBaseUrl.replaceAll("/+$", "") + "/s/" + code;
            return MailLink.of(shortUrl, shortUrl.replaceFirst("^https?://", ""));
        }
        // Shortening is best-effort: keep the working link, show only host + path.
        String display = url.replaceFirst("^https?://", "").replaceAll("[?#].*$", "");
        return MailLink.of(url, display);
    }

    /** Foreign HTML (admin templates, composed mails): every long URL, in hrefs and in text, becomes its short form. */
    public String rewrite(String html) {
        if (html == null || html.isEmpty()) return html;
        Set<String> seen = new LinkedHashSet<>();
        Matcher m = URL.matcher(html);
        while (m.find()) { String u = m.group(); if (isLong(u)) seen.add(u); }
        List<String> urls = new ArrayList<>(seen);
        urls.sort((a, b) -> b.length() - a.length());
        String out = html;
        for (String u : urls) {
            MailLink l = of(u, "foreign_html");
            if (l != null && !l.getHref().equals(u)) out = out.replace(u, l.getHref());
        }
        return out;
    }
}
