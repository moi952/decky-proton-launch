import React, { useEffect, useMemo, useRef, useState } from "react";
import { Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import { call } from "@decky/api";
import { BackHandler } from "@moi952/decky-plugin-toolkit";
import { ActionButton } from "@moi952/decky-ui-kit";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiCheckSquare,
  FiRotateCcw,
  FiSquare,
} from "react-icons/fi";
import { FaCircleNotch, FaSearch } from "react-icons/fa";
import { GameRow, GameTag } from "../components/GameRow";
import { SearchField } from "../components/SearchField";
import { InlineConfirm } from "../components/InlineConfirm";
import { BulkProgressCard } from "../components/BulkProgressCard";
import { BulkSummaryLines } from "../components/BulkSummaryLines";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { useCommandGroups } from "../context/CommandGroupsContext";
import { SteamGame } from "../data/types";
import {
  ApplyState,
  BulkOp,
  BulkPayload,
  BulkRow,
  BulkStatus,
  BulkSummary,
  diffSelection,
  getApplyState,
  initialRows,
  runBulk,
} from "../utils/bulkApply";
import {
  bulkSessionKey,
  saveBulkSession,
  takeBulkSession,
} from "../utils/bulkSession";
import { getVrInfo } from "../utils/vrDetect";
import { useIncrementalCount } from "../utils/useIncrementalCount";
import { openBulkRestartModal } from "../utils/wrapperAction";

interface BulkApplyViewProps {
  payload: BulkPayload;
  onBack: () => void;
  // Opens a game's own page (square / secondary button on its row).
  onOpenGame?: (game: SteamGame) => void;
}

type Phase = "select" | "running" | "result";

export const BulkApplyView: React.FC<BulkApplyViewProps> = ({
  payload,
  onBack,
  onOpenGame,
}) => {
  const { t } = useTranslation("bulk_apply");
  const { t: tGames } = useTranslation("game_manager");
  const { groups, setGroupAppIds } = useCommandGroups();
  const group = payload.groupId
    ? groups.find((g) => g.id === payload.groupId)
    : undefined;

  const [games, setGames] = useState<SteamGame[]>([]);
  const [wrapperApps, setWrapperApps] = useState<Set<number>>(new Set());
  const [profiles, setProfiles] = useState<
    Record<string, Record<string, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [confirming, setConfirming] = useState(false);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [undone, setUndone] = useState(false);
  const [runTitle, setRunTitle] = useState("");
  const cancelRef = useRef(false);
  const selectionInitialised = useRef(false);
  const sessionKey = bulkSessionKey(payload);
  const cardRef = useRef<HTMLDivElement>(null);

  // The card sits above the (long) game list — bring it into view when a run
  // starts and again when it ends, so the progress is never off-screen.
  useEffect(() => {
    if (phase !== "select")
      cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [phase]);

  const refreshProfiles = () =>
    call<[], Record<string, Record<string, string>>>("get_all_profiles")
      .then(setProfiles)
      .catch(() => {});

  useEffect(() => {
    Promise.all([
      call<[], SteamGame[]>("get_games"),
      call<[], number[]>("get_wrapper_app_ids"),
      call<[], Record<string, Record<string, string>>>("get_all_profiles"),
    ])
      .then(([g, w, p]) => {
        setGames(g);
        setWrapperApps(new Set(w));
        setProfiles(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const vrInfo = useMemo(
    () => new Map(games.map((g) => [g.appid, getVrInfo(g.appid)])),
    [games],
  );
  const vrGames = useMemo(
    () => games.filter((g) => vrInfo.get(g.appid)?.vr),
    [games, vrInfo],
  );
  const vrOnlyGames = useMemo(
    () => games.filter((g) => vrInfo.get(g.appid)?.vrOnly),
    [games, vrInfo],
  );

  // What each game really has right now, read from its profile — the saved
  // state every change is counted against.
  const stateOf = useMemo(
    () =>
      new Map<number, ApplyState>(
        games.map((g) => [
          g.appid,
          getApplyState(profiles[String(g.appid)], payload.vars),
        ]),
      ),
    [games, profiles, payload.vars],
  );
  const appliedIds = useMemo(
    () =>
      new Set(
        games
          .filter((g) => stateOf.get(g.appid) === "applied")
          .map((g) => g.appid),
      ),
    [games, stateOf],
  );

  // The page opens on the saved state (applied games ticked). A group with a
  // filter and nothing applied yet — i.e. just created — also ticks the games
  // its filter matches, so the button shows what applying would do.
  useEffect(() => {
    if (loading || selectionInitialised.current) return;
    if (payload.groupId && !group) return;
    selectionInitialised.current = true;
    // Back from a game's own page: restore what was ticked, as it was.
    const session = takeBulkSession(sessionKey);
    if (session) {
      setSelected(new Set(session.selected));
      setSearch(session.search);
      return;
    }
    const initial = new Set(appliedIds);
    if (group?.filter && appliedIds.size === 0) {
      const source = group.filter === "vr_only" ? vrOnlyGames : vrGames;
      source.forEach((g) => initial.add(g.appid));
    }
    setSelected(initial);
  }, [
    loading,
    group,
    payload.groupId,
    appliedIds,
    vrGames,
    vrOnlyGames,
    sessionKey,
  ]);

  const q = search.toLowerCase();
  const filtered = useMemo(
    () => games.filter((g) => g.name.toLowerCase().includes(q)),
    [games, q],
  );
  // Games that already have it come first, the rest follow — no headings,
  // the checkbox says which is which.
  const ordered = useMemo(
    () => [
      ...filtered.filter((g) => stateOf.get(g.appid) === "applied"),
      ...filtered.filter((g) => stateOf.get(g.appid) !== "applied"),
    ],
    [filtered, stateOf],
  );
  const { count, sentinelRef, hasMore } = useIncrementalCount(
    ordered.length,
    q,
  );

  const toggleGame = (appid: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(appid)) next.delete(appid);
      else next.add(appid);
      return next;
    });

  const addToSelection = (ids: number[]) =>
    setSelected((prev) => new Set([...prev, ...ids]));

  const { apply: applyGames, remove: removeGames } = diffSelection(
    games,
    selected,
    stateOf,
  );
  const changes = applyGames.length + removeGames.length;

  // The button spells out exactly what it will do.
  const applyLabel =
    [
      applyGames.length > 0 ? t("apply_add", { count: applyGames.length }) : "",
      removeGames.length > 0
        ? t("apply_remove", { count: removeGames.length })
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || t("apply_add", { count: 0 });

  const toneOf = (appid: number): "info" | "danger" | undefined => {
    const isSelected = selected.has(appid);
    const isApplied = stateOf.get(appid) === "applied";
    if (isSelected && !isApplied) return "info";
    if (!isSelected && isApplied) return "danger";
    return undefined;
  };

  const tagsOf = (appid: number) => {
    const tags: React.ReactNode[] = [];
    if (vrInfo.get(appid)?.vr)
      tags.push(
        <GameTag key="vr" color="#1a9fff">
          VR
        </GameTag>,
      );
    if (stateOf.get(appid) === "different")
      tags.push(
        <GameTag key="different" color="#f5a623">
          {t("tag_different")}
        </GameTag>,
      );
    return tags.length > 0 ? tags : undefined;
  };

  const varEntries = Object.entries(payload.vars);

  const openGame = (game: SteamGame) => {
    saveBulkSession(sessionKey, selected, search);
    onOpenGame?.(game);
  };

  const execute = async (
    ops: BulkOp[],
    title: string,
    options?: { syncGroup?: boolean; keepIds?: number[] },
  ) => {
    cancelRef.current = false;
    setCancelling(false);
    setConfirming(false);
    setRunTitle(title);
    setRows(initialRows(ops));
    setSummary(null);
    setPhase("running");

    const statuses: BulkStatus[] = ops.map(() => "pending");
    const wrapperSet = new Set(wrapperApps);
    const result = await runBulk({
      ops,
      wrapperApps: wrapperSet,
      isCancelled: () => cancelRef.current,
      onStatus: (index, status) => {
        statuses[index] = status;
        setRows((prev) =>
          prev.map((row, i) => (i === index ? { ...row, status } : row)),
        );
      },
    });

    setWrapperApps(wrapperSet);
    setSummary(result);
    setPhase("result");
    refreshProfiles();

    if (options?.syncGroup && group) {
      const ids = new Set([...group.appids, ...(options.keepIds ?? [])]);
      ops.forEach((op, i) => {
        const status = statuses[i];
        if (op.apply && (status === "done" || status === "unchanged")) {
          ids.add(op.game.appid);
        } else if (
          op.remove &&
          (status === "removed" || status === "unchanged")
        ) {
          ids.delete(op.game.appid);
        }
      });
      setGroupAppIds(group.id, [...ids]);
    }

    // One restart prompt for every non-Steam game, shown once at the end.
    if (result.restartGames.length > 0)
      openBulkRestartModal(result.restartGames);
  };

  const startApply = () => {
    const ops: BulkOp[] = [
      ...applyGames.map((game) => ({
        game,
        apply: payload.vars,
        // A game ticked from "different value" is an explicit replacement.
        overwrite: stateOf.get(game.appid) === "different",
        wire: true,
      })),
      ...removeGames.map((game) => ({
        game,
        remove: { keys: Object.keys(payload.vars), expected: payload.vars },
      })),
    ];
    execute(ops, t("running_title"), {
      syncGroup: Boolean(group),
      keepIds: [...appliedIds].filter((id) => selected.has(id)),
    });
  };

  const replaceConflicts = () => {
    if (!summary) return;
    const byId = new Map(games.map((g) => [g.appid, g]));
    const ops: BulkOp[] = summary.conflicts
      .map((id) => byId.get(id))
      .filter((g): g is SteamGame => Boolean(g))
      .map((game) => ({
        game,
        apply: payload.vars,
        overwrite: true,
        wire: true,
      }));
    execute(ops, t("running_title"), { syncGroup: Boolean(group) });
  };

  const undo = () => {
    if (!summary) return;
    const byId = new Map(games.map((g) => [g.appid, g]));
    const ops: BulkOp[] = [];
    for (const [id, previous] of Object.entries(summary.previous)) {
      const game = byId.get(Number(id));
      if (!game) continue;
      const removeKeys = Object.keys(previous).filter(
        (k) => previous[k] === null,
      );
      const restore: Record<string, string> = {};
      for (const [key, value] of Object.entries(previous)) {
        if (value !== null) restore[key] = value;
      }
      ops.push({
        game,
        remove: removeKeys.length
          ? { keys: removeKeys, expected: payload.vars }
          : undefined,
        apply: Object.keys(restore).length ? restore : undefined,
        overwrite: true,
      });
    }
    setUndone(true);
    execute(ops, t("undoing_title"));
  };

  const chip = (
    content: React.ReactNode,
    onClick: () => void,
    description: string,
    highlighted = false,
  ) => (
    <ActionButton
      size="small"
      onClick={onClick}
      pressed={highlighted}
      onOKActionDescription={description}
    >
      {content}
    </ActionButton>
  );

  return (
    <BackHandler onBack={phase === "running" ? () => {} : onBack}>
      <PanelSection>
        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton onClick={onBack} disabled={phase === "running"}>
            <FiArrowLeft size={16} />
          </ActionButton>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {payload.title}
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>{t("subtitle")}</div>
          </div>
        </Focusable>
      </PanelSection>
      <PanelSection>
        <PanelSectionRow>
          <div
            style={{
              background: "#14181d",
              borderRadius: 6,
              padding: "6px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            {varEntries.map(([key, value]) => (
              <div key={key}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#ccc",
                    overflowWrap: "anywhere",
                  }}
                >
                  {key}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#8a94a0",
                    lineHeight: 1.4,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </PanelSectionRow>
      </PanelSection>

      {phase !== "select" && (
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
      )}

      {phase === "result" && summary && (
        <PanelSectionCustom>
          <BulkSummaryLines summary={summary} />
          <Focusable
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {summary.conflicts.length > 0 && (
              <ActionButton onClick={replaceConflicts} width="100%">
                {t("replace_conflicts", { count: summary.conflicts.length })}
              </ActionButton>
            )}
            {!payload.groupId &&
              !undone &&
              summary.removed === 0 &&
              Object.keys(summary.previous).length > 0 && (
                <ActionButton onClick={undo} width="100%">
                  {t("undo")}
                </ActionButton>
              )}
            <ActionButton onClick={onBack} width="100%">
              {t("close")}
            </ActionButton>
          </Focusable>
        </PanelSectionCustom>
      )}

      {phase === "select" && (
        <React.Fragment>
          <SearchField
            value={search}
            onChange={setSearch}
            size="small"
            highlightOnFocus={false}
            bottomSeparator={false}
            placeholder={tGames("search")}
            iconEnd={<FaSearch size={12} color="#888" />}
          />

          <PanelSectionCustom>
            <Focusable
              style={{
                display: "flex",
                flexWrap: "nowrap",
                alignItems: "center",
                gap: 6,
              }}
              flow-children="horizontal"
            >
              {chip(
                <FiCheckSquare size={14} />,
                () => addToSelection(filtered.map((g) => g.appid)),
                t("select_all"),
              )}
              {chip(
                <FiSquare size={14} />,
                () => setSelected(new Set()),
                t("select_none"),
              )}
              {chip(
                `${t("select_vr")} (${vrGames.length})`,
                () => addToSelection(vrGames.map((g) => g.appid)),
                t("select_vr"),
                group?.filter === "vr",
              )}
              {chip(
                `${t("select_vr_only")} (${vrOnlyGames.length})`,
                () => addToSelection(vrOnlyGames.map((g) => g.appid)),
                t("select_vr_only"),
                group?.filter === "vr_only",
              )}
            </Focusable>
          </PanelSectionCustom>

          <PanelSectionCustom>
            {confirming ? (
              <InlineConfirm
                description={t("confirm_remove", { count: removeGames.length })}
                confirmLabel={applyLabel}
                onCancel={() => setConfirming(false)}
                onConfirm={startApply}
              />
            ) : (
              <Focusable
                style={{ display: "flex", alignItems: "center", gap: 8 }}
                flow-children="horizontal"
              >
                <div style={{ flex: 1 }}>
                  <ActionButton
                    width="100%"
                    disabled={loading || changes === 0}
                    // Adding is safe to undo; removing asks first.
                    onClick={() =>
                      removeGames.length > 0
                        ? setConfirming(true)
                        : startApply()
                    }
                  >
                    {applyLabel}
                  </ActionButton>
                </div>
                {changes > 0 && (
                  <ActionButton
                    onClick={() => setSelected(new Set(appliedIds))}
                    onOKActionDescription={t("reset")}
                  >
                    <FiRotateCcw size={14} />
                  </ActionButton>
                )}
              </Focusable>
            )}
          </PanelSectionCustom>

          {loading && (
            <PanelSectionCustom>
              <span style={{ color: "#888", fontSize: 12 }}>
                {t("loading")}
              </span>
            </PanelSectionCustom>
          )}

          {!loading && ordered.length === 0 && (
            <PanelSectionCustom>
              <span style={{ color: "#888", fontSize: 12 }}>
                {t("no_games")}
              </span>
            </PanelSectionCustom>
          )}

          {!loading && ordered.length > 0 && (
            <PanelSectionCustom>
              <Focusable flow-children="vertical">
                {ordered.slice(0, count).map((game) => (
                  <GameRow
                    key={game.appid}
                    game={game}
                    checked={selected.has(game.appid)}
                    tone={toneOf(game.appid)}
                    tags={tagsOf(game.appid)}
                    tall
                    onClick={() => toggleGame(game.appid)}
                    onQuickAdd={onOpenGame ? () => openGame(game) : undefined}
                    quickAddLabel={t("view_game")}
                  />
                ))}
              </Focusable>
              {hasMore && (
                <div
                  ref={sentinelRef}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "8px 0",
                  }}
                >
                  <style>{`@keyframes plch-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  <FaCircleNotch
                    size={14}
                    style={{
                      animation: "plch-spin 1s linear infinite",
                      color: "#888",
                    }}
                  />
                </div>
              )}
            </PanelSectionCustom>
          )}
        </React.Fragment>
      )}
    </BackHandler>
  );
};
