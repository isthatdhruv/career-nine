package com.kccitm.api.service.reportzip;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import com.kccitm.api.config.AsyncExecutorsConfig;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository.SchoolAllotmentRow;
import com.kccitm.api.repository.Career9.GeneratedReportRepository.SchoolPdfRow;
import com.kccitm.api.repository.Career9.GeneratedReportRepository.SchoolStudentRow;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.DigitalOceanSpacesService.MultipartUploadStream;

/**
 * Whole-school report ZIPs for the Reports Hub's "Auto ZIP".
 *
 * <p>The browser only names a school and some assessments. This service finds
 * every rendered PDF of that school's students on those assessments, files
 * them as {@code Class/Section/[Assessment/]Student.pdf}, and streams them
 * from Spaces straight into a ZIP that is itself multipart-uploaded back to
 * Spaces — so neither the browser nor the API heap ever holds the archive.
 * Optionally one ZIP per class or per section instead of one per school.
 *
 * <p>Each ZIP carries a {@code _summary.csv}: who is in it, who is allotted
 * but has no rendered report yet, and any PDF that could not be fetched.
 *
 * <p>Jobs live in memory (an API restart forgets the list, though finished
 * ZIPs stay on Spaces) and are visible only to the user who started them.
 */
@Service
public class AutoReportZipService {

    private static final Logger log = LoggerFactory.getLogger(AutoReportZipService.class);

    private static final String FOLDER = "report-zips/auto";
    /** PDFs downloading ahead of the one being written. */
    private static final int FETCH_WINDOW = 6;
    /** Finished jobs drop off the Downloads list after this long. */
    private static final long JOB_TTL_MS = 7L * 24 * 60 * 60 * 1000;

    public static final String SPLIT_SCHOOL = "school";
    public static final String SPLIT_CLASS = "class";
    public static final String SPLIT_SECTION = "section";

    @Autowired
    private GeneratedReportRepository generatedReportRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private DigitalOceanSpacesService spacesService;

    @Autowired
    @Qualifier(AsyncExecutorsConfig.REPORT_ZIP_EXECUTOR)
    private ThreadPoolTaskExecutor jobExecutor;

    @Autowired
    @Qualifier(AsyncExecutorsConfig.REPORT_ZIP_FETCH_EXECUTOR)
    private ThreadPoolTaskExecutor fetchExecutor;

    private final Map<String, Job> jobs = new ConcurrentHashMap<>();

    // ═══════════════════════ API ═══════════════════════

    public static class AutoZipRequest {
        public Integer instituteId;
        public List<Long> assessmentIds;
        /** school | class | section */
        public String splitBy;
        /** Base file name; parts get a class/section suffix. */
        public String zipName;

        public Integer getInstituteId() { return instituteId; }
    }

    /**
     * What a ZIP of this request would hold, per class and section, without
     * fetching anything. Must run on the request thread (scope filter).
     */
    public Map<String, Object> preview(AutoZipRequest req) {
        Plan plan = buildPlan(req);
        Map<String, Map<String, Object>> rows = new TreeMap<>(GROUP_ORDER);
        for (Entry e : plan.entries) {
            bucket(rows, e.classLabel, e.sectionLabel).merge("ready", 1, (a, b) -> (Integer) a + (Integer) b);
        }
        for (Missing m : plan.missing) {
            bucket(rows, m.classLabel, m.sectionLabel)
                    .merge(m.completed ? "completedNoPdf" : "notCompleted", 1, (a, b) -> (Integer) a + (Integer) b);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ready", plan.entries.size());
        out.put("completedNoPdf", plan.missing.stream().filter(m -> m.completed).count());
        out.put("notCompleted", plan.missing.stream().filter(m -> !m.completed).count());
        out.put("zipCount", plan.groups().size());
        out.put("groups", new ArrayList<>(rows.values()));
        return out;
    }

    /** Plan on the request thread, bundle on the zip pool. */
    public Job start(AutoZipRequest req, Long ownerUserId) {
        evictExpired();
        Plan plan = buildPlan(req);
        if (plan.entries.isEmpty()) {
            throw new IllegalArgumentException("No rendered PDFs for this school and these assessments yet.");
        }
        Job job = new Job();
        job.id = UUID.randomUUID().toString();
        job.ownerUserId = ownerUserId;
        job.instituteId = req.instituteId;
        job.assessmentIds = new ArrayList<>(req.assessmentIds);
        job.splitBy = plan.splitBy;
        job.name = plan.baseName + ".zip";
        job.total = plan.entries.size();
        job.missing = plan.missing.size();
        job.status = "queued";
        job.phase = "Waiting for a free worker...";
        job.createdAt = System.currentTimeMillis();
        jobs.put(job.id, job);
        try {
            jobExecutor.execute(() -> run(job, plan));
        } catch (RejectedExecutionException e) {
            jobs.remove(job.id);
            throw new IllegalStateException("Too many ZIPs are being built right now — try again in a few minutes.");
        }
        return job;
    }

    public List<Job> list(Long ownerUserId, Integer instituteId) {
        evictExpired();
        return jobs.values().stream()
                .filter(j -> j.ownerUserId.equals(ownerUserId))
                .filter(j -> instituteId == null || instituteId.equals(j.instituteId))
                .sorted(Comparator.comparingLong((Job j) -> j.createdAt).reversed())
                .collect(Collectors.toList());
    }

    public Job get(String jobId, Long ownerUserId) {
        Job job = jobs.get(jobId);
        return job != null && job.ownerUserId.equals(ownerUserId) ? job : null;
    }

    /**
     * Cancel a running job (its upload is aborted by the worker) or delete a
     * finished one's ZIPs from Spaces. Either way it leaves the list.
     */
    public boolean delete(String jobId, Long ownerUserId) {
        Job job = get(jobId, ownerUserId);
        if (job == null) return false;
        job.cancelled = true;
        jobs.remove(jobId);
        for (Part p : job.parts) {
            try {
                spacesService.deleteFileByUrl(p.url);
            } catch (Exception e) {
                log.warn("Auto ZIP {}: failed to delete {}: {}", jobId, p.url, e.getMessage());
            }
        }
        return true;
    }

    // ═══════════════════════ PLAN ═══════════════════════

    private Plan buildPlan(AutoZipRequest req) {
        if (req == null || req.instituteId == null) {
            throw new IllegalArgumentException("Pick a school.");
        }
        List<Long> assessmentIds = req.assessmentIds == null ? Collections.emptyList()
                : req.assessmentIds.stream().filter(id -> id != null).distinct().collect(Collectors.toList());
        if (assessmentIds.isEmpty()) {
            throw new IllegalArgumentException("Pick at least one assessment.");
        }

        // Native queries skip the Hibernate scope filter, so narrow them to the
        // students this caller can see through the filtered JPQL query.
        Set<Integer> visible = new HashSet<>(studentInfoRepository.findIdsByInstituteIdScoped(req.instituteId));

        Map<Long, String> assessmentNames = new HashMap<>();
        for (AssessmentTable a : assessmentTableRepository.findAllById(assessmentIds)) {
            assessmentNames.put(a.getId(), a.getAssessmentName());
        }

        Plan plan = new Plan();
        plan.splitBy = SPLIT_CLASS.equals(req.splitBy) || SPLIT_SECTION.equals(req.splitBy) ? req.splitBy : SPLIT_SCHOOL;
        String base = req.zipName == null ? "" : req.zipName.trim().replaceAll("(?i)\\.zip$", "");
        base = base.replaceAll("[^a-zA-Z0-9._\\-]+", "_").replaceAll("_+", "_");
        plan.baseName = base.isEmpty() ? "school_reports_" + new SimpleDateFormat("yyyy-MM-dd").format(new Date()) : base;
        boolean multiAssessment = assessmentIds.size() > 1;

        Set<String> ready = new HashSet<>();
        for (SchoolPdfRow r : generatedReportRepository.findReadyPdfsForInstitute(req.instituteId, assessmentIds)) {
            if (!visible.contains(r.getStudentInfoId())) continue;
            Entry e = new Entry();
            fill(e, r, assessmentNames);
            e.pdfUrl = r.getPdfUrl();
            e.templateName = r.getTemplateName();
            e.assessmentFolder = multiAssessment ? segment(e.assessmentName) : null;
            plan.entries.add(e);
            ready.add(r.getAssessmentId() + ":" + r.getUserStudentId());
        }
        for (SchoolAllotmentRow r : generatedReportRepository.findAllotmentsForInstitute(req.instituteId, assessmentIds)) {
            if (!visible.contains(r.getStudentInfoId())) continue;
            if (!ready.add(r.getAssessmentId() + ":" + r.getUserStudentId())) continue;
            Missing m = new Missing();
            fill(m, r, assessmentNames);
            m.completed = "completed".equalsIgnoreCase(r.getAssessmentStatus());
            plan.missing.add(m);
        }

        plan.entries.sort(Comparator.comparing((Entry e) -> e.classLabel, CLASS_ORDER)
                .thenComparing(e -> e.sectionLabel, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(e -> e.assessmentName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(e -> e.studentName, String.CASE_INSENSITIVE_ORDER));
        assignFileNames(plan.entries);
        return plan;
    }

    private static void fill(Student s, SchoolStudentRow r, Map<Long, String> assessmentNames) {
        s.assessmentName = assessmentNames.getOrDefault(r.getAssessmentId(), "Assessment " + r.getAssessmentId());
        s.userStudentId = r.getUserStudentId();
        s.studentName = r.getStudentName() == null || r.getStudentName().isBlank()
                ? "Student " + r.getUserStudentId() : r.getStudentName().trim();
        s.rollNumber = r.getRollNumber() == null ? "" : r.getRollNumber().trim();
        s.classLabel = classLabel(r.getClassName(), r.getStudentClass());
        s.sectionLabel = sectionLabel(r.getSectionName());
    }

    /**
     * "Class/Section/[Assessment/]Name.pdf". A student with reports from two
     * templates gets the template in the name; two namesakes in one section
     * are told apart by roll number (or id).
     */
    private static void assignFileNames(List<Entry> entries) {
        Map<String, Integer> perStudent = new HashMap<>();
        for (Entry e : entries) perStudent.merge(e.assessmentName + ":" + e.userStudentId, 1, Integer::sum);
        Set<String> taken = new HashSet<>();
        for (Entry e : entries) {
            String dir = segment(e.classLabel) + "/" + segment(e.sectionLabel) + "/"
                    + (e.assessmentFolder == null ? "" : e.assessmentFolder + "/");
            String name = e.studentName;
            if (perStudent.get(e.assessmentName + ":" + e.userStudentId) > 1 && e.templateName != null) {
                name += " - " + e.templateName;
            }
            String path = dir + segment(name) + ".pdf";
            if (!taken.add(path.toLowerCase())) {
                String tag = e.rollNumber.isEmpty() ? "ID " + e.userStudentId : e.rollNumber;
                path = dir + segment(name + " (" + tag + ")") + ".pdf";
                for (int n = 2; !taken.add(path.toLowerCase()); n++) {
                    path = dir + segment(name + " (" + tag + ") " + n) + ".pdf";
                }
            }
            e.zipPath = path;
        }
    }

    private static final Pattern CLASS_NUMBER = Pattern.compile("(?i)^(?:class|grade|std\\.?)?\\s*(\\d{1,2})(?:st|nd|rd|th)?$");

    /** Section hierarchy first, flat student_class second — "9" and "Class 9" land together. */
    static String classLabel(String sectionClassName, String studentClass) {
        String raw = sectionClassName != null && !sectionClassName.isBlank() ? sectionClassName : studentClass;
        if (raw == null || raw.isBlank()) return "Class not set";
        raw = raw.trim();
        Matcher m = CLASS_NUMBER.matcher(raw);
        return m.matches() ? "Class " + Integer.parseInt(m.group(1)) : raw;
    }

    static String sectionLabel(String sectionName) {
        if (sectionName == null || sectionName.isBlank() || sectionName.trim().toLowerCase().startsWith("unknown")) {
            return "No Section";
        }
        String s = sectionName.trim();
        return s.toLowerCase().contains("section") ? s : "Section " + s;
    }

    /** Numbered classes in numeric order, then the rest alphabetically. */
    static final Comparator<String> CLASS_ORDER = (a, b) -> {
        Integer na = classNumber(a), nb = classNumber(b);
        if (na != null && nb != null && !na.equals(nb)) return na - nb;
        if (na != null && nb == null) return -1;
        if (na == null && nb != null) return 1;
        return a.compareToIgnoreCase(b);
    };

    private static final Comparator<String> GROUP_ORDER = (a, b) -> {
        String[] pa = a.split("\u0000", 2), pb = b.split("\u0000", 2);
        int c = CLASS_ORDER.compare(pa[0], pb[0]);
        return c != 0 ? c : pa[1].compareToIgnoreCase(pb[1]);
    };

    private static final Pattern CLASS_LABEL = Pattern.compile("^Class (\\d+)$");

    private static Integer classNumber(String label) {
        Matcher m = CLASS_LABEL.matcher(label);
        return m.matches() ? Integer.valueOf(m.group(1)) : null;
    }

    /** A file/folder name every OS accepts. */
    static String segment(String s) {
        String out = s == null ? "" : s.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_")
                .replaceAll("\\s+", " ").trim().replaceAll("[. ]+$", "");
        if (out.length() > 100) out = out.substring(0, 100).trim();
        return out.isEmpty() ? "Unnamed" : out;
    }

    private static Map<String, Object> bucket(Map<String, Map<String, Object>> rows, String cls, String section) {
        return rows.computeIfAbsent(cls + "\u0000" + section, k -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("className", cls);
            row.put("sectionName", section);
            row.put("ready", 0);
            row.put("completedNoPdf", 0);
            row.put("notCompleted", 0);
            return row;
        });
    }

    // ═══════════════════════ RUN ═══════════════════════

    private void run(Job job, Plan plan) {
        if (job.cancelled) return;
        job.status = "running";
        try {
            Map<String, List<Entry>> groups = plan.groups();
            Map<String, List<Missing>> missingByGroup = new HashMap<>();
            for (Missing m : plan.missing) {
                missingByGroup.computeIfAbsent(plan.groupKey(m), k -> new ArrayList<>()).add(m);
            }
            String stamp = String.valueOf(System.currentTimeMillis());
            for (Map.Entry<String, List<Entry>> g : groups.entrySet()) {
                if (job.cancelled) return;
                String suffix = g.getKey().isEmpty() ? "" : "_" + g.getKey().replaceAll("[^a-zA-Z0-9]+", "-");
                String fileName = plan.baseName + suffix + ".zip";
                Part part = writeZip(job, stamp + "_" + fileName, fileName, g.getValue(),
                        missingByGroup.getOrDefault(g.getKey(), Collections.emptyList()));
                if (part == null) return; // cancelled mid-ZIP, upload already aborted
                if (job.cancelled) {
                    // Cancelled while this ZIP was finalising — delete() has
                    // already swept the earlier parts, so sweep this one too.
                    spacesService.deleteFileByUrl(part.url);
                    return;
                }
                job.parts.add(part);
            }
            if (job.added == 0) {
                for (Part p : job.parts) spacesService.deleteFileByUrl(p.url);
                job.parts.clear();
                fail(job, "None of the PDFs could be downloaded from Spaces.");
                return;
            }
            job.status = "done";
            job.phase = null;
            job.finishedAt = System.currentTimeMillis();
            log.info("Auto ZIP {} done: institute={} assessments={} split={} zips={} added={} failed={} missing={}",
                    job.id, job.instituteId, job.assessmentIds, job.splitBy, job.parts.size(),
                    job.added, job.failed, job.missing);
        } catch (Exception e) {
            log.error("Auto ZIP {} failed", job.id, e);
            for (Part p : job.parts) {
                try { spacesService.deleteFileByUrl(p.url); } catch (Exception ignored) { /* best effort */ }
            }
            job.parts.clear();
            fail(job, e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
    }

    /** One ZIP, streamed to Spaces. Returns null if the job was cancelled mid-way. */
    private Part writeZip(Job job, String objectName, String displayName, List<Entry> entries,
            List<Missing> missing) throws IOException {
        MultipartUploadStream out = spacesService.openMultipartUpload(FOLDER, objectName, "application/zip");
        try {
            ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8);
            // PDFs are already compressed; fastest deflate still trims a little.
            zip.setLevel(Deflater.BEST_SPEED);
            List<String[]> summary = new ArrayList<>();
            int added = 0;

            // Fetch a few PDFs ahead, write them strictly in order. Each PDF is
            // read whole before its entry opens, so a download that dies half
            // way can never leave a truncated file inside the ZIP.
            Deque<Future<byte[]>> window = new ArrayDeque<>();
            int next = 0;
            for (int i = 0; i < entries.size(); i++) {
                while (next < entries.size() && window.size() < FETCH_WINDOW) {
                    String url = entries.get(next++).pdfUrl;
                    window.add(fetchExecutor.submit(() -> spacesService.downloadOwnFile(url)));
                }
                Entry e = entries.get(i);
                job.phase = e.classLabel + " · " + e.sectionLabel;
                byte[] pdf;
                try {
                    pdf = window.poll().get(3, TimeUnit.MINUTES);
                } catch (Exception ex) {
                    pdf = null;
                }
                if (job.cancelled) {
                    window.forEach(f -> f.cancel(true));
                    out.abort();
                    return null;
                }
                if (pdf == null || pdf.length == 0) {
                    job.failed++;
                    summary.add(row(e, "Failed to download", ""));
                } else {
                    zip.putNextEntry(new ZipEntry(e.zipPath));
                    zip.write(pdf);
                    zip.closeEntry();
                    added++;
                    job.added++;
                    summary.add(row(e, "Included", e.zipPath));
                }
                job.processed++;
            }
            for (Missing m : missing) {
                summary.add(row(m, m.completed ? "Completed - PDF report not ready yet" : "Assessment not completed", ""));
            }

            zip.putNextEntry(new ZipEntry("_summary.csv"));
            zip.write(csv(summary));
            zip.closeEntry();

            job.phase = "Finalizing " + displayName + "...";
            zip.finish();
            out.close(); // completes the multipart upload
            Part part = new Part();
            part.name = displayName;
            part.url = out.getPublicUrl();
            part.downloadUrl = spacesService.toEdgeUrl(part.url);
            part.fileCount = added;
            part.bytes = out.getBytesWritten();
            return part;
        } catch (IOException | RuntimeException e) {
            out.abort();
            throw e;
        }
    }

    private static String[] row(Student s, String status, String file) {
        return new String[] { s.classLabel, s.sectionLabel, s.assessmentName, s.studentName, s.rollNumber, status, file };
    }

    private static byte[] csv(List<String[]> rows) {
        StringBuilder sb = new StringBuilder("﻿"); // BOM, so Excel reads names as UTF-8
        sb.append("Class,Section,Assessment,Student,Roll No,Status,File\r\n");
        for (String[] r : rows) {
            for (int i = 0; i < r.length; i++) {
                if (i > 0) sb.append(',');
                String v = r[i] == null ? "" : r[i];
                // Leading =,+,-,@ would run as a formula when the school opens it in Excel.
                if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) v = "'" + v;
                sb.append('"').append(v.replace("\"", "\"\"")).append('"');
            }
            sb.append("\r\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void fail(Job job, String error) {
        job.status = "error";
        job.phase = null;
        job.error = error;
        job.finishedAt = System.currentTimeMillis();
    }

    private void evictExpired() {
        long cutoff = System.currentTimeMillis() - JOB_TTL_MS;
        jobs.values().removeIf(j -> j.finishedAt != null && j.finishedAt < cutoff);
    }

    // ═══════════════════════ MODEL ═══════════════════════

    private static class Student {
        String assessmentName;
        Long userStudentId;
        String studentName;
        String rollNumber;
        String classLabel;
        String sectionLabel;
    }

    private static class Entry extends Student {
        String pdfUrl;
        String templateName;
        String assessmentFolder;
        String zipPath;
    }

    private static class Missing extends Student {
        boolean completed;
    }

    private static class Plan {
        String splitBy;
        String baseName;
        final List<Entry> entries = new ArrayList<>();
        final List<Missing> missing = new ArrayList<>();

        String groupKey(Student s) {
            if (SPLIT_CLASS.equals(splitBy)) return s.classLabel;
            if (SPLIT_SECTION.equals(splitBy)) return s.classLabel + " " + s.sectionLabel;
            return "";
        }

        /** Entries per output ZIP, in class/section order (entries are pre-sorted). */
        Map<String, List<Entry>> groups() {
            Map<String, List<Entry>> out = new LinkedHashMap<>();
            for (Entry e : entries) out.computeIfAbsent(groupKey(e), k -> new ArrayList<>()).add(e);
            return out;
        }
    }

    /** Serialised straight to the client — fields are what the Downloads list shows. */
    public static class Job {
        public String id;
        @com.fasterxml.jackson.annotation.JsonIgnore
        public Long ownerUserId;
        public Integer instituteId;
        public List<Long> assessmentIds;
        public String splitBy;
        public String name;
        /** queued | running | done | error */
        public volatile String status;
        public volatile String phase;
        public volatile int total;
        public volatile int processed;
        public volatile int added;
        public volatile int failed;
        public volatile int missing;
        /** Copy-on-write: Jackson serialises it while the worker appends. */
        public final List<Part> parts = new CopyOnWriteArrayList<>();
        public volatile String error;
        public long createdAt;
        public volatile Long finishedAt;
        @com.fasterxml.jackson.annotation.JsonIgnore
        volatile boolean cancelled;
    }

    public static class Part {
        public String name;
        /** Origin URL — what delete works from. */
        public String url;
        /** Edge-CDN URL — what people download from. */
        public String downloadUrl;
        public int fileCount;
        public long bytes;
    }
}
