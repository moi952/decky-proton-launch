import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "deck-proton-launch-settings";
const HOME_KEY = "deck-proton-launch-default-home";

export type DefaultHome = "home" | "game-manager";

interface SettingsContextValue {
  hiddenCategories: Set<string>;
  toggleCategory: (category: string) => void;
  isCategoryVisible: (category: string) => boolean;
  defaultHome: DefaultHome;
  setDefaultHome: (v: DefaultHome) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set()
  );
  const [defaultHome, setDefaultHomeState] = useState<DefaultHome>("home");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHiddenCategories(new Set(JSON.parse(stored)));
      const storedHome = localStorage.getItem(HOME_KEY) as DefaultHome | null;
      if (storedHome) setDefaultHomeState(storedHome);
    } catch {}
  }, []);

  const save = (next: Set<string>) => {
    setHiddenCategories(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {}
  };

  const toggleCategory = (category: string) => {
    const next = new Set(hiddenCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    save(next);
  };

  const isCategoryVisible = (category: string) =>
    !hiddenCategories.has(category);

  const setDefaultHome = (v: DefaultHome) => {
    setDefaultHomeState(v);
    try {
      localStorage.setItem(HOME_KEY, v);
    } catch {}
  };

  return (
    <SettingsContext.Provider
      value={{ hiddenCategories, toggleCategory, isCategoryVisible, defaultHome, setDefaultHome }}
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
