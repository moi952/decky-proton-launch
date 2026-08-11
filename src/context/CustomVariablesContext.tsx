import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";

export interface CustomVariable {
  id: string;
  name: string;
  env: string;
  value: string;
}

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
    call<[], CustomVariable[]>("get_custom_variables")
      .then((data) => setCustomVariables(data ?? []))
      .catch(() => {});
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
