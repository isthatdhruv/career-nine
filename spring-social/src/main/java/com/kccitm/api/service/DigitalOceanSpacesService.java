package com.kccitm.api.service;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.CannedAccessControlList;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;

@Service
public class DigitalOceanSpacesService {

    private static final Logger logger = LoggerFactory.getLogger(DigitalOceanSpacesService.class);

    @Value("${app.digitalocean.spaces.bucket:storage-c9}")
    private String bucket;

    @Value("${app.digitalocean.spaces.region:sgp1}")
    private String region;

    @Value("${app.digitalocean.spaces.cdn-url:https://storage-c9.sgp1.digitaloceanspaces.com}")
    private String cdnUrl;

    private AmazonS3 s3Client;

    @PostConstruct
    public void init() {
        // Read credentials from download.txt file
        String accessKey = null;
        String secretKey = null;
        String endpoint = "https://sgp1.digitaloceanspaces.com";

        try {
            // Look for download.txt in project root (parent of spring-social)
            Path downloadFile = findDownloadTxt();
            if (downloadFile != null && Files.exists(downloadFile)) {
                List<String> lines = Files.readAllLines(downloadFile);
                for (String line : lines) {
                    line = line.trim();
                    if (line.contains("aws_access_key_id")) {
                        accessKey = line.substring(line.lastIndexOf(" ") + 1).trim();
                    } else if (line.contains("aws_secret_access_key")) {
                        secretKey = line.substring(line.lastIndexOf(" ") + 1).trim();
                    } else if (line.contains("endpoint_url")) {
                        endpoint = line.substring(line.lastIndexOf(" ") + 1).trim();
                    }
                }
                logger.info("DO Spaces credentials loaded from download.txt");
            } else {
                logger.warn("download.txt not found. DigitalOcean Spaces will not be available.");
            }
        } catch (Exception e) {
            logger.error("Failed to read download.txt: " + e.getMessage());
        }

        if (accessKey != null && !accessKey.isEmpty() && secretKey != null && !secretKey.isEmpty()) {
            BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
            s3Client = AmazonS3ClientBuilder.standard()
                    .withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(endpoint, region))
                    .withCredentials(new AWSStaticCredentialsProvider(credentials))
                    .build();
        }
    }

    private Path findDownloadTxt() {
        // Try multiple locations to find download.txt
        String[] searchPaths = {
            "../download.txt",           // relative to spring-social (project root)
            "download.txt",              // current working directory
            "../../download.txt",        // if running from deeper directory
        };

        // First try relative paths
        for (String p : searchPaths) {
            Path path = Paths.get(p).toAbsolutePath().normalize();
            if (Files.exists(path)) {
                return path;
            }
        }

        // Also try user home directory
        Path homePath = Paths.get(System.getProperty("user.home"), "Desktop", "career-nine", "download.txt");
        if (Files.exists(homePath)) {
            return homePath;
        }

        return null;
    }

    /**
     * Upload a base64-encoded file to DigitalOcean Spaces.
     *
     * @param base64Data  The base64 data URL (e.g., "data:image/webp;base64,...")
     * @param folder      The folder path within the bucket (e.g., "question-media")
     * @param fileNameHint Optional file name hint (without extension)
     * @return The public CDN URL of the uploaded file
     */
    public String uploadBase64File(String base64Data, String folder, String fileNameHint) {
        if (s3Client == null) {
            throw new IllegalStateException("DigitalOcean Spaces is not configured. Set DO_SPACES_ACCESS_KEY and DO_SPACES_SECRET_KEY.");
        }

        // Parse the data URL: "data:<contentType>;base64,<data>"
        String contentType = "application/octet-stream";
        String rawBase64 = base64Data;

        if (base64Data.startsWith("data:")) {
            int commaIdx = base64Data.indexOf(",");
            if (commaIdx > 0) {
                String meta = base64Data.substring(5, commaIdx); // e.g., "image/webp;base64"
                rawBase64 = base64Data.substring(commaIdx + 1);
                int semicolonIdx = meta.indexOf(";");
                contentType = semicolonIdx > 0 ? meta.substring(0, semicolonIdx) : meta;
            }
        }

        byte[] fileBytes = Base64.getDecoder().decode(rawBase64);

        // Generate file name
        String extension = getExtensionFromContentType(contentType);
        String fileName = (fileNameHint != null && !fileNameHint.isEmpty() ? fileNameHint : UUID.randomUUID().toString()) + extension;
        String objectKey = folder + "/" + fileName;

        // Upload to Spaces
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(contentType);
        metadata.setContentLength(fileBytes.length);

        PutObjectRequest putRequest = new PutObjectRequest(
                bucket,
                objectKey,
                new ByteArrayInputStream(fileBytes),
                metadata
        ).withCannedAcl(CannedAccessControlList.PublicRead);

        s3Client.putObject(putRequest);

        return cdnUrl + "/" + objectKey;
    }

    /**
     * Delete a file from DigitalOcean Spaces by its full URL.
     */
    public void deleteFileByUrl(String fileUrl) {
        if (s3Client == null || fileUrl == null || !fileUrl.startsWith(cdnUrl)) {
            return;
        }
        String objectKey = fileUrl.substring(cdnUrl.length() + 1);
        s3Client.deleteObject(bucket, objectKey);
    }

    private String getExtensionFromContentType(String contentType) {
        switch (contentType) {
            case "image/webp": return ".webp";
            case "image/png": return ".png";
            case "image/jpeg": return ".jpg";
            case "image/gif": return ".gif";
            case "video/mp4": return ".mp4";
            case "video/webm": return ".webm";
            case "video/ogg": return ".ogg";
            default: return "";
        }
    }
}
