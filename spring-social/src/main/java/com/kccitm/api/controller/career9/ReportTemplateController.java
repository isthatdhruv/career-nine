package com.kccitm.api.controller.career9;

import java.io.ByteArrayOutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.ReportTemplateRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

@RestController
@RequestMapping("/report-templates")
public class ReportTemplateController {

    @Autowired
    private ReportTemplateRepository reportTemplateRepository;

    @Autowired
    private DigitalOceanSpacesService spacesService;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{([^}]+)\\}\\}");
    private static final DateTimeFormatter TIMESTAMP_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // ==================== CRUD ====================

    @PostMapping("/upload")
    public ResponseEntity<?> uploadTemplate(
            @RequestParam("file") MultipartFile file,
            @RequestParam("templateName") String templateName,
            @RequestParam("assessmentId") Long assessmentId) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }

            String fileName = UUID.randomUUID().toString() + ".html";
            String url = spacesService.uploadBytes(
                    file.getBytes(), "text/html", "report-templates", fileName);

            ReportTemplate template = new ReportTemplate();
            template.setTemplateName(templateName);
            template.setAssessmentId(assessmentId);
            template.setTemplateUrl(url);
            template.setCreatedAt(LocalDateTime.now().format(TIMESTAMP_FMT));
            template.setUpdatedAt(LocalDateTime.now().format(TIMESTAMP_FMT));

            ReportTemplate saved = reportTemplateRepository.save(template);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    @GetMapping("/getAll")
    public ResponseEntity<List<ReportTemplate>> getAll() {
        return ResponseEntity.ok(reportTemplateRepository.findAll());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<ReportTemplate> opt = reportTemplateRepository.findById(id);
        return opt.map(t -> ResponseEntity.ok((Object) t))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-assessment/{assessmentId}")
    public ResponseEntity<List<ReportTemplate>> getByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(reportTemplateRepository.findByAssessmentId(assessmentId));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody ReportTemplate body) {
        Optional<ReportTemplate> opt = reportTemplateRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ReportTemplate existing = opt.get();
        if (body.getTemplateName() != null) existing.setTemplateName(body.getTemplateName());
        if (body.getFieldMappings() != null) existing.setFieldMappings(body.getFieldMappings());
        existing.setUpdatedAt(LocalDateTime.now().format(TIMESTAMP_FMT));

        return ResponseEntity.ok(reportTemplateRepository.save(existing));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Optional<ReportTemplate> opt = reportTemplateRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ReportTemplate template = opt.get();
        try {
            spacesService.deleteFileByUrl(template.getTemplateUrl());
        } catch (Exception e) {
            // Log but don't fail if space deletion fails
        }
        reportTemplateRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    // ==================== PLACEHOLDER DETECTION ====================

    @GetMapping("/parse-placeholders/{id}")
    public ResponseEntity<?> parsePlaceholders(@PathVariable Long id) {
        try {
            Optional<ReportTemplate> opt = reportTemplateRepository.findById(id);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();

            String html = fetchTemplateHtml(opt.get().getTemplateUrl());
            Set<String> placeholders = extractPlaceholders(html);

            Map<String, Object> response = new HashMap<>();
            response.put("placeholders", placeholders);
            response.put("availableFields", getAvailableDataFields());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to parse: " + e.getMessage()));
        }
    }

    @GetMapping("/available-fields")
    public ResponseEntity<?> getAvailableFieldsEndpoint() {
        List<Map<String, String>> fields = new ArrayList<>();

        // Static student fields
        fields.add(field("student.name", "Student Name"));
        fields.add(field("student.rollNumber", "Roll Number"));
        fields.add(field("student.dob", "Date of Birth"));
        fields.add(field("student.email", "Email"));
        fields.add(field("student.phone", "Phone Number"));
        fields.add(field("student.class", "Class/Grade"));
        fields.add(field("student.institute", "Institute Name"));
        fields.add(field("student.userStudentId", "User Student ID"));
        fields.add(field("assessment.status", "Assessment Status"));

        // Dynamic score fields from all MQTs
        List<MeasuredQualityTypes> mqts = measuredQualityTypesRepository.findAll();
        for (MeasuredQualityTypes mqt : mqts) {
            String name = mqt.getMeasuredQualityTypeName();
            String display = mqt.getMeasuredQualityTypeDisplayName();
            if (display == null) display = name;
            fields.add(field("score." + name, "Score: " + display));
        }

        return ResponseEntity.ok(fields);
    }

    // ==================== PREVIEW & GENERATE ====================

    @PostMapping("/preview")
    public ResponseEntity<?> previewReport(@RequestBody Map<String, Object> request) {
        try {
            Long templateId = ((Number) request.get("templateId")).longValue();
            Long userStudentId = ((Number) request.get("userStudentId")).longValue();
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();

            Optional<ReportTemplate> opt = reportTemplateRepository.findById(templateId);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();

            ReportTemplate template = opt.get();
            String html = fetchTemplateHtml(template.getTemplateUrl());
            Map<String, String> mappings = parseMappings(template.getFieldMappings());
            Map<String, String> studentData = buildStudentDataMap(userStudentId, assessmentId);

            String filledHtml = fillTemplate(html, mappings, studentData);

            return ResponseEntity.ok(Map.of("html", filledHtml));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Preview failed: " + e.getMessage()));
        }
    }

    @PostMapping("/generate-pdf")
    public ResponseEntity<?> generatePdf(@RequestBody Map<String, Object> request) {
        try {
            Long templateId = ((Number) request.get("templateId")).longValue();
            Long userStudentId = ((Number) request.get("userStudentId")).longValue();
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();

            Optional<ReportTemplate> opt = reportTemplateRepository.findById(templateId);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();

            ReportTemplate template = opt.get();
            String html = fetchTemplateHtml(template.getTemplateUrl());
            Map<String, String> mappings = parseMappings(template.getFieldMappings());
            Map<String, String> studentData = buildStudentDataMap(userStudentId, assessmentId);

            String filledHtml = fillTemplate(html, mappings, studentData);
            byte[] pdfBytes = htmlToPdf(filledHtml);

            String studentName = studentData.getOrDefault("student.name", "report");
            String fileName = studentName.replaceAll("\\s+", "_") + "_report.pdf";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", fileName);
            headers.setContentLength(pdfBytes.length);

            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "PDF generation failed: " + e.getMessage()));
        }
    }

    @PostMapping("/generate-pdf-bulk")
    public ResponseEntity<?> generatePdfBulk(@RequestBody Map<String, Object> request) {
        try {
            Long templateId = ((Number) request.get("templateId")).longValue();
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> studentIds = (List<Number>) request.get("userStudentIds");

            Optional<ReportTemplate> opt = reportTemplateRepository.findById(templateId);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();

            ReportTemplate template = opt.get();
            String html = fetchTemplateHtml(template.getTemplateUrl());
            Map<String, String> mappings = parseMappings(template.getFieldMappings());

            // Build combined HTML with page breaks for merged PDF
            StringBuilder combinedHtml = new StringBuilder();
            combinedHtml.append("<html><head><style>")
                    .append(".page-break { page-break-after: always; }")
                    .append("</style>");

            // Extract <head> content from template for styles
            int headStart = html.indexOf("<head>");
            int headEnd = html.indexOf("</head>");
            if (headStart >= 0 && headEnd >= 0) {
                String headContent = html.substring(headStart + 6, headEnd);
                // Remove any existing <style> tags and re-add them
                combinedHtml.append(headContent);
            }
            combinedHtml.append("</head><body>");

            for (int i = 0; i < studentIds.size(); i++) {
                Long studentId = studentIds.get(i).longValue();
                Map<String, String> studentData = buildStudentDataMap(studentId, assessmentId);
                String filledHtml = fillTemplate(html, mappings, studentData);

                // Extract just the body content
                String bodyContent = extractBodyContent(filledHtml);
                combinedHtml.append("<div");
                if (i < studentIds.size() - 1) {
                    combinedHtml.append(" class=\"page-break\"");
                }
                combinedHtml.append(">").append(bodyContent).append("</div>");
            }

            combinedHtml.append("</body></html>");

            byte[] pdfBytes = htmlToPdf(combinedHtml.toString());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "bulk_reports.pdf");
            headers.setContentLength(pdfBytes.length);

            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Bulk PDF generation failed: " + e.getMessage()));
        }
    }

    // ==================== HELPERS ====================

    private String fetchTemplateHtml(String url) throws Exception {
        try (java.io.InputStream in = new URL(url).openStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private Set<String> extractPlaceholders(String html) {
        Set<String> placeholders = new LinkedHashSet<>();
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(html);
        while (matcher.find()) {
            placeholders.add(matcher.group(1).trim());
        }
        return placeholders;
    }

    private Map<String, String> parseMappings(String fieldMappingsJson) {
        if (fieldMappingsJson == null || fieldMappingsJson.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(fieldMappingsJson, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private Map<String, String> buildStudentDataMap(Long userStudentId, Long assessmentId) {
        Map<String, String> data = new HashMap<>();

        // Student info
        Optional<UserStudent> userStudentOpt = userStudentRepository.findById(userStudentId);
        if (userStudentOpt.isPresent()) {
            UserStudent us = userStudentOpt.get();
            StudentInfo si = us.getStudentInfo();
            if (si != null) {
                data.put("student.name", safe(si.getName()));
                data.put("student.rollNumber", safe(si.getSchoolRollNumber()));
                data.put("student.dob", si.getStudentDob() != null ? si.getStudentDob().toString() : "");
                data.put("student.email", safe(si.getEmail()));
                data.put("student.phone", safe(si.getPhoneNumber()));
                data.put("student.class", si.getStudentClass() != null ? si.getStudentClass().toString() : "");
            }
            if (us.getInstitute() != null) {
                data.put("student.institute", safe(us.getInstitute().getInstituteName()));
            }
            data.put("student.userStudentId", userStudentId.toString());
        }

        // Assessment scores
        Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        if (mappingOpt.isPresent()) {
            StudentAssessmentMapping mapping = mappingOpt.get();
            data.put("assessment.status", safe(mapping.getStatus()));

            List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                    .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

            for (AssessmentRawScore score : rawScores) {
                if (score.getMeasuredQualityType() != null) {
                    String mqtName = score.getMeasuredQualityType().getMeasuredQualityTypeName();
                    String displayName = score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName();
                    if (displayName == null) displayName = mqtName;

                    // score.MQTName (e.g., score.Linguistic, score.Logical)
                    data.put("score." + mqtName, String.valueOf(score.getRawScore()));
                    data.put("score." + displayName, String.valueOf(score.getRawScore()));
                }
                if (score.getMeasuredQuality() != null) {
                    String mqName = score.getMeasuredQuality().getMeasuredQualityName();
                    data.put("quality." + mqName, String.valueOf(score.getRawScore()));
                }
            }
        }

        return data;
    }

    private String fillTemplate(String html, Map<String, String> mappings, Map<String, String> studentData) {
        String result = html;
        for (Map.Entry<String, String> entry : mappings.entrySet()) {
            String placeholder = entry.getKey();   // e.g., "studentName"
            String dataField = entry.getValue();    // e.g., "student.name"
            String value = studentData.getOrDefault(dataField, "");
            result = result.replace("{{" + placeholder + "}}", value);
        }
        // Also replace any unmapped placeholders that directly match data keys
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(result);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1).trim();
            String value = studentData.getOrDefault(key, "{{" + key + "}}");
            matcher.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private String extractBodyContent(String html) {
        int bodyStart = html.indexOf("<body");
        if (bodyStart >= 0) {
            int bodyTagEnd = html.indexOf(">", bodyStart);
            int bodyClose = html.indexOf("</body>", bodyTagEnd);
            if (bodyTagEnd >= 0 && bodyClose >= 0) {
                return html.substring(bodyTagEnd + 1, bodyClose);
            }
        }
        return html;
    }

    private byte[] htmlToPdf(String html) throws Exception {
        ByteArrayOutputStream os = new ByteArrayOutputStream();
        PdfRendererBuilder builder = new PdfRendererBuilder();
        builder.withHtmlContent(html, null);
        builder.toStream(os);
        builder.run();
        return os.toByteArray();
    }

    private String safe(String value) {
        return value != null ? value : "";
    }

    private List<Map<String, String>> getAvailableDataFields() {
        List<Map<String, String>> fields = new ArrayList<>();

        // Student fields
        fields.add(field("student.name", "Student Name"));
        fields.add(field("student.rollNumber", "Roll Number"));
        fields.add(field("student.dob", "Date of Birth"));
        fields.add(field("student.email", "Email"));
        fields.add(field("student.phone", "Phone Number"));
        fields.add(field("student.class", "Class/Grade"));
        fields.add(field("student.institute", "Institute Name"));
        fields.add(field("student.userStudentId", "User Student ID"));

        // Assessment fields
        fields.add(field("assessment.status", "Assessment Status"));

        // Score fields - dynamic, loaded from MQTs
        fields.add(field("score.*", "Score by MQT Name (e.g., score.Linguistic)"));
        fields.add(field("quality.*", "Score by Quality Name (e.g., quality.Intelligence)"));

        return fields;
    }

    private Map<String, String> field(String key, String label) {
        Map<String, String> f = new HashMap<>();
        f.put("key", key);
        f.put("label", label);
        return f;
    }
}
