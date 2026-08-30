import React, { useState } from "react";
import {
  DialogButton,
  Focusable,
  showModal,
  TextField,
  ModalRoot,
} from "@decky/ui";
import {
  useCustomWrappers,
  CustomWrapper,
} from "../context/CustomWrappersContext";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@moi952/decky-ui-kit";
import { AppProvider } from "../context/AppProvider";

interface CustomWrapperModalContentProps {
  existing?: CustomWrapper;
  onClose: () => void;
}

export const CustomWrapperModalContent: React.FC<
  CustomWrapperModalContentProps
> = ({ existing, onClose }) => {
  const { addCustomWrapper, editCustomWrapper } = useCustomWrappers();
  const { t } = useTranslation("add_custom_wrapper_modal");
  const { t: tCommon } = useTranslation();
  const [name, setName] = useState(existing?.name ?? "");
  const [execPath, setExecPath] = useState(existing?.exec ?? "");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !execPath.trim()) {
      setError(t("fields_required"));
      return;
    }
    if (existing) {
      editCustomWrapper(existing.id, {
        name: name.trim(),
        exec: execPath.trim(),
      });
      onClose();
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
    onClose();
  };

  return (
    <ModalRoot>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 600 }}>
          {existing ? t("edit_title") : t("title")}
        </div>
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
          <DialogButton onClick={onClose}>{tCommon("cancel")}</DialogButton>
          <DialogButton onClick={handleSubmit}>
            {existing ? tCommon("save") : tCommon("create")}
          </DialogButton>
        </Focusable>
      </div>
    </ModalRoot>
  );
};

export const ButtonAddCustomWrapperModal: React.FC = () => {
  const { t } = useTranslation("add_custom_wrapper_modal");

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;
    modalResult = showModal(
      <AppProvider>
        <CustomWrapperModalContent onClose={() => modalResult?.Close()} />
      </AppProvider>,
    );
  };

  return (
    <ActionButton size="small" onClick={handleOpen} width="100%">
      {t("button_label")}
    </ActionButton>
  );
};
