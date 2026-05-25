import { Scope } from "./_models";

/**
 * Frontend mirror of the backend `AuthorizationService.allows()` predicate.
 *
 * Backend reference ([AuthorizationService.java:82-110]):
 *
 *   boolean decide(permission, i, s, c, x) {
 *     if (principal == null)        return false;   // ANONYMOUS
 *     if (principal.isSuperAdmin()) return true;    // full bypass
 *     if (!hasPermission(perm))     return false;   // PERM_MISSING
 *     if (i == s == c == x == null) return true;    // no scope args
 *     return scopes.anyMatch(...);                  // SCOPE_MISMATCH otherwise
 *   }
 *
 * IMPORTANT: super-admin is a FULL bypass — it skips both the permission and
 * scope checks. The previous version of this function checked permissions
 * before super-admin, which contradicted the backend and locked out a freshly-
 * bootstrapped super-admin (no role groups assigned yet → empty perms array →
 * can't even reach the role-management screen to grant themselves permissions).
 *
 * This file MUST stay in lock-step with the Java implementation. Any change
 * here without a corresponding change there is a security bug.
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

  // Super-admin is a full bypass — matches backend AuthorizationService.decide().
  // MUST come before the perm check so a freshly-bootstrapped super-admin (who
  // has no role groups yet) can still access the role-management UI to grant
  // themselves and others permissions.
  if (sa) return true;

  // RBAC gate — must hold the verb.
  if (!perms.includes(perm)) return false;

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

// ── URL access predicate ─────────────────────────────────────────────────────
// The role.url table on the backend stores per-role whitelisted route paths.
// /auth/me accumulates them as `user.urls[]`. RequirePermission then runs an
// intersection check: a route is accessible iff (a) `allows(...)` passes the
// permission gate AND (b) the current `location.pathname` matches at least
// one of the user's whitelisted patterns (or the user is super-admin).
//
// Patterns supported:
//   - Literal:     /students/list           ⇒ matches /students/list only
//   - Parametric:  /students/getbyid/:id    ⇒ matches /students/getbyid/<anything-not-/>
//   - Wildcard:    /students/*              ⇒ matches /students and everything below
//
// Implemented as on-the-fly regex compilation — the user's url list is small
// (single-digit to low-hundreds entries) so compile-per-call is fine.

/**
 * True iff {@code path} matches at least one of the supplied url patterns.
 * Empty / undefined list → returns false (deny-by-default).
 */
export function urlAllowed(urls: string[] | undefined, path: string): boolean {
  if (!urls || urls.length === 0) return false;
  for (const pattern of urls) {
    if (matchesPattern(pattern, path)) return true;
  }
  return false;
}

function matchesPattern(pattern: string, path: string): boolean {
  if (!pattern) return false;
  // Fast path: literal equality (no `:`, no `*`).
  if (pattern.indexOf(":") < 0 && pattern.indexOf("*") < 0) {
    return pattern === path;
  }
  // Translate the pattern to a regex. Escape regex metacharacters except for
  // the placeholders we replace below.
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // `*` → match anything (greedy). Used as suffix wildcard: `/x/*` matches `/x/`, `/x/y`, `/x/y/z`.
  // `:name` → match one path segment (no slashes).
  const re = escaped
    .replace(/\*/g, ".*")
    .replace(/:[A-Za-z0-9_]+/g, "[^/]+");
  return new RegExp("^" + re + "$").test(path);
}
