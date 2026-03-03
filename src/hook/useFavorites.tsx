import { useState, useEffect } from "react";

export interface Favorite {
  name: string;
  value: string;
  env?: string;
  custom?: boolean;
}

const STORAGE_KEY = "deck-proton-launch-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  const saveFavorites = (newFavs: Favorite[]) => {
    setFavorites(newFavs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavs));
    } catch {}
  };

  const addFavorite = (fav: Favorite) => {
    if (favorites.some((f) => f.name === fav.name)) return false;
    saveFavorites([...favorites, fav]);
    return true;
  };

  const removeFavorite = (name: string) => {
    saveFavorites(favorites.filter((f) => f.name !== name));
  };

  return { favorites, addFavorite, removeFavorite };
}
