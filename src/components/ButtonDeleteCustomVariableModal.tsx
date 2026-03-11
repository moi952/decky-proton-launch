import React from "react";
import { DialogButton, Focusable, ModalRoot } from "@decky/ui";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { ActionButton } from "./ActionButton";
import { useTranslation } from "react-i18next";
import { FiTrash } from "react-icons/fi";
import { openDeleteCustomVariableModal } from "../utils/modals";

interface DeleteCustomVariableModalContentProps {
  id: string;
  name: string;
  onClose: () => void;
}

export const DeleteCustomVariableModalContent: React.FC<
  DeleteCustomVariableModalContentProps
> = ({ id, name, onClose }) => {
  const { removeCustomVariable } = useCustomVariables();
  const { t } = useTranslation("delete_custom_variable_modal");
  const { t: tCommon } = useTranslation();

  return (
    <ModalRoot>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 600 }}>{t("title")}</div>
        <div>{t("description", { variable_name: name })}</div>
        <Focusable
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          flow-children="horizontal"
        >
          <DialogButton onClick={onClose}>{tCommon("cancel")}</DialogButton>
          <DialogButton
            onClick={() => {
              removeCustomVariable(id);
              onClose();
            }}
          >
            {tCommon("delete")}
          </DialogButton>
        </Focusable>
      </div>
    </ModalRoot>
  );
};

interface ButtonDeleteCustomVariableModalProps {
  id: string;
  name: string;
  size?: "small" | "medium" | "large";
}

export const ButtonDeleteCustomVariableModal: React.FC<
  ButtonDeleteCustomVariableModalProps
> = ({ id, name, size = "small" }) => (
  <ActionButton
    size={size}
    onClick={() => openDeleteCustomVariableModal(id, name)}
    variant="danger"
  >
    <FiTrash />
  </ActionButton>
);
