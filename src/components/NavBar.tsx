import React from "react";
import { Focusable } from "@decky/ui";
import { FiSettings, FiList, FiPlay } from "react-icons/fi";
import { ActionButton } from "./ActionButton";
import PanelSectionCustom from "./PanelSectionCustom";

interface NavBarProps {
  view: "home" | "games-picker";
  scriptInstalled: boolean;
  onHome: () => void;
  onGamesManager: () => void;
  onSettings: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({
  view,
  scriptInstalled,
  onHome,
  onGamesManager,
  onSettings,
}) => (
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
      {scriptInstalled && (
        <span style={{ color: "#4caf50", fontSize: 14, lineHeight: 1, paddingRight: 2 }}>✓</span>
      )}
      <ActionButton onClick={onSettings}>
        <FiSettings size={16} />
      </ActionButton>
    </Focusable>
  </PanelSectionCustom>
);
