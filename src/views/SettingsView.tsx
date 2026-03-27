import React from "react";
import {
  Focusable,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  DropdownItem,
} from "@decky/ui";
import { useSettings } from "../context/SettingsContext";
import { useTranslation } from "react-i18next";
import { FiArrowLeft } from "react-icons/fi";
import variablesData from "../data/variables.json";
import { ActionButton } from "../components/ActionButton";

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { isCategoryVisible, toggleCategory, defaultHome, setDefaultHome } =
    useSettings();
  const { t } = useTranslation("categories");
  const { t: tSettings } = useTranslation("settings_view");

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
    </div>
  );
};
