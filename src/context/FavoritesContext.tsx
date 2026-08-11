import React, { createContext, useContext, useEffect, useState } from "react";
import { call } from "@decky/api";

export interface Favorite {
  name: string;
  value: string;
  env?: string;
}

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
    call<[], Favorite[]>("get_favorites")
      .then((data) => setFavorites(data ?? []))
      .catch(() => {});
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
