import React, { useState } from "react";
import {
  DialogButton,
  Focusable,
  showModal,
  TextField,
  ModalRoot,
} from "@decky/ui";
import {
  useCustomVariables,
  CustomVariable,
} from "../context/CustomVariablesContext";
import { useTranslation } from "react-i18next";
import { ActionButton } from "./ActionButton";
import { AppProvider } from "../context/AppProvider";

interface CustomVariableModalContentProps {
  existing?: CustomVariable;
  onClose: () => void;
}

export const CustomVariableModalContent: React.FC<
  CustomVariableModalContentProps
> = ({ existing, onClose }) => {
  const { addCustomVariable, editCustomVariable } = useCustomVariables();
  const { t } = useTranslation("add_custom_variable_modal");
  const { t: tCommon } = useTranslation();
  const [name, setName] = useState(existing?.name ?? "");
  const [env, setEnv] = useState(existing?.env ?? "");
  const [value, setValue] = useState(existing?.value ?? "");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !env.trim() || !value.trim()) {
      setError(t("fields_required"));
      return;
    }
    if (existing) {
      editCustomVariable(existing.id, {
        name: name.trim(),
        env: env.trim(),
        value: value.trim(),
      });
      onClose();
      return;
    }
    const success = addCustomVariable({
      name: name.trim(),
      env: env.trim(),
      value: value.trim(),
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
          label={t("field_env")}
          description="ex: PROTON_MY_VAR"
          value={env}
          onChange={(e) => setEnv(e.target.value)}
        />
        <TextField
          label={t("field_value")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
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

export const ButtonAddCustomVariableModal: React.FC = () => {
  const { t } = useTranslation("add_custom_variable_modal");

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;
    modalResult = showModal(
      <AppProvider>
        <CustomVariableModalContent onClose={() => modalResult?.Close()} />
      </AppProvider>,
    );
  };

  return (
    <ActionButton size="small" onClick={handleOpen} width="100%">
      {t("button_label")}
    </ActionButton>
  );
};
