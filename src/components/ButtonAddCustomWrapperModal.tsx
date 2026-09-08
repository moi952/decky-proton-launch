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

export interface CustomWrapperModalContext {
  addCustomWrapper: (wrapper: Omit<CustomWrapper, "id" | "env">) => boolean;
  editCustomWrapper: (
    id: string,
    updated: Omit<CustomWrapper, "id" | "env">,
  ) => void;
}

interface CustomWrapperModalContentProps extends CustomWrapperModalContext {
  existing?: CustomWrapper;
  onClose: () => void;
}

// Same reasoning as CustomVariableModalContent: showModal() renders this
// outside the main <AppProvider> tree, so it takes its mutators as props
// (sourced from the one real CustomWrappersProvider instance) instead of
// calling useCustomWrappers() itself, which would hit a separate, throwaway
// instance and silently persist to disk without the visible list updating.
export const CustomWrapperModalContent: React.FC<
  CustomWrapperModalContentProps
> = ({ existing, onClose, addCustomWrapper, editCustomWrapper }) => {
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
  const { addCustomWrapper, editCustomWrapper } = useCustomWrappers();

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;
    modalResult = showModal(
      <CustomWrapperModalContent
        addCustomWrapper={addCustomWrapper}
        editCustomWrapper={editCustomWrapper}
        onClose={() => modalResult?.Close()}
      />,
    );
  };

  return (
    <ActionButton size="small" onClick={handleOpen} width="100%">
      {t("button_label")}
    </ActionButton>
  );
};
