import React from "react";
import { ConfirmModal, showModal } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useTranslation } from "react-i18next";
import { SteamGame } from "../data/types";

declare const SteamClient: any;

const LAUNCH_OPTION = "~/proton-launch %command%";

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

const RestartModalContent: React.FC<{ game: SteamGame }> = ({ game }) => {
  const { t } = useTranslation("game_manager");
  return (
    <ConfirmModal
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

// ── Wrapper toggle ────────────────────────────────────────────────────────────

export async function toggleWrapper(
  game: SteamGame,
  isCurrentlySet: boolean,
  t: (key: string) => string,
  onSuccess: (nowSet: boolean) => void,
): Promise<void> {
  try {
    if (!game.is_shortcut) {
      // ── Steam game: SteamClient API, change is immediate, no restart needed ──
      const current = await getAppLaunchOptions(game.appid);
      let newOptions: string;

      if (isCurrentlySet) {
        newOptions = current.replace(LAUNCH_OPTION, "").trim();
      } else {
        if (current.includes("%command%")) {
          newOptions = current.replace("%command%", LAUNCH_OPTION);
        } else if (current.trim()) {
          newOptions = `${LAUNCH_OPTION} ${current.trim()}`;
        } else {
          newOptions = LAUNCH_OPTION;
        }
      }

      await SteamClient.Apps.SetAppLaunchOptions(game.appid, newOptions);
      onSuccess(!isCurrentlySet);
      toaster.toast({
        title: isCurrentlySet ? t("wrapper_removed") : t("wrapper_added"),
        body: game.name,
      });
    } else {
      // ── Non-Steam shortcut: Python backend + restart required ─────────────────
      if (isCurrentlySet) {
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
    }
  } catch {
    toaster.toast({ title: t("wrapper_error"), body: game.name });
  }
}
