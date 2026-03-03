import React from "react";
import { PanelSection } from "@decky/ui";
import { VariableItem } from "./VariableItem";
import { useTranslation } from "react-i18next";

interface CategorySectionProps {
  category: string;
  variables: { title: string; env: string; value: string }[];
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
            value={v.value}
            onAdd={onAdd}
            isFavorite={isFavorite}
          />
        ))}
      </div>
    </PanelSection>
  );
};
