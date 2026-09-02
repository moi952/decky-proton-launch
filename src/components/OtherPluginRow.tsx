import React, { useState } from "react";
import { Navigation } from "@decky/ui";
import { toaster } from "@decky/api";
import { useTranslation } from "react-i18next";
import { ActionButton, CollapsibleSection } from "@moi952/decky-ui-kit";
import { OtherPluginEntry, localizedDescription } from "../utils/otherPlugins";
import { fetchLatestReleaseFor, installPlugin, PluginInstallType } from "../utils/deckyInstall";

interface OtherPluginRowProps {
  plugin: OtherPluginEntry;
}

// One entry in the "My other plugins" Settings list — collapsed to just
// the plugin's name; expanding it reveals a full-width screenshot, its
// description, and two actions: install its latest release directly (same
// native installer the Decky Store itself uses — see deckyInstall.ts), or
// view it on GitHub. Always installs fresh (PluginInstallType.INSTALL):
// this plugin has no way to know whether the user already has the other
// one installed or which version, so there's no real "update"/"reinstall"
// distinction to make here — Decky's own install flow handles either case
// fine regardless of which enum value labels its confirm dialog.
export const OtherPluginRow: React.FC<OtherPluginRowProps> = ({ plugin }) => {
  const { t, i18n } = useTranslation("other_plugins");
  const [expanded, setExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);

  const install = async () => {
    setInstalling(true);
    try {
      const release = await fetchLatestReleaseFor(plugin.url);
      if (!release || !release.asset_url) throw new Error("no_release");
      await installPlugin(
        release.asset_url,
        plugin.name,
        release.version,
        release.sha256,
        PluginInstallType.INSTALL,
      );
    } catch {
      toaster.toast({ title: plugin.name, body: t("install_failed") });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <CollapsibleSection label={plugin.name} expanded={expanded} onToggle={() => setExpanded((v) => !v)}>
      <div style={{ padding: "8px 0 4px" }}>
        <img
          src={plugin.icon}
          alt=""
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, marginBottom: 8 }}
        />
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
          {localizedDescription(plugin, i18n.language)}
        </div>
        <div style={{ marginBottom: 6 }}>
          <ActionButton onClick={install} disabled={installing} width="100%">
            {installing ? t("installing") : t("install_latest")}
          </ActionButton>
        </div>
        <ActionButton onClick={() => Navigation.NavigateToExternalWeb(plugin.url)} width="100%">
          {t("view_on_github")}
        </ActionButton>
      </div>
    </CollapsibleSection>
  );
};
