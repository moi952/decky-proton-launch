import React from "react";

const PanelSectionCustom: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      paddingTop: "4px",
      paddingBottom: "1em",
      ...style,
      paddingRight: "16px",
      paddingLeft: "16px",
    }}
  >
    {children}
  </div>
);

export default PanelSectionCustom;
