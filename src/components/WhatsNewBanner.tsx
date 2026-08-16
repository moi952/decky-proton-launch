import React from "react";
import { useTranslation } from "react-i18next";
import { useWhatsNew } from "../context/WhatsNewContext";
import { getWhatsNewVersionKeys } from "../utils/whatsNewVersions";
import { WhatsNewCard } from "./WhatsNewCard";

const versionKey = (version: string) => `v${version.replace(/\./g, "_")}`;

export const WhatsNewBanner: React.FC = () => {
  const { t } = useTranslation("whats_new");
  const { currentVersion, visible, dismiss } = useWhatsNew();

  if (!visible) return null;

  const key = versionKey(currentVersion);
  // No entry for this version (e.g. a release with no user-facing bullet) —
  // don't show a banner pointing at unrelated older history instead.
  if (!getWhatsNewVersionKeys().includes(key)) return null;

  return (
    <div style={{ margin: "0 16px 12px" }}>
      <WhatsNewCard
        initialVersionKey={key}
        dismissLabel={t("dismiss")}
        onDismiss={dismiss}
      />
    </div>
  );
};
