import React from "react";
import {
  DialogButton,
  PanelSectionRow,
  Focusable,
  showModal,
  ModalRoot,
} from "@decky/ui";
import { useFavorites } from "../hook/useFavorites";
import { ActionButton } from "./ActionButton";
import { useTranslation } from "react-i18next";
import { FiTrash } from "react-icons/fi";

interface ButtonDeleteFavoriteModalProps {
  title: string;
  size?: "small" | "medium" | "large";
}

export const ButtonDeleteFavoriteModal: React.FC<
  ButtonDeleteFavoriteModalProps
> = ({ title, size = "small" }) => {
  const { removeFavorite } = useFavorites();

  const { t } = useTranslation("delete_favorite_modal");

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
            <div>{t("description", { favorite_name: title })}</div>
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
                  removeFavorite(title);
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
