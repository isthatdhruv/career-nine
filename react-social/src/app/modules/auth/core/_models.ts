// Mirrors the backend MeResponse (GET /auth/me).
// The shape matches what TokenAuthenticationFilter hydrates from the JWT claims:
// id, displayName, email, roles[], permissions[], scopes[{i,s,c,x}], superAdmin.
export interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  scopes: Array<Scope>;
  superAdmin: boolean;
}

// ABAC scope row (institute / session / course / section).
// Short keys mirror the JWT claim shape so the same parser can be reused.
export type Scope = { i?: number; s?: number; c?: number; x?: number };
