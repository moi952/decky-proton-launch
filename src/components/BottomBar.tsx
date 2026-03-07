import React from "react";
import { Focusable, PanelSectionRow } from "@decky/ui";
import { copy } from "../utils/functions";
import { ActionButton } from "./ActionButton";
import { ButtonFavoriteModal } from "./ButtonFavoriteModal";
import { useTranslation } from "react-i18next";

interface BottomBarProps {
  selected: string[];
  onInject?: (combined: string) => void;
  onClean: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  selected,
  onInject,
  onClean,
}) => {
  const combined = selected.join(" ") + " %command%";

  const { t } = useTranslation();

  return (
    <PanelSectionRow>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "100%",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            fontSize: 11,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {selected.length ? combined : ""}
        </div>

        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton size="small" onClick={() => copy(combined)}>
            {t("copy_all")}
          </ActionButton>

          <ActionButton size="small" onClick={() => onClean()}>
            {t("clean")}
          </ActionButton>

          {onInject && (
            <ActionButton size="small" onClick={() => onInject(combined)}>
              {t("inject")}
            </ActionButton>
          )}

          <ButtonFavoriteModal command={selected.join(" ")} size="small" />
        </Focusable>
      </div>
    </PanelSectionRow>
  );
};
