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
    <div style={{ position: "relative", height: "100%" }}>
      <PanelSectionRow>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t("search")}
          style={{ width: "100%" }}
        />
      </PanelSectionRow>

      <div style={{ paddingBottom: "80px" }}>
        {/* Favorites — BottomBar combinations */}
        <FavoriteSection onAdd={handleAdd} />

        {/* Custom variables — user-created variables */}
        <CustomVariableSection onAdd={handleAdd} />

        {/* Predefined variables */}
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
          padding: "8px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <BottomBar selected={selected} />
      </div>
    </div>
  );
};
