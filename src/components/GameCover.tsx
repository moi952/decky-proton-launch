import React, { useState, useEffect } from "react";
import { call } from "@decky/api";
import { FaSteam } from "react-icons/fa";
import { SteamGame } from "../data/types";
import { getCachedCover, setCachedCover } from "../utils/coverCache";

interface GameCoverProps {
  game: SteamGame;
}

export const GameCover: React.FC<GameCoverProps> = ({ game }) => {
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

  if (!cover) return null;

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div style={{ position: "relative" }}>
        <img
          src={cover}
          alt=""
          style={{
            width: "100%",
            aspectRatio: "460 / 215",
            objectFit: "cover",
            borderRadius: "6px",
            display: "block",
          }}
        />
        {!game.is_shortcut && (
          <div style={{ position: "absolute", top: 6, left: 6 }}>
            <FaSteam
              size={14}
              style={{
                color: "rgba(255,255,255,0.35)",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
