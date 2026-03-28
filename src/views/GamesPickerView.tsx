import React, { useState, useEffect, useCallback } from "react";
import { TextField, DialogButton } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { ActionButton } from "../components/ActionButton";
import { GameRow } from "../components/GameRow";
import { FiCopy, FiChevronDown, FiChevronRight, FiEye, FiEyeOff } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { SteamGame, ScriptStatus } from "../data/types";

export type { SteamGame };

interface GamesPickerViewProps {
  runningGameId: number;
  onSelectGame: (game: SteamGame) => void;
  onScriptInstalled: () => void;
}

const copyToClipboard = (text: string) => {
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch {
    fallbackCopy(text);
  }
};

const fallbackCopy = (text: string) => {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(el);
};

export const GamesPickerView: React.FC<GamesPickerViewProps> = ({
  runningGameId,
  onSelectGame,
  onScriptInstalled,
}) => {
  const { t } = useTranslation("game_manager");
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<SteamGame[]>([]);
  const [configuredApps, setConfiguredApps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [configuredExpanded, setConfiguredExpanded] = useState(false);
  const [showCommand, setShowCommand] = useState(false);

  const LAUNCH_OPTION = "~/proton-launch %command%";

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      call<[], SteamGame[]>("get_games"),
      call<[], number[]>("get_configured_apps"),
      call<[], ScriptStatus>("is_script_installed"),
    ])
      .then(([g, apps, status]) => {
        setGames(g);
        setConfiguredApps(new Set(apps));
        setScriptStatus(status);
      })
      .finally(() => setLoading(false));
  }, []);

  const installScript = async () => {
    setInstalling(true);
    try {
      const ok = await call<[], boolean>("install_script");
      if (ok) {
        setScriptStatus("current");
        onScriptInstalled();
      }
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => { reload(); }, [reload]);

  const handleCopy = () => {
    copyToClipboard(LAUNCH_OPTION);
    toaster.toast({ title: t("copied"), body: LAUNCH_OPTION });
  };

  const q = search.toLowerCase();
  const filtered = games.filter((g) => g.name.toLowerCase().includes(q));
  const configuredGames = games.filter((g) => configuredApps.has(g.appid));
  const configuredFiltered = configuredGames.filter((g) => g.name.toLowerCase().includes(q));
  const unconfiguredFiltered = filtered.filter((g) => !configuredApps.has(g.appid));

  useEffect(() => {
    if (q && configuredFiltered.length > 0) setConfiguredExpanded(true);
  }, [q, configuredFiltered.length]);

  const needsAction = scriptStatus === "missing" || scriptStatus === "outdated";

  return (
    <div>
      {/* Launch command */}
      <PanelSectionCustom>
        {showCommand && (
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              background: "#111",
              padding: "6px 8px",
              borderRadius: "4px",
              color: "#ccc",
              wordBreak: "break-all",
              marginBottom: "6px",
            }}
          >
            {LAUNCH_OPTION}
          </div>
        )}
        <ActionButton
          onClick={handleCopy}
          width="100%"
          onSecondaryButton={() => setShowCommand((v) => !v)}
          onSecondaryActionDescription={
            showCommand ? <FiEyeOff size={14} /> : <FiEye size={14} />
          }
        >
          <FiCopy size={14} />
          <span style={{ marginLeft: 4 }}>{t("copy")}</span>
        </ActionButton>
      </PanelSectionCustom>

      {/* Script installation banner */}
      {needsAction && (
        <PanelSectionCustom>
          <div
            style={{
              background: "#2a1a00",
              border: "1px solid #f90",
              borderRadius: "6px",
              padding: "8px 10px",
              fontSize: 11,
              color: "#f90",
              marginBottom: "6px",
            }}
          >
            {scriptStatus === "outdated" ? t("script_outdated") : t("script_not_installed")}
          </div>
          <ActionButton onClick={installScript} width="100%">
            {installing ? "..." : t(scriptStatus === "outdated" ? "reinstall_script" : "install_script")}
          </ActionButton>
        </PanelSectionCustom>
      )}

      {/* Search */}
      <PanelSectionCustom style={{ paddingBottom: "6px" }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t("search")}
          style={{ width: "100%", marginBottom: "0!important" }}
        />
      </PanelSectionCustom>

      {loading && (
        <PanelSectionCustom>
          <span style={{ color: "#888", fontSize: 12 }}>{t("loading")}</span>
        </PanelSectionCustom>
      )}

      {!loading && filtered.length === 0 && (
        <PanelSectionCustom>
          <span style={{ color: "#888", fontSize: 12 }}>{t("no_games")}</span>
        </PanelSectionCustom>
      )}

      {/* Configured games — collapsible section */}
      {!loading && configuredGames.length > 0 && (!q || configuredFiltered.length > 0) && (
        <PanelSectionCustom>
          <DialogButton
            onClick={() => setConfiguredExpanded((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              fontSize: 11,
              color: "#f5a623",
              width: "100%",
              marginBottom: "4px",
            }}
          >
            {configuredExpanded ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}
            <span>⚙ {q ? configuredFiltered.length : configuredGames.length} {t("configured")}</span>
          </DialogButton>
          {configuredExpanded &&
            (q ? configuredFiltered : configuredGames).map((game) => (
              <GameRow
                key={game.appid}
                game={game}
                hasProfile
                isRunning={runningGameId > 0 && runningGameId === game.appid}
                onClick={() => onSelectGame(game)}
              />
            ))}
        </PanelSectionCustom>
      )}

      {/* All other games */}
      {!loading && unconfiguredFiltered.length > 0 && (
        <PanelSectionCustom>
          {unconfiguredFiltered.slice(0, 100).map((game) => (
            <GameRow
              key={game.appid}
              game={game}
              hasProfile={false}
              isRunning={runningGameId > 0 && runningGameId === game.appid}
              onClick={() => onSelectGame(game)}
            />
          ))}
        </PanelSectionCustom>
      )}
    </div>
  );
};
