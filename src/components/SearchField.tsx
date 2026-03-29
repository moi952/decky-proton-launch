import React from "react";
import { TextField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import PanelSectionCustom from "./PanelSectionCustom";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  return (
    <PanelSectionCustom style={{ paddingBottom: "0", paddingTop: "0" }}>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        label={t("search")}
        style={{
          width: "100%",
          marginBottom: "0!important",
          padding: "4px 10px",
        }}
      />
    </PanelSectionCustom>
  );
};
