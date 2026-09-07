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
