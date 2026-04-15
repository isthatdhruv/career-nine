package com.kccitm.api.config;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class CacheConfig {

    /**
     * RedisCacheManager as the primary cache manager.
     *
     * Replaces CaffeineCacheManager (Phase 9 migration). All existing
     * @Cacheable / @CacheEvict annotations automatically use this bean.
     *
     * Caches managed: assessmentDetails, assessmentQuestions, measuredQualityTypes
     * TTL: 1 day per entry
     * Serialization: JSON (GenericJackson2JsonRedisSerializer) for human-readable Redis values
     * Key prefix: "career9:" to namespace all keys and avoid collisions
     *
     * Graceful degradation is handled by CacheErrorConfig (Phase 8).
     */
    @Bean
    @Primary
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(1))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .prefixCacheNameWith("career9:")
                .disableCachingNullValues();

        RedisCacheConfiguration firebaseConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(1))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .prefixCacheNameWith("career9:")
                .disableCachingNullValues();

        // Raw firebase "users" collection dump — shorter TTL because the admin
        // wizard needs data to feel reasonably fresh. Manual invalidate endpoint
        // exists for the "Refresh" button in the UI.
        RedisCacheConfiguration firebaseRawDocsConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .prefixCacheNameWith("career9:")
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        cacheConfigurations.put("assessmentDetails", defaultConfig);
        cacheConfigurations.put("assessmentQuestions", defaultConfig);
        cacheConfigurations.put("measuredQualityTypes", defaultConfig);
        cacheConfigurations.put("firebaseDocuments", firebaseConfig);
        cacheConfigurations.put("firebaseRawDocs", firebaseRawDocsConfig);

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .transactionAware()
                .build();
    }
}
