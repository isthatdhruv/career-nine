package com.kccitm.api.config;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Bounded executors for @Async work.
 *
 * Before this config existed, ALL @Async methods (submission persistence,
 * proctoring persistence, every email send, audit logging) shared Spring
 * Boot's auto-configured default: 8 core threads with an UNBOUNDED queue.
 * At event scale (thousands of near-simultaneous submits) that meant a
 * multi-minute persistence backlog — during which students sat in the
 * accepted-but-not-persisted window — and the whole in-memory queue was
 * silently lost on any restart.
 *
 * Three pools, so one slow workload can never starve another:
 *  - submissionExecutor: answer persistence — the only path that must keep
 *    up with the event's submit rush. CallerRunsPolicy = when saturated,
 *    the HTTP thread does the work itself (graceful backpressure, never drop).
 *  - proctoringExecutor: multi-MB telemetry persistence — important but
 *    sacrificial; must never compete with answer persistence.
 *  - applicationTaskExecutor: everything else (@Async without a qualifier:
 *    emails, audit logging). Named exactly like Boot's default so unqualified
 *    @Async methods keep resolving here instead of falling back to
 *    SimpleAsyncTaskExecutor (unbounded thread-per-task) once custom
 *    Executor beans exist.
 *
 * Restart durability is handled by the startup sweeper in
 * AssessmentSubmissionProcessorService (re-enqueues mappings stuck in
 * persistenceState='pending' whose Redis payload survived), not by the queue.
 */
@Configuration
public class AsyncExecutorsConfig {

    public static final String SUBMISSION_EXECUTOR = "submissionExecutor";
    public static final String PROCTORING_EXECUTOR = "proctoringExecutor";

    @Bean(SUBMISSION_EXECUTOR)
    public ThreadPoolTaskExecutor submissionExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(16);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(4000);
        executor.setThreadNamePrefix("submission-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    @Bean(PROCTORING_EXECUTOR)
    public ThreadPoolTaskExecutor proctoringExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(2000);
        executor.setThreadNamePrefix("proctoring-");
        // Rejected proctoring jobs are NOT lost: the payload stays in Redis as
        // "pending" and the 5-minute retry scheduler re-enqueues it.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    // Both names, exactly like Boot's auto-configured default: defining ANY
    // Executor bean backs that auto-config off, and unqualified @Async then
    // resolves via the bean NAMED "taskExecutor" — without that alias it
    // would silently fall back to SimpleAsyncTaskExecutor (unbounded
    // thread-per-task).
    @Bean({ "applicationTaskExecutor", "taskExecutor" })
    public ThreadPoolTaskExecutor applicationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(2000);
        executor.setThreadNamePrefix("app-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
