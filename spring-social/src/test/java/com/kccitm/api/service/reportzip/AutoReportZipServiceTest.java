package com.kccitm.api.service.reportzip;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** The folder layout schools see: class/section labels and safe file names. */
class AutoReportZipServiceTest {

    @Test
    void numericAndPrefixedClassesShareOneFolder() {
        assertEquals("Class 9", AutoReportZipService.classLabel("9", null));
        assertEquals("Class 9", AutoReportZipService.classLabel("Class 9", null));
        assertEquals("Class 10", AutoReportZipService.classLabel("grade 10", null));
        assertEquals("Class 8", AutoReportZipService.classLabel(null, " 8th "));
    }

    @Test
    void sectionHierarchyWinsOverFlatStudentClass() {
        assertEquals("Class 11", AutoReportZipService.classLabel("11", "Class 12"));
        assertEquals("Class 12", AutoReportZipService.classLabel("  ", "12"));
        assertEquals("Class not set", AutoReportZipService.classLabel(null, null));
        assertEquals("Nursery", AutoReportZipService.classLabel("Nursery", null));
    }

    @Test
    void sectionLabels() {
        assertEquals("Section A", AutoReportZipService.sectionLabel("A"));
        assertEquals("Section SHRESHTHA C", AutoReportZipService.sectionLabel(" SHRESHTHA C "));
        assertEquals("Section B", AutoReportZipService.sectionLabel("Section B"));
        assertEquals("No Section", AutoReportZipService.sectionLabel(null));
        assertEquals("No Section", AutoReportZipService.sectionLabel("unknown section"));
    }

    @Test
    void classesSortNumericallyThenAlphabetically() {
        List<String> labels = new ArrayList<>(Arrays.asList(
                "Class not set", "Class 10", "Nursery", "Class 9", "Class 12", "Class 6"));
        labels.sort(AutoReportZipService.CLASS_ORDER);
        assertEquals(Arrays.asList("Class 6", "Class 9", "Class 10", "Class 12", "Class not set", "Nursery"), labels);
    }

    @Test
    void segmentsAreSafeOnEveryOs() {
        assertEquals("A_B_C", AutoReportZipService.segment("A/B\\C"));
        assertEquals("Riya Sharma", AutoReportZipService.segment("  Riya   Sharma. "));
        assertEquals("Unnamed", AutoReportZipService.segment("..."));
        assertEquals("Ünal Çelik", AutoReportZipService.segment("Ünal Çelik"));
        assertEquals(100, AutoReportZipService.segment("x".repeat(250)).length());
    }
}
