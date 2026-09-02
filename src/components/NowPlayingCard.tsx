import React from "react";
import PanelSectionCustom from "./PanelSectionCustom";
import { GameRow } from "./GameRow";
import { SteamGame } from "../data/types";

interface NowPlayingCardProps {
  game: SteamGame;
  onSelect: () => void;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  game,
  onSelect,
}) => (
  <PanelSectionCustom>
    <GameRow game={game} nowPlaying={true} onClick={onSelect} />
  </PanelSectionCustom>
);
