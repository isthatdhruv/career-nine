package com.kccitm.api.config;

import java.util.concurrent.TimeUnit;

import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.github.benmanes.caffeine.cache.Caffeine;

@Configuration
public class CacheConfig {

    /**
     * Read-heavy caches with 1-day TTL.
     * Used for: assessmentDetails, assessmentQuestions, measuredQualityTypes
     */
    @Bean
    @Primary
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                "assessmentDetails",
                "assessmentQuestions",
                "measuredQualityTypes"
        );
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(1, TimeUnit.DAYS)
                .maximumSize(500)
                .recordStats());
        return manager;
    }
}
