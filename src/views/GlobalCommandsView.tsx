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
import { useTranslation } from "react-i18next";
import { FiArrowLeft } from "react-icons/fi";
import { ActionButton } from "../components/ActionButton";
import { InlineConfirm } from "../components/InlineConfirm";
import { VariableToggleRow } from "../components/VariableToggleRow";
import { ButtonAddCustomWrapperModal } from "../components/ButtonAddCustomWrapperModal";
import { ButtonAddCustomVariableModal } from "../components/ButtonAddCustomVariableModal";
import { useSettings } from "../context/SettingsContext";
import { useRemoteData } from "../context/RemoteDataContext";
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { useFavorites } from "../context/FavoritesContext";
import {
  openEditCustomVariableModal,
  openEditCustomWrapperModal,
} from "../utils/modals";
import { Variable } from "../data/types";

interface GlobalCommandsViewProps {
  onBack: () => void;
}

export const GlobalCommandsView: React.FC<GlobalCommandsViewProps> = ({
  onBack,
}) => {
  const { t } = useTranslation("global_commands_view");
  const { t: tCat } = useTranslation("categories");
  const { t: tVars } = useTranslation("variables");
  const { t: tCommon } = useTranslation("common");
  const { t: tDeleteWrapper } = useTranslation("delete_custom_wrapper_modal");
  const { t: tDeleteVariable } = useTranslation("delete_custom_variable_modal");
  const { isCategoryVisible } = useSettings();
  const { variables: variablesData } = useRemoteData();
  const { customWrappers, removeCustomWrapper } = useCustomWrappers();
  const { customVariables, removeCustomVariable } = useCustomVariables();
  const { favorites, addFavorite, removeFavorite } = useFavorites();

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteWrapper, setPendingDeleteWrapper] = useState<
    string | null
  >(null);
  const [pendingDeleteVariable, setPendingDeleteVariable] = useState<
    string | null
  >(null);

  // Track whether initial load is done so we don't auto-save on mount
  const initializedRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const reload = useCallback(() => {
    initializedRef.current = false;
    setLoading(true);
    call<[], Record<string, string>>("get_global_profile")
      .then((p) => {
        setProfile(p);
        setDraft(p);
      })
      .catch(() => {
        setProfile({});
        setDraft({});
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => {
          initializedRef.current = true;
        }, 50);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Auto-save with debounce
  useEffect(() => {
    if (!initializedRef.current) return;
    if (JSON.stringify(draft) === JSON.stringify(profileRef.current)) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await call<[Record<string, string>], boolean>(
          "set_global_profile",
          draft,
        );
        setProfile(draft);
      } catch {
        toaster.toast({ title: "Error", body: t("error_save") });
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [draft, t]);

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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{t("title")}</div>
            {saving && (
              <div style={{ fontSize: 10, color: "#666" }}>{t("saving")}</div>
            )}
          </div>
        </Focusable>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
            {t("description")}
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection>
        <Focusable
          style={{ display: "flex", gap: "8px" }}
          flow-children="horizontal"
        >
          <div style={{ flex: 1 }}>
            <ButtonAddCustomWrapperModal />
          </div>
          <div style={{ flex: 1 }}>
            <ButtonAddCustomVariableModal />
          </div>
        </Focusable>
      </PanelSection>

      {loading ? (
        <PanelSection>
          <PanelSectionRow>
            <span style={{ color: "#888", fontSize: 12 }}>{t("loading")}</span>
          </PanelSectionRow>
        </PanelSection>
      ) : (
        <React.Fragment>
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
                if (pendingDeleteWrapper === w.id) {
                  return (
                    <PanelSectionRow key={w.id}>
                      <InlineConfirm
                        description={tDeleteWrapper("description", {
                          wrapper_name: w.name,
                        })}
                        onCancel={() => setPendingDeleteWrapper(null)}
                        onConfirm={() => {
                          removeCustomWrapper(w.id);
                          setPendingDeleteWrapper(null);
                        }}
                      />
                    </PanelSectionRow>
                  );
                }
                const isActive = draft[w.env] !== undefined;
                return (
                  <Focusable
                    key={w.id}
                    onButtonDown={(evt: GamepadEvent) => {
                      if (evt.detail.button === GamepadButton.SECONDARY)
                        openEditCustomWrapperModal(w);
                    }}
                    onSecondaryActionDescription={tCommon("edit")}
                    onOptionsButton={() => setPendingDeleteWrapper(w.id)}
                    onOptionsActionDescription={tCommon("delete")}
                  >
                    <VariableToggleRow
                      variable={{
                        title: w.name,
                        env: w.env,
                        type: "exec",
                        exec: w.exec,
                      }}
                      isActive={isActive}
                      currentValue={isActive ? draft[w.env] ?? "1" : "1"}
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
                  const isActive = draft[variable.env] !== undefined;

                  const defaultVal =
                    variable.type === "enum" && "values" in variable
                      ? ("defaultValue" in variable &&
                          (variable as any).defaultValue) ||
                        (variable as any).values?.[0]?.value ||
                        "1"
                      : (variable as any).value ?? "1";

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
                        isActive={isActive}
                        currentValue={
                          isActive ? draft[variable.env] ?? defaultVal : defaultVal
                        }
                        onToggle={() => toggleVar(variable.env, defaultVal)}
                        onValueChange={(v) => setVarValue(variable.env, v)}
                      />
                    </Focusable>
                  );
                })}
              </PanelSection>
            ))}
        </React.Fragment>
      )}
    </div>
  );
};
