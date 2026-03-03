import React, { useState } from "react";
import {
  DialogButton,
  PanelSectionRow,
  Focusable,
  showModal,
  ModalRoot,
  TextField,
} from "@decky/ui";
import { useCustomVariables } from "../hook/useCustomVariables";
import { useTranslation } from "react-i18next";
import { ActionButton } from "./ActionButton";

export const AddCustomVariableModal: React.FC = () => {
  const { addCustomVariable } = useCustomVariables();
  const { t } = useTranslation("add_custom_variable_modal");

  const handleOpen = () => {
    let modalResult: ReturnType<typeof showModal> | null = null;

    const ModalContent = () => {
      const [name, setName] = useState("");
      const [env, setEnv] = useState("");
      const [value, setValue] = useState("");
      const [error, setError] = useState("");

      const handleSubmit = () => {
        if (!name.trim() || !env.trim() || !value.trim()) {
          setError(t("fields_required"));
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
        modalResult?.Close();
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
                {t("title")}
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <TextField
                label={t("field_name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <TextField
                label={t("field_env")}
                description="ex: PROTON_MY_VAR"
                value={env}
                onChange={(e) => setEnv(e.target.value)}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <TextField
                label={t("field_value")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </PanelSectionRow>
            {error && (
              <PanelSectionRow>
                <span style={{ color: "#ff4444", fontSize: 12 }}>{error}</span>
              </PanelSectionRow>
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
                <DialogButton onClick={() => modalResult?.Close()}>
                  {t("cancel")}
                </DialogButton>
                <DialogButton onClick={handleSubmit}>
                  {t("confirm")}
                </DialogButton>
              </Focusable>
            </PanelSectionRow>
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
