package com.kccitm.api.loadtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Load test for the assessment flow.
 * Runs against an already-running server (not embedded).
 *
 * Usage:
 *   mvn test -Dtest=com.kccitm.api.loadtest.AssessmentLoadTest \
 *     -Dloadtest.baseUrl=http://localhost:8080 \
 *     -Dloadtest.excelFile=src/test/resources/students.xlsx \
 *     -Dloadtest.threadPoolSize=100 \
 *     -Dloadtest.assessmentId=5 \
 *     -Dloadtest.timeoutMinutes=10
 */
public class AssessmentLoadTest {

    // --- Configuration ---
    private static final String BASE_URL = System.getProperty("loadtest.baseUrl", "http://localhost:8080");
    private static final String EXCEL_FILE = System.getProperty("loadtest.excelFile", "src/test/resources/students.xlsx");
    private static final int THREAD_POOL_SIZE = Integer.parseInt(System.getProperty("loadtest.threadPoolSize", "100"));
    private static final String ASSESSMENT_ID_OVERRIDE = System.getProperty("loadtest.assessmentId", null);
    private static final int TIMEOUT_MINUTES = Integer.parseInt(System.getProperty("loadtest.timeoutMinutes", "10"));

    private static RestTemplate restTemplate;
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final ConcurrentLinkedQueue<RequestMetric> allMetrics = new ConcurrentLinkedQueue<>();
    private static final ConcurrentLinkedQueue<StudentFlowResult> allResults = new ConcurrentLinkedQueue<>();

    // --- Data Classes ---

    static class StudentCredential {
        final String username;
        final String dob;
        StudentCredential(String username, String dob) {
            this.username = username;
            this.dob = dob;
        }
    }

    static class RequestMetric {
        final String endpoint;
        final long responseTimeMs;
        final int responseBytes;
        final int httpStatus;
        final String studentUsername;
        final long timestamp;

        RequestMetric(String endpoint, long responseTimeMs, int responseBytes, int httpStatus, String studentUsername) {
            this.endpoint = endpoint;
            this.responseTimeMs = responseTimeMs;
            this.responseBytes = responseBytes;
            this.httpStatus = httpStatus;
            this.studentUsername = studentUsername;
            this.timestamp = System.currentTimeMillis();
        }
    }

    static class StudentFlowResult {
        final String username;
        final long totalFlowTimeMs;
        final long dataLoadTimeMs;
        final boolean success;
        final String errorMessage;
        final List<RequestMetric> metrics;

        StudentFlowResult(String username, long totalFlowTimeMs, long dataLoadTimeMs,
                          boolean success, String errorMessage, List<RequestMetric> metrics) {
            this.username = username;
            this.totalFlowTimeMs = totalFlowTimeMs;
            this.dataLoadTimeMs = dataLoadTimeMs;
            this.success = success;
            this.errorMessage = errorMessage;
            this.metrics = metrics;
        }
    }

    static class HttpResult {
        final String body;
        final int status;
        final int bytes;
        final long timeMs;

        HttpResult(String body, int status, int bytes, long timeMs) {
            this.body = body;
            this.status = status;
            this.bytes = bytes;
            this.timeMs = timeMs;
        }
    }

    // --- Setup ---

    @BeforeAll
    static void setup() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(60000);
        restTemplate = new RestTemplate(factory);
    }

    // --- Main Test ---

    @Test
    void runLoadTest() throws Exception {
        List<StudentCredential> students = readStudentsFromExcel(EXCEL_FILE);
        System.out.println("\n========================================");
        System.out.println("ASSESSMENT LOAD TEST");
        System.out.println("========================================");
        System.out.println("Target: " + BASE_URL);
        System.out.println("Students: " + students.size());
        System.out.println("Thread pool: " + THREAD_POOL_SIZE);
        System.out.println("Assessment ID: " + (ASSESSMENT_ID_OVERRIDE != null ? ASSESSMENT_ID_OVERRIDE : "auto-discover"));
        System.out.println("Timeout: " + TIMEOUT_MINUTES + " minutes");
        System.out.println("========================================\n");

        // Verify server is reachable
        try {
            restTemplate.getForEntity(BASE_URL + "/assessments/getAll", String.class);
            System.out.println("Server is reachable. Starting load test...\n");
        } catch (Exception e) {
            System.err.println("ERROR: Cannot reach server at " + BASE_URL + " — " + e.getMessage());
            return;
        }

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        CountDownLatch startBarrier = new CountDownLatch(1);
        long testStart = System.nanoTime();

        List<Callable<StudentFlowResult>> tasks = new ArrayList<>();
        for (StudentCredential student : students) {
            tasks.add(() -> {
                startBarrier.await(); // All threads wait here, then start simultaneously
                return executeStudentFlow(student);
            });
        }

        // Submit all tasks
        List<Future<StudentFlowResult>> futures = new ArrayList<>();
        for (Callable<StudentFlowResult> task : tasks) {
            futures.add(executor.submit(task));
        }

        // Release all threads at once
        System.out.println("All " + students.size() + " threads ready. Releasing barrier...\n");
        startBarrier.countDown();

        // Collect results
        for (Future<StudentFlowResult> future : futures) {
            try {
                StudentFlowResult result = future.get(TIMEOUT_MINUTES, TimeUnit.MINUTES);
                allResults.add(result);
            } catch (TimeoutException e) {
                System.err.println("TIMEOUT: A student flow exceeded " + TIMEOUT_MINUTES + " minutes");
            } catch (ExecutionException e) {
                System.err.println("EXECUTION ERROR: " + e.getCause().getMessage());
            }
        }

        long testDurationMs = (System.nanoTime() - testStart) / 1_000_000;

        executor.shutdown();
        executor.awaitTermination(1, TimeUnit.MINUTES);

        generateReport(testDurationMs);
        writeCsvReport();
    }

    // --- Reset Test ---

    @Test
    void resetAllStudents() throws Exception {
        List<StudentCredential> students = readStudentsFromExcel(EXCEL_FILE);
        System.out.println("\n========================================");
        System.out.println("ASSESSMENT RESET - ALL STUDENTS");
        System.out.println("========================================");
        System.out.println("Target: " + BASE_URL);
        System.out.println("Students: " + students.size());
        System.out.println("Assessment ID: " + (ASSESSMENT_ID_OVERRIDE != null ? ASSESSMENT_ID_OVERRIDE : "auto-discover"));
        System.out.println("========================================\n");

        int success = 0;
        int failed = 0;

        for (StudentCredential student : students) {
            try {
                // Login to get userStudentId
                Map<String, String> authBody = new HashMap<>();
                authBody.put("username", student.username);
                authBody.put("dobDate", student.dob);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Object> authEntity = new HttpEntity<>(authBody, headers);
                ResponseEntity<String> authResp = restTemplate.exchange(
                        BASE_URL + "/user/auth", HttpMethod.POST, authEntity, String.class);

                JsonNode authJson = objectMapper.readTree(authResp.getBody());
                long userStudentId = authJson.get("userStudentId").asLong();

                Long assessmentId = ASSESSMENT_ID_OVERRIDE != null
                        ? Long.parseLong(ASSESSMENT_ID_OVERRIDE)
                        : findActiveAssessmentId(authJson.get("assessments"));

                if (assessmentId == null) {
                    System.err.println("[" + student.username + "] No active assessment found — skipped");
                    failed++;
                    continue;
                }

                // Reset
                Map<String, Long> resetBody = new HashMap<>();
                resetBody.put("userStudentId", userStudentId);
                resetBody.put("assessmentId", assessmentId);
                HttpEntity<Object> resetEntity = new HttpEntity<>(resetBody, headers);
                ResponseEntity<String> resetResp = restTemplate.exchange(
                        BASE_URL + "/student-info/resetAssessment", HttpMethod.POST, resetEntity, String.class);

                System.out.println("[" + student.username + "] Reset: " + resetResp.getStatusCodeValue());
                success++;

            } catch (Exception e) {
                System.err.println("[" + student.username + "] Reset FAILED: " + e.getMessage());
                failed++;
            }
        }

        System.out.println("\n========================================");
        System.out.println("Reset complete. Success: " + success + " | Failed: " + failed);
        System.out.println("========================================\n");
    }

    // --- Student Flow ---

    private StudentFlowResult executeStudentFlow(StudentCredential student) {
        long flowStart = System.nanoTime();
        List<RequestMetric> metrics = new ArrayList<>();
        long dataLoadTimeMs = 0;
        String error = null;

        try {
            // Step 1: Login
            Map<String, String> authBody = new HashMap<>();
            authBody.put("username", student.username);
            authBody.put("dobDate", student.dob);
            HttpResult authResult = doPost("/user/auth", authBody, student.username, "POST /user/auth", metrics);

            if (authResult.status != 200 || authResult.body == null) {
                return fail(student, flowStart, metrics, "Auth failed: HTTP " + authResult.status);
            }

            JsonNode authJson = objectMapper.readTree(authResult.body);
            if (!authJson.has("userStudentId")) {
                return fail(student, flowStart, metrics, "Auth response missing userStudentId");
            }

            long userStudentId = authJson.get("userStudentId").asLong();
            Long assessmentId = findActiveAssessmentId(authJson.get("assessments"));

            if (ASSESSMENT_ID_OVERRIDE != null) {
                assessmentId = Long.parseLong(ASSESSMENT_ID_OVERRIDE);
            }

            if (assessmentId == null) {
                return fail(student, flowStart, metrics, "No active assessment found");
            }

            // Step 2: Check demographics status
            HttpResult demoStatusResult = doGet(
                    "/student-demographics/status/" + assessmentId + "/" + userStudentId,
                    student.username, "GET demographics/status", metrics);

            if (demoStatusResult.status == 200 && demoStatusResult.body != null) {
                JsonNode demoStatus = objectMapper.readTree(demoStatusResult.body);
                int totalFields = demoStatus.has("totalFields") ? demoStatus.get("totalFields").asInt(0) : 0;

                if (totalFields > 0) {
                    // Step 3: Fetch demographic fields
                    HttpResult demoFieldsResult = doGet(
                            "/student-demographics/fields/" + assessmentId + "/" + userStudentId,
                            student.username, "GET demographics/fields", metrics);

                    if (demoFieldsResult.status == 200 && demoFieldsResult.body != null) {
                        // Step 4: Submit demographics with mock values
                        Map<String, Object> demoSubmitBody = buildDemographicsPayload(
                                demoFieldsResult.body, assessmentId, userStudentId);
                        doPost("/student-demographics/submit", demoSubmitBody,
                                student.username, "POST demographics/submit", metrics);
                    }
                }
            }

            // Step 5: Fetch questionnaire (data loading starts here)
            long dataLoadStart = System.nanoTime();
            HttpResult questionnaireResult = doGet(
                    "/assessments/getby/" + assessmentId,
                    student.username, "GET /assessments/getby/", metrics);

            // Step 6: Fetch assessment config
            HttpResult configResult = doGet(
                    "/assessments/getById/" + assessmentId,
                    student.username, "GET /assessments/getById/", metrics);
            dataLoadTimeMs = (System.nanoTime() - dataLoadStart) / 1_000_000;

            // Step 7: Start assessment
            Map<String, Long> startBody = new HashMap<>();
            startBody.put("userStudentId", userStudentId);
            startBody.put("assessmentId", assessmentId);
            HttpResult startResult = doPost("/assessments/startAssessment", startBody,
                    student.username, "POST startAssessment", metrics);

            // Step 8: Build answers and submit
            if (questionnaireResult.status == 200 && questionnaireResult.body != null) {
                List<Map<String, Object>> answers = buildAnswersFromQuestionnaire(questionnaireResult.body);

                if (!answers.isEmpty()) {
                    Map<String, Object> submitBody = new HashMap<>();
                    submitBody.put("userStudentId", userStudentId);
                    submitBody.put("assessmentId", assessmentId);
                    submitBody.put("status", "completed");
                    submitBody.put("answers", answers);

                    HttpResult submitResult = doPost("/assessment-answer/submit", submitBody,
                            student.username, "POST submit", metrics);

                    if (submitResult.status == 409) {
                        // Already submitted — expected for re-runs, not an error
                        System.out.println("[" + student.username + "] Submit returned 409 (already submitted)");
                    }
                } else {
                    error = "No answers could be built from questionnaire";
                }
            } else {
                error = "Failed to load questionnaire: HTTP " + questionnaireResult.status;
            }

        } catch (Exception e) {
            error = e.getClass().getSimpleName() + ": " + e.getMessage();
        }

        long totalMs = (System.nanoTime() - flowStart) / 1_000_000;
        boolean success = error == null;
        if (!success) {
            System.err.println("[" + student.username + "] FAILED: " + error);
        }
        return new StudentFlowResult(student.username, totalMs, dataLoadTimeMs, success, error, metrics);
    }

    // --- HTTP Helpers ---

    private HttpResult doGet(String path, String studentUsername, String endpointName, List<RequestMetric> metrics) {
        long start = System.nanoTime();
        String body = null;
        int status = 0;
        int bytes = 0;

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(BASE_URL + path, String.class);
            status = response.getStatusCodeValue();
            body = response.getBody();
            bytes = body != null ? body.getBytes().length : 0;
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            status = e.getRawStatusCode();
            body = e.getResponseBodyAsString();
            bytes = body != null ? body.getBytes().length : 0;
        } catch (ResourceAccessException e) {
            status = -1; // Connection error
        }

        long timeMs = (System.nanoTime() - start) / 1_000_000;
        RequestMetric metric = new RequestMetric(endpointName, timeMs, bytes, status, studentUsername);
        metrics.add(metric);
        allMetrics.add(metric);
        return new HttpResult(body, status, bytes, timeMs);
    }

    private HttpResult doPost(String path, Object body, String studentUsername, String endpointName, List<RequestMetric> metrics) {
        long start = System.nanoTime();
        String responseBody = null;
        int status = 0;
        int bytes = 0;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + path, HttpMethod.POST, entity, String.class);
            status = response.getStatusCodeValue();
            responseBody = response.getBody();
            bytes = responseBody != null ? responseBody.getBytes().length : 0;
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            status = e.getRawStatusCode();
            responseBody = e.getResponseBodyAsString();
            bytes = responseBody != null ? responseBody.getBytes().length : 0;
        } catch (ResourceAccessException e) {
            status = -1;
        }

        long timeMs = (System.nanoTime() - start) / 1_000_000;
        RequestMetric metric = new RequestMetric(endpointName, timeMs, bytes, status, studentUsername);
        metrics.add(metric);
        allMetrics.add(metric);
        return new HttpResult(responseBody, status, bytes, timeMs);
    }

    // --- Payload Builders ---

    private Long findActiveAssessmentId(JsonNode assessments) {
        if (assessments == null || !assessments.isArray()) return null;
        for (JsonNode a : assessments) {
            boolean isActive = a.has("isActive") && a.get("isActive").asBoolean(false);
            // Also check "active" field name variant
            if (!isActive && a.has("active")) {
                isActive = a.get("active").asBoolean(false);
            }
            String studentStatus = a.has("studentStatus") ? a.get("studentStatus").asText("") : "";
            if (isActive && !"completed".equalsIgnoreCase(studentStatus)) {
                return a.get("assessmentId").asLong();
            }
        }
        // Fallback: return first active assessment even if completed
        for (JsonNode a : assessments) {
            boolean isActive = (a.has("isActive") && a.get("isActive").asBoolean(false))
                    || (a.has("active") && a.get("active").asBoolean(false));
            if (isActive) {
                return a.get("assessmentId").asLong();
            }
        }
        return null;
    }

    private List<Map<String, Object>> buildAnswersFromQuestionnaire(String questionnaireJson) {
        List<Map<String, Object>> answers = new ArrayList<>();
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        try {
            JsonNode root = objectMapper.readTree(questionnaireJson);

            // The response could be an array of questionnaires or a single object
            JsonNode questionnaires = root.isArray() ? root : objectMapper.createArrayNode().add(root);

            for (JsonNode questionnaire : questionnaires) {
                JsonNode sections = questionnaire.has("sections") ? questionnaire.get("sections") : null;
                if (sections == null || !sections.isArray()) continue;

                for (JsonNode section : sections) {
                    JsonNode questions = section.has("questions") ? section.get("questions") : null;
                    if (questions == null || !questions.isArray()) continue;

                    for (JsonNode qq : questions) {
                        long qqId = qq.has("questionnaireQuestionId")
                                ? qq.get("questionnaireQuestionId").asLong(0) : 0;
                        if (qqId == 0) continue;

                        // Get maxOptionsAllowed (defaults to 1 for single-choice)
                        int maxOptions = qq.has("maxOptionsAllowed")
                                ? qq.get("maxOptionsAllowed").asInt(1) : 1;
                        if (maxOptions < 1) maxOptions = 1;

                        // Get options from the nested question object
                        JsonNode questionObj = qq.has("question") ? qq.get("question") : null;
                        if (questionObj == null) continue;

                        JsonNode options = questionObj.has("options") ? questionObj.get("options") : null;
                        if (options == null || !options.isArray() || options.size() == 0) continue;

                        // Collect all valid option IDs
                        List<Long> optionIds = new ArrayList<>();
                        for (JsonNode opt : options) {
                            long oid = opt.has("optionId") ? opt.get("optionId").asLong(0) : 0;
                            if (oid > 0) optionIds.add(oid);
                        }
                        if (optionIds.isEmpty()) continue;

                        // Shuffle and pick up to maxOptionsAllowed random options
                        Collections.shuffle(optionIds, rng);
                        int pickCount = Math.min(maxOptions, optionIds.size());

                        for (int p = 0; p < pickCount; p++) {
                            Map<String, Object> answer = new HashMap<>();
                            answer.put("questionnaireQuestionId", qqId);
                            answer.put("optionId", optionIds.get(p));
                            answers.add(answer);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error parsing questionnaire: " + e.getMessage());
        }
        return answers;
    }

    private Map<String, Object> buildDemographicsPayload(String fieldsJson, long assessmentId, long userStudentId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("assessmentId", assessmentId);
        payload.put("userStudentId", userStudentId);

        List<Map<String, Object>> responses = new ArrayList<>();
        try {
            JsonNode fields = objectMapper.readTree(fieldsJson);
            if (fields.isArray()) {
                for (JsonNode field : fields) {
                    long fieldId = field.has("fieldId") ? field.get("fieldId").asLong() : 0;
                    String dataType = field.has("dataType") ? field.get("dataType").asText("TEXT") : "TEXT";

                    if (fieldId == 0) continue;

                    // Use pre-filled currentValue from backend if available (SYSTEM fields)
                    String currentValue = field.has("currentValue") && !field.get("currentValue").isNull()
                            ? field.get("currentValue").asText("") : "";

                    String value;
                    if (!currentValue.isEmpty()) {
                        value = currentValue;
                    } else {
                        switch (dataType.toUpperCase()) {
                            case "NUMBER":
                                value = "1";
                                break;
                            case "SELECT":
                            case "SELECT_MULTI":
                                JsonNode options = field.has("options") ? field.get("options") : null;
                                if (options != null && options.isArray() && options.size() > 0) {
                                    value = options.get(0).has("optionValue")
                                            ? options.get(0).get("optionValue").asText("1") : "1";
                                } else {
                                    value = "1";
                                }
                                break;
                            default: // TEXT
                                value = "Test";
                                break;
                        }
                    }

                    Map<String, Object> fv = new HashMap<>();
                    fv.put("fieldId", fieldId);
                    fv.put("value", value);
                    responses.add(fv);
                }
            }
        } catch (Exception e) {
            System.err.println("Error parsing demographics fields: " + e.getMessage());
        }

        payload.put("responses", responses);
        return payload;
    }

    // --- Excel Reader ---

    private List<StudentCredential> readStudentsFromExcel(String filePath) throws IOException {
        List<StudentCredential> students = new ArrayList<>();
        try (FileInputStream fis = new FileInputStream(filePath);
             Workbook workbook = new XSSFWorkbook(fis)) {

            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) { // Skip header row
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String username = getCellString(row.getCell(0), formatter);
                String dob = getCellString(row.getCell(1), formatter);

                if (username != null && !username.isEmpty() && dob != null && !dob.isEmpty()) {
                    students.add(new StudentCredential(username.trim(), dob.trim()));
                }
            }
        }
        System.out.println("Read " + students.size() + " students from " + filePath);
        return students;
    }

    private String getCellString(Cell cell, DataFormatter formatter) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            // Could be a number formatted as text
            return formatter.formatCellValue(cell);
        }
        return formatter.formatCellValue(cell);
    }

    // --- Failure Helper ---

    private StudentFlowResult fail(StudentCredential student, long flowStartNanos,
                                   List<RequestMetric> metrics, String error) {
        long totalMs = (System.nanoTime() - flowStartNanos) / 1_000_000;
        System.err.println("[" + student.username + "] FAILED: " + error);
        return new StudentFlowResult(student.username, totalMs, 0, false, error, metrics);
    }

    // --- Report Generation ---

    private void generateReport(long testDurationMs) {
        List<StudentFlowResult> results = new ArrayList<>(allResults);
        List<RequestMetric> metrics = new ArrayList<>(allMetrics);

        long successCount = results.stream().filter(r -> r.success).count();
        long failCount = results.stream().filter(r -> !r.success).count();
        double totalRequests = metrics.size();
        double throughput = totalRequests / (testDurationMs / 1000.0);

        // Group metrics by endpoint
        Map<String, List<RequestMetric>> byEndpoint = metrics.stream()
                .collect(Collectors.groupingBy(m -> m.endpoint, LinkedHashMap::new, Collectors.toList()));

        System.out.println("\n");
        String header = String.format(
                "  ASSESSMENT LOAD TEST REPORT  |  Duration: %.1fs  |  Students: %d  |  Success: %d  |  Failed: %d  |  Throughput: %.1f rps",
                testDurationMs / 1000.0, results.size(), successCount, failCount, throughput);
        System.out.println("=".repeat(header.length()));
        System.out.println(header);
        System.out.println("=".repeat(header.length()));

        System.out.printf("\n  %-26s %7s %7s %8s %8s %8s %8s %8s %10s%n",
                "Endpoint", "Count", "Errors", "Err%", "Avg", "Median", "p95", "p99", "Avg Size");
        System.out.println("  " + "-".repeat(100));

        for (Map.Entry<String, List<RequestMetric>> entry : byEndpoint.entrySet()) {
            String endpoint = entry.getKey();
            List<RequestMetric> epMetrics = entry.getValue();

            long count = epMetrics.size();
            long errors = epMetrics.stream().filter(m -> m.httpStatus < 200 || m.httpStatus >= 400).count();
            double errPct = count > 0 ? (errors * 100.0 / count) : 0;

            List<Long> times = epMetrics.stream().map(m -> m.responseTimeMs).sorted().collect(Collectors.toList());
            long avg = (long) times.stream().mapToLong(Long::longValue).average().orElse(0);
            long median = percentile(times, 0.50);
            long p95 = percentile(times, 0.95);
            long p99 = percentile(times, 0.99);

            double avgKb = epMetrics.stream().mapToInt(m -> m.responseBytes).average().orElse(0) / 1024.0;

            System.out.printf("  %-26s %7d %7d %7.1f%% %6dms %6dms %6dms %6dms %8.1f KB%n",
                    endpoint, count, errors, errPct, avg, median, p95, p99, avgKb);
        }

        System.out.println("  " + "-".repeat(100));

        // Student flow stats
        List<Long> flowTimes = results.stream().filter(r -> r.success).map(r -> r.totalFlowTimeMs).sorted().collect(Collectors.toList());
        List<Long> loadTimes = results.stream().filter(r -> r.success && r.dataLoadTimeMs > 0).map(r -> r.dataLoadTimeMs).sorted().collect(Collectors.toList());

        if (!flowTimes.isEmpty()) {
            System.out.printf("%n  Student Flow Times:  Avg: %dms  |  Median: %dms  |  p95: %dms  |  p99: %dms  |  Max: %dms%n",
                    (long) flowTimes.stream().mapToLong(Long::longValue).average().orElse(0),
                    percentile(flowTimes, 0.50), percentile(flowTimes, 0.95),
                    percentile(flowTimes, 0.99), flowTimes.get(flowTimes.size() - 1));
        }
        if (!loadTimes.isEmpty()) {
            System.out.printf("  Data Load Times:     Avg: %dms  |  Median: %dms  |  p95: %dms  |  p99: %dms  |  Max: %dms%n",
                    (long) loadTimes.stream().mapToLong(Long::longValue).average().orElse(0),
                    percentile(loadTimes, 0.50), percentile(loadTimes, 0.95),
                    percentile(loadTimes, 0.99), loadTimes.get(loadTimes.size() - 1));
        }

        // Print failures
        List<StudentFlowResult> failures = results.stream().filter(r -> !r.success).collect(Collectors.toList());
        if (!failures.isEmpty()) {
            System.out.println("\n  FAILURES:");
            for (StudentFlowResult f : failures) {
                System.out.printf("    [%s] %s%n", f.username, f.errorMessage);
            }
        }

        System.out.println("\n" + "=".repeat(header.length()) + "\n");
    }

    private void writeCsvReport() {
        Path csvPath = Paths.get("target", "load-test-report.csv");
        try {
            Files.createDirectories(csvPath.getParent());
            try (PrintWriter writer = new PrintWriter(Files.newBufferedWriter(csvPath))) {
                writer.println("timestamp,student,endpoint,httpStatus,responseTimeMs,responseBytes");
                for (RequestMetric m : allMetrics) {
                    writer.printf("%d,%s,%s,%d,%d,%d%n",
                            m.timestamp, m.studentUsername, m.endpoint, m.httpStatus, m.responseTimeMs, m.responseBytes);
                }
            }
            System.out.println("CSV report written to: " + csvPath.toAbsolutePath());
        } catch (IOException e) {
            System.err.println("Failed to write CSV: " + e.getMessage());
        }
    }

    private long percentile(List<Long> sorted, double p) {
        if (sorted.isEmpty()) return 0;
        int index = (int) Math.ceil(p * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }
}
