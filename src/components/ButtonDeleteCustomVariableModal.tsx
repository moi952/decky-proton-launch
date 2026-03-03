import React from "react";
import {
  DialogButton,
  PanelSectionRow,
  Focusable,
  showModal,
  ModalRoot,
} from "@decky/ui";
import { useCustomVariables } from "../hook/useCustomVariables";
import { ActionButton } from "./ActionButton";
import { useTranslation } from "react-i18next";
import { FiTrash } from "react-icons/fi";

interface ButtonDeleteCustomVariableModalProps {
  id: string;
  name: string;
  size?: "small" | "medium" | "large";
}

export const ButtonDeleteCustomVariableModal: React.FC<
  ButtonDeleteCustomVariableModalProps
> = ({ id, name, size = "small" }) => {
  const { removeCustomVariable } = useCustomVariables();
  const { t } = useTranslation("delete_custom_variable_modal");

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;

    const ModalContent = () => (
      <ModalRoot>
        <div
          style={{ padding: "12px 16px", minWidth: "350px", maxWidth: "90vw" }}
        >
          <PanelSectionRow>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t("title")}</div>
          </PanelSectionRow>
          <PanelSectionRow>
            <div>{t("description", { variable_name: name })}</div>
          </PanelSectionRow>
          <PanelSectionRow>
            <Focusable
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
              flow-children="horizontal"
            >
              <DialogButton onClick={() => modalResult?.Close()}>
                {t("cancel")}
              </DialogButton>
              <DialogButton
                onClick={() => {
                  removeCustomVariable(id);
                  modalResult?.Close();
                }}
              >
                {t("confirm")}
              </DialogButton>
            </Focusable>
          </PanelSectionRow>
        </div>
      </ModalRoot>
    );

    modalResult = showModal(<ModalContent />);
  };

  return (
    <ActionButton size={size} onClick={handleOpen} variant="danger">
      <FiTrash />
    </ActionButton>
  );
};
