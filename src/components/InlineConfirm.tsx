import React from "react";
import { InlineConfirm as LibInlineConfirm } from "@moi952/decky-ui-kit";
import { useTranslation } from "react-i18next";

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
    <LibInlineConfirm
      description={description}
      onCancel={onCancel}
      onConfirm={onConfirm}
      cancelLabel={tCommon("cancel")}
      confirmLabel={confirmLabel ?? tCommon("delete")}
      size={size}
    />
  );
};
