package com.kccitm.api.service;

import java.io.IOException;
import java.nio.charset.Charset;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.directory.Directory;
import com.google.api.services.directory.model.Group;
import com.google.api.services.directory.model.Groups;
import com.google.api.services.directory.model.Member;
import com.google.api.services.directory.model.Members;
import com.google.api.services.directory.model.OrgUnit;
import com.google.api.services.directory.model.OrgUnits;
import com.google.api.services.directory.model.User;
import com.google.api.services.directory.model.UserName;
import com.google.api.services.directory.model.Users;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.Faculty;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.userDefinedModel.EmailMessage;
import com.kccitm.api.model.userDefinedModel.ForgotPassword;
import com.kccitm.api.model.userDefinedModel.GoogleGroup;
import com.kccitm.api.repository.FacultyRepository;
import com.kccitm.api.repository.InstituteBatchGoogleGroupRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.UserPrincipal;

@Service
public class GoogleAPIAdminImpl implements GoogleAPIAdmin {

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    @Autowired
    private GoogleDirectoryService googleDirectoryService;

    @Autowired
    private StudentGoogleEmailGenerateService studentGoogleEmailGenerateService;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private FacultyRepository facultyRepository;

    @Autowired
    private InstituteBatchGoogleGroupRepository batchGoogleGroupRepository;

    @Autowired
    private StudentService studentService;

    @Autowired
    private FacultyService facultyService;

    @Autowired
    private InstituteBranchRepository instituteBranchRepository;

    @Autowired
    private GoogleGroupHandler ggh;

    @Autowired
    private MemberToGoogleGroupHandler mggh;

    @Autowired
    private UserRepository userRepository;

    public List<String> getAllUserFromAdmin(UserPrincipal user) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(user);
        Users result = service.users().list()
                .setCustomer("my_customer")
                .execute();
        String nextPage = result.getNextPageToken();
        List<User> users = result.getUsers();
        ArrayList<String> email = new ArrayList<String>();
        users.forEach((t) -> email.add(t.getEmails().toString()));
        String e = "xyz@kccitm.edu.in";
        // User UserDataByEmail = service.users().get(e).execute();
        if (!email.contains(e)) {
            User newUser = new User();
            newUser.setEmails(e);
            UserName sName = new UserName();
            sName.setGivenName("Bhavya");
            sName.setFamilyName("Mummy Mere shadi Kara do");
            newUser.setName(sName);
            newUser.setPhones("98991009809");
            newUser.setPassword("Google.com1");
            newUser.setPrimaryEmail(e);
            newUser.set("userKey", e);
            newUser.setSuspended(false);
            newUser.setAgreedToTerms(true);
            User EmailAdd = service.users().insert(newUser).execute();
            email.add(EmailAdd.toString());
        }
        return email;
    }

    public Credential getGoogleCredencials(UserPrincipal userPrincipal) {
        Credential credential = new Credential(BearerToken.authorizationHeaderAccessMethod())
                .setAccessToken(userPrincipal.getGoogleAuthString());
        return credential;
    }

    public List<String> getAllGroupFromAdmin(UserPrincipal group) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(group);
        Groups result = service.groups().list().setCustomer("my_customer").execute();
        String nextPage = result.getNextPageToken();
        List<Group> groups = result.getGroups();
        ArrayList<String> email = new ArrayList<String>();
        groups.forEach((t) -> email.add(t.getEmail().toString()));
        return email;
    }

    public List<Group> getGroupFromAdmin(UserPrincipal group, String query)
            throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(group);
        Groups result = service.groups().list().setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("name:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        List<Group> groups = result.getGroups();
        return groups;
    }

    public List<String> getGroupMemberFromAdmin(UserPrincipal group, String query)
            throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(group);
        Groups result = service.groups().list().setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("name:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        Members members = service.members().list(query).execute();
        List<Member> mem = members.getMembers();
        ArrayList<String> email = new ArrayList<String>();
        mem.forEach((t) -> email.add(t.getEmail().toString()));
        return email;
    }

    public String deleteMemberFromGroup(UserPrincipal member, String query, String query1)
            throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(member);
        Groups result = service.groups().list().setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("name:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        Members members = service.members().list(query).execute();
        List<Member> mem = members.getMembers();
        Void m = service.members().delete(query, query1).execute();
        return null;
    }

    public String addMemberToGroup(UserPrincipal member, String query) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(member);
        Groups result = service.groups().list().setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("name:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        Student st = new Student();
        // var t = st.getOfficialEmailAddress();
        var t = "xyz@kccitm.edu.in";
        Member m = new Member();
        m.setEmail(t);
        Member members = service.members().insert(query, m).execute();
        return null;
    }

    public String addStudentToGroup(UserPrincipal member, int id) throws GeneralSecurityException, IOException {

        try {
            createGoogleUser(member, id);
            Student stu = studentRepository.getById(id).get(0);

            stu.setInstituteGoogleGroup(
                    studentService.getAllGroupEmailIds(stu.getBatch_id(), stu.getBranch_id(), stu.getCourse()));
            Directory service = googleDirectoryService.gooogleDirectory(member);
            ArrayList<String> t = stu.getInstituteGoogleGroup();
            String OfficialEmailId = studentService.getOfficialemailid(stu);

            Member m = new Member();
            m.setEmail(OfficialEmailId);

            for (String i : t) {

                if (!ggh.isGroupExists(i, service)) {
                    ggh.createGroup(i, service);
                } else {
                    System.out.println("Group " + i + " already exists.");
                }
                if (!mggh.isMemberToGroup(i, studentService.getOfficialemailid(stu), service)) {
                    mggh.addMemberToGroup(i, studentService.getOfficialemailid(stu), service);
                } else {
                    System.out.println(
                            "Member " + studentService.getOfficialemailid(stu) + " already exists in group " + i + ".");
                }
            }
        } catch (Exception E) {
            System.out.println(E);
        } finally {
            return null;
        }

    }

    public String addFacultyToGroup(UserPrincipal member, int id) {

        try {
            createFacultyGoogleUser(member, id);
            return "";

        } catch (Exception E) {
            System.out.println(E);
            return "";
        } finally {
            return null;
        }

    }

    public List<String> getAllOrgunitsFromAdmin(UserPrincipal orgunit, Student student)
            throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(orgunit);
        OrgUnits result = service.orgunits().list("my_customer").setOrgUnitPath("/BTECH").execute();
        List<OrgUnit> orgUnits = result.getOrganizationUnits();
        orgUnits.get(0).getOrgUnitPath();
        ArrayList<String> name = new ArrayList<String>();
        orgUnits.forEach((t) -> name.add(t.getName().toString()));
        // String d = student.getBatch();
        String d = "";
        if (!name.contains(d)) {
            OrgUnit orgn = new OrgUnit();
            orgn.setParentOrgUnitPath("/BTECH/CSE");
            // orgn.setOrgUnitPath("CSE");
            orgn.setName("nitya");
            OrgUnit nameAdd = service.orgunits().insert("my_customer", orgn).execute();
            Group gr = new Group();
            gr.setEmail(student.getPersonalEmailAddress());
            gr.setName(d);
            Group groupAdd = service.groups().insert(gr).execute();
            name.add(nameAdd.toString());
        }
        return name;

    }

    public String addGroup(UserPrincipal group, GoogleGroup query) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(group);
        System.out.println(query);
        Group gr = new Group();
        gr.setEmail(query.getEmail());
        gr.setName(query.getName());
        Group groupAdd = service.groups().insert(gr).execute();
        return null;
    }

    public String deleteGroup(UserPrincipal user, String query) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(user);
        Users result = service.users().list()
                .setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("givenName:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        Void g = service.groups().delete(query).execute();
        return null;
    }

    public List<User> getUserByName(UserPrincipal user, String query) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(user);
        Users result = service.users().list()
                .setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("givenName:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        List<User> users = result.getUsers();
        return users;
    }

    public String resetPassword(UserPrincipal user, ForgotPassword query) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(user);
        // List<Student> std = studentRepository.findByPersonalEmailAddress(query);
        Users result = service.users().list()
                .setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("email:" + query.getOfficialEmailAddress() + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        List<User> users = result.getUsers();
        String passW = query.getRollNo();
        users.get(0).setPassword(passW);
        // List<Student> std2 = studentRepository.findByEmailAddress(query);
        List<String> recip = new ArrayList<>();
        // recip.add(std.get(0).getEmailAddress().toString());
        recip.add(query.getPersonalEmailAddress());
        User pass = service.users().update(users.get(0).getId(), users.get(0)).execute();
        studentGoogleEmailGenerateService.resetPasswordMail(new EmailMessage("support@kccitm.email", "KCCITM Support",
                recip,
                "Password Rest for KCCITM", "Your new pasword is :- " + passW));

        return "Bahvya Monday ko aa kar roye gi ;)";
    }

    private String passwordGenrator() {
        byte[] array = new byte[7]; // length is bounded by 7
        new Random().nextBytes(array);
        return new String(array, Charset.forName("UTF-8"));

    }

    @Override
    public List<User> getUserByEmail(UserPrincipal user, String query) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(user);
        Users result = service.users().list()
                .setCustomer("my_customer")
                .setDomain("kccitm.edu.in")
                .setQuery("email:" + query + "*")
                .execute();
        String nextPage = result.getNextPageToken();
        List<User> users = result.getUsers();
        return users;
    }

    public List<String> createGoogleUser(UserPrincipal user, int id) throws GeneralSecurityException, IOException {
        Student st = studentRepository.findById(id);
        Directory service = googleDirectoryService.gooogleDirectory(user);
        ArrayList<String> email = new ArrayList<String>();
        String e = studentService.getOfficialemailid(st);
        Boolean isThereAMemeber = false;
        User UserDataByEmail = null;
        try {
            UserDataByEmail = service.users().get(e).execute();
            isThereAMemeber = true;
        } catch (Exception E) {
            System.out.println(E);
            isThereAMemeber = false;
        }

        if (!isThereAMemeber) {
            User newUser = new User();
            newUser.setEmails(e);
            String orgPath = "KCCITM Faculty";
            // OrgUnit orgUnit = service.orgunits().get("my_customer", orgPath).execute();
            UserName sName = new UserName();
            sName.setGivenName(st.getFirstName());
            sName.setFamilyName(st.getLastName());
            newUser.setName(sName);
            newUser.setPhones(st.getPhoneNumber());
            newUser.setPassword(st.getAadharCardNo() + "KCCITM!");
            newUser.setPrimaryEmail(e);
            newUser.set("userKey", e);
            newUser.setSuspended(false);
            newUser.setAgreedToTerms(true);
            OrgUnit result = null;
            Boolean orgExiti = true;
            try {
                result = service.orgunits().get("my_customer", orgPath).execute();
            } catch (Exception e1) {
                orgExiti = false;
                // TODO: handle exception
            }

            if (orgExiti)
                newUser.setOrgUnitPath(result.getOrgUnitPath());
            else {
                try {
                    OrgUnit orgn = new OrgUnit();
                    String parentPast = "/"
                            + st.getCourseData().getAbbreviation().toUpperCase().trim().replace(".", "").replace(" ",
                                    "")
                            +
                            "/" + st.getBranchData().getAbbreviation().toUpperCase().trim().replace(".", "")
                                    .replace(" ", "");
                    orgn.setParentOrgUnitPath(parentPast);
                    // orgn.setOrgUnitPath("/BTECH/CSE");
                    orgn.setName(st.getBatchData().getBatchEnd());
                    OrgUnit nameAdd = service.orgunits().insert("my_customer", orgn).execute();
                    newUser.setOrgUnitPath(nameAdd.getOrgUnitPath());
                } catch (Exception e2) {
                    System.out.println(e2);
                    // TODO: handle exception
                }
            }
            User EmailAdd = service.users().insert(newUser).execute();
            email.add(EmailAdd.toString());

        }
        // com.kccitm.api.model.User usr = new com.kccitm.api.model.User(st);
        // usr.setEmailVerified(true);
        // usr.setProvider(AuthProvider.google);
        // usr.setDisplay(true);
        // userRepository.save(usr);
        return email;
    }

    public List<String> createFacultyGoogleUser(UserPrincipal user, int id)
            throws GeneralSecurityException, IOException {
        Faculty ft = facultyRepository.findById(id);
        Directory service = googleDirectoryService.gooogleDirectory(user);
        ArrayList<String> email = new ArrayList<String>();
        String e = facultyService.getOfficialemailid(ft);
        Boolean isThereAMemeber = false;
        User UserDataByEmail = null;
        try {
            UserDataByEmail = service.users().get(e).execute();
            isThereAMemeber = true;
        } catch (Exception E) {
            System.out.println(E);
            isThereAMemeber = false;
        }

        if (!isThereAMemeber) {
            User newUser = new User();
            newUser.setEmails(e);
            String orgPath = "KCCITM Faculty";
            // OrgUnit orgUnit = service.orgunits().get("my_customer", orgPath).execute();
            UserName sName = new UserName();
            sName.setGivenName(ft.getFirstName());
            sName.setFamilyName(ft.getLastName());
            newUser.setName(sName);
            newUser.setPhones(ft.getPhoneNumber());
            newUser.setPassword(ft.getAadharCardNo() + "KCCITM!");
            newUser.setPrimaryEmail(e);
            newUser.set("userKey", e);
            newUser.setSuspended(false);
            newUser.setAgreedToTerms(true);
            OrgUnit result = null;
            Boolean orgExiti = true;
            try {
                result = service.orgunits().get("my_customer", orgPath).execute();
            } catch (Exception e1) {
                orgExiti = false;
                // TODO: handle exception
            }

            if (orgExiti)
                newUser.setOrgUnitPath(result.getOrgUnitPath());
            else {
                try {
                    OrgUnit orgn = new OrgUnit();
                    String parentPast = "/";
                    orgn.setParentOrgUnitPath(parentPast);
                    // orgn.setOrgUnitPath("/BTECH/CSE");
                    orgn.setName("KCCITM Faculty");
                    OrgUnit nameAdd = service.orgunits().insert("my_customer", orgn).execute();
                    newUser.setOrgUnitPath(nameAdd.getOrgUnitPath());
                } catch (Exception e2) {
                    System.out.println(e2);
                    // TODO: handle exception
                }
            }
            User EmailAdd = service.users().insert(newUser).execute();
            email.add(EmailAdd.toString());

        }
        // com.kccitm.api.model.User usr = new com.kccitm.api.model.User(st);
        // usr.setEmailVerified(true);
        // usr.setProvider(AuthProvider.google);
        // usr.setDisplay(true);
        // userRepository.save(usr);
        return email;
    }

    public List<String> getAllUser(UserPrincipal user) throws GeneralSecurityException, IOException {
        Directory service = googleDirectoryService.gooogleDirectory(user);

        Users result = service.users().list()
                .setCustomer("my_customer")
                .execute();
        String nextPage = result.getNextPageToken();
        List<User> users = result.getUsers();
        List<String> email = new ArrayList<String>();
        users.forEach((t) -> email.add(t.getEmails().toString()));
        while (nextPage != null) {
            result = result.setNextPageToken(nextPage);
            List<User> users1 = result.getUsers();
            users1.forEach((t) -> email.add(t.getEmails().toString()));
            nextPage = result.getNextPageToken();
        }
        return email;
    }

}
