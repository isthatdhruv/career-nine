import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeModeComponent } from "../../../assets/ts/layout";
import { toAbsoluteUrl } from "../../../helpers";

export type ThemeModeType = "dark" | "light" | "system";
const systemMode = ThemeModeComponent.getSystemMode() as "light" | "dark";

type ThemeModeContextType = {
  mode: ThemeModeType;
  menuMode: ThemeModeType;
  updateMode: (_mode: ThemeModeType) => void;
  updateMenuMode: (_mode: ThemeModeType) => void;
};

const themeModeSwitchHelper = (_mode: ThemeModeType) => {
  // change background image url
  const mode = _mode !== "system" ? _mode : systemMode;
  const imageUrl =
    "/media/patterns/header-bg" + (mode === "light" ? ".jpg" : "-dark.png");
  document.body.style.backgroundImage = `url("${toAbsoluteUrl(imageUrl)}")`;
};

const themeModeLSKey = "kt_theme_mode_value";
const themeMenuModeLSKey = "kt_theme_mode_menu";

const getThemeModeFromLocalStorage = (lsKey: string): ThemeModeType => {
  if (!localStorage) {
    return "light";
  }

  const data = localStorage.getItem(lsKey);
  if (!data) {
    return "light";
  }

  if (data === "light") {
    return "light";
  }

  if (data === "dark") {
    return "dark";
  }

  return "system";
};

const defaultThemeMode: ThemeModeContextType = {
  mode: getThemeModeFromLocalStorage(themeModeLSKey),
  menuMode: getThemeModeFromLocalStorage(themeMenuModeLSKey),
  updateMode: (_mode: ThemeModeType) => {},
  updateMenuMode: (_menuMode: ThemeModeType) => {},
};

const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: defaultThemeMode.mode,
  menuMode: defaultThemeMode.menuMode,
  updateMode: (_mode: ThemeModeType) => {},
  updateMenuMode: (_menuMode: ThemeModeType) => {},
});

const useThemeMode = () => useContext(ThemeModeContext);

const ThemeModeProvider = ({ children }: { children: React.ReactNode }) => {
  // Theme is force-locked to "light" — the switcher button in the topbar is
  // hidden and the OS dark-mode preference is ignored. To re-enable user
  // theme switching, restore the original useState + updateMode logic.
  const [mode] = useState<ThemeModeType>("light");
  const [menuMode] = useState<ThemeModeType>("light");

  const updateMode = (_mode: ThemeModeType) => {
    // Forced light — ignore the requested mode.
    if (localStorage) {
      localStorage.setItem(themeModeLSKey, "light");
    }
    document.documentElement.setAttribute("data-theme", "light");
    ThemeModeComponent.init();
  };

  const updateMenuMode = (_menuMode: ThemeModeType) => {
    if (localStorage) {
      localStorage.setItem(themeMenuModeLSKey, "light");
    }
  };

  useEffect(() => {
    updateMode("light");
    updateMenuMode("light");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeModeContext.Provider
      value={{ mode, menuMode, updateMode, updateMenuMode }}
    >
      {children}
    </ThemeModeContext.Provider>
  );
};

export { ThemeModeProvider, useThemeMode, systemMode, themeModeSwitchHelper };
