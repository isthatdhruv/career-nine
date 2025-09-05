package com.kccitm.api.service;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.ParseException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.kccitm.api.model.BoardName;
import com.kccitm.api.model.CheckRegistrationFeild;
import com.kccitm.api.model.InstituteBatch;
import com.kccitm.api.model.InstituteBranch;
import com.kccitm.api.model.InstituteCourse;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.BoardNameRepository;
import com.kccitm.api.repository.CheckRegistrationFeildRepository;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.InstituteSessionRepository;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.UserPrincipal;
import com.microtripit.mandrillapp.lutung.model.MandrillApiError;

@Service
public class StudentService {

  @Value("${app.protocol}")
  private String protocol;

  @Value("${app.name}")
  private String site_name;

  @Autowired
  private StudentRepository studentRepository;

  @Autowired
  private InstituteSessionRepository instituteSessionRepository;

  @Autowired
  private InstituteBatchRepository batchRepository;

  @Autowired
  private InstituteBranchRepository branchRepository;

  @Autowired
  private InstituteCourseRepository instituteCourseRepository;

  @Autowired
  private InstituteBranchBatchMappingRepository branchBatchMappingRepository;

  @Autowired
  private CheckRegistrationFeildRepository checkRegistrationFeildRepository;

  @Autowired
  private BoardNameRepository boardNameRepository;

  @Autowired
  private EmailService emailService;
  @Autowired
  private GoogleAPIAdmin gpa;

  @Autowired
  private UserRepository userRepository;

  public List<Student> getAllStudents() {
    List<Student> allStudents = studentRepository.findAll();
    return allStudents;
  }

  // public Optional<Student> getStudentById(@PathVariable("id") int studentId) {
  // Optional<Student> student = studentRepository.findById(studentId);
  // return student;
  // }

  public void sendCorrectionMail(CheckRegistrationFeild crf) {
    ArrayList<String> sr = crf.getMissingFeilds();
  }

  public String getEmail() {
    List<Student> allStudents = studentRepository.findAll();
    // String st = allStudents.get(2).getOfficialemailid();
    String st = "";
    return st;
  }

  public String updateEmail(@RequestBody Map<String, Student> currentStudent)
      throws ParseException {
    Student r = currentStudent.get("values");

    LocalDate dob = LocalDate.parse(r.getDob());
    int month = dob.getMonthValue();
    int day = dob.getDayOfMonth();
    var t = month + "" + day;
    var b = r.getInstituteBranch() != null
        ? r
            .getInstituteBranch()
            .getAbbreviation()
            .replaceAll("[^a-zA-Z0-9]", "")
            .toLowerCase()
        : "stupid";
    String email = r.getFirstName() +
        r.getLastName().charAt(0) +
        t +
        r.getCourse() +
        b +
        r.getInstituteBatch().getBatchEnd() +
        "@kccitm.edu.in";
    r.setOfficialEmailAddress(email);
    studentRepository.save(r);
    return email;
  }

  public ArrayList<String> getAllGroupEmailIds(
      int batch,
      int branch,
      int course) {
    InstituteBatch ses = batchRepository.getById(batch);
    String batchEndYear = ses
        .getBatchEnd()
        .replaceAll("[^a-zA-Z0-9]", "")
        .toLowerCase();
    InstituteBranch brn = branchRepository.getById(branch);
    String branchName = brn
        .getAbbreviation()
        .replaceAll("[^a-zA-Z0-9]", "")
        .toLowerCase();
    InstituteCourse ice = instituteCourseRepository.getById(course);
    String cour = ice
        .getAbbreviation()
        .replaceAll("[^a-zA-Z0-9]", "")
        .toLowerCase();
    ArrayList<String> groupsEmail = new ArrayList<>();

    // btech2021
    groupsEmail.add(cour + batchEndYear + "@kccitm.edu.in");

    // cse2021
    groupsEmail.add(branchName + batchEndYear + "@kccitm.edu.in");

    // btechcse2021
    groupsEmail.add(cour + branchName + batchEndYear + "@kccitm.edu.in");

    return groupsEmail;
  }

  public Student setBatchBranchCourse(Student stu) {
    InstituteBatch ses = batchRepository.getById(stu.getBatch_id());
    stu.setBatchData(ses);
    InstituteBranch brn = branchRepository.getById(stu.getBranch_id());
    stu.setBranchData(brn);
    InstituteCourse ice = instituteCourseRepository.getById(stu.getCourse());
    stu.setCourseData(ice);
    return stu;
  }

  public boolean initalRegistration(Student r) throws RequestFailedException {
    try {
      if (r.getOther10thBoard() != "") {
        String board = r.getOther10thBoard();
        BoardName bn = new BoardName(board);
        BoardName bnReturn = boardNameRepository.save(bn);
        r.set_0thboard(bnReturn.getId());
      }

      if (r.getOther12thBoard() != "") {
        String board = r.getOther12thBoard();
        BoardName bn = new BoardName(board);
        BoardName bnReturn = boardNameRepository.save(bn);
        r.set_2thboardSS(bnReturn.getId());
      }

      Student t = studentRepository.save(r);
      r.getCheck().setstudent_id(t.getCollegeEnrollmentNumber());
      checkRegistrationFeildRepository.save(r.getCheck());

      Map<String, Object> content = new HashMap<>();
      content.put("student_name", r.getFirstName() + " " + r.getLastName());

      User ty = new User(r);
      ty.setEmail(r.getPersonalEmailAddress());
      emailService.sendMessageUsingTemplates(
          "KCCITM Registration Form Update",
          ty,
          "KCCITM Registrar",
          "noreply@kccitm.email",
          "registration-confirmation",
          content);

      return true;
    } catch (Exception e) {
      System.out.println(e);
      return false;
    }
  }

  public boolean registrarVarification(Student r, UserPrincipal userPrincipal)
      throws RequestFailedException {
    try {
      studentRepository.save(r);
      checkRegistrationFeildRepository.save(r.getCheck());

      User User1 = new User(r);
      User1.setEmail(r.getPersonalEmailAddress());

      switch (r.getGenerate()) {
        case "RR":
          HashMap<String, Object> content = new HashMap<>();
          content.put("student_name", r.getFirstName() + " " + r.getLastName());
          content.put("invalid_feilds", r.getCheck().getMissingFeilds());

          String baseUrl1 = protocol + "://" + site_name + "/re-fillForm?" + "q=" + r.getCollegeEnrollmentNumber();
          // String query1 = ;
          // URL url1 = new URL(baseUrl1 + URLEncoder.encode(query1, "UTF-8"));
          content.put("link", baseUrl1);

          emailService.sendMessageUsingTemplates("Fill Correct Data - KCCITM", User1, "KCCITM Registrar",
              "noreply@kccitm.email",

              "registration-rejection", content);
          break;
        case "RA":
          HashMap<String, Object> content1 = new HashMap<>();
          content1.put("student_name", r.getFirstName() + " " + r.getLastName());
          // gpa.addStudentToGroup(userPrincipal,
          // studentRepository.findByPersonalEmailAddress(r.getPersonalEmailAddress())
          // .get(0).getCollegeEnrollmentNumber());

          // emailService.sendMessageUsingTemplates("REGISTRATION FORM FILLED SUCCESSFULLY
          // - KCCITM", User1,
          // "KCCITM Registrar",
          // "noreply@kccitm.email",
          // "registration-accepted", content1);
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

  public void studentRegistarionUpdate(Student r) throws MandrillApiError, IOException, RequestFailedException {
    HashMap<String, Object> content1 = new HashMap<>();
    content1.put("student_name", r.getFirstName() + " " + r.getLastName());
    studentRepository.save(r);
    checkRegistrationFeildRepository.save(r.getCheck());

    User User1 = new User(r);
    User1.setEmail(r.getPersonalEmailAddress());

    emailService.sendMessageUsingTemplates("REGISTRATION FORM FILLED SUCCESSFULLY - KCCITM", User1,
        "KCCITM Registrar",
        "noreply@kccitm.email",

        "registration-confirmation", content1);
  }

  public void sendstudentRegisrationWelcomeMail(Student r, String idCard_url)
      throws MandrillApiError, IOException, RequestFailedException {
    HashMap<String, Object> content1 = new HashMap<>();
    String institute_name = "KCC Institute of Technology and Management";
    content1.put("student_name", r.getFirstName() + " " + r.getLastName());
    content1.put("institute_name", institute_name);
    content1.put("studnet_official_email_id", getOfficialemailid(r));
    content1.put("studnet_official_email_password", r.getAadharCardNo() + "KCCITM!");
    content1.put("studnet_official_id_url", idCard_url);

    User User1 = new User(r);
    User1.setEmail(r.getPersonalEmailAddress());

    emailService.sendMessageUsingTemplates("Welcome to " + institute_name, User1,
        "KCCITM Registrar",
        "noreply@kccitm.email", "student-registartion-welcome-mail", content1);
  }

  public void sendIdCardMail(Student r, String idCard_url)
      throws MandrillApiError, IOException, RequestFailedException {
    HashMap<String, Object> content1 = new HashMap<>();
    String institute_name = "KCC Institute of Technology and Management";
    content1.put("student_name", r.getFirstName() + " " + r.getLastName());
    content1.put("institute_name", institute_name);
    content1.put("studnet_official_email_id", r.getOfficialEmailAddress());
    // content1.put("studnet_official_email_password", r.getAadharCardNo() +
    // "KCCITM!");
    content1.put("studnet_official_id_url", idCard_url);

    User User1 = new User(r);
    User1.setEmail(r.getPersonalEmailAddress());

    emailService.sendMessageUsingTemplates("ID card and official mail | " + institute_name, User1,
        "KCCITM Registrar",
        "noreply@kccitm.email", "student-registartion-id-mail", content1);
  }

  public void sendOtpMail(String email, String otp)
      throws MandrillApiError, IOException, RequestFailedException {
    HashMap<String, Object> content1 = new HashMap<>();
    String institute_name = "KCC Institute of Technology and Management";
    content1.put("otp", otp);
    content1.put("email", email);
    User User1 = new User();
    User1.setEmail(email);

    emailService.sendMessageUsingTemplates("OTP for Email Verification", User1,
        "KCCITM Registrar",
        "noreply@kccitm.email", "student-email-verification", content1);
  }

  public String generateOtp(String email, int hashKey) throws NoSuchAlgorithmException {
    // Generate a random salt value
    // Random rand = new Random();
    // int salt = rand.nextInt(1000000);

    // Concatenate the email, hash key, and salt
    String plaintext = email + hashKey;

    // Generate a hash of the plaintext using SHA-256
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hashBytes = digest.digest(plaintext.getBytes());

    // Convert the hash bytes to a 6-digit OTP
    int hashValue = Math.abs(hashBytes.hashCode());
    int otp = hashValue % 1000000;

    // Pad the OTP with leading zeros if necessary
    return String.format("%06d", otp);
  }

  public String emailToCode(String email) throws NoSuchAlgorithmException {
    MessageDigest md = MessageDigest.getInstance("MD5");
    md.update(email.getBytes());
    byte[] bytes = md.digest();

    StringBuilder builder = new StringBuilder();
    for (byte b : bytes) {
      builder.append(String.format("%02X", b));
    }
    String hash = builder.toString().substring(0, 6);
    return hash;
  }

  public String getOfficialemailid(Student stu) {
    stu = setBatchBranchCourse(stu);
    var lname = !(stu.getLastName() == null) ? (stu.getLastName().charAt(0) +
        "").toLowerCase().trim() : "";
    var dob = !(stu.getDob() == null)
        ? (stu.getDob().split("-").length > 1 ? stu.getDob().split("-")[2] + stu.getDob().split("-")[1]
            : stu.getDob().split("-")[2])
        : "";
    String branch = !(stu.getBranchData() == null) ? (stu.getBranchData().getAbbreviation().toLowerCase().trim()) : "";
    var fname = !(stu.getFirstName() == null) ? stu.getFirstName().toLowerCase().trim() : "";
    String course = !(stu.getCourseData() == null)
        ? stu.getCourseData().getAbbreviation().replace(" ", "").toLowerCase().trim().replace(".", "")
        : "";
    String batch = !(stu.getBatchData() == null) ? stu.getBatchData().getBatchEnd().trim() : "";
    var email = fname.replaceAll("[^a-zA-Z0-9]", "") +
        lname.replaceAll("[^a-zA-Z0-9]", "") +
        dob +
        course +
        branch
        + batch + "@kccitm.edu.in";

    return email;
  }

}
