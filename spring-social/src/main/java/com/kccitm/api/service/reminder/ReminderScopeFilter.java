package com.kccitm.api.service.reminder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.kccitm.api.security.CurrentScopes;
import com.kccitm.api.security.UserPrincipal;

/**
 * ABAC helper: turns the authenticated user's CurrentScopes into a concrete set
 * of institute_code values that the caller may operate on. Used by every list
 * endpoint (logs, suppressions, manual-send preview) and every write endpoint
 * to constrain results to the caller's allowed institutes.
 *
 * Returns {@code null} from {@link #allowedInstituteCodes()} to mean
 * "unrestricted" (super-admin or a wildcard scope row). Callers must treat
 * {@code null} as "no WHERE clause" rather than "deny all".
 */
@Service
public class ReminderScopeFilter {

    /**
     * Returns the list of institute_code values the current user is restricted to,
     * or {@code null} when the user is unrestricted (super-admin or owns a
     * wildcard scope row with {@code i == null}).
     */
    public List<Integer> allowedInstituteCodes() {
        UserPrincipal p = currentPrincipal();
        if (p == null) return Collections.emptyList();
        if (p.isSuperAdmin()) return null;
        List<CurrentScopes.ScopeRow> rows = p.getScopes();
        if (rows == null || rows.isEmpty()) return Collections.emptyList();
        List<Integer> codes = new ArrayList<>();
        for (CurrentScopes.ScopeRow row : rows) {
            if (row.i == null) {
                return null; // wildcard at institute dim = unrestricted
            }
            if (!codes.contains(row.i)) codes.add(row.i);
        }
        return codes;
    }

    public boolean canAccessInstitute(Integer instituteCode) {
        if (instituteCode == null) return true;
        List<Integer> allowed = allowedInstituteCodes();
        if (allowed == null) return true;
        return allowed.contains(instituteCode);
    }

    public Long currentUserId() {
        UserPrincipal p = currentPrincipal();
        return p == null ? null : p.getId();
    }

    public boolean isSuperAdmin() {
        UserPrincipal p = currentPrincipal();
        return p != null && p.isSuperAdmin();
    }

    private UserPrincipal currentPrincipal() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof UserPrincipal)) {
            return null;
        }
        return (UserPrincipal) a.getPrincipal();
    }
}
