package com.kccitm.api.config;

import java.io.IOException;
import java.io.InputStream;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;

@Configuration
public class FirebaseConfig {
    
    @Value("${firebase.project-id:career-library}")
    private String projectId;
    
    @Value("${firebase.service-account-file:firebase-service-account.json}")
    private String serviceAccountFile;
    
    @PostConstruct
    public void initialize() {
        try {
            InputStream serviceAccount = null;
            
            // Try to load service account from classpath
            try {
                ClassPathResource resource = new ClassPathResource(serviceAccountFile);
                if (resource.exists()) {
                    serviceAccount = resource.getInputStream();
                }
            } catch (Exception e) {
                // If service account file is not found, try to use default credentials
                System.out.println("Service account file not found, attempting to use default credentials");
            }
            
            FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder()
                    .setProjectId(projectId);
            
            if (serviceAccount != null) {
                GoogleCredentials credentials = GoogleCredentials.fromStream(serviceAccount);
                optionsBuilder.setCredentials(credentials);
            } else {
                // Use default credentials (for local development or when running on GCP)
                optionsBuilder.setCredentials(GoogleCredentials.getApplicationDefault());
            }
            
            FirebaseOptions options = optionsBuilder.build();
            
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
                System.out.println("Firebase has been initialized successfully!");
            }
            
        } catch (IOException e) {
            System.err.println("Error initializing Firebase: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    @Bean
    public FirebaseAuth firebaseAuth() {
        return FirebaseAuth.getInstance();
    }
    
    @Bean
    public Firestore firestore() {
        return FirestoreClient.getFirestore();
    }
}
