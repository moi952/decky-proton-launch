import React from "react";
import { PanelSection } from "@decky/ui";
import { VariableItem } from "./VariableItem";
import { useTranslation } from "react-i18next";
import { Variable } from "../data/types";

interface CategorySectionProps {
  category: string;
  variables: Variable[];
  onAdd: (line: string) => void;
  isFavorite?: boolean;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  variables,
  onAdd,
  isFavorite = false,
}) => {
  const { t: tCategories } = useTranslation("categories");
  const { t: tVariables } = useTranslation("variables");

  if (!variables.length) return null;

  return (
    <PanelSection title={tCategories(category)}>
      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
        {variables.map((v) => (
          <VariableItem
            key={v.env || v.title}
            title={isFavorite ? v.title : tVariables(v.title)}
            env={v.env}
            value={"value" in v ? v.value : undefined}
            variable={v}
            onAdd={onAdd}
            isFavorite={isFavorite}
          />
        ))}
      </div>
    </PanelSection>
  );
};
