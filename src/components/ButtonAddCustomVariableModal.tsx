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
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useRemoteData } from "../context/RemoteDataContext";
import { useTranslation } from "react-i18next";
import { ActionButton } from "./ActionButton";
import { AppProvider } from "../context/AppProvider";
import { Variable } from "../data/types";

interface CustomVariableModalContentProps {
  existing?: CustomVariable;
  onClose: () => void;
}

export const CustomVariableModalContent: React.FC<
  CustomVariableModalContentProps
> = ({ existing, onClose }) => {
  const { customVariables, addCustomVariable, editCustomVariable } =
    useCustomVariables();
  const { customWrappers } = useCustomWrappers();
  const { variables: variablesData } = useRemoteData();
  const { t } = useTranslation("add_custom_variable_modal");
  const { t: tCommon } = useTranslation();
  const [name, setName] = useState(existing?.name ?? "");
  const [env, setEnv] = useState(existing?.env ?? "");
  const [value, setValue] = useState(existing?.value ?? "");
  const [error, setError] = useState("");

  // env doubles as the runtime identity of a toggle. Two custom entries (or
  // a custom one and a custom wrapper) sharing one would mean deleting
  // either affects both with no obvious "who owns this" — still blocked.
  // A catalog variable is different: VariableRow renders it read-only
  // whenever a custom variable claims its env (see envShadow.ts), so the
  // custom one just becomes the one real editable source — allowed.
  const isEnvTaken = (candidate: string): boolean => {
    const otherCustomVariableEnvs = customVariables
      .filter((v) => v.id !== existing?.id)
      .map((v) => v.env);
    const customWrapperEnvs = customWrappers.map((w) => w.env);
    return [...otherCustomVariableEnvs, ...customWrapperEnvs].includes(candidate);
  };

  const catalogEnvs = variablesData.flatMap((cat) =>
    (cat.variables as Variable[]).map((v) => v.env),
  );
  const shadowsCatalogVariable = catalogEnvs.includes(env.trim());

  const handleSubmit = () => {
    if (!name.trim() || !env.trim() || !value.trim()) {
      setError(t("fields_required"));
      return;
    }
    if (isEnvTaken(env.trim())) {
      setError(t("env_already_used"));
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
        {!error && shadowsCatalogVariable && (
          <span style={{ color: "#aaa", fontSize: 12 }}>
            {t("shadows_catalog_hint")}
          </span>
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
