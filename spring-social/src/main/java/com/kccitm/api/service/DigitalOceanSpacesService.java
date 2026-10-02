package com.kccitm.api.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Base64;
import java.util.UUID;

import com.amazonaws.services.s3.model.S3Object;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.amazonaws.HttpMethod;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.AbortMultipartUploadRequest;
import com.amazonaws.services.s3.model.BucketCrossOriginConfiguration;
import com.amazonaws.services.s3.model.CORSRule;
import com.amazonaws.services.s3.model.CannedAccessControlList;
import com.amazonaws.services.s3.model.CompleteMultipartUploadRequest;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.InitiateMultipartUploadRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PartETag;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.amazonaws.services.s3.model.UploadPartRequest;

@Service
public class DigitalOceanSpacesService {

    private static final Logger logger = LoggerFactory.getLogger(DigitalOceanSpacesService.class);

    @Value("${app.digitalocean.spaces.bucket:storage-c9}")
    private String bucket;

    @Value("${app.digitalocean.spaces.region:${DO_SPACES_REGION:sgp1}}")
    private String region;

    @Value("${app.digitalocean.spaces.cdn-url:${DO_SPACES_CDN_URL:https://storage-c9.sgp1.digitaloceanspaces.com}}")
    private String cdnUrl;

    /**
     * The bucket's edge CDN (Cloudflare) host, for links people download big
     * files from. {@link #cdnUrl} is, despite its name, the Singapore origin —
     * every stored URL and key lookup is built on it, so it stays as is; this
     * one only rewrites download links. Blank derives it from bucket + region.
     */
    @Value("${app.digitalocean.spaces.edge-url:${DO_SPACES_EDGE_URL:}}")
    private String edgeUrl;

    @Value("${app.digitalocean.spaces.access-key:${DO_SPACES_ACCESS_KEY:}}")
    private String accessKey;

    @Value("${app.digitalocean.spaces.secret-key:${DO_SPACES_SECRET_KEY:}}")
    private String secretKey;

    @Value("${app.digitalocean.spaces.endpoint:${DO_SPACES_ENDPOINT:https://sgp1.digitaloceanspaces.com}}")
    private String endpoint;

    @Value("${app.cors.allowedOrigins:}")
    private String[] allowedOrigins;

    private AmazonS3 s3Client;

    @PostConstruct
    public void init() {
        logger.info("========== DigitalOcean Spaces Configuration ==========");
        logger.info("  Bucket:     {}", bucket);
        logger.info("  Region:     {}", region);
        logger.info("  Endpoint:   {}", endpoint);
        if (edgeUrl == null || edgeUrl.isBlank()) {
            edgeUrl = "https://" + bucket + "." + region + ".cdn.digitaloceanspaces.com";
        }
        logger.info("  CDN URL:    {}", cdnUrl);
        logger.info("  Edge URL:   {}", edgeUrl);
        logger.info("  Access Key: {}", accessKey != null && accessKey.length() > 4
                ? accessKey.substring(0, 4) + "****" : "(not set)");
        logger.info("  Secret Key: {}", secretKey != null && !secretKey.isEmpty() ? "****configured****" : "(not set)");

        if (accessKey != null && !accessKey.isEmpty() && secretKey != null && !secretKey.isEmpty()) {
            BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
            s3Client = AmazonS3ClientBuilder.standard()
                    .withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(endpoint, region))
                    .withCredentials(new AWSStaticCredentialsProvider(credentials))
                    .build();
            logger.info("  Status:     READY");
            applyBucketCors();
        } else {
            logger.warn("  Status:     NOT CONFIGURED - Set DO_SPACES_ACCESS_KEY and DO_SPACES_SECRET_KEY");
        }
        logger.info("=======================================================");
    }

    /**
     * Push a CORS policy to the Spaces bucket so the browser's pre-signed PUT
     * (used for bulk report-zip uploads) passes its preflight OPTIONS check.
     * Mirrors the server-side CORS allow-list from app.cors.allowedOrigins.
     * Failures are non-fatal — if the access key can't set bucket CORS, the
     * app still boots and the policy can be applied manually in the DO console.
     */
    private void applyBucketCors() {
        try {
            applyBucketCorsOrThrow();
            logger.info("  CORS:       applied to bucket {} ({} origins)", bucket,
                    allowedOrigins == null ? 0 : allowedOrigins.length);
        } catch (Exception e) {
            logger.warn("  CORS:       failed to apply ({}) — set manually in DO console if needed",
                    e.getMessage());
        }
    }

    /**
     * Same as {@link #applyBucketCors()} but surfaces the exception so the
     * admin endpoint can report real errors back to the caller instead of
     * swallowing them.
     */
    public java.util.List<String> applyBucketCorsOrThrow() {
        if (s3Client == null) {
            throw new IllegalStateException("DigitalOcean Spaces is not configured.");
        }
        java.util.List<String> origins = new java.util.ArrayList<>();
        if (allowedOrigins != null) {
            for (String o : allowedOrigins) {
                if (o != null && !o.isBlank()) origins.add(o.trim());
            }
        }
        if (origins.isEmpty()) {
            throw new IllegalStateException("No allowed origins configured (app.cors.allowedOrigins).");
        }
        CORSRule rule = new CORSRule()
                .withAllowedOrigins(origins)
                .withAllowedMethods(java.util.Arrays.asList(
                        CORSRule.AllowedMethods.GET,
                        CORSRule.AllowedMethods.PUT,
                        CORSRule.AllowedMethods.POST,
                        CORSRule.AllowedMethods.HEAD))
                .withAllowedHeaders(java.util.Collections.singletonList("*"))
                .withExposedHeaders(java.util.Arrays.asList("ETag"))
                .withMaxAgeSeconds(3600);
        BucketCrossOriginConfiguration config = new BucketCrossOriginConfiguration()
                .withRules(java.util.Collections.singletonList(rule));
        s3Client.setBucketCrossOriginConfiguration(bucket, config);
        return origins;
    }

    /**
     * Read the current CORS rules from the bucket so the admin endpoint can
     * confirm what is (or isn't) actually stored server-side.
     */
    public java.util.List<CORSRule> getBucketCorsRules() {
        if (s3Client == null) {
            throw new IllegalStateException("DigitalOcean Spaces is not configured.");
        }
        BucketCrossOriginConfiguration config = s3Client.getBucketCrossOriginConfiguration(bucket);
        if (config == null || config.getRules() == null) return java.util.Collections.emptyList();
        return config.getRules();
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
     * Upload raw bytes to DigitalOcean Spaces.
     *
     * @param fileBytes   The file content as bytes
     * @param contentType The MIME type (e.g., "text/html")
     * @param folder      The folder path within the bucket
     * @param fileName    The file name (with extension)
     * @return The public CDN URL of the uploaded file
     */
    public String uploadBytes(byte[] fileBytes, String contentType, String folder, String fileName) {
        if (s3Client == null) {
            throw new IllegalStateException("DigitalOcean Spaces is not configured.");
        }

        String objectKey = folder + "/" + fileName;

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
     * True when the URL points into our own Spaces bucket/CDN. Callers that
     * proxy downloads for the browser MUST check this first — the HTTP
     * fallback in {@link #downloadFileByUrl} would otherwise fetch arbitrary
     * URLs (SSRF).
     */
    public boolean isOwnSpacesUrl(String fileUrl) {
        return fileUrl != null && cdnUrl != null && !cdnUrl.isEmpty()
                && fileUrl.startsWith(cdnUrl + "/");
    }

    /**
     * Download a file from DigitalOcean Spaces by its full URL.
     * Returns the file bytes, or null if not found.
     */
    public byte[] downloadFileByUrl(String fileUrl) {
        if (fileUrl == null) {
            return null;
        }
        // Preferred: authenticated S3 fetch (also works for private objects) when
        // the URL lives in our bucket.
        if (s3Client != null && fileUrl.startsWith(cdnUrl)) {
            String objectKey = fileUrl.substring(cdnUrl.length() + 1);
            try {
                S3Object s3Object = s3Client.getObject(bucket, objectKey);
                try (InputStream is = s3Object.getObjectContent()) {
                    return is.readAllBytes();
                }
            } catch (Exception e) {
                logger.warn("S3 getObject failed for {} ({}); falling back to public HTTP GET",
                        fileUrl, e.getMessage());
            }
        }
        // Fallback: plain public HTTP GET. Templates and rendered reports are
        // uploaded public-read, so this succeeds even when the S3 client has a
        // credential/endpoint mismatch.
        return downloadViaHttp(fileUrl);
    }

    /**
     * The edge-CDN twin of one of our Spaces URLs, for download links. From
     * India the origin crawls at 1–2 MB/s over one long-haul connection while
     * the edge serves several times faster. Only the link changes — delete and
     * server-side reads keep using the origin URL. Foreign URLs pass through.
     */
    public String toEdgeUrl(String fileUrl) {
        return isOwnSpacesUrl(fileUrl) && edgeUrl != null && !edgeUrl.isBlank()
                ? edgeUrl + fileUrl.substring(cdnUrl.length())
                : fileUrl;
    }

    /**
     * Read one of OUR OWN Spaces objects fully, for server-side bundling (the
     * auto report ZIP). Same S3-then-public-HTTP order as
     * {@link #downloadFileByUrl}, but refuses foreign URLs so a bad row in the
     * database can never turn the bundler into an open fetcher.
     */
    public byte[] downloadOwnFile(String fileUrl) {
        return isOwnSpacesUrl(fileUrl) ? downloadFileByUrl(fileUrl) : null;
    }

    private byte[] downloadViaHttp(String fileUrl) {
        try {
            java.net.HttpURLConnection conn =
                    (java.net.HttpURLConnection) java.net.URI.create(fileUrl).toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(20000);
            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) {
                try (InputStream is = conn.getInputStream()) {
                    return is.readAllBytes();
                }
            }
            logger.warn("Public HTTP GET for {} returned status {}", fileUrl, status);
            return null;
        } catch (Exception e) {
            logger.error("Failed to download file from Spaces (S3 + HTTP): {}", fileUrl, e);
            return null;
        }
    }

    /**
     * Generate a pre-signed PUT URL so the browser can upload directly to Spaces,
     * bypassing nginx/Spring for large payloads (bulk report zips).
     *
     * The client MUST send a matching Content-Type and x-amz-acl: public-read
     * header when PUTting, or the signature will not validate.
     */
    public PresignedUpload generatePresignedUpload(String folder, String fileName, String contentType,
            int expiryMinutes) {
        if (s3Client == null) {
            throw new IllegalStateException("DigitalOcean Spaces is not configured.");
        }
        String objectKey = folder + "/" + fileName;
        java.util.Date expiration = new java.util.Date(System.currentTimeMillis() + expiryMinutes * 60_000L);

        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucket, objectKey, HttpMethod.PUT)
                .withExpiration(expiration);
        if (contentType != null && !contentType.isEmpty()) {
            req.setContentType(contentType);
        }
        req.putCustomRequestHeader("x-amz-acl", "public-read");

        String uploadUrl = s3Client.generatePresignedUrl(req).toString();
        return new PresignedUpload(uploadUrl, cdnUrl + "/" + objectKey, objectKey);
    }

    public static class PresignedUpload {
        public final String uploadUrl;
        public final String publicUrl;
        public final String key;

        public PresignedUpload(String uploadUrl, String publicUrl, String key) {
            this.uploadUrl = uploadUrl;
            this.publicUrl = publicUrl;
            this.key = key;
        }
    }

    /**
     * Start a public-read object of unknown length, written as a stream. Bytes
     * go up as S3 multipart parts while they are written, so a multi-GB ZIP
     * never has to sit in heap or on local disk. The caller must either
     * {@code close()} the stream (completes the object) or {@code abort()} it
     * (discards the parts) — an abandoned upload keeps billing storage.
     */
    public MultipartUploadStream openMultipartUpload(String folder, String fileName, String contentType) {
        if (s3Client == null) {
            throw new IllegalStateException("DigitalOcean Spaces is not configured.");
        }
        String objectKey = folder + "/" + fileName;
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(contentType);
        InitiateMultipartUploadRequest init = new InitiateMultipartUploadRequest(bucket, objectKey, metadata)
                .withCannedACL(CannedAccessControlList.PublicRead);
        String uploadId = s3Client.initiateMultipartUpload(init).getUploadId();
        return new MultipartUploadStream(objectKey, uploadId);
    }

    /**
     * OutputStream over one S3 multipart upload. Buffers a single part at a
     * time (16 MB — Spaces' minimum is 5 MB for every part but the last), so
     * memory stays flat however large the object grows.
     */
    public class MultipartUploadStream extends OutputStream {
        private static final int PART_SIZE = 16 * 1024 * 1024;

        private final String objectKey;
        private final String uploadId;
        private final byte[] buffer = new byte[PART_SIZE];
        private final java.util.List<PartETag> partETags = new java.util.ArrayList<>();
        private int buffered = 0;
        private long bytesWritten = 0;
        private boolean finished = false;

        private MultipartUploadStream(String objectKey, String uploadId) {
            this.objectKey = objectKey;
            this.uploadId = uploadId;
        }

        public String getPublicUrl() { return cdnUrl + "/" + objectKey; }

        public long getBytesWritten() { return bytesWritten; }

        @Override
        public void write(int b) throws IOException {
            if (buffered == PART_SIZE) uploadPart();
            buffer[buffered++] = (byte) b;
            bytesWritten++;
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            while (len > 0) {
                if (buffered == PART_SIZE) uploadPart();
                int n = Math.min(len, PART_SIZE - buffered);
                System.arraycopy(b, off, buffer, buffered, n);
                buffered += n;
                off += n;
                len -= n;
                bytesWritten += n;
            }
        }

        private void uploadPart() throws IOException {
            if (buffered == 0) return;
            try {
                UploadPartRequest req = new UploadPartRequest()
                        .withBucketName(bucket)
                        .withKey(objectKey)
                        .withUploadId(uploadId)
                        .withPartNumber(partETags.size() + 1)
                        .withInputStream(new ByteArrayInputStream(buffer, 0, buffered))
                        .withPartSize(buffered);
                partETags.add(s3Client.uploadPart(req).getPartETag());
                buffered = 0;
            } catch (RuntimeException e) {
                throw new IOException("Spaces part upload failed: " + e.getMessage(), e);
            }
        }

        /** Upload the last part and stitch the object together. */
        @Override
        public void close() throws IOException {
            if (finished) return;
            if (bytesWritten == 0) {
                abort();
                throw new IOException("Nothing was written to " + objectKey);
            }
            try {
                uploadPart();
                s3Client.completeMultipartUpload(
                        new CompleteMultipartUploadRequest(bucket, objectKey, uploadId, partETags));
                finished = true;
            } catch (IOException | RuntimeException e) {
                abort();
                throw e instanceof IOException ? (IOException) e : new IOException(e.getMessage(), e);
            }
        }

        /** Throw away every uploaded part. Safe to call more than once. */
        public void abort() {
            if (finished) return;
            finished = true;
            try {
                s3Client.abortMultipartUpload(new AbortMultipartUploadRequest(bucket, objectKey, uploadId));
            } catch (Exception e) {
                logger.warn("Failed to abort multipart upload {} ({}): {}", objectKey, uploadId, e.getMessage());
            }
        }
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
