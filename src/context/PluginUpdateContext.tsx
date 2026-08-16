import React, { createContext, useContext, useEffect, useState } from "react";
import {
  fetchLatestReleaseInfo,
  PluginUpdateInfo,
} from "../utils/githubReleases";

interface PluginUpdateContextValue {
  info: PluginUpdateInfo | null;
  checking: boolean;
  checkNow: () => Promise<void>;
}

const PluginUpdateContext = createContext<PluginUpdateContextValue | null>(
  null,
);

// Shared so the top-of-app banner and the Settings section (both consuming
// components) always agree — a "check now" or install in one place is
// reflected in the other without a full remount. Silent (no toast) —
// Plugin._main() on the Python side already fires the one-time
// notification toast as soon as Decky loads the plugin (see
// plugin_updater.py + the "plugin_update_available" listener in
// index.tsx); this context only needs to keep the visible info current.
export const PluginUpdateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [info, setInfo] = useState<PluginUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchLatestReleaseInfo().then(setInfo);
  }, []);

  const checkNow = async () => {
    setChecking(true);
    try {
      setInfo(await fetchLatestReleaseInfo());
    } finally {
      setChecking(false);
    }
  };

  return (
    <PluginUpdateContext.Provider value={{ info, checking, checkNow }}>
      {children}
    </PluginUpdateContext.Provider>
  );
};

export const usePluginUpdate = () => {
  const ctx = useContext(PluginUpdateContext);
  if (!ctx) throw new Error("usePluginUpdate must be used within AppProvider");
  return ctx;
};
