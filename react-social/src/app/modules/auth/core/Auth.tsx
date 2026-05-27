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
import { useQueryClient } from "react-query";
import { LayoutSplashScreen } from "../../../../_metronic/layout/core";
import { User, Scope } from "./_models";
import { allows } from "./permissions";
import * as authRequests from "./_requests";
import { getCurrentUser } from "./_requests";
import { WithChildren } from "../../../../_metronic/helpers";

type AuthContextProps = {
  currentUser: User | undefined;
  setCurrentUser: Dispatch<SetStateAction<User | undefined>>;
  logout: () => void;
  can: (perm: string, scope?: Scope) => boolean;
};

const initAuthContextPropsState: AuthContextProps = {
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
  const [currentUser, setCurrentUser] = useState<User | undefined>();
  const queryClient = useQueryClient();

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
    setCurrentUser(undefined);
    // Drop any user-scoped React Query caches (lookups are filtered by
    // user scope server-side, so a next-login under a different account
    // must not see the previous user's list).
    queryClient.clear();
  };

  // Mirrors backend AuthorizationService.allows() — see permissions.ts.
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
      value={{ currentUser, setCurrentUser, logout, can }}
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
      console.log("[SESSION-DEBUG] AuthInit bootstrap — calling /auth/me, pathname=" + window.location.pathname);
      try {
        // Cookie (cn_at) is auto-attached via axios withCredentials.
        const { data } = await getCurrentUser();
        if (data) {
          console.log("[SESSION-DEBUG] AuthInit /auth/me OK — userId=" + (data as any)?.id);
          setCurrentUser(data);
        } else {
          console.log("[SESSION-DEBUG] AuthInit /auth/me returned no body");
        }
      } catch (error: any) {
        console.log(
          "[SESSION-DEBUG] AuthInit /auth/me FAILED status=" + (error?.response?.status ?? "n/a") +
          " msg=" + (error?.message ?? "n/a")
        );
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
