package com.kccitm.api.service.counselling;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.UserRepository;

@Service
public class CounsellorService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorService.class);

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private CounsellingActivityLogService activityLogService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CounsellorProvisioningService provisioningService;

    public Counsellor create(Counsellor counsellor) {
        return counsellorRepository.save(counsellor);
    }

    public List<Counsellor> getAllActive() {
        return counsellorRepository.findByIsActiveTrueAndOnboardingStatus("ACTIVE");
    }

    public List<Counsellor> getAll() {
        return counsellorRepository.findAll();
    }

    public Optional<Counsellor> getById(Long id) {
        return counsellorRepository.findById(id);
    }

    public Optional<Counsellor> getByUserId(Long userId) {
        return counsellorRepository.findByUserId(userId);
    }

    public Counsellor update(Long id, Counsellor updated) {
        Counsellor existing = counsellorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Counsellor not found with id: " + id));

        if (updated.getName() != null) {
            existing.setName(updated.getName());
        }
        if (updated.getEmail() != null) {
            existing.setEmail(updated.getEmail());
        }
        if (updated.getPhone() != null) {
            existing.setPhone(updated.getPhone());
        }
        if (updated.getSpecializations() != null) {
            existing.setSpecializations(updated.getSpecializations());
        }
        if (updated.getBio() != null) {
            existing.setBio(updated.getBio());
        }
        if (updated.getProfileImageUrl() != null) {
            existing.setProfileImageUrl(updated.getProfileImageUrl());
        }
        if (updated.getLanguagesSpoken() != null) {
            existing.setLanguagesSpoken(updated.getLanguagesSpoken());
        }
        if (updated.getModeCapability() != null) {
            existing.setModeCapability(updated.getModeCapability());
        }
        if (updated.getOfficeAddress() != null) {
            existing.setOfficeAddress(updated.getOfficeAddress());
        }
        if (updated.getQualifications() != null) {
            existing.setQualifications(updated.getQualifications());
        }
        if (updated.getYearsOfExperience() != null) {
            existing.setYearsOfExperience(updated.getYearsOfExperience());
        }
        if (updated.getLinkedinProfile() != null) {
            existing.setLinkedinProfile(updated.getLinkedinProfile());
        }
        if (updated.getMaxSessionsPerDay() != null) {
            existing.setMaxSessionsPerDay(updated.getMaxSessionsPerDay());
        }
        if (updated.getHourlyRatePreference() != null) {
            existing.setHourlyRatePreference(updated.getHourlyRatePreference());
        }
        if (updated.getGovtIdLast4() != null) {
            existing.setGovtIdLast4(updated.getGovtIdLast4());
        }
        if (updated.getBankName() != null) {
            existing.setBankName(updated.getBankName());
        }
        if (updated.getBankAccount() != null) {
            existing.setBankAccount(updated.getBankAccount());
        }
        if (updated.getBankIfsc() != null) {
            existing.setBankIfsc(updated.getBankIfsc());
        }
        if (updated.getBankBranch() != null) {
            existing.setBankBranch(updated.getBankBranch());
        }

        logger.debug("Updating counsellor with id: {}", id);
        return counsellorRepository.save(existing);
    }

    public Counsellor toggleActive(Long id) {
        Counsellor counsellor = counsellorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Counsellor not found with id: " + id));

        boolean newActive = !counsellor.getIsActive();
        counsellor.setIsActive(newActive);
        counsellor.setOnboardingStatus(newActive ? "ACTIVE" : "SUSPENDED");
        logger.debug("Toggled counsellor id: {} → isActive={}, onboardingStatus={}", id, newActive, counsellor.getOnboardingStatus());

        // Counselling Phase 1: keep the linked login User in lock-step with approval, and
        // provision the counsellor role group/scope on activation so the portal's
        // counsellor.* / counselling.* permission checks resolve. Best-effort — never block
        // the admin's toggle on an auth-wiring hiccup.
        try {
            User user = counsellor.getUser();
            if (user == null && newActive) {
                // First approval of a counsellor with no linked login User yet: reuse an
                // existing local user with the same email, else create one (provider=local,
                // reusing the counsellor's BCrypt password_hash so the unified /auth/login
                // accepts the same credentials the counsellor registered with). Done in Java
                // (post ddl-auto) so Hibernate maps every student_user column correctly —
                // this replaces the removed raw-SQL backfill in V20260610001.
                if (counsellor.getEmail() != null) {
                    user = userRepository.findByEmailAndProvider(counsellor.getEmail().trim(), AuthProvider.local);
                }
                if (user == null) {
                    user = new User();
                    user.setName(counsellor.getName());
                    user.setEmail(counsellor.getEmail() != null ? counsellor.getEmail().trim() : null);
                    user.setPhone(counsellor.getPhone());
                    user.setPassword(counsellor.getPasswordHash()); // already BCrypt-hashed
                    user.setProvider(AuthProvider.local);
                    user.setEmailVerified(true);
                    user.setIsSuperAdmin(false);
                    user.setDisplay(true);
                }
                counsellor.setUser(user);
            }
            if (user != null) {
                user.setIsActive(newActive);
                userRepository.save(user);
                if (newActive) {
                    provisioningService.provision(user.getId(), null); // wildcard institute scope
                }
            }
        } catch (Exception e) {
            logger.warn("Counsellor {} login-user sync/provisioning failed on toggle: {}", id, e.getMessage());
        }

        Counsellor saved = counsellorRepository.save(counsellor);

        activityLogService.log(
                newActive ? "COUNSELLOR_ACTIVATED" : "COUNSELLOR_SUSPENDED",
                newActive ? "Counsellor Activated" : "Counsellor Suspended",
                counsellor.getName() + " (" + counsellor.getEmail() + ") has been " + (newActive ? "activated" : "suspended") + ".",
                counsellor, "Admin");

        return saved;
    }
}
