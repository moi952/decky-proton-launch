import React, { useState, useEffect } from "react";
import { MediaRow } from "@moi952/decky-ui-kit";
import { call } from "@decky/api";
import { FaCog, FaSteam } from "react-icons/fa";
import { FiLink } from "react-icons/fi";
import { SteamGame } from "../data/types";
import { BadgeIcon } from "./BadgeIcon";
import { getCachedCover, setCachedCover } from "../utils/coverCache";

// Steam's own "Header Capsule" artwork ratio (460×215, or 920×430 at 2x) —
// the same aspect ratio a game's cover renders at everywhere else in the
// Steam client's own UI. Height is derived from it rather than a
// hand-picked number, so it stays correct if the row's width ever changes.
const COVER_WIDTH = 80;
const STEAM_HEADER_CAPSULE_RATIO = 215 / 460;
const COVER_HEIGHT = Math.round(COVER_WIDTH * STEAM_HEADER_CAPSULE_RATIO);

interface GameRowProps {
  game: SteamGame;
  hasProfile: boolean;
  nowPlaying?: boolean;
  profileStatus?: "configured" | "ready";
  onClick: () => void;
  hasWrapper?: boolean;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
}

export const GameRow: React.FC<GameRowProps> = ({
  game,
  hasProfile,
  nowPlaying,
  profileStatus,
  onClick,
  hasWrapper,
  onQuickAdd,
  quickAddLabel,
}) => {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedCover(game.appid);
    if (cached !== undefined) {
      if (cached) setCover(cached);
      return;
    }
    call<[number], string>("get_game_cover", game.appid).then((url) => {
      if (url) {
        setCachedCover(game.appid, url);
        setCover(url);
      }
    });
  }, [game.appid]);

  // Wrapper-only badge: shown when wrapper is set but there is no profile
  const showWrapperBadge = hasWrapper && !hasProfile;

  return (
    <MediaRow
      onPress={onClick}
      onSecondaryButton={onQuickAdd ? () => onQuickAdd() : undefined}
      onSecondaryActionDescription={onQuickAdd ? quickAddLabel : undefined}
      spacing={4}
      // Same border width in both states so a row's size never shifts
      // depending on whether it's now playing — "success" gives the
      // green border+tinted background, "light" is the plain default
      // card look otherwise.
      color={nowPlaying ? "success" : "light"}
      accentBorderWidth={2}
      mediaLayout="stretch"
      mediaHeight={COVER_HEIGHT}
      media={
        <>
          {cover ? (
            // No fixed width, no object-fit:cover — the box is exactly
            // COVER_HEIGHT tall and the image renders at its own natural
            // aspect ratio, so it always shows in full, never cropped.
            <img
              src={cover}
              alt=""
              style={{ height: "100%", width: "auto", display: "block" }}
            />
          ) : (
            <div style={{ width: COVER_WIDTH, height: "100%", background: "#2a2a3e" }} />
          )}
          {!game.is_shortcut && (
            <div style={{ position: "absolute", top: 3, left: 3 }}>
              <BadgeIcon icon={FaSteam} color="rgba(255,255,255,0.4)" size={8} />
            </div>
          )}
          {hasProfile && (
            <div style={{ position: "absolute", bottom: 3, left: 3 }}>
              <BadgeIcon
                icon={FaCog}
                color={profileStatus === "ready" ? "#4caf50" : "#f5a623"}
              />
            </div>
          )}
          {showWrapperBadge && (
            <div style={{ position: "absolute", bottom: 3, left: 3 }}>
              <BadgeIcon icon={FiLink} color="#29b6f6" size={8} />
            </div>
          )}
        </>
      }
      title={
        <span style={{ fontSize: 11, fontWeight: "normal" }}>{game.name}</span>
      }
      titleLines={2}
    />
  );
};
