import React from "react";
import { DialogButton, Focusable, showModal, ModalRoot } from "@decky/ui";
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
  const { t: tCommon } = useTranslation();

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;

    const ModalContent = () => (
      <ModalRoot>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontWeight: 600 }}>{t("title")}</div>

          <div>{t("description", { favorite_name: title })}</div>

          <Focusable
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
            flow-children="horizontal"
          >
            <DialogButton onClick={() => modalResult?.Close()}>
              {tCommon("cancel")}
            </DialogButton>
            <DialogButton
              onClick={() => {
                removeFavorite(title);
                modalResult?.Close();
              }}
            >
              {tCommon("delete")}
            </DialogButton>
          </Focusable>
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
