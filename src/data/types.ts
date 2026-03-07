export interface BoolVariable {
  title: string;
  env: string;
  type: "bool";
  value: "0" | "1";
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

export type Variable = BoolVariable | EnumVariable | SimpleVariable;
