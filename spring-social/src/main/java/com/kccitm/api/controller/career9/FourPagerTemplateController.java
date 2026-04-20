package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.DigitalOceanSpacesService;

/**
 * Upload the 4-Pager HTML templates (insight / subject / career navigator)
 * from the classpath resource folder four-pager-template/ to DigitalOcean
 * Spaces under the folder four-pager-template-assets/.
 *
 * Run this once (or whenever the templates change) via:
 *   POST /four-pager-template/upload
 *
 * Returns the public CDN URLs the frontend can fetch.
 */
@RestController
@RequestMapping("/four-pager-template")
public class FourPagerTemplateController {

    private static final String[] TEMPLATE_FILES = {
            "insight-navigator.html",
            "subject-navigator.html",
            "career-navigator.html",
    };

    private static final String CLASSPATH_FOLDER = "four-pager-template";
    private static final String SPACES_FOLDER = "four-pager-template-assets";

    @Autowired
    private DigitalOceanSpacesService spacesService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadTemplates() {
        List<String> uploaded = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        Map<String, String> urls = new HashMap<>();

        for (String fileName : TEMPLATE_FILES) {
            try (var is = getClass().getClassLoader()
                    .getResourceAsStream(CLASSPATH_FOLDER + "/" + fileName)) {
                if (is == null) {
                    failed.add(fileName + " (not found in classpath)");
                    continue;
                }
                byte[] bytes = is.readAllBytes();
                String cdnUrl = spacesService.uploadBytes(bytes, "text/html", SPACES_FOLDER, fileName);
                uploaded.add(fileName);
                urls.put(fileName, cdnUrl);
            } catch (Exception e) {
                failed.add(fileName + " (" + e.getMessage() + ")");
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("uploaded", uploaded.size());
        response.put("uploadedFiles", uploaded);
        response.put("failed", failed);
        response.put("urls", urls);
        return ResponseEntity.ok(response);
    }
}
