import {
  FC,
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { LayoutSplashScreen } from "../../../../_metronic/layout/core";
import { AuthModel, User, Scope } from "./_models";
import { allows } from "./permissions";
// Phase 16: authHelper.{getAuth,setAuth,removeAuth} are now no-op stubs;
// kept imported so any leftover references compile while Plan 16-04 finishes
// migrating authRedirectPage.tsx. Safe to drop the import in the follow-up.
import * as authHelper from "./AuthHelpers";
import * as authRequests from "./_requests";
import { getUserByToken } from "./_requests";
import { WithChildren } from "../../../../_metronic/helpers";

type AuthContextProps = {
  auth: AuthModel | undefined;
  saveAuth: (auth: AuthModel | undefined) => void;
  currentUser: User | undefined;
  setCurrentUser: Dispatch<SetStateAction<User | undefined>>;
  logout: () => void;
  can: (perm: string, scope?: Scope) => boolean;
};

const initAuthContextPropsState = {
  auth: undefined,
  saveAuth: () => {},
  currentUser: undefined,
  setCurrentUser: () => {},
  logout: () => {},
  can: (_perm: string, _scope?: Scope) => false,
};

const AuthContext = createContext<AuthContextProps>(initAuthContextPropsState);

const useAuth = () => {
  return useContext(AuthContext);
};

const AuthProvider: FC<WithChildren> = ({ children }) => {
  const [auth, setAuth] = useState<AuthModel | undefined>(undefined);
  const [currentUser, setCurrentUser] = useState<User | undefined>();

  const saveAuth = (auth: AuthModel | undefined) => {
    setAuth(auth);
    // No localStorage write (Phase 16 — cookie-based session).
    // authHelper.setAuth/removeAuth are no-op stubs; we intentionally do
    // not call them here. The reference is preserved at module scope so
    // the import is not orphaned while Plan 16-04 finishes the migration.
    void authHelper;
  };

  const logout = async () => {
    // Phase 18: best-effort POST `/auth/logout` — server revokes the access-jti
    // (deny list), revokes the refresh-token row, and clears cn_at + cn_csrf
    // + cn_rt cookies. NEVER block local-state clear on this network call:
    // if it fails (offline, server down, cookie already invalid) we still
    // want the user to be logged out client-side.
    try {
      await authRequests.logout();
    } catch (e) {
      // ignore — we still want to clear local state even if the server call fails
    }
    saveAuth(undefined);
    setCurrentUser(undefined);
  };

  // Mirrors backend AuthorizationService.allows() — see permissions.ts docblock.
  // Defaults guard against legacy /auth/me responses that lack the new shape
  // (treat as "logged in but no perms" — degrades gracefully per Phase 17
  // backwards-compat strategy).
  const can = (perm: string, scope?: Scope): boolean => {
    if (!currentUser) return false;
    return allows(
      currentUser.permissions,
      currentUser.scopes,
      currentUser.superAdmin,
      perm,
      scope
    );
  };

  return (
    <AuthContext.Provider
      value={{ auth, saveAuth, currentUser, setCurrentUser, logout, can }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const AuthInit: FC<WithChildren> = ({ children }) => {
  const { setCurrentUser } = useAuth();
  const didRequest = useRef(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (didRequest.current) return;
      didRequest.current = true;
      try {
        // Cookie (cn_at) is auto-attached via axios withCredentials.
        const { data } = await getUserByToken();
        if (data) {
          setCurrentUser(data);
        }
      } catch (error) {
        // 401 (no cookie / expired) is the normal "not logged in" path.
        // Don't toast — the response interceptor already redirected.
        // Silently fall through to splash-off; PrivateRoutes will gate.
      } finally {
        setShowSplashScreen(false);
      }
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return showSplashScreen ? <LayoutSplashScreen /> : <>{children}</>;
};

export { AuthProvider, AuthInit, useAuth };
