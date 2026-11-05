import React, { useEffect, useRef, useState } from "react";
import { Focusable, PanelSection, PanelSectionRow, showModal } from "@decky/ui";
import { call } from "@decky/api";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiEdit2, FiTrash } from "react-icons/fi";
import { ActionButton } from "@moi952/decky-ui-kit";
import { BulkProgressCard } from "../components/BulkProgressCard";
import type { CleanPayload } from "./CleanLaunchOptionsView";
import { BulkSummaryLines } from "../components/BulkSummaryLines";
import { GroupModalContent } from "../components/GroupModal";
import { InlineConfirm } from "../components/InlineConfirm";
import PanelSectionCustom from "../components/PanelSectionCustom";
import {
  CommandGroup,
  useCommandGroups,
} from "../context/CommandGroupsContext";
import { SteamGame } from "../data/types";
import {
  BulkOp,
  BulkPayload,
  BulkRow,
  BulkStatus,
  BulkSummary,
  initialRows,
  runBulk,
} from "../utils/bulkApply";
import { GroupFilter, matchesGroupFilter } from "../utils/groupFilter";
import { pluginToast } from "../utils/toast";
import { openBulkRestartModal } from "../utils/wrapperAction";

interface GroupsViewProps {
  // Absent when the page is a tab: no header, no way back.
  onBack?: () => void;
  onApply: (payload: BulkPayload) => void;
  onCleanOptions: (payload: CleanPayload) => void;
}

type Phase = "list" | "running" | "result";

export const GroupsView: React.FC<GroupsViewProps> = ({
  onBack,
  onApply,
  onCleanOptions,
}) => {
  const { t } = useTranslation("command_groups");
  const { t: tClean } = useTranslation("clean_options");
  const { t: tBulk } = useTranslation("bulk_apply");
  const { groups, addGroup, editGroup, setGroupAppIds, removeGroup } =
    useCommandGroups();

  const [phase, setPhase] = useState<Phase>("list");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [runTitle, setRunTitle] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const cancelRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Keep the progress card on screen when a run starts and when it ends.
  useEffect(() => {
    if (phase !== "list")
      cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [phase]);

  // Names for the progress rows; a game that's no longer installed still
  // carries its profile, so it's updated too (profile only).
  const opsForAssigned = async (
    group: CommandGroup,
    build: (game: SteamGame & { installed?: boolean }) => Omit<BulkOp, "game">,
  ): Promise<BulkOp[]> => {
    const games = await call<[], SteamGame[]>("get_games").catch(() => []);
    const byId = new Map(games.map((g) => [g.appid, g]));
    return group.appids.map((appid) => {
      const known = byId.get(appid);
      const game: SteamGame & { installed?: boolean } = known ?? {
        appid,
        name: `#${appid}`,
        is_shortcut: false,
        installed: false,
      };
      return { game, ...build(game) };
    });
  };

  const run = async (
    ops: BulkOp[],
    title: string,
    options?: { wrapperApps?: Set<number>; statuses?: BulkStatus[] },
  ): Promise<BulkSummary> => {
    cancelRef.current = false;
    setCancelling(false);
    setRunTitle(title);
    setRows(initialRows(ops));
    setSummary(null);
    setPhase("running");
    const result = await runBulk({
      ops,
      wrapperApps: options?.wrapperApps ?? new Set(),
      isCancelled: () => cancelRef.current,
      onStatus: (index, status) => {
        if (options?.statuses) options.statuses[index] = status;
        setRows((prev) =>
          prev.map((row, i) => (i === index ? { ...row, status } : row)),
        );
      },
    });
    setSummary(result);
    setPhase("result");
    return result;
  };

  const handleSave = async (
    existing: CommandGroup | undefined,
    name: string,
    vars: Record<string, string>,
    filter?: GroupFilter,
  ) => {
    if (!existing) {
      // A group with no games does nothing yet — go straight to picking them.
      const created = addGroup(name, vars, filter);
      if (created)
        onApply({
          title: created.name,
          vars: created.vars,
          groupId: created.id,
        });
      return;
    }
    const oldVars = existing.vars;
    editGroup(existing.id, name, vars, filter);
    const changed = JSON.stringify(oldVars) !== JSON.stringify(vars);
    if (!changed || existing.appids.length === 0) return;

    // The group is the source of truth: every game it covers gets the new
    // values, and a key the group no longer has is taken off them.
    const droppedKeys = Object.keys(oldVars).filter((k) => !(k in vars));
    const ops = await opsForAssigned(existing, () => ({
      apply: vars,
      overwrite: true,
      remove: droppedKeys.length
        ? { keys: droppedKeys, expected: oldVars }
        : undefined,
    }));
    await run(ops, t("updating_title", { name }));
  };

  const openModal = (existing?: CommandGroup) => {
    let modal: ReturnType<typeof showModal> | null = null;
    modal = showModal(
      <GroupModalContent
        existing={existing}
        otherNames={groups
          .filter((g) => g.id !== existing?.id)
          .map((g) => g.name)}
        onSave={(name, vars, filter) =>
          handleSave(existing, name, vars, filter)
        }
        onClose={() => modal?.Close()}
      />,
    );
  };

  // Applies the group to every installed game that passes its filter and
  // doesn't have it yet — the same thing the background scan does for games
  // installed later.
  const addMatchingGames = async (group: CommandGroup) => {
    if (!group.filter) return;
    const [games, wrapperIds] = await Promise.all([
      call<[], SteamGame[]>("get_games").catch(() => [] as SteamGame[]),
      call<[], number[]>("get_wrapper_app_ids").catch(() => [] as number[]),
    ]);
    const matching = games.filter(
      (g) =>
        !group.appids.includes(g.appid) &&
        matchesGroupFilter(g.appid, group.filter!),
    );
    if (matching.length === 0) {
      pluginToast({ title: t("title"), body: t("no_new_matching") });
      return;
    }
    const ops: BulkOp[] = matching.map((game) => ({
      game,
      apply: group.vars,
      overwrite: false,
      wire: true,
    }));
    const statuses: BulkStatus[] = ops.map(() => "pending");
    const result = await run(ops, t("adding_title", { name: group.name }), {
      wrapperApps: new Set(wrapperIds),
      statuses,
    });
    const ids = new Set(group.appids);
    ops.forEach((op, i) => {
      if (statuses[i] === "done" || statuses[i] === "unchanged")
        ids.add(op.game.appid);
    });
    setGroupAppIds(group.id, [...ids]);
    if (result.restartGames.length > 0)
      openBulkRestartModal(result.restartGames);
  };

  // Only the installed games of the group can have their launch options read.
  const openClean = async (group: CommandGroup) => {
    const games = await call<[], SteamGame[]>("get_games").catch(
      () => [] as SteamGame[],
    );
    const byId = new Map(games.map((g) => [g.appid, g]));
    onCleanOptions({
      title: group.name,
      games: group.appids
        .map((id) => byId.get(id))
        .filter((g): g is SteamGame => Boolean(g)),
      groupVars: group.vars,
    });
  };

  const confirmDelete = async (group: CommandGroup) => {
    setPendingDelete(null);
    if (group.appids.length === 0) {
      removeGroup(group.id);
      return;
    }
    const ops = await opsForAssigned(group, () => ({
      remove: { keys: Object.keys(group.vars), expected: group.vars },
    }));
    const result = await run(ops, t("deleting_title", { name: group.name }));
    // Only forget the group once nothing is left to clean up — otherwise it
    // stays, so the same action can be retried.
    if (result.errors === 0 && result.cancelled === 0) removeGroup(group.id);
  };

  return (
    <div>
      {onBack && (
        <PanelSection>
          <Focusable
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
            flow-children="horizontal"
          >
            <ActionButton onClick={onBack} disabled={phase === "running"}>
              <FiArrowLeft size={16} />
            </ActionButton>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t("title")}</div>
            </div>
          </Focusable>
        </PanelSection>
      )}

      {phase !== "list" && (
        <React.Fragment>
          <div ref={cardRef}>
            <BulkProgressCard
              title={runTitle}
              rows={rows}
              running={phase === "running"}
              cancelling={cancelling}
              onCancel={() => {
                cancelRef.current = true;
                setCancelling(true);
              }}
            />
          </div>
          {phase === "result" && summary && (
            <PanelSectionCustom>
              <BulkSummaryLines summary={summary} />
              <ActionButton width="100%" onClick={() => setPhase("list")}>
                {tBulk("close")}
              </ActionButton>
            </PanelSectionCustom>
          )}
        </React.Fragment>
      )}

      {phase === "list" && (
        <React.Fragment>
          <PanelSection>
            <PanelSectionRow>
              <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                {t("description")}
              </div>
            </PanelSectionRow>
          </PanelSection>
          <PanelSection>
            <ActionButton size="small" width="100%" onClick={() => openModal()}>
              {t("new_group")}
            </ActionButton>
          </PanelSection>

          {groups.length === 0 && (
            <PanelSectionCustom>
              <span style={{ color: "#888", fontSize: 12 }}>{t("empty")}</span>
            </PanelSectionCustom>
          )}

          {groups.map((group) => (
            <PanelSection key={group.id} title={group.name}>
              <PanelSectionRow>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
                    <div>
                      {t("vars_count", {
                        count: Object.keys(group.vars).length,
                      })}
                    </div>
                    <div>
                      {t("games_count", { count: group.appids.length })}
                    </div>
                    {group.filter && (
                      <div>
                        {t("filter_current", {
                          name: t(`filter_${group.filter}`),
                        })}
                      </div>
                    )}
                  </div>
                  {pendingDelete === group.id ? (
                    <InlineConfirm
                      description={t("delete_confirm", {
                        name: group.name,
                        count: group.appids.length,
                      })}
                      onCancel={() => setPendingDelete(null)}
                      onConfirm={() => confirmDelete(group)}
                    />
                  ) : (
                    <React.Fragment>
                      {group.filter && (
                        <ActionButton
                          size="small"
                          width="100%"
                          onClick={() => addMatchingGames(group)}
                        >
                          {t("add_matching")}
                        </ActionButton>
                      )}
                      {group.appids.length > 0 && (
                        <ActionButton
                          size="small"
                          width="100%"
                          onClick={() => openClean(group)}
                        >
                          {tClean("button_label")}
                        </ActionButton>
                      )}
                      <Focusable
                        style={{ display: "flex", gap: 8 }}
                        flow-children="horizontal"
                      >
                        <div style={{ flex: 1 }}>
                          <ActionButton
                            size="small"
                            width="100%"
                            onClick={() =>
                              onApply({
                                title: group.name,
                                vars: group.vars,
                                groupId: group.id,
                              })
                            }
                          >
                            {t("choose_games")}
                          </ActionButton>
                        </div>
                        <ActionButton
                          size="small"
                          onClick={() => openModal(group)}
                          onOKActionDescription={t("edit")}
                        >
                          <FiEdit2 size={14} />
                        </ActionButton>
                        <ActionButton
                          size="small"
                          variant="danger"
                          onClick={() => setPendingDelete(group.id)}
                          onOKActionDescription={t("delete")}
                        >
                          <FiTrash size={14} />
                        </ActionButton>
                      </Focusable>
                    </React.Fragment>
                  )}
                </div>
              </PanelSectionRow>
            </PanelSection>
          ))}
        </React.Fragment>
      )}
    </div>
  );
};
