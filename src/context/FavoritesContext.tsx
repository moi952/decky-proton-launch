import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";
import { readLegacyArray } from "../utils/legacyStorage";

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
    // Merge legacy entries missing by name; runs on backend fetch failure too.
    const mergeLegacy = (current: Favorite[]) => {
      const legacy = readLegacyArray<Favorite>(LEGACY_KEY) ?? [];
      const existingNames = new Set(current.map((f) => f.name));
      const missing = legacy.filter((f) => !existingNames.has(f.name));
      setFavorites([...current, ...missing]);
      if (missing.length > 0) {
        call<[Favorite[]], boolean>("set_favorites", [
          ...current,
          ...missing,
        ]).catch(() => {});
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
