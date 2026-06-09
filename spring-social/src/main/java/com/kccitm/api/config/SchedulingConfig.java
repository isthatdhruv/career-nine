package com.kccitm.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables {@code @Scheduled} background jobs ONLY in containers that are NOT the
 * report worker.
 *
 * <p>The {@code report-worker} container runs the same application jar (to share
 * {@code ReportService}, email services, etc.) but must NOT re-run the platform's
 * scheduled jobs — submission retry, partial-answer flush, entitlement
 * nudges/expiry, proctoring retry, counselling reminders. Without this gate they
 * would fire twice (once in {@code api}, once in {@code report-worker}), causing
 * duplicate processing and duplicate emails.
 *
 * <p>The report pipeline itself is Kafka-driven ({@code @KafkaListener}), so the
 * worker needs no scheduling.
 */
@Configuration
@Profile("!report-worker")
@EnableScheduling
public class SchedulingConfig {
}
