import React, { useState } from "react";
import { PanelSectionRow, DialogButton, Focusable } from "@decky/ui";
import { RiArrowDownSFill, RiArrowUpSFill } from "react-icons/ri";
import { copy } from "../utils/functions";
import { ActionButton } from "./ActionButton";
import { ButtonFavoriteModal } from "./ButtonFavoriteModal";
import { ButtonDeleteFavoriteModal } from "./ButtonDeleteFavoriteModal";
import { useTranslation } from "react-i18next";
import { FiPlus, FiCopy } from "react-icons/fi";
import { ButtonDeleteCustomVariableModal } from "./ButtonDeleteCustomVariableModal";

interface VariableItemProps {
  title: string;
  env: string;
  value: string;
  onAdd: (line: string) => void;
  isFavorite?: boolean;
  isCustom?: boolean;
  customId?: string;
}

export const VariableItem: React.FC<VariableItemProps> = ({
  title,
  env,
  value,
  onAdd,
  isFavorite,
  isCustom,
  customId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const line = env === "" ? value : `${env}=${value}`;
  const { t } = useTranslation();

  const renderActionButton = () => {
    if (isFavorite) return <ButtonDeleteFavoriteModal title={title} />;
    if (isCustom && customId)
      return <ButtonDeleteCustomVariableModal id={customId} name={title} />;
    return (
      <ButtonFavoriteModal
        variableName={title}
        env={env}
        value={value}
        size="small"
      />
    );
  };

  return (
    <>
      <PanelSectionRow>
        <DialogButton
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "inline-flex",
            width: "100%",
            justifyContent: "space-between",
            fontSize: 13,
            padding: "4px 8px",
          }}
        >
          {title} {expanded ? <RiArrowUpSFill /> : <RiArrowDownSFill />}
        </DialogButton>

        {expanded && (
          <PanelSectionRow>
            <div style={{ fontFamily: "monospace", color: "#eee" }}>{line}</div>
            <Focusable
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
              flow-children="horizontal"
            >
              <ActionButton size="small" onClick={() => copy(line)}>
                <FiCopy />
              </ActionButton>
              <ActionButton
                size="small"
                onClick={() => copy(`${line} %command%`)}
              >
                <FiCopy />
                {t("copy_cmd")}
              </ActionButton>
              <ActionButton size="small" onClick={() => onAdd(line)}>
                <FiPlus />
              </ActionButton>
              {renderActionButton()}
            </Focusable>
          </PanelSectionRow>
        )}
      </PanelSectionRow>
    </>
  );
};
