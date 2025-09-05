package com.kccitm.api.service;

import java.io.IOException;

import org.springframework.stereotype.Service;

import com.google.api.services.directory.Directory;
import com.google.api.services.directory.model.Group;

@Service
public class GoogleGroupHandlerImpl implements GoogleGroupHandler {

    @Override
    public void createGroup(String groupName,Directory directory) throws IOException {
        Group group = new Group();
        group.setEmail(groupName);
        group.setName(groupName);
        group.setDescription(groupName);
        directory.groups().insert(group).execute();
        System.out.println("Group " + groupName + " created.");
    }

    @Override
    public boolean isGroupExists(String groupName,Directory directory) throws IOException {
        try {
            directory.groups().get(groupName).execute();
            return true;
          } catch (Exception e) {
            return false;
          }
         }

}
