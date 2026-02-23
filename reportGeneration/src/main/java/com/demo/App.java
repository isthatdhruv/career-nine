package com.demo;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class App {
    public static void main(String[] args) {
        System.out.println("Java launcher: starting Python pipeline...");

        // Allow caller to pass the path to the input Excel file; otherwise use the default in src/files
        String defaultExcel = "src/files/student_data_2026-02-10.xlsx";
        String excelPathInput = args.length > 0 ? args[0] : defaultExcel;

        // Resolve to absolute path so child processes can open it regardless of their working dir
        Path excelResolvedPath = Paths.get(excelPathInput).toAbsolutePath().normalize();
        String excelPath = excelResolvedPath.toString();

        if (!Files.exists(excelResolvedPath)) {
            System.err.println("Excel input file not found: " + excelPath);
            System.exit(7);
        }

        // Directory that contains the python scripts relative to project root
        Path scriptsDir = Paths.get("src", "files");

        // Ordered list of scripts to run
        List<String> scripts = Arrays.asList(
                "00_data_normalizer.py",
                "00_eligibility_check.py",
                "00_validate_pathway_data.py",
                "01_core_analysis.py",
                "02_career_pathway_analysis.py",
                "03_career_matching.py",
                "04_ai_summaries.py",
                "05_data_enrichment.py",
                "06_generate_reports.py"
        );

        // Determine python command. Prefer python3 if available.
        String pythonCmd = findPythonCommand();
        if (pythonCmd == null) {
            System.err.println("No python or python3 executable found on PATH. Please install Python and try again.");
            System.exit(2);
        }

    // Track which Excel file to pass to each script. Start with the original (absolute) path.
    String currentExcel = excelPath;

    for (String script : scripts) {
            Path scriptPath = scriptsDir.resolve(script);
            if (!scriptPath.toFile().exists()) {
                System.err.println("Script not found: " + scriptPath.toString());
                System.exit(3);
            }

            System.out.println("\n--- Running: " + script + " ---");

            // Pass the absolute path to avoid working-dir-relative duplication
            // Use currentExcel which may switch to the normalized file after the normalizer runs
            ProcessBuilder pb;
            if (script.equals("04_ai_summaries.py")) {
                // This script uses argparse and expects --input rather than a positional arg
                pb = new ProcessBuilder(pythonCmd, scriptPath.toAbsolutePath().toString(), "--input", currentExcel);
            } else {
                pb = new ProcessBuilder(pythonCmd, scriptPath.toAbsolutePath().toString(), currentExcel);
            }
            // set working directory to scripts dir so relative imports inside scripts work (if scripts use relative paths)
            pb.directory(new File(scriptsDir.toString()));
            pb.redirectErrorStream(true);

            try {
                Process p = pb.start();

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        System.out.println(line);
                    }
                }

                // wait with a reasonable timeout per script (5 minutes)
                boolean finished = p.waitFor(5, TimeUnit.MINUTES);
                if (!finished) {
                    p.destroyForcibly();
                    System.err.println("Script timed out and was terminated: " + script);
                    System.exit(4);
                }

                int exit = p.exitValue();
                if (exit != 0) {
                    System.err.println("Script exited with non-zero code (" + exit + "): " + script);
                    System.exit(exit);
                }

                System.out.println("Completed: " + script);

                // If the normalizer ran, switch to the normalized file (input.xlsx) for subsequent scripts
                if (script.equals("00_data_normalizer.py")) {
                    Path normalized = scriptsDir.resolve("input.xlsx").toAbsolutePath().normalize();
                    if (Files.exists(normalized)) {
                        currentExcel = normalized.toString();
                        System.out.println("Using normalized Excel for subsequent steps: " + currentExcel);
                    } else {
                        System.err.println("Expected normalized file not found after normalizer: " + normalized);
                        System.exit(8);
                    }
                }

            } catch (IOException e) {
                System.err.println("IOException while running script " + script + ": " + e.getMessage());
                e.printStackTrace(System.err);
                System.exit(5);
            } catch (InterruptedException e) {
                System.err.println("Interrupted while waiting for script " + script);
                Thread.currentThread().interrupt();
                System.exit(6);
            }
        }

        System.out.println("All scripts finished successfully.");
    }

    private static String findPythonCommand() {
        // Try common candidates. We check if running "python3 --version" or "python --version" works.
        List<String> candidates = Arrays.asList("python3", "python");
        for (String cmd : candidates) {
            try {
                ProcessBuilder pb = new ProcessBuilder(cmd, "--version");
                pb.redirectErrorStream(true);
                Process p = pb.start();
                boolean finished = p.waitFor(3, TimeUnit.SECONDS);
                if (finished && p.exitValue() == 0) {
                    return cmd;
                }
            } catch (IOException | InterruptedException ignored) {
                // try next
            }
        }
        return null;
    }
}
