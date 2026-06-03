package com.kccitm.api.controller.career9.report;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.report.QuestionnaireReportTemplate;
import com.kccitm.api.repository.Career9.ReportTemplateRepository;
import com.kccitm.api.repository.Career9.report.QuestionnaireReportTemplateRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.b2c.report.TemplateCache;

/**
 * Engine-backed catalog management for the unified {@link ReportTemplate}
 * table: CRUD on the {@code code} / {@code engineCode} / {@code spacesRenderFolder}
 * fields plus self-contained HTML upload (images embedded as data: URIs), under
 * {@code /report-template} (singular).
 *
 * <p>Coexists with the generic {@code /report-templates} controller (preview /
 * parse-placeholders / generate-pdf) on the same shared entity — this one adds
 * the scoring-engine + questionnaire-mapping side of the feature.
 */
@RestController
public class ReportTemplateCatalogController {

    private static final Logger logger = LoggerFactory.getLogger(ReportTemplateCatalogController.class);
    private static final String TEMPLATE_ROOT_FOLDER = "report-templates";

    @Autowired private ReportTemplateRepository reportTemplateRepository;
    @Autowired private QuestionnaireReportTemplateRepository questionnaireReportTemplateRepository;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private TemplateCache templateCache;

    // ─── CRUD ────────────────────────────────────────────────────────────

    @GetMapping("/report-template")
    @PreAuthorize("@auth.allows('report_template.read')")
    public ResponseEntity<List<ReportTemplateDto>> list() {
        List<ReportTemplateDto> all = reportTemplateRepository.findAll().stream()
                .map(ReportTemplateDto::from).collect(Collectors.toList());
        return ResponseEntity.ok(all);
    }

    @GetMapping("/report-template/{id}")
    @PreAuthorize("@auth.allows('report_template.read')")
    public ResponseEntity<?> get(@PathVariable Long id) {
        return reportTemplateRepository.findById(id)
                .<ResponseEntity<?>>map(t -> ResponseEntity.ok(ReportTemplateDto.from(t)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/report-template")
    @PreAuthorize("@auth.allows('report_template.create')")
    public ResponseEntity<?> create(@RequestBody ReportTemplateCreateRequest req) {
        if (req == null || isBlank(req.getCode()) || isBlank(req.getDisplayName())
                || isBlank(req.getEngineCode()) || isBlank(req.getSpacesRenderFolder())) {
            return ResponseEntity.badRequest()
                    .body("code, displayName, engineCode, spacesRenderFolder are required");
        }
        String code = req.getCode().trim();
        if (!code.matches("[a-z0-9_]+")) {
            return ResponseEntity.badRequest().body("code must be lowercase alphanumerics / underscore only");
        }
        if (reportTemplateRepository.findByCode(code).isPresent()) {
            return ResponseEntity.badRequest().body("code already exists: " + code);
        }
        ReportTemplate t = new ReportTemplate();
        t.setCode(code);
        t.setDisplayName(req.getDisplayName().trim());
        t.setEngineCode(req.getEngineCode().trim());
        t.setSpacesRenderFolder(req.getSpacesRenderFolder().trim());
        t = reportTemplateRepository.save(t);
        return ResponseEntity.ok(ReportTemplateDto.from(t));
    }

    @PutMapping("/report-template/{id}")
    @PreAuthorize("@auth.allows('report_template.update')")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody ReportTemplateUpdateRequest req) {
        Optional<ReportTemplate> opt = reportTemplateRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        ReportTemplate t = opt.get();
        if (!isBlank(req.getDisplayName()))        t.setDisplayName(req.getDisplayName().trim());
        if (!isBlank(req.getEngineCode()))         t.setEngineCode(req.getEngineCode().trim());
        if (!isBlank(req.getSpacesRenderFolder())) t.setSpacesRenderFolder(req.getSpacesRenderFolder().trim());
        t = reportTemplateRepository.save(t);
        return ResponseEntity.ok(ReportTemplateDto.from(t));
    }

    @DeleteMapping("/report-template/{id}")
    @PreAuthorize("@auth.allows('report_template.delete')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!reportTemplateRepository.existsById(id)) return ResponseEntity.notFound().build();
        List<QuestionnaireReportTemplate> mappings = questionnaireReportTemplateRepository.findAll().stream()
                .filter(m -> m.getReportTemplate() != null
                        && id.equals(m.getReportTemplate().getReportTemplateId()))
                .collect(Collectors.toList());
        if (!mappings.isEmpty()) {
            return ResponseEntity.status(409).body(
                    "Cannot delete: template is mapped to " + mappings.size()
                            + " questionnaire(s). Unmap it first.");
        }
        reportTemplateRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ─── Upload / replace template HTML ───────────────────────────────────

    @PutMapping(value = "/report-template/{id}/template", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@auth.allows('report_template.upload_template')")
    public ResponseEntity<?> uploadTemplate(@PathVariable Long id,
                                            @RequestPart("templateHtml") MultipartFile templateHtml) {
        Optional<ReportTemplate> opt = reportTemplateRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        if (templateHtml == null || templateHtml.isEmpty()) {
            return ResponseEntity.badRequest().body("templateHtml part is required and must be non-empty");
        }
        try {
            ReportTemplate t = doUploadTemplate(opt.get(), templateHtml.getBytes());
            return ResponseEntity.ok(ReportTemplateDto.from(t));
        } catch (Exception ex) {
            logger.error("Template upload failed for template {}", id, ex);
            return ResponseEntity.internalServerError().body("Upload failed: " + ex.getMessage());
        }
    }

    private ReportTemplate doUploadTemplate(ReportTemplate t, byte[] bytes) {
        String label    = (t.getCode() != null && !t.getCode().trim().isEmpty())
                ? t.getCode() : ("tpl" + t.getReportTemplateId());
        String folder   = TEMPLATE_ROOT_FOLDER + "/" + label;
        String fileName = "template.html";
        String cdnUrl   = spacesService.uploadBytes(bytes, "text/html", folder, fileName);

        Date previousUploadedAt = t.getTemplateUploadedAt();
        String previousUrl      = t.getTemplateSpacesUrl();

        t.setTemplateSpacesUrl(cdnUrl);
        t.setTemplateSpacesKey(folder + "/" + fileName);
        t.setTemplateUploadedAt(new Date());
        ReportTemplate saved = reportTemplateRepository.save(t);

        if (previousUrl != null) templateCache.invalidate(previousUrl, previousUploadedAt);
        return saved;
    }

    // ─── One-time classpath bootstrap ─────────────────────────────────────

    private static class Seed {
        final String code; final String classpath;
        Seed(String c, String p) { code = c; classpath = p; }
    }

    private static final List<Seed> SEED = Arrays.asList(
            new Seed("bet_default",    "bet-template/combined.html"),
            new Seed("legacy_insight", "navigator-template/6-8.html"),
            new Seed("legacy_subject", "navigator-template/9-10.html"),
            new Seed("legacy_career",  "navigator-template/11-12.html"),
            new Seed("pager_insight",  "four-pager-template/insight-navigator.html"),
            new Seed("pager_subject",  "four-pager-template/subject-navigator.html"),
            new Seed("pager_career",   "four-pager-template/career-navigator.html")
    );

    @PostMapping("/report-template/bootstrap-classpath")
    @PreAuthorize("@auth.allows('report_template.upload_template')")
    public ResponseEntity<Map<String, Object>> bootstrapClasspath() {
        List<Map<String, String>> uploaded = new ArrayList<>();
        List<Map<String, String>> failed   = new ArrayList<>();

        for (Seed s : SEED) {
            Optional<ReportTemplate> opt = reportTemplateRepository.findByCode(s.code);
            if (!opt.isPresent()) {
                failed.add(row(s, "report_template '" + s.code + "' not found — run the data migration first"));
                continue;
            }
            try (InputStream is = getClass().getClassLoader().getResourceAsStream(s.classpath)) {
                if (is == null) {
                    failed.add(row(s, "classpath miss: " + s.classpath));
                    continue;
                }
                doUploadTemplate(opt.get(), is.readAllBytes());
                uploaded.add(row(s, null));
            } catch (Exception ex) {
                logger.error("Bootstrap upload failed for {}", s.code, ex);
                failed.add(row(s, ex.getMessage()));
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("uploadedCount", uploaded.size());
        response.put("uploaded", uploaded);
        response.put("failed", failed);
        return ResponseEntity.ok(response);
    }

    private static Map<String, String> row(Seed s, String error) {
        Map<String, String> r = new HashMap<>();
        r.put("code", s.code);
        r.put("classpath", s.classpath);
        if (error != null) r.put("error", error);
        return r;
    }

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
}
