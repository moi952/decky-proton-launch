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
import { loadTranslations } from "./i18n";
import { staticClasses } from "@decky/ui";
import { BackHandler } from "./components/BackHandler";
import { copy } from "./utils/functions";
import { migrateLegacyWrapper } from "./utils/migrateLegacyWrapper";
import { AppProvider } from "./context/AppProvider";
import HomeView from "./views/HomeView";
import { SettingsView } from "./views/SettingsView";
import { GamesPickerView } from "./views/GamesPickerView";
import { GameDetailView } from "./views/GameDetailView";
import { GlobalCommandsView } from "./views/GlobalCommandsView";
import { useSettings, DefaultHome } from "./context/SettingsContext";
import { useRemoteData } from "./context/RemoteDataContext";
import { NavBar } from "./components/NavBar";
import { NowPlayingCard } from "./components/NowPlayingCard";
import { UpdateBanner } from "./components/UpdateBanner";
import { WhatsNewBanner } from "./components/WhatsNewBanner";
import { GAME_ROW_STYLES } from "./components/GameRow";
import { SteamGame, ScriptStatus } from "./data/types";

type View =
  | "home"
  | "settings"
  | "games-picker"
  | "game-detail"
  | "global-commands";

const resolveHomeView = (defaultHome: DefaultHome): View => {
  if (defaultHome === "game-manager") return "games-picker";
  if (defaultHome === "global-commands") return "global-commands";
  return "home";
};

const App: React.FC = () => {
  const { defaultHome, settingsLoaded } = useSettings();
  const { noData } = useRemoteData();
  const { t } = useTranslation();
  const [view, setView] = useState<View>("games-picker");
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [runningGame, setRunningGame] = useState<SteamGame | null>(null);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("missing");

  const goHome = () => setView(resolveHomeView(defaultHome));

  // defaultHome loads asynchronously from the backend — apply it once to
  // the initial screen, without disturbing any navigation done meanwhile.
  const appliedInitialHome = useRef(false);
  useEffect(() => {
    if (settingsLoaded && !appliedInitialHome.current) {
      appliedInitialHome.current = true;
      setView(resolveHomeView(defaultHome));
    }
  }, [settingsLoaded, defaultHome]);

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
  const isOnHome = mainView === resolveHomeView(defaultHome);

  return (
    <BackHandler onBack={isOnHome ? undefined : goHome}>
      <style>{GAME_ROW_STYLES}</style>
      <NavBar
        view={mainView}
        scriptStatus={scriptStatus}
        onHome={() => setView("home")}
        onGamesManager={() => setView("games-picker")}
        onGlobalCommands={() => setView("global-commands")}
        onSettings={() => setView("settings")}
        onCopyWrapper={() =>
          copy("~/.config/decky-proton-launch/proton-launch %command%")
        }
      />
      <UpdateBanner />
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

      {view === "home" && <HomeView />}

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
