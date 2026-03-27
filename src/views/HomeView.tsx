import React, { useState } from "react";
import variablesData from "../data/variables.json";
import { CategorySection } from "../components/CategorySection";
import { BottomBar } from "../components/BottomBar";
import { useTranslation } from "react-i18next";
import { CustomVariableSection } from "../components/CustomVariableSection";
import { FavoriteSection } from "../components/FavoriteSection";
import { Variable } from "../data/types";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { TextField } from "@decky/ui";
import { useSettings } from "../context/SettingsContext";

const HomeView: React.FC = () => {
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const { isCategoryVisible } = useSettings();

  return (
    <div>
      <PanelSectionCustom>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t("search")}
          style={{ width: "100%", marginBottom: "0!important", padding: "4px 10px" }}
        />
      </PanelSectionCustom>

      <div style={{ paddingBottom: "80px" }}>
        <FavoriteSection />
        <CustomVariableSection />
        {variablesData
          .filter((cat) => isCategoryVisible(cat.category))
          .map((cat) => (
            <CategorySection
              key={cat.category}
              category={cat.category}
              variables={(cat.variables as Variable[]).filter((v) =>
                v.title.toLowerCase().includes(search.toLowerCase()),
              )}
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
        <BottomBar />
      </div>
    </div>
  );
};

export default HomeView;
