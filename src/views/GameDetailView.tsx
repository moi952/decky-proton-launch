import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Focusable,
  GamepadButton,
  PanelSection,
  PanelSectionRow,
  ToggleField,
} from "@decky/ui";
import type { GamepadEvent } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { ActionButton } from "../components/ActionButton";
import { InlineConfirm } from "../components/InlineConfirm";
import { GameCover } from "../components/GameCover";
import { VariableToggleRow } from "../components/VariableToggleRow";
import { FiArrowLeft, FiExternalLink, FiLink, FiTerminal } from "react-icons/fi";
import { FaCog } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { SteamGame } from "./GamesPickerView";
import { useSettings } from "../context/SettingsContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useRemoteData } from "../context/RemoteDataContext";
import { toggleWrapper, doRemoveWrapper } from "../utils/wrapperAction";
import { getGameStatus, STATUS_COLOR, STATUS_LABEL_KEY } from "../utils/gameStatus";
import { useFavorites } from "../context/FavoritesContext";
import {
  openEditCustomVariableModal,
  openEditCustomWrapperModal,
} from "../utils/modals";
import { Variable } from "../data/types";

const getVariableDefault = (variable: Variable): string => {
  if (variable.type === "enum" && "values" in variable) {
    return (
      ("defaultValue" in variable && (variable as any).defaultValue) ||
      variable.values?.[0]?.value ||
      "1"
    );
  }
  return (variable as any).value ?? "1";
};

interface GameDetailViewProps {
  game: SteamGame;
  onBack: () => void;
}

export const GameDetailView: React.FC<GameDetailViewProps> = ({
  game,
  onBack,
}) => {
  const { t } = useTranslation("game_manager");
  const { t: tVars } = useTranslation("variables");
  const { t: tCat } = useTranslation("categories");
  const { t: tCommon } = useTranslation("common");
  const { t: tFavModal } = useTranslation("delete_favorite_modal");
  const { t: tDeleteWrapper } = useTranslation("delete_custom_wrapper_modal");
  const { t: tDeleteVariable } = useTranslation("delete_custom_variable_modal");
  const { isCategoryVisible, showActiveSection } = useSettings();
  const { customVariables, removeCustomVariable } = useCustomVariables();
  const { customWrappers, removeCustomWrapper } = useCustomWrappers();
  const { variables: variablesData } = useRemoteData();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const allVariables: Variable[] = variablesData.flatMap(
    (cat) => cat.variables as Variable[],
  );

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [disabledGlobals, setDisabledGlobals] = useState<string[]>([]);
  const [disabledGlobalsDraft, setDisabledGlobalsDraft] = useState<string[]>(
    [],
  );
  const [globalVars, setGlobalVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<string>("");
  const [launchOptionStatus, setLaunchOptionStatus] = useState<string | null>(
    null,
  );
  const [hasWrapper, setHasWrapper] = useState(false);
  const [pendingDeleteFav, setPendingDeleteFav] = useState<string | null>(null);
  const [confirmRemoveWrapper, setConfirmRemoveWrapper] = useState(false);
  const [pendingDeleteVariable, setPendingDeleteVariable] = useState<
    string | null
  >(null);
  const [pendingDeleteCustomWrapper, setPendingDeleteCustomWrapper] =
    useState<string | null>(null);

  // Track whether initial load is done so we don't auto-save on mount
  const initializedRef = useRef(false);
  const profileRef = useRef(profile);
  const disabledGlobalsRef = useRef(disabledGlobals);
  const wrapperSectionRef = useRef<HTMLDivElement>(null);
  profileRef.current = profile;
  disabledGlobalsRef.current = disabledGlobals;

  const reload = useCallback(() => {
    initializedRef.current = false;
    setLoading(true);
    Promise.all([
      call<[number], { vars: Record<string, string>; disabled_globals: string[] }>(
        "get_game_profile",
        game.appid,
      ),
      call<[number, boolean], boolean>(
        "get_wrapper_status",
        game.appid,
        game.is_shortcut,
      ),
      call<[], Record<string, string>>("get_global_profile"),
    ])
      .then(([p, wrapperSet, global]) => {
        setProfile(p.vars);
        setDraft(p.vars);
        setDisabledGlobals(p.disabled_globals);
        setDisabledGlobalsDraft(p.disabled_globals);
        setHasWrapper(wrapperSet);
        setGlobalVars(global);
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => {
          initializedRef.current = true;
        }, 50);
      });
  }, [game.appid, game.is_shortcut]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!loading && wrapperSectionRef.current) {
      const first = wrapperSectionRef.current.querySelector(
        "button",
      ) as HTMLElement | null;
      first?.focus();
    }
  }, [loading]);

  // Auto-save with debounce
  useEffect(() => {
    if (!initializedRef.current) return;
    const draftUnchanged =
      JSON.stringify(draft) === JSON.stringify(profileRef.current);
    const disabledUnchanged =
      JSON.stringify([...disabledGlobalsDraft].sort()) ===
      JSON.stringify([...disabledGlobalsRef.current].sort());
    if (draftUnchanged && disabledUnchanged) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const currentDraft = draft;
        const currentDisabled = disabledGlobalsDraft;
        if (
          Object.keys(currentDraft).length === 0 &&
          currentDisabled.length === 0
        ) {
          await call<[number], boolean>("delete_game_profile", game.appid);
        } else {
          await call<
            [number, Record<string, string>, string, string[]],
            boolean
          >(
            "set_game_profile",
            game.appid,
            currentDraft,
            game.name,
            currentDisabled,
          );
        }
        setProfile(currentDraft);
        setDisabledGlobals(currentDisabled);
      } catch {
        toaster.toast({ title: "Error", body: t("error_save") });
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [draft, disabledGlobalsDraft]);

  const hasProfile =
    Object.keys(profile).length > 0 || disabledGlobals.length > 0;
  const status = getGameStatus(hasProfile, hasWrapper);

  const isGlobalVar = (envKey: string) => globalVars[envKey] !== undefined;

  // Local override (draft) always wins; otherwise a globally-active command
  // is inherited unless this game explicitly disabled it.
  const isVarActive = (envKey: string): boolean => {
    if (draft[envKey] !== undefined) return true;
    if (isGlobalVar(envKey)) return !disabledGlobalsDraft.includes(envKey);
    return false;
  };

  const getVarValue = (envKey: string, defaultValue: string): string => {
    if (draft[envKey] !== undefined) return draft[envKey];
    if (isGlobalVar(envKey) && !disabledGlobalsDraft.includes(envKey)) {
      return globalVars[envKey];
    }
    return defaultValue;
  };

  const toggleVar = (envKey: string, defaultValue: string) => {
    if (isVarActive(envKey)) {
      if (draft[envKey] !== undefined) {
        setDraft((prev) => {
          const next = { ...prev };
          delete next[envKey];
          return next;
        });
      }
      if (isGlobalVar(envKey)) {
        setDisabledGlobalsDraft((prev) =>
          prev.includes(envKey) ? prev : [...prev, envKey],
        );
      }
      return;
    }
    if (isGlobalVar(envKey)) {
      setDisabledGlobalsDraft((prev) => prev.filter((k) => k !== envKey));
      return;
    }
    setDraft((prev) => ({ ...prev, [envKey]: defaultValue }));
  };

  // A chip pick always sets an explicit local value, whether the command
  // starts out globally-inherited or purely local.
  const setVarValue = (envKey: string, value: string) => {
    setDraft((prev) => ({ ...prev, [envKey]: value }));
    if (isGlobalVar(envKey)) {
      setDisabledGlobalsDraft((prev) => prev.filter((k) => k !== envKey));
    }
  };

  const toggleFavorite = (env: string, name: string, value: string) => {
    const existing = favorites.find((f) => f.env === env);
    if (existing) {
      removeFavorite(existing.name);
    } else {
      addFavorite({ name, env, value });
    }
  };

  const deleteProfile = async () => {
    setSaving(true);
    try {
      await call<[number], boolean>("delete_game_profile", game.appid);
      setProfile({});
      setDraft({});
      setDisabledGlobals([]);
      setDisabledGlobalsDraft([]);
      toaster.toast({ title: game.name, body: t("profile_deleted") });
    } catch {
      toaster.toast({ title: "Error", body: t("error_save") });
    } finally {
      setSaving(false);
    }
  };

  // Surfaced at the top so the user doesn't have to scroll every category to
  // see what's currently on for this game. Favorites take priority on
  // dedup — a favorited catalog variable only shows once, up here.
  const activeFavorites = favorites.filter((f) => f.env && isVarActive(f.env));
  const activeFavoriteEnvs = new Set(activeFavorites.map((f) => f.env));
  const activeCustomVariables = customVariables.filter((cv) =>
    isVarActive(cv.env),
  );
  const activeCustomWrappers = customWrappers.filter((w) => isVarActive(w.env));
  const activeCatalogVariables = allVariables.filter(
    (v) => isVarActive(v.env) && !activeFavoriteEnvs.has(v.env),
  );
  const hasActiveCommands =
    showActiveSection &&
    (activeFavorites.length > 0 ||
      activeCustomVariables.length > 0 ||
      activeCustomWrappers.length > 0 ||
      activeCatalogVariables.length > 0);

  const loadLog = async () => {
    const [content, status] = await Promise.all([
      call<[number], string>("get_launch_log", game.appid),
      game.is_shortcut
        ? Promise.resolve("(non-Steam shortcut)")
        : call<[number], string>("get_launch_option_status", game.appid),
    ]);
    setLog(content);
    setLaunchOptionStatus(status);
    setShowLog(true);
  };

  return (
    <div>
      {/* Header */}
      <PanelSection>
        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton onClick={onBack}>
            <FiArrowLeft size={16} />
          </ActionButton>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {game.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: STATUS_COLOR[status],
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {status === "wrapper_only" ? (
                <FiLink size={8} />
              ) : status !== "none" ? (
                <FaCog size={8} />
              ) : null}
              <span>{t(STATUS_LABEL_KEY[status])}</span>
              {saving && <span style={{ color: "#666" }}>— {t("saving")}</span>}
            </div>
          </div>
          <ActionButton onClick={showLog ? () => setShowLog(false) : loadLog}>
            <FiTerminal size={14} />
          </ActionButton>
        </Focusable>
      </PanelSection>

      {/* Wrapper + product page actions */}
      <div ref={wrapperSectionRef}>
      <PanelSection>
        <Focusable
          style={{ display: "flex", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton
            width="100%"
            onClick={() => {
              if (hasWrapper) {
                setConfirmRemoveWrapper(true);
              } else {
                toggleWrapper(game, false, t, (nowSet) => setHasWrapper(nowSet));
              }
            }}
          >
            <FiLink size={12} />
            <span style={{ marginLeft: 4 }}>
              {hasWrapper ? t("remove_wrapper") : t("add_wrapper")}
            </span>
          </ActionButton>
          <ActionButton
            onClick={() =>
              window.open(`steam://nav/games/details/${game.appid}`)
            }
          >
            <FiExternalLink size={14} />
          </ActionButton>
        </Focusable>
        {confirmRemoveWrapper && (
          <div style={{ marginTop: "8px" }}>
            <InlineConfirm
              description={t("delete_wrapper_description", { game_name: game.name })}
              confirmLabel={t("delete_wrapper_confirm")}
              onCancel={() => setConfirmRemoveWrapper(false)}
              onConfirm={() => {
                setConfirmRemoveWrapper(false);
                doRemoveWrapper(game, t, (nowSet) => setHasWrapper(nowSet));
              }}
            />
          </div>
        )}
      </PanelSection>
      </div>

      {/* Debug log viewer */}
      {showLog && (
        <PanelSection title="Debug">
          <PanelSectionRow>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>
              <span style={{ color: "#666" }}>AppId: </span>
              <span style={{ color: "#fff", fontFamily: "monospace" }}>
                {game.appid}
              </span>
              <span style={{ color: "#555", marginLeft: 8 }}>
                ({game.is_shortcut ? "shortcut" : "steam"})
              </span>
            </div>
          </PanelSectionRow>
          {launchOptionStatus !== null && (
            <PanelSectionRow>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>
                <span style={{ color: "#666" }}>LaunchOptions: </span>
                <span
                  style={{
                    color: launchOptionStatus.includes(
                      "~/.config/decky-proton-launch/proton-launch",
                    )
                      ? "#4caf50"
                      : "#f90",
                  }}
                >
                  {launchOptionStatus}
                </span>
              </div>
            </PanelSectionRow>
          )}

          <PanelSectionRow>
            <pre
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                background: "#111",
                padding: "6px 8px",
                borderRadius: "4px",
                color: "#aaa",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 180,
                overflow: "auto",
              }}
            >
              {log}
            </pre>
          </PanelSectionRow>
        </PanelSection>
      )}

      <GameCover game={game} />

      {/* Variables */}
      {loading ? (
        <PanelSection>
          <PanelSectionRow>
            <span style={{ color: "#888", fontSize: 12 }}>{t("loading")}</span>
          </PanelSectionRow>
        </PanelSection>
      ) : (
        <div>
          {hasActiveCommands && (
            <PanelSection title={tCat("active")}>
              {activeFavorites.map((fav) => {
                const catalogVar = allVariables.find((v) => v.env === fav.env);
                const isGlobal = isGlobalVar(fav.env!);
                const globalHint = isGlobal
                  ? t(
                      isVarActive(fav.env!)
                        ? "global_active_hint"
                        : "global_disabled_hint",
                    )
                  : undefined;
                return catalogVar ? (
                  <VariableToggleRow
                    key={fav.name}
                    variable={catalogVar}
                    isActive={isVarActive(fav.env!)}
                    currentValue={getVarValue(
                      fav.env!,
                      getVariableDefault(catalogVar),
                    )}
                    description={globalHint}
                    onToggle={() =>
                      toggleVar(fav.env!, getVariableDefault(catalogVar))
                    }
                    onValueChange={(v) => setVarValue(fav.env!, v)}
                  />
                ) : (
                  <PanelSectionRow key={fav.name}>
                    <ToggleField
                      label={fav.name}
                      checked={draft[fav.env!] !== undefined}
                      onChange={() => toggleVar(fav.env!, fav.value)}
                    />
                  </PanelSectionRow>
                );
              })}
              {activeCustomVariables.map((cv) => (
                <PanelSectionRow key={cv.id}>
                  <ToggleField
                    label={cv.name}
                    checked={draft[cv.env] !== undefined}
                    onChange={() => toggleVar(cv.env, cv.value)}
                  />
                </PanelSectionRow>
              ))}
              {activeCustomWrappers.map((w) => {
                const isGlobal = isGlobalVar(w.env);
                const globalHint = isGlobal
                  ? t(
                      isVarActive(w.env)
                        ? "global_active_hint"
                        : "global_disabled_hint",
                    )
                  : undefined;
                return (
                  <VariableToggleRow
                    key={w.id}
                    variable={{ title: w.name, env: w.env, type: "exec", exec: w.exec }}
                    isActive={isVarActive(w.env)}
                    currentValue={getVarValue(w.env, "1")}
                    description={globalHint}
                    onToggle={() => toggleVar(w.env, "1")}
                    onValueChange={(v) => setVarValue(w.env, v)}
                  />
                );
              })}
              {activeCatalogVariables.map((variable) => {
                const isGlobal = isGlobalVar(variable.env);
                const globalHint = isGlobal
                  ? t(
                      isVarActive(variable.env)
                        ? "global_active_hint"
                        : "global_disabled_hint",
                    )
                  : undefined;
                const defaultVal = getVariableDefault(variable);
                return (
                  <VariableToggleRow
                    key={variable.env}
                    variable={variable}
                    isActive={isVarActive(variable.env)}
                    currentValue={getVarValue(variable.env, defaultVal)}
                    description={globalHint}
                    onToggle={() => toggleVar(variable.env, defaultVal)}
                    onValueChange={(v) => setVarValue(variable.env, v)}
                  />
                );
              })}
            </PanelSection>
          )}

          {favorites.filter((f) => f.env).length > 0 && (
            <PanelSection title={tCat("favorites")}>
              {favorites
                .filter((f) => f.env)
                .map((fav) => {
                  if (pendingDeleteFav === fav.name) {
                    return (
                      <PanelSectionRow key={fav.name}>
                        <InlineConfirm
                          description={tFavModal("description", { favorite_name: fav.name })}
                          onCancel={() => setPendingDeleteFav(null)}
                          onConfirm={() => {
                            removeFavorite(fav.name);
                            setPendingDeleteFav(null);
                          }}
                        />
                      </PanelSectionRow>
                    );
                  }

                  const catalogVar = allVariables.find((v) => v.env === fav.env);
                  const isGlobal = isGlobalVar(fav.env!);
                  const globalHint = isGlobal
                    ? t(
                        isVarActive(fav.env!)
                          ? "global_active_hint"
                          : "global_disabled_hint",
                      )
                    : undefined;

                  return (
                    <Focusable
                      key={fav.name}
                      onButtonDown={(evt: GamepadEvent) => {
                        if (evt.detail.button === GamepadButton.SECONDARY)
                          setPendingDeleteFav(fav.name);
                      }}
                      onSecondaryActionDescription={tCommon("remove_from_favorite")}
                    >
                      {catalogVar ? (
                        <VariableToggleRow
                          variable={catalogVar}
                          isActive={isVarActive(fav.env!)}
                          currentValue={getVarValue(
                            fav.env!,
                            getVariableDefault(catalogVar),
                          )}
                          description={globalHint}
                          onToggle={() =>
                            toggleVar(fav.env!, getVariableDefault(catalogVar))
                          }
                          onValueChange={(v) => setVarValue(fav.env!, v)}
                        />
                      ) : (
                        <PanelSectionRow>
                          <ToggleField
                            label={fav.name}
                            checked={draft[fav.env!] !== undefined}
                            onChange={() => toggleVar(fav.env!, fav.value)}
                          />
                        </PanelSectionRow>
                      )}
                    </Focusable>
                  );
                })}
            </PanelSection>
          )}
          {customVariables.length > 0 && (
            <PanelSection title={tCat("custom")}>
              {customVariables.map((cv) => {
                if (pendingDeleteVariable === cv.id) {
                  return (
                    <PanelSectionRow key={cv.id}>
                      <InlineConfirm
                        description={tDeleteVariable("description", {
                          variable_name: cv.name,
                        })}
                        onCancel={() => setPendingDeleteVariable(null)}
                        onConfirm={() => {
                          removeCustomVariable(cv.id);
                          setPendingDeleteVariable(null);
                        }}
                      />
                    </PanelSectionRow>
                  );
                }
                return (
                  <Focusable
                    key={cv.id}
                    onButtonDown={(evt: GamepadEvent) => {
                      if (evt.detail.button === GamepadButton.SECONDARY)
                        openEditCustomVariableModal(cv);
                    }}
                    onSecondaryActionDescription={tCommon("edit")}
                    onOptionsButton={() => setPendingDeleteVariable(cv.id)}
                    onOptionsActionDescription={tCommon("delete")}
                  >
                    <PanelSectionRow>
                      <ToggleField
                        label={cv.name}
                        checked={draft[cv.env] !== undefined}
                        onChange={() => toggleVar(cv.env, cv.value)}
                      />
                    </PanelSectionRow>
                  </Focusable>
                );
              })}
            </PanelSection>
          )}

          {customWrappers.length > 0 && (
            <PanelSection title={tCat("custom_wrappers")}>
              {customWrappers.map((w) => {
                if (pendingDeleteCustomWrapper === w.id) {
                  return (
                    <PanelSectionRow key={w.id}>
                      <InlineConfirm
                        description={tDeleteWrapper("description", {
                          wrapper_name: w.name,
                        })}
                        onCancel={() => setPendingDeleteCustomWrapper(null)}
                        onConfirm={() => {
                          removeCustomWrapper(w.id);
                          setPendingDeleteCustomWrapper(null);
                        }}
                      />
                    </PanelSectionRow>
                  );
                }
                const isGlobal = isGlobalVar(w.env);
                const globalHint = isGlobal
                  ? t(
                      isVarActive(w.env)
                        ? "global_active_hint"
                        : "global_disabled_hint",
                    )
                  : undefined;
                return (
                  <Focusable
                    key={w.id}
                    onButtonDown={(evt: GamepadEvent) => {
                      if (evt.detail.button === GamepadButton.SECONDARY)
                        openEditCustomWrapperModal(w);
                    }}
                    onSecondaryActionDescription={tCommon("edit")}
                    onOptionsButton={() => setPendingDeleteCustomWrapper(w.id)}
                    onOptionsActionDescription={tCommon("delete")}
                  >
                    <VariableToggleRow
                      variable={{ title: w.name, env: w.env, type: "exec", exec: w.exec }}
                      isActive={isVarActive(w.env)}
                      currentValue={getVarValue(w.env, "1")}
                      description={globalHint}
                      onToggle={() => toggleVar(w.env, "1")}
                      onValueChange={(v) => setVarValue(w.env, v)}
                    />
                  </Focusable>
                );
              })}
            </PanelSection>
          )}

          {variablesData
            .filter((cat) => isCategoryVisible(cat.category))
            .map((cat) => (
              <PanelSection key={cat.category} title={tCat(cat.category)}>
                {(cat.variables as Variable[]).map((variable) => {
                  const isGlobal = isGlobalVar(variable.env);
                  const globalHint = isGlobal
                    ? t(
                        isVarActive(variable.env)
                          ? "global_active_hint"
                          : "global_disabled_hint",
                      )
                    : undefined;
                  const defaultVal = getVariableDefault(variable);

                  return (
                    <Focusable
                      key={variable.env}
                      onButtonDown={(evt: GamepadEvent) => {
                        if (evt.detail.button === GamepadButton.SECONDARY)
                          toggleFavorite(variable.env, tVars(variable.title), defaultVal);
                      }}
                      onSecondaryActionDescription={
                        favorites.some((f) => f.env === variable.env)
                          ? tCommon("remove_from_favorite")
                          : tCommon("add_to_favorite")
                      }
                    >
                      <VariableToggleRow
                        variable={variable}
                        isActive={isVarActive(variable.env)}
                        currentValue={getVarValue(variable.env, defaultVal)}
                        description={globalHint}
                        onToggle={() => toggleVar(variable.env, defaultVal)}
                        onValueChange={(v) => setVarValue(variable.env, v)}
                      />
                    </Focusable>
                  );
                })}
              </PanelSection>
            ))}
        </div>
      )}

      {/* Delete profile action */}
      {hasProfile && (
        <PanelSection>
          <PanelSectionRow>
            <ActionButton
              variant="danger"
              onClick={saving ? () => {} : deleteProfile}
              width="100%"
            >
              {t("delete_profile")}
            </ActionButton>
          </PanelSectionRow>
        </PanelSection>
      )}
    </div>
  );
};
