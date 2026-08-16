import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import { readLegacyArray, pruneLegacyArray } from "../utils/legacyStorage";

export interface Favorite {
  name: string;
  value: string;
  env?: string;
}

// Pre-0.10 localStorage key, migrated below.
const LEGACY_KEY = "deck-proton-launch-favorites";

interface FavoritesContextValue {
  favorites: Favorite[];
  addFavorite: (fav: Favorite) => boolean;
  removeFavorite: (name: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    // Merge legacy entries missing by name, then prune the ones now
    // confirmed in the backend — otherwise a deleted item that's still in
    // legacy storage gets re-added on every remount.
    const mergeLegacy = (current: Favorite[]) => {
      const legacy = readLegacyArray<Favorite>(LEGACY_KEY) ?? [];
      if (legacy.length === 0) {
        setFavorites(current);
        return;
      }

      const existingNames = new Set(current.map((f) => f.name));
      const missing = legacy.filter((f) => !existingNames.has(f.name));
      const merged = [...current, ...missing];
      setFavorites(merged);

      const legacyNames = legacy.map((f) => f.name);
      if (missing.length === 0) {
        pruneLegacyArray(LEGACY_KEY, legacyNames);
      } else {
        call<[Favorite[]], boolean>("set_favorites", merged)
          .then(() => pruneLegacyArray(LEGACY_KEY, legacyNames))
          .catch(() => {});
      }
    };

    call<[], Favorite[]>("get_favorites")
      .then((data) => mergeLegacy(data ?? []))
      .catch(() => mergeLegacy([]));
  }, []);

  const persist = (favs: Favorite[]) => {
    setFavorites(favs);
    call<[Favorite[]], boolean>("set_favorites", favs).catch(() => {});
  };

  const addFavorite = (fav: Favorite) => {
    if (favorites.some((f) => f.name === fav.name)) return false;
    persist([...favorites, fav]);
    return true;
  };

  const removeFavorite = (name: string) => {
    persist(favorites.filter((f) => f.name !== name));
  };

  return (
    <FavoritesContext.Provider
      value={{ favorites, addFavorite, removeFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within AppProvider");
  return ctx;
};
