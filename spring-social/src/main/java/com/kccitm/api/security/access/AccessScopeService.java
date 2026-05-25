package com.kccitm.api.security.access;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.ContactPersonAccessLevel;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.ContactPersonAccessLevelRepository;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.security.UserPrincipal;

/**
 * Builds an {@link AccessScope} for an authenticated user from their
 * {@code ContactPerson} rows and the attached {@code ContactPersonAccessLevel}s.
 *
 * <p>The returned {@code Optional} signals the super-admin bypass: an empty
 * Optional means "no filtering — see everything", same convention as the
 * {@code AuthorizationService} super-admin short-circuit. A present-but-empty
 * {@link AccessScope} (no institutes, no rules) means the user has been
 * granted nothing yet and should see nothing (deny-by-default).
 */
@Service
public class AccessScopeService {

    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @Autowired
    private ContactPersonAccessLevelRepository accessLevelRepository;

    /**
     * Build the access scope for the currently authenticated user.
     *
     * @return {@code Optional.empty()} when the caller is a super-admin (no
     *         filtering should apply); otherwise an {@link AccessScope}
     *         populated from the user's contact-person mappings. Returns an
     *         empty scope (deny-all) when the caller is unauthenticated or
     *         has no contact-person rows.
     */
    public Optional<AccessScope> forCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal)) {
            // No principal — empty scope (deny). Callers may special-case this if
            // they want anonymous endpoints to see the unfiltered snapshot.
            return Optional.of(AccessScope.empty());
        }
        UserPrincipal up = (UserPrincipal) auth.getPrincipal();
        if (up.isSuperAdmin()) {
            return Optional.empty();
        }
        return Optional.of(buildScope(up.getId()));
    }

    /**
     * Public helper for callers that need to compute a scope for a non-current
     * user id (e.g. when impersonating from a service).
     */
    public AccessScope forUserId(Long userId) {
        return buildScope(userId);
    }

    private AccessScope buildScope(Long userId) {
        if (userId == null) return AccessScope.empty();

        List<ContactPerson> contactPersons = contactPersonRepository.findByUserId(userId);
        if (contactPersons == null || contactPersons.isEmpty()) {
            return AccessScope.empty();
        }

        Set<Integer> instituteCodes = new HashSet<>();
        List<AccessScope.Rule> rules = new ArrayList<>();

        for (ContactPerson cp : contactPersons) {
            InstituteDetail inst = cp.getInstitute();
            if (inst == null || inst.getInstituteCode() == null) continue;
            Integer instituteCode = inst.getInstituteCode();
            instituteCodes.add(instituteCode);

            // ContactPersonAccessLevel.contactPersonId is a plain Long column, no
            // JPA relationship. Use the repository lookup the existing controller
            // uses for the access-levels list.
            List<ContactPersonAccessLevel> levels =
                    accessLevelRepository.findByContactPersonId(cp.getId());
            if (levels != null) {
                for (ContactPersonAccessLevel al : levels) {
                    rules.add(new AccessScope.Rule(
                            instituteCode,
                            al.getSessionId(),
                            al.getClassId(),
                            al.getSectionId()));
                }
            }
        }

        return new AccessScope(instituteCodes, rules);
    }
}
