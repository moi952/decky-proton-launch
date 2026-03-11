import React from "react";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { VariableItem } from "./VariableItem";
import { ButtonAddCustomVariableModal } from "./ButtonAddCustomVariableModal";
import { FiSliders } from "react-icons/fi";
import TitleSection from "./TitleSection";
import PanelSectionCustom from "./PanelSectionCustom";

export const CustomVariableSection: React.FC = () => {
  const { customVariables } = useCustomVariables();

  return (
    <PanelSectionCustom>
      <TitleSection title="custom" icon={<FiSliders size={12} />} />
      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
        <ButtonAddCustomVariableModal />
        {customVariables.map((v) => (
          <VariableItem
            key={v.id}
            title={v.name}
            env={v.env}
            value={v.value}
            isCustom
            customId={v.id}
          />
        ))}
      </div>
    </PanelSectionCustom>
  );
};
