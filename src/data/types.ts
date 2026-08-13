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
}

export interface EnumVariable {
  title: string;
  env: string;
  type: "enum";
  defaultValue: string;
  values: { title: string; value: string }[];
}

export interface SimpleVariable {
  title: string;
  env: string;
  value: string;
  type?: never;
}

// A wrapper chain target (e.g. lsfg, fgmod) — data-driven, see
// wrappers_exec in decky-proton-launch-data. Renders as a plain toggle,
// same as a "simple" bool; `exec` is only read by the backend to generate
// install_script()'s chaining logic.
export interface ExecVariable {
  title: string;
  env: string;
  type: "exec";
  exec: string;
}

export type Variable = BoolVariable | EnumVariable | SimpleVariable | ExecVariable;
