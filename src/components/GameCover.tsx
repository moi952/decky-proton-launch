import React, { useState, useEffect } from "react";
import { call } from "@decky/api";
import { SteamGame } from "../data/types";

const COVER_URL = (appid: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

interface GameCoverProps {
  game: SteamGame;
}

export const GameCover: React.FC<GameCoverProps> = ({ game }) => {
  const [shortcutCover, setShortcutCover] = useState<string | null>(null);

  useEffect(() => {
    if (!game.is_shortcut) return;
    call<[number], string>("get_shortcut_cover", game.appid).then((url) => {
      if (url) setShortcutCover(url);
    });
  }, [game.appid, game.is_shortcut]);

  const src = game.is_shortcut ? shortcutCover : COVER_URL(game.appid);
  if (!src) return null;

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <img
        src={src}
        alt=""
        style={{ width: "100%", borderRadius: "6px", display: "block" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
};
