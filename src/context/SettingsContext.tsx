import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "deck-proton-launch-settings";

interface SettingsContextValue {
  hiddenCategories: Set<string>;
  toggleCategory: (category: string) => void;
  isCategoryVisible: (category: string) => boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHiddenCategories(new Set(JSON.parse(stored)));
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

  return (
    <SettingsContext.Provider
      value={{ hiddenCategories, toggleCategory, isCategoryVisible }}
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
