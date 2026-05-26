package com.kccitm.api.controller.career9.report;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.report.ReportSubtype;
import com.kccitm.api.repository.Career9.report.ReportSubtypeRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;

/**
 * One-time bootstrap: reads the seven HTML templates currently shipped on the
 * classpath ({@code bet-template/}, {@code navigator-template/},
 * {@code four-pager-template/}) and uploads them to Spaces under
 * {@code report-templates/{type}/{subtype}/template.html}, populating
 * {@code report_subtype.template_spaces_url} so the new ReportService can
 * resolve and render against the Spaces-hosted copies.
 *
 * <p>Run once after V20260526001-008 migrations apply. Idempotent — running
 * again overwrites the Spaces objects and bumps {@code template_uploaded_at},
 * which is harmless (templates are byte-identical to the classpath copy).
 *
 * <p>After this, all template edits go through
 * {@code PUT /report-subtype/{id}/template} and the classpath template
 * folders become dead code (slated for deletion in cleanup).
 */
@RestController
@RequestMapping("/report-template-bootstrap")
public class ReportTemplateBootstrapController {

    private static final Logger logger = LoggerFactory.getLogger(ReportTemplateBootstrapController.class);
    private static final String SPACES_ROOT = "report-templates";

    private static class Mapping {
        final String typeCode;
        final String subtypeCode;
        final String classpathPath;
        Mapping(String t, String s, String p) { typeCode = t; subtypeCode = s; classpathPath = p; }
    }

    private static final List<Mapping> SEED = Arrays.asList(
            new Mapping("bet",    "default", "bet-template/combined.html"),
            new Mapping("legacy", "insight", "navigator-template/6-8.html"),
            new Mapping("legacy", "subject", "navigator-template/9-10.html"),
            new Mapping("legacy", "career",  "navigator-template/11-12.html"),
            new Mapping("pager",  "insight", "four-pager-template/insight-navigator.html"),
            new Mapping("pager",  "subject", "four-pager-template/subject-navigator.html"),
            new Mapping("pager",  "career",  "four-pager-template/career-navigator.html")
    );

    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private ReportSubtypeRepository   reportSubtypeRepository;

    @PostMapping("/upload-all")
    @PreAuthorize("@auth.allows('report_subtype.upload_template')")
    public ResponseEntity<Map<String, Object>> uploadAll() {
        List<Map<String, String>> uploaded = new ArrayList<>();
        List<Map<String, String>> failed   = new ArrayList<>();

        for (Mapping m : SEED) {
            Optional<ReportSubtype> opt = reportSubtypeRepository
                    .findByReportTypeCodeAndCode(m.typeCode, m.subtypeCode);
            if (!opt.isPresent()) {
                failed.add(row(m, null, "report_subtype not seeded — run V20260526006 first"));
                continue;
            }

            try (InputStream is = getClass().getClassLoader().getResourceAsStream(m.classpathPath)) {
                if (is == null) {
                    failed.add(row(m, null, "classpath miss: " + m.classpathPath));
                    continue;
                }
                byte[] bytes = is.readAllBytes();
                String folder   = SPACES_ROOT + "/" + m.typeCode + "/" + m.subtypeCode;
                String fileName = "template.html";
                String cdnUrl   = spacesService.uploadBytes(bytes, "text/html", folder, fileName);

                ReportSubtype s = opt.get();
                s.setTemplateSpacesUrl(cdnUrl);
                s.setTemplateSpacesKey(folder + "/" + fileName);
                s.setTemplateUploadedAt(new Date());
                reportSubtypeRepository.save(s);

                uploaded.add(row(m, cdnUrl, null));
            } catch (Exception ex) {
                logger.error("Bootstrap upload failed for {}/{}", m.typeCode, m.subtypeCode, ex);
                failed.add(row(m, null, ex.getMessage()));
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("uploadedCount", uploaded.size());
        response.put("uploaded", uploaded);
        response.put("failed", failed);
        return ResponseEntity.ok(response);
    }

    private static Map<String, String> row(Mapping m, String url, String error) {
        Map<String, String> r = new HashMap<>();
        r.put("typeCode", m.typeCode);
        r.put("subtypeCode", m.subtypeCode);
        r.put("classpath", m.classpathPath);
        if (url   != null) r.put("templateSpacesUrl", url);
        if (error != null) r.put("error", error);
        return r;
    }
}
