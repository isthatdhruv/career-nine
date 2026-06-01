import clsx from "clsx";
import { FC, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../app/modules/auth";
import { KTSVG, toAbsoluteUrl } from "../../../helpers";
import {
  GlobalStudentSearchModal,
  HeaderUserMenu,
  ThemeModeSwitcher,
} from "../../../partials";
import { useLayout } from "../../core";

const toolbarButtonMarginClass = "ms-1 ms-lg-3",
  toolbarButtonHeightClass = "w-30px h-30px w-md-40px h-md-40px",
  toolbarUserAvatarHeightClass = "symbol-30px symbol-md-40px",
  toolbarButtonIconSizeClass = "svg-icon-1";

/**
 * Initials for the user-avatar placeholder.
 * "Career9 ADMIN" -> "CA" ; "Hiba" -> "HI" ; "" -> "?"
 */
function userInitials(name?: string): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words[0][0] && words[1][0]) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.substring(0, 2).toUpperCase();
}

/**
 * Topbar user avatar — renders the real imageUrl if present, otherwise a
 * teal initials placeholder. Fills its parent .symbol element so existing
 * Metronic sizing classes still apply.
 */
const UserAvatar: FC<{ imageUrl?: string; name?: string }> = ({
  imageUrl,
  name,
}) => {
  if (imageUrl) {
    return <img src={toAbsoluteUrl(imageUrl)} alt={name || "user"} />;
  }
  return (
    <div
      title={name}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #0c6b5a, #084a3e)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 0.5,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {userInitials(name)}
    </div>
  );
};

const Topbar: FC = () => {
  const { currentUser } = useAuth();
  const { config } = useLayout();
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Cmd/Ctrl + K is the universal "open search" shortcut (Spotlight uses
  // Cmd+Space, but that conflicts with macOS itself in a browser). Bound at
  // the window level so it works regardless of which input has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="d-flex align-items-stretch flex-shrink-0">
      {/* Global student search trigger */}
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
      >
        <div
          className={clsx(
            "btn btn-icon btn-active-light-primary btn-custom",
            toolbarButtonHeightClass
          )}
          onClick={openSearch}
          title="Search students (⌘K / Ctrl+K)"
          role="button"
          aria-label="Open global student search"
        >
          <KTSVG
            path="/media/icons/duotune/general/gen021.svg"
            className={toolbarButtonIconSizeClass}
          />
        </div>
      </div>
      <GlobalStudentSearchModal show={searchOpen} handleClose={closeSearch} />
      {/* Legacy demo Search placeholder retained as reference */}
      {/* <div className={clsx('d-flex align-items-stretch', toolbarButtonMarginClass)}>
        <Search />
      </div> */}
      {/* Activities */}
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
      >
        {/* begin::Drawer toggle */}
        {/* <div
          className={clsx(
            'btn btn-icon btn-active-light-primary btn-custom',
            toolbarButtonHeightClass
          )}
          id='kt_activities_toggle'
        >
          <KTSVG
            path='/media/icons/duotune/general/gen032.svg'
            className={toolbarButtonIconSizeClass}
          />
        </div> */}
        {/* end::Drawer toggle */}
      </div>

      {/* NOTIFICATIONS */}
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
      >
        {/* begin::Menu- wrapper */}
        {/* <div
          className={clsx(
            'btn btn-icon btn-active-light-primary btn-custom',
            toolbarButtonHeightClass
          )}
          data-kt-menu-trigger='click'
          data-kt-menu-attach='parent'
          data-kt-menu-placement='bottom-end'
          data-kt-menu-flip='bottom'
        >
          <KTSVG
            path='/media/icons/duotune/general/gen022.svg'
            className={toolbarButtonIconSizeClass}
          />
        </div>
        <HeaderNotificationsMenu /> */}
        {/* end::Menu wrapper */}
      </div>

      {/* CHAT */}
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
      >
        {/* begin::Menu wrapper */}
        {/* <div
          className={clsx(
            'btn btn-icon btn-active-light-primary btn-custom position-relative',
            toolbarButtonHeightClass
          )}
          id='kt_drawer_chat_toggle'
        >
          <KTSVG
            path='/media/icons/duotune/communication/com012.svg'
            className={toolbarButtonIconSizeClass}
          />

          <span className='bullet bullet-dot bg-success h-6px w-6px position-absolute translate-middle top-0 start-50 animation-blink'></span>
        </div> */}
        {/* end::Menu wrapper */}
      </div>

      {/* Quick links */}
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
      >
        {/* begin::Menu wrapper */}
        {/* <div
          className={clsx(
            'btn btn-icon btn-active-light-primary btn-custom',
            toolbarButtonHeightClass
          )}
          data-kt-menu-trigger='click'
          data-kt-menu-attach='parent'
          data-kt-menu-placement='bottom-end'
          data-kt-menu-flip='bottom'
        >
          <KTSVG
            path='/media/icons/duotune/general/gen025.svg'
            className={toolbarButtonIconSizeClass}
          />
        </div>
        <QuickLinks /> */}
        {/* end::Menu wrapper */}
      </div>

      {/* Theme mode switcher hidden per product request — app is locked to light theme.
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
      >
        <ThemeModeSwitcher
          toggleBtnClass={clsx(
            "btn-active-light-primary btn-custom",
            toolbarButtonHeightClass
          )}
        />
      </div>
      */}

      {/* begin::User */}
      <div
        className={clsx("d-flex align-items-center", toolbarButtonMarginClass)}
        id="kt_header_user_menu_toggle"
      >
        {/* begin::Toggle */}
        <div
          className={clsx(
            "cursor-pointer symbol",
            toolbarUserAvatarHeightClass
          )}
          data-kt-menu-trigger="click"
          data-kt-menu-attach="parent"
          data-kt-menu-placement="bottom-end"
          data-kt-menu-flip="bottom"
        >
          <UserAvatar
            imageUrl={currentUser?.imageUrl}
            name={currentUser?.name}
          />
        </div>
        <HeaderUserMenu />
        {/* end::Toggle */}
      </div>
      {/* end::User */}

      {/* begin::Aside Toggler */}
      {config.header.left === "menu" && (
        <div
          className="d-flex align-items-center d-lg-none ms-2 me-n3"
          title="Show header menu"
        >
          <div
            className="btn btn-icon btn-active-light-primary w-30px h-30px w-md-40px h-md-40px"
            id="kt_header_menu_mobile_toggle"
          >
            <KTSVG
              path="/media/icons/duotune/text/txt001.svg"
              className="svg-icon-1"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export { Topbar };
