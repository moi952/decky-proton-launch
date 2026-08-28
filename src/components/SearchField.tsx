import React from "react";
import { FieldTextInput } from "@moi952/decky-ui-kit";
import { useTranslation } from "react-i18next";
import PanelSectionCustom from "./PanelSectionCustom";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  size?: "default" | "small";
  highlightOnFocus?: boolean;
  bottomSeparator?: boolean;
  // Opts into a placeholder-inside-the-input look instead of the default
  // label-above one — pass both to fully replace the label.
  placeholder?: string;
  iconEnd?: React.ReactNode;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  size = "default",
  highlightOnFocus = true,
  bottomSeparator = true,
  placeholder,
  iconEnd,
}) => {
  const { t } = useTranslation();
  return (
    <PanelSectionCustom
      style={{ paddingBottom: "0", paddingTop: "0", marginBottom: "0" }}
    >
      <FieldTextInput
        label={placeholder ? undefined : t("search")}
        placeholder={placeholder}
        iconEnd={iconEnd}
        value={value}
        onChange={onChange}
        size={size}
        highlightOnFocus={highlightOnFocus}
        bottomSeparator={bottomSeparator}
      />
    </PanelSectionCustom>
  );
};
