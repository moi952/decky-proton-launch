import React, { useState } from "react";
import { Focusable } from "@decky/ui";
import { ActionButton, TabBar, TabBarItem } from "@moi952/decky-ui-kit";
import {
  BackHandler,
  OtherPluginsBanner,
  PluginUpdateBanner,
  WhatsNewBanner,
  featureRequestFocus,
  getWhatsNewVersions,
  otherPluginsFocus,
  pluginUpdateFocus,
  usePluginUpdate,
} from "@moi952/decky-plugin-toolkit";
import { useTranslation } from "react-i18next";
import {
  FiCopy,
  FiGlobe,
  FiLayers,
  FiList,
  FiPlay,
  FiSettings,
} from "react-icons/fi";
import { GAME_GROUP_HEADER_STYLES } from "./GameGroupHeader";
import { NowPlayingCard } from "./NowPlayingCard";
import PanelSectionCustom from "./PanelSectionCustom";
import { useRemoteData } from "../context/RemoteDataContext";
import { ScriptStatus, SteamGame } from "../data/types";
import { BulkPayload } from "../utils/bulkApply";
import { copy } from "../utils/functions";
import { GamesPickerView } from "../views/GamesPickerView";
import { GlobalCommandsView } from "../views/GlobalCommandsView";
import { GroupsView } from "../views/GroupsView";
import ListCommandsView from "../views/ListCommandsView";
import { SettingsView } from "../views/SettingsView";
import type { CleanPayload } from "../views/CleanLaunchOptionsView";

const LAUNCH_OPTION = "~/.config/decky-proton-launch/proton-launch %command%";

export type MainView =
  "home" | "games-picker" | "global-commands" | "groups" | "settings";

const MAIN_VIEWS: string[] = [
  "home",
  "games-picker",
  "global-commands",
  "groups",
  "settings",
];

export const isMainView = (view: string): view is MainView =>
  MAIN_VIEWS.includes(view);

interface TabbedMainProps {
  view: MainView;
  onShowView: (view: MainView) => void;
  isOnHome: boolean;
  hideVariablesPage: boolean;
  scriptStatus: ScriptStatus;
  onScriptInstalled: () => void;
  runningGame: SteamGame | null;
  onSelectGame: (game: SteamGame) => void;
  onGoHome: () => void;
  onBulkApply: (payload: BulkPayload) => void;
  onCleanOptions: (payload: CleanPayload) => void;
}

// The same pages as the icon bar, behind an icon tab bar flanked by L1 / R1.
// Only mounted when the "tab navigation" setting is on — the regular layout is
// untouched.
export const TabbedMain: React.FC<TabbedMainProps> = ({
  view,
  onShowView,
  isOnHome,
  hideVariablesPage,
  scriptStatus,
  onScriptInstalled,
  runningGame,
  onSelectGame,
  onGoHome,
  onBulkApply,
  onCleanOptions,
}) => {
  const { t } = useTranslation();
  const { t: tGames } = useTranslation("game_manager");
  const { t: tGroups } = useTranslation("command_groups");
  const { t: tSettings } = useTranslation("settings_view");
  const { noData } = useRemoteData();
  const { info: pluginUpdateInfo } = usePluginUpdate();
  const whatsNewVersions = getWhatsNewVersions();
  const [showCommand, setShowCommand] = useState(false);

  const nowPlaying = runningGame && (
    <NowPlayingCard
      game={runningGame}
      onSelect={() => onSelectGame(runningGame)}
    />
  );

  const tabs: (TabBarItem & { content: React.ReactNode })[] = [
    ...(hideVariablesPage
      ? []
      : [
          {
            id: "home",
            icon: <FiList size={18} />,
            label: tSettings("default_home_vars"),
            content: (
              <>
                {nowPlaying}
                <ListCommandsView />
              </>
            ),
          },
        ]),
    {
      id: "games-picker",
      icon: <FiPlay size={18} />,
      label: tGames("title"),
      content: (
        <>
          {nowPlaying}
          <GamesPickerView
            onSelectGame={onSelectGame}
            onScriptInstalled={onScriptInstalled}
          />
        </>
      ),
    },
    {
      id: "global-commands",
      icon: <FiGlobe size={18} />,
      label: tGames("global_commands"),
      content: <GlobalCommandsView onBulkApply={onBulkApply} />,
    },
    {
      id: "groups",
      icon: <FiLayers size={18} />,
      label: tGroups("title"),
      content: (
        <GroupsView onApply={onBulkApply} onCleanOptions={onCleanOptions} />
      ),
    },
    {
      id: "settings",
      icon: <FiSettings size={18} />,
      label: tSettings("settings"),
      content: <SettingsView />,
    },
  ];

  // The default home may be hidden: never ask for a tab that isn't there.
  const active = tabs.find((tab) => tab.id === view) ?? tabs[0];

  return (
    <BackHandler onBack={isOnHome ? undefined : onGoHome}>
      <style>{GAME_GROUP_HEADER_STYLES}</style>
      <TabBar
        items={tabs}
        activeId={active.id}
        onSelect={(id) => onShowView(id as MainView)}
      >
        <PanelSectionCustom>
          <Focusable
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            flow-children="horizontal"
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                alignSelf: "center",
                fontWeight: 600,
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              {active.label}
            </span>
            {scriptStatus === "outdated" && (
              <span style={{ color: "#f5a623", fontSize: 14, lineHeight: 1 }}>
                ⚠
              </span>
            )}
            <ActionButton
              onClick={() => copy(LAUNCH_OPTION)}
              onOKActionDescription={tGames("copy")}
              onSecondaryButton={() => setShowCommand((v) => !v)}
              onSecondaryActionDescription={
                showCommand ? tGames("hide_command") : tGames("show_command")
              }
            >
              <FiCopy size={16} />
            </ActionButton>
          </Focusable>
          {showCommand && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                background: "#111",
                padding: "6px 8px",
                borderRadius: "4px",
                color: "#ccc",
                wordBreak: "break-all",
                marginTop: "6px",
              }}
            >
              {LAUNCH_OPTION}
            </div>
          )}
        </PanelSectionCustom>

        <PluginUpdateBanner
          info={pluginUpdateInfo}
          onClick={() => {
            pluginUpdateFocus.markExpanded();
            onShowView("settings");
          }}
        />
        {isOnHome && (
          <WhatsNewBanner
            versions={whatsNewVersions}
            onFeatureRequest={() => {
              featureRequestFocus.markExpanded();
              onShowView("settings");
            }}
          />
        )}
        {isOnHome && (
          <OtherPluginsBanner
            onOpenSettings={() => {
              otherPluginsFocus.markExpanded();
              onShowView("settings");
            }}
          />
        )}
        {noData && (
          <div
            style={{
              margin: "4px 16px 0",
              padding: "6px 10px",
              background: "#3a0000",
              border: "1px solid #c00",
              borderRadius: "6px",
              fontSize: 11,
              color: "#ff6b6b",
            }}
          >
            {t("no_data")}
          </div>
        )}

        {active.content}
      </TabBar>
    </BackHandler>
  );
};
