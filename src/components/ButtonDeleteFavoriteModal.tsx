import React from "react";
import { useFavorites } from "../context/FavoritesContext";
import { ActionButton } from "@moi952/decky-ui-kit";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
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
  const { t: tCommon } = useTranslation("common");

  return (
    <ConfirmDeleteModal
      title={t("title")}
      description={t("description", { favorite_name: title })}
      confirmLabel={tCommon("delete")}
      onConfirm={() => removeFavorite(title)}
      onClose={onClose}
    />
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
