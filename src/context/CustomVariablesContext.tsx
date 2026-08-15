import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import { readLegacyArray } from "../utils/legacyStorage";

export interface CustomVariable {
  id: string;
  name: string;
  env: string;
  value: string;
}

// Pre-0.10 localStorage key, migrated below.
const LEGACY_KEY = "deck-proton-launch-custom-variables";

interface CustomVariablesContextValue {
  customVariables: CustomVariable[];
  addCustomVariable: (variable: Omit<CustomVariable, "id">) => boolean;
  editCustomVariable: (id: string, updated: Omit<CustomVariable, "id">) => void;
  removeCustomVariable: (id: string) => void;
}

const CustomVariablesContext =
  createContext<CustomVariablesContextValue | null>(null);

export const CustomVariablesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);

  useEffect(() => {
    // Merge legacy entries missing by name; runs on backend fetch failure too.
    const mergeLegacy = (current: CustomVariable[]) => {
      const legacy = readLegacyArray<CustomVariable>(LEGACY_KEY) ?? [];
      const existingNames = new Set(current.map((v) => v.name));
      const missing = legacy.filter((v) => !existingNames.has(v.name));
      setCustomVariables([...current, ...missing]);
      if (missing.length > 0) {
        call<[CustomVariable[]], boolean>("set_custom_variables", [
          ...current,
          ...missing,
        ]).catch(() => {});
      }
    };

    call<[], CustomVariable[]>("get_custom_variables")
      .then((data) => mergeLegacy(data ?? []))
      .catch(() => mergeLegacy([]));
  }, []);

  const persist = (vars: CustomVariable[]) => {
    setCustomVariables(vars);
    call<[CustomVariable[]], boolean>("set_custom_variables", vars).catch(
      () => {},
    );
  };

  const addCustomVariable = (variable: Omit<CustomVariable, "id">) => {
    if (customVariables.some((v) => v.name === variable.name)) return false;
    persist([...customVariables, { ...variable, id: crypto.randomUUID() }]);
    return true;
  };

  const editCustomVariable = (
    id: string,
    updated: Omit<CustomVariable, "id">,
  ) => {
    persist(customVariables.map((v) => (v.id === id ? { ...updated, id } : v)));
  };

  const removeCustomVariable = (id: string) => {
    persist(customVariables.filter((v) => v.id !== id));
  };

  return (
    <CustomVariablesContext.Provider
      value={{
        customVariables,
        addCustomVariable,
        editCustomVariable,
        removeCustomVariable,
      }}
    >
      {children}
    </CustomVariablesContext.Provider>
  );
};

export const useCustomVariables = () => {
  const ctx = useContext(CustomVariablesContext);
  if (!ctx)
    throw new Error("useCustomVariables must be used within AppProvider");
  return ctx;
};
