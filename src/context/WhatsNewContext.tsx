import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
// @ts-ignore — replaced at build time by rollup with the content of plugin.json
import manifest from "@decky/manifest";

const CURRENT_VERSION: string = manifest?.version ?? "0.0.0";

interface WhatsNewContextValue {
  currentVersion: string;
  visible: boolean;
  dismiss: () => void;
}

const WhatsNewContext = createContext<WhatsNewContextValue>({
  currentVersion: CURRENT_VERSION,
  visible: false,
  dismiss: () => {},
});

export const useWhatsNew = () => useContext(WhatsNewContext);

export const WhatsNewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [seenVersion, setSeenVersion] = useState<string | null>(null);

  useEffect(() => {
    call<[], string>("get_whats_new_seen_version")
      .then((v) => setSeenVersion(v ?? ""))
      .catch(() => setSeenVersion(""));
  }, []);

  const dismiss = () => {
    setSeenVersion(CURRENT_VERSION);
    call<[string], boolean>(
      "set_whats_new_seen_version",
      CURRENT_VERSION,
    ).catch(() => {});
  };

  // null while loading — never show (and never flash) before we actually
  // know what the user has already seen.
  const visible = seenVersion !== null && seenVersion !== CURRENT_VERSION;

  return (
    <WhatsNewContext.Provider
      value={{ currentVersion: CURRENT_VERSION, visible, dismiss }}
    >
      {children}
    </WhatsNewContext.Provider>
  );
};
