import React from "react";
import { PanelSection } from "@decky/ui";
import { useCustomVariables } from "../hook/useCustomVariables";
import { useTranslation } from "react-i18next";
import { VariableItem } from "./VariableItem";
import { AddCustomVariableModal } from "./AddCustomVariableModal";

interface CustomVariableSectionProps {
  onAdd: (line: string) => void;
}

export const CustomVariableSection: React.FC<CustomVariableSectionProps> = ({
  onAdd,
}) => {
  const { customVariables } = useCustomVariables();
  const { t } = useTranslation("categories");

  return (
    <PanelSection title={t("custom")}>
      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
        <AddCustomVariableModal />
        {customVariables.map((v) => (
          <VariableItem
            key={v.id}
            title={v.name}
            env={v.env}
            value={v.value}
            onAdd={onAdd}
            isCustom
            customId={v.id}
          />
        ))}
      </div>
    </PanelSection>
  );
};
