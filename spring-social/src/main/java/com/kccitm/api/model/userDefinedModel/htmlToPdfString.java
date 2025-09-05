package com.kccitm.api.model.userDefinedModel;

import java.io.ByteArrayOutputStream;

import org.apache.commons.codec.binary.Base64;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.kccitm.api.model.Faculty;
import com.kccitm.api.model.Student;

public class htmlToPdfString {
  String idCardHTMLString;

  public String getIdCardHTMLString(Student stu) throws Exception {
    BitMatrix matrix = new MultiFormatWriter().encode(
        new String("http://staging.api.kccitm.in/studnet/verify/" + stu.getAadharCardNo()),
        BarcodeFormat.QR_CODE, 200, 200);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    MatrixToImageWriter.writeToStream(matrix, "PNG", out);
    byte[] bytes = out.toByteArray();

    byte[] base64bytes = Base64.encodeBase64(bytes);
    String src = "data:image/png;base64," + new String(base64bytes);

    String str = "<html><head><link rel='preconnect' href='https://fonts.googleapis.com'></link><link rel='preconnect' href='https://fonts.gstatic.com'></link><link href='https://fonts.googleapis.com/css2?family=Inter:wght@200' rel='stylesheet'></link><style>.d-flex{display: flex;}body{background-color: #fff;font-family: 'Inter', sans-serif;}.card-front,.card-back{height: 380.5px;width: 263px;padding: 4px;margin: 0 auto;background-color: rgb(126, 30, 30);border-radius: 5px;position: relative;}.card-container{height: 360px;background-color: #fff;padding: 10px;border-radius: 10px;text-align: center;box-shadow: 0 0 1.5px 0px #b9b9b9;}.card-header-right img{width: auto;height: 78px;}.card-content-row-1 img{width: 130px;margin-top: 10px;height: 152px;}.card-content-row-2-left{margin-right: 10px;}.card-content-row-2-right img{width: auto;height: 93px;}.card-content-row-1{margin: 8px 0px;}.photo img{width: 80px;margin-top: 5px;}h2{font-size: 22px;margin: 5px 0;}h3{font-size: 10px;margin: 2.5px 0;font-weight: 300;}h4{font-size: 8px;font-weight:500;margin: 2.5px 0;text-align: left;}h5{font-size: 8px;margin: 2.5px 0;font-weight: 300;text-align: left;}.span{color: rgb(126, 30, 30);}p{font-size: 6.5px;margin: 2px;}</style></head><body><div class='card-content' style='width: auto;'><table><tr><td><div class='card-front'><div class='card-container'><div class='header-card'><table><tr><td><div class='card-header-left' style='width: 173px;'><h5>Approved by</h5><h5>All India Council for Technical Education,</h5><h5>Ministry of HRD, Govt. of India</h5><h5>Affiliated to</h5><h5>Dr.A.P.J. Abdul Kalam Technical University</h5></div></td><td><div class='card-header-right'><img src='https://www.kccitm.edu.in/btech/images/kcc-logo.jpg'/></div></td></tr></table></div><div class='body-card'><div class='card-content-row-1'><img src='http://localhost:8080/util/file-get/getbyname/"
        + stu.getWebcamPhoto()
        + "'/></div><div class='card-content-row-2' style='height: 56px;'><h2 style='margin-top:10px'>"
        +
        stu.getFirstName() +
        " " +
        stu.getLastName() +
        "</h2><h3 >" +
        stu.getCourseData().getCourseName() +
        "/" +
        stu.getBranchData().getBranchName() +
        "/" +
        stu.getBatchData().getBatchStart() +
        "-" +
        stu.getBatchData().getBatchEnd() +
        "</h3><h3 style='color:rgb(126, 30, 30);'>" +
        stu.getCollegeEnrollmentNumber() +
        "</h3></div></div><div class='footer-card'><hr style='margin:8px 0px;'/><p><span class='span'>KCC ITM</span>, 2B-2C, Knowledge Park-III,</p><p>Greater Noida, Uttar Pradesh - 201306</p><p>Ph: <span class='span'>96452 00203, 96433 21662</span> | website: <span class='span'>www.kccitm.edu.in</span></p></div></div></div></td><td><div class='card-back'><div class='card-container'><div class='header-card'><table><tr><td><div class='card-header-left' style='width: 173px;'><h5>Approved by</h5><h5>All India Council for Technical Education,</h5><h5>Ministry of HRD, Govt. of India</h5><h5>Affiliated to</h5><h5>Dr.A.P.J. Abdul Kalam Technical University</h5></div></td><td><div class='card-header-right'><img src='https://www.kccitm.edu.in/btech/images/kcc-logo.jpg'/></div></td></tr></table></div><div class='body-card'><div class='card-content-row-1' style='height:125px;'><h4><span class='span'>Roll No. : </span>"
        +
        stu.getCollegeEnrollmentNumber() +
        "</h4><h4><span class='span'>Student's Ph. No. : </span>" +
        stu.getPhoneNumber() +
        "</h4><h4><span class='span'>DOB: </span>" +
        stu.getDob() +
        "</h4><h4><span class='span'>Email: </span>" +
        stu.getPersonalEmailAddress() +
        "</h4><h4><span class='span'>Father's Name: </span>" +
        stu.getFatherName() +
        "</h4><h4><span class='span'>Father's Ph. No. : </span>" +
        stu.getFatherPhoneNumber() +
        "</h4><h4><span class='span'>Address: </span>" +
        stu.getPermanentAddress() +
        "</h4></div><div class='card-content-row-2' style='height: 95px;'><table><tr><td><div class='card-content-row-2-left' style='width: 124px;'><p style='font-size: 10px;text-align: left;'>To Verify,</p><p style='font-size: 10px;text-align: left;'>Scan the QR Code :</p></div></td><td><div class='card-content-row-2-right'><img src='"
        + src
        + "'/></div></td></tr></table></div></div><div class='footer-card'><hr style='margin:8px 0px;'/><p><span class='span'>KCCITM</span>, 2B-2C, Knowledge Park-III,</p><p>Greater Noida, Uttar Pradesh - 201306</p><p>Ph: <span class='span'>96452 00203, 96433 21662</span> | website: <span class='span'>www.kccitm.edu.in</span></p></div></div></div></td></tr></table></div></body></html>";
    return str;
  }

  public String getIdCardHTMLStringFaculty(Faculty ftu) throws Exception {
    BitMatrix matrix = new MultiFormatWriter().encode(
        new String("http://staging.api.kccitm.in/studnet/verify/" + ftu.getAadharCardNo()),
        BarcodeFormat.QR_CODE, 200, 200);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    MatrixToImageWriter.writeToStream(matrix, "PNG", out);
    byte[] bytes = out.toByteArray();

    byte[] base64bytes = Base64.encodeBase64(bytes);
    String src = "data:image/png;base64," + new String(base64bytes);

    String ftr = "<html><head><link rel='preconnect' href='https://fonts.googleapis.com'></link><link rel='preconnect' href='https://fonts.gstatic.com'></link><link href='https://fonts.googleapis.com/css2?family=Inter:wght@200' rel='stylesheet'></link><style>.d-flex{display: flex;}body{background-color: #fff;font-family: 'Inter', sans-serif;}.card-front,.card-back{height: 380.5px;width: 263px;padding: 4px;margin: 0 auto;background-color: rgb(126, 30, 30);border-radius: 5px;position: relative;}.card-container{height: 360px;background-color: #fff;padding: 10px;border-radius: 10px;text-align: center;box-shadow: 0 0 1.5px 0px #b9b9b9;}.card-header-right img{width: auto;height: 78px;}.card-content-row-1 img{width: 130px;margin-top: 10px;height: 152px;}.card-content-row-2-left{margin-right: 10px;}.card-content-row-2-right img{width: auto;height: 93px;}.card-content-row-1{margin: 8px 0px;}.photo img{width: 80px;margin-top: 5px;}h2{font-size: 22px;margin: 5px 0;}h3{font-size: 10px;margin: 2.5px 0;font-weight: 300;}h4{font-size: 8px;font-weight:500;margin: 2.5px 0;text-align: left;}h5{font-size: 8px;margin: 2.5px 0;font-weight: 300;text-align: left;}.span{color: rgb(126, 30, 30);}p{font-size: 6.5px;margin: 2px;}</style></head><body><div class='card-content' style='width: auto;'><table><tr><td><div class='card-front'><div class='card-container'><div class='header-card'><table><tr><td><div class='card-header-left' style='width: 173px;'><h5>Approved by</h5><h5>All India Council for Technical Education,</h5><h5>Ministry of HRD, Govt. of India</h5><h5>Affiliated to</h5><h5>Dr.A.P.J. Abdul Kalam Technical University</h5></div></td><td><div class='card-header-right'><img src='https://www.kccitm.edu.in/btech/images/kcc-logo.jpg'/></div></td></tr></table></div><div class='body-card'><div class='card-content-row-1'><img src='http://localhost:8080/util/file-get/getbyname/"
        + ftu.getWebcamPhoto()
        + "'/></div><div class='card-content-row-2' style='height: 56px;'><h2 style='margin-top:10px'>"
        +
        ftu.getFirstName() +
        " " +
        ftu.getLastName() +
        "</h2><h3 >" +
        ftu.getDesignation() +
        "</h3><h3 >" +
        ftu.getDepartment() +
        "</h3></div></div><div class='footer-card'><hr style='margin:8px 0px;'/><p><span class='span'>KCC ITM</span>, 2B-2C, Knowledge Park-III,</p><p>Greater Noida, Uttar Pradesh - 201306</p><p>Ph: <span class='span'>96452 00203, 96433 21662</span> | website: <span class='span'>www.kccitm.edu.in</span></p></div></div></div></td><td><div class='card-back'><div class='card-container'><div class='header-card'><table><tr><td><div class='card-header-left' style='width: 173px;'><h5>Approved by</h5><h5>All India Council for Technical Education,</h5><h5>Ministry of HRD, Govt. of India</h5><h5>Affiliated to</h5><h5>Dr.A.P.J. Abdul Kalam Technical University</h5></div></td><td><div class='card-header-right'><img src='https://www.kccitm.edu.in/btech/images/kcc-logo.jpg'/></div></td></tr></table></div><div class='body-card'><div class='card-content-row-1' style='height:125px;'>"
        +
        "<h4><span class='span'>Faculty's Ph. No. : </span>" +
        ftu.getPhoneNumber() +
        "</h4><h4><span class='span'>Official Email : </span>" +
        ftu.getOfficialEmailAddress() +
        "</h4><h4><span class='span'>Father/Husband Name : </span>" +
        ftu.getFather_husband_name() +
        "</h4><h4><span class='span'>Address : </span>" +
        ftu.getPermanentAddress() +
        "</h4></div><div class='card-content-row-2' style='height: 95px;'><table><tr><td><div class='card-content-row-2-left' style='width: 124px;'><p style='font-size: 10px;text-align: left;'>To Verify,</p><p style='font-size: 10px;text-align: left;'>Scan the QR Code :</p></div></td><td><div class='card-content-row-2-right'><img src='"
        + src
        + "'/></div></td></tr></table></div></div><div class='footer-card'><hr style='margin:8px 0px;'/><p><span class='span'>KCCITM</span>, 2B-2C, Knowledge Park-III,</p><p>Greater Noida, Uttar Pradesh - 201306</p><p>Ph: <span class='span'>96452 00203, 96433 21662</span> | website: <span class='span'>www.kccitm.edu.in</span></p></div></div></div></td></tr></table></div></body></html>";
    return ftr;
  }

}
