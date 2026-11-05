import { getVrInfo } from "./vrDetect";

// A group can follow a filter: games that match it (installed later, or
// picked up by the "add matching games" button) get the group on their own.
export type GroupFilter = "vr" | "vr_only";

// Order the group form cycles through (undefined = no filter).
export const GROUP_FILTER_CYCLE: (GroupFilter | undefined)[] = [
  undefined,
  "vr",
  "vr_only",
];

export const matchesGroupFilter = (
  appid: number,
  filter: GroupFilter,
): boolean => {
  const info = getVrInfo(appid);
  return filter === "vr_only" ? info.vrOnly : info.vr;
};

// Fired after the background scan changed the saved groups, so the open
// panel reloads them instead of later saving its stale copy over the change.
export const GROUPS_UPDATED_EVENT = "plch:groups-updated";
