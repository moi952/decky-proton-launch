import React from "react";

const PanelSectionCustom: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div style={{ padding: "4px 16px 1em 16px", ...style }}>
    {children}
  </div>
);

export default PanelSectionCustom;
