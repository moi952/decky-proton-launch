import React, { useState } from "react";
import variablesData from "../data/variables.json";
import { CategorySection } from "../components/CategorySection";
import { BottomBar } from "../components/BottomBar";
import { useTranslation } from "react-i18next";
import { CustomVariableSection } from "../components/CustomVariableSection";
import { FavoriteSection } from "../components/FavoriteSection";
import { Variable } from "../data/types";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { TextField, Focusable } from "@decky/ui";
import { useSettings } from "../context/SettingsContext";
import { FiSettings } from "react-icons/fi";
import { ActionButton } from "../components/ActionButton";

const HomeView: React.FC<{ onSettings: () => void }> = ({ onSettings }) => {
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const { isCategoryVisible } = useSettings();

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <PanelSectionCustom>
        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <div style={{ flex: 1 }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              label={t("search")}
              style={{
                width: "100%",
                marginBottom: "0!important",
                padding: "4px 10px",
              }}
            />
          </div>
          <ActionButton onClick={onSettings}>
            <FiSettings size={16} />
          </ActionButton>
        </Focusable>
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
