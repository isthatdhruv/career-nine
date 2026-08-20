import React, { useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import { AsideMenuMain } from "./AsideMenuMain";
import {
  DrawerComponent,
  ScrollComponent,
  ToggleComponent,
} from "../../../assets/ts/components";

type Props = {
  asideMenuCSSClasses: string[];
};

/** How long to keep correcting drift after a click (~750ms at 60fps) — long
 *  enough to outlast the accordion slide and the post-navigation re-layout. */
const PIN_FRAMES = 45;

const AsideMenu: React.FC<Props> = ({ asideMenuCSSClasses }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { pathname } = useLocation();
  const pinRaf = useRef<number | null>(null);

  const stopPinning = useCallback(() => {
    if (pinRaf.current !== null) {
      cancelAnimationFrame(pinRaf.current);
      pinRaf.current = null;
    }
  }, []);

  /**
   * Keep the row that was just clicked exactly where it is on screen.
   *
   * Clicking a menu item sets off several things that each move the menu under
   * the pointer: the accordion for that section expands (and the previous one
   * collapses) which adds or removes a few hundred pixels of content; the route
   * change re-runs the Metronic scroll component, which recomputes and re-applies
   * an explicit pixel height on this wrapper; and if the new height leaves less
   * room, the browser clamps scrollTop. The visible result is the whole menu
   * jumping up or down after every click.
   *
   * Rather than trying to suppress each of those, the clicked element is used as
   * an anchor: its distance from the top of the viewport is measured at click
   * time, and for the next few hundred milliseconds any drift from that position
   * is corrected by scrolling the wrapper by the same amount. The menu re-lays
   * out as it always did; it just does so around the point the user is looking at.
   */
  const pinClickedRow = useCallback(
    (target: HTMLElement) => {
      const wrapper = scrollRef.current;
      if (!wrapper) return;

      const anchorTop = target.getBoundingClientRect().top;
      let frames = 0;
      stopPinning();

      const step = () => {
        // Bail out if the row is gone (menu re-rendered) or scrolling isn't possible.
        if (!wrapper.isConnected || !wrapper.contains(target)) {
          pinRaf.current = null;
          return;
        }
        const drift = target.getBoundingClientRect().top - anchorTop;
        if (Math.abs(drift) > 0.5) {
          wrapper.scrollTop += drift;
        }
        pinRaf.current = ++frames < PIN_FRAMES ? requestAnimationFrame(step) : null;
      };
      pinRaf.current = requestAnimationFrame(step);
    },
    [stopPinning]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const row = (e.target as HTMLElement | null)?.closest(
        ".menu-link"
      ) as HTMLElement | null;
      if (row) pinClickedRow(row);
    },
    [pinClickedRow]
  );

  useEffect(() => {
    // Metronic's drawer / toggle / scroll components are re-bound after a route
    // change, but the menu must stay exactly where the user scrolled it. The
    // original code reset scrollTop to 0 here, which is why clicking any item
    // sent the whole aside back to the top. The position is captured before the
    // re-init and restored after it, because re-measuring the wrapper height
    // (data-kt-scroll-height="auto") can clamp or shift the scroll position.
    const keepScrollTop = scrollRef.current?.scrollTop ?? 0;
    const timer = window.setTimeout(() => {
      DrawerComponent.reinitialization();
      ToggleComponent.reinitialization();
      ScrollComponent.reinitialization();
      // Only when nothing is actively pinning — the pin knows better, since it
      // tracks the clicked row rather than a raw offset that the re-layout may
      // have invalidated.
      if (
        pinRaf.current === null &&
        scrollRef.current &&
        scrollRef.current.scrollTop !== keepScrollTop
      ) {
        scrollRef.current.scrollTop = keepScrollTop;
      }
    }, 50);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Never fight a deliberate scroll: any wheel/touch/keyboard scrolling by the
  // user cancels the pin immediately.
  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;
    wrapper.addEventListener("wheel", stopPinning, { passive: true });
    wrapper.addEventListener("touchstart", stopPinning, { passive: true });
    wrapper.addEventListener("keydown", stopPinning);
    return () => {
      wrapper.removeEventListener("wheel", stopPinning);
      wrapper.removeEventListener("touchstart", stopPinning);
      wrapper.removeEventListener("keydown", stopPinning);
      stopPinning();
    };
  }, [stopPinning]);

  return (
    <div
      id="kt_aside_menu_wrapper"
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      className="hover-scroll-overlay-y my-5 my-lg-5"
      data-kt-scroll="true"
      data-kt-scroll-activate="{default: false, lg: true}"
      data-kt-scroll-height="auto"
      data-kt-scroll-dependencies="#kt_aside_logo, #kt_aside_footer"
      data-kt-scroll-wrappers="#kt_aside_menu"
      data-kt-scroll-offset="0"
    >
      <div
        id="#kt_aside_menu"
        data-kt-menu="true"
        // minHeight:100% makes this flex column fill the menu area, so a menu item
        // with marginTop:auto (e.g. the counsellor "Sign Out") is pushed to the very
        // bottom. Harmless for menus whose items already overflow (admin) — there it
        // simply stays content-height and scrolls as before.
        style={{ minHeight: "100%" }}
        className={clsx(
          "menu menu-column menu-title-gray-800 menu-state-title-primary menu-state-icon-primary menu-state-bullet-primary menu-arrow-gray-500",
          asideMenuCSSClasses.join(" ")
        )}
      >
        <AsideMenuMain />
      </div>
    </div>
  );
};

export { AsideMenu };
