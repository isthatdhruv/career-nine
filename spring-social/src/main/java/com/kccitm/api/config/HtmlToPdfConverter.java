package com.kccitm.api.config;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

public class HtmlToPdfConverter {
    public static void main(String[] args) {
        String htmlPath = "src/main/java/omr-sheet.html";
        String pdfPath = "omr-sheet.pdf";
        try {
            String html = new String(Files.readAllBytes(Paths.get(htmlPath)));
            try (FileOutputStream os = new FileOutputStream(pdfPath)) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.withHtmlContent(html, new File(htmlPath).getParentFile().toURI().toString());
                builder.toStream(os);
                builder.run();
            }
            System.out.println("PDF generated successfully: " + pdfPath);
        } catch (IOException e) {
            System.err.println("Error reading HTML file: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Error generating PDF: " + e.getMessage());
        }
    }
}
