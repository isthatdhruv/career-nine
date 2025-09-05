package com.kccitm.api.service;

import java.io.IOException;
import java.net.MalformedURLException;

import com.itextpdf.text.DocumentException;

public interface StudentPdfService {
    public void genrerateStudentIDPDF(long id) throws DocumentException, MalformedURLException, IOException;
}
