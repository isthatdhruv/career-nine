package com.kccitm.api.util;

import java.nio.charset.StandardCharsets;

public final class MojibakeFixer {

    private MojibakeFixer() {
    }

    public static String fix(String input) {
        if (input == null || input.isEmpty()) return input;
        if (!hasMojibake(input)) return input;

        byte[] bytes = input.getBytes(StandardCharsets.ISO_8859_1);
        String decoded = new String(bytes, StandardCharsets.UTF_8);

        if (decoded.indexOf('�') >= 0) return input;
        return decoded;
    }

    private static boolean hasMojibake(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0x80 && c <= 0x9F) return true;
        }
        return false;
    }
}
