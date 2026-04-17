package com.kccitm.api.controller.career9.counselling;

import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.counselling.CounsellorService;

@RestController
@RequestMapping("/api/counsellor")
public class CounsellorController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorController.class);

    @Autowired
    private CounsellorService counsellorService;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private DigitalOceanSpacesService spacesService;

    @Autowired
    private com.kccitm.api.service.counselling.CounsellingActivityLogService activityLogService;

    /**
     * POST /api/counsellor/self-register
     * Public endpoint for counsellors to create an account.
     * Sets onboardingStatus = PENDING, isActive = false.
     * Counsellor cannot login until admin sets isActive = true.
     */
    @PostMapping("/self-register")
    public ResponseEntity<?> selfRegister(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String email = (String) body.get("email");
        String phone = (String) body.get("phone");
        String password = (String) body.get("password");

        if (name == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name, email, and password are required"));
        }

        // Check duplicate email
        Optional<Counsellor> existing = counsellorRepository.findByEmail(email.trim());
        if (existing.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "A counsellor with this email already exists"));
        }

        Counsellor counsellor = new Counsellor();
        counsellor.setName(name.trim());
        counsellor.setEmail(email.trim());
        counsellor.setPhone(phone != null ? phone.trim() : null);
        counsellor.setOnboardingStatus("PENDING");
        counsellor.setIsActive(false);

        // Hash password with SHA-256
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            counsellor.setPasswordHash(sb.toString());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to process registration"));
        }

        // Optional onboarding fields
        if (body.get("specializations") != null) counsellor.setSpecializations((String) body.get("specializations"));
        if (body.get("bio") != null) counsellor.setBio((String) body.get("bio"));
        if (body.get("languagesSpoken") != null) counsellor.setLanguagesSpoken((String) body.get("languagesSpoken"));
        if (body.get("modeCapability") != null) counsellor.setModeCapability((String) body.get("modeCapability"));
        if (body.get("qualifications") != null) counsellor.setQualifications((String) body.get("qualifications"));
        if (body.get("yearsOfExperience") != null) counsellor.setYearsOfExperience(((Number) body.get("yearsOfExperience")).intValue());
        if (body.get("linkedinProfile") != null) counsellor.setLinkedinProfile((String) body.get("linkedinProfile"));
        if (body.get("maxSessionsPerDay") != null) counsellor.setMaxSessionsPerDay(((Number) body.get("maxSessionsPerDay")).intValue());

        Counsellor saved = counsellorService.create(counsellor);
        logger.info("Counsellor self-registered: {} ({})", saved.getName(), saved.getEmail());

        activityLogService.log("COUNSELLOR_REGISTERED", "New Counsellor Registration",
                saved.getName() + " (" + saved.getEmail() + ") has registered and is awaiting approval.", saved);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Registration submitted successfully. You will be able to login once an administrator approves your account.",
                "counsellorId", saved.getId(),
                "status", "PENDING"));
    }

    /**
     * POST /api/counsellor/login
     * Counsellor login with email + password.
     * Only allows login if isActive = true (admin approved).
     */
    @PostMapping("/login")
    public ResponseEntity<?> counsellorLogin(@RequestBody Map<String, Object> body) {
        String email = (String) body.get("email");
        String password = (String) body.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        Optional<Counsellor> counsellorOpt = counsellorRepository.findByEmail(email.trim());
        if (!counsellorOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid email or password"));
        }

        Counsellor counsellor = counsellorOpt.get();

        // Verify password
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            String inputHash = sb.toString();

            if (counsellor.getPasswordHash() == null || !counsellor.getPasswordHash().equals(inputHash)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid email or password"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Login failed"));
        }

        // Check if admin approved
        if (!Boolean.TRUE.equals(counsellor.getIsActive())) {
            String status = counsellor.getOnboardingStatus();
            if ("PENDING".equals(status) || "UNDER_REVIEW".equals(status)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "Your account is pending approval. Please wait for an administrator to activate your account.",
                        "status", status));
            }
            if ("SUSPENDED".equals(status)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "Your account has been suspended. Please contact the administrator.",
                        "status", "SUSPENDED"));
            }
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Your account is not active. Please contact the administrator.",
                    "status", status != null ? status : "INACTIVE"));
        }

        logger.info("Counsellor logged in: {} ({})", counsellor.getName(), counsellor.getEmail());

        return ResponseEntity.ok(Map.of(
                "counsellorId", counsellor.getId(),
                "name", counsellor.getName(),
                "email", counsellor.getEmail(),
                "phone", counsellor.getPhone() != null ? counsellor.getPhone() : "",
                "specializations", counsellor.getSpecializations() != null ? counsellor.getSpecializations() : "",
                "isActive", counsellor.getIsActive(),
                "onboardingStatus", counsellor.getOnboardingStatus() != null ? counsellor.getOnboardingStatus() : ""));
    }

    /**
     * POST /api/counsellor/upload-photo/{id}
     * Upload a profile photo as base64 data URL.
     * Body: { "photo": "data:image/png;base64,..." }
     */
    @PostMapping("/upload-photo/{id}")
    public ResponseEntity<?> uploadPhoto(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String photo = (String) body.get("photo");
        if (photo == null || !photo.startsWith("data:image")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid image data"));
        }

        Counsellor counsellor = counsellorRepository.findById(id).orElse(null);
        if (counsellor == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            String url = spacesService.uploadBase64File(photo, "counsellor-photos", "counsellor-" + id);
            counsellor.setProfileImageUrl(url);
            counsellorRepository.save(counsellor);
            logger.info("Uploaded profile photo for counsellor {}", id);
            return ResponseEntity.ok(Map.of("profileImageUrl", url));
        } catch (Exception e) {
            logger.error("Failed to upload photo for counsellor {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload photo. Please try again."));
        }
    }

    @PostMapping("/create")
    public ResponseEntity<Counsellor> create(@RequestBody Counsellor counsellor) {
        logger.info("Creating new counsellor: {}", counsellor.getName());
        return ResponseEntity.ok(counsellorService.create(counsellor));
    }

    @GetMapping("/getAll")
    public ResponseEntity<List<Counsellor>> getAll() {
        return ResponseEntity.ok(counsellorService.getAll());
    }

    @GetMapping("/getActive")
    public ResponseEntity<List<Counsellor>> getActive() {
        return ResponseEntity.ok(counsellorService.getAllActive());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<Counsellor> getById(@PathVariable Long id) {
        return counsellorService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/get/by-user/{userId}")
    public ResponseEntity<Counsellor> getByUserId(@PathVariable Long userId) {
        return counsellorService.getByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<Counsellor> update(@PathVariable Long id, @RequestBody Counsellor counsellor) {
        logger.info("Updating counsellor with id: {}", id);
        return ResponseEntity.ok(counsellorService.update(id, counsellor));
    }

    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<Counsellor> toggleActive(@PathVariable Long id) {
        logger.info("Toggling active status for counsellor with id: {}", id);
        return ResponseEntity.ok(counsellorService.toggleActive(id));
    }
}
