package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NavigatorProConstructMapTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();

    @Test
    void loadsAllThirtyThreeConstructsFromClasspath() {
        assertThat(map.all()).hasSize(33);
        assertThat(map.get("fs_tp").questions).isEqualTo(6);
        assertThat(map.get("d_pe").max).isEqualTo(5);
        assertThat(map.get("attention").mqts).containsExactly("Personality- Validity");
        assertThat(map.label("fam_r")).isEqualTo("Hands-on");
    }

    @Test
    void resolvesMqtNamesIgnoringCaseAndWhitespace() {
        assertThat(map.constructFor("  doer ")).contains("fam_r");
        assertThat(map.constructFor("personality-  validity")).contains("attention");
        assertThat(map.constructFor("Quality, Testing & Operations")).contains("d_qt");
        assertThat(map.constructFor("Grit")).isEmpty();
        assertThat(map.constructFor(null)).isEmpty();
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
