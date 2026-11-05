import React, { useEffect, useRef, useState } from "react";
import { Focusable, PanelSection } from "@decky/ui";
import { call } from "@decky/api";
import { BackHandler } from "@moi952/decky-plugin-toolkit";
import { ActionButton } from "@moi952/decky-ui-kit";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { FaCircleNotch } from "react-icons/fa";
import { BulkProgressCard } from "../components/BulkProgressCard";
import { BulkSummaryLines } from "../components/BulkSummaryLines";
import PanelSectionCustom from "../components/PanelSectionCustom";
import { SteamGame } from "../data/types";
import { BulkRow, BulkStatus, BulkSummary } from "../utils/bulkApply";
import {
  analyzeGame,
  effectiveVars,
  GameCleanup,
} from "../utils/launchOptionsClean";
import { useIncrementalCount } from "../utils/useIncrementalCount";
import {
  openBulkRestartModal,
  readLaunchOptions,
  setSteamLaunchOptions,
} from "../utils/wrapperAction";

export interface CleanPayload {
  title: string;
  games: SteamGame[];
  // From a group: only these variables are considered. Without it (a game's
  // own page), everything the plugin applies to the game is.
  groupVars?: Record<string, string>;
}

interface CleanLaunchOptionsViewProps {
  payload: CleanPayload;
  onBack: () => void;
}

interface Entry {
  game: SteamGame;
  options: string | null;
  result: GameCleanup;
}

type Phase = "reading" | "review" | "running" | "result";

const READ_CONCURRENCY = 4;

// A card the gamepad can land on, so a long list can be walked through and
// every card read in full. The outline is an inset shadow: it never shifts the
// layout when focus moves.
const FocusCard: React.FC<{
  children: React.ReactNode;
  background: string;
  small?: boolean;
}> = ({ children, background, small }) => {
  const [focused, setFocused] = useState(false);
  return (
    <Focusable
      // Steam only lets the gamepad land on a block with no focusable child
      // when it's told so explicitly (its own code passes `focusable: true`
      // the same way) — the prop isn't in Decky's typings, hence the spread.
      {...{ focusable: true }}
      noFocusRing
      onGamepadFocus={() => setFocused(true)}
      onGamepadBlur={() => setFocused(false)}
      style={{
        background,
        borderRadius: 6,
        padding: "8px 10px",
        marginTop: small ? 8 : 0,
        marginBottom: small ? 0 : 8,
        fontSize: small ? 11 : undefined,
        lineHeight: small ? 1.4 : undefined,
        minWidth: 0,
        boxSizing: "border-box",
        boxShadow: focused ? "inset 0 0 0 2px #ffffff" : "none",
      }}
    >
      {children}
    </Focusable>
  );
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const CleanLaunchOptionsView: React.FC<CleanLaunchOptionsViewProps> = ({
  payload,
  onBack,
}) => {
  const { t } = useTranslation("clean_options");
  const { t: tBulk } = useTranslation("bulk_apply");

  const [phase, setPhase] = useState<Phase>("reading");
  const [readDone, setReadDone] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [runTitle, setRunTitle] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // What each cleaned game had before — kept only for "restore".
  const [previous, setPrevious] = useState<Record<number, string>>({});
  const cancelRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [profiles, globalVars, disabled, shortcutOptions] =
        await Promise.all([
          call<[], Record<string, Record<string, string>>>("get_all_profiles"),
          call<[], Record<string, string>>("get_global_profile"),
          call<[], Record<string, string[]>>("get_disabled_globals_map"),
          call<[], Record<string, string>>("get_shortcut_launch_options"),
        ]).catch(
          () =>
            [{}, {}, {}, {}] as [
              Record<string, Record<string, string>>,
              Record<string, string>,
              Record<string, string[]>,
              Record<string, string>,
            ],
        );

      const games = payload.games;
      const results: Entry[] = new Array(games.length);
      let next = 0;
      let done = 0;
      const worker = async () => {
        while (next < games.length) {
          const index = next++;
          const game = games[index];
          // A shortcut missing from the file, or a Steam game that doesn't
          // answer, is "unreadable" — never silently treated as empty.
          const options = game.is_shortcut
            ? (shortcutOptions[String(game.appid)] ?? null)
            : await readLaunchOptions(game.appid);
          const effective = effectiveVars(
            game.appid,
            profiles,
            globalVars,
            disabled,
          );
          const candidates = payload.groupVars
            ? Object.keys(payload.groupVars)
            : Object.keys(effective);
          results[index] = {
            game,
            options,
            result: analyzeGame(options, candidates, effective),
          };
          done++;
          if (alive) setReadDone(done);
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(READ_CONCURRENCY, games.length) },
          worker,
        ),
      );
      if (alive) {
        setEntries(results);
        setPhase("review");
      }
    })();
    return () => {
      alive = false;
    };
  }, [payload]);

  const modify = entries.filter((e) => e.result.kind === "modify");
  const ignored = entries.filter((e) => e.result.kind !== "modify");
  const { count, sentinelRef, hasMore } = useIncrementalCount(
    modify.length,
    phase,
  );

  const setRowStatus = (index: number, status: BulkStatus) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, status } : r)));

  // Writes a launch-options string onto each game, one at a time.
  const writeAll = async (
    items: { game: SteamGame; value: string }[],
    title: string,
    doneStatus: BulkStatus,
  ) => {
    cancelRef.current = false;
    setCancelling(false);
    setRunTitle(title);
    setRows(
      items.map((i) => ({
        appid: i.game.appid,
        name: i.game.name,
        status: "pending" as BulkStatus,
      })),
    );
    setSummary(null);
    setPhase("running");

    let ok = 0;
    let errors = 0;
    let cancelled = 0;
    const succeeded: SteamGame[] = [];
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) {
        for (let j = i; j < items.length; j++) setRowStatus(j, "cancelled");
        cancelled = items.length - i;
        break;
      }
      const { game, value } = items[i];
      setRowStatus(i, "running");
      await tick();
      try {
        if (game.is_shortcut) {
          const saved = await call<[number, string], boolean>(
            "set_shortcut_launch_options",
            game.appid,
            value,
          );
          if (!saved) throw new Error("not saved");
        } else {
          await setSteamLaunchOptions(game.appid, value);
        }
        ok++;
        succeeded.push(game);
        setRowStatus(i, doneStatus);
      } catch {
        errors++;
        setRowStatus(i, "error");
      }
    }
    return { ok, errors, cancelled, succeeded };
  };

  const clean = async () => {
    const items = modify.flatMap((e) =>
      e.result.kind === "modify"
        ? [{ game: e.game, value: e.result.plan.cleaned }]
        : [],
    );
    const outcome = await writeAll(items, t("running_title"), "removed");

    const succeededIds = new Set(outcome.succeeded.map((g) => g.appid));
    setPrevious(
      Object.fromEntries(
        modify
          .filter((e) => succeededIds.has(e.game.appid) && e.options !== null)
          .map((e) => [e.game.appid, e.options as string]),
      ),
    );
    const leftAlone = entries
      .filter(
        (e) =>
          (e.result.kind === "modify" && e.result.plan.different.length > 0) ||
          (e.result.kind === "nothing" && e.result.different.length > 0),
      )
      .map((e) => e.game.appid);
    const restartGames = outcome.succeeded.filter((g) => g.is_shortcut);
    setSummary({
      done: 0,
      unchanged: 0,
      removed: outcome.ok,
      errors: outcome.errors,
      cancelled: outcome.cancelled,
      conflicts: leftAlone,
      previous: {},
      restartGames,
    });
    setPhase("result");
    // One restart prompt for every non-Steam game, shown once at the end.
    if (restartGames.length > 0) openBulkRestartModal(restartGames);
  };

  const restore = async () => {
    const byId = new Map(entries.map((e) => [e.game.appid, e.game]));
    const items = Object.entries(previous).flatMap(([id, value]) => {
      const game = byId.get(Number(id));
      return game ? [{ game, value }] : [];
    });
    const outcome = await writeAll(items, t("undoing_title"), "done");
    setPrevious({});
    const restartGames = outcome.succeeded.filter((g) => g.is_shortcut);
    setSummary({
      done: outcome.ok,
      unchanged: 0,
      removed: 0,
      errors: outcome.errors,
      cancelled: outcome.cancelled,
      conflicts: [],
      previous: {},
      restartGames,
    });
    setPhase("result");
    if (restartGames.length > 0) openBulkRestartModal(restartGames);
  };

  const label = (text: string) => (
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "#7d8793",
        margin: "6px 0 2px",
      }}
    >
      {text}
    </div>
  );

  const note = (text: string) => (
    <div style={{ fontSize: 10, color: "#f5a623", marginTop: 4 }}>{text}</div>
  );

  const ignoredReason = (entry: Entry) => {
    switch (entry.result.kind) {
      case "unreadable":
        return t("skip_unreadable");
      case "no_wrapper":
        return t("skip_no_wrapper");
      default:
        return t("skip_nothing");
    }
  };

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
            <div style={{ fontSize: 10, color: "#888" }}>{t("title")}</div>
          </div>
        </Focusable>
      </PanelSection>

      {phase === "reading" && (
        <PanelSectionCustom>
          <span style={{ color: "#aaa", fontSize: 12 }}>
            {t("reading", { done: readDone, total: payload.games.length })}
          </span>
        </PanelSectionCustom>
      )}

      {phase === "review" && (
        <React.Fragment>
          <PanelSectionCustom>
            {entries.length === 0 ? (
              <span style={{ color: "#888", fontSize: 12 }}>{t("empty")}</span>
            ) : (
              <React.Fragment>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>
                  {t("summary_modify", { count: modify.length })}
                  {" · "}
                  {t("summary_ignored", { count: ignored.length })}
                </div>
                <ActionButton
                  width="100%"
                  disabled={modify.length === 0}
                  onClick={clean}
                >
                  {t("confirm_button", { count: modify.length })}
                </ActionButton>
              </React.Fragment>
            )}
          </PanelSectionCustom>

          {modify.length > 0 && (
            <PanelSectionCustom>
              {modify.slice(0, count).map((entry) => {
                if (entry.result.kind !== "modify") return null;
                const plan = entry.result.plan;
                return (
                  <FocusCard key={entry.game.appid} background="#14181d">
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 12,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {entry.game.name}
                    </div>
                    {label(t("current"))}
                    <div
                      style={{
                        fontSize: 10,
                        lineHeight: 1.45,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {plan.tokens.map((token, i) => (
                        <div
                          key={`${token.text}-${i}`}
                          style={{
                            color: token.removed ? "#ff6b6b" : "#aab4c0",
                            textDecoration: token.removed
                              ? "line-through"
                              : undefined,
                          }}
                        >
                          {token.text}
                        </div>
                      ))}
                    </div>
                    {label(t("after"))}
                    <div
                      style={{
                        fontSize: 10,
                        lineHeight: 1.45,
                        color: "#9ecb9e",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {plan.cleaned}
                    </div>
                    {plan.different.length > 0 &&
                      note(
                        t("note_different", {
                          keys: plan.different.join(", "),
                        }),
                      )}
                    {plan.notProvided.length > 0 &&
                      note(
                        t("note_not_provided", {
                          keys: plan.notProvided.join(", "),
                        }),
                      )}
                  </FocusCard>
                );
              })}
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

          {ignored.length > 0 && (
            <PanelSectionCustom>
              <ActionButton
                size="small"
                width="100%"
                onClick={() => setShowIgnored((v) => !v)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {t("ignored_title", { count: ignored.length })}
                  {showIgnored ? (
                    <FiChevronUp size={14} />
                  ) : (
                    <FiChevronDown size={14} />
                  )}
                </span>
              </ActionButton>
              {showIgnored &&
                ignored.map((entry) => (
                  <FocusCard key={entry.game.appid} background="#101419" small>
                    <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                      {entry.game.name}
                    </div>
                    <div style={{ color: "#8a94a0" }}>
                      {ignoredReason(entry)}
                    </div>
                    {entry.result.kind === "nothing" &&
                      entry.result.different.length > 0 &&
                      note(
                        t("note_different", {
                          keys: entry.result.different.join(", "),
                        }),
                      )}
                    {entry.result.kind === "nothing" &&
                      entry.result.notProvided.length > 0 &&
                      note(
                        t("note_not_provided", {
                          keys: entry.result.notProvided.join(", "),
                        }),
                      )}
                  </FocusCard>
                ))}
            </PanelSectionCustom>
          )}
        </React.Fragment>
      )}

      {(phase === "running" || phase === "result") && (
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
      )}

      {phase === "result" && summary && (
        <PanelSectionCustom>
          <BulkSummaryLines summary={summary} />
          <Focusable
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {Object.keys(previous).length > 0 && (
              <ActionButton onClick={restore} width="100%">
                {t("undo")}
              </ActionButton>
            )}
            <ActionButton onClick={onBack} width="100%">
              {tBulk("close")}
            </ActionButton>
          </Focusable>
        </PanelSectionCustom>
      )}
    </BackHandler>
  );
};
