import { call } from "@decky/api";
import { SteamGame } from "../data/types";
import { addWrapperViaSteamClient } from "./wrapperAction";

export interface BulkPayload {
  title: string;
  vars: Record<string, string>;
  // Set when the vars come from a command group: the selection page then
  // also removes the group from the games that get unchecked.
  groupId?: string;
}

export type BulkStatus =
  | "pending"
  | "running"
  | "done"
  | "unchanged"
  | "conflict"
  | "error"
  | "removed"
  | "cancelled";

export interface BulkOp {
  // installed=false: a game that's no longer installed but still carries a
  // profile — only its profile is touched, never its launch options.
  game: SteamGame & { installed?: boolean };
  apply?: Record<string, string>;
  remove?: { keys: string[]; expected?: Record<string, string> };
  overwrite?: boolean;
  // Also make sure the wrapper is in the game's launch options.
  wire?: boolean;
}

export interface BulkRow {
  appid: number;
  name: string;
  status: BulkStatus;
}

export interface BulkSummary {
  done: number;
  unchanged: number;
  removed: number;
  errors: number;
  cancelled: number;
  conflicts: number[];
  // appid -> key -> value it held before (null: absent), for undoing.
  previous: Record<number, Record<string, string | null>>;
  // Non-Steam games that just got the wrapper: Steam has to restart once
  // for those, so the caller shows a single prompt at the very end.
  restartGames: SteamGame[];
}

interface ApplyResult {
  success: boolean;
  applied?: string[];
  unchanged?: string[];
  skipped?: string[];
  previous?: Record<string, string | null>;
}

interface RemoveResult {
  success: boolean;
  removed?: string[];
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const initialRows = (ops: BulkOp[]): BulkRow[] =>
  ops.map((op) => ({
    appid: op.game.appid,
    name: op.game.name,
    status: "pending",
  }));

// Games are processed one at a time so the progress card can follow along;
// a failure on one never stops the rest.
export async function runBulk(params: {
  ops: BulkOp[];
  wrapperApps: Set<number>;
  isCancelled: () => boolean;
  onStatus: (index: number, status: BulkStatus) => void;
}): Promise<BulkSummary> {
  const { ops, wrapperApps, isCancelled, onStatus } = params;
  const summary: BulkSummary = {
    done: 0,
    unchanged: 0,
    removed: 0,
    errors: 0,
    cancelled: 0,
    conflicts: [],
    previous: {},
    restartGames: [],
  };

  for (let i = 0; i < ops.length; i++) {
    if (isCancelled()) {
      for (let j = i; j < ops.length; j++) {
        onStatus(j, "cancelled");
        summary.cancelled++;
      }
      break;
    }

    const op = ops[i];
    onStatus(i, "running");
    await tick();

    let status: BulkStatus = "unchanged";
    try {
      let removedSomething = false;
      if (op.remove) {
        const res = await call<
          [number, string[], Record<string, string> | null],
          RemoveResult
        >(
          "remove_vars_from_game",
          op.game.appid,
          op.remove.keys,
          op.remove.expected ?? null,
        );
        if (!res.success) throw new Error("remove failed");
        removedSomething = (res.removed ?? []).length > 0;
      }

      let applied = false;
      let skipped = false;
      if (op.apply) {
        const res = await call<
          [number, Record<string, string>, string, boolean],
          ApplyResult
        >(
          "apply_vars_to_game",
          op.game.appid,
          op.apply,
          op.game.installed === false ? "" : op.game.name,
          op.overwrite ?? false,
        );
        if (!res.success) throw new Error("apply failed");
        applied = (res.applied ?? []).length > 0;
        skipped = (res.skipped ?? []).length > 0;
        if (applied) summary.previous[op.game.appid] = res.previous ?? {};
      }

      if (skipped) {
        status = "conflict";
        summary.conflicts.push(op.game.appid);
      } else if (applied) {
        status = "done";
      } else if (removedSomething) {
        status = "removed";
      }

      const needsWrapper =
        op.wire &&
        op.game.installed !== false &&
        op.apply !== undefined &&
        !wrapperApps.has(op.game.appid);
      if (needsWrapper) {
        if (!op.game.is_shortcut) {
          await addWrapperViaSteamClient(op.game.appid);
          wrapperApps.add(op.game.appid);
        } else {
          const res = await call<
            [number, boolean],
            { success: boolean; needs_restart: boolean }
          >("add_launch_option", op.game.appid, true);
          if (!res.success) throw new Error("wrapper failed");
          wrapperApps.add(op.game.appid);
          summary.restartGames.push(op.game);
        }
      }
    } catch {
      status = "error";
    }

    if (status === "done") summary.done++;
    else if (status === "unchanged") summary.unchanged++;
    else if (status === "removed") summary.removed++;
    else if (status === "error") summary.errors++;
    onStatus(i, status);
  }

  return summary;
}

// Whether a game's own profile already carries every key of vars.
export type ApplyState = "applied" | "different" | "none";

export const getApplyState = (
  profile: Record<string, string> | undefined,
  vars: Record<string, string>,
): ApplyState => {
  if (!profile) return "none";
  const keys = Object.keys(vars);
  if (keys.length === 0) return "none";
  const present = keys.filter((k) => profile[k] !== undefined);
  if (present.length === 0) return "none";
  const allSame =
    present.length === keys.length &&
    present.every((k) => profile[k] === vars[k]);
  return allSame ? "applied" : "different";
};

// What ticking/unticking changes compared to the saved state: a ticked game
// that doesn't have the variables yet is to apply, an unticked game that has
// them is to remove. Anything else is not a change, so e.g. 4 applied games
// plus 2 newly ticked ones is 2 changes — never 4 or 6.
export const diffSelection = <T extends { appid: number }>(
  games: T[],
  selected: Set<number>,
  stateOf: Map<number, ApplyState>,
): { apply: T[]; remove: T[] } => ({
  apply: games.filter(
    (g) => selected.has(g.appid) && stateOf.get(g.appid) !== "applied",
  ),
  remove: games.filter(
    (g) => !selected.has(g.appid) && stateOf.get(g.appid) === "applied",
  ),
});

// Shell-style quoting, only where a value actually needs it.
const quoteForLaunchText = (value: string): string =>
  /^[A-Za-z0-9_./:@%+,=-]+$/.test(value)
    ? value
    : `'${value.replace(/'/g, `'\\''`)}'`;

export const varsToLaunchText = (vars: Record<string, string>): string =>
  Object.entries(vars)
    .map(([key, value]) => `${key}=${quoteForLaunchText(value)}`)
    .join(" ");
