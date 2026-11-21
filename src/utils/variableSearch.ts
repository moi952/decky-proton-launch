import type { TFunction } from "i18next";
import { Variable } from "../data/types";
import { VariableCategory } from "../context/RemoteDataContext";

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Below this, a search would match nearly everything ("e", "a"): it is
// ignored and the full list stays visible.
export const MIN_SEARCH_LENGTH = 2;

export const isSearching = (query: string): boolean =>
  query.trim().length >= MIN_SEARCH_LENGTH;

export const matchesText = (query: string, ...texts: string[]): boolean => {
  if (!isSearching(query)) return true;
  const q = normalize(query.trim());
  return texts.some((text) => normalize(text).includes(q));
};

// The choices inside a list (or the flags of a compound), by their translated
// label and raw value.
const matchesOptions = (
  variable: Variable,
  query: string,
  tVars: TFunction,
): boolean => {
  if (variable.type === "enum") {
    return variable.values.some((opt) =>
      matchesText(
        query,
        String(tVars(opt.title, opt.titleParams as any)),
        opt.value,
      ),
    );
  }
  if (variable.type === "compound") {
    return variable.flags.some(
      (flag) =>
        matchesText(query, tVars(flag.title), flag.value) ||
        (flag.companion?.kind === "enum" &&
          flag.companion.options.some((opt) =>
            matchesText(query, tVars(opt.title), opt.value),
          )),
    );
  }
  return false;
};

// Matches what the user actually reads (the translated title) as well as the
// env name, and keeps a variable whose own sub-options match.
export const matchesVariable = (
  variable: Variable,
  query: string,
  tVars: TFunction,
): boolean => {
  if (matchesText(query, tVars(variable.title), variable.title, variable.env))
    return true;
  if (matchesOptions(variable, query, tVars)) return true;
  const subGroup = (variable as any).subGroup as Variable[] | undefined;
  return (subGroup ?? []).some((sub) => matchesVariable(sub, query, tVars));
};

// Visible categories only, with their variables narrowed to the search. While
// searching, a category left with nothing is dropped.
export const filterCategories = (
  categories: VariableCategory[],
  isCategoryVisible: (name: string) => boolean,
  query: string,
  tVars: TFunction,
): VariableCategory[] => {
  const searching = isSearching(query);
  const narrow = (vars: Variable[]) =>
    vars.filter((v) => matchesVariable(v, query, tVars));

  return categories
    .filter((cat) => isCategoryVisible(cat.category))
    .map((cat) => ({
      ...cat,
      variables: narrow(cat.variables as Variable[]),
      subCategory:
        cat.subCategory && isCategoryVisible(cat.subCategory.title)
          ? {
              ...cat.subCategory,
              variables: narrow(cat.subCategory.variables as Variable[]),
            }
          : undefined,
    }))
    .filter(
      (cat) =>
        !searching ||
        cat.variables.length > 0 ||
        (cat.subCategory?.variables.length ?? 0) > 0,
    ) as VariableCategory[];
};
