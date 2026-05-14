/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutSplashScreen } from "../../_metronic/layout/core";
import { useAuth } from "../modules/auth";
import {
  exchangeOAuthToken,
  getCurrentUser,
} from "../modules/auth/core/_requests";

export const ACCESS_TOKEN = "accessToken";

/**
 * Phase 16-04: OAuth-callback landing page.
 *
 * The Spring OAuth2 success handler (left untouched in Phase 16) redirects the browser to
 *     /oauth2/redirect?token=<jwt>
 * after a successful Google / GitHub / Facebook login. This component:
 *
 *   1. Extracts ?token=... from the URL.
 *   2. POSTs it to /auth/oauth-exchange so the server can re-issue it as the standard
 *      HttpOnly cn_at + non-HttpOnly cn_csrf cookies.
 *   3. Strips the token from the address bar via window.history.replaceState — so a
 *      refresh, bookmark or shoulder-surfer can't recover it.
 *   4. Bootstraps the user (cookie auto-attached by axios withCredentials).
 *   5. Navigates to /dashboard on success, or /auth on any failure.
 *
 * No localStorage writes. No setAuth({api_token: ...}) — that legacy path is gone.
 */
const AuthRedirectPage: React.FC = () => {
  const { setCurrentUser } = useAuth();
  const didRequest = useRef(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [destination, setDestination] = useState<"/dashboard" | "/auth" | null>(
    null
  );

  useEffect(() => {
    if (didRequest.current) return;
    didRequest.current = true;

    const run = async () => {
      try {
        // 1. Extract ?token=... from the URL.
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
          setDestination("/auth");
          return;
        }

        // 2. Exchange URL token for cookies (cn_at + cn_csrf).
        await exchangeOAuthToken(token);

        // 3. Strip token from URL ASAP so a refresh, back button, or
        //    bookmark cannot leak it. replaceState (not pushState) so the
        //    back button doesn't return to the token-bearing URL.
        try {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        } catch {
          // Older browsers — best-effort. Cookie is already set, so the
          // residual URL token is no longer needed.
        }

        // 4. Bootstrap user (cn_at cookie auto-attached via withCredentials).
        const { data: user } = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }

        setDestination("/dashboard");
      } catch (err) {
        // Any failure — missing token, 401 from /auth/oauth-exchange, 401 from
        // /auth/me — bounces the user to the login page. The axios response
        // interceptor already surfaces the toast on 401.
        setDestination("/auth");
      } finally {
        setShowSplashScreen(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showSplashScreen) {
    return <LayoutSplashScreen />;
  }
  if (destination) {
    return <Navigate to={destination} />;
  }
  return <LayoutSplashScreen />;
};

export { AuthRedirectPage };
