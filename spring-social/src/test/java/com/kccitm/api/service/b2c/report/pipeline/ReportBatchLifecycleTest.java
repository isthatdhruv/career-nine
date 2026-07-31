package com.kccitm.api.service.b2c.report.pipeline;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportBatchLifecycleTest {

    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> ops;
    @InjectMocks ReportBatchLifecycle lifecycle;

    @Test
    void nullOrBlankBatchId_neverStopped() {
        assertThat(lifecycle.isStopped(null)).isFalse();
        assertThat(lifecycle.isStopped("")).isFalse();
    }

    @Test
    void cancelledBatch_isStopped() {
        when(redis.hasKey("report:batch:cancelled:b1")).thenReturn(true);
        assertThat(lifecycle.isStopped("b1")).isTrue();
    }

    @Test
    void expiredLease_isStopped() {
        when(redis.hasKey("report:batch:cancelled:b1")).thenReturn(false);
        when(redis.hasKey("report:batch:alive:b1")).thenReturn(false);
        assertThat(lifecycle.isStopped("b1")).isTrue();
    }

    @Test
    void aliveLease_notStopped() {
        lenient().when(redis.opsForValue()).thenReturn(ops);
        when(redis.hasKey("report:batch:cancelled:b1")).thenReturn(false);
        when(redis.hasKey("report:batch:alive:b1")).thenReturn(true);
        assertThat(lifecycle.isStopped("b1")).isFalse();
    }
}
