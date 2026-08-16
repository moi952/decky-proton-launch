import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";

export interface CustomWrapper {
  id: string;
  name: string;
  env: string;
  exec: string;
}

interface CustomWrappersContextValue {
  customWrappers: CustomWrapper[];
  addCustomWrapper: (wrapper: Omit<CustomWrapper, "id" | "env">) => boolean;
  editCustomWrapper: (
    id: string,
    updated: Omit<CustomWrapper, "id" | "env">,
  ) => void;
  removeCustomWrapper: (id: string) => void;
  clearCustomWrappers: () => void;
}

const CustomWrappersContext = createContext<CustomWrappersContextValue | null>(
  null,
);

export const CustomWrappersProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [customWrappers, setCustomWrappers] = useState<CustomWrapper[]>([]);

  useEffect(() => {
    call<[], CustomWrapper[]>("get_custom_wrappers")
      .then((data) => setCustomWrappers(data ?? []))
      .catch(() => {});
  }, []);

  // The backend keeps ~/.config/decky-proton-launch/wrapper_chains.conf (a
  // small file the script re-reads on every launch) in sync as a side
  // effect of set_custom_wrappers — no script "reinstall" needed here.
  const persist = (wrappers: CustomWrapper[]) => {
    setCustomWrappers(wrappers);
    call<[CustomWrapper[]], boolean>("set_custom_wrappers", wrappers).catch(
      () => {},
    );
  };

  const addCustomWrapper = (wrapper: Omit<CustomWrapper, "id" | "env">) => {
    if (customWrappers.some((w) => w.name === wrapper.name)) return false;
    const id = crypto.randomUUID();
    const env = `__CUSTOM_${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    persist([...customWrappers, { ...wrapper, id, env }]);
    return true;
  };

  const editCustomWrapper = (
    id: string,
    updated: Omit<CustomWrapper, "id" | "env">,
  ) => {
    // env is never edited — it's the identifier existing per-game/global
    // toggles are keyed on, so changing it would orphan them.
    persist(
      customWrappers.map((w) => (w.id === id ? { ...w, ...updated } : w)),
    );
  };

  const removeCustomWrapper = (id: string) => {
    persist(customWrappers.filter((w) => w.id !== id));
  };

  const clearCustomWrappers = () => {
    persist([]);
  };

  return (
    <CustomWrappersContext.Provider
      value={{
        customWrappers,
        addCustomWrapper,
        editCustomWrapper,
        removeCustomWrapper,
        clearCustomWrappers,
      }}
    >
      {children}
    </CustomWrappersContext.Provider>
  );
};

export const useCustomWrappers = () => {
  const ctx = useContext(CustomWrappersContext);
  if (!ctx)
    throw new Error("useCustomWrappers must be used within AppProvider");
  return ctx;
};
