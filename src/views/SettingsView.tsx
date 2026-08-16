import React from "react";
import {
  Focusable,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  DropdownItem,
} from "@decky/ui";
import { call } from "@decky/api";
import { useSettings } from "../context/SettingsContext";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import { ActionButton } from "../components/ActionButton";
import { useRemoteData } from "../context/RemoteDataContext";
import { openGenericDeleteModal } from "../utils/modals";
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { WhatsNewCard } from "../components/WhatsNewCard";

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { isCategoryVisible, toggleCategory, defaultHome, setDefaultHome } =
    useSettings();
  const { t } = useTranslation("categories");
  const { t: tSettings } = useTranslation("settings_view");
  const { variables: variablesData, refresh } = useRemoteData();
  const { clearCustomWrappers } = useCustomWrappers();
  const { clearCustomVariables } = useCustomVariables();
  const [cachePath, setCachePath] = React.useState<string>("");
  const [showWhatsNewHistory, setShowWhatsNewHistory] = React.useState(false);

  React.useEffect(() => {
    call<[], string>("get_variables_cache_path").then(setCachePath);
  }, []);

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
          <span style={{ fontWeight: 600 }}>{tSettings("settings")}</span>
        </Focusable>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <CollapsibleSection
            label={tSettings("whats_new_history")}
            expanded={showWhatsNewHistory}
            onToggle={() => setShowWhatsNewHistory((v) => !v)}
          >
            <WhatsNewCard />
          </CollapsibleSection>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={tSettings("default_home")}>
        <PanelSectionRow>
          <DropdownItem
            rgOptions={[
              { data: "home", label: tSettings("default_home_vars") },
              {
                data: "game-manager",
                label: tSettings("default_home_game_manager"),
              },
              {
                data: "global-commands",
                label: tSettings("default_home_global_commands"),
              },
            ]}
            selectedOption={defaultHome}
            layout="below"
            renderButtonValue={(value) => (
              <span
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {value}
              </span>
            )}
            {...({ childrenContainerWidth: "max" } as any)}
            onChange={(opt) => setDefaultHome(opt.data)}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={tSettings("settings_categories")}>
        {variablesData.map((cat) => (
          <PanelSectionRow key={cat.category}>
            <ToggleField
              label={t(cat.category)}
              checked={isCategoryVisible(cat.category)}
              onChange={() => toggleCategory(cat.category)}
            />
          </PanelSectionRow>
        ))}
      </PanelSection>

      <PanelSection title={tSettings("data_title")}>
        {cachePath && (
          <React.Fragment>
            <PanelSectionRow>
              <ActionButton onClick={refresh} width="100%">
                <FiRefreshCw size={14} style={{ marginRight: 6 }} />
                {tSettings("force_refresh")}
              </ActionButton>
            </PanelSectionRow>
            <PanelSectionRow>
              <div
                style={{
                  fontSize: 9,
                  color: "#555",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                  lineHeight: "1.4",
                  marginTop: 8,
                  marginBottom: 8,
                }}
              >
                {cachePath}
              </div>
            </PanelSectionRow>
          </React.Fragment>
        )}
      </PanelSection>

      <PanelSection title={tSettings("reset_title")}>
        <PanelSectionRow>
          <div style={{ marginBottom: 8 }}>
            <ActionButton
              variant="danger"
              width="100%"
              onClick={() =>
                openGenericDeleteModal({
                  title: tSettings("clean_custom_wrappers_confirm_title"),
                  description: tSettings(
                    "clean_custom_wrappers_confirm_description",
                  ),
                  onConfirm: clearCustomWrappers,
                })
              }
            >
              {tSettings("clean_custom_wrappers")}
            </ActionButton>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ActionButton
            variant="danger"
            width="100%"
            onClick={() =>
              openGenericDeleteModal({
                title: tSettings("clean_custom_variables_confirm_title"),
                description: tSettings(
                  "clean_custom_variables_confirm_description",
                ),
                onConfirm: clearCustomVariables,
              })
            }
          >
            {tSettings("clean_custom_variables")}
          </ActionButton>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};
