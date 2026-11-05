import React, { useState, useEffect } from "react";
import { MediaRow } from "@moi952/decky-ui-kit";
import { call } from "@decky/api";
import { FaSteam } from "react-icons/fa";
import { FiCheck, FiImage } from "react-icons/fi";
import { SteamGame } from "../data/types";
import { BadgeIcon } from "./BadgeIcon";
import {
  getCachedCover,
  setCachedCover,
  useCoverCacheVersion,
} from "../utils/coverCache";
import {
  GameStatus,
  STATUS_COLOR,
  STATUS_BADGE_ICON,
} from "../utils/gameStatus";
import { useSettings } from "../context/SettingsContext";

// Every row is exactly this tall regardless of the chosen cover image
// type — a per-type row HEIGHT made the list itself uneven (tall rows
// mixed with short ones) once portrait was picked. Ratio matches Steam's
// own "Header Capsule" artwork (460×215, or 920×430 at 2x).
const LANDSCAPE_WIDTH = 80;
const COVER_HEIGHT = Math.round(LANDSCAPE_WIDTH * (215 / 460));
// WIDTH, unlike height, does follow the type — MediaRow's own "stretch"
// layout sizes the media box to its content, with a fixed gap to the
// title text after it. A landscape-ratio image forced into that same
// width at portrait's own 2:3 ratio would need heavy cropping (loses most
// of the image) or leaves a big empty gap before the text (natural size,
// centered/contained) — matching the real portrait ratio at this fixed
// height instead keeps the same tight, consistent gap every format gets.
const PORTRAIT_WIDTH = Math.round(COVER_HEIGHT * (600 / 900));
// Same reasoning for the ultra-wide banner (1920×620 hero art) — it must
// render visibly wider than a plain landscape row, not squeezed into the
// same 80px box.
const BANNER_WIDTH = Math.round(COVER_HEIGHT * (1920 / 620));
// Extra height for rows that carry a tags line above a two-line title.
const TALL_EXTRA = 8;
const CHECKBOX_COLUMN_WIDTH = 28;

interface GameRowProps {
  game: SteamGame;
  // Omit entirely for a row with no status badge at all (NowPlayingCard).
  status?: GameStatus;
  nowPlaying?: boolean;
  onClick: () => void;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  // Selection lists: a small checkbox inside the card, left of the cover.
  // Leave undefined for a plain (non-selectable) row.
  checked?: boolean;
  // Tints a row whose state is about to change.
  tone?: "info" | "danger";
  // Small tags (see GameTag) on a line above the title.
  tags?: React.ReactNode;
  // A little taller than the games list, so tags + a two-line title fit.
  tall?: boolean;
}

// One small pill for GameRow's tags line.
export const GameTag: React.FC<{
  color: string;
  children: React.ReactNode;
}> = ({ color, children }) => (
  <span
    style={{
      color,
      border: `1px solid ${color}`,
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 600,
      lineHeight: 1,
      padding: "2px 4px",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

export const GameRow: React.FC<GameRowProps> = ({
  game,
  status,
  nowPlaying,
  onClick,
  onQuickAdd,
  quickAddLabel,
  checked,
  tone,
  tags,
  tall,
}) => {
  const [cover, setCover] = useState<string | null>(null);
  // Distinct from "still loading" (cover === null, nothing to show yet) —
  // the backend no longer substitutes a different type's art when the
  // requested one doesn't exist for this game (see get_game_cover), so a
  // resolved-but-empty result means "genuinely no art in this format",
  // shown as its own placeholder instead of silently reusing whatever
  // image happened to be cached from a previous type.
  const [notFound, setNotFound] = useState(false);
  const cacheVersion = useCoverCacheVersion();
  const { coverImageType } = useSettings();
  const baseCoverWidth =
    coverImageType === "portrait"
      ? PORTRAIT_WIDTH
      : coverImageType === "banner"
        ? BANNER_WIDTH
        : LANDSCAPE_WIDTH;
  const mediaHeight = tall ? COVER_HEIGHT + TALL_EXTRA : COVER_HEIGHT;
  // A taller row keeps the cover's real ratio instead of cropping it.
  const coverWidth = Math.round(baseCoverWidth * (mediaHeight / COVER_HEIGHT));

  useEffect(() => {
    setCover(null);
    setNotFound(false);
    const cached = getCachedCover(game.appid, coverImageType);
    if (cached !== undefined) {
      if (cached) setCover(cached);
      else setNotFound(true);
      return;
    }
    call<[number, string], string>(
      "get_game_cover",
      game.appid,
      coverImageType,
    ).then((url) => {
      if (url) {
        setCachedCover(game.appid, coverImageType, url);
        setCover(url);
      } else {
        setNotFound(true);
      }
    });
  }, [game.appid, cacheVersion, coverImageType]);

  // Same status → same icon/color as the group this row lives in — see
  // gameStatus.ts's STATUS_BADGE_ICON, the single source both this badge
  // and GamesPickerView's own group header icon read from.
  const BadgeIconComponent = status ? STATUS_BADGE_ICON[status] : undefined;

  const coverBlock = (
    <>
      {cover ? (
        // coverWidth already matches this format's own real ratio at
        // the shared fixed height (see PORTRAIT_WIDTH/LANDSCAPE_WIDTH
        // above), so a plain fill never needs meaningful cropping —
        // no per-type object-fit/object-position juggling needed.
        <img
          src={cover}
          alt=""
          style={{
            width: coverWidth,
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : notFound ? (
        // Same coverWidth as a real image of this format — a wrong
        // shape here (e.g. the wide landscape box while portrait is
        // selected) looked like a bug, not "no art available".
        <div
          style={{
            width: coverWidth,
            height: "100%",
            background: "#2a2a3e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="No cover art in this format"
        >
          <FiImage size={14} color="rgba(255,255,255,0.25)" />
        </div>
      ) : (
        <div
          style={{
            width: coverWidth,
            height: "100%",
            background: "#2a2a3e",
          }}
        />
      )}
      {!game.is_shortcut && (
        <div style={{ position: "absolute", top: 3, left: 3 }}>
          <BadgeIcon icon={FaSteam} color="rgba(255,255,255,0.4)" size={8} />
        </div>
      )}
      {status && BadgeIconComponent && (
        <div style={{ position: "absolute", bottom: 3, left: 3 }}>
          <BadgeIcon
            icon={BadgeIconComponent}
            color={STATUS_COLOR[status]}
            size={8}
          />
        </div>
      )}
    </>
  );

  return (
    <MediaRow
      onPress={onClick}
      onSecondaryButton={onQuickAdd ? () => onQuickAdd() : undefined}
      onSecondaryActionDescription={onQuickAdd ? quickAddLabel : undefined}
      spacing={4}
      // Same border width in all states so a row's size never shifts
      // depending on whether it's now playing — "success" gives the
      // green border+tinted background, "light" is the plain default
      // card look otherwise.
      color={nowPlaying ? "success" : (tone ?? "light")}
      accentBorderWidth={2}
      mediaLayout="stretch"
      mediaHeight={mediaHeight}
      media={
        checked === undefined ? (
          coverBlock
        ) : (
          <div style={{ display: "flex", height: "100%" }}>
            <div
              style={{
                width: CHECKBOX_COLUMN_WIDTH,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  boxSizing: "border-box",
                  borderRadius: 3,
                  border: `2px solid ${checked ? "#1a9fff" : "#6b7480"}`,
                  background: checked ? "#1a9fff" : "transparent",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {checked && <FiCheck size={11} strokeWidth={3} />}
              </div>
            </div>
            <div
              style={{
                position: "relative",
                width: coverWidth,
                height: "100%",
                flexShrink: 0,
              }}
            >
              {coverBlock}
            </div>
          </div>
        )
      }
      title={
        <>
          {tags && (
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 2,
                lineHeight: 1,
              }}
            >
              {tags}
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: "normal" }}>
            {game.name}
          </span>
        </>
      }
      // The tags line counts as one of the clamped lines.
      titleLines={tags ? 3 : 2}
    />
  );
};
