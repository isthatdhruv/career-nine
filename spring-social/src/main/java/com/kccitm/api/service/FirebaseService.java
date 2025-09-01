package com.kccitm.api.service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;

@Service
public class FirebaseService {
    
    @Autowired
    private Firestore firestore;
    
    @Autowired
    private FirebaseAuth firebaseAuth;
    
    /**
     * Add a document to Firestore collection
     * @param collection Collection name
     * @param documentId Document ID (optional, can be null for auto-generated)
     * @param data Document data
     * @return WriteResult
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public WriteResult addDocument(String collection, String documentId, Map<String, Object> data) 
            throws ExecutionException, InterruptedException {
        
        DocumentReference docRef;
        
        if (documentId != null && !documentId.isEmpty()) {
            docRef = firestore.collection(collection).document(documentId);
        } else {
            docRef = firestore.collection(collection).document();
        }
        
        ApiFuture<WriteResult> result = docRef.set(data);
        return result.get();
    }
    
    /**
     * Get a document from Firestore collection
     * @param collection Collection name
     * @param documentId Document ID
     * @return DocumentSnapshot
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public DocumentSnapshot getDocument(String collection, String documentId) 
            throws ExecutionException, InterruptedException {
        
        DocumentReference docRef = firestore.collection(collection).document(documentId);
        ApiFuture<DocumentSnapshot> future = docRef.get();
        return future.get();
    }
    
    /**
     * Get all documents from a collection
     * @param collection Collection name
     * @return List of QueryDocumentSnapshot
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public List<QueryDocumentSnapshot> getAllDocuments(String collection) 
            throws ExecutionException, InterruptedException {
        
        ApiFuture<QuerySnapshot> future = firestore.collection(collection).get();
        QuerySnapshot querySnapshot = future.get();
        return querySnapshot.getDocuments();
    }
    
    /**
     * Update a document in Firestore collection
     * @param collection Collection name
     * @param documentId Document ID
     * @param data Updated data
     * @return WriteResult
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public WriteResult updateDocument(String collection, String documentId, Map<String, Object> data) 
            throws ExecutionException, InterruptedException {
        
        DocumentReference docRef = firestore.collection(collection).document(documentId);
        ApiFuture<WriteResult> result = docRef.update(data);
        return result.get();
    }
    
    /**
     * Delete a document from Firestore collection
     * @param collection Collection name
     * @param documentId Document ID
     * @return WriteResult
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public WriteResult deleteDocument(String collection, String documentId) 
            throws ExecutionException, InterruptedException {
        
        DocumentReference docRef = firestore.collection(collection).document(documentId);
        ApiFuture<WriteResult> result = docRef.delete();
        return result.get();
    }
    
    /**
     * Verify Firebase ID Token
     * @param idToken Firebase ID Token
     * @return FirebaseToken
     * @throws Exception
     */
    public FirebaseToken verifyIdToken(String idToken) throws Exception {
        return firebaseAuth.verifyIdToken(idToken);
    }
    
    /**
     * Query documents with where clause
     * @param collection Collection name
     * @param field Field name
     * @param operator Operator (==, !=, <, <=, >, >=, array-contains, in, not-in, array-contains-any)
     * @param value Value to compare
     * @return List of QueryDocumentSnapshot
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public List<QueryDocumentSnapshot> queryDocuments(String collection, String field, String operator, Object value) 
            throws ExecutionException, InterruptedException {
        
        ApiFuture<QuerySnapshot> future;
        
        switch (operator.toLowerCase()) {
            case "==":
            case "equal":
                future = firestore.collection(collection).whereEqualTo(field, value).get();
                break;
            case "!=":
            case "not-equal":
                future = firestore.collection(collection).whereNotEqualTo(field, value).get();
                break;
            case "<":
            case "less-than":
                future = firestore.collection(collection).whereLessThan(field, value).get();
                break;
            case "<=":
            case "less-than-or-equal":
                future = firestore.collection(collection).whereLessThanOrEqualTo(field, value).get();
                break;
            case ">":
            case "greater-than":
                future = firestore.collection(collection).whereGreaterThan(field, value).get();
                break;
            case ">=":
            case "greater-than-or-equal":
                future = firestore.collection(collection).whereGreaterThanOrEqualTo(field, value).get();
                break;
            case "array-contains":
                future = firestore.collection(collection).whereArrayContains(field, value).get();
                break;
            case "in":
                if (value instanceof List) {
                    future = firestore.collection(collection).whereIn(field, (List<?>) value).get();
                } else {
                    throw new IllegalArgumentException("Value must be a List for 'in' operator");
                }
                break;
            case "not-in":
                if (value instanceof List) {
                    future = firestore.collection(collection).whereNotIn(field, (List<?>) value).get();
                } else {
                    throw new IllegalArgumentException("Value must be a List for 'not-in' operator");
                }
                break;
            case "array-contains-any":
                if (value instanceof List) {
                    future = firestore.collection(collection).whereArrayContainsAny(field, (List<?>) value).get();
                } else {
                    throw new IllegalArgumentException("Value must be a List for 'array-contains-any' operator");
                }
                break;
            default:
                throw new IllegalArgumentException("Unsupported operator: " + operator);
        }
        
        QuerySnapshot querySnapshot = future.get();
        return querySnapshot.getDocuments();
    }
}
