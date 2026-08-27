import React from "react";
import { Focusable, PanelSectionRow, ToggleField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { ValButton } from "./ValButton";
import { ThemedDropdown } from "./ThemedDropdown";
import { Variable } from "../data/types";

interface VariableToggleRowProps {
  variable: Variable;
  isActive: boolean;
  currentValue: string;
  description?: React.ReactNode;
  onToggle: () => void;
  onValueChange: (value: string) => void;
  onEmptyMultiSelect?: () => void;
}

export const VariableToggleRow: React.FC<VariableToggleRowProps> = ({
  variable,
  isActive,
  currentValue,
  description,
  onToggle,
  onValueChange,
  onEmptyMultiSelect,
}) => {
  const { t: tVars } = useTranslation("variables");

  if (variable.type === "enum" && "values" in variable) {
    return (
      <React.Fragment>
        <PanelSectionRow>
          <ToggleField
            label={tVars(variable.title)}
            description={description}
            checked={isActive}
            onChange={onToggle}
          />
        </PanelSectionRow>
        {isActive && (
          <PanelSectionRow>
            <ThemedDropdown
              variant="boxed"
              size="small"
              multiple={variable.multiSelect !== false}
              maxDisplayLines={variable.multiSelect !== false ? 2 : 1}
              options={variable.values.map((opt) => ({
                value: opt.value,
                label: tVars(opt.title, opt.titleParams),
              }))}
              selectedValue={currentValue}
              onChange={(v) => {
                if (variable.multiSelect !== false && v.trim() === "" && onEmptyMultiSelect) {
                  onEmptyMultiSelect();
                } else {
                  onValueChange(v);
                }
              }}
            />
          </PanelSectionRow>
        )}
      </React.Fragment>
    );
  }

  const isSimple =
    variable.type === "exec" ||
    (variable as any).simple === true ||
    Boolean((variable as any).subGroup?.length);
  const label = isSimple
    ? tVars(variable.title)
    : `${tVars(currentValue === "1" ? "enable_prefix" : "disable_prefix")} ${tVars(variable.title)}`;

  return (
    <React.Fragment>
      <PanelSectionRow>
        <ToggleField
          label={label}
          description={description}
          checked={isActive}
          onChange={onToggle}
        />
      </PanelSectionRow>
      {isActive && !isSimple && (
        <Focusable
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "8px",
            marginTop: "8px",
          }}
          flow-children="horizontal"
        >
          {(["0", "1"] as const).map((v) => (
            <ValButton
              key={v}
              selected={currentValue === v}
              onClick={() => onValueChange(v)}
            >
              {tVars(v === "0" ? "disable_prefix" : "enable_prefix")}
            </ValButton>
          ))}
        </Focusable>
      )}
    </React.Fragment>
  );
};
