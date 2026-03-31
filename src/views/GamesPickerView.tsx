import React, { useState, useEffect, useCallback, useRef } from "react";
import { SearchField } from "../components/SearchField";
import { Focusable } from "@decky/ui";
import { call } from "@decky/api";
import { ActionButton } from "../components/ActionButton";
import { GameRow } from "../components/GameRow";
import { FiLink } from "react-icons/fi";
import { FaCircleNotch, FaCog } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { SteamGame, ScriptStatus } from "../data/types";

import { toggleWrapper } from "../utils/wrapperAction";

export type { SteamGame };

interface GamesPickerViewProps {
  onSelectGame: (game: SteamGame) => void;
  onScriptInstalled: () => void;
}


interface ConfiguredAppStatus {
  appid: number;
  has_launch_option: boolean;
}

export const GamesPickerView: React.FC<GamesPickerViewProps> = ({
  onSelectGame,
  onScriptInstalled,
}) => {
  const { t } = useTranslation("game_manager");
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<SteamGame[]>([]);
  const [configuredStatus, setConfiguredStatus] = useState<
    Map<number, "configured" | "ready">
  >(new Map());
  const [wrapperApps, setWrapperApps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      call<[], SteamGame[]>("get_games"),
      call<[], ConfiguredAppStatus[]>("get_configured_apps_status"),
      call<[], ScriptStatus>("is_script_installed"),
      call<[], number[]>("get_wrapper_app_ids"),
    ])
      .then(([g, appStatuses, status, wrapperIds]) => {
        setGames(g);
        const map = new Map<number, "configured" | "ready">();
        for (const s of appStatuses) {
          map.set(s.appid, s.has_launch_option ? "ready" : "configured");
        }
        setConfiguredStatus(map);
        setScriptStatus(status);
        setWrapperApps(new Set(wrapperIds));
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

  useEffect(() => {
    reload();
  }, [reload]);

  const handleQuickAdd = useCallback(
    (game: SteamGame) => {
      const alreadySet = wrapperApps.has(game.appid);
      toggleWrapper(game, alreadySet, t, (nowSet) => {
        if (nowSet) {
          setWrapperApps((prev) => new Set([...prev, game.appid]));
          setConfiguredStatus((prev) => {
            if (prev.has(game.appid)) {
              const next = new Map(prev);
              next.set(game.appid, "ready");
              return next;
            }
            return prev;
          });
        } else {
          setWrapperApps((prev) => {
            const next = new Set(prev);
            next.delete(game.appid);
            return next;
          });
          setConfiguredStatus((prev) => {
            if (prev.get(game.appid) === "ready") {
              const next = new Map(prev);
              next.set(game.appid, "configured");
              return next;
            }
            return prev;
          });
        }
      });
    },
    [wrapperApps, t],
  );

  const q = search.toLowerCase();
  const filtered = games.filter((g) => g.name.toLowerCase().includes(q));
  const configuredGames = games.filter((g) => configuredStatus.has(g.appid));
  const configuredFiltered = configuredGames.filter((g) =>
    g.name.toLowerCase().includes(q),
  );
  const unconfiguredFiltered = filtered.filter(
    (g) => !configuredStatus.has(g.appid),
  );

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(50);
  }, [q]);

  // Load more when sentinel becomes visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (
          entry.isIntersecting &&
          !loadingMoreRef.current &&
          visibleCount < unconfiguredFiltered.length
        ) {
          loadingMoreRef.current = true;

          setVisibleCount((c) => Math.min(c + 50, unconfiguredFiltered.length));

          setTimeout(() => {
            loadingMoreRef.current = false;
          }, 300);
        }
      },
      {
        threshold: 0,
        rootMargin: "0px",
        root: null,
      },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [unconfiguredFiltered.length]);

  const needsAction = scriptStatus === "missing" || scriptStatus === "outdated";

  return (
    <div>
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
            {scriptStatus === "outdated"
              ? t("script_outdated")
              : t("script_not_installed")}
          </div>
          <ActionButton onClick={installScript} width="100%">
            {installing
              ? "..."
              : t(
                  scriptStatus === "outdated"
                    ? "reinstall_script"
                    : "install_script",
                )}
          </ActionButton>
        </PanelSectionCustom>
      )}

      {/* Search */}
      <SearchField value={search} onChange={setSearch} />

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

      {/* Configured games at top */}
      {!loading &&
        configuredGames.length > 0 &&
        (!q || configuredFiltered.length > 0) && (
          <PanelSectionCustom>
            <div style={{ padding: "0 2px 4px", marginBottom: "2px" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "#888",
                  marginBottom: 2,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FaCog size={8} style={{ marginRight: 4 }} />
                {q ? configuredFiltered.length : configuredGames.length}{" "}
                {t("configured")}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#666",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  lineHeight: "1.3",
                }}
              >
                <FaCog size={7} color="#4caf50" />
                <span>{t("legend_ready")}</span>
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#666",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  lineHeight: "1.3",
                }}
              >
                <FaCog size={7} color="#f5a623" />
                <span>{t("legend_configured")}</span>
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#666",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  lineHeight: "1.3",
                }}
              >
                <FiLink size={7} color="#29b6f6" />
                <span>{t("legend_wrapper")}</span>
              </div>
            </div>
            <Focusable flow-children="vertical">
              {(q ? configuredFiltered : configuredGames).map((game) => (
                <GameRow
                  key={game.appid}
                  game={game}
                  hasProfile
                  profileStatus={configuredStatus.get(game.appid)}
                  hasWrapper={wrapperApps.has(game.appid)}
                  onClick={() => onSelectGame(game)}
                  onQuickAdd={() => handleQuickAdd(game)}
                  quickAddLabel={
                    wrapperApps.has(game.appid)
                      ? t("remove_wrapper")
                      : t("add_wrapper")
                  }
                />
              ))}
            </Focusable>
          </PanelSectionCustom>
        )}

      {/* All other games */}
      {!loading && unconfiguredFiltered.length > 0 && (
        <PanelSectionCustom>
          <Focusable flow-children="vertical">
            {unconfiguredFiltered.slice(0, visibleCount).map((game) => (
              <GameRow
                key={game.appid}
                game={game}
                hasProfile={false}
                hasWrapper={wrapperApps.has(game.appid)}
                onClick={() => onSelectGame(game)}
                onQuickAdd={() => handleQuickAdd(game)}
                quickAddLabel={
                  wrapperApps.has(game.appid)
                    ? t("remove_wrapper")
                    : t("add_wrapper")
                }
              />
            ))}
          </Focusable>
          {visibleCount < unconfiguredFiltered.length && (
            <div
              ref={sentinelRef}
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "8px 0",
              }}
            >
              <style>{`@keyframes plch-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <FaCircleNotch
                size={14}
                style={{
                  animation: "plch-spin 1s linear infinite",
                  color: "#888",
                }}
              />
            </div>
          )}
        </PanelSectionCustom>
      )}
    </div>
  );
};
