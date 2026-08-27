import { Variable } from "../data/types";
import { VariableCategory } from "../context/RemoteDataContext";

const flattenVariable = (v: Variable): Variable[] => {
  const subGroup = (v as any).subGroup as Variable[] | undefined;
  return [v, ...(subGroup ?? []).flatMap(flattenVariable)];
};

// Flattens every variable reachable from the catalog — including
// subCategory's own list and each variable's subGroup — so a lookup like
// "find the catalog entry for this favorited env" still works for nested
// entries, not just top-level ones.
export const flattenAllVariables = (categories: VariableCategory[]): Variable[] =>
  categories.flatMap((cat) => {
    const main = (cat.variables as Variable[]).flatMap(flattenVariable);
    const sub = cat.subCategory
      ? (cat.subCategory.variables as Variable[]).flatMap(flattenVariable)
      : [];
    return [...main, ...sub];
  });

// Category + subCategory variables only — deliberately NOT descending into
// subGroup. Used for the Active section summary: a subGroup entry is only
// meaningful alongside its parent (already shown wherever the parent is
// rendered), so listing it again on its own up top would just duplicate it.
export const getTopLevelVariables = (categories: VariableCategory[]): Variable[] =>
  categories.flatMap((cat) => {
    const main = cat.variables as Variable[];
    const sub = cat.subCategory ? (cat.subCategory.variables as Variable[]) : [];
    return [...main, ...sub];
  });

export const getVariableDefault = (variable: Variable): string => {
  if (variable.type === "enum" && "values" in variable) {
    return (
      ("defaultValue" in variable && (variable as any).defaultValue) ||
      variable.values?.[0]?.value ||
      "1"
    );
  }
  return (variable as any).value ?? "1";
};
