import React from "react";
import { useFavorites } from "../context/FavoritesContext";
import { VariableItem } from "./VariableItem";
import { FiStar } from "react-icons/fi";
import TitleSection from "./TitleSection";
import PanelSectionCustom from "./PanelSectionCustom";

export const FavoriteSection: React.FC = () => {
  const { favorites } = useFavorites();

  if (!favorites.length) return null;

  return (
    <PanelSectionCustom>
      <TitleSection title="favorites" icon={<FiStar size={12} />} />
      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
        {favorites.map((f) => (
          <VariableItem
            key={f.name}
            title={f.name}
            env={f.env || ""}
            value={f.value}
            isFavorite
          />
        ))}
      </div>
    </PanelSectionCustom>
  );
};
