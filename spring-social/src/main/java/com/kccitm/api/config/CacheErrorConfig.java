package com.kccitm.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurerSupport;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Configuration;

/**
 * Graceful degradation for cache operations.
 *
 * When Redis (or any cache provider) is unavailable, cache errors are logged
 * as warnings and swallowed. The application falls through to the database
 * without crashing. This is critical for Phase 8 — Redis must not be a
 * single point of failure.
 *
 * Note: In Phase 8, the active cache is still Caffeine (spring.cache.type=caffeine).
 * This error handler prepares for Phase 9 when Redis becomes the cache backend.
 * It also protects against any unexpected cache errors from Caffeine itself.
 */
@Configuration
public class CacheErrorConfig extends CachingConfigurerSupport {

    private static final Logger logger = LoggerFactory.getLogger(CacheErrorConfig.class);

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {

            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Cache GET failed [cache={}, key={}]: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                logger.warn("Cache PUT failed [cache={}, key={}]: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Cache EVICT failed [cache={}, key={}]: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                logger.warn("Cache CLEAR failed [cache={}]: {}",
                        cache.getName(), exception.getMessage());
            }
        };
    }
}
