package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReportGenerateEventTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void legacyJsonWithoutNewFields_deserializesToTodaysBehavior() throws Exception {
        String legacy = "{\"userStudentId\":1,\"assessmentId\":2,\"recipientEmail\":\"a@b.c\","
                + "\"whitelabel\":true,\"schoolName\":\"S\",\"logoUrl\":null}";
        ReportGenerateEvent ev = mapper.readValue(legacy, ReportGenerateEvent.class);
        assertThat(ev.force).isFalse();
        assertThat(ev.reportTemplateId).isNull();
        assertThat(ev.emailMode).isEqualTo("auto");
        assertThat(ev.batchId).isNull();
        assertThat(ev.key()).isEqualTo("1:2");
    }

    @Test
    void adminFieldsRoundTripThroughJson() throws Exception {
        ReportGenerateEvent ev = new ReportGenerateEvent(1L, 2L, "a@b.c", false, "S", null);
        ev.force = true;
        ev.reportTemplateId = 7L;
        ev.emailMode = "all";
        ev.batchId = "batch-123";
        ReportGenerateEvent back = mapper.readValue(mapper.writeValueAsString(ev), ReportGenerateEvent.class);
        assertThat(back.force).isTrue();
        assertThat(back.reportTemplateId).isEqualTo(7L);
        assertThat(back.emailMode).isEqualTo("all");
        assertThat(back.batchId).isEqualTo("batch-123");
    }
}
