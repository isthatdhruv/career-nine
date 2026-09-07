# Email Theme and Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One theme layer that every Career-9 email renders through, a rule set enforced by the build, and all 63 live mails rewritten onto it (7 retired).

**Architecture:** A pure `Mail` value (subject, preheader, blocks) is built by per-module `*Mails` classes and rendered by `MailRenderer` into the A3 shell as HTML plus a plain-text part. `EmailDispatchService` renders `Mail`s itself and wraps any foreign HTML (admin templates, reminder bodies, admin-composed mails) in the same shell, shortening long links on the way. Two tests gate the build: an ArchUnit markup test and a catalogue test that renders every mail with sample data and checks the rules.

**Tech Stack:** Java 11, Spring Boot 2.5.5, JUnit 5, Mockito, ArchUnit (`archunit-junit5`), Maven offline (`mvn -o`). MySQL via existing JPA repositories. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-email-theme-and-rules-design.md`
**Copy reference (authoritative wording for every mail):** `docs/superpowers/plans/email-theme-reference/mail_specs.py` (block lists per mail id) and `mail_theme.py` (the Python rendering the user approved; the Java must match its markup). `career-9-email-v1.png` is the logo to upload.

## Global Constraints

- Java 11: no records, no sealed classes, no text blocks, no `switch` expressions.
- Colours: primary `#1B5E20`, accent `#66BB6A`, ink `#1F2A24`, muted `#5C6B62`, faint `#8A9790`, border `#DDE3DF`, panel `#F3F6F4`, ground `#EEF1EF`, white `#FFFFFF`.
- Fonts: `'Segoe UI',Roboto,Helvetica,Arial,sans-serif`; codes `Consolas,'Courier New',monospace`. Sizes: title 20px, body 15px, note 13px, footer 12px.
- Shell: 560px table, 6px corners, 8px primary strip, white logo row (logo 127×48 left, `Help: {support}` right, faint 12px), body padding `28px 28px 24px`, footer below the card.
- Footer: `Career-9 · Ensuring Career Success` / `Questions? Write to {support}` / `© {year} Career-9. All rights reserved. · {site}`. Whitelabel line 1: `Sent by Career-9 on behalf of {school}.`
- Rules 1–14 from the spec §2. Subject ≤ 60 chars, no `!`; preheader 1–90 chars; ≤ 1 primary button; ≤ 1 outline button; no `http` in authored text; no "reply to this email" / "do not reply" in bodies.
- Emoji only where `mail_specs.py` has them (entities like `&#127881;`); never in subjects or preheaders.
- Every mail sent through `EmailDispatchService` (existing `EmailDispatchRoutingTest` stays green).
- All commands run from `spring-social/`. Run a single test with `mvn -o -q test -Dtest=<Class> -DfailIfNoTests=false` (about 30 s). Compile with `mvn -o -q -DskipTests compile`.
- Commit after every task (branch `main`, message prefix `mail:`).

---

## File structure

Created (all under `spring-social/src/main/java/com/kccitm/api/service/email/`):

| File | Responsibility |
|---|---|
| `theme/MailTheme.java` | tokens and limits as constants |
| `theme/MailHtml.java` | escaping and tag stripping |
| `theme/MailLink.java` | href + display value |
| `theme/MailLinks.java` | `@Service`: link policy (shorten > 60 chars or tokenised) and foreign-HTML href rewriting |
| `theme/Block.java` | abstract block: `html()`, `text()`, action flags |
| `theme/Blocks.java` | the 16 block implementations |
| `theme/Mail.java` | immutable mail value + `Builder`, `Row`, `Step`, `b()`, `v()` |
| `theme/Brand.java` | logo, school, support, site, year |
| `theme/BrandResolver.java` | `@Service`: `Brand` from institute / student / request + config |
| `theme/MailShell.java` | shell markup (standard + whitelabel), `wrapForeign`, text part |
| `theme/MailRenderer.java` | `@Service`: `Rendered render(Mail, Brand)`, `Rendered wrapForeign(subject, html, Brand)`, `bodyHtml(Mail)` |
| `theme/MailRules.java` | rule checks used by tests and dispatcher warnings |
| `mails/AccountMails.java` | 7 account mails |
| `mails/PaymentMails.java` | 5 payment mails |
| `mails/ReportMails.java` | 7 report mails |
| `mails/EntitlementMails.java` | 5 B2C mails |
| `mails/CounsellingMails.java` | 27 counselling mails (incl. variants) |
| `mails/InternalMails.java` | lead alert, lead welcome, deactivation alert, request forwarded, account test |
| `mails/ReminderMails.java` | 4 reminder_config seed bodies |
| `MailSeedUpgrader.java` | on boot, replaces seeded email_template / reminder_config rows that still equal the old seed |

Tests under `spring-social/src/test/java/com/kccitm/api/`: `service/email/theme/MailBuilderTest`, `MailLinksTest`, `MailRendererTest`, `MailRulesTest`; `service/email/EmailDispatchWrapTest`; `service/email/mails/MailSamples` (registry) and `MailCatalogueTest`; `archtest/MailMarkupArchTest`.

Modified: `model/email/EmailSendRequest`, `service/email/EmailDispatchService`, `EmailTemplateService`, `EmailTemplateSeeder`, `PlaceholderResolver`, `model/email/EmailPlaceholder`, `model/email/EmailType`, every current sender (listed per task), `application.yml`, `InstituteBrandingService` (delete two methods), `LinkBuilder` (delete `onePager`), `NotificationDispatcher`, `EntitlementSchedulerService`, react-social `EntitlementDrawer.tsx` (drop two buttons).

Deleted: `service/counselling/CounsellingEmailHtml.java`, `service/b2c/report/pipeline/ReportEmailComposer.java`, four dead counselling methods, 1-pager sends.

---

### Task 1: Theme tokens, escaping, links, blocks and the Mail builder

**Files:**
- Create: `service/email/theme/MailTheme.java`, `MailHtml.java`, `MailLink.java`, `Block.java`, `Blocks.java`, `Mail.java`
- Test: `src/test/java/com/kccitm/api/service/email/theme/MailBuilderTest.java`

**Interfaces:**
- Produces: `Mail.builder().subject(String).preheader(String).title(String).p(String).small(String).details(Mail.Row...).credentials(String caption, Mail.Row...).code(String code, String caption).action(MailLink, String).button(MailLink, String).outline(MailLink, String).links(String prefix, MailLink...).notice(String).list(String...).steps(Mail.Step...).table(String[] header, List<String[]> rows).internal(String).signature().build()`; `Mail.b(String)` bold-escaped, `Mail.v(String)` escaped; `MailLink.of(href, display)`, `MailLink.plain(url)`; `Mail.primaryActions()`, `Mail.secondaryActions()`, `Block.html()`, `Block.text()`.

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.email.theme;

import java.util.Arrays;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailBuilderTest {

    @Test
    void escapesValuesButKeepsAuthoredMarkup() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .p("Your payment for " + Mail.b("A & B <x>") + " is in.")
                .build();
        String html = m.getBlocks().get(0).html();
        assertTrue(html.contains("<b>A &amp; B &lt;x&gt;</b>"));
        assertEquals("Your payment for A & B <x> is in.", m.getBlocks().get(0).text());
    }

    @Test
    void countsActions() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .action(MailLink.plain("https://dashboard.career-9.com/auth"), "Sign in")
                .outline(MailLink.plain("https://career-9.com"), "Site")
                .build();
        assertEquals(1, m.primaryActions());
        assertEquals(1, m.secondaryActions());
    }

    @Test
    void actionShowsDisplayNotHref() {
        MailLink l = MailLink.of("https://api.career-9.com/s/Kx7Pq2M", "api.career-9.com/s/Kx7Pq2M");
        Mail m = Mail.builder().subject("s").preheader("p").action(l, "Open").build();
        String html = m.getBlocks().get(0).html();
        assertTrue(html.contains("href=\"https://api.career-9.com/s/Kx7Pq2M\""));
        assertTrue(html.contains("Or open: <a"));
        assertTrue(html.contains(">api.career-9.com/s/Kx7Pq2M</a>"));
        assertEquals("Open: api.career-9.com/s/Kx7Pq2M", m.getBlocks().get(0).text());
    }

    @Test
    void detailsSkipEmptyRowsAndTextIsLabelled() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .details(new Mail.Row("Date", "Thu"), new Mail.Row("Venue", null), new Mail.Row("Mode", "Online"))
                .build();
        String html = m.getBlocks().get(0).html();
        assertFalse(html.contains("Venue"));
        assertEquals("  Date: Thu\n  Mode: Online", m.getBlocks().get(0).text());
    }

    @Test
    void plainLinkDisplayDropsScheme() {
        assertEquals("dashboard.career-9.com/auth", MailLink.plain("https://dashboard.career-9.com/auth").getDisplay());
    }

    @Test
    void tableRendersHeaderAndRows() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .table(new String[]{"Time", "Student"}, Arrays.asList(new String[]{"10:00", "Aarav"}))
                .build();
        assertTrue(m.getBlocks().get(0).html().contains("<th"));
        assertEquals("  Time | Student\n  10:00 | Aarav", m.getBlocks().get(0).text());
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `mvn -o -q test -Dtest=MailBuilderTest -DfailIfNoTests=false`
Expected: compilation error, `Mail` does not exist.

- [ ] **Step 3: Write `MailTheme`, `MailHtml`, `MailLink`**

```java
// theme/MailTheme.java
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
```

```java
// theme/MailHtml.java
package com.kccitm.api.service.email.theme;

import java.util.regex.Pattern;

final class MailHtml {
    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    private MailHtml() { }

    static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
    static String escAttr(String s) { return esc(s).replace("'", "&#39;"); }

    /** Visible text of authored HTML: tags removed, the handful of entities we write decoded. */
    static String textOf(String html) {
        if (html == null) return "";
        String t = html.replaceAll("(?i)<br\\s*/?>", "\n");
        t = TAGS.matcher(t).replaceAll("");
        t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", "\"").replace("&#39;", "'").replace("&rsquo;", "’").replace("&lsquo;", "‘")
             .replace("&ldquo;", "“").replace("&rdquo;", "”").replace("&ndash;", "–").replace("&mdash;", "—")
             .replace("&middot;", "·").replace("&hellip;", "…").replace("&rarr;", "→").replace("&harr;", "↔")
             .replace("&rsaquo;", "›").replace("&copy;", "©").replace("&#8377;", "₹");
        return t.replaceAll("[ \\t]+", " ").trim();
    }
}
```

```java
// theme/MailLink.java
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
```

- [ ] **Step 4: Write `Block` and `Blocks`**

```java
// theme/Block.java
package com.kccitm.api.service.email.theme;

public abstract class Block {
    public abstract String html();
    public abstract String text();
    public boolean isPrimaryAction() { return false; }
    public boolean isSecondaryAction() { return false; }
}
```

```java
// theme/Blocks.java
package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.List;
import static com.kccitm.api.service.email.theme.MailHtml.esc;
import static com.kccitm.api.service.email.theme.MailHtml.escAttr;
import static com.kccitm.api.service.email.theme.MailHtml.textOf;
import static com.kccitm.api.service.email.theme.MailTheme.*;

/** One class per block. Authored strings are trusted markup (inline b, entities); values come in escaped via Mail.b/Mail.v or are escaped here. */
final class Blocks {
    private Blocks() { }

    static final class Title extends Block {
        final String html; Title(String h) { html = h == null ? "" : h; }
        public String html() { return "<h1 style=\"margin:0 0 14px;font-family:" + FONT + ";font-size:20px;line-height:1.3;font-weight:700;color:" + INK + ";\">" + html + "</h1>"; }
        public String text() { return textOf(html).toUpperCase(); }
    }
    static final class Paragraph extends Block {
        final String html; Paragraph(String h) { html = h == null ? "" : h; }
        public String html() { return "<p style=\"margin:0 0 14px;font-family:" + FONT + ";font-size:15px;line-height:1.6;color:" + INK + ";\">" + html + "</p>"; }
        public String text() { return textOf(html); }
    }
    static final class Small extends Block {
        final String html; Small(String h) { html = h == null ? "" : h; }
        public String html() { return "<p style=\"margin:0 0 14px;font-family:" + FONT + ";font-size:13px;line-height:1.6;color:" + MUTED + ";\">" + html + "</p>"; }
        public String text() { return textOf(html); }
    }
    static final class Notice extends Block {
        final String html; Notice(String h) { html = h == null ? "" : h; }
        public String html() { return "<div style=\"border-left:3px solid " + ACCENT + ";background:" + PANEL + ";padding:10px 14px;margin:0 0 18px;font-family:" + FONT + ";font-size:14px;line-height:1.55;color:" + INK + ";\">" + html + "</div>"; }
        public String text() { return textOf(html); }
    }
    static final class Internal extends Block {
        final String tag; Internal(String t) { tag = t == null ? "" : t; }
        public String html() { return "<p style=\"margin:-4px 0 14px;font-family:" + FONT + ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" + FAINT + ";\">Internal &middot; " + esc(tag) + "</p>"; }
        public String text() { return "[Internal] " + tag; }
    }
    static final class Details extends Block {
        final List<Mail.Row> rows; Details(List<Mail.Row> r) { rows = r; }
        public String html() {
            StringBuilder tr = new StringBuilder();
            for (Mail.Row r : rows) {
                if (r == null || r.value == null || r.value.isEmpty()) continue;
                tr.append("<tr><td style=\"padding:6px 12px 6px 0;width:120px;font-family:").append(FONT).append(";font-size:14px;color:").append(MUTED).append(";vertical-align:top;\">").append(esc(r.label)).append("</td>")
                  .append("<td style=\"padding:6px 0;font-family:").append(FONT).append(";font-size:14px;font-weight:700;color:").append(INK).append(";vertical-align:top;\">").append(esc(r.value)).append("</td></tr>");
            }
            return "<div style=\"background:" + PANEL + ";border:1px solid " + BORDER + ";border-radius:4px;padding:10px 16px;margin:4px 0 18px;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + tr + "</table></div>";
        }
        public String text() {
            List<String> out = new ArrayList<>();
            for (Mail.Row r : rows) if (r != null && r.value != null && !r.value.isEmpty()) out.add("  " + r.label + ": " + r.value);
            return String.join("\n", out);
        }
    }
    static final class Credentials extends Block {
        final List<Mail.Row> rows; final String caption;
        Credentials(List<Mail.Row> r, String c) { rows = r; caption = c; }
        public String html() {
            StringBuilder tr = new StringBuilder();
            for (Mail.Row r : rows) {
                if (r == null || r.value == null || r.value.isEmpty()) continue;
                tr.append("<tr><td style=\"padding:5px 12px 5px 0;width:120px;font-family:").append(FONT).append(";font-size:14px;color:").append(MUTED).append(";vertical-align:top;\">").append(esc(r.label)).append("</td>")
                  .append("<td style=\"padding:5px 0;font-family:").append(MONO).append(";font-size:15px;font-weight:700;color:").append(INK).append(";vertical-align:top;\">").append(esc(r.value)).append("</td></tr>");
            }
            String cap = caption == null || caption.isEmpty() ? "" : "<div style=\"font-family:" + FONT + ";font-size:12px;line-height:1.5;color:" + MUTED + ";padding-top:8px;\">" + caption + "</div>";
            return "<div style=\"background:" + PANEL + ";border:1px solid " + BORDER + ";border-radius:4px;padding:12px 16px;margin:4px 0 18px;\">"
                 + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" + FAINT + ";padding-bottom:6px;\">Your login details</div>"
                 + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + tr + "</table>" + cap + "</div>";
        }
        public String text() {
            List<String> out = new ArrayList<>(); out.add("Your login details");
            for (Mail.Row r : rows) if (r != null && r.value != null && !r.value.isEmpty()) out.add("  " + r.label + ": " + r.value);
            if (caption != null && !caption.isEmpty()) out.add(textOf(caption));
            return String.join("\n", out);
        }
    }
    static final class Code extends Block {
        final String code, caption; Code(String c, String cap) { code = c == null ? "" : c; caption = cap == null ? "" : cap; }
        public String html() {
            return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:6px 0 18px;\"><tr><td align=\"center\" style=\"background:" + PANEL + ";border:1px dashed " + BORDER + ";border-radius:4px;padding:20px 16px;\">"
                 + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" + FAINT + ";\">" + esc(caption) + "</div>"
                 + "<div style=\"font-family:" + MONO + ";font-size:36px;line-height:1.2;font-weight:700;letter-spacing:10px;color:" + PRIMARY + ";padding:10px 0 2px 10px;\">" + esc(code) + "</div></td></tr></table>";
        }
        public String text() { return caption + ": " + code; }
    }
    static String button(MailLink l, String label) {
        return "<a href=\"" + escAttr(l.getHref()) + "\" style=\"display:inline-block;background:" + PRIMARY + ";color:#FFFFFF;font-family:" + FONT + ";font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:4px;\">" + esc(label) + "</a>";
    }
    /** Primary button with the "Or open:" short-link line. */
    static final class Action extends Block {
        final MailLink link; final String label; Action(MailLink l, String lb) { link = l; label = lb; }
        public boolean isPrimaryAction() { return true; }
        public String html() {
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:6px 0 18px;\"><tr><td>" + button(link, label) + "</td></tr>"
                 + "<tr><td style=\"padding-top:10px;font-family:" + FONT + ";font-size:12px;line-height:1.5;color:" + FAINT + ";\">Or open: <a href=\"" + escAttr(link.getHref()) + "\" style=\"color:" + PRIMARY + ";text-decoration:underline;\">" + esc(link.getDisplay()) + "</a></td></tr></table>";
        }
        public String text() { return label + ": " + link.getDisplay(); }
    }
    /** Primary button without the fallback line — for seeded templates whose href is still a {{token}}. */
    static final class Button extends Block {
        final MailLink link; final String label; Button(MailLink l, String lb) { link = l; label = lb; }
        public boolean isPrimaryAction() { return true; }
        public String html() { return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:6px 0 18px;\"><tr><td>" + button(link, label) + "</td></tr></table>"; }
        public String text() { return label + ": " + link.getDisplay(); }
    }
    static final class Outline extends Block {
        final MailLink link; final String label; Outline(MailLink l, String lb) { link = l; label = lb; }
        public boolean isSecondaryAction() { return true; }
        public String html() {
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:-6px 0 18px;\"><tr><td><a href=\"" + escAttr(link.getHref()) + "\" style=\"display:inline-block;border:1px solid " + PRIMARY + ";color:" + PRIMARY + ";font-family:" + FONT + ";font-size:13px;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:4px;\">" + esc(label) + "</a></td></tr></table>";
        }
        public String text() { return label + ": " + link.getDisplay(); }
    }
    /** A small line of labelled links, e.g. "Also attached as a PDF. Download as PDF". */
    static final class Links extends Block {
        final String prefix; final List<MailLink> links; final List<String> labels;
        Links(String p, List<MailLink> l, List<String> lb) { prefix = p; links = l; labels = lb; }
        public String html() {
            StringBuilder parts = new StringBuilder();
            for (int i = 0; i < links.size(); i++) {
                if (i > 0) parts.append(" &middot; ");
                parts.append("<a href=\"").append(escAttr(links.get(i).getHref())).append("\" style=\"color:").append(PRIMARY).append(";font-weight:700;text-decoration:underline;\">").append(esc(labels.get(i))).append("</a>");
            }
            String pre = prefix == null || prefix.isEmpty() ? "" : prefix + " ";
            return "<p style=\"margin:-6px 0 16px;font-family:" + FONT + ";font-size:13px;line-height:1.6;color:" + MUTED + ";\">" + pre + parts + "</p>";
        }
        public String text() {
            List<String> out = new ArrayList<>();
            if (prefix != null && !prefix.isEmpty()) out.add(textOf(prefix));
            for (int i = 0; i < links.size(); i++) out.add("  " + labels.get(i) + ": " + links.get(i).getDisplay());
            return String.join("\n", out);
        }
    }
    static final class BulletList extends Block {
        final List<String> items; BulletList(List<String> i) { items = i; }
        public String html() {
            StringBuilder rows = new StringBuilder();
            for (String i : items) rows.append("<tr><td style=\"width:18px;vertical-align:top;padding:3px 0;font-family:").append(FONT).append(";font-size:14px;color:").append(ACCENT).append(";\">&#9679;</td><td style=\"padding:3px 0;font-family:").append(FONT).append(";font-size:14px;line-height:1.55;color:").append(INK).append(";\">").append(i).append("</td></tr>");
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 16px;\">" + rows + "</table>";
        }
        public String text() { List<String> o = new ArrayList<>(); for (String i : items) o.add("  - " + textOf(i)); return String.join("\n", o); }
    }
    static final class Steps extends Block {
        final List<Mail.Step> steps; Steps(List<Mail.Step> s) { steps = s; }
        public String html() {
            StringBuilder rows = new StringBuilder(); int n = 1;
            for (Mail.Step s : steps) rows.append("<tr><td style=\"width:30px;vertical-align:top;padding:4px 10px 4px 0;font-family:").append(FONT).append(";font-size:13px;font-weight:700;color:").append(PRIMARY).append(";\">").append(n++).append(".</td><td style=\"padding:4px 0;font-family:").append(FONT).append(";font-size:14px;line-height:1.5;color:").append(INK).append(";\"><b>").append(s.heading).append("</b><br><span style=\"color:").append(MUTED).append(";\">").append(s.text).append("</span></td></tr>");
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 16px;\">" + rows + "</table>";
        }
        public String text() { List<String> o = new ArrayList<>(); int n = 1; for (Mail.Step s : steps) o.add("  " + (n++) + ". " + textOf(s.heading) + " — " + textOf(s.text)); return String.join("\n", o); }
    }
    static final class Table extends Block {
        final String[] header; final List<String[]> rows; Table(String[] h, List<String[]> r) { header = h; rows = r; }
        public String html() {
            StringBuilder th = new StringBuilder();
            for (String h : header) th.append("<th align=\"left\" style=\"padding:7px 10px;font-family:").append(FONT).append(";font-size:12px;font-weight:700;color:").append(MUTED).append(";background:").append(PANEL).append(";border-bottom:1px solid ").append(BORDER).append(";\">").append(esc(h)).append("</th>");
            StringBuilder trs = new StringBuilder();
            for (String[] r : rows) { trs.append("<tr>"); for (String c : r) trs.append("<td style=\"padding:7px 10px;font-family:").append(FONT).append(";font-size:13.5px;color:").append(INK).append(";border-bottom:1px solid ").append(BORDER).append(";vertical-align:top;\">").append(esc(c)).append("</td>"); trs.append("</tr>"); }
            return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border:1px solid " + BORDER + ";border-radius:4px;margin:4px 0 18px;\"><tr>" + th + "</tr>" + trs + "</table>";
        }
        public String text() { List<String> o = new ArrayList<>(); o.add("  " + String.join(" | ", header)); for (String[] r : rows) o.add("  " + String.join(" | ", r)); return String.join("\n", o); }
    }
    static final class Signature extends Block {
        public String html() { return "<p style=\"margin:22px 0 0;font-family:" + FONT + ";font-size:15px;line-height:1.6;color:" + INK + ";\">Regards,<br><b>Career-9 Team</b></p>"; }
        public String text() { return "Regards,\nCareer-9 Team"; }
    }
}
```

- [ ] **Step 5: Write `Mail`**

```java
// theme/Mail.java
package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** A mail before rendering: subject, preheader and blocks. Immutable; build with {@link #builder()}. */
public final class Mail {
    private final String subject;
    private final String preheader;
    private final List<Block> blocks;

    private Mail(String subject, String preheader, List<Block> blocks) {
        this.subject = subject; this.preheader = preheader; this.blocks = Collections.unmodifiableList(new ArrayList<>(blocks));
    }
    public static Builder builder() { return new Builder(); }
    public String getSubject() { return subject; }
    public String getPreheader() { return preheader; }
    public List<Block> getBlocks() { return blocks; }
    public long primaryActions() { return blocks.stream().filter(Block::isPrimaryAction).count(); }
    public long secondaryActions() { return blocks.stream().filter(Block::isSecondaryAction).count(); }

    /** A value in bold, escaped. Use inside p()/small()/notice() text. */
    public static String b(String value) { return "<b>" + MailHtml.esc(value) + "</b>"; }
    /** A value escaped. */
    public static String v(String value) { return MailHtml.esc(value); }

    public static final class Row {
        final String label; final String value;
        public Row(String label, String value) { this.label = label; this.value = value; }
    }
    public static final class Step {
        final String heading; final String text;
        public Step(String heading, String text) { this.heading = heading; this.text = text; }
    }

    public static final class Builder {
        private String subject; private String preheader; private final List<Block> blocks = new ArrayList<>();
        public Builder subject(String s) { subject = s; return this; }
        public Builder preheader(String p) { preheader = p; return this; }
        public Builder title(String html) { blocks.add(new Blocks.Title(html)); return this; }
        public Builder p(String html) { blocks.add(new Blocks.Paragraph(html)); return this; }
        public Builder small(String html) { blocks.add(new Blocks.Small(html)); return this; }
        public Builder notice(String html) { blocks.add(new Blocks.Notice(html)); return this; }
        public Builder internal(String tag) { blocks.add(new Blocks.Internal(tag)); return this; }
        public Builder details(Row... rows) { blocks.add(new Blocks.Details(Arrays.asList(rows))); return this; }
        public Builder details(List<Row> rows) { blocks.add(new Blocks.Details(rows)); return this; }
        public Builder credentials(String caption, Row... rows) { blocks.add(new Blocks.Credentials(Arrays.asList(rows), caption)); return this; }
        public Builder code(String code, String caption) { blocks.add(new Blocks.Code(code, caption)); return this; }
        public Builder action(MailLink link, String label) { if (link != null) blocks.add(new Blocks.Action(link, label)); return this; }
        public Builder button(MailLink link, String label) { if (link != null) blocks.add(new Blocks.Button(link, label)); return this; }
        public Builder outline(MailLink link, String label) { if (link != null) blocks.add(new Blocks.Outline(link, label)); return this; }
        /** links(prefix, link1, label1, link2, label2 …) */
        public Builder links(String prefix, Object... linksAndLabels) {
            List<MailLink> l = new ArrayList<>(); List<String> lb = new ArrayList<>();
            for (int i = 0; i + 1 < linksAndLabels.length; i += 2) {
                if (linksAndLabels[i] == null) continue;
                l.add((MailLink) linksAndLabels[i]); lb.add((String) linksAndLabels[i + 1]);
            }
            if (!l.isEmpty()) blocks.add(new Blocks.Links(prefix, l, lb));
            return this;
        }
        public Builder list(String... items) { blocks.add(new Blocks.BulletList(Arrays.asList(items))); return this; }
        public Builder steps(Step... steps) { blocks.add(new Blocks.Steps(Arrays.asList(steps))); return this; }
        public Builder table(String[] header, List<String[]> rows) { blocks.add(new Blocks.Table(header, rows)); return this; }
        public Builder signature() { blocks.add(new Blocks.Signature()); return this; }
        public Mail build() { return new Mail(subject, preheader, blocks); }
    }
}
```

- [ ] **Step 6: Run the test**

Run: `mvn -o -q test -Dtest=MailBuilderTest -DfailIfNoTests=false`
Expected: 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/kccitm/api/service/email/theme src/test/java/com/kccitm/api/service/email/theme/MailBuilderTest.java
git commit -m "mail: theme tokens, blocks and Mail builder"
```

---

### Task 2: Link policy (`MailLinks`)

**Files:**
- Create: `service/email/theme/MailLinks.java`
- Test: `src/test/java/com/kccitm/api/service/email/theme/MailLinksTest.java`

**Interfaces:**
- Consumes: `ShortLinkService.codeFor(String url, String purpose)` (returns a code or null; never throws), `app.b2c.apiBaseUrl`.
- Produces: `MailLink MailLinks.of(String url)`, `MailLink of(String url, String purpose)`, `String rewrite(String html)`, `static boolean isLong(String url)`.

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.email.theme;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.kccitm.api.service.link.ShortLinkService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MailLinksTest {
    private ShortLinkService shortLinks;
    private MailLinks links;
    private static final String TOKENISED = "https://assessment.career-9.com/assessment/start?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79";

    @BeforeEach
    void setUp() {
        shortLinks = mock(ShortLinkService.class);
        links = new MailLinks();
        ReflectionTestUtils.setField(links, "shortLinkService", shortLinks);
        ReflectionTestUtils.setField(links, "apiBaseUrl", "https://api.career-9.com");
    }

    @Test
    void shortPageAddressIsLeftAlone() {
        MailLink l = links.of("https://dashboard.career-9.com/auth");
        assertEquals("https://dashboard.career-9.com/auth", l.getHref());
        assertEquals("dashboard.career-9.com/auth", l.getDisplay());
        verify(shortLinks, never()).codeFor(anyString(), anyString());
    }

    @Test
    void tokenisedLinkIsShortened() {
        when(shortLinks.codeFor(eq(TOKENISED), anyString())).thenReturn("Kx7Pq2M");
        MailLink l = links.of(TOKENISED, "assessment_start");
        assertEquals("https://api.career-9.com/s/Kx7Pq2M", l.getHref());
        assertEquals("api.career-9.com/s/Kx7Pq2M", l.getDisplay());
    }

    @Test
    void longLinkWithoutTokenIsShortenedToo() {
        String url = "https://storage-c9.sgp1.cdn.digitaloceanspaces.com/reports/2026/09/some-very-long-file-name-here.pdf";
        assertTrue(MailLinks.isLong(url));
        when(shortLinks.codeFor(eq(url), anyString())).thenReturn("Ab3Cd4E");
        assertEquals("api.career-9.com/s/Ab3Cd4E", links.of(url).getDisplay());
    }

    @Test
    void whenShorteningFailsTheDisplayHidesTheToken() {
        when(shortLinks.codeFor(anyString(), anyString())).thenReturn(null);
        MailLink l = links.of(TOKENISED);
        assertEquals(TOKENISED, l.getHref(), "the mail still works");
        assertEquals("assessment.career-9.com/assessment/start", l.getDisplay());
    }

    @Test
    void rewriteReplacesLongHrefsAndVisibleUrls() {
        when(shortLinks.codeFor(eq(TOKENISED), anyString())).thenReturn("Kx7Pq2M");
        String html = "<p><a href=\"" + TOKENISED + "\">Start</a> or copy " + TOKENISED + "</p><a href='https://career-9.com'>site</a>";
        String out = links.rewrite(html);
        assertFalse(out.contains("t=Ew-"));
        assertTrue(out.contains("href=\"https://api.career-9.com/s/Kx7Pq2M\""));
        assertTrue(out.contains("copy https://api.career-9.com/s/Kx7Pq2M"));
        assertTrue(out.contains("href='https://career-9.com'"));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `mvn -o -q test -Dtest=MailLinksTest -DfailIfNoTests=false`
Expected: compilation error, `MailLinks` missing.

- [ ] **Step 3: Implement**

```java
// theme/MailLinks.java
package com.kccitm.api.service.email.theme;

import java.util.LinkedHashSet;
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
        String out = html;
        for (String u : seen) {
            MailLink l = of(u, "foreign_html");
            if (l != null && !l.getHref().equals(u)) out = out.replace(u, l.getHref());
        }
        return out;
    }
}
```

- [ ] **Step 4: Run the test** — Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/kccitm/api/service/email/theme/MailLinks.java src/test/java/com/kccitm/api/service/email/theme/MailLinksTest.java
git commit -m "mail: link policy — shorten long or tokenised URLs, rewrite foreign html"
```

---

### Task 3: Brand, shell, renderer, rules

**Files:**
- Create: `service/email/theme/Brand.java`, `BrandResolver.java`, `MailShell.java`, `MailRenderer.java`, `MailRules.java`
- Modify: `src/main/resources/application.yml` (add `app.mail.logo-url`, `app.mail.site-url` under the default profile's `app:` block, next to `app.support`)
- Test: `src/test/java/com/kccitm/api/service/email/theme/MailRendererTest.java`, `MailRulesTest.java`

**Interfaces:**
- Consumes: `InstituteBrandingService.forInstitute/forInstituteCode/forUserStudent` → `BrandingDto`; `EmailSendRequest.getInstituteCode()/getUserStudentId()`.
- Produces: `Brand.standard(logoUrl, support, site, year)`, `Brand.whitelabel(school, schoolLogo, logoUrl, support, site, year)`; `BrandResolver.standard()`, `forInstitute(InstituteDetail)`, `forInstituteCode(Integer)`, `forUserStudent(Long)`, `forRequest(EmailSendRequest)`; `MailShell.render(Mail, Brand)`, `MailShell.text(Mail, Brand)`, `MailShell.wrapForeign(String html, Brand)`, `MailShell.preheaderFrom(String html)`, `MailShell.bodyHtml(Mail)`; `MailRenderer.render(Mail, Brand)` and `wrapForeign(String subject, String html, Brand)` → `MailRenderer.Rendered{subject, html, text}`; `MailRules.violations(Mail)`.

- [ ] **Step 1: Write the failing tests**

```java
package com.kccitm.api.service.email.theme;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailRendererTest {
    private static final Brand STD = Brand.standard("https://cdn.example/logo.png", "support@career-9.net", "https://career-9.com", 2026);
    private static final Brand WL = Brand.whitelabel("Delhi Public School, Noida", "https://cdn.example/dps.png", "https://cdn.example/logo.png", "support@career-9.net", "https://career-9.com", 2026);
    private static final Mail MAIL = Mail.builder().subject("Your login details").preheader("Username and password inside.")
            .title("Your login details").p("Hi " + Mail.v("Aarav") + ",").action(MailLink.plain("https://dashboard.career-9.com/auth"), "Sign in").signature().build();

    @Test
    void standardShellHasStripLogoHelpAndFooter() {
        String html = MailShell.render(MAIL, STD);
        assertTrue(html.contains(MailTheme.SHELL_MARKER));
        assertTrue(html.contains("background:#1B5E20;height:8px"));
        assertTrue(html.contains("src=\"https://cdn.example/logo.png\" width=\"127\" height=\"48\" alt=\"Career-9\""));
        assertTrue(html.contains("Help: <a href=\"mailto:support@career-9.net\""));
        assertTrue(html.contains("Career-9 &middot; Ensuring Career Success"));
        assertTrue(html.contains("&copy; 2026 Career-9. All rights reserved."));
        assertTrue(html.contains("display:none;max-height:0;overflow:hidden;opacity:0;\">Username and password inside."));
        assertFalse(html.contains("linear-gradient"));
    }

    @Test
    void whitelabelShellUsesSchoolMarkAndOnBehalfLine() {
        String html = MailShell.render(MAIL, WL);
        assertTrue(html.contains("src=\"https://cdn.example/dps.png\" width=\"36\" height=\"36\""));
        assertTrue(html.contains("Delhi Public School, Noida"));
        assertTrue(html.contains("Powered by Career-9"));
        assertTrue(html.contains("Sent by Career-9 on behalf of Delhi Public School, Noida."));
        assertFalse(html.contains("Ensuring Career Success"));
    }

    @Test
    void textPartCarriesBlocksAndFooter() {
        String text = MailShell.text(MAIL, STD);
        assertTrue(text.startsWith("YOUR LOGIN DETAILS\n\nHi Aarav,\n\nSign in: dashboard.career-9.com/auth\n\nRegards,\nCareer-9 Team"));
        assertTrue(text.endsWith("Questions? Write to support@career-9.net\n© 2026 Career-9. All rights reserved. · career-9.com"));
    }

    @Test
    void wrapForeignAddsShellOnceAndDerivesPreheader() {
        String foreign = "<div><p>Dear Mr Menon, please find the reports attached.</p></div>";
        String once = MailShell.wrapForeign(foreign, STD);
        assertTrue(once.contains(MailTheme.SHELL_MARKER));
        assertTrue(once.contains("Dear Mr Menon, please find the reports attached."));
        assertSame(once, MailShell.wrapForeign(once, STD), "already shelled html is returned untouched");
        assertEquals("Dear Mr Menon, please find the reports attached.", MailShell.preheaderFrom(foreign));
        assertEquals(90, MailShell.preheaderFrom("<p>" + "x".repeat(200) + "</p>").length());
    }

    @Test
    void wrapForeignStripsADocumentWrapper() {
        String doc = "<!DOCTYPE html><html><head><style>p{color:red}</style></head><body style=\"margin:0\"><p>Hello</p></body></html>";
        String out = MailShell.wrapForeign(doc, STD);
        assertFalse(out.contains("<html"));
        assertFalse(out.contains("<style>"));
        assertTrue(out.contains("<p>Hello</p>"));
    }
}
```

```java
package com.kccitm.api.service.email.theme;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailRulesTest {
    private static final MailLink OK = MailLink.plain("https://dashboard.career-9.com/auth");

    @Test
    void cleanMailHasNoViolations() {
        Mail m = Mail.builder().subject("Your login details").preheader("Sign in to begin.")
                .title("Your login details").p("Hi Aarav,").action(OK, "Sign in").signature().build();
        assertEquals(List.of(), MailRules.violations(m));
    }

    @Test
    void flagsEachRule() {
        Mail m = Mail.builder()
                .subject("Congratulations! You have completed the Career Discovery Assessment today")
                .preheader("")
                .p("Copy https://assessment.career-9.com/start?t=abc into your browser, or reply to this email.")
                .action(OK, "One").action(OK, "Two")
                .outline(OK, "A").outline(OK, "B")
                .action(MailLink.of("https://x/?t=abc", "x/?t=abc"), "Bad display")
                .build();
        List<String> v = MailRules.violations(m);
        assertTrue(v.stream().anyMatch(s -> s.contains("subject over 60")));
        assertTrue(v.stream().anyMatch(s -> s.contains("exclamation")));
        assertTrue(v.stream().anyMatch(s -> s.contains("no preheader")));
        assertTrue(v.stream().anyMatch(s -> s.contains("raw URL")));
        assertTrue(v.stream().anyMatch(s -> s.contains("replying")));
        assertTrue(v.stream().anyMatch(s -> s.contains("3 primary buttons")));
        assertTrue(v.stream().anyMatch(s -> s.contains("2 secondary buttons")));
        assertTrue(v.stream().anyMatch(s -> s.contains("link display carries a token")));
    }
}
```

- [ ] **Step 2: Run them to verify they fail** — `mvn -o -q test -Dtest='MailRendererTest,MailRulesTest' -DfailIfNoTests=false` — Expected: compilation errors.

- [ ] **Step 3: Write `Brand` and `BrandResolver`**

```java
// theme/Brand.java
package com.kccitm.api.service.email.theme;

public final class Brand {
    private final boolean whitelabel; private final String schoolName; private final String schoolLogoUrl;
    private final String logoUrl; private final String supportEmail; private final String siteUrl; private final int year;

    private Brand(boolean wl, String school, String schoolLogo, String logo, String support, String site, int year) {
        this.whitelabel = wl; this.schoolName = school; this.schoolLogoUrl = schoolLogo; this.logoUrl = logo;
        this.supportEmail = support; this.siteUrl = site; this.year = year;
    }
    public static Brand standard(String logoUrl, String support, String site, int year) { return new Brand(false, null, null, logoUrl, support, site, year); }
    public static Brand whitelabel(String school, String schoolLogo, String logoUrl, String support, String site, int year) { return new Brand(true, school, schoolLogo, logoUrl, support, site, year); }
    public boolean isWhitelabel() { return whitelabel; }
    public String getSchoolName() { return schoolName; }
    public String getSchoolLogoUrl() { return schoolLogoUrl; }
    public String getLogoUrl() { return logoUrl; }
    public String getSupportEmail() { return supportEmail; }
    public String getSiteUrl() { return siteUrl; }
    public String getSiteDisplay() { return siteUrl == null ? "" : siteUrl.replaceFirst("^https?://", "").replaceAll("/+$", ""); }
    public int getYear() { return year; }
    /** "Career-9" or the school name — what copy like "Your {brand} report" should say. */
    public String getName() { return whitelabel ? schoolName : "Career-9"; }
}
```

```java
// theme/BrandResolver.java
package com.kccitm.api.service.email.theme;

import java.time.Year;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;

/** Rule 11: the shell decides branding. Callers pass an institute or a student; nobody passes header HTML. */
@Service
public class BrandResolver {
    @Autowired private InstituteBrandingService brandingService;
    @Value("${app.mail.logo-url:https://storage-c9.sgp1.cdn.digitaloceanspaces.com/branding/career-9-email-v1.png}") private String logoUrl;
    @Value("${app.mail.site-url:https://career-9.com}") private String siteUrl;
    @Value("${app.support.email:support@career-9.net}") private String supportEmail;

    public Brand standard() { return Brand.standard(logoUrl, supportEmail, siteUrl, Year.now().getValue()); }
    public Brand of(BrandingDto dto) {
        if (dto == null || !dto.isWhitelabel()) return standard();
        return Brand.whitelabel(dto.getSchoolName(), dto.getLogoUrl(), logoUrl, supportEmail, siteUrl, Year.now().getValue());
    }
    public Brand forInstitute(InstituteDetail institute) { return of(brandingService.forInstitute(institute)); }
    public Brand forInstituteCode(Integer code) { return code == null ? standard() : of(brandingService.forInstituteCode(code)); }
    public Brand forUserStudent(Long userStudentId) { return userStudentId == null ? standard() : of(brandingService.forUserStudent(userStudentId)); }
    public Brand forRequest(EmailSendRequest req) {
        if (req.getBrand() != null) return req.getBrand();
        if (req.getInstituteCode() != null) return forInstituteCode(req.getInstituteCode());
        if (req.getUserStudentId() != null) return forUserStudent(req.getUserStudentId());
        return standard();
    }
}
```

`req.getBrand()` does not exist yet; Task 4 adds it. To keep this task compiling on its own, add to `EmailSendRequest` now:

```java
    /** Optional branding decided by the caller (e.g. the report pipeline carries it on the event). */
    private com.kccitm.api.service.email.theme.Brand brand;
    public com.kccitm.api.service.email.theme.Brand getBrand() { return brand; }
    public void setBrand(com.kccitm.api.service.email.theme.Brand brand) { this.brand = brand; }
```

- [ ] **Step 4: Write `MailShell`**

```java
// theme/MailShell.java
package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static com.kccitm.api.service.email.theme.MailHtml.esc;
import static com.kccitm.api.service.email.theme.MailHtml.escAttr;
import static com.kccitm.api.service.email.theme.MailTheme.*;

/** Shell A3. Tables and inline styles only: Outlook renders through Word and Gmail strips head styles. */
public final class MailShell {
    private static final Pattern BODY = Pattern.compile("(?is)<body[^>]*>(.*)</body>");
    private static final Pattern STRIP = Pattern.compile("(?is)<style[^>]*>.*?</style>|<!doctype[^>]*>|</?(html|head|body)[^>]*>|<meta[^>]*>|<title>.*?</title>");
    private MailShell() { }

    public static String render(Mail mail, Brand brand) {
        StringBuilder body = new StringBuilder();
        for (Block b : mail.getBlocks()) body.append(b.html());
        return shell(mail.getPreheader(), body.toString(), brand);
    }

    /** Blocks only, no shell — for seeded templates that the dispatcher wraps at send time. */
    public static String bodyHtml(Mail mail) {
        StringBuilder body = new StringBuilder();
        for (Block b : mail.getBlocks()) body.append(b.html());
        return body.toString();
    }

    public static String text(Mail mail, Brand brand) {
        List<String> out = new ArrayList<>();
        for (Block b : mail.getBlocks()) { String t = b.text(); if (t != null && !t.isEmpty()) out.add(t); }
        out.add("--\n" + footerText(brand));
        return String.join("\n\n", out);
    }

    public static String wrapForeign(String html, Brand brand) {
        if (html == null) html = "";
        if (html.contains(SHELL_MARKER)) return html;
        Matcher m = BODY.matcher(html);
        String inner = m.find() ? m.group(1) : html;
        inner = STRIP.matcher(inner).replaceAll("").trim();
        return shell(preheaderFrom(inner), inner, brand);
    }

    /** First 90 visible characters of foreign HTML, for the inbox line. */
    public static String preheaderFrom(String html) {
        String t = MailHtml.textOf(html).replaceAll("\\s+", " ").trim();
        return t.length() <= MAX_PREHEADER ? t : t.substring(0, MAX_PREHEADER);
    }

    static String shell(String preheader, String body, Brand brand) {
        String pre = "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">" + esc(preheader == null ? "" : preheader)
                + "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>";
        return pre
            + "<div style=\"background:" + GROUND + ";padding:32px 12px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" " + SHELL_MARKER + "><tr><td align=\"center\">"
            + "<table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:560px;\">"
            + "<tr><td style=\"background:" + PRIMARY + ";height:8px;font-size:0;line-height:0;border-radius:6px 6px 0 0;\">&nbsp;</td></tr>"
            + "<tr><td style=\"background:" + WHITE + ";border:1px solid " + BORDER + ";border-top:none;padding:16px 28px;\">" + headerRow(brand) + "</td></tr>"
            + "<tr><td style=\"background:" + WHITE + ";border:1px solid " + BORDER + ";border-top:1px solid " + BORDER + ";border-radius:0 0 6px 6px;padding:28px 28px 24px;\">" + body + "</td></tr>"
            + "<tr><td style=\"padding:16px 4px 0;font-family:" + FONT + ";font-size:12px;line-height:1.7;color:" + FAINT + ";\">" + footerHtml(brand) + "</td></tr>"
            + "</table></td></tr></table></div>";
    }

    private static String headerRow(Brand brand) {
        String mark;
        if (brand.isWhitelabel()) {
            mark = "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
                 + "<td style=\"vertical-align:middle;\"><img src=\"" + escAttr(brand.getSchoolLogoUrl()) + "\" width=\"36\" height=\"36\" alt=\"" + escAttr(brand.getSchoolName()) + " logo\" style=\"display:block;border:0;border-radius:4px;\"></td>"
                 + "<td style=\"padding-left:12px;vertical-align:middle;\"><div style=\"font-family:" + FONT + ";font-size:15px;font-weight:700;line-height:1.2;color:" + INK + ";\">" + esc(brand.getSchoolName()) + "</div>"
                 + "<div style=\"font-family:" + FONT + ";font-size:11px;letter-spacing:.3px;margin-top:2px;color:" + FAINT + ";\">Powered by Career-9</div></td></tr></table>";
        } else {
            mark = "<img src=\"" + escAttr(brand.getLogoUrl()) + "\" width=\"127\" height=\"48\" alt=\"Career-9\" style=\"display:block;border:0;\">";
        }
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
             + "<td style=\"vertical-align:middle;\">" + mark + "</td>"
             + "<td align=\"right\" style=\"vertical-align:middle;font-family:" + FONT + ";font-size:12px;color:" + FAINT + ";\">Help: <a href=\"mailto:" + escAttr(brand.getSupportEmail()) + "\" style=\"color:" + FAINT + ";text-decoration:none;\">" + esc(brand.getSupportEmail()) + "</a></td>"
             + "</tr></table>";
    }

    private static String footerHtml(Brand b) {
        String first = b.isWhitelabel() ? "Sent by Career-9 on behalf of " + esc(b.getSchoolName()) + "." : "Career-9 &middot; Ensuring Career Success";
        return first + "<br>Questions? Write to <a href=\"mailto:" + escAttr(b.getSupportEmail()) + "\" style=\"color:" + PRIMARY + ";text-decoration:underline;\">" + esc(b.getSupportEmail()) + "</a>"
             + "<br>&copy; " + b.getYear() + " Career-9. All rights reserved. &middot; <a href=\"" + escAttr(b.getSiteUrl()) + "\" style=\"color:" + PRIMARY + ";text-decoration:none;\">" + esc(b.getSiteDisplay()) + "</a>";
    }

    private static String footerText(Brand b) {
        String first = b.isWhitelabel() ? "Sent by Career-9 on behalf of " + b.getSchoolName() + "." : "Career-9 · Ensuring Career Success";
        return first + "\nQuestions? Write to " + b.getSupportEmail() + "\n© " + b.getYear() + " Career-9. All rights reserved. · " + b.getSiteDisplay();
    }
}
```

- [ ] **Step 5: Write `MailRenderer` and `MailRules`**

```java
// theme/MailRenderer.java
package com.kccitm.api.service.email.theme;

import org.springframework.stereotype.Service;

@Service
public class MailRenderer {
    public static final class Rendered {
        public final String subject; public final String html; public final String text;
        public Rendered(String subject, String html, String text) { this.subject = subject; this.html = html; this.text = text; }
    }
    public Rendered render(Mail mail, Brand brand) {
        return new Rendered(mail.getSubject(), MailShell.render(mail, brand), MailShell.text(mail, brand));
    }
    /** Foreign HTML in the shell, with a text part derived from it. */
    public Rendered wrapForeign(String subject, String html, Brand brand) {
        String shelled = MailShell.wrapForeign(html, brand);
        String text = MailHtml.textOf(html.replaceAll("(?i)</(p|div|tr|li|h[1-6])>", "\n")).replaceAll("\n{3,}", "\n\n");
        return new Rendered(subject, shelled, text);
    }
    public String bodyHtml(Mail mail) { return MailShell.bodyHtml(mail); }
}
```

```java
// theme/MailRules.java
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
```

Add to `application.yml` under the default profile's `app:` (next to `support:`; the other profiles inherit the defaults):

```yaml
  mail:
    logo-url: ${APP_MAIL_LOGO_URL:https://storage-c9.sgp1.cdn.digitaloceanspaces.com/branding/career-9-email-v1.png}
    site-url: https://career-9.com
```

- [ ] **Step 6: Run the tests** — `mvn -o -q test -Dtest='MailRendererTest,MailRulesTest,MailBuilderTest,MailLinksTest' -DfailIfNoTests=false` — Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/kccitm/api/service/email/theme src/main/java/com/kccitm/api/model/email/EmailSendRequest.java src/main/resources/application.yml src/test/java/com/kccitm/api/service/email/theme
git commit -m "mail: brand resolver, A3 shell, renderer and rule checks"
```

---

### Task 4: Dispatcher renders `Mail` and wraps everything else

**Files:**
- Modify: `model/email/EmailSendRequest.java` (add `mail` + factory), `service/email/EmailDispatchService.java` (`buildMessage`, `send`, `sendTestThroughAccount`), `service/email/EmailTemplateService.java` (`preview`)
- Test: `src/test/java/com/kccitm/api/service/email/EmailDispatchWrapTest.java`

**Interfaces:**
- Produces: `EmailSendRequest.mail(EmailType, String to, Mail)`, `setMail(Mail)`, `getMail()`; `EmailDispatchService.sendMail(EmailType, String to, Mail)`; every outgoing message has `htmlContent` containing `MailTheme.SHELL_MARKER` and a non-empty `textContent`.

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.email;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import com.kccitm.api.model.email.*;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.repository.email.*;
import com.kccitm.api.service.email.theme.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmailDispatchWrapTest {
    private EmailDispatchService dispatch;
    private EmailSender sender;
    private EmailAccount account;

    @BeforeEach
    void setUp() {
        dispatch = new EmailDispatchService();
        account = new EmailAccount(); account.setId(1L); account.setActive(true); account.setFromEmail("n@career-9.net"); account.setFromName("Career-9");
        EmailAccountRepository accounts = mock(EmailAccountRepository.class);
        when(accounts.findFirstByIsGlobalDefaultTrueAndActiveTrue()).thenReturn(java.util.Optional.of(account));
        EmailTemplateRepository templates = mock(EmailTemplateRepository.class);
        when(templates.findFirstByEmailTypeAndIsDefaultTrueAndActiveTrue(anyString())).thenReturn(java.util.Optional.empty());
        EmailSendLogRepository logs = mock(EmailSendLogRepository.class);
        when(logs.save(any())).thenAnswer(i -> i.getArgument(0));
        sender = mock(EmailSender.class);
        SenderFactory factory = mock(SenderFactory.class);
        when(factory.forAccount(any())).thenReturn(sender);
        BrandResolver brands = mock(BrandResolver.class);
        when(brands.forRequest(any())).thenReturn(Brand.standard("https://cdn/logo.png", "support@career-9.net", "https://career-9.com", 2026));
        MailLinks links = mock(MailLinks.class);
        when(links.rewrite(anyString())).thenAnswer(i -> i.getArgument(0));
        ReflectionTestUtils.setField(dispatch, "accountRepository", accounts);
        ReflectionTestUtils.setField(dispatch, "templateRepository", templates);
        ReflectionTestUtils.setField(dispatch, "logRepository", logs);
        ReflectionTestUtils.setField(dispatch, "senderFactory", factory);
        ReflectionTestUtils.setField(dispatch, "placeholderResolver", mock(PlaceholderResolver.class));
        ReflectionTestUtils.setField(dispatch, "templateRenderer", new EmailTemplateRenderer());
        ReflectionTestUtils.setField(dispatch, "brandResolver", brands);
        ReflectionTestUtils.setField(dispatch, "mailRenderer", new MailRenderer());
        ReflectionTestUtils.setField(dispatch, "mailLinks", links);
        ReflectionTestUtils.setField(dispatch, "instituteEmailSettingRepository", mock(InstituteEmailSettingRepository.class));
    }

    private SmtpEmailRequest sent() throws Exception {
        ArgumentCaptor<SmtpEmailRequest> c = ArgumentCaptor.forClass(SmtpEmailRequest.class);
        verify(sender).send(c.capture());
        return c.getValue();
    }

    @Test
    void aMailIsRenderedWithShellAndTextPart() throws Exception {
        Mail m = Mail.builder().subject("Your login details").preheader("Inside.").title("Your login details").p("Hi Aarav,").signature().build();
        EmailSendRequest r = EmailSendRequest.mail(EmailType.LOGIN_CREDENTIALS, "a@example.com", m);
        r.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        dispatch.send(r);
        SmtpEmailRequest s = sent();
        assertEquals("Your login details", s.getSubject());
        assertTrue(s.getHtmlContent().contains(MailTheme.SHELL_MARKER));
        assertTrue(s.getTextContent().contains("Hi Aarav,"));
    }

    @Test
    void passThroughHtmlIsWrappedOnce() throws Exception {
        EmailSendRequest r = EmailSendRequest.html(EmailType.GENERIC, "a@example.com", "Hello", "<p>Dear Mr Menon, reports attached.</p>");
        r.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        dispatch.send(r);
        SmtpEmailRequest s = sent();
        assertEquals(1, s.getHtmlContent().split(MailTheme.SHELL_MARKER, -1).length - 1);
        assertTrue(s.getHtmlContent().contains("Dear Mr Menon, reports attached."));
        assertEquals("Dear Mr Menon, reports attached.", s.getTextContent().trim());
    }

    @Test
    void plainTextIsWrappedAsParagraphs() throws Exception {
        EmailSendRequest r = new EmailSendRequest();
        r.setEmailType(EmailType.GENERIC); r.getTo().add("a@example.com"); r.setSubject("Hi"); r.setTextContent("Line one <x>\n\nLine two");
        r.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        dispatch.send(r);
        SmtpEmailRequest s = sent();
        assertTrue(s.getHtmlContent().contains("Line one &lt;x&gt;"));
        assertEquals("Line one <x>\n\nLine two", s.getTextContent());
    }
}
```

Check the repository method names used above against `EmailDispatchService.resolveAccount/resolveTemplate` before running; use whatever those methods call.

- [ ] **Step 2: Run it to verify it fails** — `mvn -o -q test -Dtest=EmailDispatchWrapTest -DfailIfNoTests=false` — Expected: compilation error (`EmailSendRequest.mail`, fields `brandResolver`/`mailRenderer`/`mailLinks` missing).

- [ ] **Step 3: Add `mail` to `EmailSendRequest`**

```java
    /** A themed mail; when set, subject/html/text are rendered from it (a DB template still wins). */
    private com.kccitm.api.service.email.theme.Mail mail;
    public com.kccitm.api.service.email.theme.Mail getMail() { return mail; }
    public void setMail(com.kccitm.api.service.email.theme.Mail mail) { this.mail = mail; }

    public static EmailSendRequest mail(EmailType type, String to, com.kccitm.api.service.email.theme.Mail mail) {
        EmailSendRequest r = new EmailSendRequest();
        r.emailType = type;
        if (to != null) r.to.add(to);
        r.mail = mail;
        r.subject = mail != null ? mail.getSubject() : null;
        return r;
    }
```

- [ ] **Step 4: Change `EmailDispatchService`**

Add fields and a convenience:

```java
    @Autowired private com.kccitm.api.service.email.theme.BrandResolver brandResolver;
    @Autowired private com.kccitm.api.service.email.theme.MailRenderer mailRenderer;
    @Autowired private com.kccitm.api.service.email.theme.MailLinks mailLinks;

    public EmailSendResult sendMail(EmailType type, String to, com.kccitm.api.service.email.theme.Mail mail) {
        return send(EmailSendRequest.mail(type, to, mail));
    }
```

Replace the content part of `buildMessage` (keep from/to/cc/bcc/attachments as they are):

```java
        com.kccitm.api.service.email.theme.Brand brand = brandResolver.forRequest(req);
        com.kccitm.api.service.email.theme.MailRenderer.Rendered r;
        if (template != null) {
            Map<String, String> ctx = placeholderResolver.resolve(req);
            String subject = templateRenderer.render(template.getSubjectTemplate(), ctx);
            if (subject == null || subject.trim().isEmpty()) subject = req.getSubject();
            String html = mailLinks.rewrite(templateRenderer.render(template.getBodyTemplate(), ctx));
            r = mailRenderer.wrapForeign(subject, html, brand);
        } else if (req.getMail() != null) {
            r = mailRenderer.render(req.getMail(), brand);
            if (req.getSubject() != null && !req.getSubject().equals(r.subject)) r = new com.kccitm.api.service.email.theme.MailRenderer.Rendered(req.getSubject(), r.html, r.text);
            for (String v : com.kccitm.api.service.email.theme.MailRules.violations(req.getMail())) logger.warn("Mail rule broken for {}: {}", req.getEmailType(), v);
        } else if (req.getHtmlContent() != null && !req.getHtmlContent().trim().isEmpty()) {
            r = mailRenderer.wrapForeign(req.getSubject(), mailLinks.rewrite(req.getHtmlContent()), brand);
            if (req.getTextContent() != null && !req.getTextContent().isEmpty()) r = new com.kccitm.api.service.email.theme.MailRenderer.Rendered(r.subject, r.html, req.getTextContent());
        } else {
            String text = req.getTextContent() == null ? "" : req.getTextContent();
            StringBuilder html = new StringBuilder();
            for (String para : text.split("\\n\\s*\\n")) html.append("<p>").append(escapeHtml(para).replace("\n", "<br>")).append("</p>");
            r = mailRenderer.wrapForeign(req.getSubject(), html.toString(), brand);
            r = new com.kccitm.api.service.email.theme.MailRenderer.Rendered(r.subject, r.html, text);
        }
        m.setSubject(r.subject);
        m.setHtmlContent(r.html);
        m.setTextContent(r.text);
```

with a private `escapeHtml` (same four replacements as `PlaceholderResolver.escapeHtml`). In `send(...)`, after `buildMessage`, add `if (req.getSubject() == null) req.setSubject(message.getSubject());` so the log row carries the rendered subject. `sendTestThroughAccount` already calls `buildMessage(req, account, null)`, so the test mail is wrapped too.

In `EmailTemplateService.preview`, wrap the rendered body so the editor shows the shell: inject `MailRenderer mailRenderer` and `BrandResolver brandResolver` and replace `out.put("html", renderer.render(form.bodyTemplate, ctx));` with `out.put("html", mailRenderer.wrapForeign(null, renderer.render(form.bodyTemplate, ctx), brandResolver.standard()).html);`.

- [ ] **Step 5: Run the test plus the routing arch test** — `mvn -o -q test -Dtest='EmailDispatchWrapTest,EmailDispatchRoutingTest' -DfailIfNoTests=false` — Expected: pass.

- [ ] **Step 6: Compile everything and commit**

```bash
mvn -o -q -DskipTests compile
git add src/main/java/com/kccitm/api/model/email/EmailSendRequest.java src/main/java/com/kccitm/api/service/email/EmailDispatchService.java src/main/java/com/kccitm/api/service/email/EmailTemplateService.java src/test/java/com/kccitm/api/service/email/EmailDispatchWrapTest.java
git commit -m "mail: dispatcher renders Mail values and wraps foreign html in the shell"
```

From this commit on, every mail already goes out in the shell (wrapped); the remaining tasks replace bodies with proper blocks.

---

### Task 5: Catalogue test scaffold

**Files:**
- Create: `src/test/java/com/kccitm/api/service/email/mails/MailSamples.java`, `MailCatalogueTest.java`

**Interfaces:**
- Produces: `MailSamples.all()` → `Map<String, Mail>` keyed by the catalogue ids from `mail_specs.py`; `MailSamples.L(String url)` (a plain or pre-shortened `MailLink` for samples: URLs over 60 chars or with a token become `https://api.career-9.com/s/Kx7Pq2M`). Tasks 6–12 each add their module's entries.

- [ ] **Step 1: Write the registry and test**

```java
package com.kccitm.api.service.email.mails;

import java.util.LinkedHashMap;
import java.util.Map;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import com.kccitm.api.service.email.theme.MailLinks;

/** Every live mail with sample values, keyed by catalogue id. Grows one module at a time. */
public final class MailSamples {
    public static final String SHORT = "https://api.career-9.com/s/Kx7Pq2M";
    static final String FIRST = "Aarav", STUDENT = "Aarav Sharma", COUNSELLOR = "Priya Iyer", ASSESSMENT = "Career Discovery Assessment",
            SCHOOL = "Delhi Public School, Noida", DATE = "Thursday, 18 Sep 2026", TIME = "4:30 – 5:00 PM IST", MODE = "Online (Google Meet)";
    private MailSamples() { }

    /** What MailLinks.of would produce for this url, without a database. */
    public static MailLink L(String url) {
        return MailLinks.isLong(url) ? MailLink.of(SHORT, "api.career-9.com/s/Kx7Pq2M") : MailLink.plain(url);
    }
    static final MailLink SIGN_IN = L("https://dashboard.career-9.com/auth");
    static final MailLink LOGIN = L("https://assessment.career-9.com/student-login");
    static final MailLink MAGIC = L("https://assessment.career-9.com/assessment/start?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79");
    static final MailLink JOIN = L("https://meet.google.com/abc-defg-hij");
    static final MailLink SESSIONS = L("https://dashboard.career-9.com/counselling/my-sessions");
    static final MailLink PORTAL = L("https://dashboard.career-9.com/counsellor/sessions");
    static final MailLink REPORT = L("https://storage-c9.sgp1.cdn.digitaloceanspaces.com/reports/2026/09/aarav-sharma-career-report.html");

    public static Map<String, Mail> all() {
        Map<String, Mail> m = new LinkedHashMap<>();
        // Task 6 adds: m.put("login-credentials", AccountMails.loginCredentials(...)); …
        return m;
    }
}
```

```java
package com.kccitm.api.service.email.mails;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import com.kccitm.api.service.email.theme.*;
import static org.junit.jupiter.api.Assertions.*;

/** Rule 14: every mail, rendered with sample data, must pass the rules — and leaves an html file behind for eyeballing. */
class MailCatalogueTest {
    private static final Brand BRAND = Brand.standard("https://storage-c9.sgp1.cdn.digitaloceanspaces.com/branding/career-9-email-v1.png", "support@career-9.net", "https://career-9.com", 2026);

    @Test
    void everyMailFollowsTheRules() throws Exception {
        Map<String, Mail> all = MailSamples.all();
        assertFalse(all.isEmpty());
        List<String> problems = new ArrayList<>();
        Path dir = Path.of("target", "mail-samples");
        Files.createDirectories(dir);
        for (Map.Entry<String, Mail> e : all.entrySet()) {
            Mail mail = e.getValue();
            for (String v : MailRules.violations(mail)) problems.add(e.getKey() + ": " + v);
            String html = MailShell.render(mail, BRAND);
            String text = MailShell.text(mail, BRAND);
            if (!html.contains(MailTheme.SHELL_MARKER)) problems.add(e.getKey() + ": no shell");
            if (html.contains("{{")) problems.add(e.getKey() + ": unresolved placeholder");
            if (html.contains("linear-gradient")) problems.add(e.getKey() + ": gradient");
            if (text.trim().isEmpty()) problems.add(e.getKey() + ": empty text part");
            Files.writeString(dir.resolve(e.getKey() + ".html"), "<!doctype html><meta charset=utf-8><title>" + e.getKey() + "</title>" + html);
            Files.writeString(dir.resolve(e.getKey() + ".txt"), "Subject: " + mail.getSubject() + "\n\n" + text);
        }
        assertEquals(List.of(), problems, String.join("\n", problems));
    }
}
```

- [ ] **Step 2: Run it** — `mvn -o -q test -Dtest=MailCatalogueTest -DfailIfNoTests=false` — Expected: fails on `assertFalse(all.isEmpty())` (the registry is empty until Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/test/java/com/kccitm/api/service/email/mails
git commit -m "mail: catalogue test scaffold"
```

---

### Task 6: Account mails (7) and their callers

**Files:**
- Create: `service/email/mails/AccountMails.java`
- Modify: `service/LoginCredentialsEmailService.java:52-104` (send + seed helpers), `controller/career9/SchoolRegistrationController.java:1139-1166`, `controller/career9/AssessmentInstituteMappingController.java:1780-1809`, `controller/AuthController.java:653-660, 672-706, 759-766, 780-812`, `controller/UserController.java:478-583`
- Test: add entries to `MailSamples.all()`

**Interfaces:**
- Consumes: `Mail`, `MailLink`, `MailLinks.of(url, purpose)`, `EmailDispatchService.sendMail(type, to, mail)`, `EmailSendRequest.mail(...)`, `LinkBuilder.studentLogin()`, `LinkBuilder.manualLogin()`, `app.frontend.url`.
- Produces (all `public static Mail`): `AccountMails.loginCredentials(String brandName, String firstName, String username, String password, MailLink signIn)`, `registrationSuccess(String firstName, String assessmentName, String username, String password, MailLink signIn)`, `accountWelcome(String firstName)`, `passwordResetLink(String firstName, int minutes, MailLink reset)`, `passwordResetConfirm(String firstName, MailLink signIn)`, `adminPasswordReset(String firstName, String newPassword, MailLink signIn)`, `accountActivated(String firstName, MailLink signIn)`; `AccountMails.firstName(String fullName)`.

- [ ] **Step 1: Add the samples (failing)**

In `MailSamples.all()`:

```java
        m.put("login-credentials", AccountMails.loginCredentials("Career-9", FIRST, "20260412", "15-05-2010", SIGN_IN));
        m.put("school-registration-success", AccountMails.registrationSuccess(FIRST, ASSESSMENT, "20260412", "15-05-2010", LOGIN));
        m.put("account-welcome", AccountMails.accountWelcome(FIRST));
        m.put("password-reset-link", AccountMails.passwordResetLink(FIRST, 60, L("https://dashboard.career-9.com/auth/reset-password/3f9c1c2e-6b1a-4a8e-9a0f-1b2c3d4e5f60")));
        m.put("password-reset-confirm", AccountMails.passwordResetConfirm(FIRST, SIGN_IN));
        m.put("admin-password-reset", AccountMails.adminPasswordReset("Meera", "Tq7#kd2p", SIGN_IN));
        m.put("account-activated", AccountMails.accountActivated("Meera", SIGN_IN));
```

Run `mvn -o -q test -Dtest=MailCatalogueTest -DfailIfNoTests=false` — Expected: compilation error, `AccountMails` missing.

- [ ] **Step 2: Write `AccountMails`** (wording is `mail_specs.py` ids `login-credentials`, `school-registration-success`, `account-welcome`, `password-reset-link`, `password-reset-confirm`, `admin-password-reset`, `account-activated`)

```java
package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

/** Registration, sign-in and password mails. Pure: strings and links in, Mail out. */
public final class AccountMails {
    static final String KEEP = "Keep these details safe. You will need them to resume the assessment and to open your report later.";
    static final String DOB_CAPTION = "Your password is your date of birth, DD-MM-YYYY.";
    private AccountMails() { }

    /** "Aarav Sharma" → "Aarav"; null/blank → "there". */
    public static String firstName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) return "there";
        String t = fullName.trim();
        return t.contains(" ") ? t.substring(0, t.indexOf(' ')) : t;
    }
    static String hi(String firstName) { return "Hi " + v(firstName) + ","; }

    public static Mail loginCredentials(String brandName, String firstName, String username, String password, MailLink signIn) {
        return Mail.builder()
            .subject("Your " + brandName + " login details")
            .preheader("Username and password to sign in and take your assessment.")
            .title("Your login details").p(hi(firstName))
            .p("Use the details below to sign in and take your assessment. You can pause and resume at any time.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
            .steps(new Mail.Step("Sign in", "Open the portal with the button below and enter the details above."),
                   new Mail.Step("Complete your assessment", "Pick the assessment assigned to you and answer honestly. There are no right or wrong answers."),
                   new Mail.Step("Get your report", "Once you submit, your Career Report is built across six career dimensions and appears in your dashboard."))
            .action(signIn, "Sign in").small(KEEP).signature().build();
    }

    public static Mail registrationSuccess(String firstName, String assessmentName, String username, String password, MailLink signIn) {
        return Mail.builder()
            .subject("You're registered for " + assessmentName)
            .preheader("Your username and password are inside. Sign in when you're ready.")
            .title("Registration successful").p(hi(firstName))
            .p("You are registered for " + b(assessmentName) + ". Sign in with the details below when you are ready to begin.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
            .action(signIn, "Sign in").small(KEEP).signature().build();
    }

    public static Mail accountWelcome(String firstName) {
        return Mail.builder().subject("Welcome to Career-9")
            .preheader("Your account is under review. We will let you know once it is active.")
            .title("Welcome to Career-9").p(hi(firstName))
            .p("Thanks for registering. Your account is under review and we will email you as soon as it is active.")
            .signature().build();
    }

    public static Mail passwordResetLink(String firstName, int minutes, MailLink reset) {
        return Mail.builder().subject("Reset your Career-9 password")
            .preheader("This link works once and expires in " + minutes + " minutes.")
            .title("Reset your password").p(hi(firstName))
            .p("We received a request to reset the password for your Career-9 account. Use the button below to choose a new one. The link works once and expires in " + b(minutes + " minutes") + ".")
            .action(reset, "Reset password")
            .small("If you did not request this, you can ignore this email. Your password stays as it is.")
            .signature().build();
    }

    public static Mail passwordResetConfirm(String firstName, MailLink signIn) {
        return Mail.builder().subject("Your Career-9 password was changed")
            .preheader("If this wasn't you, secure your account now.")
            .title("Your password was changed").p(hi(firstName))
            .p("The password for your Career-9 account was just changed.")
            .notice("If this wasn't you, reset your password again straight away and write to support@career-9.net so we can check the account.")
            .action(signIn, "Sign in").signature().build();
    }

    public static Mail adminPasswordReset(String firstName, String newPassword, MailLink signIn) {
        return Mail.builder().subject("Your Career-9 password has been reset")
            .preheader("An administrator set a new password for you. Change it after signing in.")
            .title("Your password has been reset").p(hi(firstName))
            .p("An administrator has reset the password for your Career-9 account.")
            .credentials("Sign in with your registered email and this password, then change it from your profile.", new Mail.Row("New password", newPassword))
            .action(signIn, "Sign in")
            .small("If you did not ask for this change, contact your administrator or write to support@career-9.net.")
            .signature().build();
    }

    public static Mail accountActivated(String firstName, MailLink signIn) {
        return Mail.builder().subject("Your Career-9 account is active")
            .preheader("You can sign in now with your registered email and password.")
            .title("Your account is active").p(hi(firstName))
            .p("Your Career-9 dashboard account has been activated. Sign in with your registered email and password.")
            .action(signIn, "Sign in").signature().build();
    }
}
```

Run `MailCatalogueTest` — Expected: pass, and `target/mail-samples/login-credentials.html` exists.

- [ ] **Step 3: Switch the callers**

`LoginCredentialsEmailService.send(...)`: replace the `renderBody` fallback with

```java
        Mail mail = AccountMails.loginCredentials(brand.isWhitelabel() ? brand.getSchoolName() : "Career-9",
                AccountMails.firstName(studentName), username, dob, mailLinks.of(linkBuilder.studentLogin(), "student_login"));
        EmailSendRequest req = EmailSendRequest.mail(EmailType.LOGIN_CREDENTIALS, recipientEmail, mail);
        if (institute != null && institute.getInstituteCode() != null) req.setInstituteCode(institute.getInstituteCode());
        req.put("student_name", studentName); req.put("username", username); req.put("password", dob);
        emailDispatchService.send(req);
```

(inject `MailLinks mailLinks`). Replace `defaultSubjectTemplate()`/`defaultBodyTemplate()` with token versions built from the theme: `defaultSubjectTemplate()` returns `"Your {{school_name}} login details"`; `defaultBodyTemplate()` returns `MailShell.bodyHtml(AccountMails.loginCredentials("{{school_name}}", "{{first_name}}", "{{username}}", "{{password}}", MailLink.of("{{dashboard_link}}", "")))` — but `action()` prints an "Or open:" line with an empty display, so for the seed use a copy of the builder with `.button(...)` instead: add `AccountMails.loginCredentialsSeed()` that is identical to `loginCredentials` except `.button(MailLink.of("{{dashboard_link}}", ""), "Sign in")`. Delete `renderBody`. Keep the old seed body as `LegacySeeds.LOGIN_CREDENTIALS_BODY` (move the current `renderBody("{{first_name}}", …)` output there verbatim as a string constant) — Task 12 needs its MD5.

`SchoolRegistrationController.sendRegistrationEmail` and `AssessmentInstituteMappingController.sendRegistrationEmail`: body becomes

```java
            Mail mail = AccountMails.registrationSuccess(AccountMails.firstName(studentName), assessmentName, username, dob,
                    mailLinks.of(linkBuilder.manualLogin(), "student_login"));
            emailDispatchService.sendMail(EmailType.SCHOOL_REGISTRATION /* or ASSESSMENT_INSTITUTE_MAPPING */, toEmail, mail);
```

(inject `LinkBuilder` and `MailLinks` in both controllers; delete the local `escapeHtml` if unused).

`AuthController`: signup → `emailDispatchService.sendMail(EmailType.ACCOUNT_WELCOME, user.getEmail(), AccountMails.accountWelcome(AccountMails.firstName(fullName)))`; forgot-password → `sendMail(EmailType.PASSWORD_RESET, user.getEmail(), AccountMails.passwordResetLink(AccountMails.firstName(user.getName()), RESET_TOKEN_TTL_MINUTES, mailLinks.of(resetLink, "password_reset")))`; reset-password → `sendMail(EmailType.PASSWORD_RESET_CONFIRM, user.getEmail(), AccountMails.passwordResetConfirm(AccountMails.firstName(user.getName()), mailLinks.of(frontendUrl.replaceAll("/+$", "") + "/auth", "dashboard_login")))`. Delete `buildResetEmailHtml`, `buildResetConfirmationHtml`.

`UserController.adminResetPassword`: `emailDispatchService.sendMail(EmailType.ADMIN_PASSWORD_RESET, user.getEmail(), AccountMails.adminPasswordReset(AccountMails.firstName(user.getName()), newPassword, mailLinks.of(frontendUrl + "/auth", "dashboard_login")))` with `@Value("${app.frontend.url}") private String frontendUrl;`. `toggleUserActive`: send `AccountMails.accountActivated(...)` **only when `newStatus` is true**; nothing on deactivation.

- [ ] **Step 4: Compile, run tests, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchRoutingTest' -DfailIfNoTests=false
git add -A src/main/java/com/kccitm/api/service/email/mails src/main/java/com/kccitm/api/service/LoginCredentialsEmailService.java src/main/java/com/kccitm/api/controller src/test/java/com/kccitm/api/service/email/mails
git commit -m "mail: account mails on the theme; account-activated only on activation"
```

---

### Task 7: Payment mails (5)

**Files:**
- Create: `service/email/mails/PaymentMails.java`
- Modify: `service/PaymentEmailService.java` (all five senders), `controller/career9/PaymentController.java:324-349` (resend passes the entitlement lookup through the service, no controller change needed if the service resolves it)
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Consumes: `LinkBuilder.manualLogin()`, `LinkBuilder.assessmentStart(token, entitlementId)`, `StudentEntitlementRepository.findByPaymentTransactionId(String)` (add if missing: `Optional<StudentEntitlement> findFirstByPaymentTransactionId(String)`), `EntitlementService.ensureLiveAccessToken(StudentEntitlement)`.
- Produces: `PaymentMails.paymentReceived(String firstName, String assessmentName, String username, String password, MailLink start)`, `welcomeResend(String firstName, String assessmentName, String username, String password, MailLink magic /*nullable*/, MailLink signIn)`, `paymentFailed(String firstName, String assessmentName, String amount, PaymentMails.Outcome outcome, MailLink retry)`, `paymentPending(String firstName, String assessmentName, String amount, MailLink pay)`, `paymentLink(String firstName, String assessmentName, String amount, MailLink pay)`; `enum Outcome { FAILED, EXPIRED, CANCELLED }`.

- [ ] **Step 1: Samples (failing)**

```java
        m.put("payment-success-welcome", PaymentMails.paymentReceived(FIRST, ASSESSMENT, "20260412", "15-05-2010", LOGIN));
        m.put("payment-success-resend", PaymentMails.welcomeResend(FIRST, ASSESSMENT, "20260412", "15-05-2010", MAGIC, LOGIN));
        m.put("payment-failed-cancelled-expired", PaymentMails.paymentFailed(FIRST, ASSESSMENT, "1,499", PaymentMails.Outcome.FAILED, L("https://dashboard.career-9.com/payment-register/pay_Q7x9AbC1234567890abcdef")));
        m.put("payment-pending-nudge", PaymentMails.paymentPending(FIRST, ASSESSMENT, "1,499", L("https://dashboard.career-9.com/payment-register/pay_Q7x9AbC1234567890abcdef")));
        m.put("payment-link", PaymentMails.paymentLink(FIRST, ASSESSMENT, "1,499", L("https://dashboard.career-9.com/payment-register/pay_Q7x9AbC1234567890abcdef")));
```

- [ ] **Step 2: Write `PaymentMails`** (ids `payment-success-welcome`, `payment-success-resend`, `payment-failed-cancelled-expired`, `payment-pending-nudge`, `payment-link`)

```java
package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.DOB_CAPTION;
import static com.kccitm.api.service.email.mails.AccountMails.KEEP;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;

public final class PaymentMails {
    public enum Outcome { FAILED, EXPIRED, CANCELLED }
    private PaymentMails() { }
    static String rupees(String amount) { return "&#8377;" + Mail.v(amount); }

    public static Mail paymentReceived(String firstName, String assessmentName, String username, String password, MailLink start) {
        return Mail.builder().subject("Payment received for " + assessmentName)
            .preheader("Your assessment is ready. Username and password are inside.")
            .title("Payment received").p(hi(firstName))
            .p("Your payment for " + b(assessmentName) + " has been received and the assessment is ready for you.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
            .action(start, "Start assessment").small(KEEP).signature().build();
    }

    /** magic may be null (legacy school/mapping payment with no entitlement): then the sign-in page is the primary action. */
    public static Mail welcomeResend(String firstName, String assessmentName, String username, String password, MailLink magic, MailLink signIn) {
        Mail.Builder m = Mail.builder().subject("Your " + assessmentName + " is ready")
            .preheader("One tap starts your assessment. Your username and password are inside for later.")
            .title("Your assessment is ready").p(hi(firstName))
            .p("Your payment for " + b(assessmentName) + " was received and the assessment is waiting for you. You can pause and resume at any time.");
        if (magic != null) {
            m.p("One tap signs you in and takes you straight to your assessment:").action(magic, "Start assessment")
             .p(b("Or sign in manually") + " with:")
             .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
             .links(null, signIn, "Open the sign-in page");
        } else {
            m.p("Sign in with the details below to begin:")
             .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
             .action(signIn, "Sign in");
        }
        return m.small(KEEP).signature().build();
    }

    public static Mail paymentFailed(String firstName, String assessmentName, String amount, Outcome outcome, MailLink retry) {
        String subject, lead;
        switch (outcome) {
            case EXPIRED:   subject = "Payment link for " + assessmentName + " has expired";
                            lead = "The payment link for " + b(assessmentName) + " (" + rupees(amount) + ") has expired, so nothing has been charged."; break;
            case CANCELLED: subject = "Payment for " + assessmentName + " was cancelled";
                            lead = "Your payment of " + b("₹" + amount) + " for " + b(assessmentName) + " was cancelled, so nothing has been charged."; break;
            default:        subject = "Payment for " + assessmentName + " did not go through";
                            lead = "Your payment of " + b("₹" + amount) + " for " + b(assessmentName) + " did not go through, so nothing has been charged.";
        }
        return Mail.builder().subject(subject).preheader("Nothing has been charged. Use the button to try again.")
            .title("Payment could not be completed").p(hi(firstName)).p(lead)
            .notice("If an amount was deducted from your account, it will be refunded automatically within 5&ndash;7 working days.")
            .action(retry, "Try again").signature().build();
    }

    public static Mail paymentPending(String firstName, String assessmentName, String amount, MailLink pay) {
        return Mail.builder().subject("Complete your payment for " + assessmentName)
            .preheader("₹" + amount + " is still pending. The button takes you straight to payment.")
            .title("Your payment is still pending").p(hi(firstName))
            .p("Your payment of " + b("₹" + amount) + " for " + b(assessmentName) + " is still pending. Complete it to get access to your assessment.")
            .action(pay, "Complete payment").signature().build();
    }

    public static Mail paymentLink(String firstName, String assessmentName, String amount, MailLink pay) {
        return Mail.builder().subject("Payment link for " + assessmentName)
            .preheader("₹" + amount + " for " + assessmentName + ". Pay securely with the button below.")
            .title("Your payment link").p(hi(firstName))
            .p("Here is your payment link for " + b(assessmentName) + ". The amount due is " + b("₹" + amount) + ".")
            .action(pay, "Pay now").small("Payments are processed securely by Razorpay.").signature().build();
    }
}
```

Note `b("₹" + amount)`: `b()` escapes, and "₹" is a plain character, fine in UTF-8 mail. Format amounts with `String.format("%,d", amountRupees)` at the call site.

- [ ] **Step 3: Rewrite `PaymentEmailService`**

Inject `LinkBuilder linkBuilder`, `MailLinks mailLinks`, `StudentEntitlementRepository entitlementRepository`, `EntitlementService entitlementService` (use `@Lazy` on the last to avoid a cycle). Delete `getRegistrationUrl`'s hardcoded default: `base` falls back to `linkBuilder`'s frontend base (add `public String frontendBase()` to `LinkBuilder` returning `frontendBaseUrl`). Each method builds the `Mail` and calls `emailDispatchService.sendMail(type, email, mail)`:

- `sendWelcomeEmail` → `PaymentMails.paymentReceived(AccountMails.firstName(name), assessmentName, username, dob, mailLinks.of(linkBuilder.manualLogin(), "student_login"))`.
- `sendWelcomeEmailResend(txn, assessmentName)` → look up `entitlementRepository.findFirstByPaymentTransactionId(txn.getTransactionId())`; if present, `String token = entitlementService.ensureLiveAccessToken(e)` and `magic = mailLinks.of(linkBuilder.assessmentStart(token, e.getEntitlementId()), "assessment_start")` else `magic = null`. Username via `userStudentRepository`/`StudentInfo.getUser().getUsername()` as `EntitlementService.sendWelcomeAssessmentLink` does; DOB `new SimpleDateFormat("dd-MM-yyyy").format(txn.getStudentDob())` when present.
- `sendFailedOrPendingEmail(txn, assessmentName, status)` → `Outcome` from status (`"failed"`→FAILED, `"expired"`→EXPIRED, else CANCELLED), retry link `mailLinks.of(getRegistrationUrl(txn), "payment_retry")`.
- `sendNudgeEmail` → `paymentPending`; `sendPaymentLinkEmail` → `paymentLink`.

Delete the `escapeHtml` helper and every HTML string.

- [ ] **Step 4: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest' -DfailIfNoTests=false
git add -A src/main/java/com/kccitm/api/service/email/mails/PaymentMails.java src/main/java/com/kccitm/api/service/PaymentEmailService.java src/main/java/com/kccitm/api/service/b2c/LinkBuilder.java src/main/java/com/kccitm/api/repository src/test/java/com/kccitm/api/service/email/mails/MailSamples.java
git commit -m "mail: payment mails on the theme; welcome resend carries credentials and the magic link"
```

---

### Task 8: Report mails (7), one report mail, 1-pager retired

**Files:**
- Create: `service/email/mails/ReportMails.java`
- Modify: `service/AssessmentCompletionEmailService.java:37-260`, `service/b2c/report/pipeline/GmailReportEmailSender.java:88-143`, `service/b2c/report/pipeline/ReportEmailConsumer.java`, `service/b2c/EntitlementService.java:590-640, 762-845, 1062-1140`, `service/counselling/CounsellorReportNotificationService.java:157-322`, `service/counselling/CounsellorReportReleaseService.java:72-136`, `controller/ContactPersonController.java:720-760, 1040-1210`, `service/dashboard/principal/PrincipalDashboardNotificationService.java:150-215`, `service/b2c/NotificationDispatcher.java:91-101`, `service/b2c/LinkBuilder.java` (delete `onePager`)
- Delete: `service/b2c/report/pipeline/ReportEmailComposer.java`
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Consumes: `ReportEmailEvent` fields (`studentName, reportUrl, pdfUrl, linkOnly, bookingUrl, whitelabel, schoolName, logoUrl`), `BrandResolver.of(BrandingDto)`, `MailLinks`.
- Produces: `ReportMails.assessmentCompletion(String firstName, String assessmentName, String username /*nullable*/, String dob /*nullable*/, MailLink dashboard)`, `reportReady(String firstName, String brandName, MailLink report, MailLink pdf /*nullable*/, boolean pdfAttached, MailLink booking /*nullable*/)`, `counsellorReportReady(String counsellorName, String studentName, String assessmentName, MailLink report)`, `bookedSessionReportReady(String studentName, String sessionDate /*nullable*/, MailLink report)`, `reportReleased(String firstName, String releasedBy /*nullable*/, MailLink report)`, `reportsZip(String contactName, String instituteName, String assessmentName, String reportType, List<String> includedStudents, int noReportCount, List<String> failedStudents)`, `schoolDashboardReady(String contactName /*nullable*/, String instituteName, String assessmentName, MailLink dashboard)`.

- [ ] **Step 1: Samples (failing)**

```java
        m.put("assessment-completion", ReportMails.assessmentCompletion(FIRST, ASSESSMENT, "20260412", "15-05-2010", SIGN_IN));
        m.put("report-ready-pipeline", ReportMails.reportReady(FIRST, "Career-9", REPORT, L("https://storage-c9.sgp1.cdn.digitaloceanspaces.com/reports/2026/09/aarav-sharma-career-report.pdf"), true, L("https://assessment.career-9.com/counselling-booking/eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig")));
        m.put("counsellor-report-ready", ReportMails.counsellorReportReady(COUNSELLOR, STUDENT, ASSESSMENT, REPORT));
        m.put("booked-session-report-ready", ReportMails.bookedSessionReportReady(STUDENT, DATE, REPORT));
        m.put("counsellor-report-release", ReportMails.reportReleased(FIRST, COUNSELLOR, REPORT));
        m.put("contact-person-reports-zip", ReportMails.reportsZip("Suresh Menon", SCHOOL, ASSESSMENT, "Navigator", java.util.Arrays.asList("Aarav Sharma", "Diya Patel", "Kabir Rao"), 3, java.util.Collections.emptyList()));
        m.put("school-dashboard-ready", ReportMails.schoolDashboardReady("Suresh Menon", SCHOOL, ASSESSMENT, L("https://dashboard.career-9.com/school-dashboard")));
```

- [ ] **Step 2: Write `ReportMails`** (ids `assessment-completion`, `report-ready-pipeline`, `counsellor-report-ready`, `booked-session-report-ready`, `counsellor-report-release`, `contact-person-reports-zip`, `school-dashboard-ready`)

```java
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
```

Note: subjects containing the school name can exceed 60 characters for long names; `MailRules` flags it in tests only (sample names fit). Truncate nothing at runtime.

- [ ] **Step 3: Switch the callers**

- `AssessmentCompletionEmailService`: build `ReportMails.assessmentCompletion(firstName, assessmentName, username, dob, mailLinks.of(linkBuilder.studentLogin(), "student_login"))`, send with `EmailSendRequest.mail(EmailType.ASSESSMENT_COMPLETION, email, mail)` plus `setInstituteCode`/`setUserStudentId` as today; keep the existing `put(...)` context. Delete `buildEmailHtml`.
- `GmailReportEmailSender.sendReportEmail`: replace `composer.subject/html` with `Brand brand = brandResolver.of(new BrandingDto(event.whitelabel, event.schoolName, event.logoUrl)); Mail mail = ReportMails.reportReady(AccountMails.firstName(event.studentName), brand.getName(), mailLinks.of(event.reportUrl, "report"), event.pdfUrl == null ? null : mailLinks.of(event.pdfUrl, "report_pdf"), withPdf, event.bookingUrl == null ? null : mailLinks.of(event.bookingUrl, "counselling_booking")); MailRenderer.Rendered r = mailRenderer.render(mail, brand);` and for a template override `r = mailRenderer.wrapForeign(subject, mailLinks.rewrite(html), brand)`. Set `msg.setTextContent(r.text)`. Delete `ReportEmailComposer` and its two injections (`GmailReportEmailSender`, `EntitlementService`).
- `EntitlementService`: `reportReadyEmailBody(...)` becomes `Mail reportReadyMail(StudentEntitlement e, String reportUrl, String pdfUrl)` using the same call as above with `brandResolver.forUserStudent(e.getUserStudentId())`. In `onAssessmentCompleted` (lines ~590-640) delete the `one_pager` branch entirely: when the tier lacks the final report, nothing is sent. In `resendServiceLink` delete `case "one_pager"`; `case "final_report"` keeps its logic but sends the `Mail` (change `notificationDispatcher.sendEmail` to accept a `Mail` — see below). Delete `simpleHtml` and `welcomeEmailHtml` only after Task 9 (they are still called until then).
- `NotificationDispatcher.sendEmail(...)`: add an overload `sendEmail(StudentEntitlement e, String recipient, String serviceType, Mail mail, String linkUrl)` that sets `req.setMail(mail)` (subject from the mail) and keeps the `ServiceDeliveryLog` row; remove `case "one_pager"` from `mapServiceType`. The old `htmlBody` overload is deleted in Task 9 once nothing calls it.
- `LinkBuilder`: delete `onePager(...)`.
- `CounsellorReportNotificationService`: `notifyAppointedCounsellors` sends `ReportMails.counsellorReportReady(AccountMails.firstName(counsellorName), studentName, assessmentName, mailLinks.of(link, "report"))` per recipient (look the counsellor's name up alongside the email in `counsellorEmailsFor`; extend it to return name+email pairs); `notifyBookedSessions` sends `ReportMails.bookedSessionReportReady(studentName, when, mailLinks.of(link, "report"))`. `sendRich` becomes `emailDispatchService.sendMail(EmailType.REPORT_READY, to, mail)`.
- `CounsellorReportReleaseService.releaseToStudent`: `ReportMails.reportReleased(AccountMails.firstName(studentName), counsellorName, mailLinks.of(link, "report"))`.
- `ContactPersonController`: `buildReportEmailHtml(...)` becomes `ReportMails.reportsZip(...)` (the two call sites at ~736 and ~1053 pass `contactName, instituteName, assessmentName, reportTypeLabel, includedNames, noReportCount, failedDownloads`); set `emailRequest.setMail(mail)` instead of `setHtmlContent`. The free-form admin mail (line ~553) stays pass-through (the dispatcher wraps it). The line-371 "students assigned" mail stays pass-through too.
- `PrincipalDashboardNotificationService.body(...)` becomes `ReportMails.schoolDashboardReady(name, instituteName, assessmentName, mailLinks.of(frontendUrl + "/school-dashboard", "school_dashboard"))`, sent via `setMail`.

- [ ] **Step 4: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchRoutingTest,ReportEmailIdempotencyTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: report mails on the theme; single report mail; 1-pager retired"
```

---

### Task 9: B2C entitlement mails (5)

**Files:**
- Create: `service/email/mails/EntitlementMails.java`
- Modify: `service/b2c/EntitlementService.java` (`sendWelcomeAssessmentLink`, `resendServiceLink`, delete `simpleHtml`, `welcomeEmailHtml`), `service/b2c/NotificationDispatcher.java` (delete the html overload), `service/b2c/EntitlementSchedulerService.java:55-80` (nudge logging), `service/counselling/ReminderSchedulerService.java:169-214` (one mail per run)
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Produces: `EntitlementMails.welcome(String firstName, String username /*nullable*/, String password /*nullable*/, MailLink magic, MailLink signIn)`, `assessmentLink(String firstName, String assessmentName, MailLink magic)`, `dashboardAccess(String firstName, MailLink sso)`, `learningAccess(String firstName, MailLink lms)`, `bookingLink(String firstName, MailLink booking)`.

- [ ] **Step 1: Samples (failing)**

```java
        m.put("b2c-welcome-assessment-link", EntitlementMails.welcome(FIRST, "20260412", "15-05-2010", MAGIC, LOGIN));
        m.put("b2c-assessment-invite-resend", EntitlementMails.assessmentLink(FIRST, ASSESSMENT, MAGIC));
        m.put("b2c-dashboard-access", EntitlementMails.dashboardAccess(FIRST, L("https://dashboard.career-9.com/student/sso?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
        m.put("b2c-lms-access", EntitlementMails.learningAccess(FIRST, L("https://dashboard.career-9.com/lms/launch?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
        m.put("b2c-counselling-book-link", EntitlementMails.bookingLink(FIRST, L("https://dashboard.career-9.com/counselling/book?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
```

- [ ] **Step 2: Write `EntitlementMails`** (ids `b2c-welcome-assessment-link`, `b2c-assessment-invite-resend`, `b2c-dashboard-access`, `b2c-lms-access`, `b2c-counselling-book-link`)

```java
package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.DOB_CAPTION;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

public final class EntitlementMails {
    private EntitlementMails() { }
    static final String PERSONAL = "The link is personal to you. Please don&rsquo;t forward it.";

    public static Mail welcome(String firstName, String username, String password, MailLink magic, MailLink signIn) {
        Mail.Builder m = Mail.builder().subject("Welcome to Career-9: start your assessment")
            .preheader("One tap signs you in. Your username and password are inside for later.")
            .title("Welcome aboard, " + v(firstName))
            .p("Your purchase is confirmed and your assessment is ready when you are. You can pause and resume at any time.")
            .p("One tap signs you in and takes you straight to your assessment:")
            .action(magic, "Start assessment")
            .p(b("Or sign in manually") + " with:");
        if (username != null && password != null) m.credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password));
        else m.small("Use the user ID and date of birth you provided at registration to sign in.");
        return m.links(null, signIn, "Open the sign-in page")
            .small("Keep these safe. You will need them to resume your assessment or open your report later.").signature().build();
    }

    public static Mail assessmentLink(String firstName, String assessmentName, MailLink magic) {
        return Mail.builder().subject("Your Career-9 assessment link")
            .preheader("Your assessment is waiting. One tap to start or resume.")
            .title("Your assessment link").p(hi(firstName))
            .p("Here is your link to " + b(assessmentName) + ". One tap signs you in, and you can pause and resume at any time.")
            .action(magic, "Start assessment").signature().build();
    }

    public static Mail dashboardAccess(String firstName, MailLink sso) {
        return Mail.builder().subject("Your Career-9 dashboard access").preheader("One tap opens your dashboard.")
            .title("Your dashboard access").p(hi(firstName))
            .p("One tap below signs you in and opens your Career-9 dashboard, where your results and next steps live.")
            .action(sso, "Open my dashboard").small(PERSONAL).signature().build();
    }

    public static Mail learningAccess(String firstName, MailLink lms) {
        return Mail.builder().subject("Your Career-9 learning access").preheader("Your learning modules are ready.")
            .title("Your learning modules are ready").p(hi(firstName))
            .p("Your Career-9 learning modules are ready. One tap below signs you in and opens them.")
            .action(lms, "Open my modules").small(PERSONAL).signature().build();
    }

    public static Mail bookingLink(String firstName, MailLink booking) {
        return Mail.builder().subject("Book your Career-9 counselling session").preheader("Pick a time that suits you. No login needed.")
            .title("Book your counselling session").p(hi(firstName))
            .p("Your plan includes a one-to-one counselling session. Pick a time that suits you; no login is needed.")
            .action(booking, "Book my session")
            .small("Once you choose a slot, your session is confirmed instantly and you will receive the meeting details by email.").signature().build();
    }
}
```

- [ ] **Step 3: Switch the callers**

`EntitlementService`:
- `sendWelcomeAssessmentLink`: `Mail mail = EntitlementMails.welcome(AccountMails.firstName(displayName), username, dobStr, mailLinks.of(magicLink, "assessment_start"), mailLinks.of(manualLoginUrl, "student_login")); notificationDispatcher.sendEmail(entitlement, to, "assessment_invite", mail, magicLink);`
- `resendServiceLink`: `assessment_invite` → `EntitlementMails.assessmentLink(first, assessmentName(e), mailLinks.of(link, "assessment_start"))` (assessment name from `assessmentTableRepository.findById(e.getAssessmentId())`, fallback "your assessment"); `dashboard_access` → `dashboardAccess`; `lms_access` → `learningAccess`; `counselling_book` → `bookingLink`; `final_report` → `reportReadyMail(...)` from Task 8. All via the new `notificationDispatcher.sendEmail(e, studentEmail, serviceType, mail, link)`.
- Delete `simpleHtml`, `welcomeEmailHtml`, `escape` (if unused) and the `reportEmailComposer` field.

`NotificationDispatcher`: delete the `htmlBody` overload; `mapServiceType` maps `"nudge"` → `ENTITLEMENT_GRANTED`.

`EntitlementSchedulerService.nudgeUnstartedAssessments`: the nudge send calls `entitlementService.resendServiceLink(id, "assessment_invite", …)` which logs `assessment_invite`; change it to call a new `entitlementService.sendNudge(StudentEntitlement e)` that builds the same `assessmentLink` mail but logs the delivery row with serviceType `"nudge"` — so `countSent(id, "nudge")` finally counts and the cap of 2 holds.

`ReminderSchedulerService.sendCounsellingBookingNudges` (lines ~36-41): drop the `entitlementService.resendServiceLink(e.getEntitlementId(), "counselling_book", email)` call; the `sendCounsellingBookingNudge(...)` fallback mail (Task 10b) now carries the tokenised booking link itself, so one mail goes out per run. Pass the link: compute `bookingUrl = linkBuilder.counsellingBook(entitlementService.ensureLiveAccessToken(e), e.getEntitlementId())` (or `counsellingMySessions` for model 2, mirroring `resendServiceLink`) and hand it to `sendCounsellingBookingNudge`.

- [ ] **Step 4: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchRoutingTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: B2C mails on the theme; nudge cap counts nudges; one booking nudge per run"
```

---

### Task 10a: Counselling mails — lifecycle (11 mails)

**Files:**
- Create: `service/email/mails/CounsellingMails.java` (this task adds the `Session` value and the lifecycle builders; 10b and 10c add more methods to the same class)
- Modify: `service/counselling/CounsellingNotificationService.java` methods: `sendConfirmationWithCalendar` (~1205-1330), `sendAssignedToCounsellorEmail` (171), `sendConfirmedToStudentEmail` (210), `sendCancellationEmail` (256/270), `sendStudentCancellationConfirmation` (1658), `sendAdminCancellationEmail` (1706/1719), `sendSelfRescheduleEmail` (375), `sendSelfRescheduleInviteEmail` (429), `sendRescheduleEmail` (497), `sendCounsellorSwappedEmail` (1794), `sendSessionShiftedEmail` (1838), `sendCounsellorDeactivatedStudentEmail` (2432)
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Produces: `CounsellingMails.Session` (fields `date, time, duration, counsellor, mode, school, assessment, student, join (MailLink, nullable), report (MailLink, nullable)`, all-args constructor in that order), and `public static Mail`: `bookingConfirmation(String firstName, Session s, MailLink calendar)`, `assignedToCounsellor(String counsellorName, String reason, Session s, MailLink confirm)`, `confirmedToStudent(String firstName, Session s)`, `cancelledNotice(String firstName, Session s, String cancelledBy, String reason /*nullable*/, MailLink sessions, String buttonLabel)`, `studentCancellationConfirmation(String firstName, Session s, int changesLeft, MailLink sessions)`, `adminCancellationStudent(String firstName, Session s, MailLink sessions)`, `adminCancellationCounsellor(String counsellorName, String studentName, Session s, MailLink portal)`, `selfReschedule(String firstName, String opening, String reason /*nullable*/, MailLink reschedule)`, `rescheduledStudent(String firstName, Session old, Session s)`, `rescheduledCounsellor(String counsellorName, String studentName, Session old, Session s)`, `counsellorSwapped(String firstName, Session s, String newCounsellor)`, `sessionShifted(String firstName, Session s, String oldTime, MailLink reschedule)`, `counsellorDeactivatedStudent(String firstName, Session s, MailLink reschedule)`.
- Consumes in the service: `CounsellingAppointment.getSlot().getDate()/getStartTime()/getEndTime()/getDurationMinutes()`, `getCounsellor().getName()`, `getMode()` ("OFFLINE" → In-person), `getLocation()`, `getMeetingLink()`, `bookingReportLink(appointment)`, `studentName/studentEmail(appointment)`, `getParentEmail()`, `instituteNameFor`, `assessmentNameFor`, existing `DATE_FMT`/`TIME_FMT`.

- [ ] **Step 1: Samples (failing)**

```java
        CounsellingMails.Session S = new CounsellingMails.Session(DATE, TIME, "30", COUNSELLOR, MODE, SCHOOL, ASSESSMENT, STUDENT, JOIN, REPORT);
        CounsellingMails.Session OLD = new CounsellingMails.Session("Tuesday, 16 Sep 2026", "3:00 – 3:30 PM IST", "30", COUNSELLOR, MODE, SCHOOL, ASSESSMENT, STUDENT, null, null);
        MailLink RESCHEDULE = L("https://assessment.career-9.com/counselling-reschedule/eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig");
        m.put("counselling-booking-confirmation", CounsellingMails.bookingConfirmation(FIRST, S, L("https://calendar.google.com/calendar/render?action=TEMPLATE&text=Career-9+Counselling&dates=20260918T110000Z/20260918T113000Z")));
        m.put("counselling-assigned-to-counsellor", CounsellingMails.assignedToCounsellor(COUNSELLOR, "Wants help choosing a stream after Class 10", S, PORTAL));
        m.put("counselling-confirmed-to-student", CounsellingMails.confirmedToStudent(FIRST, S));
        m.put("counselling-cancelled-notice", CounsellingMails.cancelledNotice(FIRST, S, "the student", "counsellor unavailable", SESSIONS, "View my sessions"));
        m.put("counselling-student-cancellation-confirmation", CounsellingMails.studentCancellationConfirmation(FIRST, S, 1, SESSIONS));
        m.put("counselling-admin-cancellation", CounsellingMails.adminCancellationStudent(FIRST, S, SESSIONS));
        m.put("counselling-admin-cancellation-counsellor", CounsellingMails.adminCancellationCounsellor(COUNSELLOR, STUDENT, S, PORTAL));
        m.put("counselling-self-reschedule", CounsellingMails.selfReschedule(FIRST, "Your counsellor was unable to join your session on Tuesday, 16 Sep at 3:00 PM.", "counsellor unavailable", RESCHEDULE));
        m.put("counselling-rescheduled", CounsellingMails.rescheduledStudent(FIRST, OLD, S));
        m.put("counselling-rescheduled-counsellor", CounsellingMails.rescheduledCounsellor(COUNSELLOR, STUDENT, OLD, S));
        m.put("counselling-counsellor-swapped", CounsellingMails.counsellorSwapped(FIRST, S, "Rohit Verma"));
        m.put("counselling-session-shifted", CounsellingMails.sessionShifted(FIRST, S, "3:00 – 3:30 PM IST", RESCHEDULE));
        m.put("counsellor-deactivated-student", CounsellingMails.counsellorDeactivatedStudent(FIRST, S, RESCHEDULE));
```

- [ ] **Step 2: Write the class** (ids `counselling-booking-confirmation`, `counselling-assigned-to-counsellor`, `counselling-confirmed-to-student`, `counselling-cancelled-notice`, `counselling-student-cancellation-confirmation`, `counselling-admin-cancellation`, `counselling-self-reschedule`, `counselling-rescheduled`, `counselling-counsellor-swapped`, `counselling-session-shifted`, `counsellor-deactivated-student`)

```java
package com.kccitm.api.service.email.mails;

import java.util.ArrayList;
import java.util.List;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

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

    public static Mail studentCancellationConfirmation(String firstName, Session s, int changesLeft, MailLink sessions) {
        return Mail.builder().subject("Your counselling session has been cancelled")
            .preheader("Cancelled as you asked. You have " + changesLeft + " free change" + (changesLeft == 1 ? "" : "s") + " left.")
            .title("Your session has been cancelled").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " has been cancelled as you requested.")
            .notice("Your session has been returned to your plan, so you can book again. You have " + b(String.valueOf(changesLeft)) + " free change" + (changesLeft == 1 ? "" : "s") + " left.")
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
        return Mail.builder().subject("Your session is confirmed with updated details")
            .preheader("Same time, different counsellor. Use the updated join link.")
            .title("Your session is confirmed, with updated details").p(hi(firstName))
            .p("Your counselling session on " + b(s.date) + " at " + b(s.time) + " is going ahead exactly as planned. The time has not changed.")
            .p("A different counsellor, " + b(newCounsellor) + ", will now be taking it, so please use the updated joining link below.")
            .action(s.join, "Join the session").small(EARLY).signature().build();
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
```

`Mail.Row.label` is package-private in `theme`; make `label`/`value` `public final` in `Mail.Row` so `mails` can read them (used by `assignedToCounsellor`).

- [ ] **Step 3: Switch the callers**

Add to `CounsellingNotificationService` one factory and one sender:

```java
    /** The session facts every counselling mail shows, from the appointment. */
    CounsellingMails.Session session(CounsellingAppointment a) {
        String date = a.getSlot() != null && a.getSlot().getDate() != null ? a.getSlot().getDate().format(DATE_FMT) : null;
        String time = null;
        if (a.getSlot() != null && a.getSlot().getStartTime() != null) {
            time = a.getSlot().getStartTime().format(TIME_FMT);
            if (a.getSlot().getEndTime() != null) time += " – " + a.getSlot().getEndTime().format(TIME_FMT);
            time += " IST";
        }
        String duration = a.getSlot() != null && a.getSlot().getDurationMinutes() != null ? String.valueOf(a.getSlot().getDurationMinutes()) : null;
        boolean offline = "OFFLINE".equals(a.getMode());
        String mode = offline ? "In-person" + (a.getLocation() != null && !a.getLocation().isEmpty() ? " · " + a.getLocation() : "") : "Online (Google Meet)";
        MailLink join = offline || a.getMeetingLink() == null || a.getMeetingLink().isEmpty() ? null : mailLinks.of(a.getMeetingLink(), "meeting");
        String reportUrl = bookingReportLink(a);
        MailLink report = reportUrl == null ? null : mailLinks.of(reportUrl, "report");
        return new CounsellingMails.Session(date, time, duration, a.getCounsellor() != null ? a.getCounsellor().getName() : null, mode,
                instituteNameFor(a), assessmentNameFor(a), studentName(a), join, report);
    }
    private void sendMail(EmailType type, String to, Mail mail) {
        if (to == null || to.isEmpty()) return;
        emailDispatchService.sendMail(type, to, mail);
    }
```

Then, method by method, replace the `CounsellingEmailHtml.page(...)` + text + `sendRich(...)` bodies with a `Mail` and `sendMail(...)` (keep the `@Async`, the try/catch and the recipient logic exactly as they are):

- `sendConfirmationWithCalendar`: `Mail mail = CounsellingMails.bookingConfirmation(AccountMails.firstName(studentName), session(a), mailLinks.of(gcal, "gcal"));` and for the .ics request set `req.setMail(mail)` instead of html/text; the fallback rounds call `sendMail(EmailType.COUNSELLING_BOOKING, addr, mail)`.
- `sendAssignedToCounsellorEmail`: `assignedToCounsellor(AccountMails.firstName(counsellorName), a.getStudentReason(), session(a), mailLinks.of(counsellorPortalUrl(), "counsellor_portal"))`.
- `sendConfirmedToStudentEmail`: `confirmedToStudent(first, session(a))`.
- `sendCancellationEmail` (both overloads): to the counsellor → `cancelledNotice(first(counsellor), session(a), "the student", reason, mailLinks.of(counsellorPortalUrl(), …), "Open my dashboard")`; to the student → `cancelledNotice(first(student), session(a), counsellorName, reason, mailLinks.of(portalCounsellingUrl(), …), "View my sessions")`.
- `sendStudentCancellationConfirmation(a, missesRemaining, creditedBack)`: `studentCancellationConfirmation(first, session(a), missesRemaining, portal)`; **always** set `req.setMail(mail)` on the .ics request so the text part is never dropped.
- `sendAdminCancellationEmail`: student/parent → `adminCancellationStudent`; counsellor (when `includeCounsellor`) → `adminCancellationCounsellor(first(counsellor), studentName, session(a), portal)`.
- `sendSelfRescheduleEmail` / `sendSelfRescheduleInviteEmail`: `selfReschedule(first, opening, adminReason, mailLinks.of(rescheduleUrl, "counselling_reschedule"))` where `opening` is the sentence each method already builds.
- `sendRescheduleEmail(old, neu)`: student/parent → `rescheduledStudent(first, session(old), session(neu))`; counsellor → `rescheduledCounsellor(...)`.
- `sendCounsellorSwappedEmail`: `counsellorSwapped(first, session(a), a.getCounsellor().getName())`.
- `sendSessionShiftedEmail(moved, originalTimeLabel, selfRescheduleUrl)`: `sessionShifted(first, session(moved), originalTimeLabel, mailLinks.of(selfRescheduleUrl, …))`.
- `sendCounsellorDeactivatedStudentEmail(a, rescheduleUrl)`: `counsellorDeactivatedStudent(first, session(a), mailLinks.of(rescheduleUrl, …))`; `.ics` request gets `setMail`.

Leave `sessionDetailRows`, `attendanceBlock`, `joinPreheader` and `CounsellingEmailHtml` in place until 10c deletes them.

- [ ] **Step 4: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchRoutingTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: counselling lifecycle mails on the theme"
```

---

### Task 10b: Counselling mails — reminders, check-in, follow-ups (12 mails)

**Files:**
- Modify: `service/email/mails/CounsellingMails.java` (append), `service/counselling/CounsellingNotificationService.java` methods: `sendReminderEmail` (587), `notifyStudentReminder` (1364), `notifyCounsellorReminder` (1385), `sendSessionCompleteEmail` (656), `sendBookingInviteEmail` (392), `sendCounsellorDailyDigest` (1475), `sendCounsellingBookingNudge` (1521), `sendCheckinCodeToStudent` (1927), `sendCheckinPromptToStudent` (2005), `sendCheckinPromptToCounsellor` (2048), `sendMarkedAbsentEmail` (2102), `sendDisputeOutcomeEmail` (2208); `service/counselling/ReminderSchedulerService.java` (pass the label once, pass the booking link)
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Produces: `reminderStudent(String firstName, String whenLabel, Session s)`, `reminderCounsellor(String counsellorName, String studentName, String whenLabel, Session s)`, `sessionComplete(String firstName, MailLink referral)`, `bookingInvite(String firstName, MailLink booking)`, `dailyDigest(String counsellorName, String dateLabel, List<String[]> rows, MailLink portal)`, `bookingNudge(String firstName, int sessionsLeft, MailLink booking)`, `checkinCode(String firstName, String code, Session s)`, `checkinPromptStudent(String firstName, Session s, MailLink findCode)`, `checkinPromptCounsellor(String counsellorName, String studentName, String time, MailLink portal)`, `markedAbsent(String firstName, Session s, int changesLeft, MailLink sessions)`, `disputeOutcome(String firstName, String date, boolean upheld, String note /*nullable*/, MailLink sessions)`.

- [ ] **Step 1: Samples (failing)**

```java
        m.put("counselling-reminder-fallback", CounsellingMails.reminderStudent(FIRST, "in 2 hours", S));
        m.put("counselling-counsellor-reminder-fallback", CounsellingMails.reminderCounsellor(COUNSELLOR, STUDENT, "in 2 hours", S));
        m.put("counselling-session-complete-thankyou", CounsellingMails.sessionComplete(FIRST, L("https://assessment.career-9.com")));
        m.put("counselling-booking-invite", CounsellingMails.bookingInvite(FIRST, L("https://assessment.career-9.com/counselling-booking/eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig")));
        m.put("counselling-daily-digest", CounsellingMails.dailyDigest(COUNSELLOR, "Tuesday, 9 Sep 2026", java.util.Arrays.asList(new String[]{"10:00 – 10:30 AM", "Aarav Sharma", "Online"}, new String[]{"11:30 AM – 12:00 PM", "Diya Patel", "Online"}, new String[]{"3:00 – 3:30 PM", "Kabir Rao", "In-person"}), PORTAL));
        m.put("counselling-booking-nudge-fallback", CounsellingMails.bookingNudge(FIRST, 1, L("https://dashboard.career-9.com/counselling/book?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79")));
        m.put("counselling-checkin-code", CounsellingMails.checkinCode(FIRST, "4829", S));
        m.put("counselling-checkin-prompt-student", CounsellingMails.checkinPromptStudent(FIRST, S, SESSIONS));
        m.put("counselling-checkin-prompt-counsellor", CounsellingMails.checkinPromptCounsellor(COUNSELLOR, STUDENT, TIME, PORTAL));
        m.put("counselling-marked-absent", CounsellingMails.markedAbsent(FIRST, S, 1, SESSIONS));
        m.put("counselling-dispute-outcome", CounsellingMails.disputeOutcome(FIRST, DATE, false, "The counsellor confirmed you joined at 4:41 PM.", SESSIONS));
        m.put("counselling-dispute-outcome-upheld", CounsellingMails.disputeOutcome(FIRST, DATE, true, null, SESSIONS));
```

- [ ] **Step 2: Append to `CounsellingMails`** (ids `counselling-reminder-fallback`, `counselling-counsellor-reminder-fallback`, `counselling-session-complete-thankyou`, `counselling-booking-invite`, `counselling-daily-digest`, `counselling-booking-nudge-fallback`, `counselling-checkin-code`, `counselling-checkin-prompt-student`, `counselling-checkin-prompt-counsellor`, `counselling-marked-absent`, `counselling-dispute-outcome`)

```java
    public static Mail reminderStudent(String firstName, String whenLabel, Session s) {
        return Mail.builder().subject("Your counselling session is " + whenLabel)
            .preheader(s.date + ", " + s.time + ". Join link inside.")
            .title("Your counselling session is " + v(whenLabel)).p(hi(firstName))
            .p("This is a reminder that your counselling session is " + b(whenLabel) + ".").details(rows(s, false, false))
            .action(s.join, "Join the session").links(null, s.report, "Open your assessment report").small(EARLY).signature().build();
    }
    public static Mail reminderCounsellor(String counsellorName, String studentName, String whenLabel, Session s) {
        return Mail.builder().subject("Reminder: session " + whenLabel + " with " + studentName)
            .preheader(s.date + ", " + s.time + ". Join link inside.")
            .title("Session " + v(whenLabel) + ": " + v(studentName)).p(hi(counsellorName))
            .p("You have a counselling session " + b(whenLabel) + " with " + b(studentName) + ".")
            .details(new Mail.Row("Student", studentName), new Mail.Row("Date", s.date), new Mail.Row("Time", s.time), new Mail.Row("Mode", s.mode))
            .action(s.join, "Join the session").small(EARLY).signature().build();
    }
    public static Mail sessionComplete(String firstName, MailLink referral) {
        return Mail.builder().subject("Thank you for your session with Career-9")
            .preheader("We hope it brought clarity. Know someone who needs it too?")
            .title("Thank you for being a part of Career-9 &#127775;").p("Hi " + v(firstName) + " &#128075;")
            .p("We hope your counselling session helped you discover new possibilities, understand yourself better, and take a step closer to making confident career choices. &#128640;")
            .p("Remember, your career journey doesn&rsquo;t end with one session. Keep exploring, keep learning, and keep believing in yourself.")
            .p(b("&#128153; Know someone who needs career clarity?") + " If you found your Career-9 experience valuable, share it with friends, cousins or family members who may also be wondering &ldquo;What should I choose for my future?&rdquo; &#129300;")
            .action(referral, "Refer a friend or family member")
            .p(b("&#128260; See you again in 6 months.") + " Your interests, strengths and aspirations evolve as you grow, so we would love to reconnect in 6 months and see what has changed and where you want to go next.")
            .p("Your future is a journey. We&rsquo;re happy to be part of it. &#128153;").signature().build();
    }
    public static Mail bookingInvite(String firstName, MailLink booking) {
        return Mail.builder().subject("Book your counselling session").preheader("Pick a time that suits you. No login needed.")
            .title("Book your counselling session").p(hi(firstName))
            .p("You have completed your assessment. The next step is a one-to-one counselling session to turn your results into a real plan.")
            .action(booking, "Book my session")
            .small("No login needed. Once you choose a slot, your session is confirmed instantly and you will receive the meeting details by email.").signature().build();
    }
    public static Mail dailyDigest(String counsellorName, String dateLabel, List<String[]> rows, MailLink portal) {
        return Mail.builder().subject("Your sessions for " + dateLabel + " (" + rows.size() + ")")
            .preheader(rows.size() + (rows.size() == 1 ? " session" : " sessions") + " tomorrow. Times and students inside.")
            .title("Your sessions for " + v(dateLabel)).p(hi(counsellorName))
            .p("Here are your counselling sessions scheduled for " + b(dateLabel) + ":")
            .table(new String[]{"Time", "Student", "Mode"}, rows)
            .action(portal, "Open my dashboard").small("Please be available on time.").signature().build();
    }
    public static Mail bookingNudge(String firstName, int sessionsLeft, MailLink booking) {
        return Mail.builder().subject("A counselling session is waiting for you")
            .preheader(sessionsLeft + (sessionsLeft == 1 ? " session" : " sessions") + " in your plan " + (sessionsLeft == 1 ? "hasn't" : "haven't") + " been booked yet. Pick a time.")
            .title("A counselling session is waiting for you").p(hi(firstName))
            .p("You have " + b(String.valueOf(sessionsLeft)) + " counselling session" + (sessionsLeft == 1 ? "" : "s") + " included in your plan that " + (sessionsLeft == 1 ? "hasn&rsquo;t" : "haven&rsquo;t") + " been booked yet.")
            .action(booking, "Book my session").small("Pick a time that works for you to speak with a counsellor. No login needed.").signature().build();
    }
    public static Mail checkinCode(String firstName, String code, Session s) {
        return Mail.builder().subject("Your counselling check-in code").preheader("Read this code out to your counsellor to start the session.")
            .title("Your check-in code").p(hi(firstName))
            .p("Read the code below out to your counsellor to start your counselling session.")
            .code(code, "Check-in code")
            .details(new Mail.Row("Date", s.date), new Mail.Row("Time", s.time), new Mail.Row("Counsellor", s.counsellor))
            .action(s.join, "Join the session")
            .small("This is the same 4-digit code printed on your Career-9 report. Please don&rsquo;t share it with anyone else; it is what records you as present.").signature().build();
    }
    public static Mail checkinPromptStudent(String firstName, Session s, MailLink findCode) {
        return Mail.builder().subject("Your counselling session is waiting to start").preheader("Read out your check-in code so the session can begin.")
            .title("Your session is waiting to start").p(hi(firstName))
            .p("Your session has not been started yet. Please read out the 4-digit check-in code from your Career-9 report so your counsellor can begin.")
            .action(s.join, "Join the session").links(null, findCode, "Find my check-in code")
            .small("If nobody has joined, you do not need to do anything else. Your session will be preserved and we will send you a link to pick a new time.").signature().build();
    }
    public static Mail checkinPromptCounsellor(String counsellorName, String studentName, String time, MailLink portal) {
        return Mail.builder().subject("Action needed: session with " + studentName + " not started")
            .preheader("The " + time + " session has not been checked in.")
            .title("Action needed: session not started").p(hi(counsellorName))
            .p("Your " + b(time) + " session with " + b(studentName) + " has not been checked in.")
            .p("Please either enter the student&rsquo;s check-in code, or mark the student absent if they have not appeared.")
            .action(portal, "Open the session")
            .notice("If neither is recorded before the session ends, it will be logged as your no-show rather than the student&rsquo;s.").signature().build();
    }
    public static Mail markedAbsent(String firstName, Session s, int changesLeft, MailLink sessions) {
        return Mail.builder().subject("You were marked absent from your counselling session").preheader("Here is where you stand and what you can do next.")
            .title("You were marked absent").p(hi(firstName))
            .p("Your counsellor has recorded that you did not attend your session on " + b(s.date) + " at " + b(s.time) + ".")
            .notice("You have " + b(String.valueOf(changesLeft)) + " free change" + (changesLeft == 1 ? "" : "s") + " left.")
            .p("Your session has been returned to your plan, so you can book again.")
            .action(sessions, "Book a new time")
            .small("If you were present and believe this is a mistake, raise it from your Career-9 dashboard or write to " + SUPPORT + ". The session will be reviewed and nothing counts against you until it is settled.").signature().build();
    }
    public static Mail disputeOutcome(String firstName, String date, boolean upheld, String note, MailLink sessions) {
        Mail.Builder m = upheld
            ? Mail.builder().subject("Your attendance review outcome").preheader("The record for " + date + " stands.")
                .title("Your attendance review outcome").p(hi(firstName))
                .p("We have reviewed your session on " + b(date) + " and the record that you did not attend stands. It counts as one of your changes.")
            : Mail.builder().subject("Your counselling session has been corrected").preheader("Your session on " + date + " is now recorded as attended.")
                .title("Your session has been corrected").p(hi(firstName))
                .p("We have reviewed your session on " + b(date) + " and corrected it. It is now recorded as attended, and nothing has been counted against you.");
        if (note != null && !note.isEmpty()) m.notice("Note from our team: " + v(note));
        return m.action(sessions, "View my sessions").signature().build();
    }
```

- [ ] **Step 3: Switch the callers**

- `sendReminderEmail(a, period)`: student and parent get `reminderStudent(first, period, session(a))`, counsellor gets `reminderCounsellor(first(counsellor), studentName, period, session(a))`. In `ReminderSchedulerService` pass the label exactly as the scheduler already has it (`"in 12 hours"`), and delete the `"in " +` prefix inside `sendReminderEmail`/`notifyStudentReminder`/`notifyCounsellorReminder` so the words appear once.
- `sendSessionCompleteEmail`: `sessionComplete(first, mailLinks.of(referralUrl(a), "referral"))` using the existing campaign-landing/assessment-home resolution at ~703-710.
- `sendBookingInviteEmail(name, email, url)`: `bookingInvite(AccountMails.firstName(name), mailLinks.of(url, "counselling_booking"))`.
- `sendCounsellorDailyDigest(counsellor, appointments, dateLabel)`: rows `{time, studentName, offline ? "In-person" : "Online"}`; `dailyDigest(first(counsellor), dateLabel, rows, mailLinks.of(counsellorPortalUrl(), …))`.
- `sendCounsellingBookingNudge(name, email, phone, userId, remaining, bookingUrl)`: add the `bookingUrl` parameter (Task 9 supplies it); `bookingNudge(first(name), remaining, mailLinks.of(bookingUrl, "counselling_book"))`; when `bookingUrl` is null fall back to `mailLinks.of(portalCounsellingUrl(), …)`.
- `sendCheckinCodeToStudent(a, code)`: `checkinCode(first, code, session(a))`.
- `sendCheckinPromptToStudent`: `checkinPromptStudent(first, session(a), mailLinks.of(portalCounsellingUrl(), …))`; `sendCheckinPromptToCounsellor`: `checkinPromptCounsellor(first(counsellor), studentName, time, portal)`.
- `sendMarkedAbsentEmail(a, missesRemaining)`: `markedAbsent(first, session(a), missesRemaining, portal)`.
- `sendDisputeOutcomeEmail(a, upheld, note)`: `disputeOutcome(first, date, upheld, note, portal)`.

- [ ] **Step 4: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchRoutingTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: counselling reminder, check-in and follow-up mails on the theme; 'in in' fixed"
```

---

### Task 10c: Counselling mails — summaries, deactivation, internal alerts; delete the old house style

**Files:**
- Modify: `service/email/mails/CounsellingMails.java` (append), `service/email/mails/InternalMails.java` (create here; Task 11 appends), `service/counselling/CounsellingNotificationService.java` methods: `sendSessionSummaryToStudent` (734), `sendSessionSummaryToCounsellor` (793), `sendCounsellorDeactivatedEmail` (2388), `sendCounsellorDeactivatedAdminAlert` (2481), `notifyAdminNoReplacement` (1886), `notifyAdminCounsellorNoShow` (2164), `notifyAdminDisputeRaised` (2189); `controller/career9/b2c/CampaignPublicController.java:1298-1345`
- Delete: `service/counselling/CounsellingEmailHtml.java`; methods `sendBookingReceivedEmail`, `sendCounsellorLeaveCancellationEmail`, `sendBlockDateRequestEmail`, `notifyStudentNoShow`, `bookingConfirmationHtml`, `greenPage`, `greenDetailRow`, `sessionDetailRows`, `sessionDetailsBlock`, `attendanceBlock`, `joinPreheader`, `sendRich*` and every other now-unused private helper in `CounsellingNotificationService`
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Produces: `CounsellingMails.summaryStudent(String firstName, Session s, String guidance /*nullable*/)`, `summaryCounsellor(String counsellorName, Session s, String guidance /*nullable*/)`, `counsellorDeactivated(String counsellorName, String sessionsSentence)`; `InternalMails.counsellorDeactivatedAlert(String counsellorName, String counsellorEmail, String adminName, List<String[]> rows /*student, when, contact, outcome*/, MailLink manageSessions)`, `InternalMails.counsellingRequestForwarded(String assessmentName, String studentName, String studentEmail, String studentPhone, String instituteName, MailLink assign)`, `InternalMails.adminNotice(String tag, String title, String lead, List<Mail.Row> facts, MailLink open, String buttonLabel)` (for the three small admin notices).

- [ ] **Step 1: Samples (failing)**

```java
        m.put("counselling-session-summary-student", CounsellingMails.summaryStudent(FIRST, S, "Read your report before the session so you can bring your questions."));
        m.put("counselling-session-summary-counsellor", CounsellingMails.summaryCounsellor(COUNSELLOR, S, "Please read the report before the session."));
        m.put("counsellor-deactivated-notice", CounsellingMails.counsellorDeactivated(COUNSELLOR, "Your 4 upcoming sessions have been reassigned or returned to the students to rebook."));
        m.put("counsellor-deactivated-admin-alert", InternalMails.counsellorDeactivatedAlert(COUNSELLOR, "priya.iyer@career-9.net", "Admin",
                java.util.Arrays.asList(new String[]{"Aarav Sharma", "18 Sep, 4:30 PM", "aarav@example.com · 98765 43210", "Rebooking link sent"},
                                        new String[]{"Diya Patel", "19 Sep, 11:00 AM", "diya@example.com · 98111 22334", "Needs follow-up"}),
                L("https://dashboard.career-9.com/admin/counselling/sessions")));
        m.put("counselling-request-forwarded", InternalMails.counsellingRequestForwarded(ASSESSMENT, STUDENT, "aarav@example.com", "98765 43210", SCHOOL, L("https://dashboard.career-9.com/admin/counsellors")));
        m.put("counselling-admin-no-replacement", InternalMails.adminNotice("Counselling", "Session needs a counsellor", "A counsellor cancelled and nobody else is free at that time.", java.util.Arrays.asList(new Mail.Row("Student", STUDENT), new Mail.Row("When", DATE + ", " + TIME)), L("https://dashboard.career-9.com/admin/counselling/sessions"), "Open Manage Sessions"));
```

- [ ] **Step 2: Append to `CounsellingMails`** (ids `counselling-session-summary-student`, `counselling-session-summary-counsellor`, `counsellor-deactivated-notice`)

```java
    public static Mail summaryStudent(String firstName, Session s, String guidance) {
        Mail.Builder m = Mail.builder().subject("Your counselling session details")
            .preheader(s.date + ", " + s.time + " with " + s.counsellor + ". Join link and report inside.")
            .title("Your counselling session").p(hi(firstName))
            .p("Here are the details of your counselling session with " + b(s.counsellor) + ".").details(rows(s, false, true))
            .action(s.join, "Join the session").links(null, s.report, "Open your assessment report");
        if (guidance != null && !guidance.isEmpty()) m.small(v(guidance));
        return m.small("If any of the above is incorrect, write to " + SUPPORT + " before the session so we can put it right.").signature().build();
    }
    public static Mail summaryCounsellor(String counsellorName, Session s, String guidance) {
        List<Mail.Row> r = new ArrayList<>();
        for (Mail.Row x : rows(s, true, true)) if (!"Counsellor".equals(x.label)) r.add(x);
        Mail.Builder m = Mail.builder().subject("Counselling session: " + s.student)
            .preheader(s.date + ", " + s.time + ". Join link and report inside.")
            .title("Counselling session: " + v(s.student)).p(hi(counsellorName))
            .p("Here are the details of your counselling session with " + b(s.student) + ".").details(r)
            .action(s.join, "Join the session").links(null, s.report, "Open the assessment report");
        if (guidance != null && !guidance.isEmpty()) m.small(v(guidance));
        return m.signature().build();
    }
    public static Mail counsellorDeactivated(String counsellorName, String sessionsSentence) {
        return Mail.builder().subject("Your Career-9 counsellor account has been deactivated")
            .preheader("You can no longer sign in to the counsellor portal.")
            .title("Your counsellor account has been deactivated").p(hi(counsellorName))
            .p("Your Career-9 counsellor account has been deactivated by the team. You will not be able to sign in to the counsellor portal, and no new sessions can be booked with you.")
            .p(v(sessionsSentence)).small("If you believe this is a mistake, write to " + SUPPORT + ".").signature().build();
    }
```

- [ ] **Step 3: Create `InternalMails`** (ids `counsellor-deactivated-admin-alert`, `counselling-request-forwarded`; the generic notice serves the three small admin alerts that today reuse `CounsellingEmailHtml`)

```java
package com.kccitm.api.service.email.mails;

import java.util.List;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

/** Mails to the Career-9 team and to notification-recipient lists. Internal tag, facts, one button to the admin page. */
public final class InternalMails {
    private InternalMails() { }

    public static Mail counsellorDeactivatedAlert(String counsellorName, String counsellorEmail, String adminName, List<String[]> rows, MailLink manageSessions) {
        int n = rows.size();
        return Mail.builder().subject("Counsellor deactivated: " + counsellorName + " (" + n + (n == 1 ? " session)" : " sessions)"))
            .preheader(n + (n == 1 ? " session" : " sessions") + " taken off the calendar. Some students may need a follow-up.")
            .internal("Counsellor deactivation").title("Counsellor deactivated")
            .details(new Mail.Row("Counsellor", counsellorName), new Mail.Row("Email", counsellorEmail), new Mail.Row("Deactivated by", adminName), new Mail.Row("Sessions affected", String.valueOf(n)))
            .p("The students below have had their session taken off the calendar. " + b("Rebooking link sent") + " means they can pick a new time themselves. " + b("Needs follow-up") + " means no other counsellor covers their assessment and they were told the team would be in touch.")
            .table(new String[]{"Student", "When", "Contact", "Outcome"}, rows)
            .action(manageSessions, "Open Manage Sessions").build();
    }

    public static Mail counsellingRequestForwarded(String assessmentName, String studentName, String studentEmail, String studentPhone, String instituteName, MailLink assign) {
        return Mail.builder().subject("Counselling request: " + assessmentName)
            .preheader("A student asked for counselling but no counsellor is mapped to this assessment.")
            .internal("Support inbox").title("Counselling request needs a counsellor")
            .p("A student has requested career counselling, but no counsellor is mapped to this assessment yet.")
            .details(new Mail.Row("Assessment", assessmentName), new Mail.Row("Student", studentName), new Mail.Row("Email", studentEmail), new Mail.Row("Phone", studentPhone), new Mail.Row("Institute", instituteName))
            .action(assign, "Assign a counsellor")
            .small("Assign a counsellor on the Counsellor &harr; Assessment page to let the student book.").build();
    }

    /** Small admin notices: no replacement counsellor, counsellor no-show, dispute raised. */
    public static Mail adminNotice(String tag, String title, String lead, List<Mail.Row> facts, MailLink open, String buttonLabel) {
        return Mail.builder().subject(title).preheader(lead.length() > 90 ? lead.substring(0, 90) : lead)
            .internal(tag).title(v(title)).p(v(lead)).details(facts).action(open, buttonLabel).build();
    }
}
```

- [ ] **Step 4: Switch the callers, then delete**

- `sendSessionSummaryToStudent` / `sendSessionSummaryToCounsellor`: `summaryStudent(first, session(a), reportGuidance)` / `summaryCounsellor(first(counsellor), session(a), guidance)`; keep the "throws when no address" behaviour.
- `sendCounsellorDeactivatedEmail(counsellor, sessionsAffected)`: `counsellorDeactivated(first(counsellor), sessionsSentence)` with the sentence the method already composes.
- `sendCounsellorDeactivatedAdminAlert(counsellor, rows, admin)`: build `List<String[]>` rows `{studentName, date + " " + startTime, email + " · " + phone, outcomeLabel}` and send `InternalMails.counsellorDeactivatedAlert(...)` with **`EmailType.COUNSELLOR_DEACTIVATED_ALERT`** to each address (bug fix: was `COUNSELLING_NOTIFICATION`).
- `notifyAdminNoReplacement`, `notifyAdminCounsellorNoShow`, `notifyAdminDisputeRaised`: `InternalMails.adminNotice("Counselling", <existing title>, <existing lead sentence>, facts(Student, When[, Counsellor]), mailLinks.of(adminSessionsUrl(), …), "Open Manage Sessions")`.
- `CampaignPublicController.notifyCounsellingForwarded`: `InternalMails.counsellingRequestForwarded(assessmentName, studentName, studentEmail, studentPhone, instituteName, mailLinks.of(counsellorMappingUrl(), "admin_counsellors"))` via `EmailSendRequest.mail(EmailType.COUNSELLING_REQUEST, supportEmail, mail)`.
- Delete the four dead methods, every `CounsellingEmailHtml` helper in the service, and `CounsellingEmailHtml.java`. `grep -rn "CounsellingEmailHtml" src/main/java` must return nothing.

- [ ] **Step 5: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchRoutingTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: counselling summaries and internal alerts on the theme; old house style and dead mails deleted"
```

---

### Task 11: Lead mails, account test, placeholder retirement, seeds

**Files:**
- Modify: `service/email/mails/InternalMails.java` (append `leadAlert`, `leadWelcome`, `accountTest`), `service/LeadNotificationService.java:99-330`, `service/email/EmailDispatchService.java` (`sendTestThroughAccount`), `service/email/EmailTemplateSeeder.java`, `model/email/EmailPlaceholder.java`, `model/email/EmailType.java` (placeholder lists), `service/email/PlaceholderResolver.java`
- Create: `service/email/LegacySeeds.java` (the three old seed bodies and the four old reminder bodies, verbatim, as constants)
- Test: entries in `MailSamples.all()`

**Interfaces:**
- Produces: `InternalMails.leadAlert(String leadType, String leadName, String leadSource, String receivedAt, List<Mail.Row> fields, String leadId, MailLink openLead)`, `InternalMails.leadWelcome(String firstName, List<Mail.Row> fields, MailLink site)`, `InternalMails.accountTest(String accountName, String provider, String sentAt)`; seed bodies `InternalMails.leadAlertSeed()`, `InternalMails.leadWelcomeSeed()` (token versions, `button()` instead of `action()`); `LegacySeeds.LOGIN_CREDENTIALS_BODY`, `LEAD_ALERT_BODY`, `LEAD_WELCOME_BODY`, `REMINDER_ASSESSMENT_INVITE_B2C`, `REMINDER_COUNSELLING_24H`, `REMINDER_COUNSELLING_1H`, `REMINDER_ASSESSMENT_MAPPING`.

- [ ] **Step 1: Samples (failing)**

```java
        List<Mail.Row> lead = java.util.Arrays.asList(new Mail.Row("Name", "Rohan Mehta"), new Mail.Row("Email", "rohan@example.com"), new Mail.Row("Phone", "98765 43210"), new Mail.Row("School", SCHOOL), new Mail.Row("City", "Indore"), new Mail.Row("Designation", "Parent"));
        m.put("lead-notification", InternalMails.leadAlert("Parent", "Rohan Mehta", "Website", "07 Sep 2026, 10:14 AM IST", lead, "1042", L("https://dashboard.career-9.com/leads")));
        m.put("lead-welcome", InternalMails.leadWelcome("Rohan", lead, L("https://career-9.com")));
        m.put("email-account-test", InternalMails.accountTest("Notifications (Gmail API)", "GMAIL/API", "07 Sep 2026, 11:20 AM IST"));
```

- [ ] **Step 2: Append to `InternalMails`** (ids `lead-notification`, `lead-welcome`, `email-account-test`)

```java
    public static Mail leadAlert(String leadType, String leadName, String leadSource, String receivedAt, List<Mail.Row> fields, String leadId, MailLink openLead) {
        return Mail.builder().subject("New " + leadType + " lead: " + leadName)
            .preheader(leadSource + " · received " + receivedAt)
            .internal("New lead alert").title("New enquiry from the website")
            .p(b(leadType) + " &middot; " + v(leadSource) + " &middot; received " + v(receivedAt))
            .details(fields)
            .action(openLead, "Open lead #" + leadId)
            .small("Every field the form submitted is listed above. This alert goes to everyone on the New-lead recipient list; change it under Email &rsaquo; Notification recipients.").build();
    }
    public static Mail leadWelcome(String firstName, List<Mail.Row> fields, MailLink site) {
        return Mail.builder().subject("Thanks for getting in touch with Career-9")
            .preheader("We have your enquiry and will be in touch shortly.")
            .title("Thanks for getting in touch").p(AccountMails.hi(firstName))
            .p("We have your enquiry and someone from our team will contact you shortly.")
            .p(b("Here is what you sent us:")).details(fields)
            .action(site, "Explore Career-9").signature().build();
    }
    public static Mail accountTest(String accountName, String provider, String sentAt) {
        return Mail.builder().subject("Career-9 email test: " + accountName)
            .preheader("If you can read this, the account can send.")
            .internal("Email account test").title("This account can send")
            .p("This is a test email from Career-9 confirming that the " + b(accountName) + " account (" + v(provider) + ") can send mail.")
            .details(new Mail.Row("Account", accountName), new Mail.Row("Provider", provider), new Mail.Row("Sent", sentAt)).build();
    }
    /** Seed bodies: same layout with {{tokens}}; button() because the href is a token until send time. */
    public static Mail leadAlertSeed() {
        return Mail.builder().subject("New {{lead_type}} lead: {{lead_name}}").preheader("{{lead_source}} · received {{lead_received_at}}")
            .internal("New lead alert").title("New enquiry from the website")
            .p("<b>{{lead_type}}</b> &middot; {{lead_source}} &middot; received {{lead_received_at}}")
            .details(new Mail.Row("Name", "{{lead_name}}"), new Mail.Row("Email", "{{lead_email}}"), new Mail.Row("Phone", "{{lead_phone}}"), new Mail.Row("School", "{{lead_school}}"), new Mail.Row("City", "{{lead_city}}"), new Mail.Row("Designation", "{{lead_designation}}"))
            .button(MailLink.of("{{lead_admin_link}}", ""), "Open lead #{{lead_id}}")
            .small("Every field the form submitted is listed above. This alert goes to everyone on the New-lead recipient list; change it under Email &rsaquo; Notification recipients.").build();
    }
    public static Mail leadWelcomeSeed() {
        return Mail.builder().subject("Thanks for getting in touch with Career-9").preheader("We have your enquiry and will be in touch shortly.")
            .title("Thanks for getting in touch").p("Hi {{first_name}},")
            .p("We have your enquiry and someone from our team will contact you shortly.")
            .p("<b>Here is what you sent us:</b>")
            .details(new Mail.Row("Name", "{{lead_name}}"), new Mail.Row("Email", "{{lead_email}}"), new Mail.Row("Phone", "{{lead_phone}}"), new Mail.Row("Enquiry type", "{{lead_type}}"), new Mail.Row("School", "{{lead_school}}"), new Mail.Row("City", "{{lead_city}}"))
            .button(MailLink.of("{{site_link}}", ""), "Explore Career-9").signature().build();
    }
```

`Details` escapes values, so `{{lead_name}}` survives (no `<`/`&`). Two new placeholders are needed: add `LEAD_ADMIN_LINK("lead_admin_link", "Link to the lead in the admin app", "Lead")` and `SITE_LINK("site_link", "Career-9 website", "Links")` to `EmailPlaceholder`; `LeadNotificationService.context(lead)` puts `lead_admin_link` = `frontendUrl + "/leads"` and `PlaceholderResolver` puts `site_link` = `app.mail.site-url` for every mail. Remove `EMAIL_HEADER` and `EMAIL_FOOTER` from `EmailPlaceholder` and from every `EmailType` placeholder list; `PlaceholderResolver.resolve` puts `"email_header"` and `"email_footer"` as `""` (old templates still referencing them render nothing there) and drops them from `RAW_HTML_KEYS`.

- [ ] **Step 3: Switch the callers**

- `LeadNotificationService.sendInternalAlert`: `req.setMail(InternalMails.leadAlert(type, lead.getFullName(), lead.getSource(), receivedAt(lead), fieldRows(lead), String.valueOf(lead.getId()), mailLinks.of(frontendUrl + "/leads", "leads")))` where `fieldRows` returns the same label/value pairs `detailsTable` builds today (keep `detailsTable` for the `lead_details` placeholder of edited admin templates). `sendAcknowledgement`: `req.setMail(InternalMails.leadWelcome(first, fieldRows(lead), mailLinks.of(siteUrl, "site")))`. Delete `fallbackAlertBody`, `fallbackAcknowledgementBody`, `fallbackAlertSubject`.
- `EmailDispatchService.sendTestThroughAccount`: `EmailSendRequest req = EmailSendRequest.mail(EmailType.ACCOUNT_TEST, to, InternalMails.accountTest(account.getName(), provider + mode, now))`.
- `EmailTemplateSeeder.run`: seed `LOGIN_CREDENTIALS` from `LoginCredentialsEmailService.defaultSubjectTemplate()/defaultBodyTemplate()` (Task 6), `LEAD_NOTIFICATION` from `InternalMails.leadAlertSeed()` (`mail.getSubject()`, `MailShell.bodyHtml(mail)`), `LEAD_WELCOME` from `InternalMails.leadWelcomeSeed()`. Move the current `LEAD_ALERT_BODY`/`LEAD_WELCOME_BODY` constants verbatim into `LegacySeeds`, together with the old login body from Task 6 and the four `reminder_config` bodies copied verbatim from `V20260525001__reminder_tables.sql` lines 74-83.

- [ ] **Step 4: Compile, test, commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailCatalogueTest,EmailDispatchWrapTest,EmailDispatchRoutingTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: lead and account-test mails on the theme; header/footer placeholders retired; legacy seeds kept for upgrade"
```

---

### Task 12: Reminder seeds and the boot-time seed upgrade

**Files:**
- Create: `service/email/mails/ReminderMails.java`, `service/email/MailSeedUpgrader.java`
- Modify: `service/reminder/AssessmentMappingReminderSchedulerService.java:80-90` (real assessment name and link), `service/reminder/ReminderSender.java` (no change needed: the dispatcher wraps reminder bodies)
- Test: `src/test/java/com/kccitm/api/service/email/MailSeedUpgraderTest.java`, entries in `MailSamples.all()`

**Interfaces:**
- Consumes: `ReminderConfigService.get(ReminderServiceType)` and its save/update method (`updateTemplate(type, subject, body)` — check the exact name in `ReminderConfigService`), `EmailTemplateRepository.findByEmailTypeOrderByNameAsc(String)`, `LegacySeeds.*`.
- Produces: `ReminderMails.assessmentMapping()`, `assessmentInviteB2c()`, `counselling24h()`, `counselling1h()` → `Mail` with `{{token}}` text; `MailSeedUpgrader` (`ApplicationRunner`, `@Order` after `EmailTemplateSeeder`) with `static String md5(String)` and `boolean upgradeIfUntouched(String current, String legacy)`.

- [ ] **Step 1: Write the failing upgrader test**

```java
package com.kccitm.api.service.email;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailSeedUpgraderTest {
    @Test
    void onlyUntouchedSeedsAreReplaced() {
        assertTrue(MailSeedUpgrader.isUntouched("<p>old</p>", "<p>old</p>"));
        assertTrue(MailSeedUpgrader.isUntouched("<p>old</p>\n", "<p>old</p>"), "whitespace at the ends does not count as an edit");
        assertFalse(MailSeedUpgrader.isUntouched("<p>old edited</p>", "<p>old</p>"));
        assertFalse(MailSeedUpgrader.isUntouched(null, "<p>old</p>"));
    }
}
```

- [ ] **Step 2: Write `ReminderMails`** (ids `reminder-assessment-mapping`, `reminder-assessment-invite-b2c-template`, `reminder-counselling-24h-template`, `reminder-counselling-1h-template`; tokens are the reminder ones: `studentName`, `assessmentName`, `instituteName`, `link`, `counsellorName`, `appointmentTime`, `meetingUrl`)

```java
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
```

Samples (the catalogue test renders them as-is; `{{` is allowed for these four ids — add `if (e.getKey().startsWith("reminder-")) continue;` before the unresolved-placeholder check, or register them with sample tokens substituted via `String.replace`):

```java
        m.put("reminder-assessment-mapping", ReminderMails.assessmentMapping());
        m.put("reminder-assessment-invite-b2c-template", ReminderMails.assessmentInviteB2c());
        m.put("reminder-counselling-24h-template", ReminderMails.counselling24h());
        m.put("reminder-counselling-1h-template", ReminderMails.counselling1h());
```

- [ ] **Step 3: Write `MailSeedUpgrader`**

```java
package com.kccitm.api.service.email;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.email.mails.InternalMails;
import com.kccitm.api.service.email.mails.ReminderMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailShell;
import com.kccitm.api.service.reminder.ReminderConfigService;
import com.kccitm.api.service.LoginCredentialsEmailService;

/**
 * Moves seeded templates onto the theme, but only rows nobody has edited: a body that still equals
 * the old seed byte-for-byte is replaced, anything else is left alone (the dispatcher shells it anyway).
 */
@Component
@Order(Integer.MAX_VALUE)
public class MailSeedUpgrader implements ApplicationRunner {
    private static final Logger logger = LoggerFactory.getLogger(MailSeedUpgrader.class);
    @Autowired private EmailTemplateRepository templateRepository;
    @Autowired private ReminderConfigService reminderConfigService;

    static boolean isUntouched(String current, String legacy) {
        return current != null && legacy != null && current.trim().equals(legacy.trim());
    }

    @Override
    public void run(ApplicationArguments args) {
        upgradeTemplate(EmailType.LOGIN_CREDENTIALS, LegacySeeds.LOGIN_CREDENTIALS_BODY, LoginCredentialsEmailService.defaultSubjectTemplate(), LoginCredentialsEmailService.defaultBodyTemplate());
        upgradeTemplate(EmailType.LEAD_NOTIFICATION, LegacySeeds.LEAD_ALERT_BODY, InternalMails.leadAlertSeed().getSubject(), MailShell.bodyHtml(InternalMails.leadAlertSeed()));
        upgradeTemplate(EmailType.LEAD_WELCOME, LegacySeeds.LEAD_WELCOME_BODY, InternalMails.leadWelcomeSeed().getSubject(), MailShell.bodyHtml(InternalMails.leadWelcomeSeed()));
        upgradeReminder(ReminderServiceType.ASSESSMENT_MAPPING, LegacySeeds.REMINDER_ASSESSMENT_MAPPING, ReminderMails.assessmentMapping());
        upgradeReminder(ReminderServiceType.ASSESSMENT_INVITE_B2C, LegacySeeds.REMINDER_ASSESSMENT_INVITE_B2C, ReminderMails.assessmentInviteB2c());
        upgradeReminder(ReminderServiceType.COUNSELLING_24H, LegacySeeds.REMINDER_COUNSELLING_24H, ReminderMails.counselling24h());
        upgradeReminder(ReminderServiceType.COUNSELLING_1H, LegacySeeds.REMINDER_COUNSELLING_1H, ReminderMails.counselling1h());
    }

    private void upgradeTemplate(EmailType type, String legacyBody, String subject, String body) {
        try {
            List<EmailTemplate> rows = templateRepository.findByEmailTypeOrderByNameAsc(type.name());
            for (EmailTemplate t : rows) {
                if (!isUntouched(t.getBodyTemplate(), legacyBody)) continue;
                t.setSubjectTemplate(subject); t.setBodyTemplate(body);
                templateRepository.save(t);
                logger.info("Upgraded untouched seed template {} (id {}) to the mail theme", type, t.getId());
            }
        } catch (Exception e) { logger.warn("Seed upgrade for {} skipped: {}", type, e.getMessage()); }
    }

    private void upgradeReminder(ReminderServiceType type, String legacyBody, Mail mail) {
        try {
            ReminderConfig cfg = reminderConfigService.get(type);
            if (cfg == null || !isUntouched(cfg.getBodyTemplate(), legacyBody)) return;
            reminderConfigService.updateTemplate(type, mail.getSubject(), MailShell.bodyHtml(mail));
            logger.info("Upgraded untouched reminder template {} to the mail theme", type);
        } catch (Exception e) { logger.warn("Reminder seed upgrade for {} skipped: {}", type, e.getMessage()); }
    }
}
```

If `ReminderConfigService.updateTemplate` has a different signature, adapt the call; do not add a Flyway migration.

- [ ] **Step 4: Fix the assessment-mapping reminder inputs**

In `AssessmentMappingReminderSchedulerService.runScheduledNudges` (and the manual path in `ManualReminderService` if it builds the same variables): `vars.put("assessmentName", assessmentTableRepository.findById(m.getAssessmentId()).map(AssessmentTable::getAssessmentName).orElse("your assessment"))` and `vars.put("link", linkBuilder.manualLogin())`. Inject `AssessmentTableRepository` and `LinkBuilder`.

- [ ] **Step 5: Test and commit**

```bash
mvn -o -q -DskipTests compile && mvn -o -q test -Dtest='MailSeedUpgraderTest,MailCatalogueTest' -DfailIfNoTests=false
git add -A src/main/java src/test/java
git commit -m "mail: reminder seeds on the theme; untouched seeds upgraded on boot; mapping reminder gets a real name and link"
```

---

### Task 13: Architecture test and the last cleanups

**Files:**
- Create: `src/test/java/com/kccitm/api/archtest/MailMarkupArchTest.java`
- Modify: `service/branding/InstituteBrandingService.java` (delete `emailHeaderHtml`, `emailFooterHtml`, `escapeHtml` if unused), `service/b2c/report/pipeline/OdooEmailSender.java` (if it composes HTML, route it through `MailRenderer` like the Gmail sender), any remaining string with `<html`, `<table`, `<div style`, `linear-gradient` or a `career-9.com` host outside the theme package.

**Interfaces:** none new. Consumes ArchUnit `ClassFileImporter` as in `EmailDispatchRoutingTest`.

- [ ] **Step 1: Write the failing arch test**

```java
package com.kccitm.api.archtest;

import java.util.*;
import org.junit.jupiter.api.Test;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Rules 2, 4 and 10 at build time: nobody outside the theme package writes email markup, uses a gradient,
 * or bakes a production host into a string. The fix is always the same — build a Mail and let the theme render it.
 */
public class MailMarkupArchTest {
    private static final List<String> FORBIDDEN = Arrays.asList("<html", "<table", "<div style", "linear-gradient",
            "https://assessment.career-9.com", "https://dashboard.career-9.com", "https://api.career-9.com");
    private static final String THEME = "com.kccitm.api.service.email.theme.";
    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList(
            // The "link expired" page is a web page, not a mail; it keeps its own markup.
            "com.kccitm.api.controller.ShortLinkController",
            // Old seed bodies, kept only so the upgrader can recognise untouched rows.
            "com.kccitm.api.service.email.LegacySeeds",
            // Placeholder samples for the admin editor preview.
            "com.kccitm.api.service.email.EmailTemplateService",
            "com.kccitm.api.service.reminder.ReminderTemplateRenderer",
            // Config defaults for the environment-specific bases live here on purpose.
            "com.kccitm.api.service.b2c.LinkBuilder",
            "com.kccitm.api.service.email.theme.MailLinks"));

    @Test
    public void noMailMarkupOutsideTheTheme() {
        JavaClasses classes = new ClassFileImporter().withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS).importPackages("com.kccitm.api");
        List<String> violations = new ArrayList<>();
        for (JavaClass cls : classes) {
            String name = cls.getFullName();
            if (name.startsWith(THEME) || ALLOWED.contains(name) || ALLOWED.contains(name.replaceAll("\\$.*$", ""))) continue;
            cls.getStaticInitializer().ifPresent(init -> { });
            for (com.tngtech.archunit.core.domain.JavaCodeUnit unit : cls.getCodeUnits()) {
                for (com.tngtech.archunit.core.domain.JavaConstructorCall call : unit.getConstructorCallsFromSelf()) { }
            }
            // ArchUnit does not expose string constants; read them from the class file's constant pool instead.
            for (String s : ConstantPool.strings(cls)) {
                for (String f : FORBIDDEN) if (s.contains(f)) violations.add(name + " contains \"" + f + "\"");
            }
        }
        if (!violations.isEmpty()) {
            Collections.sort(violations);
            fail("Email markup or hardcoded hosts outside the theme (" + violations.size() + "):\n  - " + String.join("\n  - ", violations)
                    + "\n\nBuild a Mail with the theme blocks instead, or add the class to ALLOWED with a reason.");
        }
    }
}
```

`ConstantPool.strings(JavaClass)` is a small helper in the same test package that opens the class resource (`cls.getSource().get().getUri()`), reads the constant pool with a minimal parser (tag 1 = UTF-8 entries) and returns the strings. Write it as:

```java
package com.kccitm.api.archtest;

import java.io.DataInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import com.tngtech.archunit.core.domain.JavaClass;

final class ConstantPool {
    private ConstantPool() { }
    static List<String> strings(JavaClass cls) {
        List<String> out = new ArrayList<>();
        if (!cls.getSource().isPresent()) return out;
        try (InputStream in = cls.getSource().get().getUri().toURL().openStream(); DataInputStream d = new DataInputStream(in)) {
            d.readInt(); d.readUnsignedShort(); d.readUnsignedShort();
            int n = d.readUnsignedShort();
            for (int i = 1; i < n; i++) {
                int tag = d.readUnsignedByte();
                switch (tag) {
                    case 1: out.add(d.readUTF()); break;
                    case 3: case 4: d.readInt(); break;
                    case 5: case 6: d.readLong(); i++; break;
                    case 7: case 8: case 16: case 19: case 20: d.readUnsignedShort(); break;
                    case 9: case 10: case 11: case 12: case 17: case 18: d.readInt(); break;
                    case 15: d.readUnsignedByte(); d.readUnsignedShort(); break;
                    default: return out;
                }
            }
        } catch (Exception e) { /* unreadable class: nothing to check */ }
        return out;
    }
}
```

Remove the two no-op loops from the test body (they are placeholders for nothing; delete the `getStaticInitializer` and `getCodeUnits` lines).

- [ ] **Step 2: Run it** — `mvn -o -q test -Dtest=MailMarkupArchTest -DfailIfNoTests=false` — Expected: FAIL listing every remaining offender (at least `InstituteBrandingService`, `UserController` if a host survived, `ContactPersonController`'s student-assigned mail, `OdooEmailSender`).

- [ ] **Step 3: Fix each offender**

- `InstituteBrandingService`: delete `emailHeaderHtml`, `emailFooterHtml`; `PlaceholderResolver` no longer calls them (Task 11).
- `ContactPersonController` "students assigned to you" mail (~line 371): build `InternalMails.adminNotice("Students assigned", "Students assigned to you", "The following " + n + " students from " + instituteName + " have been assigned to you.", rows(Student → name…), mailLinks.of(frontendUrl + "/students", …), "Open students")` — or, simpler and equally compliant, a `Mail` with `.list(names…)`. Use the list.
- Any `sendText`/`sendHtml` call that still builds markup: replace with a `Mail`.
- Re-run until the test passes.

- [ ] **Step 4: Full test run and commit**

```bash
mvn -o -q test 2>&1 | tail -30
git add -A src/main/java src/test/java
git commit -m "mail: markup arch test; branding header/footer helpers removed"
```

Expected: all tests green, including `EmailDispatchRoutingTest`, `MailCatalogueTest` (66 entries: 63 mails plus 3 variant ids), `MailMarkupArchTest`.

---

### Task 14: Frontend cleanup, catalogue regeneration, rollout

**Files:**
- Modify: `react-social/src/app/pages/B2C/Tracker/components/EntitlementDrawer.tsx:238-256` (delete the "Resend 1-pager" button; keep "Resend final report", which now sends Report ready), `react-social/src/app/pages/EmailTemplates/components/EmailTemplateEditorModal.tsx` (no code change; confirm the placeholder palette no longer lists `email_header`/`email_footer` after a backend restart)
- Create: `docs/superpowers/plans/email-theme-reference/README.md` (how to regenerate `target/mail-samples` and compare with the approved catalogue)

- [ ] **Step 1: Drop the 1-pager button**

In `EntitlementDrawer.tsx` remove the `<Button … onClick={() => handleResend("one_pager")}>` block (lines ~241-244) and any `one_pager` label mapping. Run `cd react-social && npm run typecheck` and confirm the error count equals the committed baseline (58, see memory note).

- [ ] **Step 2: Regenerate the samples and compare**

```bash
cd spring-social && mvn -o -q test -Dtest=MailCatalogueTest -DfailIfNoTests=false && ls target/mail-samples | wc -l
```

Open `target/mail-samples/login-credentials.html` and `counselling-booking-confirmation.html` in a browser beside the approved catalogue (`https://claude.ai/code/artifact/ca5bdbaa-c8d1-451a-bbfa-d03e9ebed256`); the block order and wording must match `mail_specs.py`.

- [ ] **Step 3: Rollout checklist (README)**

```markdown
# Mail theme — rollout
1. Upload `career-9-email-v1.png` to the Spaces bucket at `branding/career-9-email-v1.png` (public read). Never overwrite it; a new logo gets `-v2`.
2. Set `APP_MAIL_LOGO_URL` per environment if the CDN host differs from the default in application.yml.
3. Restart the backend. `MailSeedUpgrader` logs one line per seed row it upgrades.
4. Admin → Email accounts → "Test": the test mail must show the logo and the footer.
5. Send one mail per module through the admin surfaces: login credentials (Students → send credentials), payment link, resend final report, counselling booking invite, lead capture on the website form.
6. Regenerate previews any time with `mvn -o -q test -Dtest=MailCatalogueTest` → `target/mail-samples/`.
```

- [ ] **Step 4: Commit**

```bash
git add react-social/src/app/pages/B2C/Tracker/components/EntitlementDrawer.tsx docs/superpowers/plans/email-theme-reference/README.md
git commit -m "mail: drop the 1-pager resend button; rollout notes"
```

---

## Self-review

- **Spec coverage.** §3 theme layer → Tasks 1–3; dispatcher wrap and link rewriting → Task 4; placeholders/admin templates/seeds → Tasks 11–12; whitelabel → Task 3 (`BrandResolver`); config → Task 3; §4 inventory → Tasks 6–11 (63 mails; the counselling counsellor-variants of admin-cancellation and reschedule, and the upheld dispute, are registered under their own ids); retirements → Tasks 8, 10c, 14; behaviour changes → Tasks 6 (activation), 9 (nudge cap, one booking nudge), 10a (text part with .ics), 10b ("in in"), 10c (alert type), 12 (mapping reminder inputs), 6/7 (escaping); §7 tests → Tasks 1–5, 12, 13. Not covered on purpose: report-mail idempotency (phase 2).
- **Placeholders.** None: every mail's blocks are spelled out; wording matches `mail_specs.py`.
- **Type consistency.** `Mail.Row(label, value)` public fields (10a makes them public); `MailLink.of/plain`; `MailLinks.of(url[, purpose])`; `EmailDispatchService.sendMail(type, to, mail)`; `NotificationDispatcher.sendEmail(e, to, serviceType, Mail, link)`; `CounsellingMails.Session` 10-arg constructor order `(date, time, duration, counsellor, mode, school, assessment, student, join, report)` used identically in 10a/10b/10c and samples.
