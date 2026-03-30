import React from "react";
import { IconType } from "react-icons";

interface BadgeIconProps {
  icon: IconType;
  color: string;
  size?: number;
}

export const BadgeIcon: React.FC<BadgeIconProps> = ({
  icon: Icon,
  color,
  size = 9,
}) => (
  <span
    style={{
      background: "rgba(0,0,0,0.65)",
      borderRadius: "3px",
      padding: "2px 3px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color,
    }}
  >
    <Icon size={size} />
  </span>
);
