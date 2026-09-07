import React from "react";
import { WhatsNewProvider, OtherPluginsProvider, PluginUpdateProvider } from "@moi952/decky-plugin-toolkit";
import { LaunchStackProvider } from "./LaunchStackContext";
import { FavoritesProvider } from "./FavoritesContext";
import { CustomVariablesProvider } from "./CustomVariablesContext";
import { CustomWrappersProvider } from "./CustomWrappersContext";
import { SettingsProvider } from "./SettingsContext";
import { RemoteDataProvider } from "./RemoteDataContext";
import { SELF_PLUGIN_ID } from "../utils/otherPlugins";
import { CURRENT_VERSION } from "../utils/githubReleases";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <RemoteDataProvider>
    <LaunchStackProvider>
      <FavoritesProvider>
        <CustomVariablesProvider>
          <CustomWrappersProvider>
            <SettingsProvider>
              <WhatsNewProvider currentVersion={CURRENT_VERSION}>
                <OtherPluginsProvider selfPluginId={SELF_PLUGIN_ID}>
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
