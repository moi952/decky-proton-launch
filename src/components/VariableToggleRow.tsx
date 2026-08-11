import React from "react";
import { Focusable, PanelSectionRow, ToggleField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { ValButton } from "./ValButton";
import { Variable } from "../data/types";

interface VariableToggleRowProps {
  variable: Variable;
  isActive: boolean;
  currentValue: string;
  description?: React.ReactNode;
  onToggle: () => void;
  onValueChange: (value: string) => void;
}

const splitValues = (value: string): string[] =>
  value.split(",").map((v) => v.trim()).filter(Boolean);

export const VariableToggleRow: React.FC<VariableToggleRowProps> = ({
  variable,
  isActive,
  currentValue,
  description,
  onToggle,
  onValueChange,
}) => {
  const { t: tVars } = useTranslation("variables");

  if (variable.type === "enum" && "values" in variable) {
    const selected = splitValues(currentValue);

    // Many of these flags (DXVK_HUD, MANGOHUD_CONFIG, RADV_PERFTEST...) are
    // combinable — the env var takes a comma-separated list, not one pick.
    const toggleOption = (optValue: string) => {
      const next = selected.includes(optValue)
        ? selected.filter((v) => v !== optValue)
        : [...selected, optValue];
      const ordered = variable.values
        .filter((o) => next.includes(o.value))
        .map((o) => o.value);
      onValueChange(ordered.join(","));
    };

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
          <Focusable
            style={{
              display: "flex",
              gap: "4px",
              flexWrap: "wrap",
              marginBottom: "8px",
              marginTop: "8px",
            }}
            flow-children="horizontal"
          >
            {variable.values.map((opt) => (
              <ValButton
                key={opt.value}
                selected={selected.includes(opt.value)}
                onClick={() => toggleOption(opt.value)}
              >
                {tVars(opt.title)}
              </ValButton>
            ))}
          </Focusable>
        )}
      </React.Fragment>
    );
  }

  const isSimple = (variable as any).simple === true;
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
