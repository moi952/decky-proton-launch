import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import { useRemoteJson } from "@moi952/decky-ui-kit";
import {
  OTHER_PLUGINS_MANIFEST_URL,
  OtherPluginEntry,
  OtherPluginsManifest,
  SELF_PLUGIN_ID,
} from "../utils/otherPlugins";

interface OtherPluginsContextValue {
  // Every other plugin in the manifest (self excluded) — for the
  // Settings "My other plugins" list, shown regardless of seen state.
  others: OtherPluginEntry[];
  // The subset of `others` not yet in the seen list — for the banner.
  newOnes: OtherPluginEntry[];
  dismissNew: () => void;
}

const OtherPluginsContext = createContext<OtherPluginsContextValue>({
  others: [],
  newOnes: [],
  dismissNew: () => {},
});

export const useOtherPlugins = () => useContext(OtherPluginsContext);

export const OtherPluginsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data } = useRemoteJson<OtherPluginsManifest>(OTHER_PLUGINS_MANIFEST_URL);
  // null while loading — never treat "not fetched yet" as "nothing seen",
  // which would flash every entry as new for a moment on every load.
  const [seenIds, setSeenIds] = useState<string[] | null>(null);

  useEffect(() => {
    call<[], string[]>("get_other_plugins_seen_ids")
      .then(setSeenIds)
      .catch(() => setSeenIds([]));
  }, []);

  const others = (data?.plugins ?? []).filter(
    (p: OtherPluginEntry) => p.id !== SELF_PLUGIN_ID,
  );
  const newOnes =
    seenIds === null ? [] : others.filter((p: OtherPluginEntry) => !seenIds.includes(p.id));

  const dismissNew = () => {
    const ids = others.map((p: OtherPluginEntry) => p.id);
    setSeenIds(ids);
    call<[string[]], boolean>("set_other_plugins_seen_ids", ids).catch(() => {});
  };

  return (
    <OtherPluginsContext.Provider value={{ others, newOnes, dismissNew }}>
      {children}
    </OtherPluginsContext.Provider>
  );
};
