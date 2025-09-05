package com.kccitm.api.service;

import java.io.IOException;

import com.google.api.services.directory.Directory;

public interface MemberToGoogleGroupHandler {
    public boolean isMemberToGroup(String groupName, String memberEmail,Directory directory) throws IOException;
    public void addMemberToGroup(String groupName, String memberEmail,Directory directory) throws IOException;
}
