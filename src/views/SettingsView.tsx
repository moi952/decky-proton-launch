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

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { isCategoryVisible, toggleCategory, defaultHome, setDefaultHome } =
    useSettings();
  const { t } = useTranslation("categories");
  const { t: tSettings } = useTranslation("settings_view");
  const { variables: variablesData, refresh } = useRemoteData();
  const [cachePath, setCachePath] = React.useState<string>("");

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

      <PanelSection title={tSettings("default_home")}>
        <PanelSectionRow>
          <DropdownItem
            rgOptions={[
              { data: "home", label: tSettings("default_home_vars") },
              {
                data: "game-manager",
                label: tSettings("default_home_game_manager"),
              },
            ]}
            selectedOption={defaultHome}
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

      {cachePath && (
        <PanelSection title="Data">
          <PanelSectionRow>
            <ActionButton onClick={refresh} width="100%">
              <FiRefreshCw size={14} style={{ marginRight: 6 }} />
              Force refresh
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
              }}
            >
              {cachePath}
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}
    </div>
  );
};
