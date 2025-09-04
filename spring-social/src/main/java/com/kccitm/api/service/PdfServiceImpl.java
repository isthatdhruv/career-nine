package com.kccitm.api.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;

import org.apache.commons.io.IOUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.xhtmlrenderer.pdf.ITextRenderer;

import com.kccitm.api.model.Faculty;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.userDefinedModel.FileDataModal;
import com.kccitm.api.model.userDefinedModel.htmlToPdfString;

@Service
public class PdfServiceImpl implements PdfService {
  @Autowired
  StudentService studentService;

  @Autowired
  GoogleCloudAPI googleCloudApi;

  @Override
  public ByteArrayInputStream convertHtmlToPdf(String htmlContent) {
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    ITextRenderer renderer = new ITextRenderer();

    renderer.setDocumentFromString(htmlContent);
    renderer.layout();
    renderer.createPDF(outputStream, false);
    renderer.finishPDF();
    ByteArrayInputStream inputStream = new ByteArrayInputStream(
        outputStream.toByteArray());
    return inputStream;
  }

  @Override
  public ByteArrayInputStream genrateIdCardStudent(Student stu)
      throws FileNotFoundException, IOException {
    ByteArrayInputStream inputStream = null;
    try {

      inputStream = convertHtmlToPdf(new htmlToPdfString().getIdCardHTMLString(stu));
      // IOUtils.copy(
      // inputStream,
      // new FileOutputStream(stu.getCollegeEnrollmentNumber() + ".pdf"));

      FileDataModal fbm = new FileDataModal();
      fbm.setData(IOUtils.toByteArray(inputStream));
      fbm.setFileName(
          stu.getCollegeEnrollmentNumber() + "-" + stu.getFirstName().replaceAll("[^a-zA-Z0-9]", "") + "_" +
              stu.getLastName().replaceAll("[^a-zA-Z0-9]", "") + "_" + "STUDENT_ID");
      fbm.setType("application/pdf");
      googleCloudApi.uploadFileToCloudByteArray(fbm);

      return inputStream;
    } catch (Exception e) {
      // TODO Auto-generated catch block

      e.printStackTrace();
      return inputStream;
    }

  }

  @Override
  public ByteArrayInputStream genrateIdCardFaculty(Faculty ftu)
      throws FileNotFoundException, IOException {
    ByteArrayInputStream inputStream = null;
    try {

      inputStream = convertHtmlToPdf(new htmlToPdfString().getIdCardHTMLStringFaculty(ftu));
      // IOUtils.copy(
      // inputStream,
      // new FileOutputStream(ftu.getCollegeEnrollmentNumber() + ".pdf"));

      FileDataModal fbm = new FileDataModal();
      fbm.setData(IOUtils.toByteArray(inputStream));
      fbm.setFileName(
          ftu.getCollegeIdentificationNumber() + "-" + ftu.getFirstName().replaceAll("[^a-zA-Z0-9]", "") + "_" +
              ftu.getLastName().replaceAll("[^a-zA-Z0-9]", "") + "_" + "FACULTY_ID");
      fbm.setType("application/pdf");
      googleCloudApi.uploadFileToCloudByteArray(fbm);

      return inputStream;
    } catch (Exception e) {
      // TODO Auto-generated catch block

      e.printStackTrace();
      return inputStream;
    }

  }

}
