import { FC, ReactNode } from "react";
import { useAuth } from "../core/Auth";
import { Scope } from "../core/_models";
import { RequestAccessPage } from "./RequestAccessPage";

interface RequirePermissionProps {
  perm: string;
  scope?: Scope;
  children: ReactNode;
}

/**
 * Route-level permission guard.
 *
 *   <Route element={<RequirePermission perm="student.read"><StudentsList /></RequirePermission>} />
 *
 * Renders children iff the user is allowed; otherwise renders
 * <RequestAccessPage> (NOT a bare 401). Replaces the URL-pattern
 * AuthorizedLayout in PrivateRoutes.tsx (Plan 17-02).
 *
 * Unauthenticated handling: this guard assumes the user is already past
 * the login gate (AuthInit + PrivateRoutes wrapper). If `currentUser` is
 * undefined, `can()` returns false and we render RequestAccessPage too —
 * which is a benign no-op because the AuthInit splash screen runs first
 * and the unauthenticated path redirects to /auth before any route mounts.
 */
export const RequirePermission: FC<RequirePermissionProps> = ({ perm, scope, children }) => {
  const { can } = useAuth();
  if (can(perm, scope)) {
    return <>{children}</>;
  }
  return <RequestAccessPage perm={perm} />;
};
