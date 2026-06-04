package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.service.DigitalOceanSpacesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Renders a stored HTML report (by its Spaces URL) to PDF via Gotenberg and
 * uploads the PDF beside the HTML. Returns the public PDF URL. Synchronous —
 * called inline during report generation so the PDF exists the moment the
 * report is generated.
 */
@Service
public class PdfRenderService {

    @Autowired private GotenbergClient gotenberg;
    @Autowired private DigitalOceanSpacesService spaces;

    /** Render {@code htmlUrl} → PDF, upload to the same folder with a .pdf name, return the PDF URL. */
    public String renderAndUpload(String htmlUrl) {
        byte[] pdf = gotenberg.renderUrl(htmlUrl);
        String folder = folderOf(htmlUrl);
        String fileName = pdfFileNameOf(htmlUrl);
        return spaces.uploadBytes(pdf, "application/pdf", folder, fileName);
    }

    /** "https://cdn/a/b/student_3_x.html" → "a/b" (path between host and filename). */
    static String folderOf(String url) {
        String path = url.replaceFirst("^https?://[^/]+/", "");
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(0, slash) : "";
    }

    /** ".../student_3_x.html" → "student_3_x.pdf". */
    static String pdfFileNameOf(String url) {
        String path = url.substring(url.lastIndexOf('/') + 1);
        return path.replaceFirst("\\.html?($|\\?.*$)", "") + ".pdf";
    }
}
