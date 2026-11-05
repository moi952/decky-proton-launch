import React from "react";
import { ConfirmModal, showModal } from "@decky/ui";
import { call } from "@decky/api";
import { useTranslation } from "react-i18next";
import { SteamGame } from "../data/types";
import { pluginToast } from "./toast";

declare const SteamClient: any;

const LAUNCH_OPTION = "~/.config/decky-proton-launch/proton-launch %command%";

// ── SteamClient helper ────────────────────────────────────────────────────────

async function getAppLaunchOptions(appId: number): Promise<string> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(""), 2000);
    const { unregister } = SteamClient.Apps.RegisterForAppDetails(
      appId,
      (details: any) => {
        clearTimeout(timeoutId);
        unregister();
        resolve(details?.strLaunchOptions ?? "");
      },
    );
  });
}

// Like getAppLaunchOptions, but null — never "" — when Steam doesn't answer
// in time, so a caller can tell "unreadable" from "genuinely empty".
export async function readLaunchOptions(appId: number): Promise<string | null> {
  return new Promise((resolve) => {
    let registration: { unregister: () => void } | undefined;
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      registration?.unregister();
      resolve(value);
    };
    const timeoutId = setTimeout(() => finish(null), 3000);
    registration = SteamClient.Apps.RegisterForAppDetails(
      appId,
      (details: any) =>
        finish(
          typeof details?.strLaunchOptions === "string"
            ? details.strLaunchOptions
            : details
              ? ""
              : null,
        ),
    );
    // The callback can fire before registration is assigned.
    if (settled) registration?.unregister();
  });
}

// Writes a Steam game's launch options exactly as given (live, via the client).
export async function setSteamLaunchOptions(
  appId: number,
  value: string,
): Promise<void> {
  await SteamClient.Apps.SetAppLaunchOptions(appId, value);
}

// ── Restart modal (non-Steam shortcuts only) ──────────────────────────────────

const RestartModalContent: React.FC<{
  game: SteamGame;
  closeModal?: () => void;
}> = ({ game, closeModal }) => {
  const { t } = useTranslation("game_manager");
  return (
    <ConfirmModal
      closeModal={closeModal}
      strTitle={t("restart_steam_title")}
      strDescription={`${game.name} — ${t("restart_steam_non_steam_body")}`}
      strOKButtonText={t("restart_steam_btn")}
      strCancelButtonText={t("ok")}
      onOK={() => SteamClient.User.StartRestart(false)}
    />
  );
};

export function openRestartModal(game: SteamGame): void {
  showModal(<RestartModalContent game={game} />);
}

// One prompt for a whole batch of non-Steam games — a bulk run would
// otherwise stack one restart modal per game.
const MAX_NAMES_SHOWN = 5;

const BulkRestartModalContent: React.FC<{
  games: SteamGame[];
  closeModal?: () => void;
}> = ({ games, closeModal }) => {
  const { t } = useTranslation("game_manager");
  const names = games
    .slice(0, MAX_NAMES_SHOWN)
    .map((g) => g.name)
    .join(", ");
  const more =
    games.length > MAX_NAMES_SHOWN ? ` +${games.length - MAX_NAMES_SHOWN}` : "";
  return (
    <ConfirmModal
      closeModal={closeModal}
      strTitle={t("restart_steam_title")}
      strDescription={`${names}${more} — ${t("restart_steam_non_steam_body")}`}
      strOKButtonText={t("restart_steam_btn")}
      strCancelButtonText={t("ok")}
      onOK={() => SteamClient.User.StartRestart(false)}
    />
  );
};

export function openBulkRestartModal(games: SteamGame[]): void {
  showModal(<BulkRestartModalContent games={games} />);
}

// ── Steam app launch options (live via SteamClient) ───────────────────────────
//
// localconfig.vdf is Steam's own live state while Steam is running — a
// direct file write to it (like the backend still does for non-Steam
// shortcuts, which aren't kept live in memory) gets silently clobbered the
// next time Steam flushes its in-memory copy back to disk. Going through
// SteamClient here can't be raced like that. Used both for the explicit
// toggle buttons below and for the silent auto-wire/unwire that
// GameDetailView's save effect does when a profile is created/emptied.

// A duplicated wrapper reads "W W %command%" — LAUNCH_OPTION itself only
// matches once in that, so occurrences have to be counted on the path.
const WRAPPER_RE = /~\/\.config\/decky-proton-launch\/proton-launch\s*/g;

function stripWrapper(options: string, keepFirst = false): string {
  let seen = 0;
  const stripped = options.replace(WRAPPER_RE, (m) =>
    keepFirst && seen++ === 0 ? m : "",
  );
  const cleaned = stripped.replace(/\s+/g, " ").trim();
  return cleaned === "%command%" ? "" : cleaned;
}

// Startup sweep: games that already ended up with the wrapper twice (see
// addWrapperViaSteamClient's idempotency check) get collapsed back to one.
// The backend only lists candidates — the write goes through SteamClient
// for the same reason as everything else in this section.
export async function cleanDuplicateWrappers(): Promise<void> {
  try {
    const appIds = await call<[], number[]>("get_duplicated_wrapper_apps");
    for (const appId of appIds) {
      const current = await getAppLaunchOptions(appId);
      if ((current.match(WRAPPER_RE) ?? []).length > 1) {
        await SteamClient.Apps.SetAppLaunchOptions(
          appId,
          stripWrapper(current, true),
        );
      }
    }
  } catch {
    // Best-effort — retried on the next launch.
  }
}

export async function addWrapperViaSteamClient(appId: number): Promise<void> {
  const current = await getAppLaunchOptions(appId);
  if (current.includes(LAUNCH_OPTION)) return;
  let newOptions: string;
  if (current.includes("%command%")) {
    newOptions = current.replace("%command%", LAUNCH_OPTION);
  } else if (current.trim()) {
    newOptions = `${LAUNCH_OPTION} ${current.trim()}`;
  } else {
    newOptions = LAUNCH_OPTION;
  }
  await SteamClient.Apps.SetAppLaunchOptions(appId, newOptions);
}

export async function removeWrapperViaSteamClient(
  appId: number,
): Promise<void> {
  const current = await getAppLaunchOptions(appId);
  // Every occurrence, so a game that already ended up with a duplicated
  // wrapper gets fully cleaned by a single removal.
  const newOptions = stripWrapper(current);
  await SteamClient.Apps.SetAppLaunchOptions(appId, newOptions);
}

// ── Wrapper remove (called after confirmation) ────────────────────────────────

export async function doRemoveWrapper(
  game: SteamGame,
  t: (key: string) => string,
  onSuccess: (nowSet: boolean) => void,
): Promise<void> {
  try {
    if (!game.is_shortcut) {
      await removeWrapperViaSteamClient(game.appid);
      onSuccess(false);
      pluginToast({ title: t("wrapper_removed"), body: game.name });
    } else {
      const ok = await call<[number, boolean], boolean>(
        "remove_launch_option_only",
        game.appid,
        true,
      );
      if (ok) {
        onSuccess(false);
        pluginToast({ title: t("wrapper_removed"), body: game.name });
        openRestartModal(game);
      } else {
        pluginToast({ title: t("wrapper_error"), body: game.name });
      }
    }
  } catch {
    pluginToast({ title: t("wrapper_error"), body: game.name });
  }
}

// ── Wrapper toggle ────────────────────────────────────────────────────────────

// Only ever adds — removal is confirmed inline by the caller, then calls
// doRemoveWrapper directly (see GamesPickerView/GameDetailView).
export async function toggleWrapper(
  game: SteamGame,
  t: (key: string) => string,
  onSuccess: (nowSet: boolean) => void,
): Promise<void> {
  try {
    if (!game.is_shortcut) {
      await addWrapperViaSteamClient(game.appid);
      onSuccess(true);
      pluginToast({ title: t("wrapper_added"), body: game.name });
    } else {
      const result = await call<
        [number, boolean],
        { success: boolean; needs_restart: boolean }
      >("add_launch_option", game.appid, true);
      if (result.success) {
        onSuccess(true);
        pluginToast({ title: t("wrapper_added"), body: game.name });
        openRestartModal(game);
      } else {
        pluginToast({ title: t("wrapper_error"), body: game.name });
      }
    }
  } catch {
    pluginToast({ title: t("wrapper_error"), body: game.name });
  }
}
