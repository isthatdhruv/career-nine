package com.kccitm.api.service.b2c.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateRendererTest {

    private final TemplateRenderer r = new TemplateRenderer();

    @Test
    void plainTemplate_isUnchanged() {
        assertThat(r.fill("<p>{{a}} and {{ b }} and {{missing}}</p>", Map.of("a", "<b>\"x\"</b>", "b", 3)))
                .isEqualTo("<p><b>\"x\"</b> and 3 and {{missing}}</p>");
    }

    /** Regression: an SVG value in a bundled page closed the JSON string and blanked the report. */
    @Test
    void bundledTemplate_staysValidJson_andInnerScriptsGetJsEscaping() throws Exception {
        String markup = "<div class=\"cover\">{{cover_mark}}</div><p>{{one_line}}</p>"
                + "<script>var t = { one_line: ['{{one_line}}'] };</script>";
        String page = "<html><body><script type=\"__bundler/manifest\">{}</script>\n"
                + "<script type=\"__bundler/template\">\n" + new ObjectMapper().writeValueAsString(markup).replace("</", "<\\/") + "\n</script>"
                + "<p>{{one_line}}</p></body></html>";
        String svg = "<svg viewBox=\"0 0 1 1\"><polygon points=\"1,2\"/></svg>";
        String line = "next year's \"plan\"\nback\\slash </script>";

        String out = r.fill(page, Map.of("cover_mark", svg, "one_line", line));

        Matcher m = Pattern.compile("<script type=\"__bundler/template\">(.*?)</script>", Pattern.DOTALL).matcher(out);
        assertThat(m.find()).isTrue();
        assertThat(m.group(1)).doesNotContain("</");                          // cannot close the outer script
        String decoded = new ObjectMapper().readValue(m.group(1).trim(), String.class);
        assertThat(decoded).startsWith("<div class=\"cover\">" + svg + "</div>");
        assertThat(decoded).contains("<p>" + line + "</p>");                  // markup gets the raw value
        assertThat(decoded).contains("one_line: ['next year\\'s \\\"plan\\\"\\nback\\\\slash <\\/script>']");
        assertThat(out).endsWith("<p>" + line + "</p></body></html>");        // outside the bundle: unchanged
    }
}
