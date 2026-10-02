package com.kccitm.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** ZIP download links go out on the edge CDN; everything else keeps its URL. */
class SpacesEdgeUrlTest {

    private static DigitalOceanSpacesService spaces(String edgeUrl) {
        DigitalOceanSpacesService s = new DigitalOceanSpacesService();
        ReflectionTestUtils.setField(s, "bucket", "storage-c9");
        ReflectionTestUtils.setField(s, "region", "sgp1");
        ReflectionTestUtils.setField(s, "cdnUrl", "https://storage-c9.sgp1.digitaloceanspaces.com");
        ReflectionTestUtils.setField(s, "edgeUrl", edgeUrl);
        s.init(); // no keys → no S3 client; derives the edge URL when blank
        return s;
    }

    @Test
    void ownUrlMovesToTheDerivedEdgeHost() {
        assertEquals("https://storage-c9.sgp1.cdn.digitaloceanspaces.com/report-zips/auto/1_a.zip",
                spaces("").toEdgeUrl("https://storage-c9.sgp1.digitaloceanspaces.com/report-zips/auto/1_a.zip"));
    }

    @Test
    void configuredEdgeHostWins() {
        assertEquals("https://files.example.com/report-zips/x.zip",
                spaces("https://files.example.com").toEdgeUrl("https://storage-c9.sgp1.digitaloceanspaces.com/report-zips/x.zip"));
    }

    @Test
    void foreignAndNullUrlsPassThrough() {
        DigitalOceanSpacesService s = spaces(null);
        assertEquals("https://elsewhere.example/x.zip", s.toEdgeUrl("https://elsewhere.example/x.zip"));
        assertEquals(null, s.toEdgeUrl(null));
    }
}
