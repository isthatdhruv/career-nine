package com.kccitm.api.config;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${app.firebase.project-id:career-9-assessment}")
    private String projectId;

    @Value("${app.firebase.service-account-file:firebase-service-account.json}")
    private String serviceAccountFile;

    @Value("${app.firebase.enabled:true}")
    private boolean firebaseEnabled;

    @PostConstruct
    public void initialize() {
        if (!firebaseEnabled) {
            logger.info("Firebase disabled via app.firebase.enabled=false");
            return;
        }

        if (FirebaseApp.getApps().isEmpty()) {

            try (InputStream serviceAccount = resolveCredentialStream(serviceAccountFile)) {
                if (serviceAccount == null) {
                    logger.warn("Firebase service account not found ({}). Firebase features will not be available.", serviceAccountFile);
                    return;
                }
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .setProjectId(projectId)
                        .build();

                FirebaseApp.initializeApp(options);
                logger.info("Firebase has been initialized successfully with project: {}", projectId);
            } catch (IOException e) {
                logger.error("Failed to initialize Firebase from {}: {}", serviceAccountFile, e.getMessage());
            }
        }
    }

    private InputStream resolveCredentialStream(String path) throws IOException {
        // Try as absolute file path first (e.g. volume-mounted at /config/firebase-service-account.json)
        File file = new File(path);
        if (file.isAbsolute() && file.exists()) {
            logger.info("Loading Firebase credentials from filesystem: {}", path);
            return new FileInputStream(file);
        }
        // Fall back to classpath resource
        ClassPathResource res = new ClassPathResource(path);
        if (res.exists()) {
            logger.info("Loading Firebase credentials from classpath: {}", path);
            return res.getInputStream();
        }
        return null;
    }
}
