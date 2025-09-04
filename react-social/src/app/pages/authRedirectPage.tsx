/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutSplashScreen } from "../../_metronic/layout/core";
import { AuthModel, setAuth, useAuth } from "../modules/auth";

import { getUserByToken } from "../modules/auth/core/_requests";
// import  {} from 'universal-cookie';
export const ACCESS_TOKEN = "accessToken";

const AuthRedirectPage: React.FC = () => {

  function getUrlParameter(name: any) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");

    var results = regex.exec(window.location.href);
    return results === null
      ? ""
      : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  const [token, setToken] = useState("");
  const didRequest = useRef(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [redirect, setRedirect] = useState(false);
  const { logout, setCurrentUser } = useAuth();
  useEffect(() => {
    setToken(getUrlParameter("token"));
    var auth: AuthModel = {
      api_token: token,
      refreshToken: "",
      authorityUrls: [""],
    };
    setAuth(auth);
    const requestUser = async (apiToken: string) => {
      try {
        if (!didRequest.current) {
          const { data } = await getUserByToken(apiToken);

          if (data) {
            auth.authorityUrls = data.authorityUrls;
            setAuth(auth);
            setCurrentUser(data);
          }
        }
      } catch (error) {
        console.error(error);
        if (!didRequest.current) {
          logout();
        }
      } finally {
        setShowSplashScreen(false);
      }

      return () => (didRequest.current = true);
    };

    if (auth && auth.api_token) {
      setShowSplashScreen(true);
      requestUser(auth.api_token).then((response) => {
        setRedirect(true);
      });
    } else {
      // logout()
      setShowSplashScreen(false);
    }
  }, [token]);

  return (
    <>
      {redirect ? (
        <>
          <Navigate to="/dashboard" />
        </>
      ) : (
        <p>
          <LayoutSplashScreen />
        </p>
      )}
    </>
    // <>{token}</>
    // <>{error ? <Navigate to="/dashboard" /> : <p>Anshita will be Waiting</p>}</>
    //<>
  );
};

export { AuthRedirectPage };
