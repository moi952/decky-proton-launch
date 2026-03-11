import React, { useState } from "react";
import {
  DialogButton,
  TextField,
  showModal,
  ModalRoot,
  Focusable,
} from "@decky/ui";
import { useFavorites } from "../context/FavoritesContext";
import { ActionButton } from "./ActionButton";
import { useTranslation } from "react-i18next";
import { FiStar } from "react-icons/fi";

interface FavoriteModalContentProps {
  variableName?: string;
  env?: string;
  value?: string;
  command?: string;
  onClose: () => void;
}

export const FavoriteModalContent: React.FC<FavoriteModalContentProps> = ({
  variableName = "",
  env,
  value,
  command,
  onClose,
}) => {
  const { addFavorite, favorites } = useFavorites();
  const { t } = useTranslation("add_favorite_modal");
  const { t: tCommon } = useTranslation();
  const [name, setName] = useState(variableName);
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!name.trim()) {
      setError(t("name_required"));
      return;
    }
    if (favorites.some((f) => f.name === name.trim())) {
      setError(t("favorite_exists"));
      return;
    }
    if (env && value) {
      addFavorite({ name: name.trim(), env, value });
    } else {
      addFavorite({ name: name.trim(), env: "", value: command ?? "" });
    }
    onClose();
  };

  return (
    <ModalRoot>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 600 }}>{tCommon("add_to_favorite")}</div>
        <TextField
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          style={{ width: "100%" }}
        />
        {error && <div style={{ color: "red", fontSize: 12 }}>{error}</div>}
        <Focusable
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          flow-children="horizontal"
        >
          <DialogButton onClick={onClose}>{tCommon("cancel")}</DialogButton>
          <DialogButton onClick={handleConfirm}>{tCommon("add")}</DialogButton>
        </Focusable>
      </div>
    </ModalRoot>
  );
};

interface ButtonFavoriteModalProps {
  env?: string;
  value?: string;
  command?: string;
  variableName?: string;
  size?: "small" | "medium" | "large";
}

export const ButtonFavoriteModal: React.FC<ButtonFavoriteModalProps> = ({
  env,
  value,
  command,
  variableName = "",
  size = "small",
}) => {
  const handleOpen = () => {
    let modal: ReturnType<typeof showModal> | null = null;
    modal = showModal(
      <FavoriteModalContent
        variableName={variableName}
        env={env}
        value={value}
        command={command}
        onClose={() => modal?.Close()}
      />,
    );
  };

  return (
    <ActionButton size={size} onClick={handleOpen}>
      <FiStar />
    </ActionButton>
  );
};
