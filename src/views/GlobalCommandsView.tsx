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
import { ActionButton } from "@moi952/decky-ui-kit";
import { InlineConfirm } from "../components/InlineConfirm";
import { VariableRow } from "../components/VariableRow";
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
import { getVariableDefault, getTopLevelVariables, flattenAllVariables } from "../utils/variableDefaults";

interface GlobalCommandsViewProps {
  onBack: () => void;
}

export const GlobalCommandsView: React.FC<GlobalCommandsViewProps> = ({
  onBack,
}) => {
  const { t } = useTranslation("global_commands_view");
  const { t: tCat } = useTranslation("categories");
  const { t: tDescriptions } = useTranslation("descriptions");
  const { t: tVars } = useTranslation("variables");
  const { t: tCommon } = useTranslation("common");
  const { t: tDeleteWrapper } = useTranslation("delete_custom_wrapper_modal");
  const { t: tDeleteVariable } = useTranslation("delete_custom_variable_modal");
  const { isCategoryVisible, showActiveSection } = useSettings();
  const { variables: variablesData, conflictGroups } = useRemoteData();
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

  // Forces envKey inactive without flipping it on if it's already off — used
  // to cascade a subGroup off when its parent gets turned off.
  const deactivateVar = (envKey: string) => {
    setDraft((prev) => {
      if (prev[envKey] === undefined) return prev;
      const next = { ...prev };
      delete next[envKey];
      return next;
    });
  };

  const isVarActive = (envKey: string): boolean => draft[envKey] !== undefined;
  const getVarValue = (envKey: string, defaultValue: string): string =>
    draft[envKey] ?? defaultValue;

  const toggleFavorite = (env: string, name: string, value: string) => {
    const existing = favorites.find((f) => f.env === env);
    if (existing) {
      removeFavorite(existing.name);
    } else {
      addFavorite({ name, env, value });
    }
  };

  // Surfaced at the top so the user doesn't have to scroll every category to
  // see what's currently active globally.
  const topLevelVariables: Variable[] = getTopLevelVariables(variablesData);
  const envToTitle: Record<string, string> = Object.fromEntries(
    flattenAllVariables(variablesData).map((v) => [v.env, v.title]),
  );
  const activeCustomVariables = customVariables.filter(
    (cv) => draft[cv.env] !== undefined,
  );
  const activeCustomWrappers = customWrappers.filter(
    (w) => draft[w.env] !== undefined,
  );
  const activeCatalogVariables = topLevelVariables.filter(
    (v) => draft[v.env] !== undefined,
  );
  const hasActiveCommands =
    showActiveSection &&
    (activeCustomVariables.length > 0 ||
      activeCustomWrappers.length > 0 ||
      activeCatalogVariables.length > 0);

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
          {hasActiveCommands && (
            <PanelSection title={tCat("active")}>
              {activeCustomVariables.map((cv) => (
                <PanelSectionRow key={cv.id}>
                  <ToggleField
                    label={cv.name}
                    checked={draft[cv.env] !== undefined}
                    onChange={() => toggleVar(cv.env, cv.value)}
                  />
                </PanelSectionRow>
              ))}
              {activeCustomWrappers.map((w) => (
                <VariableRow
                  key={w.id}
                  variable={{
                    title: w.name,
                    env: w.env,
                    type: "exec",
                    exec: w.exec,
                  }}
                  isActive={isVarActive}
                  getValue={getVarValue}
                  onToggle={toggleVar}
                  onValueChange={setVarValue}
                  onDeactivate={deactivateVar}
                  conflictGroups={conflictGroups}
                  envToTitle={envToTitle}
                />
              ))}
              {activeCatalogVariables.map((variable) => (
                <VariableRow
                  key={variable.env}
                  variable={variable}
                  isActive={isVarActive}
                  getValue={getVarValue}
                  onToggle={toggleVar}
                  onValueChange={setVarValue}
                  onDeactivate={deactivateVar}
                  conflictGroups={conflictGroups}
                  envToTitle={envToTitle}
                />
              ))}
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
                    <VariableRow
                      variable={{
                        title: w.name,
                        env: w.env,
                        type: "exec",
                        exec: w.exec,
                      }}
                      isActive={isVarActive}
                      getValue={getVarValue}
                      onToggle={toggleVar}
                      onValueChange={setVarValue}
                      onDeactivate={deactivateVar}
                      conflictGroups={conflictGroups}
                      envToTitle={envToTitle}
                    />
                  </Focusable>
                );
              })}
            </PanelSection>
          )}

          {variablesData
            .filter((cat) => isCategoryVisible(cat.category))
            .map((cat) => (
              <React.Fragment key={cat.category}>
                <PanelSection title={tCat(cat.category)}>
                  {(cat.variables as Variable[]).map((variable) => {
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
                        <VariableRow
                          variable={variable}
                          isActive={isVarActive}
                          getValue={getVarValue}
                          onToggle={toggleVar}
                          onValueChange={setVarValue}
                          onDeactivate={deactivateVar}
                          conflictGroups={conflictGroups}
                          envToTitle={envToTitle}
                        />
                      </Focusable>
                    );
                  })}
                </PanelSection>
                {cat.subCategory && isCategoryVisible(cat.subCategory.title) && (
                  <div style={{ marginLeft: 12 }}>
                  <PanelSection title={tCat(cat.subCategory.title)}>
                    {cat.subCategory.description && (
                      <PanelSectionRow>
                        <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4, marginBottom: 4 }}>
                          {tDescriptions(cat.subCategory.description)}
                        </div>
                      </PanelSectionRow>
                    )}
                    {(cat.subCategory.variables as Variable[]).map((variable) => {
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
                          <VariableRow
                            variable={variable}
                            isActive={isVarActive}
                            getValue={getVarValue}
                            onToggle={toggleVar}
                            onValueChange={setVarValue}
                            onDeactivate={deactivateVar}
                            conflictGroups={conflictGroups}
                            envToTitle={envToTitle}
                          />
                        </Focusable>
                      );
                    })}
                  </PanelSection>
                  </div>
                )}
              </React.Fragment>
            ))}
        </React.Fragment>
      )}
    </div>
  );
};
