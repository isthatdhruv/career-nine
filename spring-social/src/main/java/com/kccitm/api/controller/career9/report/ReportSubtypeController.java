package com.kccitm.api.controller.career9.report;

import java.util.Date;
import java.util.List;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.kccitm.api.model.career9.report.ReportSubtype;
import com.kccitm.api.model.career9.report.ReportType;
import com.kccitm.api.repository.Career9.report.ReportSubtypeRepository;
import com.kccitm.api.repository.Career9.report.ReportTypeRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.b2c.report.TemplateCache;

/**
 * CRUD for {@link ReportType} / {@link ReportSubtype} catalog rows and
 * multipart upload for the HTML template attached to each subtype. Templates
 * are uploaded once to DO Spaces under a deterministic key
 * ({@code report-templates/{type}/{subtype}/template.html}) so re-uploads
 * overwrite in place; ReportService fetches by URL via {@link TemplateCache}.
 *
 * <p>Platform-level operation: no ABAC scope (subtype catalog is shared
 * across all institutes), only RBAC on the specific verbs.
 */
@RestController
public class ReportSubtypeController {

    private static final Logger logger = LoggerFactory.getLogger(ReportSubtypeController.class);
    private static final String TEMPLATE_ROOT_FOLDER = "report-templates";

    @Autowired private ReportTypeRepository    reportTypeRepository;
    @Autowired private ReportSubtypeRepository reportSubtypeRepository;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private TemplateCache templateCache;

    // ─── Report Type CRUD ───────────────────────────────────────────────

    @GetMapping("/report-type")
    @PreAuthorize("@auth.allows('report_type.read')")
    public ResponseEntity<List<ReportTypeDto>> listTypes() {
        List<ReportTypeDto> all = reportTypeRepository.findAll().stream()
                .map(ReportTypeDto::from).collect(Collectors.toList());
        return ResponseEntity.ok(all);
    }

    @GetMapping("/report-type/{id}")
    @PreAuthorize("@auth.allows('report_type.read')")
    public ResponseEntity<?> getType(@PathVariable Long id) {
        return reportTypeRepository.findById(id)
                .<ResponseEntity<?>>map(t -> ResponseEntity.ok(ReportTypeDto.from(t)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/report-type")
    @PreAuthorize("@auth.allows('report_type.create')")
    public ResponseEntity<?> createType(@RequestBody ReportTypeCreateRequest req) {
        if (req == null || req.getCode() == null || req.getCode().trim().isEmpty()
                || req.getDisplayName() == null || req.getDisplayName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("code and displayName are required");
        }
        if (reportTypeRepository.findByCode(req.getCode().trim()).isPresent()) {
            return ResponseEntity.badRequest().body("code already exists: " + req.getCode());
        }
        ReportType t = new ReportType();
        t.setCode(req.getCode().trim());
        t.setDisplayName(req.getDisplayName().trim());
        t = reportTypeRepository.save(t);
        return ResponseEntity.ok(ReportTypeDto.from(t));
    }

    @PutMapping("/report-type/{id}")
    @PreAuthorize("@auth.allows('report_type.update')")
    public ResponseEntity<?> updateType(@PathVariable Long id, @RequestBody ReportTypeUpdateRequest req) {
        Optional<ReportType> opt = reportTypeRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        ReportType t = opt.get();
        if (req.getCode() != null && !req.getCode().trim().isEmpty()) {
            // Code change: ensure no collision with a different row.
            String newCode = req.getCode().trim();
            if (!newCode.equals(t.getCode())) {
                if (reportTypeRepository.findByCode(newCode).isPresent()) {
                    return ResponseEntity.badRequest().body("code already exists: " + newCode);
                }
                t.setCode(newCode);
            }
        }
        if (req.getDisplayName() != null && !req.getDisplayName().trim().isEmpty()) {
            t.setDisplayName(req.getDisplayName().trim());
        }
        t = reportTypeRepository.save(t);
        return ResponseEntity.ok(ReportTypeDto.from(t));
    }

    @DeleteMapping("/report-type/{id}")
    @PreAuthorize("@auth.allows('report_type.delete')")
    public ResponseEntity<?> deleteType(@PathVariable Long id) {
        Optional<ReportType> opt = reportTypeRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        // Block delete if any subtype still references this type — the FK on
        // report_subtype is RESTRICT-style; surface a clean 409 rather than letting
        // MySQL raise a foreign-key violation.
        List<ReportSubtype> children = reportSubtypeRepository.findByReportTypeReportTypeId(id);
        if (!children.isEmpty()) {
            return ResponseEntity.status(409)
                    .body("Cannot delete: " + children.size() + " subtype(s) still reference this type. Delete subtypes first.");
        }
        reportTypeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
    // ─── Report Subtype CRUD ────────────────────────────────────────────

    @GetMapping("/report-subtype")
    @PreAuthorize("@auth.allows('report_subtype.read')")
    public ResponseEntity<List<ReportSubtypeDto>> listSubtypes(
            @RequestParam(value = "typeId", required = false) Long typeId) {
        List<ReportSubtype> rows = typeId == null
                ? reportSubtypeRepository.findAll()
                : reportSubtypeRepository.findByReportTypeReportTypeId(typeId);
        return ResponseEntity.ok(rows.stream().map(ReportSubtypeDto::from).collect(Collectors.toList()));
    }

    @GetMapping("/report-subtype/{id}")
    @PreAuthorize("@auth.allows('report_subtype.read')")
    public ResponseEntity<?> getSubtype(@PathVariable Long id) {
        return reportSubtypeRepository.findById(id)
                .<ResponseEntity<?>>map(s -> ResponseEntity.ok(ReportSubtypeDto.from(s)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── Create (optionally with initial template) ──────────────────────

    @PostMapping(value = "/report-subtype", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@auth.allows('report_subtype.create')")
    public ResponseEntity<?> create(@RequestPart("meta") ReportSubtypeCreateRequest meta,
                                    @RequestPart(value = "templateHtml", required = false) MultipartFile templateHtml) {
        if (meta == null || meta.getTypeCode() == null || meta.getCode() == null
                || meta.getDisplayName() == null || meta.getSpacesRenderFolder() == null) {
            return ResponseEntity.badRequest()
                    .body("typeCode, code, displayName, spacesRenderFolder are required");
        }

        Optional<ReportType> tOpt = reportTypeRepository.findByCode(meta.getTypeCode());
        if (!tOpt.isPresent()) {
            return ResponseEntity.badRequest().body("Unknown typeCode: " + meta.getTypeCode());
        }

        ReportSubtype s = new ReportSubtype();
        s.setReportType(tOpt.get());
        s.setCode(meta.getCode());
        s.setDisplayName(meta.getDisplayName());
        s.setSpacesRenderFolder(meta.getSpacesRenderFolder());
        s = reportSubtypeRepository.save(s);

        if (templateHtml != null && !templateHtml.isEmpty()) {
            try {
                s = doUploadTemplate(s, templateHtml);
            } catch (Exception ex) {
                logger.error("Initial template upload failed for new subtype {}", s.getReportSubtypeId(), ex);
                // Subtype is already saved — caller can re-try upload via PUT .../template.
            }
        }
        return ResponseEntity.ok(ReportSubtypeDto.from(s));
    }

    // ─── Update metadata only ───────────────────────────────────────────

    @PutMapping("/report-subtype/{id}")
    @PreAuthorize("@auth.allows('report_subtype.update')")
    public ResponseEntity<?> updateMeta(@PathVariable Long id,
                                        @RequestBody ReportSubtypeUpdateRequest meta) {
        Optional<ReportSubtype> opt = reportSubtypeRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        ReportSubtype s = opt.get();
        if (meta.getDisplayName()        != null) s.setDisplayName(meta.getDisplayName());
        if (meta.getSpacesRenderFolder() != null) s.setSpacesRenderFolder(meta.getSpacesRenderFolder());
        s = reportSubtypeRepository.save(s);
        return ResponseEntity.ok(ReportSubtypeDto.from(s));
    }

    // ─── Upload / replace template ──────────────────────────────────────

    @PutMapping(value = "/report-subtype/{id}/template", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@auth.allows('report_subtype.upload_template')")
    public ResponseEntity<?> uploadTemplate(@PathVariable Long id,
                                            @RequestPart("templateHtml") MultipartFile templateHtml) {
        Optional<ReportSubtype> opt = reportSubtypeRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        if (templateHtml == null || templateHtml.isEmpty()) {
            return ResponseEntity.badRequest().body("templateHtml part is required and must be non-empty");
        }
        try {
            ReportSubtype s = doUploadTemplate(opt.get(), templateHtml);
            return ResponseEntity.ok(ReportSubtypeDto.from(s));
        } catch (Exception ex) {
            logger.error("Template upload failed for subtype {}", id, ex);
            return ResponseEntity.internalServerError().body("Upload failed: " + ex.getMessage());
        }
    }

    private ReportSubtype doUploadTemplate(ReportSubtype s, MultipartFile templateHtml) throws Exception {
        byte[] bytes = templateHtml.getBytes();
        String typeCode    = s.getReportType().getCode();
        String subtypeCode = s.getCode();
        String folder      = TEMPLATE_ROOT_FOLDER + "/" + typeCode + "/" + subtypeCode;
        String fileName    = "template.html";
        String cdnUrl      = spacesService.uploadBytes(bytes, "text/html", folder, fileName);

        Date previousUploadedAt = s.getTemplateUploadedAt();
        String previousUrl      = s.getTemplateSpacesUrl();

        s.setTemplateSpacesUrl(cdnUrl);
        s.setTemplateSpacesKey(folder + "/" + fileName);
        s.setTemplateUploadedAt(new Date());
        ReportSubtype saved = reportSubtypeRepository.save(s);

        // Evict any cache entry for the prior version of this template so the
        // next render fetches fresh bytes. Keyed by (url, uploadedAt) so the
        // new entry naturally misses without an explicit put.
        if (previousUrl != null) templateCache.invalidate(previousUrl, previousUploadedAt);
        return saved;
    }

    // ─── Delete ─────────────────────────────────────────────────────────

    @DeleteMapping("/report-subtype/{id}")
    @PreAuthorize("@auth.allows('report_subtype.delete')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!reportSubtypeRepository.existsById(id)) return ResponseEntity.notFound().build();
        reportSubtypeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
