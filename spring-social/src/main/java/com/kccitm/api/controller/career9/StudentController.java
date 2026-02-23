package com.kccitm.api.controller.career9;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.cribbstechnologies.clients.mandrill.model.MandrillRecipient;
import com.itextpdf.text.pdf.PdfStructTreeController.returnType;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.Batch;
import com.kccitm.api.model.BoardName;
import com.kccitm.api.model.Branch;
import com.kccitm.api.model.Category;
import com.kccitm.api.model.CheckRegistrationFeild;
import com.kccitm.api.model.Gender;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.repository.BatchRepository;
import com.kccitm.api.repository.BoardNameRepository;
import com.kccitm.api.repository.BranchRepository;
import com.kccitm.api.repository.CategoryRepository;
import com.kccitm.api.repository.CheckRegistrationFeildRepository;
import com.kccitm.api.repository.GenderRepository;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.EmailService;
import com.kccitm.api.service.GoogleAPIAdmin;
import com.kccitm.api.service.GoogleCloudAPI;
import com.kccitm.api.service.PdfService;
import com.kccitm.api.service.StudentService;
import com.microtripit.mandrillapp.lutung.model.MandrillApiError;

@RestController
public class StudentController {
  @Autowired
  private StudentRepository studentRepository;

  @Autowired
  private GenderRepository genderRepository;

  @Autowired
  private CategoryRepository categoryRepository;

  @Autowired
  private BranchRepository branchRepository;

  @Autowired
  private BoardNameRepository boardNameRepository;

  @Autowired
  private BatchRepository batchRepository;

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private CheckRegistrationFeildRepository checkRegistrationFeildRepository;

  @Autowired
  private UserRoleGroupMappingRepository userRoleGroupMappingRepository;

  @Autowired
  private RoleGroupRepository roleGroupRepository;

  @Autowired
  private StudentService studentService;

  @Autowired
  private EmailService emailService;

  @Autowired
  private GoogleAPIAdmin gpa;

  @Autowired
  private InstituteCourseRepository courseRepository;

  @Autowired
  private InstituteBranchRepository instituteBranchRepository;

  @Autowired
  private InstituteBatchRepository instituteBatchRepository;

  @Autowired
  private PdfService pdfservice;
  @Autowired
  private GoogleCloudAPI googleCloudAPI;

  // @Autowired
  // private SubCategoryRepository subCategoryRepository;

  @PostMapping(value = "/student/save-csv", headers = "Accept=application/json")
  public Boolean saveBulk(
      @RequestBody ArrayList<Student> saveAllStudentsCSV) {

    try {
      Object studentData = saveAllStudentsCSV.get(0);
      if (studentData instanceof Student) {
          studentRepository.save((Student) studentData);
      } else {
          throw new IllegalArgumentException("Invalid data type in saveAllStudentsCSV. Expected Student object.");
      }
    } catch (Exception e) {
      System.out.println(e);
      return false;
    }
    // String st = allStudents.get(2).getOfficialemailid();
    return true;
  }

  @GetMapping(value = "student/get-check", headers = "Accept=application/json")
  public List<Student> getAllStudentsGoogleAdmin(@CurrentUser UserPrincipal userPrincipal) {
    List<Student> allStudents = studentRepository.findAll();
    int count = 0;
    for (Student student : allStudents) {
      try {
        student.setGoogle(
            gpa.getUserByEmail(userPrincipal, student.getOfficialEmailAddress()).size() > 0 ? true : false);
      } catch (Exception e) {
        student.setGoogle(false);
        // e.printStackTrace();
      }
      count += 1;
      System.out.println("Number of Studnets Scaned: " + count + " Last Person Scanned: " + student.getFirstName()
          + " Emailid:" + student.getOfficialEmailAddress() + "Google Set as:" + student.getGoogle());
    }
    allStudents = studentRepository.saveAllAndFlush(allStudents);
    return allStudents;
  }

  @GetMapping(value = "student/get", headers = "Accept=application/json")
  public List<Student> getAllStudents(@CurrentUser UserPrincipal userPrincipal) {
    List<Student> allStudents = studentRepository.findAll();
    return allStudents;
  }

  @PostMapping(value = "student/update", headers = "Accept=application/json")
  public List<Student> updateStudent(
      @RequestBody Map<String, Student> studentDetail,
      @CurrentUser UserPrincipal UserPrincipal)
      throws RequestFailedException, MandrillApiError, IOException {
    Student r = studentDetail.get("values");

    if (r.getGenerate().equals("SI")) {
      studentService.initalRegistration(r);
    } else if (r.getGenerate().equals("RR") || r.getGenerate().equals("RA")) {
      studentService.registrarVarification(r, UserPrincipal);
    } else if (r.getGenerate().equals("SU")) {
      studentService.studentRegistarionUpdate(r);
    } else {
      System.out.println("hdybcdshc");
      // studentService.studentCorrection();
    }
    // studentRepository.save(r);

    MandrillRecipient[] recipient = {
        new MandrillRecipient("kcc", "kccproject75@gmail.com"),
    };

    return studentRepository.findByPersonalEmailAddress(
        r.getPersonalEmailAddress());
  }

  @GetMapping("/mail")
  public String mail()
      throws RequestFailedException, MandrillApiError, IOException {
    User user = new User();
    user.setEmail("kccproject75@gmail.com");
    user.setName("abc");
    user.setEmailVerified(false);
    user.setProvider(AuthProvider.google);

    // emailService.sendMessageUsingTemplates("abc", user, "abc",
    // "kccproject75@gmail.com", "abc", "abc");
    return "Hello";
  }

  @PostMapping(value = "student/emailChecker", headers = "Accept=application/json")
  public Boolean emailChecker(@RequestBody Map<String, String> email) {
    String r = email.get("values");

    List<Student> e = studentRepository.findByPersonalEmailAddress(r);

    if (e.isEmpty()) {
      return false;
    } else {
      return true;
    }
  }

  @GetMapping(value = "student/getbyid/{id}", headers = "Accept=application/json")
  public Student getStudentById(@PathVariable("id") int studentId) {
    Student student = studentRepository.findById(studentId);
    // student.setBranchData(branchRepository.findById(Integer.parseInt(student.getBranch())).get());
    // // student.setGenderData(genderRepository.findById(student.getGender()).get());
    // student.setCategoryData(
    //     categoryRepository.findById(student.getCategory()).get());
    // student.setCheck(checkRegistrationFeildRepository.findById(studentId));
    // if (student.getCheck() == null) {
    //   student.setCheck(new CheckRegistrationFeild(studentId));
    // }
    // student.setCourseData(
    //     courseRepository.findById(student.getCourse()).isEmpty()
    //         ? null
    //         : courseRepository.findById(student.getCourse()).get());
    // student.setBranchData(
    //     instituteBranchRepository.findById(student.getBranch_id()));
    // student.setBatchData(
    //     instituteBatchRepository.findById(student.getBatch_id()));
    return student;
  }

  @GetMapping(value = "gender/get", headers = "Accept=application/json")
  public List<Gender> getAllGender() {
    List<Gender> allGender = genderRepository.findAll();
    return allGender;
  }

  @PostMapping(value = "gender/update", headers = "Accept=application/json")
  public List<Gender> updateGender(
      @RequestBody Map<String, Gender> currentGender) {
    Gender r = currentGender.get("values");
    genderRepository.save(r);
    return genderRepository.findBytype(r.getType());
  }

  @GetMapping(value = "gender/getbyid/{id}", headers = "Accept=application/json")
  public Optional<Gender> getGenderById(@PathVariable("id") int genderId) {
    Optional<Gender> gender = genderRepository.findById(genderId);
    return gender;
  }

  @GetMapping(value = "category/get", headers = "Accept=application/json")
  public List<Category> getAllCategory() {
    List<Category> allCategory = categoryRepository.findAll();
    return allCategory;
  }

  @PostMapping(value = "category/update", headers = "Accept=application/json")
  public List<Category> updateCategory(
      @RequestBody Map<String, Category> currentCategory) {
    Category r = currentCategory.get("values");
    categoryRepository.save(r);
    return categoryRepository.findByName(r.getName());
  }

  @GetMapping(value = "category/getbyid/{id}", headers = "Accept=application/json")
  public Optional<Category> getCategoryById(
      @PathVariable("id") int categoryId) {
    Optional<Category> category = categoryRepository.findById(categoryId);
    return category;
  }

  @GetMapping(value = "category/delete/{id}", headers = "Accept=application/json")
  public Category deleteCategory(@PathVariable("id") int categoryId) {
    Category category = categoryRepository.getOne(categoryId);
    category.setDisplay(false);
    Category r = categoryRepository.save(category);
    return r;
  }

  // @GetMapping(value = "subcategory/get", headers = "Accept=application/json")
  // public List<SubCategory> getAllSubCategory() {
  // List<SubCategory> allSubCategory = subCategoryRepository.findAll();
  // return allSubCategory;
  // }

  @GetMapping(value = "branch/get", headers = "Accept=application/json")
  public List<Branch> getAllBranch() {
    List<Branch> allBranch = branchRepository.findAll();
    return allBranch;
  }

  @PostMapping(value = "branch/update", headers = "Accept=application/json")
  public List<Branch> updateBranch(
      @RequestBody Map<String, Branch> currentBranch) {
    Branch r = currentBranch.get("values");
    branchRepository.save(r);
    return branchRepository.findByName(r.getName());
  }

  @GetMapping(value = "branch/getbyid/{id}", headers = "Accept=application/json")
  public Optional<Branch> getBranchById(@PathVariable("id") int branchId) {
    Optional<Branch> branch = branchRepository.findById(branchId);
    return branch;
  }

  @GetMapping(value = "branch/delete/{id}", headers = "Accept=application/json")
  public Branch deleteBranch(@PathVariable("id") int branchId) {
    Branch branch = branchRepository.getOne(branchId);
    branch.setDisplay(false);
    Branch r = branchRepository.save(branch);
    return r;
  }

  @GetMapping(value = "board/get", headers = "Accept=application/json")
  public List<BoardName> getAllBoard() {
    List<BoardName> allBoard = boardNameRepository.findAll();
    return allBoard;
  }

  @PostMapping(value = "board/update", headers = "Accept=application/json")
  public BoardName updateBoard(
      @RequestBody Map<String, BoardName> currentBoardName) {
    BoardName r = currentBoardName.get("values");
    boardNameRepository.save(r);
    return boardNameRepository.findByName(r.getName());
  }

  @GetMapping(value = "board/delete/{id}", headers = "Accept=application/json")
  public BoardName deleteBoard(@PathVariable("id") int boardNameId) {
    BoardName boardName = boardNameRepository.getOne(boardNameId);
    boardName.setDisplay(false);
    BoardName r = boardNameRepository.save(boardName);

    return r;
  }

  @GetMapping(value = "batch/get", headers = "Accept=application/json")
  public List<Batch> getAllBatch() {
    List<Batch> allBatch = batchRepository.findAll();
    return allBatch;
  }

  @PostMapping(value = "batch/update", headers = "Accept=application/json")
  public List<Batch> updateBatch(@RequestBody Map<String, Batch> currentBatch) {
    Batch r = currentBatch.get("values");
    batchRepository.save(r);
    return batchRepository.findByBatch(r.getBatch());
  }

  @PostMapping(value = "studnet-confirmation/update", headers = "Accept=application/json")
  public boolean updateStudnetByRegistrar(
      @RequestBody Map<String, Student> studnetDetails) {
    Student df = studnetDetails.get("values");
    CheckRegistrationFeild s = df.getCheck();
    if (s.flag()) {
      df.setGenerate("2");
      studentRepository.save(df);
      // String g = studentService.getEmail();
      // User bhavya = new User();
      // bhavya.setEmail(g);
      // bhavya.setName(df.getFirstName());
      // userRepository.save(bhavya);
    } else {
      df.setGenerate("1");
      studentRepository.save(df);
      // studentService.sendCorrectionMail(df);
    }
    return true;
  }

  @PostMapping(value = "student-email/update", headers = "Accept=application/json")
  // public String updateEmail(@RequestBody Map<String, Student> currentStudent) {
  // Student r = currentStudent.get("values");
  // var t = r.getDob().split("-")[0] + r.getDob().split("-")[1];
  // var b = r.getInstituteBranch().getAbbreviation().split("-")[0]
  // + r.getInstituteBranch().getAbbreviation().split("-")[1];
  // String email = r.getFirstName() + r.getLastName().charAt(0) + t +
  // r.getCourse() + b
  // + r.getInstituteBatch().getBatchEnd() + "@kccitm.edu.in";
  // r.setOfficialEmailAddress(email);
  // studentRepository.save(r);
  // return email;
  public void email(
      @RequestBody Map<String, Student> currentStudent,
      @CurrentUser UserPrincipal userPrincipal)
      throws ParseException {
    studentService.updateEmail(currentStudent);
    try {
      gpa.addStudentToGroup(
          userPrincipal,
          studentRepository
              .findByPersonalEmailAddress(
                  currentStudent.get("values").getPersonalEmailAddress())
              .get(0)
              .getCollegeEnrollmentNumber());
    } catch (GeneralSecurityException e) {
      // TODO Auto-generated catch block
      e.printStackTrace();
    } catch (IOException e) {
      // TODO Auto-generated catch block
      e.printStackTrace();
    }
  }

  @PostMapping(value = "student/getSavetoDatabase", headers = "Accept=application/json")
  public Boolean saveAllStudentsCSV(
      @RequestBody Map<String, ArrayList<Student>> saveAllStudentsCSV) {
    ArrayList<Student> studentList = saveAllStudentsCSV.get("values");
    try {
      studentRepository.saveAll(studentList);
    } catch (Exception e) {
      return false;
    }
    // String st = allStudents.get(2).getOfficialemailid();
    return true;
  }

  @GetMapping(value = "/generate_pdf")
  @ResponseBody
  public String generatePdf(@RequestParam(name = "id") String st, @CurrentUser UserPrincipal userPrincipal,
      HttpServletResponse response)
      throws Exception, RequestFailedException {
    Map<String, Student> currentStudent = new HashMap<String, Student>();

    Student stu = studentRepository.findById(Integer.parseInt(st));
    stu.setCourseData(
        courseRepository.findById(stu.getCourse()).isEmpty()
            ? null
            : courseRepository.findById(stu.getCourse()).get());
    // stu.setBranchData(instituteBranchRepository.findById(stu.getBranch_id()));
    // stu.setBatchData(instituteBatchRepository.findById(stu.getBatch_id()));
    currentStudent.put("values", stu);
    try {
      if (gpa.getUserByEmail(userPrincipal, stu.getOfficialEmailAddress()).isEmpty()) {

        gpa.addStudentToGroup(
            userPrincipal,
            studentRepository
                .findByPersonalEmailAddress(
                    currentStudent.get("values").getPersonalEmailAddress())
                .get(0)
                .getCollegeEnrollmentNumber());
        stu.setOfficialEmailAddress(studentService.getOfficialemailid(stu));
        stu.setGenerate("MS");

      }
    } catch (Exception e) {
      // TODO: handle exception
      try {
        gpa.addStudentToGroup(
            userPrincipal,
            studentRepository
                .findByPersonalEmailAddress(
                    currentStudent.get("values").getPersonalEmailAddress())
                .get(0)
                .getCollegeEnrollmentNumber());
        stu.setOfficialEmailAddress(studentService.getOfficialemailid(stu));
        stu.setGenerate("MS");
        pdfservice.genrateIdCardStudent(stu);
        studentService.sendstudentRegisrationWelcomeMail(stu,
            googleCloudAPI.getPublicURLOfFile(
                stu.getCollegeEnrollmentNumber() + "-" + stu.getFirstName().replaceAll("[^a-zA-Z0-9]", "") + "_" +
                    stu.getLastName().replaceAll("[^a-zA-Z0-9]", "") + "_" + "STUDENT_ID" + ".pdf")
                + "");

        studentRepository.save(stu);
        User usre = userRepository.findByEmail(studentService.getOfficialemailid(stu)) != null
            ? userRepository.findByEmail(stu.getOfficialEmailAddress())
            : new User();
        usre.setDisplay(true);
        usre.setName(stu.getFirstName() + " " + stu.getLastName());
        usre.setProvider(AuthProvider.google);
        usre.setProviderId(stu.getCollegeEnrollmentNumber() + "");
        usre.setEmail(stu.getOfficialEmailAddress());
        usre.setEmailVerified(true);
        usre = userRepository.save(usre);
        UserRoleGroupMapping urgm = new UserRoleGroupMapping(false, usre.getId(), roleGroupRepository.getById(3));
        userRoleGroupMappingRepository.save(urgm);
        return "Done";
      } catch (Exception e2) {
        System.out.println(e2);
        return "Google Error";
        // TODO: handle exception
      }

      // System.out.println(e);

      // return "Google Error";
    }
    pdfservice.genrateIdCardStudent(stu);
    studentService.sendstudentRegisrationWelcomeMail(stu,
        googleCloudAPI.getPublicURLOfFile(
            stu.getCollegeEnrollmentNumber() + "-" + stu.getFirstName().replaceAll("[^a-zA-Z0-9]", "") + "_" +
                stu.getLastName().replaceAll("[^a-zA-Z0-9]", "") + "_" + "STUDENT_ID" + ".pdf")
            + "");

    studentRepository.save(stu);
    User usre = userRepository.findByEmail(studentService.getOfficialemailid(stu)) != null
        ? userRepository.findByEmail(stu.getOfficialEmailAddress())
        : new User();
    usre.setDisplay(true);
    usre.setName(stu.getFirstName() + " " + stu.getLastName());
    usre.setProvider(AuthProvider.google);
    usre.setProviderId(stu.getCollegeEnrollmentNumber() + "");
    usre.setEmail(stu.getOfficialEmailAddress());
    usre.setEmailVerified(true);
    usre = userRepository.save(usre);
    UserRoleGroupMapping urgm = new UserRoleGroupMapping(false, usre.getId(), roleGroupRepository.getById(3));
    userRoleGroupMappingRepository.save(urgm);
    return "Done";
  }

  @GetMapping(value = "/email-validation-official")
  @ResponseBody
  public boolean emailValidationOfficial(@RequestParam(name = "email") String email,
      HttpServletResponse response)
      throws Exception, RequestFailedException {
    if (email.toLowerCase().split("@")[1].equals("kccitm.edu.in")) {
      studentService.sendOtpMail(email, studentService.emailToCode(email));
      return true;
    } else {
      return false;
    }

  }

  @GetMapping(value = "/email-validation-official-confermation")
  @ResponseBody
  public boolean emailValidationOfficialConfermation(@RequestParam(name = "email") String email,
      @RequestParam(name = "otp") String otp,
      HttpServletResponse response)
      throws Exception, RequestFailedException {
    System.out.println("SENT OTP = " + studentService.emailToCode(email));
    System.out.println("RECIEVED OTP = " + otp);
    if (studentService.emailToCode(email).equals(otp))
      return true;
    return false;
  }

  @GetMapping(value = "/generate_id_card")
  @ResponseBody
  public String generateIdCard(@RequestParam(name = "id") String st, @CurrentUser UserPrincipal userPrincipal,
      HttpServletResponse response)
      throws Exception, RequestFailedException {
    Map<String, Student> currentStudent = new HashMap<String, Student>();

    Student stu = studentRepository.findById(Integer.parseInt(st));
    stu.setCourseData(
        courseRepository.findById(stu.getCourse()).isEmpty()
            ? null
            : courseRepository.findById(stu.getCourse()).get());
    // stu.setBranchData(instituteBranchRepository.findById(stu.getBranch_id()));
    // stu.setBatchData(instituteBatchRepository.findById(stu.getBatch_id()));
    if (stu.getOfficialEmailAddress() == null)
      return "User Does Not Exist";
    currentStudent.put("values", stu);

    pdfservice.genrateIdCardStudent(stu);
    // studentService.sendstudentRegisrationWelcomeMail(stu,
    // googleCloudAPI.getPublicURLOfFile(stu.getCollegeEnrollmentNumber() + "-" +
    // stu.getFirstName() + "_" +
    // stu.getLastName() + "_" + "STUDENT_ID" + ".pdf") + "");
    studentService.sendIdCardMail(stu,
        googleCloudAPI.getPublicURLOfFile(stu.getCollegeEnrollmentNumber() + "-" + stu.getFirstName() + "_" +
            stu.getLastName() + "_" + "STUDENT_ID" + ".pdf") + "");

    stu.setGenerate("MS");
    // stu.setOfficialEmailAddress(stu.getOfficialemailid());
    studentRepository.save(stu);
    User usre = userRepository.findByEmail(stu.getOfficialEmailAddress()) != null
        ? userRepository.findByEmail(stu.getOfficialEmailAddress())
        : new User();
    usre.setDisplay(true);
    usre.setName(stu.getFirstName() + " " + stu.getLastName());
    usre.setProvider(AuthProvider.google);
    usre.setProviderId(stu.getCollegeEnrollmentNumber() + "");
    usre.setEmail(stu.getOfficialEmailAddress());
    usre = userRepository.save(usre);
    UserRoleGroupMapping urgm = new UserRoleGroupMapping(false, usre.getId(), roleGroupRepository.getById(3));
    userRoleGroupMappingRepository.save(urgm);
    return "Done";
  }

}
