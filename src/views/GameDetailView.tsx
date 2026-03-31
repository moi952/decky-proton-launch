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
import { GameCover } from "../components/GameCover";
import { ValButton } from "../components/ValButton";
import { FiArrowLeft, FiExternalLink, FiLink, FiTerminal } from "react-icons/fi";
import { FaCog } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { SteamGame } from "./GamesPickerView";
import { useSettings } from "../context/SettingsContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { useRemoteData } from "../context/RemoteDataContext";
import { toggleWrapper, doRemoveWrapper } from "../utils/wrapperAction";
import { getGameStatus, STATUS_COLOR, STATUS_LABEL_KEY } from "../utils/gameStatus";
import { useFavorites } from "../context/FavoritesContext";

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
  const { isCategoryVisible } = useSettings();
  const { customVariables } = useCustomVariables();
  const { variables: variablesData } = useRemoteData();
  const { favorites, addFavorite, removeFavorite } = useFavorites();

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
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

  // Track whether initial load is done so we don't auto-save on mount
  const initializedRef = useRef(false);
  const profileRef = useRef(profile);
  const wrapperSectionRef = useRef<HTMLDivElement>(null);
  profileRef.current = profile;

  const reload = useCallback(() => {
    initializedRef.current = false;
    setLoading(true);
    Promise.all([
      call<[number], Record<string, string>>("get_game_profile", game.appid),
      call<[number, boolean], boolean>(
        "get_wrapper_status",
        game.appid,
        game.is_shortcut,
      ),
    ])
      .then(([p, wrapperSet]) => {
        setProfile(p);
        setDraft(p);
        setHasWrapper(wrapperSet);
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
    if (JSON.stringify(draft) === JSON.stringify(profileRef.current)) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const currentDraft = draft;
        if (Object.keys(currentDraft).length === 0) {
          await call<[number], boolean>("delete_game_profile", game.appid);
        } else {
          await call<[number, Record<string, string>, string], boolean>(
            "set_game_profile",
            game.appid,
            currentDraft,
            game.name,
          );
        }
        setProfile(currentDraft);
      } catch {
        toaster.toast({ title: "Error", body: t("error_save") });
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [draft]);

  const hasProfile = Object.keys(profile).length > 0;
  const status = getGameStatus(hasProfile, hasWrapper);

  const toggleVar = (envKey: string, defaultValue: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (next[envKey] !== undefined) {
        delete next[envKey];
      } else {
        next[envKey] = defaultValue;
      }
      return next;
    });
  };

  const setVarValue = (envKey: string, value: string) => {
    setDraft((prev) => ({ ...prev, [envKey]: value }));
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
      toaster.toast({ title: game.name, body: t("profile_deleted") });
    } catch {
      toaster.toast({ title: "Error", body: t("error_save") });
    } finally {
      setSaving(false);
    }
  };

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
          <Focusable
            style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}
            flow-children="horizontal"
          >
            <span style={{ fontSize: 11, flex: 1, color: "#aaa" }}>
              {t("delete_wrapper_description", { game_name: game.name })}
            </span>
            <ActionButton onClick={() => setConfirmRemoveWrapper(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton
              variant="danger"
              onClick={() => {
                setConfirmRemoveWrapper(false);
                doRemoveWrapper(game, t, (nowSet) => setHasWrapper(nowSet));
              }}
            >
              {t("delete_wrapper_confirm")}
            </ActionButton>
          </Focusable>
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
                    color: launchOptionStatus.includes("~/proton-launch")
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
          {favorites.filter((f) => f.env).length > 0 && (
            <PanelSection title={tCat("favorites")}>
              {favorites
                .filter((f) => f.env)
                .map((fav) =>
                  pendingDeleteFav === fav.name ? (
                    <PanelSectionRow key={fav.name}>
                      <Focusable
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                        flow-children="horizontal"
                      >
                        <span style={{ fontSize: 11, flex: 1, color: "#aaa" }}>
                          {tFavModal("description", { favorite_name: fav.name })}
                        </span>
                        <ActionButton onClick={() => setPendingDeleteFav(null)}>
                          {tCommon("cancel")}
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => {
                            removeFavorite(fav.name);
                            setPendingDeleteFav(null);
                          }}
                        >
                          {tCommon("delete")}
                        </ActionButton>
                      </Focusable>
                    </PanelSectionRow>
                  ) : (
                  <Focusable
                    key={fav.name}
                    onButtonDown={(evt: GamepadEvent) => {
                      if (evt.detail.button === GamepadButton.SECONDARY)
                        setPendingDeleteFav(fav.name);
                    }}
                    onSecondaryActionDescription={tCommon("remove_from_favorite")}
                  >
                    <PanelSectionRow>
                      <ToggleField
                        label={fav.name}
                        checked={draft[fav.env!] !== undefined}
                        onChange={() => toggleVar(fav.env!, fav.value)}
                      />
                    </PanelSectionRow>
                  </Focusable>
                ))}
            </PanelSection>
          )}
          {variablesData
            .filter((cat) => isCategoryVisible(cat.category))
            .map((cat) => (
              <PanelSection key={cat.category} title={tCat(cat.category)}>
                {cat.variables.map((variable) => {
                  const isActive = draft[variable.env] !== undefined;

                  if (variable.type === "enum" && "values" in variable) {
                    const defaultEnumVal =
                      ("defaultValue" in variable && (variable as any).defaultValue) ||
                      (variable as any).values?.[0]?.value ||
                      "1";
                    return (
                      <React.Fragment key={variable.env}>
                        <Focusable
                          onButtonDown={(evt: GamepadEvent) => {
                            if (evt.detail.button === GamepadButton.SECONDARY)
                              toggleFavorite(variable.env, tVars(variable.title), defaultEnumVal);
                          }}
                          onSecondaryActionDescription={
                            favorites.some((f) => f.env === variable.env)
                              ? tCommon("remove_from_favorite")
                              : tCommon("add_to_favorite")
                          }
                        >
                          <PanelSectionRow>
                            <ToggleField
                              label={tVars(variable.title)}
                              checked={isActive}
                              onChange={() => toggleVar(variable.env, defaultEnumVal)}
                            />
                          </PanelSectionRow>
                        </Focusable>
                        {isActive && (
                          <Focusable
                            style={{
                              display: "flex",
                              gap: "4px",
                              flexWrap: "wrap",
                              marginBottom: "8px",
                              marginTop: "8px",
                            }}
                            flow-children="horizontal"
                          >
                            {(variable as any).values.map(
                              (opt: { title: string; value: string }) => (
                                <ValButton
                                  key={opt.value}
                                  selected={draft[variable.env] === opt.value}
                                  onClick={() =>
                                    setVarValue(variable.env, opt.value)
                                  }
                                >
                                  {tVars(opt.title)}
                                </ValButton>
                              ),
                            )}
                          </Focusable>
                        )}
                      </React.Fragment>
                    );
                  }

                  {
                    const defaultVal = (variable as any).value ?? "1";
                    const isSimple = (variable as any).simple === true;
                    const currentVal = isActive
                      ? (draft[variable.env] ?? defaultVal)
                      : defaultVal;
                    const label = isSimple
                      ? tVars(variable.title)
                      : `${tVars(currentVal === "1" ? "enable_prefix" : "disable_prefix")} ${tVars(variable.title)}`;
                    return (
                      <React.Fragment key={variable.env}>
                        <Focusable
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
                          <PanelSectionRow>
                            <ToggleField
                              label={label}
                              checked={isActive}
                              onChange={() => toggleVar(variable.env, defaultVal)}
                            />
                          </PanelSectionRow>
                        </Focusable>
                        {isActive && !isSimple && (
                          <Focusable
                            style={{
                              display: "flex",
                              gap: "4px",
                              marginBottom: "8px",
                              marginTop: "8px",
                            }}
                            flow-children="horizontal"
                          >
                            {(["0", "1"] as const).map((v) => (
                              <ValButton
                                key={v}
                                selected={draft[variable.env] === v}
                                onClick={() => setVarValue(variable.env, v)}
                              >
                                {tVars(
                                  v === "0"
                                    ? "disable_prefix"
                                    : "enable_prefix",
                                )}
                              </ValButton>
                            ))}
                          </Focusable>
                        )}
                      </React.Fragment>
                    );
                  }
                })}
              </PanelSection>
            ))}

          {customVariables.length > 0 && (
            <PanelSection title={tCat("custom")}>
              {customVariables.map((cv) => (
                <Focusable
                  key={cv.id}
                  onButtonDown={(evt: GamepadEvent) => {
                    if (evt.detail.button === GamepadButton.SECONDARY)
                      toggleFavorite(cv.env, cv.name, cv.value);
                  }}
                  onSecondaryActionDescription={
                    favorites.some((f) => f.env === cv.env)
                      ? tCommon("remove_from_favorite")
                      : tCommon("add_to_favorite")
                  }
                >
                  <PanelSectionRow>
                    <ToggleField
                      label={cv.name}
                      checked={draft[cv.env] !== undefined}
                      onChange={() => toggleVar(cv.env, cv.value)}
                    />
                  </PanelSectionRow>
                </Focusable>
              ))}
            </PanelSection>
          )}
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
