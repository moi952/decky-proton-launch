import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { SearchField } from "../components/SearchField";
import { Focusable } from "@decky/ui";
import { call } from "@decky/api";
import { ActionButton } from "@moi952/decky-ui-kit";
import { GameRow } from "../components/GameRow";
import { GameGroupHeader } from "../components/GameGroupHeader";
import { FaCircleNotch, FaCog, FaSearch } from "react-icons/fa";
import { IconType } from "react-icons";
import { useTranslation } from "react-i18next";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { SteamGame, ScriptStatus } from "../data/types";
import { useSettings } from "../context/SettingsContext";
import {
  GameStatus,
  GAME_STATUS_ORDER,
  STATUS_COLOR,
  STATUS_GROUP_TITLE_KEY,
  STATUS_BADGE_ICON,
  getGameStatus,
} from "../utils/gameStatus";

import { toggleWrapper, doRemoveWrapper } from "../utils/wrapperAction";
import { InlineConfirm } from "../components/InlineConfirm";

export type { SteamGame };

interface GamesPickerViewProps {
  onSelectGame: (game: SteamGame) => void;
  onScriptInstalled: () => void;
}


interface ConfiguredAppStatus {
  appid: number;
  has_launch_option: boolean;
}

// Same icon choices as GameRow's own per-row badge (STATUS_BADGE_ICON) —
// "none" is the only addition, since a group header always needs some
// icon but a "none" row never shows a badge at all.
const GROUP_ICON: Record<GameStatus, IconType> = {
  ...STATUS_BADGE_ICON,
  none: FaCog,
} as Record<GameStatus, IconType>;

// Only the "not configured" bucket needs incremental rendering — it's the
// one that can hold an entire untouched Steam library.
const INCREMENTAL_STATUS: GameStatus = "none";

export const GamesPickerView: React.FC<GamesPickerViewProps> = ({
  onSelectGame,
  onScriptInstalled,
}) => {
  const { t } = useTranslation("game_manager");
  const { isGameGroupCollapsed, toggleGameGroup } = useSettings();
  // "Not configured" is never remembered across visits — it's the bulk of
  // an untouched library, so every fresh visit to this page starts it
  // collapsed again regardless of what was expanded last time.
  const [noneCollapsed, setNoneCollapsed] = useState(true);
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<SteamGame[]>([]);
  const [configuredStatus, setConfiguredStatus] = useState<
    Map<number, "configured" | "ready">
  >(new Map());
  const [wrapperApps, setWrapperApps] = useState<Set<number>>(new Set());
  const [activeGlobalKeys, setActiveGlobalKeys] = useState<string[]>([]);
  const [disabledGlobalsMap, setDisabledGlobalsMap] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [pendingRemoveWrapper, setPendingRemoveWrapper] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      call<[], SteamGame[]>("get_games"),
      call<[], ConfiguredAppStatus[]>("get_configured_apps_status"),
      call<[], ScriptStatus>("is_script_installed"),
      call<[], number[]>("get_wrapper_app_ids"),
      call<[], Record<string, string>>("get_global_profile"),
      call<[], Record<string, string[]>>("get_disabled_globals_map"),
    ])
      .then(([g, appStatuses, status, wrapperIds, globalProfile, disabledMap]) => {
        setGames(g);
        const map = new Map<number, "configured" | "ready">();
        for (const s of appStatuses) {
          map.set(s.appid, s.has_launch_option ? "ready" : "configured");
        }
        setConfiguredStatus(map);
        setScriptStatus(status);
        setWrapperApps(new Set(wrapperIds));
        setActiveGlobalKeys(Object.keys(globalProfile));
        setDisabledGlobalsMap(
          Object.fromEntries(Object.entries(disabledMap).map(([id, keys]) => [Number(id), keys])),
        );
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

  const applyWrapperChange = useCallback((game: SteamGame, nowSet: boolean) => {
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
  }, []);

  const handleQuickAdd = useCallback(
    (game: SteamGame) => {
      if (wrapperApps.has(game.appid)) {
        // Removing needs confirmation — shown inline, below this game's row.
        setPendingRemoveWrapper(game.appid);
        return;
      }
      toggleWrapper(game, t, (nowSet) => applyWrapperChange(game, nowSet));
    },
    [wrapperApps, t, applyWrapperChange],
  );

  const confirmRemoveWrapper = useCallback(
    (game: SteamGame) => {
      setPendingRemoveWrapper(null);
      doRemoveWrapper(game, t, (nowSet) => applyWrapperChange(game, nowSet));
    },
    [t, applyWrapperChange],
  );

  const q = search.toLowerCase();

  const gamesByStatus = useMemo(() => {
    const map: Record<GameStatus, SteamGame[]> = {
      ready: [],
      configured_globally: [],
      wrapper_only: [],
      configured: [],
      none: [],
    };
    for (const g of games) {
      // Whether some globally-active key still actually reaches THIS game
      // — not just whether any global command exists anywhere. A game
      // that opted out of every currently-active global (disabledGlobals
      // covers all of activeGlobalKeys) has nothing applied to it, even
      // while other games are genuinely reached by the same globals.
      const disabledForThisGame = disabledGlobalsMap[g.appid] ?? [];
      const hasActiveGlobalForThisGame = activeGlobalKeys.some(
        (key) => !disabledForThisGame.includes(key),
      );
      const status = getGameStatus(
        configuredStatus.has(g.appid),
        wrapperApps.has(g.appid),
        hasActiveGlobalForThisGame,
      );
      map[status].push(g);
    }
    return map;
  }, [games, configuredStatus, wrapperApps, activeGlobalKeys, disabledGlobalsMap]);

  const filteredByStatus = useMemo(() => {
    const map = {} as Record<GameStatus, SteamGame[]>;
    for (const status of GAME_STATUS_ORDER) {
      map[status] = gamesByStatus[status].filter((g) => g.name.toLowerCase().includes(q));
    }
    return map;
  }, [gamesByStatus, q]);

  const totalMatches = GAME_STATUS_ORDER.reduce((n, status) => n + filteredByStatus[status].length, 0);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(50);
  }, [q]);

  const incrementalGames = filteredByStatus[INCREMENTAL_STATUS];

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
          visibleCount < incrementalGames.length
        ) {
          loadingMoreRef.current = true;

          setVisibleCount((c) => Math.min(c + 50, incrementalGames.length));

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
  }, [incrementalGames.length]);

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
      <SearchField
        value={search}
        onChange={setSearch}
        size="small"
        highlightOnFocus={false}
        bottomSeparator={false}
        placeholder={t("search")}
        iconEnd={<FaSearch size={12} color="#888" />}
      />

      {loading && (
        <PanelSectionCustom>
          <span style={{ color: "#888", fontSize: 12 }}>{t("loading")}</span>
        </PanelSectionCustom>
      )}

      {!loading && totalMatches === 0 && (
        <PanelSectionCustom>
          <span style={{ color: "#888", fontSize: 12 }}>{t("no_games")}</span>
        </PanelSectionCustom>
      )}

      {!loading && (
        <PanelSectionCustom>
          {GAME_STATUS_ORDER.map((status) => {
            const groupGames = filteredByStatus[status];
            if (groupGames.length === 0) return null;
            const isNone = status === "none";
            // Searching always shows matches, regardless of the saved/local collapse state.
            const collapsed = !q && (isNone ? noneCollapsed : isGameGroupCollapsed(status));
            const isIncremental = status === INCREMENTAL_STATUS;
            const visibleGames = isIncremental ? groupGames.slice(0, visibleCount) : groupGames;

            return (
              <div key={status} style={{ marginBottom: 8 }}>
                <GameGroupHeader
                  icon={GROUP_ICON[status]}
                  color={STATUS_COLOR[status]}
                  title={t(STATUS_GROUP_TITLE_KEY[status])}
                  count={groupGames.length}
                  collapsed={collapsed}
                  onToggle={() => (isNone ? setNoneCollapsed((v) => !v) : toggleGameGroup(status))}
                />
                {!collapsed && (
                  <Focusable flow-children="vertical">
                    {visibleGames.map((game) => (
                      <React.Fragment key={game.appid}>
                        <GameRow
                          game={game}
                          status={status}
                          onClick={() => onSelectGame(game)}
                          onQuickAdd={() => handleQuickAdd(game)}
                          quickAddLabel={
                            wrapperApps.has(game.appid)
                              ? t("remove_wrapper")
                              : t("add_wrapper")
                          }
                        />
                        {pendingRemoveWrapper === game.appid && (
                          <div style={{ margin: "0 0 8px" }}>
                            <InlineConfirm
                              description={t("delete_wrapper_description", { game_name: game.name })}
                              confirmLabel={t("delete_wrapper_confirm")}
                              onCancel={() => setPendingRemoveWrapper(null)}
                              onConfirm={() => confirmRemoveWrapper(game)}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </Focusable>
                )}
                {!collapsed && isIncremental && visibleCount < groupGames.length && (
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
              </div>
            );
          })}
        </PanelSectionCustom>
      )}
    </div>
  );
};
