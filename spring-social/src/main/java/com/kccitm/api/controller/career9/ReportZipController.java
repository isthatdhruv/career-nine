package com.kccitm.api.controller.career9;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.kccitm.api.service.DigitalOceanSpacesService;

@RestController
@RequestMapping("/report-zip")
public class ReportZipController {

    private static final String FOLDER = "report-zips";

    @Autowired
    private DigitalOceanSpacesService spacesService;

    /**
     * Upload a ZIP file to DigitalOcean Spaces.
     * Returns the public CDN URL.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadZip(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "fileName", required = false) String fileName
    ) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        try {
            String name = (fileName != null && !fileName.isBlank())
                    ? fileName.replaceAll("[^a-zA-Z0-9._\\-]", "_")
                    : file.getOriginalFilename();
            if (name == null || name.isBlank()) {
                name = "report_" + System.currentTimeMillis() + ".zip";
            }
            if (!name.endsWith(".zip")) {
                name += ".zip";
            }

            byte[] bytes = file.getBytes();
            String url = spacesService.uploadBytes(bytes, "application/zip", FOLDER, name);

            Map<String, String> response = new HashMap<>();
            response.put("url", url);
            response.put("fileName", name);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    /**
     * Delete a ZIP file from DigitalOcean Spaces by URL.
     */
    @DeleteMapping("/delete")
    public ResponseEntity<Map<String, String>> deleteZip(@RequestParam String url) {
        try {
            spacesService.deleteFileByUrl(url);
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Delete failed: " + e.getMessage()));
        }
    }
}
