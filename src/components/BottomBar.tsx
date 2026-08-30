import React from "react";
import { Focusable, PanelSectionRow } from "@decky/ui";
import { copy } from "../utils/functions";
import { ActionButton } from "@moi952/decky-ui-kit";
import { ButtonFavoriteModal } from "./ButtonFavoriteModal";
import { useTranslation } from "react-i18next";
import { useLaunchStack } from "../context/LaunchStackContext";

export const BottomBar: React.FC = () => {
  const { stack, clearStack } = useLaunchStack();
  const { t } = useTranslation();

  const combined = stack.join(" ") + " %command%";

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
          {stack.length ? combined : ""}
        </div>

        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton size="small" onClick={() => copy(combined)}>
            {t("copy_all")}
          </ActionButton>

          <ActionButton size="small" onClick={clearStack}>
            {t("clean")}
          </ActionButton>

          <ButtonFavoriteModal command={stack.join(" ")} size="small" />
        </Focusable>
      </div>
    </PanelSectionRow>
  );
};
