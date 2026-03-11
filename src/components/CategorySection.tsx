import React from "react";
import { VariableItem } from "./VariableItem";
import { useTranslation } from "react-i18next";
import { Variable } from "../data/types";
import TitleSection from "./TitleSection";
import PanelSectionCustom from "./PanelSectionCustom";

interface CategorySectionProps {
  category: string;
  variables: Variable[];
  isFavorite?: boolean;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  variables,
  isFavorite = false,
}) => {
  const { t: tVariables } = useTranslation("variables");

  if (!variables.length) return null;

  return (
    <PanelSectionCustom>
      <TitleSection title={category} />
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexDirection: "column",
        }}
      >
        {variables.map((v) => (
          <VariableItem
            key={v.env || v.title}
            title={isFavorite ? v.title : tVariables(v.title)}
            env={v.env}
            value={"value" in v ? v.value : undefined}
            variable={v}
            isFavorite={isFavorite}
          />
        ))}
      </div>
    </PanelSectionCustom>
  );
};
