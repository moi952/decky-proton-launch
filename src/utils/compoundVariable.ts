import { CompoundVariable } from "../data/types";

// Tokens in the composed string that don't match any known flag are kept
// verbatim and re-appended on compose, instead of being silently dropped —
// covers a value set before a flag existed in the catalog, or one entered
// through some other path.
export interface ParsedCompound {
  active: Map<string, string>;
  unknownTokens: string[];
}

export const parseCompound = (variable: CompoundVariable, raw: string): ParsedCompound => {
  const known = new Set(variable.flags.map((f) => f.value));
  const active = new Map<string, string>();
  const unknownTokens: string[] = [];

  for (const token of raw
    .split(variable.separator)
    .map((t) => t.trim())
    .filter(Boolean)) {
    const eq = token.indexOf("=");
    const key = eq === -1 ? token : token.slice(0, eq);
    if (!known.has(key)) {
      unknownTokens.push(token);
      continue;
    }
    active.set(key, eq === -1 ? "" : token.slice(eq + 1));
  }

  return { active, unknownTokens };
};

export const composeCompound = (
  variable: CompoundVariable,
  active: Map<string, string>,
  unknownTokens: string[],
): string => {
  const parts = variable.flags
    .filter((f) => active.has(f.value))
    .map((f) => (f.companion ? `${f.value}=${active.get(f.value) ?? ""}` : f.value));
  return [...parts, ...unknownTokens].join(variable.separator);
};
