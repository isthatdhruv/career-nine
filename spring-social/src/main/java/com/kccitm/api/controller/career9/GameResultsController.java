package com.kccitm.api.controller.career9;

import com.kccitm.api.service.FirebaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/game-results")
public class GameResultsController {

    private static final String COLLECTION_NAME = "game_results";

    @Autowired
    private FirebaseService firebaseService;

    @GetMapping("/getAll")
    public ResponseEntity<?> getAllGameResults() {
        try {
            List<Map<String, Object>> results = firebaseService.getAllDocuments(COLLECTION_NAME);
            return ResponseEntity.ok(results);
        } catch (ExecutionException | InterruptedException e) {
            return ResponseEntity.internalServerError().body("Error fetching game results: " + e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError().body("Firebase not initialized: " + e.getMessage());
        }
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getGameResultById(@PathVariable String id) {
        try {
            Map<String, Object> result = firebaseService.getDocument(COLLECTION_NAME, id);
            if (result == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(result);
        } catch (ExecutionException | InterruptedException e) {
            return ResponseEntity.internalServerError().body("Error fetching game result: " + e.getMessage());
        }
    }

    @GetMapping("/query")
    public ResponseEntity<?> queryGameResults(
            @RequestParam String field,
            @RequestParam String operator,
            @RequestParam String value) {
        try {
            List<Map<String, Object>> results = firebaseService.queryDocuments(COLLECTION_NAME, field, operator, value);
            return ResponseEntity.ok(results);
        } catch (ExecutionException | InterruptedException e) {
            return ResponseEntity.internalServerError().body("Error querying game results: " + e.getMessage());
        }
    }
}
