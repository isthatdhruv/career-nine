package com.kccitm.api.service;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;

import com.kccitm.api.model.Faculty;
import com.kccitm.api.model.Student;


public interface PdfService {
    ByteArrayInputStream convertHtmlToPdf(String htmlContent)throws Exception;
    ByteArrayInputStream genrateIdCardStudent(Student stu) throws FileNotFoundException, IOException;
    ByteArrayInputStream genrateIdCardFaculty(Faculty ftu) throws FileNotFoundException, IOException;
}