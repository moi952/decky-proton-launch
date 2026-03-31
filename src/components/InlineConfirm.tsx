import React from "react";
import { Focusable } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { ActionButton } from "./ActionButton";

interface InlineConfirmProps {
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  size?: "small" | "medium" | "large";
}

export const InlineConfirm: React.FC<InlineConfirmProps> = ({
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  size = "small",
}) => {
  const { t: tCommon } = useTranslation("common");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span style={{ fontSize: 11, color: "#aaa" }}>{description}</span>
      <Focusable style={{ display: "flex", gap: "8px" }} flow-children="horizontal">
        <div style={{ flex: 1 }}>
          <ActionButton size={size} width="100%" onClick={onCancel}>
            {tCommon("cancel")}
          </ActionButton>
        </div>
        <div style={{ flex: 1 }}>
          <ActionButton size={size} variant="danger" width="100%" onClick={onConfirm}>
            {confirmLabel ?? tCommon("delete")}
          </ActionButton>
        </div>
      </Focusable>
    </div>
  );
};
