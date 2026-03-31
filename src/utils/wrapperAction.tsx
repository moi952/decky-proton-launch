import React from "react";
import { ConfirmModal, DialogBodyText, DialogControlsSection, DialogHeader, Focusable, ModalRoot, showModal } from "@decky/ui";
import { ActionButton } from "../components/ActionButton";
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

// ── Delete wrapper confirmation modal ─────────────────────────────────────────

const DeleteWrapperModal: React.FC<{
  game: SteamGame;
  onConfirm: () => void;
  closeModal?: () => void;
}> = ({ game, onConfirm, closeModal }) => {
  const { t } = useTranslation("game_manager");
  const { t: tCommon } = useTranslation("common");
  return (
    <ModalRoot closeModal={closeModal}>
      <DialogHeader>{t("delete_wrapper_title")}</DialogHeader>
      <DialogBodyText>
        {t("delete_wrapper_description", { game_name: game.name })}
      </DialogBodyText>
      <DialogControlsSection>
        <Focusable flow-children="horizontal" style={{ display: "flex", gap: "8px" }}>
          <ActionButton width="50%" onClick={() => closeModal?.()}>
            {tCommon("cancel")}
          </ActionButton>
          <ActionButton
            variant="danger"
            width="50%"
            onClick={() => { onConfirm(); closeModal?.(); }}
          >
            {t("delete_wrapper_confirm")}
          </ActionButton>
        </Focusable>
      </DialogControlsSection>
    </ModalRoot>
  );
};

// ── Wrapper remove (called after confirmation) ────────────────────────────────

async function doRemoveWrapper(
  game: SteamGame,
  t: (key: string) => string,
  onSuccess: (nowSet: boolean) => void,
): Promise<void> {
  try {
    if (!game.is_shortcut) {
      const current = await getAppLaunchOptions(game.appid);
      const newOptions = current.replace(LAUNCH_OPTION, "").trim();
      await SteamClient.Apps.SetAppLaunchOptions(game.appid, newOptions);
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

export async function toggleWrapper(
  game: SteamGame,
  isCurrentlySet: boolean,
  t: (key: string) => string,
  onSuccess: (nowSet: boolean) => void,
): Promise<void> {
  if (isCurrentlySet) {
    showModal(
      <DeleteWrapperModal
        game={game}
        onConfirm={() => doRemoveWrapper(game, t, onSuccess)}
      />,
    );
    return;
  }

  try {
    if (!game.is_shortcut) {
      const current = await getAppLaunchOptions(game.appid);
      let newOptions: string;
      if (current.includes("%command%")) {
        newOptions = current.replace("%command%", LAUNCH_OPTION);
      } else if (current.trim()) {
        newOptions = `${LAUNCH_OPTION} ${current.trim()}`;
      } else {
        newOptions = LAUNCH_OPTION;
      }
      await SteamClient.Apps.SetAppLaunchOptions(game.appid, newOptions);
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
