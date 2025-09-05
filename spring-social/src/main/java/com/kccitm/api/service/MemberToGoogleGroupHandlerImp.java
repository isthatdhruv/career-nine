package com.kccitm.api.service;

import java.io.IOException;
import java.util.List;

import org.springframework.stereotype.Service;

import com.google.api.services.directory.Directory;
import com.google.api.services.directory.model.Member;

@Service
public class MemberToGoogleGroupHandlerImp implements MemberToGoogleGroupHandler {

    @Override
    public void addMemberToGroup(String groupName, String memberEmail, Directory directory) throws IOException {
        Member member = new Member();
        member.setEmail(memberEmail.toLowerCase());
        member.setRole("MEMBER");
        member.setType("USER");
        directory.members().insert(groupName.toLowerCase(), member).execute();

        System.out.println("Member " + memberEmail + " added to group " + groupName + ".");
    }

    @Override
    public boolean isMemberToGroup(String groupName, String memberEmail, Directory directory) throws IOException {
        List<Member> members = directory.members().list(groupName).execute().getMembers();
        try {
            for (Member member : members) {
                if (member.getEmail().equals(memberEmail)) {
                    System.out.println("Member " + memberEmail + " is in group " + groupName + ".");
                    return true;
                }
            }
            System.out.println("Member " + memberEmail + " is in not group " + groupName + ".");
            return false;
        } catch (Exception e) {
            return false;
        }
    }

}
