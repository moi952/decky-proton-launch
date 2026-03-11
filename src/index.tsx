import React, { useState } from "react";
import {
  definePlugin,
  addEventListener,
  removeEventListener,
  toaster,
} from "@decky/api";
import { FaRocket } from "react-icons/fa";
import { loadTranslations } from "./i18n";
import { staticClasses } from "@decky/ui";
import { AppProvider } from "./context/AppProvider";
import HomeView from "./views/HomeView";
import { SettingsView } from "./views/SettingsView";

type View = "home" | "settings";

const App: React.FC = () => {
  const [view, setView] = useState<View>("home");

  if (view === "settings")
    return <SettingsView onBack={() => setView("home")} />;
  return <HomeView onSettings={() => setView("settings")} />;
};

export default definePlugin(() => {
  loadTranslations();

  const listener = addEventListener("timer_event", (...args) => {
    toaster.toast({ title: "Event received", body: JSON.stringify(args) });
  });

  return {
    name: "decky-proton-launch",
    titleView: <div className={staticClasses.Title}>Proton Launch</div>,
    content: (
      <AppProvider>
        <App />
      </AppProvider>
    ),
    icon: <FaRocket />,
    onDismount() {
      removeEventListener("timer_event", listener);
    },
  };
});
