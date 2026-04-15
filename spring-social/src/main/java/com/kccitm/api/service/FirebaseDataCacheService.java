package com.kccitm.api.service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Caches the raw "users" collection dump from Firestore so the Firebase
 * data-mapping wizard stops re-scanning the whole collection every time
 * the admin opens/refreshes the page.
 *
 * All callers that previously did firebaseService.getAllDocuments("users")
 * should go through getRawUserDocs() instead.
 *
 * TTL is configured on the "firebaseRawDocs" cache in CacheConfig.
 */
@Service
public class FirebaseDataCacheService {

    @Autowired
    private FirebaseService firebaseService;

    @Cacheable("firebaseRawDocs")
    public List<Map<String, Object>> getRawUserDocs()
            throws ExecutionException, InterruptedException, TimeoutException {
        List<Map<String, Object>> users = firebaseService.getAllDocuments("users");
        if (users.isEmpty()) {
            users = firebaseService.getAllDocuments("Users");
        }
        return users;
    }

    @CacheEvict(value = "firebaseRawDocs", allEntries = true)
    public void invalidate() {
    }
}
