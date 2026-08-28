import { CustomVariable } from "../context/CustomVariablesContext";

// `draft` is keyed only by env name, not by which row wrote it — two rows
// sharing an env aren't independent state that could clobber each other,
// they're the same slot. A catalog row is shadowed (read-only, single
// source of truth becomes the custom row) whenever a custom variable
// already claims its env.
export const findShadowingCustomVariable = (
  env: string,
  customVariables: CustomVariable[],
): CustomVariable | null => customVariables.find((v) => v.env === env) ?? null;
