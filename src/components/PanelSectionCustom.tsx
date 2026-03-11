import React from "react";

const PanelSectionCustom: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div
      style={{
        padding: "4px 16px 1em 16px",
      }}
    >
      {children}
    </div>
  );
};

export default PanelSectionCustom;
