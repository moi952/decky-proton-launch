import React, { useState, useEffect, useCallback } from "react";
import {
  Focusable,
  PanelSection,
  PanelSectionRow,
  TextField,
  DialogButton,
} from "@decky/ui";
import { call, toaster } from "@decky/api";
import { ActionButton } from "../components/ActionButton";
import { FiArrowLeft, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useLaunchStack } from "../context/LaunchStackContext";
import { useTranslation } from "react-i18next";

interface SteamGame {
  appid: number;
  name: string;
  is_shortcut: boolean;
}

interface GameDetailProps {
  game: SteamGame;
  onBack: () => void;
}

const GameDetail: React.FC<GameDetailProps> = ({ game, onBack }) => {
  const { t } = useTranslation("launch_options_view");
  const { stack } = useLaunchStack();
  const [currentOptions, setCurrentOptions] = useState<string | null>(null);
  const [managedKeys, setManagedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      call<[number, boolean], string>("get_launch_options", game.appid, game.is_shortcut),
      call<[number], string[]>("get_managed_keys", game.appid),
    ])
      .then(([opts, keys]) => {
        setCurrentOptions(opts);
        setManagedKeys(keys);
      })
      .catch(() => {
        setCurrentOptions("");
        setManagedKeys([]);
      })
      .finally(() => setLoading(false));
  }, [game.appid, game.is_shortcut]);

  useEffect(() => {
    reload();
  }, [reload]);

  const applyStack = async () => {
    if (!stack.length) return;
    setSaving(true);
    try {
      const ok = await call<[number, string[], boolean], boolean>(
        "apply_stack",
        game.appid,
        stack,
        game.is_shortcut
      );
      if (ok) {
        toaster.toast({ title: game.name, body: t("toast_updated") });
        reload();
      } else {
        toaster.toast({ title: "Error", body: t("error_update") });
      }
    } catch {
      toaster.toast({ title: "Error", body: t("error_backend") });
    } finally {
      setSaving(false);
    }
  };

  const removePluginOptions = async () => {
    setSaving(true);
    try {
      const ok = await call<[number, boolean], boolean>(
        "remove_plugin_options",
        game.appid,
        game.is_shortcut
      );
      if (ok) {
        toaster.toast({ title: game.name, body: t("toast_removed") });
        reload();
      } else {
        toaster.toast({ title: "Error", body: t("error_remove") });
      }
    } catch {
      toaster.toast({ title: "Error", body: t("error_backend") });
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setSaving(true);
    try {
      const ok = await call<[number, boolean], boolean>(
        "clear_launch_options",
        game.appid,
        game.is_shortcut
      );
      if (ok) {
        toaster.toast({ title: game.name, body: t("toast_cleared") });
        reload();
      } else {
        toaster.toast({ title: "Error", body: t("error_clear") });
      }
    } catch {
      toaster.toast({ title: "Error", body: t("error_backend") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PanelSection>
        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton onClick={onBack}>
            <FiArrowLeft size={16} />
          </ActionButton>
          <div>
            <div style={{ fontWeight: 600 }}>{game.name}</div>
            {game.is_shortcut && (
              <div style={{ fontSize: 10, color: "#aaa" }}>{t("non_steam")}</div>
            )}
          </div>
        </Focusable>
      </PanelSection>

      <PanelSection title={t("current_options_title")}>
        <PanelSectionRow>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              color: loading ? "#888" : undefined,
            }}
          >
            {loading ? t("loading") : currentOptions || t("empty")}
          </div>
        </PanelSectionRow>
        {managedKeys.length > 0 && (
          <PanelSectionRow>
            <div style={{ fontSize: 10, color: "#aaa" }}>
              {t("managed_by_plugin")} {managedKeys.join(", ")}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      {stack.length > 0 && (
        <PanelSection title={t("stack_to_apply")}>
          <PanelSectionRow>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {stack.join(" ")} %command%
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}

      <PanelSection>
        <PanelSectionRow>
          <Focusable
            style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
            flow-children="horizontal"
          >
            <ActionButton onClick={applyStack}>
              {saving ? t("saving") : t("apply_stack")}
            </ActionButton>
            {managedKeys.length > 0 && (
              <ActionButton onClick={removePluginOptions}>
                {saving ? "..." : t("remove_plugin_options")}
              </ActionButton>
            )}
            <ActionButton variant="danger" onClick={clearAll}>
              {saving ? "..." : t("clear_all")}
            </ActionButton>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

interface CollapsibleSectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  expanded,
  onToggle,
  children,
}) => (
  <PanelSection>
    <PanelSectionRow>
      <DialogButton
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <span>{title} ({count})</span>
        {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </DialogButton>
    </PanelSectionRow>
    {expanded && children}
  </PanelSection>
);

interface LaunchOptionsViewProps {
  onBack: () => void;
}

export const LaunchOptionsView: React.FC<LaunchOptionsViewProps> = ({
  onBack,
}) => {
  const { t } = useTranslation("launch_options_view");
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [steamExpanded, setSteamExpanded] = useState(true);
  const [nonSteamExpanded, setNonSteamExpanded] = useState(true);

  useEffect(() => {
    call<[], SteamGame[]>("get_games")
      .then((result) => setGames(result))
      .catch(() => toaster.toast({ title: "Error", body: t("error_load") }))
      .finally(() => setLoading(false));
  }, [t]);

  const handleSelect = useCallback((game: SteamGame) => {
    setSelectedGame(game);
  }, []);

  if (selectedGame) {
    return (
      <GameDetail game={selectedGame} onBack={() => setSelectedGame(null)} />
    );
  }

  const q = search.toLowerCase();
  const filtered = games.filter((g) => g.name.toLowerCase().includes(q));
  const steamGames = filtered.filter((g) => !g.is_shortcut);
  const nonSteamGames = filtered.filter((g) => g.is_shortcut);

  const renderGameRow = (game: SteamGame) => (
    <PanelSectionRow key={game.appid}>
      <DialogButton
        style={{
          width: "100%",
          textAlign: "left",
          padding: "6px 10px",
          fontSize: 13,
          marginBottom: "4px",
        }}
        onClick={() => handleSelect(game)}
      >
        {game.name}
      </DialogButton>
    </PanelSectionRow>
  );

  return (
    <div>
      <PanelSection>
        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton onClick={onBack}>
            <FiArrowLeft size={16} />
          </ActionButton>
          <span style={{ fontWeight: 600 }}>{t("title")}</span>
        </Focusable>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            label={t("search_placeholder")}
            style={{ width: "100%", marginBottom: "0!important" }}
          />
        </PanelSectionRow>
        {loading && (
          <PanelSectionRow>
            <span style={{ color: "#888", fontSize: 12 }}>{t("loading_games")}</span>
          </PanelSectionRow>
        )}
        {!loading && filtered.length === 0 && (
          <PanelSectionRow>
            <span style={{ color: "#888", fontSize: 12 }}>{t("no_games")}</span>
          </PanelSectionRow>
        )}
      </PanelSection>

      {!loading && steamGames.length > 0 && (
        <CollapsibleSection
          title="Steam"
          count={steamGames.length}
          expanded={steamExpanded}
          onToggle={() => setSteamExpanded((e) => !e)}
        >
          {steamGames.slice(0, 60).map(renderGameRow)}
        </CollapsibleSection>
      )}

      {!loading && nonSteamGames.length > 0 && (
        <CollapsibleSection
          title={t("non_steam")}
          count={nonSteamGames.length}
          expanded={nonSteamExpanded}
          onToggle={() => setNonSteamExpanded((e) => !e)}
        >
          {nonSteamGames.map(renderGameRow)}
        </CollapsibleSection>
      )}
    </div>
  );
};
