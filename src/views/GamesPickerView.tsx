import React, { useState, useEffect, useCallback } from "react";
import {
  TextField,
  DialogButton,
} from "@decky/ui";
import { call, toaster } from "@decky/api";
import { ActionButton } from "../components/ActionButton";
import { FiCopy, FiChevronDown, FiChevronRight, FiEye, FiEyeOff } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import PanelSectionCustom from "../components/PanelSectionCustom";

export interface SteamGame {
  appid: number;
  name: string;
  is_shortcut: boolean;
}

interface GamesPickerViewProps {
  runningGameId: number;
  onSelectGame: (game: SteamGame) => void;
  onScriptInstalled: () => void;
}

const COVER_URL = (appid: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

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

// Styles injectés une seule fois pour le focus natif (gamepad + clavier)
const GAME_ROW_STYLES = `
  .plch-game-row:focus {
    border: 2px solid #dcdedf !important;
    background: #2a3a4a !important;
  }
`;

const GameRow: React.FC<{
  game: SteamGame;
  hasProfile: boolean;
  isRunning: boolean;
  onClick: () => void;
}> = ({ game, hasProfile, isRunning, onClick }) => {
  const [shortcutCover, setShortcutCover] = useState<string | null>(null);

  useEffect(() => {
    if (!game.is_shortcut) return;
    call<[number], string>("get_shortcut_cover", game.appid).then((url) => {
      if (url) setShortcutCover(url);
    });
  }, [game.appid, game.is_shortcut]);

  const border = hasProfile ? "2px solid #f5a623" : "2px solid transparent";

  return (
    <div style={{ marginBottom: "4px" }}>
      <DialogButton
        className="plch-game-row"
        onClick={onClick}
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "6px",
          border,
          background: "#1a1a2e",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={{ position: "relative", width: 80, height: 37, flexShrink: 0 }}>
          {game.is_shortcut && shortcutCover ? (
            <img
              src={shortcutCover}
              alt=""
              style={{ width: 80, height: 37, objectFit: "cover", display: "block" }}
            />
          ) : game.is_shortcut ? (
            <div
              style={{
                width: 80,
                height: 37,
                background: "#2a2a3e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: "#666",
              }}
            >
              Non-Steam
            </div>
          ) : (
            <img
              src={COVER_URL(game.appid)}
              alt=""
              style={{ width: 80, height: 37, objectFit: "cover", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {(hasProfile || isRunning) && (
            <div
              style={{
                position: "absolute",
                bottom: 3,
                left: 3,
                display: "flex",
                gap: "3px",
              }}
            >
              {hasProfile && (
                <span
                  style={{
                    background: "rgba(0,0,0,0.65)",
                    borderRadius: "3px",
                    padding: "1px 3px",
                    fontSize: 10,
                    lineHeight: 1,
                    color: "#f5a623",
                  }}
                >
                  ⚙
                </span>
              )}
              {isRunning && (
                <span
                  style={{
                    background: "rgba(0,0,0,0.65)",
                    borderRadius: "3px",
                    padding: "1px 3px",
                    fontSize: 10,
                    lineHeight: 1,
                    color: "#4caf50",
                  }}
                >
                  ▶
                </span>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "4px 8px",
            fontSize: 12,
            color: "#fff",
            flex: 1,
          }}
        >
          <span
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              textAlign: "left",
            }}
          >
            {game.name}
          </span>
        </div>
      </DialogButton>
    </div>
  );
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
  const [scriptInstalled, setScriptInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [configuredExpanded, setConfiguredExpanded] = useState(false);
  const [showCommand, setShowCommand] = useState(false);

  const LAUNCH_OPTION = "~/proton-launch %command%";

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      call<[], SteamGame[]>("get_games"),
      call<[], number[]>("get_configured_apps"),
      call<[], boolean>("is_script_installed"),
    ])
      .then(([g, apps, installed]) => {
        setGames(g);
        setConfiguredApps(new Set(apps));
        setScriptInstalled(installed);
      })
      .finally(() => setLoading(false));
  }, []);

  const installScript = async () => {
    setInstalling(true);
    try {
      const ok = await call<[], boolean>("install_script");
      if (ok) {
        setScriptInstalled(true);
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

  return (
    <div>
      <style>{GAME_ROW_STYLES}</style>
      {/* Commande de lancement */}
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

      {/* Bannière d'installation du script */}
      {scriptInstalled === false && (
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
            {t("script_not_installed")}
          </div>
          <ActionButton onClick={installScript} width="100%">
            {installing ? "..." : t("install_script")}
          </ActionButton>
        </PanelSectionCustom>
      )}


      {/* Recherche */}
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

      {/* Jeux configurés — section repliable */}
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

      {/* Tous les autres jeux */}
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
