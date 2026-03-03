import React, { useState } from "react";
import variablesData from "../data/variables.json";
import { CategorySection } from "../components/CategorySection";
import { BottomBar } from "../components/BottomBar";
import { PanelSectionRow, TextField } from "@decky/ui";
import { useFavorites } from "../hook/useFavorites";
import { useTranslation } from "react-i18next";

export const Home: React.FC = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const handleAdd = (line: string) => {
    if (!selected.includes(line)) setSelected([...selected, line]);
  };

  const { favorites } = useFavorites();

  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Research */}
      <PanelSectionRow>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t("search")}
          style={{ width: "100%" }}
        />
      </PanelSectionRow>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {favorites.length > 0 && (
          <CategorySection
            key="favorites"
            category="favorites"
            variables={favorites.map((f) => ({
              title: f.name,
              env: "",
              value: f.value,
            }))}
            onAdd={handleAdd}
            isFavorite
          />
        )}

        {variablesData.map((cat) => (
          <CategorySection
            key={cat.category}
            category={cat.category}
            variables={cat.variables.filter((v) =>
              v.title.toLowerCase().includes(search.toLowerCase()),
            )}
            onAdd={handleAdd}
          />
        ))}
      </div>

      {/* Bottom bar always visible */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          padding: 4,
          backgroundColor: "inherit",
        }}
      >
        <BottomBar selected={selected} />
      </div>
    </div>
  );
};
