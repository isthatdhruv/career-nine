package com.kccitm.api.service.psychometric;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Manual integration check against the local dev database: generates the
 * psychometric properties workbook for a real Navigator assessment and writes
 * it to target/ for inspection. Run explicitly with:
 *
 * <pre>mvnw test -Dtest=PsychometricExportLocalIT -Dpsychometric.it=true
 *     -Dpsychometric.assessmentId=18</pre>
 */
@SpringBootTest
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "psychometric.it", matches = "true")
class PsychometricExportLocalIT {

    @Autowired
    private PsychometricPropertiesExportService service;

    @Test
    void exportsRealAssessment() throws Exception {
        long assessmentId = Long.getLong("psychometric.assessmentId", 18L);
        byte[] bytes = service.export(assessmentId, null);
        assertNotNull(bytes, "no scoreable students for assessment " + assessmentId);
        assertTrue(bytes.length > 20_000);
        Path out = Path.of("target", "psychometric-real-" + assessmentId + ".xlsx");
        Files.write(out, bytes);
        System.out.println("WROTE " + out.toAbsolutePath() + " (" + bytes.length + " bytes)");
    }
}
