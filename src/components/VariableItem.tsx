import React, { useState } from "react";
import { PanelSectionRow, DialogButton, Focusable } from "@decky/ui";
import { RiArrowDownSFill, RiArrowUpSFill } from "react-icons/ri";
import { ActionButton } from "./ActionButton";
import { ButtonFavoriteModal } from "./ButtonFavoriteModal";
import { ButtonDeleteFavoriteModal } from "./ButtonDeleteFavoriteModal";
import { ButtonDeleteCustomVariableModal } from "./ButtonDeleteCustomVariableModal";
import { useTranslation } from "react-i18next";
import { FiPlus, FiCopy, FiStar, FiSliders } from "react-icons/fi";
import { Variable } from "../data/types";
import { useVariableActions } from "../hook/useVariableActions";
import {
  openFavoriteModal,
  openDeleteFavoriteModal,
  openDeleteCustomVariableModal,
} from "../utils/modals";
import GamepadLabel from "./GamepadLabel";

interface VariableItemProps {
  title: string;
  env: string;
  value?: string;
  variable?: Variable;
  isFavorite?: boolean;
  isCustom?: boolean;
  customId?: string;
}

export const VariableItem: React.FC<VariableItemProps> = ({
  title,
  env,
  value: valueProp,
  variable,
  isFavorite,
  isCustom,
  customId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const { t: tVariables } = useTranslation("variables");
  const { t: tButtons } = useTranslation("buttons");

  const getInitialValue = () => {
    if (variable?.type === "enum") return variable.defaultValue;
    if (variable?.type === "bool") return variable.value;
    return valueProp ?? "";
  };

  const [selectedValue, setSelectedValue] = useState(getInitialValue);

  const { line, copyLine, copyWithCmd, addToStack } = useVariableActions({
    env,
    selectedValue,
  });

  const handleFavoriteModal = () => {
    if (isFavorite) {
      openDeleteFavoriteModal(title);
    } else if (isCustom && customId) {
      openDeleteCustomVariableModal(customId, title);
    } else {
      openFavoriteModal({ variableName: title, env, value: selectedValue });
    }
  };

  const getOptionsDescription = () => {
    if (isFavorite)
      return (
        <GamepadLabel
          text={tButtons("remove_from_fav")}
          icon={<FiStar size={12} />}
        />
      );
    if (isCustom)
      return (
        <GamepadLabel
          text={tButtons("remove_from_custom")}
          icon={<FiSliders size={12} />}
        />
      );
    return (
      <GamepadLabel
        text={tButtons("add_to_favori")}
        icon={<FiStar size={12} />}
      />
    );
  };

  const renderValueChips = () => {
    if (!variable?.type) return null;

    if (variable.type === "bool") {
      const options = [
        { title: "enabled", value: "1" },
        { title: "disabled", value: "0" },
      ];
      return (
        <Focusable
          style={{ display: "flex", gap: "6px" }}
          flow-children="horizontal"
        >
          {options.map((opt) => (
            <ActionButton
              key={opt.value}
              size="small"
              onClick={() => setSelectedValue(opt.value)}
            >
              {t(opt.title)}
            </ActionButton>
          ))}
        </Focusable>
      );
    }

    if (variable.type === "enum") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {variable.values.map((opt) => (
            <ActionButton
              key={opt.value}
              size="small"
              width="100%"
              onClick={() => setSelectedValue(opt.value)}
            >
              {tVariables(opt.title)}
            </ActionButton>
          ))}
        </div>
      );
    }

    return null;
  };

  const renderActionButton = () => {
    if (isFavorite) return <ButtonDeleteFavoriteModal title={title} />;
    if (isCustom && customId)
      return <ButtonDeleteCustomVariableModal id={customId} name={title} />;
    return (
      <ButtonFavoriteModal
        variableName={title}
        env={env}
        value={selectedValue}
        size="small"
      />
    );
  };

  return (
    <PanelSectionRow>
      <DialogButton
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "inline-flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 13,
          padding: "4px 8px",
        }}
        onOKActionDescription={
          expanded ? tButtons("close") : tButtons("details")
        }
        onSecondaryActionDescription={tButtons("copier_cmd")}
        onSecondaryButton={copyWithCmd}
        onOptionsActionDescription={getOptionsDescription()}
        onOptionsButton={handleFavoriteModal}
        onMenuActionDescription={tButtons("add_to_stack")}
        onMenuButton={addToStack}
      >
        {title}{" "}
        {expanded ? (
          <RiArrowUpSFill size={16} />
        ) : (
          <RiArrowDownSFill size={16} />
        )}
      </DialogButton>

      {expanded && (
        <PanelSectionRow>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "8px",
              padding: "8px",
              marginTop: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {renderValueChips()}
            <div
              style={{ fontFamily: "monospace", color: "#aaa", fontSize: 11 }}
            >
              {line}
            </div>
            <Focusable
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                justifyContent: "flex-end",
              }}
              flow-children="horizontal"
            >
              <ActionButton size="small" onClick={copyLine}>
                <FiCopy />
              </ActionButton>
              <ActionButton size="small" onClick={copyWithCmd}>
                <FiCopy />
                {t("copy_cmd")}
              </ActionButton>
              <ActionButton size="small" onClick={addToStack}>
                <FiPlus />
              </ActionButton>
              {renderActionButton()}
            </Focusable>
          </div>
        </PanelSectionRow>
      )}
    </PanelSectionRow>
  );
};
