import { IconType } from "react-icons";
import { FaCog } from "react-icons/fa";
import { FiLink, FiGlobe } from "react-icons/fi";

export type GameStatus = "ready" | "configured_globally" | "configured" | "wrapper_only" | "none";

export function getGameStatus(
  hasProfile: boolean,
  hasWrapper: boolean,
  hasActiveGlobal: boolean,
): GameStatus {
  if (hasProfile && hasWrapper) return "ready";
  if (hasProfile && !hasWrapper) return "configured";
  if (!hasProfile && hasWrapper) return hasActiveGlobal ? "configured_globally" : "wrapper_only";
  return "none";
}

export const STATUS_COLOR: Record<GameStatus, string> = {
  ready: "#4caf50",
  configured_globally: "#ab47bc",
  configured: "#f5a623",
  wrapper_only: "#29b6f6",
  none: "#888",
};

export const STATUS_LABEL_KEY: Record<GameStatus, string> = {
  ready: "legend_ready",
  configured_globally: "legend_configured_globally",
  configured: "legend_configured",
  wrapper_only: "legend_wrapper",
  none: "profile_none",
};

// Group order on the games list: actively-managed games first, the
// untouched bulk of the library last.
export const GAME_STATUS_ORDER: GameStatus[] = [
  "ready",
  "configured_globally",
  "wrapper_only",
  "configured",
  "none",
];

export const STATUS_GROUP_TITLE_KEY: Record<GameStatus, string> = {
  ready: "group_ready",
  configured_globally: "group_configured_globally",
  wrapper_only: "group_wrapper_only",
  configured: "group_configured",
  none: "group_none",
};

// Per-row badge icon (GameRow's cover overlay) — no entry for "none" since
// that status never shows a badge at all. Same choices as GamesPickerView's
// own group-header icon, single source of truth so the two can't drift.
export const STATUS_BADGE_ICON: Partial<Record<GameStatus, IconType>> = {
  ready: FaCog,
  configured: FaCog,
  configured_globally: FiGlobe,
  wrapper_only: FiLink,
};
