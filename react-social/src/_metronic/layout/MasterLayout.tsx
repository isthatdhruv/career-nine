import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AsideDefault } from "./components/aside/AsideDefault";
import { Footer } from "./components/Footer";
import { HeaderWrapper } from "./components/header/HeaderWrapper";
import { Toolbar } from "./components/toolbar/Toolbar";
import { RightToolbar } from "../partials/layout/RightToolbar";
import { ScrollTop } from "./components/ScrollTop";
import { Content } from "./components/Content";
import { PageDataProvider } from "./core";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../app/modules/auth";
import {
  DrawerMessenger,
  ActivityDrawer,
  InviteUsers,
  UpgradePlan,
  ThemeModeProvider,
} from "../partials";
import { MenuComponent } from "../assets/ts/components";

const MasterLayout = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  // A pure counsellor gets a focused shell: no top header bar (search/avatar) and
  // content flush to the top. The sidebar lives outside <Outlet/>, so it stays
  // mounted while only the content area swaps on navigation. Scoped to counsellors
  // only — the admin portal keeps its full header.
  const isCounsellorOnly =
    currentUser?.superAdmin !== true &&
    (currentUser?.roles ?? []).some((r) => {
      const u = typeof r === "string" ? r.toUpperCase() : "";
      return u === "COUNSELLOR" || u === "ROLE_COUNSELLOR";
    });

  // The aside is a fixed sidebar from lg up, but a hamburger-toggled drawer below
  // lg. So only strip the header on DESKTOP — on mobile the counsellor keeps the
  // normal header (like the other portals) so the hamburger can open the sidebar.
  const [isDesktop, setIsDesktop] = useState<boolean>(
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 992px)").matches
      : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 992px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Strip the top header/toolbar (and pull content up) only for a desktop counsellor.
  const hideShell = isCounsellorOnly && isDesktop;

  // Ctrl+R / Cmd+R: refresh ONLY the routed content instead of a full browser
  // reload. We block the browser's reload and bump a key on the content wrapper,
  // which remounts the current page (re-running its data fetch) while the aside
  // and header stay mounted — so the sidebar never reloads.
  // Escape hatch: Ctrl+Shift+R and F5 are left untouched, so a true full reload
  // (cache-bust / pick up a new deploy) is still one keystroke away.
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSoftReload =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
        (e.key === "r" || e.key === "R");
      if (isSoftReload) {
        e.preventDefault();
        setContentRefreshKey((k) => k + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      MenuComponent.reinitialization();
    }, 500);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      MenuComponent.reinitialization();
    }, 500);
  }, [location.key]);

  return (
    <PageDataProvider>
      <ThemeModeProvider>
        <div className="page d-flex flex-row flex-column-fluid">
          <AsideDefault />
          <div
            className="wrapper d-flex flex-column flex-row-fluid"
            id="kt_wrapper"
            style={hideShell ? { paddingTop: 0 } : undefined}
          >
            {!hideShell && <HeaderWrapper />}

            <div
              id="kt_content"
              className="content d-flex flex-column flex-column-fluid"
              style={hideShell ? { paddingTop: 0 } : undefined}
            >
              {!hideShell && <Toolbar />}
              <div
                className="post d-flex flex-column-fluid"
                id="kt_post"
                style={hideShell ? { paddingTop: "1.5rem" } : undefined}
              >
                {/* key bumps on Ctrl+R → remounts the routed page (refetches its
                    data) without reloading the surrounding shell/aside. */}
                <Content key={contentRefreshKey}>
                  <Outlet />
                </Content>
              </div>
            </div>
            {!hideShell && <Footer />}
          </div>
        </div>

        {/* begin:: Drawers */}
        <ActivityDrawer />
        <RightToolbar />
        <DrawerMessenger />
        {/* end:: Drawers */}

        {/* begin:: Modals */}
        <InviteUsers />
        <UpgradePlan />
        {/* end:: Modals */}
        <ScrollTop />
      </ThemeModeProvider>
    </PageDataProvider>
  );
};

export { MasterLayout };
