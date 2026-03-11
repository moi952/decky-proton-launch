import React, { createContext, useContext, useEffect, useState } from "react";

export interface Favorite {
  name: string;
  value: string;
  env?: string;
}

const STORAGE_KEY = "deck-proton-launch-favorites";

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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  const save = (favs: Favorite[]) => {
    setFavorites(favs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    } catch {}
  };

  const addFavorite = (fav: Favorite) => {
    if (favorites.some((f) => f.name === fav.name)) return false;
    save([...favorites, fav]);
    return true;
  };

  const removeFavorite = (name: string) => {
    save(favorites.filter((f) => f.name !== name));
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
