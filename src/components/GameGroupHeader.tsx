import React from "react";
import { DialogButton } from "@decky/ui";
import { IconType } from "react-icons";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

// Same edge-to-edge focus pattern as GameRow's GAME_ROW_STYLES — Field's own
// highlight didn't span the full row, a plain DialogButton does.
export const GAME_GROUP_HEADER_STYLES = `
  .plch-group-header:focus {
    outline: 2px solid #dcdedf !important;
    outline-offset: 0px !important;
    background: #2a3a4a !important;
  }
`;

interface GameGroupHeaderProps {
  icon: IconType;
  color: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export const GameGroupHeader: React.FC<GameGroupHeaderProps> = ({
  icon: Icon,
  color,
  title,
  count,
  collapsed,
  onToggle,
}) => (
  <DialogButton
    className="plch-group-header"
    onClick={onToggle}
    style={{
      width: "100%",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 10px",
      marginBottom: "4px",
      background: "transparent",
      border: "none",
    }}
  >
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={9} color={color} />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </span>
      <span style={{ fontSize: 11, color: "#666" }}>{count}</span>
    </span>
    {collapsed ? <FiChevronRight size={12} color="#888" /> : <FiChevronDown size={12} color="#888" />}
  </DialogButton>
);
