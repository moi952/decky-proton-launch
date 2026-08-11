import React, { useState, useEffect, useCallback, useRef } from "react";
import { Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useTranslation } from "react-i18next";
import { FiArrowLeft } from "react-icons/fi";
import { ActionButton } from "../components/ActionButton";
import { VariableToggleRow } from "../components/VariableToggleRow";
import { useSettings } from "../context/SettingsContext";
import { useRemoteData } from "../context/RemoteDataContext";
import { Variable } from "../data/types";

interface GlobalCommandsViewProps {
  onBack: () => void;
}

export const GlobalCommandsView: React.FC<GlobalCommandsViewProps> = ({
  onBack,
}) => {
  const { t } = useTranslation("global_commands_view");
  const { t: tCat } = useTranslation("categories");
  const { isCategoryVisible } = useSettings();
  const { variables: variablesData } = useRemoteData();

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      {loading ? (
        <PanelSection>
          <PanelSectionRow>
            <span style={{ color: "#888", fontSize: 12 }}>{t("loading")}</span>
          </PanelSectionRow>
        </PanelSection>
      ) : (
        variablesData
          .filter((cat) => isCategoryVisible(cat.category))
          .map((cat) => (
            <PanelSection key={cat.category} title={tCat(cat.category)}>
              {(cat.variables as Variable[]).map((variable) => {
                const isActive = draft[variable.env] !== undefined;

                if (variable.type === "enum" && "values" in variable) {
                  const defaultEnumVal =
                    ("defaultValue" in variable &&
                      (variable as any).defaultValue) ||
                    (variable as any).values?.[0]?.value ||
                    "1";
                  return (
                    <VariableToggleRow
                      key={variable.env}
                      variable={variable}
                      isActive={isActive}
                      currentValue={
                        isActive
                          ? draft[variable.env] ?? defaultEnumVal
                          : defaultEnumVal
                      }
                      onToggle={() => toggleVar(variable.env, defaultEnumVal)}
                      onValueChange={(v) => setVarValue(variable.env, v)}
                    />
                  );
                }

                const defaultVal = (variable as any).value ?? "1";
                return (
                  <VariableToggleRow
                    key={variable.env}
                    variable={variable}
                    isActive={isActive}
                    currentValue={
                      isActive ? draft[variable.env] ?? defaultVal : defaultVal
                    }
                    onToggle={() => toggleVar(variable.env, defaultVal)}
                    onValueChange={(v) => setVarValue(variable.env, v)}
                  />
                );
              })}
            </PanelSection>
          ))
      )}
    </div>
  );
};
