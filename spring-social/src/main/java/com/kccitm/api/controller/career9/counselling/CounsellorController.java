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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository slotRepository;

    // Phase 2 (Task 2.2 / HIGH-A): shared BCrypt encoder (replaces inline unsalted SHA-256).
    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * POST /api/counsellor/self-register
     * Public endpoint for counsellors to create an account.
     * Sets onboardingStatus = PENDING, isActive = false.
     * Counsellor cannot login until admin sets isActive = true.
     */
    // Phase 2 (Task 2.2 / HIGH-A): anonymous pre-auth self-registration. @PreAuthorize removed so
    // the enforce flip won't 403 prospective counsellors; permitAll via PUBLIC_PATHS. Coverage-excluded.
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

        // Phase 2 (Task 2.2 / HIGH-A): hash with BCrypt (salted, work-factored) via the shared
        // encoder instead of the previous unsalted SHA-256.
        counsellor.setPasswordHash(passwordEncoder.encode(password));

        // Optional onboarding fields
        if (body.get("specializations") != null) counsellor.setSpecializations((String) body.get("specializations"));
        if (body.get("bio") != null) counsellor.setBio((String) body.get("bio"));
        if (body.get("languagesSpoken") != null) counsellor.setLanguagesSpoken((String) body.get("languagesSpoken"));
        if (body.get("modeCapability") != null) counsellor.setModeCapability((String) body.get("modeCapability"));
        if (body.get("officeAddress") != null) counsellor.setOfficeAddress((String) body.get("officeAddress"));
        if (body.get("qualifications") != null) counsellor.setQualifications((String) body.get("qualifications"));
        if (body.get("yearsOfExperience") != null) counsellor.setYearsOfExperience(((Number) body.get("yearsOfExperience")).intValue());
        if (body.get("linkedinProfile") != null) counsellor.setLinkedinProfile((String) body.get("linkedinProfile"));
        if (body.get("maxSessionsPerDay") != null) counsellor.setMaxSessionsPerDay(((Number) body.get("maxSessionsPerDay")).intValue());
        if (body.get("workTime") != null) counsellor.setWorkTime((String) body.get("workTime"));
        if (body.get("counsellorType") != null) counsellor.setCounsellorType((String) body.get("counsellorType"));
        if (body.get("profileImageUrl") != null) counsellor.setProfileImageUrl((String) body.get("profileImageUrl"));

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
    // Phase 2 (Task 2.2 / HIGH-A): anonymous pre-auth login. @PreAuthorize removed so the enforce
    // flip won't 403 the login itself; permitAll via PUBLIC_PATHS, rate-limited generically. Coverage-excluded.
    // NOTE (deferred): this still returns the counsellor record without issuing a scoped session
    // token/cookie — the counsellor portal currently trusts the client. Issuing a real cn_at-style
    // session is FE-coupled and tracked as a follow-up (Phase 2 residual).
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

        // Phase 2 (Task 2.2 / HIGH-A): verify against BCrypt, with a one-time fallback that accepts a
        // legacy unsalted-SHA-256 hash and transparently re-hashes to BCrypt on success (no forced reset).
        if (!verifyAndUpgradePassword(counsellor, password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid email or password"));
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
     * Phase 2 (Task 2.2): verify a raw password against the stored hash. BCrypt hashes (the new
     * format, prefixed {@code $2}) are checked with the shared encoder. A legacy unsalted-SHA-256
     * hex hash is accepted once and immediately re-hashed to BCrypt on success, so existing
     * counsellors keep logging in without a forced reset and are migrated transparently.
     */
    private boolean verifyAndUpgradePassword(Counsellor counsellor, String rawPassword) {
        String stored = counsellor.getPasswordHash();
        if (stored == null || stored.isEmpty()) {
            return false;
        }
        if (stored.startsWith("$2")) { // BCrypt
            return passwordEncoder.matches(rawPassword, stored);
        }
        // Legacy unsalted SHA-256 (64 hex chars) — accept once, then upgrade to BCrypt.
        String legacy = sha256Hex(rawPassword);
        if (legacy != null && legacy.equals(stored)) {
            counsellor.setPasswordHash(passwordEncoder.encode(rawPassword));
            counsellorRepository.save(counsellor);
            logger.info("Counsellor {} password migrated SHA-256 -> BCrypt on login", counsellor.getEmail());
            return true;
        }
        return false;
    }

    private static String sha256Hex(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * POST /api/counsellor/upload-photo/{id}
     * Upload a profile photo as base64 data URL.
     * Body: { "photo": "data:image/png;base64,..." }
     */
    // no scope arg: update by id; counsellor self-update photo
    @PreAuthorize("@auth.allows('counsellor.update')")
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

    // no scope arg: body is Counsellor entity; admin-only create
    @PreAuthorize("@auth.allows('counsellor.create')")
    @PostMapping("/create")
    public ResponseEntity<Counsellor> create(@RequestBody Counsellor counsellor) {
        logger.info("Creating new counsellor: {}", counsellor.getName());
        return ResponseEntity.ok(counsellorService.create(counsellor));
    }

    // no scope arg: catalog list — counsellor entries are global
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/getAll")
    public ResponseEntity<List<Counsellor>> getAll() {
        return ResponseEntity.ok(counsellorService.getAll());
    }

    // no scope arg: catalog list — active counsellors
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/getActive")
    public ResponseEntity<List<Counsellor>> getActive() {
        return ResponseEntity.ok(counsellorService.getAllActive());
    }

    // no scope arg: fetch by id
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/get/{id}")
    public ResponseEntity<Counsellor> getById(@PathVariable Long id) {
        return counsellorService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // no scope arg: fetch by user id
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/get/by-user/{userId}")
    public ResponseEntity<Counsellor> getByUserId(@PathVariable Long userId) {
        return counsellorService.getByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Dashboard summary for a counsellor: today's sessions plus headline counts
     * (booked vs free slots this week, upcoming, completed, pending).
     */
    // no scope arg: identifies by counsellorId; scope-filter narrows access
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/{id}/dashboard-summary")
    public ResponseEntity<?> dashboardSummary(@PathVariable Long id) {
        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate weekEnd = today.plusDays(6);

        // Today's confirmed/in-progress sessions.
        java.util.List<com.kccitm.api.model.career9.counselling.CounsellingAppointment> todays =
                appointmentRepository.findByCounsellorIdAndDate(id, today);
        java.util.List<Map<String, Object>> todaysDtos = new java.util.ArrayList<>();
        for (com.kccitm.api.model.career9.counselling.CounsellingAppointment a : todays) {
            Map<String, Object> d = new java.util.HashMap<>();
            d.put("appointmentId", a.getId());
            d.put("startTime", a.getSlot() != null ? String.valueOf(a.getSlot().getStartTime()) : null);
            d.put("status", a.getStatus());
            d.put("mode", a.getMode());
            d.put("attended", a.getAttended());
            d.put("studentName", a.getStudentContactName());
            d.put("studentPhone", a.getStudentContactPhone());
            todaysDtos.add(d);
        }

        // Slot occupancy this week.
        long freeSlots = 0, bookedSlots = 0;
        for (com.kccitm.api.model.career9.counselling.CounsellingSlot s :
                slotRepository.findByCounsellorIdAndDateBetween(id, today, weekEnd)) {
            String st = s.getStatus();
            if ("AVAILABLE".equals(st) && !Boolean.TRUE.equals(s.getIsBlocked())) freeSlots++;
            else if ("REQUESTED".equals(st) || "BOOKED".equals(st)) bookedSlots++;
        }

        Map<String, Object> out = new java.util.HashMap<>();
        out.put("date", today.toString());
        out.put("todayCount", todays.size());
        out.put("todaysAppointments", todaysDtos);
        out.put("freeSlotsThisWeek", freeSlots);
        out.put("bookedSlotsThisWeek", bookedSlots);
        out.put("upcomingCount",
                appointmentRepository.countByCounsellorAndStatusInRange(id, "CONFIRMED", today, today.plusDays(30)));
        out.put("completedCount",
                appointmentRepository.countByCounsellorAndStatusInRange(id, "COMPLETED", today.minusDays(365), today.plusDays(1)));
        out.put("pendingCount",
                appointmentRepository.countByCounsellorAndStatusInRange(id, "REQUESTED", today, today.plusDays(30)));
        return ResponseEntity.ok(out);
    }

    // no scope arg: update by id; admin-only
    @PreAuthorize("@auth.allows('counsellor.update')")
    @PutMapping("/update/{id}")
    public ResponseEntity<Counsellor> update(@PathVariable Long id, @RequestBody Counsellor counsellor) {
        logger.info("Updating counsellor with id: {}", id);
        return ResponseEntity.ok(counsellorService.update(id, counsellor));
    }

    // no scope arg: toggle by id; admin-only approval action
    @PreAuthorize("@auth.allows('counsellor.update')")
    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<Counsellor> toggleActive(@PathVariable Long id) {
        logger.info("Toggling active status for counsellor with id: {}", id);
        return ResponseEntity.ok(counsellorService.toggleActive(id));
    }
}
