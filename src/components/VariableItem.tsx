import React, { useState } from "react";
import { PanelSectionRow, DialogButton, Focusable } from "@decky/ui";
import { RiArrowDownSFill, RiArrowUpSFill } from "react-icons/ri";
import { copy } from "../utils/functions";
import { ActionButton } from "./ActionButton";
import { ButtonFavoriteModal } from "./ButtonFavoriteModal";
import { ButtonDeleteFavoriteModal } from "./ButtonDeleteFavoriteModal";
import { useTranslation } from "react-i18next";
import { FiPlus, FiCopy } from "react-icons/fi";

interface VariableItemProps {
  title: string;
  env: string;
  value: string;
  onAdd: (line: string) => void;
  isFavorite?: boolean;
}

export const VariableItem: React.FC<VariableItemProps> = ({
  title,
  env,
  value,
  onAdd,
  isFavorite,
}) => {
  const [expanded, setExpanded] = useState(false);
  const line = `${env}=${value}`;

  const { t } = useTranslation();

  return (
    <>
      {/* Collapse header */}
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
            {/* Expanded command below the buttons */}
            <div style={{ fontFamily: "monospace", color: "#eee" }}>{line}</div>

            {/* Buttons just below the collapse */}
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

              {isFavorite ? (
                <ButtonDeleteFavoriteModal title={title} />
              ) : (
                <ButtonFavoriteModal
                  variableName={title}
                  command={line}
                  size="small"
                />
              )}
            </Focusable>
          </PanelSectionRow>
        )}
      </PanelSectionRow>
    </>
  );
};
