import React, { useState, useEffect } from "react";
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
import { copy } from "./utils/functions";
import { AppProvider } from "./context/AppProvider";
import HomeView from "./views/HomeView";
import { SettingsView } from "./views/SettingsView";
import { GamesPickerView } from "./views/GamesPickerView";
import { GameDetailView } from "./views/GameDetailView";
import { useSettings } from "./context/SettingsContext";
import { useRemoteData } from "./context/RemoteDataContext";
import { NavBar } from "./components/NavBar";
import { NowPlayingCard } from "./components/NowPlayingCard";
import { UpdateBanner } from "./components/UpdateBanner";
import { GAME_ROW_STYLES } from "./components/GameRow";
import { SteamGame, ScriptStatus } from "./data/types";

type View = "home" | "settings" | "games-picker" | "game-detail";

const getInitialView = (): View => {
  try {
    const v = localStorage.getItem("deck-proton-launch-default-home");
    if (v === "game-manager") return "games-picker";
  } catch {}
  return "home";
};

const App: React.FC = () => {
  const { defaultHome } = useSettings();
  const { noData } = useRemoteData();
  const { t } = useTranslation();
  const [view, setView] = useState<View>(getInitialView);
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [runningGame, setRunningGame] = useState<SteamGame | null>(null);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("missing");

  const goHome = () =>
    setView(defaultHome === "game-manager" ? "games-picker" : "home");

  useEffect(() => {
    call<[], ScriptStatus>("is_script_installed").then(setScriptStatus);
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

  if (view === "settings") return <SettingsView onBack={goHome} />;

  if (view === "game-detail" && selectedGame)
    return (
      <GameDetailView
        game={selectedGame}
        onBack={() => setView("games-picker")}
      />
    );

  const mainView = view as "home" | "games-picker";

  return (
    <div>
      <style>{GAME_ROW_STYLES}</style>
      <NavBar
        view={mainView}
        scriptStatus={scriptStatus}
        onHome={() => setView("home")}
        onGamesManager={() => setView("games-picker")}
        onSettings={() => setView("settings")}
        onCopyWrapper={() => copy("~/proton-launch %command%")}
      />
      <UpdateBanner />
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
    </div>
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
