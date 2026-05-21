package com.kccitm.api.controller;

import java.io.IOException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.google.cloud.storage.Blob;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.userDefinedModel.FileDataModal;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.service.GoogleCloudAPI;

@RestController
@RequestMapping("/util")
public class UtilController {

    @Autowired
    GoogleCloudAPI googleCloudApi;

    @Autowired
	private StudentRepository studentRepository;

    @PreAuthorize("@auth.allows('util.execute')")
    @PostMapping(value = "/file-upload")
    public String uploadFile(@RequestBody Map<String, FileDataModal> params) throws IOException {
        FileDataModal data = params.get("values");
        Blob blob = googleCloudApi.uploadFileToCloud(data);

        // byte[] decodedBytes = Base64.getDecoder().decode(params.get("values"));
        // FileUtils.writeByteArrayToFile(new File(outputFileName), decodedBytes);
        return blob.getName();

    }

    // Phase 1 (Task 1.1 / audit CRIT-B): this endpoint is anonymous because the SPA loads images
    // via cross-origin <img>, which cannot carry the cn_at cookie. To stop it from being an
    // unauthenticated arbitrary-object reader, we (1) reject path-traversal / non-simple object
    // keys and (2) serve ONLY image content types — so report PDFs, generated ID-card PDFs, and
    // report ZIPs that live in the same bucket can no longer be exfiltrated through here.
    // (Full ownership-scoped access / signed short-lived URLs remain the complete fix, deferred.)
    @PreAuthorize("@auth.allows('util.read')")
    @GetMapping(value = "/file-get/getbyname/{name}", headers = "Accept=application/json")
    public ResponseEntity<ByteArrayResource> getfileById(@PathVariable("name") String data) throws IOException {
        if (!isSafeObjectName(data)) {
            return ResponseEntity.badRequest().build();
        }
        Blob dataFile = googleCloudApi.getFileFromCloud(data);
        if (dataFile == null) {
            return ResponseEntity.notFound().build();
        }
        String contentType = dataFile.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            // Non-image object — not served through the anonymous image endpoint.
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + dataFile.getName() + "\"")
                .body(new ByteArrayResource(dataFile.getContent()));

    }

    /**
     * Phase 1 (Task 1.1): allow only simple, flat object keys — no path traversal, no
     * slashes/backslashes, no control characters, bounded length. Career-9 upload object names are
     * flat generated tokens, so this rejects "../", absolute keys, and other crafted inputs while
     * leaving legitimate image fetches unaffected. ({@code StrictHttpFirewall} already blocks
     * encoded slashes at the path layer; this is defense-in-depth at the handler.)
     */
    private static boolean isSafeObjectName(String name) {
        if (name == null || name.isEmpty() || name.length() > 256) {
            return false;
        }
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            return false;
        }
        for (int i = 0; i < name.length(); i++) {
            if (name.charAt(i) < 0x20) {
                return false; // control characters
            }
        }
        return true;
    }

    @PreAuthorize("@auth.allows('util.execute')")
    @GetMapping(value = "/file-delete/deletebyname/{name}", headers = "Accept=application/json")
    public ResponseEntity<ByteArrayResource> deletefileById(@PathVariable("name") String data) throws IOException, java.io.IOException {
        googleCloudApi.deleteFileFromCloud(data);
        // studentRepository.deleteBywebcamPhoto(data);
        return null;

    }

    @PreAuthorize("@auth.allows('util.execute')")
    @GetMapping(value = "file-delete/delete/{id}", headers = "Accept=application/json")
	public Student deleteUser(@PathVariable("id") int Id) {
		Student student = studentRepository.getOne(Id);
		student.setWebcamPhoto(null);
		Student r = studentRepository.save(student);
		return r;
	}
}
