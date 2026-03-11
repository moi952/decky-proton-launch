import React, { useState } from "react";
import variablesData from "../data/variables.json";
import { CategorySection } from "../components/CategorySection";
import { BottomBar } from "../components/BottomBar";
import { TextField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { CustomVariableSection } from "../components/CustomVariableSection";
import { FavoriteSection } from "../components/FavoriteSection";
import { Variable } from "../data/types";
import PannelSectionCustom from "../components/PanelSectionCustom";

export const Home: React.FC = () => {
  const [search, setSearch] = useState("");
  const { t } = useTranslation();

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <PannelSectionCustom>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t("search")}
          style={{ width: "100%", marginBottom: "0!important", padding: "4px" }}
        />
      </PannelSectionCustom>

      <div style={{ paddingBottom: "80px" }}>
        <FavoriteSection />
        <CustomVariableSection />
        {variablesData.map((cat) => (
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
