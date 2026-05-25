import { FC, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../core/Auth";
import { Scope } from "../core/_models";
import { urlAllowed } from "../core/permissions";
import { RequestAccessPage } from "./RequestAccessPage";

interface RequirePermissionProps {
  perm: string;
  scope?: Scope;
  children: ReactNode;
}

/**
 * Route-level access guard with intersection semantics: a route is allowed
 * iff BOTH (a) the user holds the permission (and any optional scope match)
 * AND (b) the current path is in the user's whitelisted URL list.
 *
 *   <Route element={<RequirePermission perm="student.read"><...></RequirePermission>} />
 *
 * Super-admin (`currentUser.superAdmin === true`) bypasses both checks. The
 * URL list comes from `currentUser.urls` (accumulated server-side in
 * `/auth/me` from `role_url` rows across every role the user holds).
 *
 * Empty URL list = deny-by-default for non-super-admins — the screen renders
 * `<RequestAccessPage>` with a hint that the admin still needs to whitelist
 * paths on at least one of their roles. The page itself documents the gate
 * that failed (perm vs URL).
 */
export const RequirePermission: FC<RequirePermissionProps> = ({ perm, scope, children }) => {
  const { can, currentUser } = useAuth();
  const location = useLocation();

  // Super-admin: full bypass — same convention as the backend AuthorizationService.
  const isSuperAdmin = currentUser?.superAdmin === true;

  const permPass = can(perm, scope);
  const urlPass = isSuperAdmin || urlAllowed(currentUser?.urls, location.pathname);

  if (permPass && urlPass) {
    return <>{children}</>;
  }

  // Surface which gate failed so the request-access page can guide the admin.
  // `permPass=false` is the more common failure (existing semantics);
  // `urlPass=false, permPass=true` signals the new URL whitelist is missing.
  return (
    <RequestAccessPage
      perm={perm}
      reason={!permPass ? "permission" : "url"}
      path={location.pathname}
    />
  );
};
