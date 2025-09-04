package com.kccitm.api.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.firebase.auth.FirebaseToken;
import com.kccitm.api.service.FirebaseService;

@RestController
@RequestMapping("/api/firebase")
public class FirebaseController {
    
    @Autowired
    private FirebaseService firebaseService;
    
    /**
     * Add a new document to Firestore
     * @param collection Collection name
     * @param data Document data
     * @return ResponseEntity
     */
    @PostMapping("/collections/{collection}")
    public ResponseEntity<Map<String, Object>> addDocument(
            @PathVariable String collection,
            @RequestParam(required = false) String documentId,
            @RequestBody Map<String, Object> data) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            firebaseService.addDocument(collection, documentId, data);
            response.put("success", true);
            response.put("message", "Document added successfully");
            response.put("collection", collection);
            if (documentId != null) {
                response.put("documentId", documentId);
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get a specific document from Firestore
     * @param collection Collection name
     * @param documentId Document ID
     * @return ResponseEntity
     */
    @GetMapping("/collections/{collection}/documents/{documentId}")
    public ResponseEntity<Map<String, Object>> getDocument(
            @PathVariable String collection,
            @PathVariable String documentId) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            DocumentSnapshot document = firebaseService.getDocument(collection, documentId);
            
            if (document.exists()) {
                response.put("success", true);
                response.put("data", document.getData());
                response.put("id", document.getId());
                return ResponseEntity.ok(response);
            } else {
                response.put("success", false);
                response.put("error", "Document not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get all documents from a collection
     * @param collection Collection name
     * @return ResponseEntity
     */
    @GetMapping("/collections/{collection}")
    public ResponseEntity<Map<String, Object>> getAllDocuments(@PathVariable String collection) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<QueryDocumentSnapshot> documents = firebaseService.getAllDocuments(collection);
            
            Map<String, Map<String, Object>> documentsMap = new HashMap<>();
            for (QueryDocumentSnapshot doc : documents) {
                documentsMap.put(doc.getId(), doc.getData());
            }
            
            response.put("success", true);
            response.put("documents", documentsMap);
            response.put("count", documents.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Update a document in Firestore
     * @param collection Collection name
     * @param documentId Document ID
     * @param data Updated data
     * @return ResponseEntity
     */
    @PutMapping("/collections/{collection}/documents/{documentId}")
    public ResponseEntity<Map<String, Object>> updateDocument(
            @PathVariable String collection,
            @PathVariable String documentId,
            @RequestBody Map<String, Object> data) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            firebaseService.updateDocument(collection, documentId, data);
            response.put("success", true);
            response.put("message", "Document updated successfully");
            response.put("collection", collection);
            response.put("documentId", documentId);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Delete a document from Firestore
     * @param collection Collection name
     * @param documentId Document ID
     * @return ResponseEntity
     */
    @DeleteMapping("/collections/{collection}/documents/{documentId}")
    public ResponseEntity<Map<String, Object>> deleteDocument(
            @PathVariable String collection,
            @PathVariable String documentId) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            firebaseService.deleteDocument(collection, documentId);
            response.put("success", true);
            response.put("message", "Document deleted successfully");
            response.put("collection", collection);
            response.put("documentId", documentId);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Query documents with where clause
     * @param collection Collection name
     * @param field Field name
     * @param operator Operator
     * @param value Value to compare
     * @return ResponseEntity
     */
    @GetMapping("/collections/{collection}/query")
    public ResponseEntity<Map<String, Object>> queryDocuments(
            @PathVariable String collection,
            @RequestParam String field,
            @RequestParam String operator,
            @RequestParam String value) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<QueryDocumentSnapshot> documents = firebaseService.queryDocuments(collection, field, operator, value);
            
            Map<String, Map<String, Object>> documentsMap = new HashMap<>();
            for (QueryDocumentSnapshot doc : documents) {
                documentsMap.put(doc.getId(), doc.getData());
            }
            
            response.put("success", true);
            response.put("documents", documentsMap);
            response.put("count", documents.size());
            response.put("query", Map.of("field", field, "operator", operator, "value", value));
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Verify Firebase ID Token
     * @param request Request body containing idToken
     * @return ResponseEntity
     */
    @PostMapping("/auth/verify")
    public ResponseEntity<Map<String, Object>> verifyToken(@RequestBody Map<String, String> request) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            String idToken = request.get("idToken");
            if (idToken == null || idToken.isEmpty()) {
                response.put("success", false);
                response.put("error", "idToken is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            FirebaseToken decodedToken = firebaseService.verifyIdToken(idToken);
            
            response.put("success", true);
            response.put("uid", decodedToken.getUid());
            response.put("email", decodedToken.getEmail());
            response.put("name", decodedToken.getName());
            response.put("picture", decodedToken.getPicture());
            response.put("emailVerified", decodedToken.isEmailVerified());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", "Invalid token: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
    }
}
