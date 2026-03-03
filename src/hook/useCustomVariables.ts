import { useState, useEffect } from "react";

export interface CustomVariable {
  id: string;
  name: string;
  env: string;
  value: string;
}

const STORAGE_KEY = "deck-proton-launch-custom-variables";

export function useCustomVariables() {
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

  return {
    customVariables,
    addCustomVariable,
    editCustomVariable,
    removeCustomVariable,
  };
}
