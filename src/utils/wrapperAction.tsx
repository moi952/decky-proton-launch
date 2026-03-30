import React from "react";
import { DialogButton, Focusable, ModalRoot, showModal } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useTranslation } from "react-i18next";
import { SteamGame } from "../data/types";

// ── Restart modal ─────────────────────────────────────────────────────────────

interface RestartModalProps {
  game: SteamGame;
  closeModal: () => void;
}

const RestartModalContent: React.FC<RestartModalProps> = ({
  game,
  closeModal,
}) => {
  const { t } = useTranslation("game_manager");

  const handleRestart = async () => {
    closeModal();
    await call<[], boolean>("restart_steam");
  };

  return (
    <ModalRoot>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {t("restart_steam_title")}
        </div>
        <div style={{ fontSize: 12, color: "#ccc" }}>
          <span style={{ fontWeight: 500, color: "#fff" }}>{game.name}</span>
          {" — "}
          {game.is_shortcut
            ? t("restart_steam_non_steam_body")
            : t("restart_steam_body")}
        </div>
        <Focusable
          flow-children="horizontal"
          style={{ display: "flex", gap: "8px" }}
        >
          <DialogButton onClick={closeModal} style={{ flex: 1 }}>
            {t("ok")}
          </DialogButton>
          <DialogButton
            onClick={handleRestart}
            style={{ flex: 1, background: "#1a9fff", color: "#fff" }}
          >
            {t("restart_steam_btn")}
          </DialogButton>
        </Focusable>
      </div>
    </ModalRoot>
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
    if (isCurrentlySet) {
      const ok = await call<[number, boolean], boolean>(
        "remove_launch_option_only",
        game.appid,
        game.is_shortcut,
      );
      if (ok) {
        onSuccess(false);
        toaster.toast({ title: t("wrapper_removed"), body: game.name });
      } else {
        toaster.toast({ title: t("wrapper_error"), body: game.name });
      }
    } else {
      const result = await call<
        [number, boolean],
        { success: boolean; needs_restart: boolean }
      >("add_launch_option", game.appid, game.is_shortcut);

      if (result.success) {
        onSuccess(true);
        toaster.toast({ title: t("wrapper_added"), body: game.name });
        if (result.needs_restart) {
          openRestartModal(game);
        }
      } else {
        toaster.toast({ title: t("wrapper_error"), body: game.name });
      }
    }
  } catch {
    toaster.toast({ title: t("wrapper_error"), body: game.name });
  }
}
