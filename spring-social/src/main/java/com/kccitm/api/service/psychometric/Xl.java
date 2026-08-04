package com.kccitm.api.service.psychometric;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;

/**
 * Small 1-based cell-writing helpers for filling the psychometric template.
 * Writing into an existing template cell keeps that cell's style; NaN and null
 * blank the cell so stale template values never survive a smaller cohort.
 */
final class Xl {

    private Xl() {
    }

    /** Template sheet lookup tolerant of the em-dash titles ("CFA — ..."). */
    static Sheet sheet(Workbook wb, String titlePart) {
        String want = norm(titlePart);
        for (int i = 0; i < wb.getNumberOfSheets(); i++) {
            if (norm(wb.getSheetName(i)).contains(want)) {
                return wb.getSheetAt(i);
            }
        }
        throw new IllegalStateException("Psychometric template is missing sheet: " + titlePart);
    }

    private static String norm(String s) {
        return s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    static Cell cell(Sheet sheet, int row1, int col1) {
        Row row = sheet.getRow(row1 - 1);
        if (row == null) row = sheet.createRow(row1 - 1);
        Cell cell = row.getCell(col1 - 1);
        if (cell == null) cell = row.createCell(col1 - 1);
        return cell;
    }

    static void text(Sheet sheet, int row1, int col1, String value) {
        Cell c = cell(sheet, row1, col1);
        // The template's cells are inline strings (openpyxl re-save); setting a
        // value without blanking first leaves the old inline text or a stale
        // formula in the serialized XML, and readers then see the old content.
        c.setBlank();
        c.setCellValue(value != null ? value : "");
    }

    static void num(Sheet sheet, int row1, int col1, double value, int places) {
        Cell c = cell(sheet, row1, col1);
        c.setBlank();
        if (!Double.isNaN(value) && !Double.isInfinite(value)) {
            c.setCellValue(PsychometricStats.round(value, places));
        }
    }

    static void num(Sheet sheet, int row1, int col1, Integer value) {
        Cell c = cell(sheet, row1, col1);
        c.setBlank();
        if (value != null) {
            c.setCellValue(value);
        }
    }

    static void blank(Sheet sheet, int row1, int col1) {
        cell(sheet, row1, col1).setBlank();
    }
}
