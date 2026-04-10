package com.kccitm.api.service;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class FirebaseService {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseService.class);
    private static final long FIRESTORE_TIMEOUT_SECONDS = 30;

    private Firestore getFirestore() {
        if (FirebaseApp.getApps().isEmpty()) {
            throw new IllegalStateException("Firebase has not been initialized");
        }
        return FirestoreClient.getFirestore();
    }

    @Cacheable(value = "firebaseDocuments", key = "#collectionName")
    public List<Map<String, Object>> getAllDocuments(String collectionName) throws ExecutionException, InterruptedException, TimeoutException {
        Firestore db = getFirestore();
        ApiFuture<QuerySnapshot> future = db.collection(collectionName).get();
        List<QueryDocumentSnapshot> documents = future.get(FIRESTORE_TIMEOUT_SECONDS, TimeUnit.SECONDS).getDocuments();

        List<Map<String, Object>> results = new ArrayList<>();
        for (QueryDocumentSnapshot document : documents) {
            Map<String, Object> data = new HashMap<>(document.getData());
            data.put("id", document.getId());
            results.add(data);
        }
        logger.info("Retrieved {} documents from collection: {}", results.size(), collectionName);
        return results;
    }

    public Map<String, Object> getDocument(String collectionName, String documentId) throws ExecutionException, InterruptedException, TimeoutException {
        Firestore db = getFirestore();
        DocumentReference docRef = db.collection(collectionName).document(documentId);
        ApiFuture<DocumentSnapshot> future = docRef.get();
        DocumentSnapshot document = future.get(FIRESTORE_TIMEOUT_SECONDS, TimeUnit.SECONDS);

        if (document.exists()) {
            Map<String, Object> data = new HashMap<>(document.getData());
            data.put("id", document.getId());
            return data;
        }
        return null;
    }

    public List<Map<String, Object>> queryDocuments(String collectionName, String field, String operator, Object value)
            throws ExecutionException, InterruptedException, TimeoutException {
        Firestore db = getFirestore();
        CollectionReference collection = db.collection(collectionName);

        Query query;
        switch (operator) {
            case "==":
                query = collection.whereEqualTo(field, value);
                break;
            case ">":
                query = collection.whereGreaterThan(field, value);
                break;
            case ">=":
                query = collection.whereGreaterThanOrEqualTo(field, value);
                break;
            case "<":
                query = collection.whereLessThan(field, value);
                break;
            case "<=":
                query = collection.whereLessThanOrEqualTo(field, value);
                break;
            case "!=":
                query = collection.whereNotEqualTo(field, value);
                break;
            default:
                throw new IllegalArgumentException("Unsupported operator: " + operator);
        }

        ApiFuture<QuerySnapshot> future = query.get();
        List<QueryDocumentSnapshot> documents = future.get(FIRESTORE_TIMEOUT_SECONDS, TimeUnit.SECONDS).getDocuments();

        List<Map<String, Object>> results = new ArrayList<>();
        for (QueryDocumentSnapshot document : documents) {
            Map<String, Object> data = new HashMap<>(document.getData());
            data.put("id", document.getId());
            results.add(data);
        }
        return results;
    }

    @CacheEvict(value = "firebaseDocuments", key = "#collectionName")
    public String addDocument(String collectionName, Map<String, Object> data) throws ExecutionException, InterruptedException, TimeoutException {
        Firestore db = getFirestore();
        ApiFuture<DocumentReference> future = db.collection(collectionName).add(data);
        DocumentReference docRef = future.get(FIRESTORE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        logger.info("Added document with ID: {} to collection: {}", docRef.getId(), collectionName);
        return docRef.getId();
    }

    @CacheEvict(value = "firebaseDocuments", key = "#collectionName")
    public void updateDocument(String collectionName, String documentId, Map<String, Object> data)
            throws ExecutionException, InterruptedException, TimeoutException {
        Firestore db = getFirestore();
        DocumentReference docRef = db.collection(collectionName).document(documentId);
        ApiFuture<WriteResult> future = docRef.update(data);
        future.get(FIRESTORE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        logger.info("Updated document: {} in collection: {}", documentId, collectionName);
    }

    @CacheEvict(value = "firebaseDocuments", key = "#collectionName")
    public void deleteDocument(String collectionName, String documentId) throws ExecutionException, InterruptedException, TimeoutException {
        Firestore db = getFirestore();
        DocumentReference docRef = db.collection(collectionName).document(documentId);
        ApiFuture<WriteResult> future = docRef.delete();
        future.get(FIRESTORE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        logger.info("Deleted document: {} from collection: {}", documentId, collectionName);
    }
}
