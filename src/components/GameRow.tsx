import React, { useState, useEffect } from "react";
import { DialogButton } from "@decky/ui";
import { call } from "@decky/api";
import { SteamGame } from "../data/types";

export const GAME_ROW_STYLES = `
  .plch-game-row:focus {
    border: 2px solid #dcdedf !important;
    background: #2a3a4a !important;
  }
  .plch-val-btn:focus {
    border: 2px solid #fff !important;
    color: #fff !important;
  }
`;

const COVER_URL = (appid: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

interface GameRowProps {
  game: SteamGame;
  hasProfile: boolean;
  isRunning: boolean;
  nowPlaying?: boolean;
  onClick: () => void;
}

export const GameRow: React.FC<GameRowProps> = ({ game, hasProfile, isRunning, nowPlaying, onClick }) => {
  const [shortcutCover, setShortcutCover] = useState<string | null>(null);

  useEffect(() => {
    if (!game.is_shortcut) return;
    call<[number], string>("get_shortcut_cover", game.appid).then((url) => {
      if (url) setShortcutCover(url);
    });
  }, [game.appid, game.is_shortcut]);

  const border = nowPlaying ? "2px solid #4caf50" : hasProfile ? "2px solid #f5a623" : "2px solid transparent";
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
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={{ position: "relative", width: 80, height: 37, flexShrink: 0 }}>
          {game.is_shortcut && shortcutCover ? (
            <img
              src={shortcutCover}
              alt=""
              style={{ width: 80, height: 37, objectFit: "cover", display: "block" }}
            />
          ) : game.is_shortcut ? (
            <div
              style={{
                width: 80,
                height: 37,
                background: "#2a2a3e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: "#666",
              }}
            >
              Non-Steam
            </div>
          ) : (
            <img
              src={COVER_URL(game.appid)}
              alt=""
              style={{ width: 80, height: 37, objectFit: "cover", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {(hasProfile || isRunning) && (
            <div
              style={{
                position: "absolute",
                bottom: 3,
                left: 3,
                display: "flex",
                gap: "3px",
              }}
            >
              {hasProfile && (
                <span
                  style={{
                    background: "rgba(0,0,0,0.65)",
                    borderRadius: "3px",
                    padding: "1px 3px",
                    fontSize: 10,
                    lineHeight: 1,
                    color: "#f5a623",
                  }}
                >
                  ⚙
                </span>
              )}
              {isRunning && (
                <span
                  style={{
                    background: "rgba(0,0,0,0.65)",
                    borderRadius: "3px",
                    padding: "1px 3px",
                    fontSize: 10,
                    lineHeight: 1,
                    color: "#4caf50",
                  }}
                >
                  ▶
                </span>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "4px 8px",
            fontSize: 12,
            color: "#fff",
            flex: 1,
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
