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
    private com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository slotRepository;

    @Autowired
    private SlotMaterializationService slotMaterializationService;

    @Autowired
    private CounsellingClock counsellingClock;

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
        if (updated.getCompanyName() != null) {
            existing.setCompanyName(updated.getCompanyName());
        }
        String newMeetingLink = null;
        if (updated.getMeetingLink() != null) {
            newMeetingLink = updated.getMeetingLink().trim();
            existing.setMeetingLink(newMeetingLink);
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
        Counsellor saved = counsellorRepository.save(existing);

        // The Teams room is copied onto each appointment at booking time, so a counsellor
        // swapping their permanent link would leave already-booked sessions pointing at the
        // old room. Re-point the ones that haven't happened yet.
        if (newMeetingLink != null && !newMeetingLink.isEmpty()) {
            try {
                List<com.kccitm.api.model.career9.counselling.CounsellingAppointment> upcoming =
                        appointmentRepository.findUpcomingOnlineByCounsellor(id, java.time.LocalDate.now());
                int repointed = 0;
                for (com.kccitm.api.model.career9.counselling.CounsellingAppointment a : upcoming) {
                    // Never clobber a link an admin set by hand for one specific session.
                    if ("MANUAL".equals(a.getMeetingLinkSource())) continue;
                    if (newMeetingLink.equals(a.getMeetingLink())) continue;
                    a.setMeetingLink(newMeetingLink);
                    appointmentRepository.save(a);
                    repointed++;
                }
                if (repointed > 0) {
                    logger.info("Re-pointed {} upcoming online appointment(s) to counsellor {}'s new Teams link",
                            repointed, id);
                }
            } catch (Exception e) {
                logger.warn("Could not re-point upcoming appointments for counsellor {}: {}", id, e.getMessage());
            }
        }

        return saved;
    }

    public Counsellor toggleActive(Long id) {
        Counsellor counsellor = counsellorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Counsellor not found with id: " + id));
        return setActive(counsellor, !counsellor.getIsActive());
    }

    /**
     * Activate or suspend the counsellor attached to this login user, if there is one.
     *
     * <p>Counsellor approval is one decision with two front doors: Manage Counsellors and
     * User Management. They used to write different flags — the counsellor screen set
     * {@code Counsellor.isActive} and pushed it down onto the User, while the user screen set
     * {@code User.isActive} alone. Activating from User Management therefore let the person
     * log in while leaving the counsellor record suspended: no portal permissions, and
     * invisible to students booking a session. Both doors now run this same code.
     *
     * <p>A user with no counsellor record is left alone — the caller has already updated
     * {@code User.isActive}, which is all an ordinary user has.
     *
     * @return true when a counsellor record was found and updated
     */
    public boolean setActiveForUser(Long userId, boolean active) {
        if (userId == null) return false;
        Optional<Counsellor> found = counsellorRepository.findByUserId(userId);
        if (found.isEmpty()) return false;
        Counsellor counsellor = found.get();
        if (Boolean.valueOf(active).equals(counsellor.getIsActive())) return true; // already there
        setActive(counsellor, active);
        return true;
    }

    /** The single place a counsellor's approval state changes, whichever screen asked for it. */
    /**
     * Flip approval on a counsellor already in hand.
     *
     * <p>Exposed for the deactivation cascade, which has settled the diary first and must
     * suspend that same instance — going back through {@link #toggleActive(Long)} would
     * re-read the row and flip whatever it found, which is not the same statement.
     */
    public Counsellor setActiveForCounsellor(Counsellor counsellor, boolean active) {
        return setActive(counsellor, active);
    }

    private Counsellor setActive(Counsellor counsellor, boolean newActive) {
        Long id = counsellor.getId();
        counsellor.setIsActive(newActive);
        counsellor.setOnboardingStatus(newActive ? "ACTIVE" : "SUSPENDED");
        logger.debug("Toggled counsellor id: {} → isActive={}, onboardingStatus={}", id, newActive, counsellor.getOnboardingStatus());

        // Deallot / reallot the diary in the same breath, whichever door asked (the
        // toggle, User Management, or the deactivation cascade). Suspension closes
        // every future hour still open for booking — a suspended counsellor takes no
        // new appointments, at all (the listing filters and book/hold guards enforce
        // that too; this keeps the panels honest). Reactivation regenerates slots
        // from the weekly templates so the diary comes back without waiting for the
        // next materialization run. Best-effort — never block the toggle itself.
        try {
            if (newActive) {
                int created = slotMaterializationService.materializeSlotsForCounsellor(id);
                logger.info("Counsellor {} reactivated — {} slots re-materialized", id, created);
            } else {
                int closed = slotRepository.closeFutureAvailableByCounsellor(id, counsellingClock.today());
                logger.info("Counsellor {} suspended — {} open future slots closed", id, closed);
            }
        } catch (Exception e) {
            logger.warn("Slot sweep after counsellor {} active={} failed (flags still applied): {}",
                    id, newActive, e.getMessage());
        }

        // Keep the linked login User in lock-step with approval. Best-effort — never block
        // the admin's toggle on an auth-wiring hiccup.
        //
        // Activation deliberately grants NO role. Approval and authorization are separate
        // decisions with separate owners: this button says "this person is a real counsellor
        // and may sign in", and Roles & Permissions says what they may then do. Attaching the
        // `counsellor` role group here meant activation quietly handed out permissions from a
        // screen that shows none of them, so what a counsellor could do was set in a place
        // nobody thought to look. An activated counsellor with no role group signs in to an
        // empty portal until someone assigns one.
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
            }
        } catch (Exception e) {
            logger.warn("Counsellor {} login-user sync failed on toggle: {}", id, e.getMessage());
        }

        Counsellor saved = counsellorRepository.save(counsellor);

        activityLogService.log(
                newActive ? "COUNSELLOR_ACTIVATED" : "COUNSELLOR_SUSPENDED",
                newActive ? "Counsellor Activated" : "Counsellor Suspended",
                "Counsellor: " + counsellor.getName() + "\n"
                + "Email: " + counsellor.getEmail() + "\n"
                + "Status: " + (newActive ? "active — can sign in and take sessions"
                                          : "suspended — cannot sign in or be booked"),
                counsellor, "Admin");

        return saved;
    }
}
