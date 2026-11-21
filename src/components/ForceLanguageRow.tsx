import React from "react";
import { PanelSectionRow, ToggleField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { detectLocale } from "../utils/forceLanguage";
import { matchesText } from "../utils/variableSearch";

interface ForceLanguageRowProps {
  // Current search: the row hides itself when it doesn't match.
  query?: string;
  isActive: boolean;
  onToggle: (locale: string) => void;
}

// Non-Steam games don't get the system language from Steam: this exports the
// locale detected from the Steam UI. The detected value is spelled out under
// the toggle so a wrong guess is visible before it is applied.
export const ForceLanguageRow: React.FC<ForceLanguageRowProps> = ({
  query = "",
  isActive,
  onToggle,
}) => {
  const { t } = useTranslation("force_language");
  const { source, locale, label } = detectLocale();

  if (!matchesText(query, label, "LANG", "LC_ALL", "language", "langue")) {
    return null;
  }

  return (
    <PanelSectionRow>
      <ToggleField
        label={t("label", { lang: label })}
        description={t("description", { locale })}
        checked={isActive}
        onChange={() => onToggle(locale)}
      />
      <div style={{ fontSize: 10, color: "#8a94a0", marginTop: 2 }}>
        {t("detected", { source, locale })}
      </div>
    </PanelSectionRow>
  );
};
