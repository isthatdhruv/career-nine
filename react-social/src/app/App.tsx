import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { I18nProvider } from "../_metronic/i18n/i18nProvider";
import { MasterInit } from "../_metronic/layout/MasterInit";
import { LayoutProvider, LayoutSplashScreen } from "../_metronic/layout/core";
import { AuthInit } from "./modules/auth";
import { DataProvider } from "./pages/games/Data-Context/DataContext";

const App = () => {
  return (
    <Suspense fallback={<LayoutSplashScreen />}>
      <I18nProvider>
        <LayoutProvider>
          <DataProvider>
            <AuthInit>
              <Outlet />
              <MasterInit />
            </AuthInit>
          </DataProvider>
        </LayoutProvider>
      </I18nProvider>
    </Suspense>
  );
};

export { App };
