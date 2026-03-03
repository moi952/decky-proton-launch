import React, { useState } from "react";
import variablesData from "../data/variables.json";
import { CategorySection } from "../components/CategorySection";
import { BottomBar } from "../components/BottomBar";
import { PanelSectionRow, TextField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { CustomVariableSection } from "../components/CustomVariableSection";
import { FavoriteSection } from "../components/FavoriteSection";

export const Home: React.FC = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();

  const handleAdd = (line: string) => {
    if (!selected.includes(line)) setSelected([...selected, line]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PanelSectionRow>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t("search")}
          style={{ width: "100%" }}
        />
      </PanelSectionRow>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Favorites — combinaisons BottomBar */}
        <FavoriteSection onAdd={handleAdd} />

        {/* Custom variables — variables créées par l'utilisateur */}
        <CustomVariableSection onAdd={handleAdd} />

        {/* Variables prédéfinies */}
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
