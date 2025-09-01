package com.kccitm.api.service;

import java.io.IOException;
import java.text.ParseException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.kccitm.api.model.CheckFacultyRegistrationField;
import com.kccitm.api.model.User;
import com.kccitm.api.model.Faculty;
import com.kccitm.api.repository.CheckFacultyRegistrationFieldRepository;
import com.kccitm.api.repository.FacultyRepository;
import com.kccitm.api.security.UserPrincipal;
import com.microtripit.mandrillapp.lutung.model.MandrillApiError;

@Service
public class FacultyService {

  @Value("${app.protocol}")
  private String protocol;

  @Value("${app.name}")
  private String site_name;

  @Autowired
  private FacultyRepository facultyRepository;

  @Autowired
  private CheckFacultyRegistrationFieldRepository checkRegistrationFeildRepository;

  @Autowired
  private EmailService emailService;
  @Autowired
  private GoogleAPIAdmin gpa;

  public List<Faculty> getAllFaculties() {
    List<Faculty> allFaculties = facultyRepository.findAll();
    return allFaculties;
  }

  // public Optional<Faculty> getFacultyById(@PathVariable("id") int facultyId) {
  // Optional<Faculty> faculty = facultyRepository.findById(facultyId);
  // return faculty;
  // }

  public void sendCorrectionMail(CheckFacultyRegistrationField crf) {
    ArrayList<String> fr = crf.getMissingFeilds();
  }

  public String getEmail() {
    List<Faculty> allFaculties = facultyRepository.findAll();
    // String st = allFaculties.get(2).getOfficialemailid();
    String ft = "";
    return ft;
  }

  public String getOfficialemailid(Faculty ftu) {
    var lname = !(ftu.getLastName() == null) ? (ftu.getLastName() +
        "").toLowerCase().trim() : "";
    var dob = !(ftu.getDob() == null)
        ? (ftu.getDob().split("-").length > 1 ? ftu.getDob().split("-")[2] + ftu.getDob().split("-")[1]
            : ftu.getDob().split("-")[2])
        : "";
    var fname = !(ftu.getFirstName() == null) ? ftu.getFirstName().toLowerCase().trim() : "";
    var email = fname +"."+
        lname +"."+
        dob
        + "@kccitm.edu.in";

    return email;
  }

  public String updateEmail(@RequestBody Map<String, Faculty> currentFaculty)
      throws ParseException {
    Faculty r = currentFaculty.get("values");

    LocalDate dob = LocalDate.parse(r.getDob());
    int month = dob.getMonthValue();
    int day = dob.getDayOfMonth();
    var t = month + "" + day;
    // var b = r.getInstituteBranch() != null
    // ? r
    // .getInstituteBranch()
    // .getAbbreviation()
    // .replaceAll("[^a-zA-Z0-9]", "")
    // .toLowerCase()
    // : "stupid";
    String email = r.getFirstName() +
        r.getLastName().charAt(0) +
        t +
        // r.getCourse() +
        // b +
        // r.getInstituteBatch().getBatchEnd() +
        "@kccitm.edu.in";
    r.setOfficialEmailAddress(email);
    facultyRepository.save(r);
    return email;
  }

  // public ArrayList<String> getAllGroupEmailIds(
  // int batch,
  // int branch,
  // int course) {
  // InstituteBatch ses = batchRepository.getById(batch);
  // String batchEndYear = ses
  // .getBatchEnd()
  // .replaceAll("[^a-zA-Z0-9]", "")
  // .toLowerCase();
  // InstituteBranch brn = branchRepository.getById(branch);
  // String branchName = brn
  // .getAbbreviation()
  // .replaceAll("[^a-zA-Z0-9]", "")
  // .toLowerCase();
  // InstituteCourse ice = instituteCourseRepository.getById(course);
  // String cour = ice
  // .getAbbreviation()
  // .replaceAll("[^a-zA-Z0-9]", "")
  // .toLowerCase();
  // ArrayList<String> groupsEmail = new ArrayList<>();

  // // btech2021
  // groupsEmail.add(cour + batchEndYear + "@kccitm.edu.in");

  // // cse2021
  // groupsEmail.add(branchName + batchEndYear + "@kccitm.edu.in");

  // // btechcse2021
  // groupsEmail.add(cour + branchName + batchEndYear + "@kccitm.edu.in");

  // return groupsEmail;
  // }

  // public Faculty setBatchBranchCourse(Faculty stu) {
  // InstituteBatch ses = batchRepository.getById(stu.getBatch_id());
  // stu.setBatchData(ses);
  // InstituteBranch brn = branchRepository.getById(stu.getBranch_id());
  // stu.setBranchData(brn);
  // InstituteCourse ice = instituteCourseRepository.getById(stu.getCourse());
  // stu.setCourseData(ice);
  // return stu;
  // }

  public boolean initalRegistration(Faculty r) throws RequestFailedException {
    try {

      Faculty t = facultyRepository.save(r);
      r.getCheck().setFaculty_id(t.getCollegeIdentificationNumber());
      checkRegistrationFeildRepository.save(r.getCheck());

      Map<String, Object> content = new HashMap<>();
      content.put("faculty_name", r.getFirstName() + " " + r.getLastName());

      emailService.sendMessageUsingTemplates(
          "KCCITM Registration Form Update",
          new User(r),
          "KCCITM Registrar",
          "noreply@kccitm.email",
          "faculty-registration-confirmation",
          content);

      return true;
    } catch (Exception e) {
      System.out.println(e);
      return false;
    }
  }

  public boolean registrarVerification(Faculty r, UserPrincipal userPrincipal)
      throws RequestFailedException {
    try {
      facultyRepository.save(r);
      checkRegistrationFeildRepository.save(r.getCheck());

      User User1 = new User(r);
      User1.setEmail(r.getPersonalEmailAddress());

      switch (r.getGenerate()) {
        case "RR":
          HashMap<String, Object> content = new HashMap<>();
          content.put("student_name", r.getFirstName() + " " + r.getLastName());
          content.put("invalid_feilds", r.getCheck().getMissingFeilds());

          String baseUrl1 = protocol + "://" + site_name + "/re-fillForm?" + "q=" + r.getCollegeIdentificationNumber();
          // String query1 = ;
          // URL url1 = new URL(baseUrl1 + URLEncoder.encode(query1, "UTF-8"));
          content.put("link", baseUrl1);

          emailService.sendMessageUsingTemplates("Fill Correct Data - KCCITM", User1, "KCCITM Registrar",
              "noreply@kccitm.email",

              "faculty-registration-rejection", content);
          break;
        case "RA":
          HashMap<String, Object> content1 = new HashMap<>();
          content1.put("student_name", r.getFirstName() + " " + r.getLastName());
         
          // emailService.sendMessageUsingTemplates("REGISTRATION FORM FILLED SUCCESSFULLY - KCCITM", User1,
          //     "KCCITM Registrar",
          //     "noreply@kccitm.email",
          //     "registration-accepted", content1);
          break;
        default:
          break;
      }
      return true;
    } catch (Exception e) {
      System.out.println(e);
      return false;
    }
  }

  public void facultyRegistarionUpdate(Faculty r) throws MandrillApiError, IOException, RequestFailedException {
    HashMap<String, Object> content1 = new HashMap<>();
    content1.put("student_name", r.getFirstName() + " " + r.getLastName());
    facultyRepository.save(r);
    checkRegistrationFeildRepository.save(r.getCheck());

    User User1 = new User(r);
    User1.setEmail(r.getPersonalEmailAddress());

    emailService.sendMessageUsingTemplates("REGISTRATION FORM FILLED SUCCESSFULLY - KCCITM", User1,
        "KCCITM Registrar",
        "noreply@kccitm.email",

        "faculty-registration-confirmation", content1);
  }

  public void sendFacultyRegisrationWelcomeMail(Faculty r, String idCard_url,String password)
      throws MandrillApiError, IOException, RequestFailedException {
    HashMap<String, Object> content1 = new HashMap<>();
    password = password==""?r.getAadharCardNo() + "KCCITM!":"*Your Password Did Not Change (As your email id already existed in the system, the new email was not genrated)";
    String institute_name = "KCC Institute of Technology and Management";
    content1.put("student_name", r.getFirstName() + " " + r.getLastName());
    content1.put("institute_name", institute_name);
    content1.put("studnet_official_email_id", r.getOfficialEmailAddress());
    content1.put("studnet_official_email_password", r.getAadharCardNo() + "KCCITM!");
    content1.put("studnet_official_id_url", idCard_url);

    User User1 = new User(r);
    User1.setEmail(r.getPersonalEmailAddress());

    emailService.sendMessageUsingTemplates("Welcome to " + institute_name, User1,
        "KCCITM Registrar",
        "noreply@kccitm.email", "faculty-registartion-welcome-mail", content1);
  }

}
