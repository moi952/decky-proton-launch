import React from "react";
import { Focusable } from "@decky/ui";
import { FiSettings, FiList, FiPlay, FiCopy } from "react-icons/fi";
import { ActionButton } from "./ActionButton";
import PanelSectionCustom from "./PanelSectionCustom";
import { ScriptStatus } from "../data/types";
import { useTranslation } from "react-i18next";

interface NavBarProps {
  view: "home" | "games-picker";
  scriptStatus: ScriptStatus;
  onHome: () => void;
  onGamesManager: () => void;
  onSettings: () => void;
  onCopyWrapper: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({
  view,
  scriptStatus,
  onHome,
  onGamesManager,
  onSettings,
  onCopyWrapper,
}) => {
  const { t } = useTranslation("game_manager");

  return (
    <PanelSectionCustom>
      <Focusable
        style={{ display: "flex", alignItems: "center", gap: "8px" }}
        flow-children="horizontal"
      >
        <div style={{ opacity: view === "home" ? 1 : 0.4 }}>
          <ActionButton onClick={onHome}>
            <FiList size={16} />
          </ActionButton>
        </div>
        <div style={{ opacity: view === "games-picker" ? 1 : 0.4 }}>
          <ActionButton onClick={onGamesManager}>
            <FiPlay size={16} />
          </ActionButton>
        </div>
        <div style={{ flex: 1 }} />
        {scriptStatus === "current" && (
          <span
            style={{
              color: "#4caf50",
              fontSize: 14,
              lineHeight: 1,
              paddingRight: 2,
            }}
          >
            ✓
          </span>
        )}
        {scriptStatus === "outdated" && (
          <span
            style={{
              color: "#f5a623",
              fontSize: 14,
              lineHeight: 1,
              paddingRight: 2,
            }}
          >
            ⚠
          </span>
        )}
        <ActionButton onClick={onCopyWrapper} onOKActionDescription={t("copy")}>
          <FiCopy size={16} />
        </ActionButton>
        <ActionButton onClick={onSettings}>
          <FiSettings size={16} />
        </ActionButton>
      </Focusable>
    </PanelSectionCustom>
  );
};
