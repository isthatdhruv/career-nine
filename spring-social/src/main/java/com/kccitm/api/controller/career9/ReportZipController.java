package com.kccitm.api.controller.career9;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.reportzip.AutoReportZipService;
import com.kccitm.api.service.reportzip.AutoReportZipService.AutoZipRequest;

@RestController
@RequestMapping("/report-zip")
public class ReportZipController {

    private static final String FOLDER = "report-zips";

    @Autowired
    private DigitalOceanSpacesService spacesService;

    @Autowired
    private AutoReportZipService autoZipService;

    /**
     * Upload a ZIP file to DigitalOcean Spaces.
     * Returns the public CDN URL.
     */
    @PostMapping("/upload")
    @PreAuthorize("@auth.allows('report_zip.create')")
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
            response.put("downloadUrl", spacesService.toEdgeUrl(url));
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
     * Hand the browser a pre-signed PUT URL so it can upload the zip straight
     * to DigitalOcean Spaces, bypassing nginx + Spring multipart limits.
     * Used for bulk report zips that exceed the proxy body-size cap.
     */
    @GetMapping("/presign")
    @PreAuthorize("@auth.allows('report_zip.create')")
    public ResponseEntity<Map<String, String>> presignUpload(
            @RequestParam(value = "fileName", required = false) String fileName) {
        try {
            String safe = (fileName != null && !fileName.isBlank())
                    ? fileName.replaceAll("[^a-zA-Z0-9._\\-]", "_")
                    : "report_" + System.currentTimeMillis() + ".zip";
            if (!safe.endsWith(".zip")) {
                safe += ".zip";
            }
            // Prefix with a timestamp to prevent collisions on repeat uploads.
            String objectName = System.currentTimeMillis() + "_" + safe;

            DigitalOceanSpacesService.PresignedUpload p = spacesService
                    .generatePresignedUpload(FOLDER, objectName, "application/zip", 15);

            Map<String, String> response = new HashMap<>();
            response.put("uploadUrl", p.uploadUrl);
            response.put("publicUrl", p.publicUrl);
            response.put("key", p.key);
            response.put("fileName", safe);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Presign failed: " + e.getMessage()));
        }
    }

    /**
     * Force-apply the bucket CORS policy now (reads app.cors.allowedOrigins).
     * Call this once after the backend is deployed so the browser preflight
     * for the pre-signed PUT can succeed. Returns the origins that were set.
     */
    @PostMapping("/apply-cors")
    @PreAuthorize("@auth.allows('report_zip.update')")
    public ResponseEntity<Map<String, Object>> applyBucketCors() {
        try {
            java.util.List<String> origins = spacesService.applyBucketCorsOrThrow();
            return ResponseEntity.ok(Map.of("status", "applied", "origins", origins));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Read what CORS rules are actually stored on the bucket. Useful to
     * confirm the policy took (returns empty list if the bucket has no CORS).
     */
    @GetMapping("/debug-cors")
    @PreAuthorize("@auth.allows('report_zip.read')")
    public ResponseEntity<?> debugBucketCors() {
        try {
            java.util.List<com.amazonaws.services.s3.model.CORSRule> rules =
                    spacesService.getBucketCorsRules();
            java.util.List<Map<String, Object>> out = new java.util.ArrayList<>();
            for (com.amazonaws.services.s3.model.CORSRule r : rules) {
                Map<String, Object> m = new HashMap<>();
                m.put("allowedOrigins", r.getAllowedOrigins());
                m.put("allowedMethods", r.getAllowedMethods());
                m.put("allowedHeaders", r.getAllowedHeaders());
                m.put("exposedHeaders", r.getExposedHeaders());
                m.put("maxAgeSeconds", r.getMaxAgeSeconds());
                out.add(m);
            }
            return ResponseEntity.ok(Map.of("rules", out));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * CORS-proof PDF fetch for the client-side zip builders: streams one of
     * OUR OWN Spaces objects through the API origin, so the browser can read
     * the bytes even when the bucket CORS policy hasn't been applied to this
     * origin. Restricted to our CDN base URL — this is deliberately NOT a
     * general-purpose proxy (SSRF guard).
     */
    @GetMapping("/fetch-pdf")
    @PreAuthorize("@auth.allows('report_zip.read')")
    public ResponseEntity<?> fetchPdf(@RequestParam String url) {
        if (!spacesService.isOwnSpacesUrl(url)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Only this platform's Spaces URLs can be fetched"));
        }
        byte[] bytes = spacesService.downloadFileByUrl(url);
        if (bytes == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "File not found"));
        }
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    // ═══════════════════════ AUTO ZIP (server-side, whole school) ═══════════════════════

    /**
     * Per class/section counts of what an auto ZIP would hold — ready PDFs,
     * plus students who finished without a PDF or have not finished at all.
     */
    @PostMapping("/auto/preview")
    @PreAuthorize("@auth.allows('report_zip.read', #req.instituteId)")
    public ResponseEntity<?> previewAutoZip(@RequestBody AutoZipRequest req) {
        try {
            return ResponseEntity.ok(autoZipService.preview(req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Start bundling every rendered PDF of a school's students on the chosen
     * assessments, filed by class and section. Returns the job at once; poll
     * {@code GET /auto/{jobId}} for progress and the download URL(s).
     */
    @PostMapping("/auto")
    @PreAuthorize("@auth.allows('report_zip.create', #req.instituteId)")
    public ResponseEntity<?> startAutoZip(@RequestBody AutoZipRequest req,
            @CurrentUser UserPrincipal user) {
        try {
            return ResponseEntity.ok(autoZipService.start(req, user.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        }
    }

    /** The caller's own auto ZIP jobs, newest first — feeds the Downloads list. */
    @GetMapping("/auto")
    @PreAuthorize("@auth.allows('report_zip.read')")
    public ResponseEntity<?> listAutoZips(@RequestParam(value = "instituteId", required = false) Integer instituteId,
            @CurrentUser UserPrincipal user) {
        return ResponseEntity.ok(autoZipService.list(user.getId(), instituteId));
    }

    @GetMapping("/auto/{jobId}")
    @PreAuthorize("@auth.allows('report_zip.read')")
    public ResponseEntity<?> getAutoZip(@PathVariable String jobId, @CurrentUser UserPrincipal user) {
        AutoReportZipService.Job job = autoZipService.get(jobId, user.getId());
        return job == null
                ? ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Job not found"))
                : ResponseEntity.ok(job);
    }

    /** Cancel a running auto ZIP, or delete a finished one's files from Spaces. */
    @DeleteMapping("/auto/{jobId}")
    @PreAuthorize("@auth.allows('report_zip.update')")
    public ResponseEntity<?> deleteAutoZip(@PathVariable String jobId, @CurrentUser UserPrincipal user) {
        return autoZipService.delete(jobId, user.getId())
                ? ResponseEntity.ok(Map.of("status", "deleted"))
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Job not found"));
    }

    /**
     * Delete a ZIP file from DigitalOcean Spaces by URL.
     */
    @DeleteMapping("/delete")
    @PreAuthorize("@auth.allows('report_zip.update')")
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
