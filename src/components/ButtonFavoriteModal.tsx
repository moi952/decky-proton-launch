import React, { useState } from "react";
import {
  PanelSectionRow,
  DialogButton,
  TextField,
  showModal,
  ModalRoot,
  Focusable,
} from "@decky/ui";
import { useFavorites } from "../hook/useFavorites";
import { ActionButton } from "./ActionButton";
import { useTranslation } from "react-i18next";
import { FiStar } from "react-icons/fi";

interface ButtonFavoriteModalProps {
  command: string;
  variableName?: string;
  size?: "small" | "medium" | "large";
}

export const ButtonFavoriteModal: React.FC<ButtonFavoriteModalProps> = ({
  command,
  variableName = "",
  size = "small",
}) => {
  const { addFavorite, favorites } = useFavorites();
  const { t } = useTranslation("add_favorite_modal");

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal>;

    const ModalContent: React.FC = () => {
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

        addFavorite({ name: name.trim(), value: command });
        modalResult.Close();
      };

      return (
        <ModalRoot>
          <div
            style={{
              padding: "12px 16px",
              minWidth: "350px",
              maxWidth: "90vw",
            }}
          >
            <PanelSectionRow>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {t("add_to_favorite")}
              </div>
            </PanelSectionRow>

            <PanelSectionRow>
              <TextField
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                style={{ width: "100%" }}
              />
            </PanelSectionRow>

            {error && (
              <div
                style={{
                  color: "red",
                  fontSize: 12,
                  marginLeft: 4,
                  marginBottom: 4,
                }}
              >
                {error}
              </div>
            )}

            <PanelSectionRow>
              <Focusable
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
                flow-children="horizontal"
              >
                <DialogButton onClick={() => modalResult.Close()}>
                  {t("cancel")}
                </DialogButton>
                <DialogButton onClick={handleConfirm}>{t("add")}</DialogButton>
              </Focusable>
            </PanelSectionRow>
          </div>
        </ModalRoot>
      );
    };

    modalResult = showModal(<ModalContent />);
  };

  return (
    <ActionButton size={size} onClick={handleOpen}>
      <FiStar />
    </ActionButton>
  );
};
