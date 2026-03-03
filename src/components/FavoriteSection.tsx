import React from "react";
import { PanelSection } from "@decky/ui";
import { useFavorites } from "../hook/useFavorites";
import { useTranslation } from "react-i18next";
import { VariableItem } from "./VariableItem";

interface FavoriteSectionProps {
  onAdd: (line: string) => void;
}

export const FavoriteSection: React.FC<FavoriteSectionProps> = ({ onAdd }) => {
  const { favorites } = useFavorites();
  const { t } = useTranslation("categories");

  if (!favorites.length) return null;

  return (
    <PanelSection title={t("favorites")}>
      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
        {favorites.map((f) => (
          <VariableItem
            key={f.name}
            title={f.name}
            env=""
            value={f.value}
            onAdd={onAdd}
            isFavorite
          />
        ))}
      </div>
    </PanelSection>
  );
};
