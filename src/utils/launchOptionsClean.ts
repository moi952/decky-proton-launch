import { parseLaunchText } from "./parseLaunchText";

// What the plugin's wrapper looks like inside a game's launch options.
export const WRAPPER_MARK = "~/.config/decky-proton-launch/proton-launch";

// Splits launch options on whitespace, keeping every token exactly as typed
// (quotes and escapes included) so whatever is kept can be put back as it was.
export const splitLaunchOptions = (text: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      current += c;
      if (c === "\\" && quote === '"' && i + 1 < text.length) {
        current += text[++i];
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (c === "\\" && i + 1 < text.length) {
      current += c + text[++i];
      continue;
    }
    if (/\s/.test(c)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += c;
  }
  if (current) tokens.push(current);
  return tokens;
};

export interface CleanupToken {
  text: string;
  removed: boolean;
}

export interface CleanupPlan {
  // The launch options once the removable variables are taken out.
  cleaned: string;
  tokens: CleanupToken[];
  removed: string[];
  // Keys present in the launch options with a value other than the one the
  // plugin applies — left alone.
  different: string[];
  // Keys present in the launch options that the plugin doesn't apply to this
  // game at all — removing them would lose them, so they're left alone.
  notProvided: string[];
}

const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)=/;

// A variable is removed only when the plugin really applies it to the game
// with the very same value (`effective`): that's what makes removing it free.
export const planCleanup = (
  options: string,
  candidates: string[],
  effective: Record<string, string>,
): CleanupPlan => {
  const tokens: CleanupToken[] = splitLaunchOptions(options).map((text) => ({
    text,
    removed: false,
  }));
  const different: string[] = [];
  const notProvided: string[] = [];

  // Without %command% Steam tacks the text on as arguments: none of it is an
  // environment variable. After it, it's the game's own arguments.
  const commandIndex = tokens.findIndex((t) => t.text === "%command%");
  const limit = commandIndex === -1 ? 0 : commandIndex;

  for (let i = 0; i < limit; i++) {
    const match = ASSIGNMENT_RE.exec(tokens[i].text);
    if (!match || !candidates.includes(match[1])) continue;
    const key = match[1];
    const value = parseLaunchText(tokens[i].text).vars[key] ?? "";
    if (!(key in effective)) notProvided.push(key);
    else if (effective[key] === value) tokens[i].removed = true;
    else different.push(key);
  }

  return {
    cleaned: tokens
      .filter((t) => !t.removed)
      .map((t) => t.text)
      .join(" "),
    tokens,
    removed: tokens.filter((t) => t.removed).map((t) => t.text),
    different,
    notProvided,
  };
};

export type GameCleanup =
  | { kind: "unreadable" }
  | { kind: "no_wrapper" }
  | { kind: "nothing"; different: string[]; notProvided: string[] }
  | { kind: "modify"; plan: CleanupPlan };

// null = the launch options couldn't be read: never treated as "empty".
export const analyzeGame = (
  options: string | null,
  candidates: string[],
  effective: Record<string, string>,
): GameCleanup => {
  if (options === null) return { kind: "unreadable" };
  if (!options.includes(WRAPPER_MARK)) return { kind: "no_wrapper" };
  const plan = planCleanup(options, candidates, effective);
  if (plan.removed.length === 0)
    return {
      kind: "nothing",
      different: plan.different,
      notProvided: plan.notProvided,
    };
  return { kind: "modify", plan };
};

// What the plugin applies to a game at launch: the global commands it hasn't
// opted out of, overridden by its own profile.
export const effectiveVars = (
  appid: number,
  profiles: Record<string, Record<string, string>>,
  globalVars: Record<string, string>,
  disabledGlobals: Record<string, string[]>,
): Record<string, string> => {
  const off = new Set(disabledGlobals[String(appid)] ?? []);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(globalVars)) {
    if (!off.has(key)) result[key] = value;
  }
  return Object.assign(result, profiles[String(appid)] ?? {});
};
