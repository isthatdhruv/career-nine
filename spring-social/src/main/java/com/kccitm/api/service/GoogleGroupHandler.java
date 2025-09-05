package com.kccitm.api.service;

import java.io.IOException;

import com.google.api.services.directory.Directory;

public interface GoogleGroupHandler {
    
    public boolean isGroupExists(String groupName,Directory directory) throws IOException; 
    public void createGroup(String groupName,Directory directory) throws IOException;    
}
