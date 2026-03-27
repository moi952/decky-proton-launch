import React from "react";
import PanelSectionCustom from "./PanelSectionCustom";
import { GameRow, SteamGame } from "../views/GamesPickerView";

interface NowPlayingCardProps {
  game: SteamGame;
  onSelect: () => void;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ game, onSelect }) => (
  <PanelSectionCustom>
    <GameRow
      game={game}
      hasProfile={false}
      isRunning={true}
      onClick={onSelect}
    />
  </PanelSectionCustom>
);
