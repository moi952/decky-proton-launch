import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";

export type DefaultHome = "home" | "game-manager" | "global-commands";

interface UiSettings {
  hiddenCategories?: string[];
  defaultHome?: DefaultHome;
}

interface SettingsContextValue {
  hiddenCategories: Set<string>;
  toggleCategory: (category: string) => void;
  isCategoryVisible: (category: string) => boolean;
  defaultHome: DefaultHome;
  setDefaultHome: (v: DefaultHome) => void;
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
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    call<[], UiSettings>("get_ui_settings")
      .then((data) => {
        if (data.hiddenCategories) {
          setHiddenCategories(new Set(data.hiddenCategories));
        }
        if (data.defaultHome) setDefaultHomeState(data.defaultHome);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  const persist = (next: {
    hiddenCategories?: Set<string>;
    defaultHome?: DefaultHome;
  }) => {
    const payload: UiSettings = {
      hiddenCategories: [...(next.hiddenCategories ?? hiddenCategories)],
      defaultHome: next.defaultHome ?? defaultHome,
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

  return (
    <SettingsContext.Provider
      value={{
        hiddenCategories,
        toggleCategory,
        isCategoryVisible,
        defaultHome,
        setDefaultHome,
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
