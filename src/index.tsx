import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  definePlugin,
  addEventListener,
  removeEventListener,
  toaster,
  call,
} from "@decky/api";
import { FaRocket } from "react-icons/fa";
import i18n from "i18next";
import { loadTranslations } from "./i18n";
import type { PluginUpdateInfo } from "./utils/githubReleases";
import { staticClasses } from "@decky/ui";
import { BackHandler } from "./components/BackHandler";
import { copy } from "./utils/functions";
import { migrateLegacyWrapper } from "./utils/migrateLegacyWrapper";
import { AppProvider } from "./context/AppProvider";
import ListCommandsView from "./views/ListCommandsView";
import { SettingsView } from "./views/SettingsView";
import { GamesPickerView } from "./views/GamesPickerView";
import { GameDetailView } from "./views/GameDetailView";
import { GlobalCommandsView } from "./views/GlobalCommandsView";
import { useSettings, DefaultHome } from "./context/SettingsContext";
import { useRemoteData } from "./context/RemoteDataContext";
import { NavBar } from "./components/NavBar";
import { NowPlayingCard } from "./components/NowPlayingCard";
import { PluginUpdateBanner } from "./components/PluginUpdate";
import { usePluginUpdate } from "./context/PluginUpdateContext";
import { markPluginUpdateExpanded } from "./utils/pluginUpdateFocus";
import { WhatsNewBanner } from "./components/WhatsNewBanner";
import { GAME_GROUP_HEADER_STYLES } from "./components/GameGroupHeader";
import { SteamGame, ScriptStatus } from "./data/types";

type View =
  | "home"
  | "settings"
  | "games-picker"
  | "game-detail"
  | "global-commands";

const resolveHomeView = (
  defaultHome: DefaultHome,
  hideVariablesPage: boolean,
): View => {
  if (defaultHome === "game-manager") return "games-picker";
  if (defaultHome === "global-commands") return "global-commands";
  return hideVariablesPage ? "games-picker" : "home";
};

// Picking any DropdownItem option makes Decky/Steam tear down and recreate
// the whole plugin panel (same finding as decky-nvidia-update's
// VersionDropdown), resetting every useState here. Persisting the last view
// outside React and restoring it within a short window afterward survives
// that; a genuinely later reopen still starts fresh.
const NAV_RESTORE_WINDOW_MS = 5000;
let lastView: View = "games-picker";
let lastViewAt = 0;

const App: React.FC = () => {
  const { defaultHome, hideVariablesPage, settingsLoaded } = useSettings();
  const { noData } = useRemoteData();
  const { info: pluginUpdateInfo } = usePluginUpdate();
  const { t } = useTranslation();
  // game-detail can't be restored this way (selectedGame would be lost
  // along with it) — fall back to games-picker for that one case.
  const isRestoringView = useRef(
    Date.now() - lastViewAt < NAV_RESTORE_WINDOW_MS && lastView !== "game-detail",
  ).current;
  const [view, setView] = useState<View>(
    isRestoringView ? lastView : "games-picker",
  );
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [runningGame, setRunningGame] = useState<SteamGame | null>(null);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("missing");

  // Keeps lastViewAt fresh the whole time this view is showing, not just
  // the instant it changed.
  useEffect(() => {
    if (view === "game-detail") return;
    lastView = view;
    lastViewAt = Date.now();
    const heartbeat = setInterval(() => {
      lastView = view;
      lastViewAt = Date.now();
    }, 1000);
    return () => clearInterval(heartbeat);
  }, [view]);

  const goHome = () =>
    setView(resolveHomeView(defaultHome, hideVariablesPage));

  // defaultHome loads asynchronously — apply it once, unless we're
  // restoring a view (see above), which this would otherwise stomp.
  const appliedInitialHome = useRef(isRestoringView);
  useEffect(() => {
    if (settingsLoaded && !appliedInitialHome.current) {
      appliedInitialHome.current = true;
      setView(resolveHomeView(defaultHome, hideVariablesPage));
    }
  }, [settingsLoaded, defaultHome, hideVariablesPage]);

  useEffect(() => {
    call<[], ScriptStatus>("is_script_installed").then(setScriptStatus);
  }, []);

  useEffect(() => {
    migrateLegacyWrapper();
  }, []);

  // Detect running game, polling every 5s
  useEffect(() => {
    const poll = async () => {
      const result = await call<
        [],
        { appid: number; name: string; is_shortcut: boolean }
      >("get_running_game");
      setRunningGame(result.appid > 0 ? (result as SteamGame) : null);
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  if (view === "settings")
    return (
      <BackHandler onBack={goHome}>
        <SettingsView onBack={goHome} />
      </BackHandler>
    );

  if (view === "global-commands")
    return (
      <BackHandler onBack={goHome}>
        {defaultHome === "global-commands" && <WhatsNewBanner />}
        <GlobalCommandsView onBack={goHome} />
      </BackHandler>
    );

  if (view === "game-detail" && selectedGame)
    return (
      <BackHandler onBack={() => setView("games-picker")}>
        <GameDetailView
          game={selectedGame}
          onBack={() => setView("games-picker")}
        />
      </BackHandler>
    );

  const mainView = view as "home" | "games-picker";
  const isOnHome =
    mainView === resolveHomeView(defaultHome, hideVariablesPage);

  return (
    <BackHandler onBack={isOnHome ? undefined : goHome}>
      <style>{GAME_GROUP_HEADER_STYLES}</style>
      <NavBar
        view={mainView}
        scriptStatus={scriptStatus}
        showHome={!hideVariablesPage}
        onHome={() => setView("home")}
        onGamesManager={() => setView("games-picker")}
        onGlobalCommands={() => setView("global-commands")}
        onSettings={() => setView("settings")}
        onCopyWrapper={() =>
          copy("~/.config/decky-proton-launch/proton-launch %command%")
        }
      />
      <PluginUpdateBanner
        info={pluginUpdateInfo}
        onClick={() => {
          markPluginUpdateExpanded();
          setView("settings");
        }}
      />
      {isOnHome && <WhatsNewBanner />}
      {noData && (
        <div style={{ margin: "4px 16px 0", padding: "6px 10px", background: "#3a0000", border: "1px solid #c00", borderRadius: "6px", fontSize: 11, color: "#ff6b6b" }}>
          {t("no_data")}
        </div>
      )}

      {runningGame && (
        <NowPlayingCard
          game={runningGame}
          onSelect={() => {
            setSelectedGame(runningGame);
            setView("game-detail");
          }}
        />
      )}

      {view === "home" && <ListCommandsView />}

      {view === "games-picker" && (
        <GamesPickerView
          onSelectGame={(game) => {
            setSelectedGame(game);
            setView("game-detail");
          }}
          onScriptInstalled={() => setScriptStatus("current")}
        />
      )}
    </BackHandler>
  );
};

export default definePlugin(() => {
  loadTranslations();

  const listener = addEventListener("timer_event", (...args) => {
    toaster.toast({ title: "Event received", body: JSON.stringify(args) });
  });

  // Fired by Plugin._main() on the Python side (see plugin_updater.py) as
  // soon as Decky loads this plugin — not gated behind the user ever
  // opening its panel, unlike the frontend's own on-mount check.
  const updateListener = addEventListener(
    "plugin_update_available",
    (info: PluginUpdateInfo) => {
      toaster.toast({
        title: i18n.t("plugin_update:section_label"),
        body: i18n.t("plugin_update:banner", { version: info?.latest_version }),
      });
    },
  );

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
      removeEventListener("plugin_update_available", updateListener);
    },
  };
});
