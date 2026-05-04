package com.kccitm.api.controller.career9.counselling;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.DigitalOceanSpacesService;

@RestController
@RequestMapping("/counsellor-media")
public class CounsellorMediaController {

    @Autowired
    private DigitalOceanSpacesService spacesService;

    /**
     * Upload counsellor profile media (image) to DigitalOcean Spaces.
     * Expects JSON body: { "base64Data": "data:image/webp;base64,...", "mediaType": "profile" }
     * Returns: { "url": "https://storage-c9.sgp1.digitaloceanspaces.com/counsellor-media/..." }
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadMedia(@RequestBody Map<String, String> request) {
        String base64Data = request.get("base64Data");
        String mediaType = request.getOrDefault("mediaType", "profile");

        if (base64Data == null || base64Data.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "base64Data is required"));
        }

        try {
            String folder = "counsellor-media/" + mediaType + "s";
            String url = spacesService.uploadBase64File(base64Data, folder, null);

            Map<String, String> response = new HashMap<>();
            response.put("url", url);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Delete counsellor media from DigitalOcean Spaces.
     * Expects query param: ?url=https://storage-c9.sgp1.digitaloceanspaces.com/...
     */
    @DeleteMapping("/delete")
    public ResponseEntity<Map<String, String>> deleteMedia(@RequestParam String url) {
        spacesService.deleteFileByUrl(url);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }
}
