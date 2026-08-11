import React, { useState } from "react";
import { Focusable } from "@decky/ui";
import { FiSettings, FiList, FiPlay, FiCopy, FiGlobe } from "react-icons/fi";
import { ActionButton } from "./ActionButton";
import PanelSectionCustom from "./PanelSectionCustom";
import { ScriptStatus } from "../data/types";
import { useTranslation } from "react-i18next";

const LAUNCH_OPTION = "~/proton-launch %command%";

interface NavBarProps {
  view: "home" | "games-picker";
  scriptStatus: ScriptStatus;
  onHome: () => void;
  onGamesManager: () => void;
  onGlobalCommands: () => void;
  onSettings: () => void;
  onCopyWrapper: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({
  view,
  scriptStatus,
  onHome,
  onGamesManager,
  onGlobalCommands,
  onSettings,
  onCopyWrapper,
}) => {
  const { t } = useTranslation("game_manager");
  const [showCommand, setShowCommand] = useState(false);

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
        <ActionButton
          onClick={onGlobalCommands}
          onOKActionDescription={t("global_commands")}
        >
          <FiGlobe size={16} />
        </ActionButton>
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
        <ActionButton
          onClick={onCopyWrapper}
          onOKActionDescription={t("copy")}
          onSecondaryButton={() => setShowCommand((v) => !v)}
          onSecondaryActionDescription={
            showCommand ? t("hide_command") : t("show_command")
          }
        >
          <FiCopy size={16} />
        </ActionButton>
        <ActionButton onClick={onSettings}>
          <FiSettings size={16} />
        </ActionButton>
      </Focusable>
      {showCommand && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            background: "#111",
            padding: "6px 8px",
            borderRadius: "4px",
            color: "#ccc",
            wordBreak: "break-all",
            marginTop: "6px",
          }}
        >
          {LAUNCH_OPTION}
        </div>
      )}
    </PanelSectionCustom>
  );
};
