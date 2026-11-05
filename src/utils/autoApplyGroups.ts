import { call } from "@decky/api";
import i18n from "i18next";
import { CommandGroup } from "../context/CommandGroupsContext";
import { SteamGame } from "../data/types";
import { runBulk, BulkOp } from "./bulkApply";
import { GROUPS_UPDATED_EVENT, matchesGroupFilter } from "./groupFilter";
import { pluginToast } from "./toast";
import { openBulkRestartModal } from "./wrapperAction";

const FIRST_SCAN_DELAY_MS = 20_000;
// Steam reports game changes in bursts (library loading, play time...): wait
// for it to go quiet before looking at what's installed.
const QUIET_BEFORE_SCAN_MS = 8_000;
const MAX_NAMES_IN_TOAST = 3;

declare const SteamClient: any;

interface PlannedApply {
  group: CommandGroup;
  games: SteamGame[];
}

// Which new games each filtered group should pick up. A game the group
// already covers is never re-applied (so removing it by hand sticks).
export const planAutoApply = (
  newGames: SteamGame[],
  groups: CommandGroup[],
  matches: (
    appid: number,
    filter: NonNullable<CommandGroup["filter"]>,
  ) => boolean,
): PlannedApply[] =>
  groups
    .filter((group) => group.filter)
    .map((group) => ({
      group,
      games: newGames.filter(
        (game) =>
          !group.appids.includes(game.appid) &&
          matches(game.appid, group.filter!),
      ),
    }))
    .filter((plan) => plan.games.length > 0);

let scanning = false;

const scanOnce = async () => {
  if (scanning) return;
  scanning = true;
  try {
    const [games, knownData, settings] = await Promise.all([
      call<[], SteamGame[]>("get_games"),
      call<[], { appids?: number[] }>("get_known_games"),
      call<[], { autoApplyGroups?: boolean }>("get_ui_settings"),
    ]);
    const installed = games.map((g) => g.appid);

    // First run ever: remember what's already installed, apply nothing —
    // only games installed from now on count as new.
    if (!knownData.appids) {
      await call<[number[]], boolean>("set_known_games", installed);
      return;
    }

    const known = new Set(knownData.appids);
    const newGames = games.filter((g) => !known.has(g.appid));
    if (newGames.length === 0) return;

    if (settings.autoApplyGroups !== false) await applyToNewGames(newGames);

    // Remembered even with the setting off: turning it on later must not
    // sweep up every game installed in the meantime.
    await call<[number[]], boolean>("set_known_games", installed);
  } catch {
    // Retried on the next tick.
  } finally {
    scanning = false;
  }
};

const applyToNewGames = async (newGames: SteamGame[]) => {
  const groups = await call<[], CommandGroup[]>("get_command_groups");
  const plans = planAutoApply(newGames, groups, matchesGroupFilter);
  if (plans.length === 0) return;

  const wrapperApps = new Set(await call<[], number[]>("get_wrapper_app_ids"));
  const restartGames: SteamGame[] = [];
  const appliedByGroup = new Map<string, SteamGame[]>();

  for (const { group, games } of plans) {
    const ops: BulkOp[] = games.map((game) => ({
      game,
      apply: group.vars,
      overwrite: false,
      wire: true,
    }));
    const done: SteamGame[] = [];
    const summary = await runBulk({
      ops,
      wrapperApps,
      isCancelled: () => false,
      onStatus: (index, status) => {
        if (status === "done" || status === "unchanged")
          done.push(games[index]);
      },
    });
    restartGames.push(...summary.restartGames);
    if (done.length > 0) appliedByGroup.set(group.id, done);
  }
  if (appliedByGroup.size === 0) return;

  // Re-read right before writing: the panel may have saved a change meanwhile.
  const fresh = await call<[], CommandGroup[]>("get_command_groups");
  const updated = fresh.map((group) => {
    const applied = appliedByGroup.get(group.id);
    if (!applied) return group;
    const ids = new Set(group.appids);
    applied.forEach((g) => ids.add(g.appid));
    return { ...group, appids: [...ids] };
  });
  await call<[CommandGroup[]], boolean>("set_command_groups", updated);
  window.dispatchEvent(new Event(GROUPS_UPDATED_EVENT));

  for (const [groupId, applied] of appliedByGroup) {
    const group = groups.find((g) => g.id === groupId);
    const names =
      applied
        .slice(0, MAX_NAMES_IN_TOAST)
        .map((g) => g.name)
        .join(", ") +
      (applied.length > MAX_NAMES_IN_TOAST
        ? ` +${applied.length - MAX_NAMES_IN_TOAST}`
        : "");
    pluginToast({
      title: i18n.t("command_groups:title"),
      body: i18n.t("command_groups:auto_applied", {
        group: group?.name ?? "",
        count: applied.length,
        names,
      }),
    });
  }

  // Non-Steam games only take the wrapper after a Steam restart.
  if (restartGames.length > 0) openBulkRestartModal(restartGames);
};

// Runs for the whole session (called from definePlugin's body, like the other
// background listeners): the plugin panel doesn't need to be open. No timer
// polling — it only wakes up when Steam says a game changed (an install shows
// up as an overview change), plus once shortly after startup.
export const startAutoApplyScan = () => {
  const holder = window as unknown as {
    __plchAutoApply?: { timer?: number; unregister?: () => void };
  };
  holder.__plchAutoApply?.unregister?.();
  window.clearTimeout(holder.__plchAutoApply?.timer);

  const state: { timer?: number; unregister?: () => void } = {};
  const scanSoon = (delay: number) => {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(scanOnce, delay);
  };

  state.unregister = SteamClient?.Apps?.RegisterForAppOverviewChanges?.(() =>
    scanSoon(QUIET_BEFORE_SCAN_MS),
  )?.unregister;
  scanSoon(FIRST_SCAN_DELAY_MS);
  holder.__plchAutoApply = state;
};
