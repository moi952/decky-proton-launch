import React from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, StatusCard } from "@moi952/decky-ui-kit";
import { FiPackage } from "react-icons/fi";
import { useOtherPlugins } from "../context/OtherPluginsContext";
import { useWhatsNew } from "../context/WhatsNewContext";
import { localizedDescription } from "../utils/otherPlugins";

interface OtherPluginsBannerProps {
  onOpenSettings: () => void;
}

export const OtherPluginsBanner: React.FC<OtherPluginsBannerProps> = ({
  onOpenSettings,
}) => {
  const { t, i18n } = useTranslation("other_plugins");
  const { newOnes, dismissNew } = useOtherPlugins();
  // What's New takes priority — never both banners competing for space
  // at once.
  const { visible: whatsNewVisible } = useWhatsNew();

  if (whatsNewVisible || newOnes.length === 0) return null;

  return (
    <div style={{ margin: "0 16px 12px" }}>
      <StatusCard variant="info" icon={<FiPackage />} title={t("banner_title", { count: newOnes.length })}>
        {/* Plain text, no image/MediaRow here — the full presentation
            (photo, install/GitHub buttons) lives in the Settings list this
            banner links to; this is just "here's what's new", not a second
            copy of that UI. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginBottom: 10, textAlign: "left" }}>
          {newOnes.map((plugin) => (
            <div key={plugin.id}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{plugin.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                {localizedDescription(plugin, i18n.language)}
              </div>
            </div>
          ))}
        </div>
        {/* Marks the notification as seen the moment the user actually acts
            on it — going to the Settings list (where they can install each
            one) already IS the acknowledgment, no separate plain "Compris"
            needed on top of it. */}
        <ActionButton
          onClick={() => {
            dismissNew();
            onOpenSettings();
          }}
          width="100%"
        >
          {t("open_settings")}
        </ActionButton>
      </StatusCard>
    </div>
  );
};
