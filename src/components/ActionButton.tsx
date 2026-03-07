import React from "react";
import { DialogButton } from "@decky/ui";

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "danger";
  width?: string | number;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  size = "small",
  variant = "primary",
  width,
}) => {
  let style = {
    padding: "4px 8px",
    fontSize: 12,
    height: 28,
  };

  if (size === "medium") {
    style = { padding: "6px 12px", fontSize: 14, height: 32 };
  } else if (size === "large") {
    style = { padding: "8px 16px", fontSize: 16, height: 36 };
  }

  return (
    <>
      <style>{`
      .dialog-button.danger {
          background-color: #ef4444 !important;
          color: #fff;
      }
      .dialog-button.danger:focus,
      .dialog-button.danger:hover {
          color: #ef4444 !important;
          background-color: #fff !important;
      }
    `}</style>
      <DialogButton
        className={`dialog-button ${variant === "danger" ? "danger" : "primary"}`}
        style={{
          ...style,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: width ?? "fit-content",
          minWidth: "unset",
        }}
        onClick={onClick}
      >
        {children}
      </DialogButton>
    </>
  );
};
