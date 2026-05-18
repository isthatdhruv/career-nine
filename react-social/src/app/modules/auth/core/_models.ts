// Mirrors the backend MeResponse (GET /auth/me).
// The shape matches what TokenAuthenticationFilter hydrates from the JWT claims:
// id, displayName, email, roles[], permissions[], scopes[{i,s,c,x}], urls[], superAdmin.
export interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  scopes: Array<Scope>;
  /**
   * React route paths whitelisted for this user, accumulated across every
   * role they hold. RequirePermission enforces an intersection check: a
   * route is accessible iff its path matches one of these AND the route's
   * permission gate passes. Super-admins bypass both checks.
   */
  urls?: string[];
  superAdmin: boolean;
}

// ABAC scope row (institute / session / course / section).
// Short keys mirror the JWT claim shape so the same parser can be reused.
export type Scope = { i?: number; s?: number; c?: number; x?: number };
