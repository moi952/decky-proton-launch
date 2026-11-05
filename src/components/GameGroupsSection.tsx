import React, { useState } from "react";
import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { useCommandGroups } from "../context/CommandGroupsContext";
import { SteamGame } from "../data/types";
import { getApplyState, runBulk, BulkOp } from "../utils/bulkApply";
import { openRestartModal } from "../utils/wrapperAction";
import { pluginToast } from "../utils/toast";

interface GameGroupsSectionProps {
  game: SteamGame;
  // The game's own exports as currently shown on its page.
  profile: Record<string, string>;
  hasWrapper: boolean;
  // Called once the profile on disk changed, so the page reloads from it
  // instead of auto-saving its now-stale copy over the group's variables.
  onChanged: (wrapperAdded: boolean) => void;
}

// Groups for ONE game: the same apply/remove the bulk page does, on a single
// toggle.
export const GameGroupsSection: React.FC<GameGroupsSectionProps> = ({
  game,
  profile,
  hasWrapper,
  onChanged,
}) => {
  const { t } = useTranslation("command_groups");
  const { t: tBulk } = useTranslation("bulk_apply");
  const { groups, setGroupAppIds } = useCommandGroups();
  const [busy, setBusy] = useState(false);

  if (groups.length === 0) return null;

  const toggle = async (groupId: string, turnOn: boolean) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group || busy) return;
    setBusy(true);
    try {
      const op: BulkOp = turnOn
        ? { game, apply: group.vars, overwrite: true, wire: true }
        : {
            game,
            remove: { keys: Object.keys(group.vars), expected: group.vars },
          };
      const summary = await runBulk({
        ops: [op],
        wrapperApps: new Set(hasWrapper ? [game.appid] : []),
        isCancelled: () => false,
        onStatus: () => {},
      });
      if (summary.errors > 0) {
        pluginToast({ title: tBulk("status_error"), body: game.name });
        return;
      }
      const ids = new Set(group.appids);
      if (turnOn) ids.add(game.appid);
      else ids.delete(game.appid);
      setGroupAppIds(group.id, [...ids]);
      if (summary.restartGames.length > 0) openRestartModal(game);
      onChanged(turnOn && !hasWrapper);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelSection title={t("section_title")}>
      {groups.map((group) => {
        const state = getApplyState(profile, group.vars);
        return (
          <PanelSectionRow key={group.id}>
            <ToggleField
              label={group.name}
              description={
                state === "different" ? t("game_modified") : undefined
              }
              checked={state === "applied"}
              disabled={busy}
              onChange={(checked: boolean) => toggle(group.id, checked)}
            />
          </PanelSectionRow>
        );
      })}
    </PanelSection>
  );
};
