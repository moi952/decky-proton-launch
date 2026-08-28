export interface SteamGame {
  appid: number;
  name: string;
  is_shortcut: boolean;
}

export type ScriptStatus = "current" | "outdated" | "missing";

export interface BoolVariable {
  title: string;
  env: string;
  type: "bool";
  value: "0" | "1";
  simple?: boolean;
  // Nested variables shown only while this one is active.
  subGroup?: Variable[];
}

export interface EnumVariable {
  title: string;
  env: string;
  type: "enum";
  defaultValue: string;
  // Comma-joined multi-pick; defaults to true.
  multiSelect?: boolean;
  // titleParams interpolates into the option's i18n title.
  values: { title: string; value: string; titleParams?: Record<string, string | number> }[];
  // Caps visible option rows before the list scrolls.
  maxVisibleOptions?: number;
  // Shows the full selected-values summary, unclamped.
  showAllSelected?: boolean;
  // One selected value per line instead of comma-joined.
  selectedValuesLayout?: "inline" | "stacked";
  subGroup?: Variable[];
}

export interface SimpleVariable {
  title: string;
  env: string;
  value: string;
  type?: never;
  subGroup?: Variable[];
}

// A wrapper chain target, data-driven via wrappers_exec.
export interface ExecVariable {
  title: string;
  env: string;
  type: "exec";
  exec: string;
  subGroup?: Variable[];
}

// A single flag in a compound variable's composed value; value is the raw token.
export interface CompoundFlag {
  title: string;
  value: string;
  // Present: written as "value=<companion>". Omitted: written bare.
  companion?:
    | { kind: "text" | "number"; defaultValue?: string }
    | { kind: "enum"; options: { title: string; value: string }[]; defaultValue?: string };
}

// Active flags joined into one composed env value (e.g. DXVK_CONFIG).
export interface CompoundVariable {
  title: string;
  env: string;
  type: "compound";
  separator: string;
  flags: CompoundFlag[];
  subGroup?: Variable[];
}

// Free-typed value, not picked from a fixed list.
export interface FreeValueVariable {
  title: string;
  env: string;
  type: "value";
  valueKind?: "text" | "number";
  defaultValue: string;
  subGroup?: Variable[];
}

export type Variable =
  | BoolVariable
  | EnumVariable
  | SimpleVariable
  | ExecVariable
  | CompoundVariable
  | FreeValueVariable;

// A category's own secondary group, rendered as its own section after the main list.
export interface SubCategory {
  title: string;
  description?: string;
  variables: Variable[];
}
