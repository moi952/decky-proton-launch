import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import { readLegacyArray, readLegacyString } from "../utils/legacyStorage";

export type DefaultHome = "home" | "game-manager" | "global-commands";

interface UiSettings {
  hiddenCategories?: string[];
  defaultHome?: DefaultHome;
  hideVariablesPage?: boolean;
  showActiveSection?: boolean;
}

// Pre-0.10 localStorage keys, migrated below.
const LEGACY_CATEGORIES_KEY = "deck-proton-launch-settings";
const LEGACY_HOME_KEY = "deck-proton-launch-default-home";

interface SettingsContextValue {
  hiddenCategories: Set<string>;
  toggleCategory: (category: string) => void;
  isCategoryVisible: (category: string) => boolean;
  defaultHome: DefaultHome;
  setDefaultHome: (v: DefaultHome) => void;
  hideVariablesPage: boolean;
  setHideVariablesPage: (v: boolean) => void;
  showActiveSection: boolean;
  setShowActiveSection: (v: boolean) => void;
  settingsLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set(),
  );
  const [defaultHome, setDefaultHomeState] =
    useState<DefaultHome>("game-manager");
  const [hideVariablesPage, setHideVariablesPageState] = useState(false);
  const [showActiveSection, setShowActiveSectionState] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    // Recover per-field from legacy storage; runs on backend fetch failure too.
    const applyAndRecover = (data: UiSettings) => {
      let categories = data.hiddenCategories;
      let home = data.defaultHome;
      let recovered = false;

      if (!categories) {
        const legacy = readLegacyArray<string>(LEGACY_CATEGORIES_KEY);
        if (legacy) {
          categories = legacy;
          recovered = true;
        }
      }
      if (!home) {
        const legacy = readLegacyString(LEGACY_HOME_KEY) as DefaultHome | null;
        if (legacy) {
          home = legacy;
          recovered = true;
        }
      }

      if (categories) setHiddenCategories(new Set(categories));
      if (home) setDefaultHomeState(home);
      setHideVariablesPageState(data.hideVariablesPage ?? false);
      setShowActiveSectionState(data.showActiveSection ?? true);
      if (recovered) {
        call<[UiSettings], boolean>("set_ui_settings", {
          hiddenCategories: categories ?? [],
          defaultHome: home,
          hideVariablesPage: data.hideVariablesPage ?? false,
          showActiveSection: data.showActiveSection ?? true,
        }).catch(() => {});
      }
    };

    call<[], UiSettings>("get_ui_settings")
      .then(applyAndRecover)
      .catch(() => applyAndRecover({}))
      .finally(() => setSettingsLoaded(true));
  }, []);

  const persist = (next: {
    hiddenCategories?: Set<string>;
    defaultHome?: DefaultHome;
    hideVariablesPage?: boolean;
    showActiveSection?: boolean;
  }) => {
    const payload: UiSettings = {
      hiddenCategories: [...(next.hiddenCategories ?? hiddenCategories)],
      defaultHome: next.defaultHome ?? defaultHome,
      hideVariablesPage: next.hideVariablesPage ?? hideVariablesPage,
      showActiveSection: next.showActiveSection ?? showActiveSection,
    };
    call<[UiSettings], boolean>("set_ui_settings", payload).catch(() => {});
  };

  const toggleCategory = (category: string) => {
    const next = new Set(hiddenCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setHiddenCategories(next);
    persist({ hiddenCategories: next });
  };

  const isCategoryVisible = (category: string) =>
    !hiddenCategories.has(category);

  const setDefaultHome = (v: DefaultHome) => {
    setDefaultHomeState(v);
    persist({ defaultHome: v });
  };

  const setHideVariablesPage = (v: boolean) => {
    setHideVariablesPageState(v);
    persist({ hideVariablesPage: v });
  };

  const setShowActiveSection = (v: boolean) => {
    setShowActiveSectionState(v);
    persist({ showActiveSection: v });
  };

  return (
    <SettingsContext.Provider
      value={{
        hiddenCategories,
        toggleCategory,
        isCategoryVisible,
        defaultHome,
        setDefaultHome,
        hideVariablesPage,
        setHideVariablesPage,
        showActiveSection,
        setShowActiveSection,
        settingsLoaded,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within AppProvider");
  return ctx;
};
