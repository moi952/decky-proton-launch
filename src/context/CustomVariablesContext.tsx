import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import {
  readLegacyArray,
  pruneLegacyArray,
  clearLegacyKey,
} from "../utils/legacyStorage";

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
  clearCustomVariables: () => void;
}

const CustomVariablesContext =
  createContext<CustomVariablesContextValue | null>(null);

export const CustomVariablesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);

  useEffect(() => {
    // Merge legacy entries missing by name, then prune the ones now
    // confirmed in the backend — otherwise a deleted item that's still in
    // legacy storage gets re-added on every remount.
    const mergeLegacy = (current: CustomVariable[]) => {
      const legacy = readLegacyArray<CustomVariable>(LEGACY_KEY) ?? [];
      if (legacy.length === 0) {
        setCustomVariables(current);
        return;
      }

      const existingNames = new Set(current.map((v) => v.name));
      const missing = legacy.filter((v) => !existingNames.has(v.name));
      const merged = [...current, ...missing];
      setCustomVariables(merged);

      const legacyNames = legacy.map((v) => v.name);
      if (missing.length === 0) {
        pruneLegacyArray(LEGACY_KEY, legacyNames);
      } else {
        call<[CustomVariable[]], boolean>("set_custom_variables", merged)
          .then(() => pruneLegacyArray(LEGACY_KEY, legacyNames))
          .catch(() => {});
      }
    };

    call<[], CustomVariable[]>("get_custom_variables")
      .then((data) => mergeLegacy(data ?? []))
      .catch(() => mergeLegacy([]));
  }, []);

  const persist = (vars: CustomVariable[]): Promise<boolean> => {
    setCustomVariables(vars);
    return call<[CustomVariable[]], boolean>("set_custom_variables", vars).catch(
      () => false,
    );
  };

  const addCustomVariable = (variable: Omit<CustomVariable, "id">) => {
    if (customVariables.some((v) => v.name === variable.name)) return false;
    persist([...customVariables, { ...variable, id: crypto.randomUUID() }]);
    return true;
  };

  // Deleting (or renaming) a variable's definition never touched a profile
  // that had already exported it — that export just kept firing forever
  // with no toggle left to turn it off. This strips it from every profile
  // that currently has it. Only called after the updated list has already
  // been persisted (see the .then() chains below) — the backend's own
  // defensive check re-reads custom_variables.json before purging, so it
  // needs to see the post-deletion state, not a stale one.
  const purgeFromProfiles = (envs: string[]) => {
    const keys = envs.filter(Boolean);
    if (keys.length === 0) return;
    call<[string[]], boolean>("purge_env_from_profiles", keys).catch(() => {});
  };

  const editCustomVariable = (
    id: string,
    updated: Omit<CustomVariable, "id">,
  ) => {
    const existing = customVariables.find((v) => v.id === id);
    persist(customVariables.map((v) => (v.id === id ? { ...updated, id } : v))).then(
      () => {
        if (existing && existing.env !== updated.env) {
          purgeFromProfiles([existing.env]);
        }
      },
    );
  };

  const removeCustomVariable = (id: string) => {
    const existing = customVariables.find((v) => v.id === id);
    persist(customVariables.filter((v) => v.id !== id)).then(() => {
      if (existing) purgeFromProfiles([existing.env]);
    });
  };

  const clearCustomVariables = () => {
    const envs = customVariables.map((v) => v.env);
    persist([]).then(() => purgeFromProfiles(envs));
    // Explicit reset — clear the legacy backup too, or a remount would
    // just merge these same entries right back in.
    clearLegacyKey(LEGACY_KEY);
  };

  return (
    <CustomVariablesContext.Provider
      value={{
        customVariables,
        addCustomVariable,
        editCustomVariable,
        removeCustomVariable,
        clearCustomVariables,
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
