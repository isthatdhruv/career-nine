package com.kccitm.api.controller;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/reportgen")
public class ReportGenerationController {

    private static final int SCRIPT_TIMEOUT_MINUTES = 5;

    @PostMapping(value = "/run", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> runReport(@RequestBody(required = false) Map<String, String> body) {
        String excelPath = null;
        if (body != null) {
            excelPath = body.get("excelPath");
        }

        if (excelPath == null || excelPath.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "excelPath is required in request body"));
        }

        Path excelFile = Paths.get(excelPath);
        if (!Files.exists(excelFile)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Excel file not found: " + excelPath));
        }

        return executePipeline(excelFile);
    }

    @PostMapping(value = "/run/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Object> uploadAndRun(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        Path rgDir = findReportGenerationDir();
        if (rgDir == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "reportGeneration directory not found"));
        }

        // Save uploaded file to the scripts directory
        Path scriptsDir = rgDir.resolve("src").resolve("files");
        String fname = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx";
        Path uploadedFile = scriptsDir.resolve(fname);

        try (java.io.InputStream in = file.getInputStream()) {
            Files.copy(in, uploadedFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save uploaded file: " + e.getMessage()));
        }

        return executePipeline(uploadedFile);
    }

    private ResponseEntity<Object> executePipeline(Path excelFile) {
        Path rgDir = findReportGenerationDir();
        if (rgDir == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "reportGeneration directory not found"));
        }

        Path scriptsDir = rgDir.resolve("src").resolve("files");
        String pythonCmd = findPythonCommand(rgDir);

        if (pythonCmd == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Python executable not found (checked venv and system)"));
        }

        // Pipeline scripts in order
        List<String[]> pipeline = Arrays.asList(
            new String[]{pythonCmd, "00_data_normalizer.py", excelFile.toAbsolutePath().toString()},
            new String[]{pythonCmd, "00_eligibility_check.py", "input.xlsx"},
            new String[]{pythonCmd, "01_core_analysis.py"},
            new String[]{pythonCmd, "02_career_pathway_analysis.py"},
            new String[]{pythonCmd, "03_career_matching.py"},
            new String[]{pythonCmd, "04_ai_summaries.py", "--resume", "--batch-size=10"},
            new String[]{pythonCmd, "05_data_enrichment.py"},
            new String[]{pythonCmd, "06_generate_reports.py"}
        );

        StringBuilder fullLog = new StringBuilder();

        for (String[] cmd : pipeline) {
            String scriptName = cmd[1];
            fullLog.append("\n--- Running: ").append(scriptName).append(" ---\n");

            try {
                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.directory(scriptsDir.toFile());
                pb.redirectErrorStream(true);

                Process process = pb.start();
                StringBuilder scriptOutput = new StringBuilder();

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        scriptOutput.append(line).append('\n');
                    }
                }

                boolean finished = process.waitFor(SCRIPT_TIMEOUT_MINUTES, TimeUnit.MINUTES);
                if (!finished) {
                    process.destroyForcibly();
                    fullLog.append(scriptOutput);
                    fullLog.append("TIMEOUT: Script exceeded ").append(SCRIPT_TIMEOUT_MINUTES).append(" minutes\n");
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Script timed out: " + scriptName, "log", fullLog.toString()));
                }

                fullLog.append(scriptOutput);

                int exitCode = process.exitValue();
                if (exitCode != 0) {
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Script failed: " + scriptName,
                                         "exitCode", exitCode,
                                         "log", fullLog.toString()));
                }

            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Error running " + scriptName + ": " + e.getMessage(),
                                     "log", fullLog.toString()));
            }
        }

        // Pipeline complete — collect generated reports into ZIP
        Path reportsDir = scriptsDir.resolve("Reports").resolve("english");
        if (!Files.exists(reportsDir) || !Files.isDirectory(reportsDir)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Reports directory not found after pipeline",
                                 "log", fullLog.toString()));
        }

        try {
            byte[] zipBytes = createZipFromDirectory(reportsDir);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "career9_reports.zip");
            headers.setContentLength(zipBytes.length);

            return new ResponseEntity<>(zipBytes, headers, HttpStatus.OK);

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create ZIP: " + e.getMessage(),
                                 "log", fullLog.toString()));
        }
    }

    private byte[] createZipFromDirectory(Path directory) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            addDirectoryToZip(zos, directory, directory);
        }
        return baos.toByteArray();
    }

    private void addDirectoryToZip(ZipOutputStream zos, Path fileOrDir, Path baseDir) throws IOException {
        File[] files = fileOrDir.toFile().listFiles();
        if (files == null) return;

        for (File file : files) {
            String entryName = baseDir.relativize(file.toPath()).toString();
            if (file.isDirectory()) {
                zos.putNextEntry(new ZipEntry(entryName + "/"));
                zos.closeEntry();
                addDirectoryToZip(zos, file.toPath(), baseDir);
            } else {
                zos.putNextEntry(new ZipEntry(entryName));
                try (FileInputStream fis = new FileInputStream(file)) {
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = fis.read(buffer)) > 0) {
                        zos.write(buffer, 0, len);
                    }
                }
                zos.closeEntry();
            }
        }
    }

    private Path findReportGenerationDir() {
        Path cur = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        for (int i = 0; i < 8; i++) {
            Path candidate = cur.resolve("reportGeneration");
            if (Files.exists(candidate) && Files.isDirectory(candidate)) {
                return candidate;
            }
            cur = cur.getParent();
            if (cur == null) break;
        }
        return null;
    }

    private String findPythonCommand(Path rgDir) {
        // 1. Prefer the project's venv Python
        Path venvPython = rgDir.resolve(".venv").resolve("bin").resolve("python");
        if (Files.exists(venvPython) && Files.isExecutable(venvPython)) {
            return venvPython.toAbsolutePath().toString();
        }

        // 2. Fallback to system python3 / python
        for (String cmd : Arrays.asList("python3", "python")) {
            try {
                ProcessBuilder pb = new ProcessBuilder(cmd, "--version");
                pb.redirectErrorStream(true);
                Process p = pb.start();
                boolean finished = p.waitFor(3, TimeUnit.SECONDS);
                if (finished && p.exitValue() == 0) {
                    return cmd;
                }
            } catch (IOException | InterruptedException ignored) {
            }
        }
        return null;
    }
}
