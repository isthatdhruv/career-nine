package com.kccitm.api.service.b2c.report.pipeline;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.apache.kafka.clients.admin.NewTopic;

/**
 * Report pipeline topic definitions. The two main topics are partitioned to the
 * desired max parallelism (partitions ≥ consumer concurrency). Retry + DLT
 * topics are auto-created by {@code @RetryableTopic} on the consumers.
 *
 * <p>The whole feature is gated by {@code report.pipeline.enabled} (default
 * true) so it can be toggled per environment / during load testing without a
 * rebuild.
 */
@Configuration
public class ReportPipelineConfig {

    public static final String TOPIC_GENERATE = "report.generate";
    public static final String TOPIC_EMAIL    = "report.email";

    @Value("${report.pipeline.partitions:6}")
    private int partitions;

    @Bean
    public NewTopic reportGenerateTopic() {
        return TopicBuilder.name(TOPIC_GENERATE).partitions(partitions).replicas(1).build();
    }

    @Bean
    public NewTopic reportEmailTopic() {
        return TopicBuilder.name(TOPIC_EMAIL).partitions(partitions).replicas(1).build();
    }
}
