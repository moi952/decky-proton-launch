import React, { useState } from "react";
import {
  Focusable,
  GamepadButton,
  PanelSection,
  PanelSectionRow,
  ToggleField,
} from "@decky/ui";
import type { GamepadEvent } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { InlineConfirm } from "./InlineConfirm";
import { VariableRow } from "./VariableRow";
import { useFavorites } from "../context/FavoritesContext";
import { ConflictRule } from "../context/RemoteDataContext";
import { Variable } from "../data/types";

interface FavoritesPanelSectionProps {
  allVariables: Variable[];
  isActive: (env: string) => boolean;
  getValue: (env: string, defaultValue: string) => string;
  onToggle: (env: string, defaultValue: string) => void;
  onValueChange: (env: string, value: string) => void;
  onDeactivate: (env: string) => void;
  conflictGroups?: ConflictRule[];
  envToTitle?: Record<string, string>;
  getDescription?: (env: string) => React.ReactNode;
}

// Favorites block shared by the game page and the global commands page.
export const FavoritesPanelSection: React.FC<FavoritesPanelSectionProps> = ({
  allVariables,
  isActive,
  getValue,
  onToggle,
  onValueChange,
  onDeactivate,
  conflictGroups,
  envToTitle,
  getDescription,
}) => {
  const { t: tCat } = useTranslation("categories");
  const { t: tCommon } = useTranslation("common");
  const { t: tFavModal } = useTranslation("delete_favorite_modal");
  const { favorites, removeFavorite } = useFavorites();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const withEnv = favorites.filter((f) => f.env);
  if (!withEnv.length) return null;

  return (
    <PanelSection title={tCat("favorites")}>
      {withEnv.map((fav) => {
        if (pendingDelete === fav.name) {
          return (
            <PanelSectionRow key={fav.name}>
              <InlineConfirm
                description={tFavModal("description", {
                  favorite_name: fav.name,
                })}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => {
                  removeFavorite(fav.name);
                  setPendingDelete(null);
                }}
              />
            </PanelSectionRow>
          );
        }

        const catalogVar = allVariables.find((v) => v.env === fav.env);

        return (
          <Focusable
            key={fav.name}
            onButtonDown={(evt: GamepadEvent) => {
              if (evt.detail.button === GamepadButton.SECONDARY)
                setPendingDelete(fav.name);
            }}
            onSecondaryActionDescription={tCommon("remove_from_favorite")}
          >
            {catalogVar ? (
              <VariableRow
                variable={catalogVar}
                isActive={isActive}
                getValue={getValue}
                onToggle={onToggle}
                onValueChange={onValueChange}
                onDeactivate={onDeactivate}
                conflictGroups={conflictGroups}
                envToTitle={envToTitle}
                description={getDescription?.(fav.env!)}
              />
            ) : (
              <PanelSectionRow>
                <ToggleField
                  label={fav.name}
                  checked={isActive(fav.env!)}
                  onChange={() => onToggle(fav.env!, fav.value)}
                />
              </PanelSectionRow>
            )}
          </Focusable>
        );
      })}
    </PanelSection>
  );
};
