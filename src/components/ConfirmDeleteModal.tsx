import React from "react";
import { DialogButton, Focusable, ModalRoot } from "@decky/ui";
import { useTranslation } from "react-i18next";

interface ConfirmDeleteModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  closeModal?: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  closeModal,
}) => {
  const { t: tCommon } = useTranslation("common");
  return (
    <ModalRoot closeModal={closeModal ?? onClose}>
      <style>{`
        .dpl-danger-btn {
          background: #ef4444 !important;
          color: #fff !important;
        }
        .dpl-danger-btn:focus,
        .dpl-danger-btn:hover {
          background: transparent !important;
          color: #ef4444 !important;
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div>{description}</div>
        <Focusable
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          flow-children="horizontal"
        >
          <DialogButton onClick={onClose}>{tCommon("cancel")}</DialogButton>
          <DialogButton
            className="dpl-danger-btn"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel ?? tCommon("delete")}
          </DialogButton>
        </Focusable>
      </div>
    </ModalRoot>
  );
};
