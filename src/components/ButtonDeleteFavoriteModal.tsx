import React from "react";
import { DialogButton, Focusable, ModalRoot } from "@decky/ui";
import { useFavorites } from "../context/FavoritesContext";
import { ActionButton } from "./ActionButton";
import { useTranslation } from "react-i18next";
import { FiTrash } from "react-icons/fi";
import { openDeleteFavoriteModal } from "../utils/modals";

interface DeleteFavoriteModalContentProps {
  title: string;
  onClose: () => void;
}

export const DeleteFavoriteModalContent: React.FC<
  DeleteFavoriteModalContentProps
> = ({ title, onClose }) => {
  const { removeFavorite } = useFavorites();
  const { t } = useTranslation("delete_favorite_modal");
  const { t: tCommon } = useTranslation();

  return (
    <ModalRoot>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 600 }}>{t("title")}</div>
        <div>{t("description", { favorite_name: title })}</div>
        <Focusable
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          flow-children="horizontal"
        >
          <DialogButton onClick={onClose}>{tCommon("cancel")}</DialogButton>
          <DialogButton
            onClick={() => {
              removeFavorite(title);
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

interface ButtonDeleteFavoriteModalProps {
  title: string;
  size?: "small" | "medium" | "large";
}

export const ButtonDeleteFavoriteModal: React.FC<
  ButtonDeleteFavoriteModalProps
> = ({ title, size = "small" }) => (
  <ActionButton
    size={size}
    onClick={() => openDeleteFavoriteModal(title)}
    variant="danger"
  >
    <FiTrash />
  </ActionButton>
);
