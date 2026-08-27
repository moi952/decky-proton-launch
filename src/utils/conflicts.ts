import { ConflictRule } from "../context/RemoteDataContext";

// A rule is a star, not a clique: "trigger" conflicts with each env in
// "conflicts" individually — the envs inside "conflicts" are NOT considered
// in conflict with each other, only each one with "trigger". Returns the
// other currently-active env(s) that `env` conflicts with (empty if none).
export const getConflictingEnvs = (
  env: string,
  isActive: (env: string) => boolean,
  rules: ConflictRule[],
): string[] => {
  const others = new Set<string>();
  for (const rule of rules) {
    if (rule.trigger === env) {
      for (const spoke of rule.conflicts) {
        if (isActive(spoke)) others.add(spoke);
      }
    } else if (rule.conflicts.includes(env)) {
      if (isActive(rule.trigger)) others.add(rule.trigger);
    }
  }
  return [...others];
};
