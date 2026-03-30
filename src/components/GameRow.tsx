import React, { useState, useEffect } from "react";
import { DialogButton } from "@decky/ui";
import { call } from "@decky/api";
import { FaCog, FaSteam } from "react-icons/fa";
import { SteamGame } from "../data/types";
import { BadgeIcon } from "./BadgeIcon";
import { getCachedCover, setCachedCover } from "../utils/coverCache";

export const GAME_ROW_STYLES = `
  .plch-game-row:focus {
    outline: 2px solid #dcdedf !important;
    outline-offset: 0px !important;
    background: #2a3a4a !important;
  }
  .plch-val-btn:focus {
    border: 2px solid #fff !important;
    color: #fff !important;
  }
`;

interface GameRowProps {
  game: SteamGame;
  hasProfile: boolean;
  nowPlaying?: boolean;
  profileStatus?: "configured" | "ready";
  onClick: () => void;
}

export const GameRow: React.FC<GameRowProps> = ({
  game,
  hasProfile,
  nowPlaying,
  profileStatus,
  onClick,
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

  const border = nowPlaying ? "1px solid #4caf50" : "2px solid transparent";
  const background = nowPlaying ? "#0d1f0d" : "#1a1a2e";

  return (
    <div style={{ marginBottom: "4px" }}>
      <DialogButton
        className="plch-game-row"
        onClick={onClick}
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "6px",
          border,
          background,
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 80,
            minHeight: 37,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{ position: "absolute", inset: 0, background: "#2a2a3e" }}
            />
          )}
          {!game.is_shortcut && (
            <div style={{ position: "absolute", top: 3, left: 3 }}>
              <BadgeIcon
                icon={FaSteam}
                color="rgba(255,255,255,0.4)"
                size={8}
              />
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
        </div>
        <div
          style={{
            padding: "0 8px",
            fontSize: 11,
            color: "#fff",
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              textAlign: "left",
            }}
          >
            {game.name}
          </span>
        </div>
      </DialogButton>
    </div>
  );
};
