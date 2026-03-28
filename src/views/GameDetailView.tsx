import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Focusable,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  DialogButton,
} from "@decky/ui";
import { call, toaster } from "@decky/api";
import { ActionButton } from "../components/ActionButton";
import { FiArrowLeft, FiTerminal } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import variablesData from "../data/variables.json";
import type { SteamGame } from "./GamesPickerView";
import { useSettings } from "../context/SettingsContext";
import { useCustomVariables } from "../context/CustomVariablesContext";

const COVER_URL = (appid: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

const GameCover: React.FC<{ game: { appid: number; is_shortcut: boolean; name: string } }> = ({ game }) => {
  const [shortcutCover, setShortcutCover] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!game.is_shortcut) return;
    call<[number], string>("get_shortcut_cover", game.appid).then((url) => {
      if (url) setShortcutCover(url);
    });
  }, [game.appid, game.is_shortcut]);

  const src = game.is_shortcut ? shortcutCover : COVER_URL(game.appid);
  if (!src) return null;

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <img
        src={src}
        alt=""
        style={{ width: "100%", borderRadius: "6px", display: "block" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
};

interface GameDetailViewProps {
  game: SteamGame;
  onBack: () => void;
}

export const GameDetailView: React.FC<GameDetailViewProps> = ({ game, onBack }) => {
  const { t } = useTranslation("game_manager");
  const { t: tVars } = useTranslation("variables");
  const { t: tCat } = useTranslation("categories");
  const { isCategoryVisible } = useSettings();
  const { customVariables } = useCustomVariables();

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<string>("");
  const [launchOptionStatus, setLaunchOptionStatus] = useState<string | null>(null);

  // Track whether initial load is done so we don't auto-save on mount
  const initializedRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const reload = useCallback(() => {
    initializedRef.current = false;
    setLoading(true);
    call<[number], Record<string, string>>("get_game_profile", game.appid)
      .then((p) => {
        setProfile(p);
        setDraft(p);
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => { initializedRef.current = true; }, 50);
      });
  }, [game.appid]);

  useEffect(() => { reload(); }, [reload]);

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
            game.name
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
    const content = await call<[], string>("get_launch_log");
    setLog(content);
    const status = game.is_shortcut
      ? "(non-Steam shortcut)"
      : await call<[number], string>("get_launch_option_status", game.appid);
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
            <div style={{ fontSize: 10, color: hasProfile ? "#f5a623" : "#888", display: "flex", alignItems: "center", gap: 4 }}>
              {hasProfile ? `⚙ ${t("profile_active")}` : t("profile_none")}
              {saving && <span style={{ color: "#666" }}>— {t("saving")}</span>}
            </div>
          </div>
          <ActionButton onClick={showLog ? () => setShowLog(false) : loadLog}>
            <FiTerminal size={14} />
          </ActionButton>
        </Focusable>
      </PanelSection>

      {/* Debug log viewer */}
      {showLog && (
        <PanelSection title="Debug">
          {launchOptionStatus !== null && (
            <PanelSectionRow>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>
                <span style={{ color: "#666" }}>LaunchOptions: </span>
                <span style={{ color: launchOptionStatus.includes("~/proton-launch") ? "#4caf50" : "#f90" }}>
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
        <>
          {variablesData
            .filter((cat) => isCategoryVisible(cat.category))
            .map((cat) => (
              <PanelSection key={cat.category} title={tCat(cat.category)}>
                {cat.variables.map((variable) => {
                  const isActive = draft[variable.env] !== undefined;

                  if (variable.type === "enum" && "values" in variable) {
                    return (
                      <React.Fragment key={variable.env}>
                        <PanelSectionRow>
                          <ToggleField
                            label={tVars(variable.title)}
                            checked={isActive}
                            onChange={() =>
                              toggleVar(
                                variable.env,
                                ("defaultValue" in variable && (variable as any).defaultValue) ||
                                  (variable as any).values?.[0]?.value || "1"
                              )
                            }
                          />
                        </PanelSectionRow>
                        {isActive && (
                          <PanelSectionRow>
                            <Focusable
                              style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
                              flow-children="horizontal"
                            >
                              {(variable as any).values.map(
                                (opt: { title: string; value: string }) => (
                                  <DialogButton
                                    key={opt.value}
                                    onClick={() => setVarValue(variable.env, opt.value)}
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: 11,
                                      background: draft[variable.env] === opt.value ? "#4caf50" : "#333",
                                      minWidth: 0,
                                    }}
                                  >
                                    {tVars(opt.title)}
                                  </DialogButton>
                                )
                              )}
                            </Focusable>
                          </PanelSectionRow>
                        )}
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={variable.env}>
                      <PanelSectionRow>
                        <ToggleField
                          label={tVars(variable.title)}
                          checked={isActive}
                          onChange={() => toggleVar(variable.env, (variable as any).value ?? "1")}
                        />
                      </PanelSectionRow>
                      {isActive && (
                        <PanelSectionRow>
                          <Focusable
                            style={{ display: "flex", gap: "4px" }}
                            flow-children="horizontal"
                          >
                            {["0", "1"].map((v) => (
                              <DialogButton
                                key={v}
                                onClick={() => setVarValue(variable.env, v)}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 11,
                                  background: draft[variable.env] === v ? "#4caf50" : "#333",
                                  minWidth: 0,
                                }}
                              >
                                {v}
                              </DialogButton>
                            ))}
                          </Focusable>
                        </PanelSectionRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </PanelSection>
            ))}

          {customVariables.length > 0 && (
            <PanelSection title={tCat("custom")}>
              {customVariables.map((cv) => (
                <PanelSectionRow key={cv.id}>
                  <ToggleField
                    label={cv.name}
                    checked={draft[cv.env] !== undefined}
                    onChange={() => toggleVar(cv.env, cv.value)}
                  />
                </PanelSectionRow>
              ))}
            </PanelSection>
          )}
        </>
      )}

      {/* Delete profile action */}
      {hasProfile && (
        <PanelSection>
          <PanelSectionRow>
            <ActionButton variant="danger" onClick={saving ? () => {} : deleteProfile}>
              {t("delete_profile")}
            </ActionButton>
          </PanelSectionRow>
        </PanelSection>
      )}
    </div>
  );
};
