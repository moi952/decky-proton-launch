import React from "react";
import { ConfirmModal, showModal } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useTranslation } from "react-i18next";
import { SteamGame } from "../data/types";

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

// ── Steam app launch options (live via SteamClient) ───────────────────────────
//
// localconfig.vdf is Steam's own live state while Steam is running — a
// direct file write to it (like the backend still does for non-Steam
// shortcuts, which aren't kept live in memory) gets silently clobbered the
// next time Steam flushes its in-memory copy back to disk. Going through
// SteamClient here can't be raced like that. Used both for the explicit
// toggle buttons below and for the silent auto-wire/unwire that
// GameDetailView's save effect does when a profile is created/emptied.

export async function addWrapperViaSteamClient(appId: number): Promise<void> {
  const current = await getAppLaunchOptions(appId);
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

export async function removeWrapperViaSteamClient(appId: number): Promise<void> {
  const current = await getAppLaunchOptions(appId);
  const newOptions = current.replace(LAUNCH_OPTION, "").trim();
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
      toaster.toast({ title: t("wrapper_removed"), body: game.name });
    } else {
      const ok = await call<[number, boolean], boolean>(
        "remove_launch_option_only",
        game.appid,
        true,
      );
      if (ok) {
        onSuccess(false);
        toaster.toast({ title: t("wrapper_removed"), body: game.name });
        openRestartModal(game);
      } else {
        toaster.toast({ title: t("wrapper_error"), body: game.name });
      }
    }
  } catch {
    toaster.toast({ title: t("wrapper_error"), body: game.name });
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
      toaster.toast({ title: t("wrapper_added"), body: game.name });
    } else {
      const result = await call<
        [number, boolean],
        { success: boolean; needs_restart: boolean }
      >("add_launch_option", game.appid, true);
      if (result.success) {
        onSuccess(true);
        toaster.toast({ title: t("wrapper_added"), body: game.name });
        openRestartModal(game);
      } else {
        toaster.toast({ title: t("wrapper_error"), body: game.name });
      }
    }
  } catch {
    toaster.toast({ title: t("wrapper_error"), body: game.name });
  }
}
