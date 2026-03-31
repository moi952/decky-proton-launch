export type GameStatus = "ready" | "configured" | "wrapper_only" | "none";

export function getGameStatus(hasProfile: boolean, hasWrapper: boolean): GameStatus {
  if (hasProfile && hasWrapper) return "ready";
  if (hasProfile && !hasWrapper) return "configured";
  if (!hasProfile && hasWrapper) return "wrapper_only";
  return "none";
}

export const STATUS_COLOR: Record<GameStatus, string> = {
  ready: "#4caf50",
  configured: "#f5a623",
  wrapper_only: "#29b6f6",
  none: "#888",
};

export const STATUS_LABEL_KEY: Record<GameStatus, string> = {
  ready: "legend_ready",
  configured: "legend_configured",
  wrapper_only: "legend_wrapper",
  none: "profile_none",
};
