package com.kccitm.api.service.b2c.report.pipeline;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportEmailIdempotencyTest {

    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> ops;
    @InjectMocks ReportEmailIdempotency idempotency;

    @Test
    void claimWithoutBatchId_usesLegacyKey() {
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(eq("report:sent:5:9"), eq("sending"), any(Duration.class))).thenReturn(true);
        assertThat(idempotency.claim(5, 9, null)).isEqualTo(ReportEmailIdempotency.Claim.PROCEED);
    }

    @Test
    void claimWithBatchId_usesBatchScopedKey() {
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(eq("report:sent:5:9:batch-42"), eq("sending"), any(Duration.class))).thenReturn(true);
        assertThat(idempotency.claim(5, 9, "batch-42")).isEqualTo(ReportEmailIdempotency.Claim.PROCEED);
    }

    @Test
    void releaseWithBatchId_deletesBatchScopedKey() {
        idempotency.release(5, 9, "batch-42");
        verify(redis).delete("report:sent:5:9:batch-42");
    }
}
