import React, { useState } from "react";
import variablesData from "../data/variables.json";
import { CategorySection } from "../components/CategorySection";
import { BottomBar } from "../components/BottomBar";
import { CustomVariableSection } from "../components/CustomVariableSection";
import { FavoriteSection } from "../components/FavoriteSection";
import { Variable } from "../data/types";
import { SearchField } from "../components/SearchField";
import { useSettings } from "../context/SettingsContext";

const HomeView: React.FC = () => {
  const [search, setSearch] = useState("");
  const { isCategoryVisible } = useSettings();

  return (
    <div>
      <SearchField value={search} onChange={setSearch} />

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
