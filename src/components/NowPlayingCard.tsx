import React from "react";
import { DialogButton } from "@decky/ui";
import PanelSectionCustom from "./PanelSectionCustom";
import { SteamGame } from "../views/GamesPickerView";

interface NowPlayingCardProps {
  game: SteamGame;
  onSelect: () => void;
}

const COVER_URL = (appid: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ game, onSelect }) => (
  <PanelSectionCustom>
    <DialogButton
      onClick={onSelect}
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: "6px",
        border: "2px solid #4caf50",
        background: "#0d1f0d",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
      }}
    >
      {!game.is_shortcut && (
        <img
          src={COVER_URL(game.appid)}
          alt=""
          style={{ width: 80, height: 37, flexShrink: 0, objectFit: "cover", display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div
        style={{
          padding: "4px 8px",
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          overflow: "hidden",
        }}
      >
        <span style={{ color: "#4caf50", fontSize: 8, flexShrink: 0 }}>●</span>
        <span
          style={{
            fontSize: 11,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {game.name}
        </span>
      </div>
    </DialogButton>
  </PanelSectionCustom>
);
