import React from "react";
import { VariableItem } from "./VariableItem";
import { useTranslation } from "react-i18next";
import { SubCategory, Variable } from "../data/types";
import TitleSection from "./TitleSection";
import PanelSectionCustom from "./PanelSectionCustom";

interface CategorySectionProps {
  category: string;
  variables: Variable[];
  isFavorite?: boolean;
  subCategory?: SubCategory;
}

const VariableList: React.FC<{ variables: Variable[]; isFavorite: boolean }> = ({
  variables,
  isFavorite,
}) => {
  const { t: tVariables } = useTranslation("variables");
  return (
    <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
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
  );
};

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  variables,
  isFavorite = false,
  subCategory,
}) => {
  const { t: tDescriptions } = useTranslation("descriptions");

  if (!variables.length && !subCategory?.variables?.length) return null;

  return (
    <React.Fragment>
      {variables.length > 0 && (
        <PanelSectionCustom>
          <TitleSection title={category} />
          <VariableList variables={variables} isFavorite={isFavorite} />
        </PanelSectionCustom>
      )}
      {subCategory && subCategory.variables.length > 0 && (
        <PanelSectionCustom>
          <div style={{ marginLeft: 12 }}>
            <TitleSection title={subCategory.title} />
            {subCategory.description && (
              <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4, margin: "0 0 8px" }}>
                {tDescriptions(subCategory.description)}
              </div>
            )}
            <VariableList variables={subCategory.variables} isFavorite={isFavorite} />
          </div>
        </PanelSectionCustom>
      )}
    </React.Fragment>
  );
};
