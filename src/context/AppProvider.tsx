import React from "react";
import { LaunchStackProvider } from "./LaunchStackContext";
import { FavoritesProvider } from "./FavoritesContext";
import { CustomVariablesProvider } from "./CustomVariablesContext";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <LaunchStackProvider>
    <FavoritesProvider>
      <CustomVariablesProvider>{children}</CustomVariablesProvider>
    </FavoritesProvider>
  </LaunchStackProvider>
);
