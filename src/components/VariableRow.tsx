import React from "react";
import { useTranslation } from "react-i18next";
import { PanelSectionRow, ToggleField } from "@decky/ui";
import { VariableToggleRow } from "./VariableToggleRow";
import { Variable } from "../data/types";
import { getVariableDefault } from "../utils/variableDefaults";
import { getConflictingEnvs } from "../utils/conflicts";
import { ConflictRule } from "../context/RemoteDataContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { findShadowingCustomVariable } from "../utils/envShadow";

interface VariableRowProps {
  variable: Variable;
  isActive: (env: string) => boolean;
  getValue: (env: string, defaultValue: string) => string;
  onToggle: (env: string, defaultValue: string) => void;
  onValueChange: (env: string, value: string) => void;
  // Forces env inactive without flipping it on — used to cascade a subGroup
  // off when its parent gets turned off.
  onDeactivate: (env: string) => void;
  description?: React.ReactNode;
  // Data-driven "these envs conflict" groups, and env -> title key lookup
  // for naming the other active conflicting variable(s) in the warning.
  conflictGroups?: ConflictRule[];
  envToTitle?: Record<string, string>;
}

const deactivateRecursive = (
  vars: Variable[],
  onDeactivate: (env: string) => void,
) => {
  vars.forEach((v) => {
    onDeactivate(v.env);
    const nested = (v as any).subGroup as Variable[] | undefined;
    if (nested && nested.length) deactivateRecursive(nested, onDeactivate);
  });
};

// Renders one variable's toggle row and, while active, its subGroup —
// turning the parent off force-deactivates the whole subGroup too.
export const VariableRow: React.FC<VariableRowProps> = ({
  variable,
  isActive,
  getValue,
  onToggle,
  onValueChange,
  onDeactivate,
  description,
  conflictGroups,
  envToTitle,
}) => {
  const { t: tVars } = useTranslation("variables");
  const { customVariables } = useCustomVariables();
  const defaultVal = getVariableDefault(variable);
  const active = isActive(variable.env);
  const subGroup = (variable as any).subGroup as Variable[] | undefined;
  const hasSubGroup = Boolean(subGroup && subGroup.length > 0);

  const shadowingVariable = findShadowingCustomVariable(variable.env, customVariables);
  if (shadowingVariable) {
    console.warn(
      `[VariableRow] "${variable.env}" is shadowed by custom variable "${shadowingVariable.name}" — rendering read-only.`,
    );
    return (
      <PanelSectionRow>
        <ToggleField
          label={tVars(variable.title)}
          description={tVars("shadowed_by_custom_variable", { name: shadowingVariable.name })}
          checked={active}
          disabled
          onChange={() => {}}
        />
      </PanelSectionRow>
    );
  }

  const handleToggle = () => {
    onToggle(variable.env, defaultVal);
    if (active && hasSubGroup) {
      deactivateRecursive(subGroup!, onDeactivate);
    }
  };

  // A multi-select enum left active with zero values picked would export as
  // an empty value instead of being unset — deactivating it instead keeps
  // "active" meaning "has a real value" everywhere downstream.
  const handleEmptyMultiSelect = () => {
    onDeactivate(variable.env);
    if (hasSubGroup) {
      deactivateRecursive(subGroup!, onDeactivate);
    }
  };

  // Shows on every currently-active member of a conflict group at once.
  const conflictingEnvs =
    active && conflictGroups && conflictGroups.length > 0
      ? getConflictingEnvs(variable.env, isActive, conflictGroups)
      : [];
  const conflictWarning =
    conflictingEnvs.length > 0 ? (
      <div style={{ color: "#ff5555" }}>
        {tVars("conflict_warning", {
          names: conflictingEnvs
            .map((e) => tVars(envToTitle?.[e] ?? e))
            .join(", "),
        })}
      </div>
    ) : null;
  const combinedDescription =
    description || conflictWarning ? (
      <React.Fragment>
        {description}
        {conflictWarning}
      </React.Fragment>
    ) : undefined;

  return (
    <React.Fragment>
      <VariableToggleRow
        variable={variable}
        isActive={active}
        currentValue={getValue(variable.env, defaultVal)}
        description={combinedDescription}
        onToggle={handleToggle}
        onValueChange={(v) => onValueChange(variable.env, v)}
        onEmptyMultiSelect={handleEmptyMultiSelect}
      />
      {active && hasSubGroup && (
        <div style={{ marginLeft: 16, paddingLeft: 4 }}>
          {subGroup!.map((sub) => (
            <VariableRow
              key={sub.env}
              variable={sub}
              isActive={isActive}
              getValue={getValue}
              onToggle={onToggle}
              onValueChange={onValueChange}
              onDeactivate={onDeactivate}
              conflictGroups={conflictGroups}
              envToTitle={envToTitle}
            />
          ))}
        </div>
      )}
    </React.Fragment>
  );
};
