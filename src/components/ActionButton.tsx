import React from "react";
import { DialogButton, FooterLegendProps } from "@decky/ui";

type GamepadEvt = Parameters<
  NonNullable<FooterLegendProps["onSecondaryButton"]>
>[0];

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "danger";
  width?: string | number;
  disabled?: boolean;

  // X BUTTON
  onSecondaryButton?: (evt: GamepadEvt) => void;
  onSecondaryActionDescription?: React.ReactNode;
  // Y BUTTON
  onOptionsButton?: (evt: GamepadEvt) => void;
  onOptionsActionDescription?: React.ReactNode;
  // START BUTTON
  onMenuButton?: (evt: GamepadEvt) => void;
  onMenuActionDescription?: React.ReactNode;
  // A BUTTON
  onOKButton?: (evt: GamepadEvt) => void;
  onOKActionDescription?: React.ReactNode;
  // B BUTTON
  onCancelButton?: (evt: GamepadEvt) => void;
  onCancelActionDescription?: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  size = "small",
  variant = "primary",
  width,
  disabled,
  onSecondaryButton,
  onSecondaryActionDescription,
  onOptionsButton,
  onOptionsActionDescription,
  onMenuButton,
  onMenuActionDescription,
  onOKButton,
  onOKActionDescription,
}) => {
  let style = {
    padding: "4px 8px",
    fontSize: 12,
    minHeight: 28,
  };

  if (size === "medium") {
    style = { padding: "6px 12px", fontSize: 14, minHeight: 32 };
  } else if (size === "large") {
    style = { padding: "8px 16px", fontSize: 16, minHeight: 36 };
  }

  return (
    <>
      {variant === "danger" && (
        <style>{`
        .dpl-action-danger {
            background-color: #ef4444 !important;
            color: #fff !important;
        }
        .dpl-action-danger:focus,
        .dpl-action-danger:hover {
            background-color: #fff !important;
            color: #ef4444 !important;
        }
      `}</style>
      )}
      <DialogButton
        className={variant === "danger" ? "dpl-action-danger" : undefined}
        style={{
          ...style,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: width ?? "fit-content",
          minWidth: "unset",
        }}
        onClick={onClick}
        disabled={disabled}
        onSecondaryButton={onSecondaryButton}
        onSecondaryActionDescription={onSecondaryActionDescription}
        onOptionsButton={onOptionsButton}
        onOptionsActionDescription={onOptionsActionDescription}
        onMenuButton={onMenuButton}
        onMenuActionDescription={onMenuActionDescription}
        onOKButton={onOKButton}
        onOKActionDescription={onOKActionDescription}
      >
        {children}
      </DialogButton>
    </>
  );
};
