package com.kccitm.api.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class GradeParserTest {

    @Test
    void plainNumbersParse() {
        assertEquals(9, GradeParser.numericGradeOrNull("9"));
        assertEquals(12, GradeParser.numericGradeOrNull(" 12 "));
    }

    @Test
    void formattedSchoolLabelsExtractTheNumber() {
        assertEquals(10, GradeParser.numericGradeOrNull("10-A"));
        assertEquals(9, GradeParser.numericGradeOrNull("Class 9"));
        assertEquals(11, GradeParser.numericGradeOrNull("Grade 11 (Science)"));
    }

    @Test
    void romanNumeralsParse() {
        assertEquals(12, GradeParser.numericGradeOrNull("XII"));
        assertEquals(9, GradeParser.numericGradeOrNull("ix"));
        assertEquals(10, GradeParser.numericGradeOrNull("Class X"));
    }

    @Test
    void collegeLabelsWithoutNumbersReturnNull() {
        assertNull(GradeParser.numericGradeOrNull("B.Tech CSE"));
        assertNull(GradeParser.numericGradeOrNull(""));
        assertNull(GradeParser.numericGradeOrNull("   "));
        assertNull(GradeParser.numericGradeOrNull(null));
    }

    @Test
    void yearLabelsExtractTheYearNumber() {
        assertEquals(1, GradeParser.numericGradeOrNull("1st Year"));
        assertEquals(2, GradeParser.numericGradeOrNull("2nd Year"));
    }

    @Test
    void comparatorOrdersNumericallyThenAlphabetically() {
        List<String> labels = Arrays.asList("BBA", "10", "9", "B.Tech", "11-A", "1st Year");
        labels.sort(GradeParser.classLabelComparator());
        assertEquals(Arrays.asList("1st Year", "9", "10", "11-A", "B.Tech", "BBA"), labels);
    }
}
