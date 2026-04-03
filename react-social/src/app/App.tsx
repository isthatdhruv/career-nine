import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { I18nProvider } from "../_metronic/i18n/i18nProvider";
import { MasterInit } from "../_metronic/layout/MasterInit";
import { LayoutProvider, LayoutSplashScreen } from "../_metronic/layout/core";
import { AuthInit } from "./modules/auth";
import ErrorBoundary from "./modules/errors/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LayoutSplashScreen />}>
        <I18nProvider>
          <LayoutProvider>
            <AuthInit>
              <Outlet />
              <MasterInit />
              <ToastContainer />
            </AuthInit>
          </LayoutProvider>
        </I18nProvider>
      </Suspense>
    </ErrorBoundary>
  );
};

export { App };
