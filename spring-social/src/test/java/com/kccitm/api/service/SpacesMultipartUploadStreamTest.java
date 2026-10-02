package com.kccitm.api.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.AbortMultipartUploadRequest;
import com.amazonaws.services.s3.model.CompleteMultipartUploadRequest;
import com.amazonaws.services.s3.model.InitiateMultipartUploadRequest;
import com.amazonaws.services.s3.model.InitiateMultipartUploadResult;
import com.amazonaws.services.s3.model.UploadPartRequest;
import com.amazonaws.services.s3.model.UploadPartResult;

/**
 * The auto report ZIP streams into Spaces through
 * {@link DigitalOceanSpacesService.MultipartUploadStream}; this checks the
 * parts it sends reassemble into the exact bytes written — a valid ZIP —
 * against a mocked S3 client.
 */
class SpacesMultipartUploadStreamTest {

    private static final int MB = 1024 * 1024;

    private DigitalOceanSpacesService spaces;
    private AmazonS3 s3;
    /** Part number → bytes, copied out at upload time (the stream reuses its buffer). */
    private final Map<Integer, byte[]> parts = new HashMap<>();

    @BeforeEach
    void setUp() {
        spaces = new DigitalOceanSpacesService();
        s3 = mock(AmazonS3.class);
        ReflectionTestUtils.setField(spaces, "s3Client", s3);
        ReflectionTestUtils.setField(spaces, "bucket", "bucket");
        ReflectionTestUtils.setField(spaces, "cdnUrl", "https://cdn.example");

        InitiateMultipartUploadResult init = new InitiateMultipartUploadResult();
        init.setUploadId("up-1");
        when(s3.initiateMultipartUpload(any(InitiateMultipartUploadRequest.class))).thenReturn(init);
        when(s3.uploadPart(any(UploadPartRequest.class))).thenAnswer(inv -> {
            UploadPartRequest req = inv.getArgument(0);
            byte[] bytes = req.getInputStream().readAllBytes();
            assertEquals(req.getPartSize(), bytes.length);
            parts.put(req.getPartNumber(), bytes);
            UploadPartResult res = new UploadPartResult();
            res.setPartNumber(req.getPartNumber());
            res.setETag("etag-" + req.getPartNumber());
            return res;
        });
    }

    private byte[] reassembled() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int i = 1; i <= parts.size(); i++) out.writeBytes(parts.get(i));
        return out.toByteArray();
    }

    @Test
    void splitsIntoSixteenMegabytePartsAndCompletes() throws IOException {
        byte[] data = new byte[40 * MB + 123];
        new Random(7).nextBytes(data);

        DigitalOceanSpacesService.MultipartUploadStream out =
                spaces.openMultipartUpload("report-zips/auto", "x.zip", "application/zip");
        // Odd chunk sizes, so part boundaries fall mid-write.
        for (int off = 0; off < data.length; off += 777_777) {
            out.write(data, off, Math.min(777_777, data.length - off));
        }
        out.close();

        assertEquals(3, parts.size());
        assertEquals(16 * MB, parts.get(1).length);
        assertEquals(16 * MB, parts.get(2).length);
        assertArrayEquals(data, reassembled());
        assertEquals("https://cdn.example/report-zips/auto/x.zip", out.getPublicUrl());

        ArgumentCaptor<CompleteMultipartUploadRequest> done = ArgumentCaptor.forClass(CompleteMultipartUploadRequest.class);
        verify(s3).completeMultipartUpload(done.capture());
        assertEquals(3, done.getValue().getPartETags().size());
        verify(s3, never()).abortMultipartUpload(any());
    }

    @Test
    void zipWrittenThroughTheStreamReadsBack() throws IOException {
        DigitalOceanSpacesService.MultipartUploadStream out =
                spaces.openMultipartUpload("report-zips/auto", "school.zip", "application/zip");
        ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8);
        byte[] pdf = new byte[3 * MB];
        new Random(1).nextBytes(pdf);
        List<String> names = new ArrayList<>();
        for (int i = 0; i < 12; i++) { // ~36 MB → three parts
            String name = "Class 9/Section A/Ünal " + i + ".pdf";
            names.add(name);
            zip.putNextEntry(new ZipEntry(name));
            zip.write(pdf);
            zip.closeEntry();
        }
        zip.finish();
        out.close();

        List<String> read = new ArrayList<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(reassembled()), StandardCharsets.UTF_8)) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) {
                read.add(e.getName());
                assertArrayEquals(pdf, in.readAllBytes());
            }
        }
        assertEquals(names, read);
    }

    @Test
    void abortDiscardsTheUploadAndCloseIsThenANoOp() throws IOException {
        DigitalOceanSpacesService.MultipartUploadStream out =
                spaces.openMultipartUpload("report-zips/auto", "x.zip", "application/zip");
        out.write(new byte[20 * MB]);
        out.abort();
        out.close();

        verify(s3).abortMultipartUpload(any(AbortMultipartUploadRequest.class));
        verify(s3, never()).completeMultipartUpload(any());
    }

    @Test
    void emptyUploadIsAbortedNotCompleted() {
        DigitalOceanSpacesService.MultipartUploadStream out =
                spaces.openMultipartUpload("report-zips/auto", "x.zip", "application/zip");
        assertThrows(IOException.class, out::close);
        verify(s3).abortMultipartUpload(any(AbortMultipartUploadRequest.class));
        verify(s3, never()).completeMultipartUpload(any());
    }
}
