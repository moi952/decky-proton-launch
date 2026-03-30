import React from "react";
import { DialogButton, Focusable, ModalRoot, showModal } from "@decky/ui";
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

interface RestartModalProps {
  game: SteamGame;
  closeModal: () => void;
}

const RestartModalContent: React.FC<RestartModalProps> = ({
  game,
  closeModal,
}) => {
  const { t } = useTranslation("game_manager");

  const handleRestart = () => {
    closeModal();
    SteamClient.User.StartRestart(false);
  };

  return (
    <>
      <style>{`
        .plch-restart-btn { background-color: #1a9fff !important; color: #fff !important; }
        .plch-restart-btn:focus, .plch-restart-btn:hover { color: #1a9fff !important; background-color: #fff !important; }
      `}</style>
      <ModalRoot>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {t("restart_steam_title")}
          </div>
          <div style={{ fontSize: 12, color: "#ccc" }}>
            <span style={{ fontWeight: 500, color: "#fff" }}>{game.name}</span>
            {" — "}
            {t("restart_steam_non_steam_body")}
          </div>
          <Focusable
            flow-children="horizontal"
            style={{ display: "flex", gap: "8px" }}
          >
            <DialogButton onClick={closeModal} style={{ flex: 1 }}>
              {t("ok")}
            </DialogButton>
            <DialogButton
              className="plch-restart-btn"
              onClick={handleRestart}
              style={{ flex: 1 }}
            >
              {t("restart_steam_btn")}
            </DialogButton>
          </Focusable>
        </div>
      </ModalRoot>
    </>
  );
};

export function openRestartModal(game: SteamGame): void {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <RestartModalContent game={game} closeModal={() => modal?.Close()} />,
  );
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
