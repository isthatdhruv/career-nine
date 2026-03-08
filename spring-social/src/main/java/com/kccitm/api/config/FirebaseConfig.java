package com.kccitm.api.config;

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
            ClassPathResource res = new ClassPathResource(serviceAccountFile);
            if (!res.exists()) {
                logger.warn("Firebase service account not found ({}). Firebase features will not be available. Place the service account JSON in src/main/resources or set '{}' property to point to it.", serviceAccountFile, "app.firebase.service-account-file");
                return;
            }

            try (InputStream serviceAccount = res.getInputStream()) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .setProjectId(projectId)
                        .build();

                FirebaseApp.initializeApp(options);
                logger.info("Firebase has been initialized successfully with project: {}", projectId);
            } catch (IOException e) {
                logger.error("Failed to initialize Firebase from {}: {}", serviceAccountFile, e.getMessage());
                logger.warn("Firebase features will not be available. Make sure {} exists in src/main/resources/ or set '{}' to a valid classpath resource.", serviceAccountFile, "app.firebase.service-account-file");
            }
        }
    }
}
