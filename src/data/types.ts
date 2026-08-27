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
  // Nested variables shown (and independently toggleable) only while this
  // one is active — e.g. a "use latest DLL" toggle revealing sub-options
  // that only make sense once it's on.
  subGroup?: Variable[];
}

export interface EnumVariable {
  title: string;
  env: string;
  type: "enum";
  defaultValue: string;
  // Whether multiple values can be picked at once, comma-joined into the
  // final env value (e.g. RADV_PERFTEST=aco,gpl). Defaults to true when
  // absent — most of these flags are combinable lists, not exclusive picks.
  multiSelect?: boolean;
  // titleParams is interpolated into the i18n string for that option's
  // title (e.g. "preset_cnn" + {letter: "A"} -> "Preset A (CNN)") — lets
  // one i18n key cover a whole family of near-identical option labels.
  values: { title: string; value: string; titleParams?: Record<string, string | number> }[];
  subGroup?: Variable[];
}

export interface SimpleVariable {
  title: string;
  env: string;
  value: string;
  type?: never;
  subGroup?: Variable[];
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
  subGroup?: Variable[];
}

export type Variable = BoolVariable | EnumVariable | SimpleVariable | ExecVariable;

// A category can nest one secondary group of variables under its own
// title/description — rendered as its own section right after the
// category's main list (e.g. "NVIDIA" -> "NVIDIA (Driver)").
export interface SubCategory {
  title: string;
  description?: string;
  variables: Variable[];
}
