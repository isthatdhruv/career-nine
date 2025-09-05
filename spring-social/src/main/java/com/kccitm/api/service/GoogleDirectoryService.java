package com.kccitm.api.service;

import java.security.GeneralSecurityException;

import com.google.api.services.directory.Directory;
import com.kccitm.api.security.UserPrincipal;

import io.jsonwebtoken.io.IOException;

public interface GoogleDirectoryService {
    public Directory gooogleDirectory(UserPrincipal data) throws GeneralSecurityException, IOException, java.io.IOException;
}
