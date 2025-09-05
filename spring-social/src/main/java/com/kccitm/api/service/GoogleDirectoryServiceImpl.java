package com.kccitm.api.service;

import java.io.IOException;
import java.security.GeneralSecurityException;

import org.springframework.stereotype.Service;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.directory.Directory;
import com.kccitm.api.security.UserPrincipal;

@Service
public class GoogleDirectoryServiceImpl implements GoogleDirectoryService {
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    public Directory gooogleDirectory(UserPrincipal data) throws GeneralSecurityException, IOException {
        NetHttpTransport HTTP_TRANSPORT;
        Directory service;
        HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
        return new Directory.Builder(HTTP_TRANSPORT, JSON_FACTORY, getGoogleCredencials(data))
                .setApplicationName("Utkrisht")
                .build();
    }

    public Credential getGoogleCredencials(UserPrincipal userPrincipal) {
        Credential credential = new Credential(BearerToken.authorizationHeaderAccessMethod())
                .setAccessToken(userPrincipal.getGoogleAuthString());
        return credential;
    }
}
