import React from "react";
import { Focusable, PanelSectionRow, ToggleField } from "@decky/ui";
import { FieldTextInput } from "@moi952/decky-ui-kit";
import { useTranslation } from "react-i18next";
import { ValButton } from "./ValButton";
import { ThemedDropdown } from "./ThemedDropdown";
import { CompoundVariableEditor } from "./CompoundVariableEditor";
import { Variable } from "../data/types";
import { prettifyToken } from "../utils/prettify";
import { useSettings } from "../context/SettingsContext";

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
  // Raw config tokens (title === value, e.g. VKD3D_CONFIG's flags) have no
  // real translation — only a toggle between the literal token and an
  // auto-formatted version, never a translated one. It's a UI display
  // preference, persisted like any other UI setting — never written into
  // the env/draft state used to build the launch command.
  const { showRawTechnicalValues: showRawValues, setShowRawTechnicalValues: setShowRawValues } = useSettings();

  if (variable.type === "enum" && "values" in variable) {
    const isTechnical = variable.values.every((opt) => opt.title === opt.value);
    const isMulti = variable.multiSelect !== false;
    const options = variable.values
      .map((opt) => ({
        value: opt.value,
        label:
          isTechnical && !showRawValues
            ? prettifyToken(opt.value)
            : tVars(opt.title, opt.titleParams),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

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
              multiple={isMulti}
              selectedCountLabel={isMulti ? (n) => tVars("n_enabled", { count: n }) : undefined}
              onOptionsButton={isTechnical ? () => setShowRawValues(!showRawValues) : undefined}
              onOptionsActionDescription={
                isTechnical ? tVars(showRawValues ? "y_show_formatted" : "y_show_raw") : undefined
              }
              maxDisplayLines={variable.showAllSelected ? 0 : isMulti ? 2 : 1}
              selectedValuesLayout={variable.selectedValuesLayout}
              maxVisibleOptions={variable.maxVisibleOptions}
              options={options}
              selectedValue={currentValue}
              onChange={(v) => {
                if (isMulti && v.trim() === "" && onEmptyMultiSelect) {
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

  if (variable.type === "compound") {
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
        {isActive && <CompoundVariableEditor variable={variable} value={currentValue} onChange={onValueChange} />}
      </React.Fragment>
    );
  }

  if (variable.type === "value") {
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
            <FieldTextInput
              size="small"
              mustBeNumeric={variable.valueKind === "number"}
              value={currentValue}
              onChange={onValueChange}
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
