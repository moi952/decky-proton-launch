import React from "react";
import { LaunchStackProvider } from "./LaunchStackContext";
import { FavoritesProvider } from "./FavoritesContext";
import { CustomVariablesProvider } from "./CustomVariablesContext";
import { SettingsProvider } from "./SettingsContext";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <LaunchStackProvider>
    <FavoritesProvider>
      <CustomVariablesProvider>
        <SettingsProvider>{children}</SettingsProvider>
      </CustomVariablesProvider>
    </FavoritesProvider>
  </LaunchStackProvider>
);
