import React, { useState } from "react";
import {
  DialogButton,
  Focusable,
  showModal,
  TextField,
  ModalRoot,
} from "@decky/ui";
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useTranslation } from "react-i18next";
import { ActionButton } from "./ActionButton";

export const ButtonAddCustomWrapperModal: React.FC = () => {
  const { addCustomWrapper } = useCustomWrappers();
  const { t } = useTranslation("add_custom_wrapper_modal");
  const { t: tCommon } = useTranslation();

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;

    const ModalContent = () => {
      const [name, setName] = useState("");
      const [execPath, setExecPath] = useState("");
      const [error, setError] = useState("");

      const handleSubmit = () => {
        if (!name.trim() || !execPath.trim()) {
          setError(t("fields_required"));
          return;
        }
        const success = addCustomWrapper({
          name: name.trim(),
          exec: execPath.trim(),
        });
        if (!success) {
          setError(t("already_exists"));
          return;
        }
        modalResult?.Close();
      };

      return (
        <ModalRoot>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontWeight: 600 }}>{t("title")}</div>
            <TextField
              label={t("field_name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label={t("field_exec")}
              description="ex: ~/my-wrapper"
              value={execPath}
              onChange={(e) => setExecPath(e.target.value)}
            />
            {error && (
              <span style={{ color: "#ff4444", fontSize: 12 }}>{error}</span>
            )}
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
              <DialogButton onClick={handleSubmit}>
                {tCommon("create")}
              </DialogButton>
            </Focusable>
          </div>
        </ModalRoot>
      );
    };

    modalResult = showModal(<ModalContent />);
  };

  return (
    <ActionButton size="small" onClick={handleOpen} width="100%">
      {t("button_label")}
    </ActionButton>
  );
};
