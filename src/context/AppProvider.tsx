import React from "react";
import { LaunchStackProvider } from "./LaunchStackContext";
import { FavoritesProvider } from "./FavoritesContext";
import { CustomVariablesProvider } from "./CustomVariablesContext";
import { CustomWrappersProvider } from "./CustomWrappersContext";
import { SettingsProvider } from "./SettingsContext";
import { RemoteDataProvider } from "./RemoteDataContext";
import { WhatsNewProvider } from "./WhatsNewContext";
import { OtherPluginsProvider } from "./OtherPluginsContext";
import { PluginUpdateProvider } from "./PluginUpdateContext";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <RemoteDataProvider>
    <LaunchStackProvider>
      <FavoritesProvider>
        <CustomVariablesProvider>
          <CustomWrappersProvider>
            <SettingsProvider>
              <WhatsNewProvider>
                <OtherPluginsProvider>
                  <PluginUpdateProvider>{children}</PluginUpdateProvider>
                </OtherPluginsProvider>
              </WhatsNewProvider>
            </SettingsProvider>
          </CustomWrappersProvider>
        </CustomVariablesProvider>
      </FavoritesProvider>
    </LaunchStackProvider>
  </RemoteDataProvider>
);
