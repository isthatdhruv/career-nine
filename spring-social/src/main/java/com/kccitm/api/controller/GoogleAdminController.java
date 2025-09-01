package com.kccitm.api.controller;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.google.api.services.directory.model.Group;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.InstituteBatch;
import com.kccitm.api.model.InstituteCourse;
import com.kccitm.api.model.InstituteSession;
import com.kccitm.api.model.Student;
// import com.google.api.services.directory.model.User;
import com.kccitm.api.model.User;
import com.kccitm.api.model.userDefinedModel.ForgotPassword;
import com.kccitm.api.model.userDefinedModel.GoogleGroup;
import com.kccitm.api.model.userDefinedModel.GoogleGroupMapping;
import com.kccitm.api.model.userDefinedModel.GoogleGroupMappingData;
import com.kccitm.api.repository.InstituteBatchGoogleGroupRepository;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteCourseGoogleGroupRepository;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.InstituteSessionGoogleGroupRepository;
import com.kccitm.api.repository.InstituteSessionRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.EmailService;
import com.kccitm.api.service.GoogleAPIAdmin;
import com.microtripit.mandrillapp.lutung.model.MandrillApiError;

@RestController
@RequestMapping("/google-api")
public class GoogleAdminController {
    @Autowired
    GoogleAPIAdmin googleAPIAdmin;

    @Autowired
    private EmailService emailService;

    @Autowired
    InstituteCourseGoogleGroupRepository instituteCourseGoogleGroup;

    @Autowired
    InstituteBatchGoogleGroupRepository instituteBatchGoogleGroup;

    @Autowired
    InstituteSessionGoogleGroupRepository instituteSessionGoogleGroupRepository;

    @Autowired
    InstituteCourseRepository institutionCourseRepository;

    @Autowired
    InstituteBatchRepository institutionBatchRepository;

    @Autowired
    InstituteSessionRepository instituteSessionRepository;

    @GetMapping(value = "/email/get", headers = "Accept=application/json")
    public List<String> getAllEmail(@CurrentUser UserPrincipal user) throws GeneralSecurityException, IOException {
        List<String> allEmail = googleAPIAdmin.getAllUserFromAdmin(user);
        return allEmail;
    }

    @GetMapping(value = "/groupemail/get", headers = "Accept=application/json")
    public List<GoogleGroupMapping> getAllGroupEmail(@CurrentUser UserPrincipal group)
            throws GeneralSecurityException, IOException {
        List<GoogleGroupMapping> groupsList = new ArrayList<GoogleGroupMapping>();
        List<String> allGroupUnit = googleAPIAdmin.getAllGroupFromAdmin(group);
        for (String groupEmail : allGroupUnit) {
            GoogleGroupMapping mapping = new GoogleGroupMapping();
            if (instituteCourseGoogleGroup.findByName(groupEmail).isEmpty()) {
                if (instituteBatchGoogleGroup.findByName(groupEmail).isEmpty()) {
                    if (instituteSessionGoogleGroupRepository.findByName(groupEmail).isEmpty()) {
                        mapping.setGroupName(groupEmail);
                        mapping.setGoogleGroupMappingData(new GoogleGroupMappingData());
                    } else {
                        InstituteSession isession = instituteSessionRepository
                                .findById(instituteSessionGoogleGroupRepository.findByName(groupEmail).get(0)
                                        .getInstituteSessionId())
                                .get();
                        mapping.setGroupName(groupEmail);
                        mapping.setGoogleGroupMappingData(new GoogleGroupMappingData("Session", isession.getSessionId(),
                                isession.getSessionStartDate() + "-" + isession.getSessionEndDate()));
                    }
                } else {
                    InstituteBatch ib = institutionBatchRepository
                            .findById(instituteBatchGoogleGroup.findByName(groupEmail).get(0).getInstituteBatchId());

                    mapping.setGroupName(groupEmail);
                    mapping.setGoogleGroupMappingData(new GoogleGroupMappingData("Batch", ib.getBatchId(),
                            ib.getBatchStart() + "-" + ib.getBatchEnd()));
                }
            } else {
                InstituteCourse ic = institutionCourseRepository
                        .getById(instituteCourseGoogleGroup.findByName(groupEmail).get(0).getInstituteCourseId());

                mapping.setGroupName(groupEmail);
                mapping.setGoogleGroupMappingData(
                        new GoogleGroupMappingData("Course", ic.getCourseCode(), ic.getCourseName()));
            }
            groupsList.add(mapping);
        }
        return groupsList;
    }

    @GetMapping(value = "/orgunitname/get", headers = "Accept=application/json")
    public List<String> getAllOrgUnitName(@CurrentUser UserPrincipal orgUnit, Student student)
            throws GeneralSecurityException, IOException {
        List<String> allOrgUnit = googleAPIAdmin.getAllOrgunitsFromAdmin(orgUnit, student);
        return allOrgUnit;
    }

    @GetMapping(value = "/username/get/{name}", headers = "Accept=application/json")
    public List<com.google.api.services.directory.model.User> getUser(@PathVariable("name") String query,
            @CurrentUser UserPrincipal users)
            throws GeneralSecurityException, IOException {
        List<com.google.api.services.directory.model.User> user = googleAPIAdmin.getUserByName(users, query);

        return user;
    }

    @PostMapping(value = "/password-reset/update", headers = "Accept=application/json")
    public String updatePassword(@RequestBody Map<String, ForgotPassword> forgotPassword,
            @CurrentUser UserPrincipal users)
            throws GeneralSecurityException, IOException, RequestFailedException, MandrillApiError {
        ForgotPassword r = forgotPassword.get("values");
        String user = googleAPIAdmin.resetPassword(users, r);

        User user1 = new User();
        user1.setEmail("kccproject75@gmail.com");
        user1.setName("abc");
        user1.setEmailVerified(false);
        user1.setProvider(AuthProvider.google);

        Map<String, String> data = Map.ofEntries(Map.entry(r.getPersonalEmailAddress(), r.getRollNo()));

        // emailService.sendMessageUsingTemplates("abc", user1, "abc",
        // "kccproject75@gmail.com", "abc", "my_test_template", data);
        return user;
    }

    @GetMapping(value = "/group/get/{name}", headers = "Accept=application/json")
    public List<Group> getGroup(@PathVariable("name") String query, @CurrentUser UserPrincipal groups)
            throws GeneralSecurityException, IOException {
        List<Group> group = googleAPIAdmin.getGroupFromAdmin(groups, query);
        return group;
    }

    @GetMapping(value = "/group-member/get/{name}", headers = "Accept=application/json")
    public List<String> getGroupMember(@PathVariable("name") String query, @CurrentUser UserPrincipal members)
            throws GeneralSecurityException, IOException {
        List<String> group = googleAPIAdmin.getGroupMemberFromAdmin(members, query);
        return group;
    }

    @GetMapping(value = "/group-member-delete/get/{name}/delete/{email}", headers = "Accept=application/json")
    public String deleteGroupMember(@PathVariable("name") String query, @PathVariable("email") String query1,
            @CurrentUser UserPrincipal members) throws GeneralSecurityException, IOException {
        String member = googleAPIAdmin.deleteMemberFromGroup(members, query, query1);
        return member;
    }

    @GetMapping(value = "/group-delete/get/{name}", headers = "Accept=application/json")
    public String deleteGroup(@PathVariable("name") String query, @CurrentUser UserPrincipal group)
            throws GeneralSecurityException, IOException {
        String grp = googleAPIAdmin.deleteGroup(group, query);
        return grp;
    }

    @PostMapping(value = "/group/add", headers = "Accept=application/json")
    public String addGroup(@RequestBody Map<String, GoogleGroup> group, @CurrentUser UserPrincipal users)
            throws GeneralSecurityException, IOException {
        GoogleGroup r = group.get("values");
        String grp = googleAPIAdmin.addGroup(users, r);
        return grp;
    }

    @GetMapping(value = "/member-add/get/{name}", headers = "Accept=application/json")
    public String addMemberGroup(@PathVariable("name") String query, @CurrentUser UserPrincipal mamber)
            throws GeneralSecurityException, IOException {
        String mem = googleAPIAdmin.addMemberToGroup(mamber, query);
        return mem;
    }

    @GetMapping(value = "/email/get/list", headers = "Accept=application/json")
    public List<String> getEmailListGoogle(
            @CurrentUser UserPrincipal mamber) throws GeneralSecurityException, IOException {
        List<String> mem = googleAPIAdmin.getAllUser(mamber);
        return mem;
    }

    @GetMapping(value = "/email/get/{email}", headers = "Accept=application/json")
    public List<com.google.api.services.directory.model.User> getEmailGoogle(@PathVariable("email") String email,
            @CurrentUser UserPrincipal mamber) throws GeneralSecurityException, IOException {
        List<com.google.api.services.directory.model.User> mem = googleAPIAdmin.getUserByEmail(mamber, email);
        return mem;
    }
}
