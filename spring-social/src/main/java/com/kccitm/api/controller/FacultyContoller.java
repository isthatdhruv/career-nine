package com.kccitm.api.controller;

import java.security.GeneralSecurityException;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.google.protobuf.TextFormat.ParseException;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.CheckFacultyRegistrationField;
import com.kccitm.api.model.Faculty;
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.repository.FacultyRepository;
import com.kccitm.api.repository.CategoryRepository;
import com.kccitm.api.repository.CheckFacultyRegistrationFieldRepository;
import com.kccitm.api.repository.GenderRepository;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.FacultyService;
import com.kccitm.api.service.GoogleAPIAdmin;
import com.kccitm.api.service.GoogleCloudAPI;
import com.kccitm.api.service.PdfService;
import com.microtripit.mandrillapp.lutung.model.MandrillApiError;

import io.jsonwebtoken.io.IOException;

@RestController
public class FacultyContoller {
  @Autowired
  private FacultyRepository facultyRepository;

  @Autowired
  private GenderRepository genderRepository;

  @Autowired
  private CategoryRepository categoryRepository;

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private RoleGroupRepository roleGroupRepository;

  @Autowired
  private UserRoleGroupMappingRepository userRoleGroupMappingRepository;

  @Autowired
  private PdfService pdfservice;

  @Autowired
  private CheckFacultyRegistrationFieldRepository checkRegistrationFeildRepository;

  @Autowired
  private FacultyService facultyService;

  @Autowired
  private GoogleCloudAPI googleCloudAPI;

  @Autowired
  private GoogleAPIAdmin gpa;

  @GetMapping(value = "/faculty/get", headers = "Accept=application/json")
  public List<Faculty> getAllFaculties() {
    List<Faculty> faculty = facultyRepository.findAll();
    return faculty;
  }

  @GetMapping(value = "faculty/getbyid/{id}", headers = "Accept=application/json")
  public Faculty getFacultyById(@PathVariable("id") int collegeIdentificationNumber) {
    Faculty faculty = facultyRepository.findById(collegeIdentificationNumber);
    faculty.setGenderData(genderRepository.findById(faculty.getGender()).get());
    faculty.setCategoryData(
        categoryRepository.findById(faculty.getCategory()).get());
    faculty.setCheck(checkRegistrationFeildRepository.findById(collegeIdentificationNumber));
    return faculty;
  }

  @PostMapping(value = "faculty/update")
  public Faculty updateFaculty(@RequestBody Map<String, Faculty> inputData,
      @CurrentUser com.kccitm.api.security.UserPrincipal UserPrincipal)
      throws RequestFailedException, MandrillApiError, IOException, java.io.IOException {
    Faculty f = inputData.get("values");

    if (f.getGenerate().equals("FI")) {
      facultyService.initalRegistration(f);
    } else if (f.getGenerate().equals("RR") || f.getGenerate().equals("RA")) {
      facultyService.registrarVerification(f, UserPrincipal);
    } else if (f.getGenerate().equals("FU")) {
      facultyService.facultyRegistarionUpdate(f);
    } else {
      System.out.println("hdybcdshc");
    }

    return facultyRepository.save(f);

  }

  @PostMapping(value = "faculty/emailChecker", headers = "Accept=application/json")
  public Boolean emailChecker(@RequestBody Map<String, String> email) {
    String r = email.get("values");

    List<Faculty> e = facultyRepository.findByPersonalEmailAddress(r);

    if (e.isEmpty()) {
      return false;
    } else {
      return true;
    }
  }

  // @GetMapping(value = "role/delete/{id}", headers = "Accept=application/json")
  // public Faculty deleteUser(@PathVariable("id") int
  // collegeIdentificationNumber) {
  // Faculty faculty = facultyRepository.getOne(collegeIdentificationNumber);
  // faculty.setDisplay(false);
  // Faculty f = facultyRepository.save(faculty);
  // return f;
  // }

  @PostMapping(value = "faculty-email/update", headers = "Accept=application/json")
  public void email(
      @RequestBody Map<String, Faculty> currentFaculty,
      @CurrentUser UserPrincipal userPrincipal)
      throws ParseException, java.text.ParseException {
    facultyService.updateEmail(currentFaculty);
    // try {
    // // gpa.addStudentToGroup(
    // // userPrincipal,
    // // facultyRepository
    // // .findByPersonalEmailAddress(
    // // currentFaculty.get("values").getPersonalEmailAddress())
    // // .get(0)
    // // .getCollegeEnrollmentNumber());
    // } catch (GeneralSecurityException e) {
    // // TODO Auto-generated catch block
    // e.printStackTrace();
    // } catch (IOException e) {
    // // TODO Auto-generated catch block
    // e.printStackTrace();
    // }
  }

  @PostMapping(value = "faculty/getSavetoDatabase", headers = "Accept=application/json")
  public Boolean saveAllFacultiesCSV(
      @RequestBody Map<String, ArrayList<Faculty>> saveAllFacultiesCSV) {
    ArrayList<Faculty> facultyList = saveAllFacultiesCSV.get("values");
    try {
      facultyRepository.saveAll(facultyList);
    } catch (Exception e) {
      return false;
    }
    return true;
  }

  @GetMapping(value = "/generate_pdf_faculty")
  @ResponseBody
  public String generatePdf(@RequestParam(name = "id") String st, @RequestParam(name = "email") String email,
      @CurrentUser UserPrincipal userPrincipal,
      HttpServletResponse response)
      throws Exception, RequestFailedException {
    Map<String, Faculty> currentFaculty = new HashMap<String, Faculty>();

    Faculty ftu = facultyRepository.findById(Integer.parseInt(st));

    currentFaculty.put("values", ftu);
    pdfservice.genrateIdCardFaculty(ftu);
    if (email == "") {
      gpa.addFacultyToGroup(userPrincipal, facultyRepository.findByPersonalEmailAddress(ftu.getPersonalEmailAddress())
          .get(0).getCollegeIdentificationNumber());
      ftu.setGenerate("MS");
      ftu.setOfficialEmailAddress(facultyService.getOfficialemailid(ftu));
      facultyRepository.save(ftu);
      facultyService.sendFacultyRegisrationWelcomeMail(ftu,
          googleCloudAPI.getPublicURLOfFile(ftu.getCollegeIdentificationNumber() + "-" +
              ftu.getFirstName().replaceAll("[^a-zA-Z0-9]", "") + "_" +
              ftu.getLastName().replaceAll("[^a-zA-Z0-9]", "") + "_" + "FACULTY_ID" + ".pdf") + "",
          "3");
    } else {
      ftu.setGenerate("MS");
      ftu.setOfficialEmailAddress(email);
      facultyRepository.save(ftu);
      facultyService.sendFacultyRegisrationWelcomeMail(ftu,
          googleCloudAPI.getPublicURLOfFile(ftu.getCollegeIdentificationNumber() + "-" +
              ftu.getFirstName().replaceAll("[^a-zA-Z0-9]", "") + "_" +
              ftu.getLastName().replaceAll("[^a-zA-Z0-9]", "") + "_" + "FACULTY_ID" + ".pdf") + "",
          "");
    }

    User user = userRepository.findByEmail(ftu.getOfficialEmailAddress()) != null
        ? userRepository.findByEmail(ftu.getOfficialEmailAddress())
        : new User();
    user.setDisplay(true);
    user.setName(ftu.getFirstName() + " " + ftu.getLastName());
    user.setProvider(AuthProvider.google);
    user.setProviderId(ftu.getCollegeIdentificationNumber() + "");
    user.setEmail(ftu.getOfficialEmailAddress());
    user.setEmailVerified(true);
    user = userRepository.save(user);
    UserRoleGroupMapping urgm = new UserRoleGroupMapping(false, user.getId(), roleGroupRepository.getById(4));
    userRoleGroupMappingRepository.save(urgm);
    return "Done";
  }

}
