package com.kccitm.api.service.b2c.report;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.kccitm.api.service.DigitalOceanSpacesService;

/**
 * In-memory cache for HTML templates fetched from DigitalOcean Spaces.
 * Keyed by {@code (url, uploadedAt)} so a re-upload (which bumps
 * {@code template_uploaded_at}) auto-invalidates the entry without needing
 * explicit eviction. 10-minute TTL caps drift across replicas (plan Risk #12).
 */
@Component
public class TemplateCache {

    private static final Logger logger = LoggerFactory.getLogger(TemplateCache.class);

    @Autowired private DigitalOceanSpacesService spacesService;

    private Cache<String, String> cache;

    @PostConstruct
    public void init() {
        this.cache = Caffeine.newBuilder()
                .maximumSize(64)
                .expireAfterWrite(10, TimeUnit.MINUTES)
                .build();
    }

    public String get(String spacesUrl, Date uploadedAt) {
        if (spacesUrl == null || spacesUrl.isEmpty()) return null;
        String key = spacesUrl + "|" + (uploadedAt != null ? uploadedAt.getTime() : "null");
        String hit = cache.getIfPresent(key);
        if (hit != null) return hit;

        byte[] bytes = spacesService.downloadFileByUrl(spacesUrl);
        if (bytes == null) {
            logger.warn("TemplateCache: download miss for {}", spacesUrl);
            return null;
        }
        String html = new String(bytes, StandardCharsets.UTF_8);
        cache.put(key, html);
        return html;
    }

    /** Force-evict a specific entry — call after a successful template upload. */
    public void invalidate(String spacesUrl, Date uploadedAt) {
        if (spacesUrl == null) return;
        String key = spacesUrl + "|" + (uploadedAt != null ? uploadedAt.getTime() : "null");
        cache.invalidate(key);
    }
}
