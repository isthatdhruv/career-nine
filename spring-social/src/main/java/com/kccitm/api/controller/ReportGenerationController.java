package com.kccitm.api.controller;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST endpoint to trigger the reportGeneration module's main() method.
 *
 * Behavior and assumptions:
 * - The code will search upward from the current working directory for a folder named
 *   "reportGeneration" (the module in this repo). If not found the endpoint fails.
 * - It will run `mvn -f <reportGeneration/pom.xml> -DskipTests package` to ensure the
 *   jar is built, then run the jar's main class via `java -cp <jar> com.demo.App`.
 * - Accepts an optional JSON body { "excelPath": "/abs/or/rel/path.xlsx" } to pass to
 *   the report generator; otherwise the report generator will use its default.
 */
@RestController
@RequestMapping("/api/reportgen")
public class ReportGenerationController {

    @PostMapping(value = "/run", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> runReport(@RequestBody(required = false) Map<String, String> body) {
        String excelPath = null;
        if (body != null) {
            excelPath = body.get("excelPath");
        }

        try {
            Path rgDir = findReportGenerationDir();
            if (rgDir == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "reportGeneration module directory not found"));
            }

            return executeReport(rgDir, excelPath);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "interrupted"));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "io error", "message", e.getMessage()));
        }
    }

    @PostMapping(value = "/run/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> uploadAndRun(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "no file uploaded"));
        }

        Path temp = null;
        try {
            Path rgDir = findReportGenerationDir();
            if (rgDir == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "reportGeneration module directory not found"));
            }

            // create a temp file and copy contents
            String fname = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx";
            temp = Files.createTempFile("reportgen-upload-", "-" + fname);
            try (java.io.InputStream in = file.getInputStream()) {
                Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
            }

            return executeReport(rgDir, temp.toAbsolutePath().toString());
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "io error", "message", e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "interrupted"));
        } finally {
            if (temp != null) {
                try { Files.deleteIfExists(temp); } catch (IOException ignored) {}
            }
        }
    }

    private ResponseEntity<Object> executeReport(Path rgDir, String excelPath) throws IOException, InterruptedException {
        // 1) Build the module (skip tests)
        String mvnCmd = findExecutable("mvn");
        if (mvnCmd == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "mvn executable not found on PATH"));
        }

        ProcessBuilder mvnPb = new ProcessBuilder(mvnCmd, "-f", rgDir.resolve("pom.xml").toString(), "-DskipTests", "package");
        mvnPb.directory(rgDir.toFile());
        mvnPb.redirectErrorStream(true);

        StringBuilder output = new StringBuilder();

        Process mvn = mvnPb.start();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(mvn.getInputStream()))) {
            String line;
            while ((line = r.readLine()) != null) {
                output.append(line).append('\n');
            }
        }
        int mvnExit = mvn.waitFor();
        if (mvnExit != 0) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "maven build failed", "mvnExit", mvnExit, "log", output.toString()));
        }

        // 2) Locate the jar in target
        Path targetDir = rgDir.resolve("target");
        if (!Files.exists(targetDir) || !Files.isDirectory(targetDir)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "target directory not found after build"));
        }

        // Expect artifact jython-demo-1.0-SNAPSHOT.jar (as per pom)
        Path jar = targetDir.resolve("jython-demo-1.0-SNAPSHOT.jar");
        if (!Files.exists(jar)) {
            // fallback: pick the first jar in target
            try (var s = Files.list(targetDir)) {
                jar = s.filter(p -> p.toString().endsWith(".jar")).findFirst().orElse(null);
            }
        }

        if (jar == null || !Files.exists(jar)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "no jar found in target after build"));
        }

        // 3) Find java executable
        String javaCmd = findExecutable("java");
        if (javaCmd == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "java executable not found on PATH"));
        }

        // Build java command
        ProcessBuilder javaPb;
        if (excelPath != null && !excelPath.isBlank()) {
            javaPb = new ProcessBuilder(javaCmd, "-cp", jar.toAbsolutePath().toString(), "com.demo.App", excelPath);
        } else {
            javaPb = new ProcessBuilder(javaCmd, "-cp", jar.toAbsolutePath().toString(), "com.demo.App");
        }
        javaPb.directory(rgDir.toFile());
        javaPb.redirectErrorStream(true);

        Process javaProc = javaPb.start();
        StringBuilder runLog = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(javaProc.getInputStream()))) {
            String line;
            while ((line = r.readLine()) != null) {
                runLog.append(line).append('\n');
            }
        }
        int runExit = javaProc.waitFor();
        Map<String, Object> resp = new HashMap<>();
        resp.put("buildLog", output.toString());
        resp.put("runLog", runLog.toString());
        resp.put("runExit", runExit);

        HttpStatus status = runExit == 0 ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status).body(resp);
    }

    private Path findReportGenerationDir() {
        // Walk up from current working dir to find a directory named "reportGeneration"
        Path cur = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        for (int i = 0; i < 8; i++) { // limit depth to avoid infinite loops
            Path candidate = cur.resolve("reportGeneration");
            if (Files.exists(candidate) && Files.isDirectory(candidate)) {
                return candidate;
            }
            cur = cur.getParent();
            if (cur == null) break;
        }
        return null;
    }

    private String findExecutable(String name) {
        // Check common candidates and PATH
        try {
            ProcessBuilder pb = new ProcessBuilder("which", name);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            int exit = p.waitFor();
            if (exit == 0) {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line = r.readLine();
                    if (line != null && !line.isBlank()) return line.trim();
                }
            }
        } catch (IOException | InterruptedException ignored) {
        }
        // fallback to name itself (let OS resolve via PATH)
        return name;
    }
}
