package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NavigatorProContentTest {

    @Test
    void everyIndexHasThreeBandParagraphs() {
        for (String key : List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning")) {
            for (String band : List.of("Strong", "Developing", "Early")) {
                assertThat(NavigatorProContent.bandParagraph(key, band))
                        .as(key + "/" + band).isNotBlank();
            }
        }
        assertThat(NavigatorProContent.bandParagraph("drive", "")).isEmpty();
        assertThat(NavigatorProContent.bandParagraph("nope", "Strong")).isEmpty();
    }

    @Test
    void bandParagraphsNeverUseForbiddenWords() {
        for (String key : List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning")) {
            for (String band : List.of("Strong", "Developing", "Early")) {
                String t = NavigatorProContent.bandParagraph(key, band).toLowerCase();
                assertThat(t).doesNotContain(" poor", " weak ", "below average", "least motivated", "fail");
            }
        }
    }

    @Test
    void valuesLookupJoinsOnExactOptionText() {
        NavigatorProContent.ValueRow v = NavigatorProContent.value("Good pay and benefits").orElseThrow();
        assertThat(v.icon).isEqualTo("💰");
        assertThat(v.title).isEqualTo("Good pay and benefits");
        assertThat(v.why).startsWith("Honest and practical");
        assertThat(NavigatorProContent.value("  Good pay and benefits ")).isPresent();
        assertThat(NavigatorProContent.value("good pay and benefits")).isEmpty();
        assertThat(NavigatorProContent.value(null)).isEmpty();
        assertThat(NavigatorProContent.VALUE_TEXTS).hasSize(12);
    }

    @Test
    void bannerAndDefinitionsAndStatics() {
        assertThat(NavigatorProContent.banner()).contains("THIS REPORT MAY BE BIASED").contains("#c0392b");
        assertThat(NavigatorProContent.factorDefinition("f_st")).startsWith("your staying power");
        assertThat(NavigatorProContent.zoneCopy("Ready to accelerate")).isNotBlank();
        assertThat(NavigatorProContent.zoneCopy("Starting the journey")).isEmpty();
        assertThat(NavigatorProContent.firstStep("fs_gd")).isNotBlank();
        assertThat(NavigatorProContent.firstStep("fs_nd")).isEmpty();
        assertThat(NavigatorProContent.precisionLine(11, 84)).isEqualTo(
                "Percentiles carry about ±11 in a batch of 84 — read levels, not points.");
        assertThat(NavigatorProContent.factorCallout("Adaptive Execution", 86, "Sustained Tenacity", 78, 11))
                .contains("Adaptive Execution (P86)").contains("Sustained Tenacity (P78)").contains("±11");
        assertThat(NavigatorProContent.howToRead("Priya")).startsWith("How to read this report, Priya:");
    }
}
