import React from "react";
import { LaunchStackProvider } from "./LaunchStackContext";
import { FavoritesProvider } from "./FavoritesContext";
import { CustomVariablesProvider } from "./CustomVariablesContext";
import { SettingsProvider } from "./SettingsContext";
import { RemoteDataProvider } from "./RemoteDataContext";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <RemoteDataProvider>
    <LaunchStackProvider>
      <FavoritesProvider>
        <CustomVariablesProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </CustomVariablesProvider>
      </FavoritesProvider>
    </LaunchStackProvider>
  </RemoteDataProvider>
);
