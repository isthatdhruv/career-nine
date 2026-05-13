package com.kccitm.api.security.ratelimit;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Component;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;

/**
 * Phase 20-01: Thread-safe in-process cache of {@link Bucket} instances.
 *
 * <p>Buckets are keyed by {@code "<category>:<identifier>"} (e.g. {@code "IP:1.2.3.4"},
 * {@code "USER:42"}). Created lazily on first request via
 * {@link ConcurrentMap#computeIfAbsent(Object, java.util.function.Function)} —
 * the same identifier always resolves to the same bucket instance for the
 * lifetime of the process.
 *
 * <p>Refill strategy: {@link Refill#intervally(long, Duration)}. Full capacity
 * refills at the end of each window. Chosen over {@code greedy} so the success
 * criterion "11th attempt within 60s returns 429" is deterministic regardless
 * of when in the window requests land.
 *
 * <p>Scale caveat: single-instance only. If the API scales horizontally,
 * each replica has its own map — effective ceiling becomes
 * {@code replicas * configured-ceiling}. Per the Phase 20 locked decision,
 * docker-compose runs one replica. Swap this class for a Redis-backed
 * implementation (Bucket4j ships {@code bucket4j-redis}) if scale changes.
 */
@Component
public class BucketRegistry {

    public enum Category { IP, USER }

    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final RateLimitConfig config;

    public BucketRegistry(RateLimitConfig config) {
        this.config = config;
    }

    /** Returns the bucket for the given category + identifier, creating it if absent. */
    public Bucket bucketFor(Category category, String identifier) {
        String key = category.name() + ":" + identifier;
        return buckets.computeIfAbsent(key, k -> newBucket(category));
    }

    private Bucket newBucket(Category category) {
        int capacity = category == Category.IP ? config.getIpPerMinute() : config.getUserPerMinute();
        Duration window = Duration.ofSeconds(config.getWindowSeconds());
        Bandwidth limit = Bandwidth.classic(capacity, Refill.intervally(capacity, window));
        return Bucket.builder().addLimit(limit).build();
    }

    /** Test/observability hook. */
    public int size() { return buckets.size(); }
}
