import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import { readLegacyArray, readLegacyString } from "../utils/legacyStorage";

export type DefaultHome = "home" | "game-manager" | "global-commands";

interface UiSettings {
  hiddenCategories?: string[];
  defaultHome?: DefaultHome;
  hideVariablesPage?: boolean;
  showActiveSection?: boolean;
  showRawTechnicalValues?: boolean;
  collapsedGameGroups?: string[];
}

// "Not configured" isn't tracked here at all — it always starts collapsed on
// every visit (see GamesPickerView), never remembered like these other groups.
const DEFAULT_COLLAPSED_GAME_GROUPS: string[] = [];

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
  showRawTechnicalValues: boolean;
  setShowRawTechnicalValues: (v: boolean) => void;
  collapsedGameGroups: Set<string>;
  toggleGameGroup: (status: string) => void;
  isGameGroupCollapsed: (status: string) => boolean;
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
  const [showRawTechnicalValues, setShowRawTechnicalValuesState] = useState(true);
  const [collapsedGameGroups, setCollapsedGameGroups] = useState<Set<string>>(
    new Set(DEFAULT_COLLAPSED_GAME_GROUPS),
  );
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
      setShowRawTechnicalValuesState(data.showRawTechnicalValues ?? true);
      setCollapsedGameGroups(
        new Set(data.collapsedGameGroups ?? DEFAULT_COLLAPSED_GAME_GROUPS),
      );
      if (recovered) {
        call<[UiSettings], boolean>("set_ui_settings", {
          hiddenCategories: categories ?? [],
          defaultHome: home,
          hideVariablesPage: data.hideVariablesPage ?? false,
          showActiveSection: data.showActiveSection ?? true,
          showRawTechnicalValues: data.showRawTechnicalValues ?? true,
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
    showRawTechnicalValues?: boolean;
    collapsedGameGroups?: Set<string>;
  }) => {
    const payload: UiSettings = {
      hiddenCategories: [...(next.hiddenCategories ?? hiddenCategories)],
      defaultHome: next.defaultHome ?? defaultHome,
      hideVariablesPage: next.hideVariablesPage ?? hideVariablesPage,
      showActiveSection: next.showActiveSection ?? showActiveSection,
      showRawTechnicalValues: next.showRawTechnicalValues ?? showRawTechnicalValues,
      collapsedGameGroups: [...(next.collapsedGameGroups ?? collapsedGameGroups)],
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

  const setShowRawTechnicalValues = (v: boolean) => {
    setShowRawTechnicalValuesState(v);
    persist({ showRawTechnicalValues: v });
  };

  const toggleGameGroup = (status: string) => {
    const next = new Set(collapsedGameGroups);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    setCollapsedGameGroups(next);
    persist({ collapsedGameGroups: next });
  };

  const isGameGroupCollapsed = (status: string) => collapsedGameGroups.has(status);

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
        showRawTechnicalValues,
        setShowRawTechnicalValues,
        collapsedGameGroups,
        toggleGameGroup,
        isGameGroupCollapsed,
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
