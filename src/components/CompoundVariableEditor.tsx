import React from "react";
import { PanelSectionRow, ToggleField } from "@decky/ui";
import { FieldTextInput } from "@moi952/decky-ui-kit";
import { CompoundVariable } from "../data/types";
import { ThemedDropdown } from "./ThemedDropdown";
import { composeCompound, parseCompound } from "../utils/compoundVariable";

interface CompoundVariableEditorProps {
  variable: CompoundVariable;
  value: string;
  onChange: (value: string) => void;
}

// Renders one row per flag instead of a dropdown — a flag can reveal its
// own companion input once checked, which a dropdown's popup list can't
// host inline.
export const CompoundVariableEditor: React.FC<CompoundVariableEditorProps> = ({
  variable,
  value,
  onChange,
}) => {
  const { active, unknownTokens } = parseCompound(variable, value);

  const setFlag = (flagValue: string, companionValue: string | null) => {
    const next = new Map(active);
    if (companionValue === null) {
      next.delete(flagValue);
    } else {
      next.set(flagValue, companionValue);
    }
    onChange(composeCompound(variable, next, unknownTokens));
  };

  return (
    <>
      {variable.flags.map((flag) => {
        const checked = active.has(flag.value);
        const companionValue = active.get(flag.value) ?? flag.companion?.defaultValue ?? "";
        return (
          <React.Fragment key={flag.value}>
            <PanelSectionRow>
              <ToggleField
                label={flag.title}
                checked={checked}
                onChange={(next) => setFlag(flag.value, next ? companionValue : null)}
              />
            </PanelSectionRow>
            {checked && flag.companion && (
              <PanelSectionRow>
                {flag.companion.kind === "enum" ? (
                  <ThemedDropdown
                    size="small"
                    options={flag.companion.options.map((o) => ({ value: o.value, label: o.title }))}
                    selectedValue={companionValue}
                    onChange={(v) => setFlag(flag.value, v)}
                  />
                ) : (
                  <FieldTextInput
                    size="small"
                    mustBeNumeric={flag.companion.kind === "number"}
                    value={companionValue}
                    onChange={(v) => setFlag(flag.value, v)}
                  />
                )}
              </PanelSectionRow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
