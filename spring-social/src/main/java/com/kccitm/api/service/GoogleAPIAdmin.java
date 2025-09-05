package com.kccitm.api.service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

import com.google.api.services.directory.model.Group;
import com.google.api.services.directory.model.User;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.userDefinedModel.ForgotPassword;
import com.kccitm.api.model.userDefinedModel.GoogleGroup;
import com.kccitm.api.security.UserPrincipal;

public interface GoogleAPIAdmin {
        public List<String> getAllUserFromAdmin(UserPrincipal user)
                        throws GeneralSecurityException, IOException;

        public List<String> getAllGroupFromAdmin(UserPrincipal group)
                        throws GeneralSecurityException, IOException;

        public List<String> getAllOrgunitsFromAdmin(UserPrincipal orgunit, Student student)
                        throws GeneralSecurityException, IOException;

        public List<User> getUserByName(UserPrincipal user, String query)
                        throws GeneralSecurityException, IOException;

        public List<User> getUserByEmail(UserPrincipal user, String query)
                        throws GeneralSecurityException, IOException;

        public String resetPassword(UserPrincipal user, ForgotPassword query)
                        throws GeneralSecurityException, IOException;

        public List<Group> getGroupFromAdmin(UserPrincipal group, String query)
                        throws GeneralSecurityException, IOException;

        public List<String> getGroupMemberFromAdmin(UserPrincipal group, String query)
                        throws GeneralSecurityException, IOException;

        public String deleteMemberFromGroup(UserPrincipal group, String query, String query1)
                        throws GeneralSecurityException, IOException;

        public String deleteGroup(UserPrincipal user, String query)
                        throws GeneralSecurityException, IOException;

        public String addGroup(UserPrincipal group, GoogleGroup query)
                        throws GeneralSecurityException, IOException;

        public String addMemberToGroup(UserPrincipal member, String query)
                        throws GeneralSecurityException, IOException;

        public String addStudentToGroup(UserPrincipal member, int id)
                        throws GeneralSecurityException, IOException;

        public String addFacultyToGroup(UserPrincipal member, int id)
                        throws GeneralSecurityException, IOException;

        public List<String> getAllUser(UserPrincipal user) throws GeneralSecurityException, IOException;
}
