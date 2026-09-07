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
