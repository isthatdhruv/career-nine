package com.kccitm.api.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

/**
 * Proves the mojibake repair restores corrupted text exactly while leaving
 * genuine non-Latin text and clean punctuation untouched. The corrupted input
 * for each case is built deterministically (the inverse of the corruption:
 * UTF-8 bytes decoded as windows-1252) so the test needs no embedded mojibake.
 */
class MojibakeFixerTest {

    private static final Charset CP1252 = Charset.forName("windows-1252");

    /** Reproduce the exact corruption: take clean UTF-8 text, read its bytes as windows-1252. */
    private static String corrupt(String clean) {
        return new String(clean.getBytes(StandardCharsets.UTF_8), CP1252);
    }

    @Test
    void restoresSmartQuote() {
        String clean = "Rarely figure out the mystery before it’s revealed.";
        assertThat(MojibakeFixer.fix(corrupt(clean))).isEqualTo(clean);
    }

    @Test
    void restoresEmDash() {
        String clean = "Here are some statements — no right or wrong answers";
        assertThat(MojibakeFixer.fix(corrupt(clean))).isEqualTo(clean);
    }

    @Test
    void restoresAccentedLatin() {
        String clean = "café résumé"; // café résumé
        assertThat(MojibakeFixer.fix(corrupt(clean))).isEqualTo(clean);
    }

    @Test
    void leavesGenuineHindiUntouched() {
        String hindi = "सामाजिक रुचि"; // सामाजिक रुचि
        assertThat(MojibakeFixer.fix(hindi)).isEqualTo(hindi);
    }

    @Test
    void leavesCleanSmartQuoteUntouched() {
        // A correctly-stored ' must NOT be "fixed" into garbage.
        String clean = "it’s fine";
        assertThat(MojibakeFixer.fix(clean)).isEqualTo(clean);
    }

    @Test
    void leavesPlainAsciiUntouched() {
        String s = "Predict the ending based on clues";
        assertThat(MojibakeFixer.fix(s)).isSameAs(s);
    }

    @Test
    void isIdempotent() {
        String clean = "it’s a test — really";
        String once = MojibakeFixer.fix(corrupt(clean));
        assertThat(once).isEqualTo(clean);
        // Running again on already-clean text changes nothing.
        assertThat(MojibakeFixer.fix(once)).isEqualTo(clean);
    }

    @Test
    void handlesNullAndEmpty() {
        assertThat(MojibakeFixer.fix(null)).isNull();
        assertThat(MojibakeFixer.fix("")).isEqualTo("");
    }
}
