import React, { useState } from "react";
import { PanelSectionRow, DialogButton, Focusable } from "@decky/ui";
import { RiArrowDownSFill, RiArrowUpSFill } from "react-icons/ri";
import { ActionButton } from "@moi952/decky-ui-kit";
import { ThemedDropdown } from "./ThemedDropdown";
import { InlineConfirm } from "./InlineConfirm";
import { ButtonFavoriteModal } from "./ButtonFavoriteModal";
import { ButtonDeleteCustomVariableModal } from "./ButtonDeleteCustomVariableModal";
import { useTranslation } from "react-i18next";
import { FiPlus, FiCopy, FiStar, FiSliders, FiTrash } from "react-icons/fi";
import { Variable } from "../data/types";
import { useVariableActions } from "../hook/useVariableActions";
import { useFavorites } from "../context/FavoritesContext";
import {
  openFavoriteModal,
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
  const [pendingDelete, setPendingDelete] = useState(false);
  const { t } = useTranslation();
  const { t: tVariables } = useTranslation("variables");
  const { t: tButtons } = useTranslation("buttons");
  const { t: tFavModal } = useTranslation("delete_favorite_modal");
  const { removeFavorite } = useFavorites();

  const getInitialValue = () => {
    if (variable?.type === "enum") return variable.defaultValue;
    if (variable?.type === "bool") return variable.value;
    if (variable?.type === "exec") return "1";
    return valueProp ?? "";
  };

  const [selectedValue, setSelectedValue] = useState(getInitialValue);

  const { line, copyLine, copyWithCmd, addToStack } = useVariableActions({
    env,
    selectedValue,
  });

  const handleFavoriteModal = () => {
    if (isFavorite) {
      setPendingDelete(true);
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
      if (variable.simple) return null;
      return (
        <Focusable
          style={{ display: "flex", gap: "6px" }}
          flow-children="horizontal"
        >
          {(["1", "0"] as const).map((v) => (
            <ActionButton
              key={v}
              size="small"
              onClick={() => setSelectedValue(v)}
            >
              {tVariables(v === "1" ? "enable_prefix" : "disable_prefix")}
            </ActionButton>
          ))}
        </Focusable>
      );
    }

    if (variable.type === "enum") {
      return (
        <ThemedDropdown
          variant="boxed"
          size="small"
          multiple={variable.multiSelect !== false}
          maxDisplayLines={variable.multiSelect !== false ? 2 : 1}
          options={variable.values.map((opt) => ({
            value: opt.value,
            label: tVariables(opt.title, opt.titleParams),
          }))}
          selectedValue={selectedValue}
          onChange={setSelectedValue}
        />
      );
    }

    return null;
  };

  const renderActionButton = () => {
    if (isFavorite)
      return (
        <ActionButton size="small" variant="danger" onClick={() => setPendingDelete(true)}>
          <FiTrash />
        </ActionButton>
      );
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
          display: "flex",
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
        <span style={{ flex: 1, minWidth: 0, whiteSpace: "normal", wordBreak: "break-word" }}>
          {title}
        </span>
        {expanded ? (
          <RiArrowUpSFill size={16} style={{ flexShrink: 0 }} />
        ) : (
          <RiArrowDownSFill size={16} style={{ flexShrink: 0 }} />
        )}
      </DialogButton>

      {pendingDelete && (
        <PanelSectionRow>
          <InlineConfirm
            description={tFavModal("description", { favorite_name: title })}
            size="small"
            onCancel={() => setPendingDelete(false)}
            onConfirm={() => {
              removeFavorite(title);
              setPendingDelete(false);
            }}
          />
        </PanelSectionRow>
      )}

      {expanded && !pendingDelete && (
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
              style={{
                fontFamily: "monospace",
                color: "#aaa",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
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
