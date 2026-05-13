import { Scope } from "./_models";

/**
 * Frontend mirror of the backend `AuthorizationService.allows()` predicate.
 *
 * Backend reference (docs/AUTH_REDESIGN_PLAN.md §3.4):
 *
 *   boolean allowed(user, permission, instituteId, sessionId, courseCode, sectionId) {
 *     if (!user.hasPermission(permission)) return false;     // RBAC gate
 *     if (user.isSuperAdmin())             return true;      // bypass scope check
 *     return user.scopes.anyMatch(s ->
 *          matches(s.instituteId, instituteId)
 *       && matches(s.sessionId,   sessionId)
 *       && matches(s.courseCode,  courseCode)
 *       && matches(s.sectionId,   sectionId));
 *   }
 *   matches(null, x) = true     // wildcard
 *   matches(a, b)    = a === b  // exact match
 *
 * This file MUST stay in lock-step with the Java implementation.
 * Any change here without a corresponding change there (or vice-versa) is
 * a security bug. The unit tests in permissions.test.ts cover the same
 * cases the Java test suite covers — keep them aligned.
 */
export function allows(
  permissions: string[] | undefined,
  scopes: Scope[] | undefined,
  superAdmin: boolean | undefined,
  perm: string,
  required?: Scope
): boolean {
  // Defensive defaults — legacy-token / pre-Phase-16 backwards compat.
  // If /auth/me returned an old shape, treat as "logged in but no perms".
  const perms = permissions ?? [];
  const scopeRows = scopes ?? [];
  const sa = superAdmin === true;

  // RBAC gate — must hold the verb regardless of super-admin.
  if (!perms.includes(perm)) return false;

  // Super-admin bypasses the SCOPE check (but not the perm check above).
  if (sa) return true;

  // No scope argument requested → permission alone is enough (matches
  // backend `allowed(user, perm, null, null, null, null)`).
  if (!required) return true;

  // ABAC: at least one of the user's scope rows must match every
  // non-null dimension of the required scope.
  return scopeRows.some((row) => scopeMatches(row, required));
}

function scopeMatches(row: Scope, required: Scope): boolean {
  return (
    dimMatches(row.i, required.i) &&
    dimMatches(row.s, required.s) &&
    dimMatches(row.c, required.c) &&
    dimMatches(row.x, required.x)
  );
}

/**
 * matches(null, x) = true; matches(a, b) = a === b.
 *
 * NOTE: this is asymmetric — `row` is the user's grant, `required` is the
 * resource. A NULL on the user's grant means "wildcard for this dimension".
 * A NULL on the required side means the caller didn't constrain this
 * dimension (e.g. "any institute") — that also matches everything.
 * The backend predicate has the same property: if you pass null on either
 * side, the dimension passes.
 */
function dimMatches(rowDim: number | undefined, requiredDim: number | undefined): boolean {
  if (rowDim === undefined || rowDim === null) return true;
  if (requiredDim === undefined || requiredDim === null) return true;
  return rowDim === requiredDim;
}
