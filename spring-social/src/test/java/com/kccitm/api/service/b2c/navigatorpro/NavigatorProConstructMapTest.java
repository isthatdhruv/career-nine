package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NavigatorProConstructMapTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();

    @Test
    void loadsTheV3InstrumentFromClasspath() {
        assertThat(map.all()).hasSize(33);
        assertThat(map.get("fs_tp").questions).isEqualTo(6);
        assertThat(map.get("d_pe").max).isEqualTo(4);                       // 4-point doing scale
        assertThat(map.get("f_id").mqts).containsExactly("Self-Efficacy", "Growth Mindset");
        assertThat(map.get("f_ae").mqts).containsExactly("Proactivity", "Learning Agility", "Metacognition");
        assertThat(map.get("attention").mqts).containsExactly("Attention Check");
        assertThat(map.label("f_id")).isEqualTo("Self-Motivation");
        assertThat(map.label("f_st")).isEqualTo("Consistency");
        assertThat(map.label("f_ae")).isEqualTo("Adaptability");
        assertThat(map.label("fam_s")).isEqualTo("People-focused");
        assertThat(map.label("fam_c")).isEqualTo("Organized");
        assertThat(map.label("fs_gd")).isEqualTo("Finishing what you start");
    }

    @Test
    void resolvesMqtNamesIgnoringCaseAndWhitespace() {
        assertThat(map.constructFor("  self-efficacy ")).contains("f_id");
        assertThat(map.constructFor("Metacognition")).contains("f_ae");
        assertThat(map.constructFor("Getting things done")).contains("fs_gd");
        assertThat(map.constructFor("Cognitive check — spreadsheet logic")).contains("chk_spr");
        assertThat(map.constructFor("Quality, Testing & Operations")).contains("d_qt");
        assertThat(map.constructFor("Doer")).isEmpty();                      // retired v2 name
        assertThat(map.constructFor("Cognitive Check")).isEmpty();           // shared pilot type
        assertThat(map.constructFor(null)).isEmpty();
    }

    @Test
    void aspirationAndDomainLabels() {
        assertThat(map.isAspiration(" aspiration")).isTrue();
        assertThat(map.isAspiration("Validity")).isFalse();
        assertThat(map.domainForLabel("power & energy")).contains("d_pe");
        assertThat(map.domainForLabel("Grit")).isEmpty();
    }

    @Test
    void rejectsFileWithoutConstructsBlock() {
        assertThatThrownBy(() -> new NavigatorProConstructMap(
                new ByteArrayInputStream("foo: 1".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("constructs");
    }

    @Test
    void rejectsOneMqtFeedingTwoConstructs() {
        String yaml = "constructs:\n"
                + "  f_id: { label: A, mqts: [\"Internal Drive\"], questions: 4, min: 1, max: 5 }\n"
                + "  f_st: { label: B, mqts: [\"internal drive\"], questions: 3, min: 1, max: 5 }\n";
        assertThatThrownBy(() -> new NavigatorProConstructMap(
                new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("feeds both");
    }

    @Test
    void rejectsMissingRequiredConstruct() {
        String yaml = "constructs:\n"
                + "  f_id: { label: A, mqts: [\"Internal Drive\"], questions: 4, min: 1, max: 5 }\n";
        assertThatThrownBy(() -> new NavigatorProConstructMap(
                new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("f_st");
    }
}
