package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** content-v3.json against NavigatorPro_Backend_Content_v3.xlsx. */
class NavigatorProContentTest {

    private final NavigatorProContent c = NavigatorProContent.defaults();
    private final NavigatorProConstructMap map = new NavigatorProConstructMap();

    @Test
    void fourZonesWithParagraphAndMapCallout() {
        for (String z : List.of(NavigatorProNorms.ZONE_READY, NavigatorProNorms.ZONE_MOTIVATED,
                NavigatorProNorms.ZONE_CAPABLE, NavigatorProNorms.ZONE_SUPPORT)) {
            NavigatorProContent.Zone zone = c.zone(z).orElseThrow();
            assertThat(zone.paragraph).as(z).isNotBlank();
            assertThat(zone.means).as(z).isNotBlank();
            assertThat(zone.first).as(z).isNotBlank();
            assertThat(zone.todo).as(z).isNotBlank();
        }
        assertThat(c.zone(NavigatorProNorms.ZONE_MOTIVATED).orElseThrow().paragraph)
                .startsWith("You are motivated — and that is the hard part");
        assertThat(c.zone("Starting the journey")).isEmpty();                 // v2 zone name is gone
    }

    @Test
    void everyFamilyHasTwoBulletsPerBand() {
        for (String f : NavigatorProConstructMap.FAMILY_KEYS) {
            for (String band : List.of("High", "Mid", "Low")) {
                assertThat(c.familyBullets(map.label(f), band)).as(f + "/" + band).hasSize(2);
            }
        }
        assertThat(c.familyBullets("Hands-on", "High").get(0)).isEqualTo("You learn fastest by building and handling real things.");
    }

    @Test
    void valuesJoinOnTagNeverOnFreeText() {
        NavigatorProContent.ValueRow v = c.value("Pay & benefits").orElseThrow();
        assertThat(v.icon).isEqualTo("💰");
        assertThat(v.option).isEqualTo("Good pay and benefits");
        assertThat(v.why).startsWith("Honest and practical");
        assertThat(c.value(" pay &  benefits")).isPresent();
        assertThat(c.value("Good pay and benefits")).isEmpty();
        assertThat(c.value(null)).isEmpty();
        for (String tag : NavigatorProFixtures.VALUE_TAGS) assertThat(c.value(tag)).as(tag).isPresent();
    }

    @Test
    void everyDomainHasThreePathwaysThreeProjectsAndThreeInternships() {
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) {
            String label = map.label(d);
            assertThat(c.pathways(label)).as(label).hasSize(3);
            for (String flavour : List.of("Build", "Design/People", "Business/Ops")) {
                assertThat(c.project(label, flavour)).as(label + "/" + flavour).isNotBlank();
            }
            assertThat(c.internships(label)).as(label).hasSize(3);
        }
        assertThat(c.pathways("Power & Energy").get(0).type).isEqualTo("Emerging sector");
    }

    @Test
    void widerDoorsExistForTheFourNonEngineeringFamilies() {
        for (String f : List.of("Creative", "People-focused", "Enterprising", "Organized")) {
            assertThat(c.widerDoors(f)).as(f).hasSize(3);
            assertThat(c.widerDoorsNote(f)).as(f).isNotBlank();
        }
        assertThat(c.hasWiderDoors("Hands-on")).isFalse();
        assertThat(c.template("track_a_closing")).startsWith("Your strengths are real");
    }

    @Test
    void templatesFillSlotsAndRefuseSurvivingOnes() {
        assertThat(NavigatorProContent.fill(c.template("tie"), Map.of("gap", "1")))
                .isEqualTo("Your top two directions sit 1 point(s) apart — treat them as equally suited and test both.");
        assertThatThrownBy(() -> NavigatorProContent.fill(c.template("habit_plan"), Map.of("low1", "x")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("unresolved slot");
        assertThat(c.template("banner")).isEqualTo("This report may be biased — read it with your counsellor.");
        assertThat(c.factorLine("f_st")).isEqualTo("your staying power when work gets long or boring");
        assertThat(c.text("ring_logic")).isEqualTo("5 objective checks");
        assertThat(NavigatorProContent.flavourFor("fam_i")).isEqualTo("Build");
        assertThat(NavigatorProContent.flavourFor("fam_s")).isEqualTo("Design/People");
        assertThat(NavigatorProContent.flavourFor("fam_c")).isEqualTo("Business/Ops");
    }

    @Test
    void noStudentFacingTextUsesForbiddenWords() {
        StringBuilder all = new StringBuilder();
        for (String f : NavigatorProConstructMap.FAMILY_KEYS)
            for (String band : List.of("High", "Mid", "Low")) all.append(String.join(" ", c.familyBullets(map.label(f), band))).append(' ');
        for (String z : List.of(NavigatorProNorms.ZONE_READY, NavigatorProNorms.ZONE_MOTIVATED,
                NavigatorProNorms.ZONE_CAPABLE, NavigatorProNorms.ZONE_SUPPORT)) all.append(c.zone(z).orElseThrow().paragraph).append(' ');
        String t = all.toString().toLowerCase();
        assertThat(t).doesNotContain(" poor ", "below average", "least motivated", " fail ");
    }
}
