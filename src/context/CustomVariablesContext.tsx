import React, { createContext, useContext, useEffect, useState } from "react";

export interface CustomVariable {
  id: string;
  name: string;
  env: string;
  value: string;
}

const STORAGE_KEY = "deck-proton-launch-custom-variables";

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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCustomVariables(JSON.parse(stored));
    } catch {}
  }, []);

  const save = (vars: CustomVariable[]) => {
    setCustomVariables(vars);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
    } catch {}
  };

  const addCustomVariable = (variable: Omit<CustomVariable, "id">) => {
    if (customVariables.some((v) => v.name === variable.name)) return false;
    save([...customVariables, { ...variable, id: crypto.randomUUID() }]);
    return true;
  };

  const editCustomVariable = (
    id: string,
    updated: Omit<CustomVariable, "id">,
  ) => {
    save(customVariables.map((v) => (v.id === id ? { ...updated, id } : v)));
  };

  const removeCustomVariable = (id: string) => {
    save(customVariables.filter((v) => v.id !== id));
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
