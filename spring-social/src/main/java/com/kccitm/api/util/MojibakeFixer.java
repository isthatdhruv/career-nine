package com.kccitm.api.util;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CharsetEncoder;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/**
 * Repairs UTF-8 text that was corrupted by being decoded as Windows-1252
 * ("mojibake"), e.g. an apostrophe ' becomes "a€™" or e becomes "A©".
 *
 * <p>The corruption happens when UTF-8 bytes are read through a latin1/cp1252
 * connection or import. MySQL's "latin1" is actually Windows-1252, so the
 * repair must re-encode using <b>windows-1252</b> (NOT ISO-8859-1) to recover
 * the original bytes, then decode them as UTF-8. This mirrors the SQL repair
 * {@code CONVERT(CAST(CONVERT(text USING latin1) AS BINARY) USING utf8mb4)}.
 *
 * <p>The method is self-validating and conservative: it only returns repaired
 * text when the round-trip succeeds (the string is fully representable in
 * windows-1252 AND the resulting bytes are valid UTF-8). Anything else --
 * genuine accented text like "cafe", emoji, CJK, or already-clean smart
 * quotes -- fails one of those checks and is returned unchanged. It is also
 * idempotent: running it on already-clean text is a no-op.
 */
public final class MojibakeFixer {

    private static final Charset CP1252 = Charset.forName("windows-1252");

    private MojibakeFixer() {
    }

    public static String fix(String input) {
        if (input == null || input.isEmpty()) return input;
        if (!hasNonAscii(input)) return input;

        try {
            // Re-encode using the charset the bytes were originally misread as.
            // REPORT (not REPLACE) so a char that isn't real mojibake aborts the fix.
            CharsetEncoder encoder = CP1252.newEncoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            ByteBuffer bytes = encoder.encode(CharBuffer.wrap(input));

            // Decode those bytes strictly as UTF-8. Legitimate text (e.g. a lone
            // accented char) is not valid UTF-8 here and throws -> left untouched.
            CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            String decoded = decoder.decode(bytes).toString();

            return decoded.equals(input) ? input : decoded;
        } catch (CharacterCodingException e) {
            // Not cp1252-representable or not valid UTF-8 -> not mojibake.
            return input;
        }
    }

    private static boolean hasNonAscii(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) > 0x7F) return true;
        }
        return false;
    }
}
