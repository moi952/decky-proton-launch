import React from "react";
import { useTranslation } from "react-i18next";
import { FiGift } from "react-icons/fi";
import { ActionButton } from "./ActionButton";
import { useWhatsNew } from "../context/WhatsNewContext";

const versionKey = (version: string) => `v${version.replace(/\./g, "_")}`;

export const WhatsNewBanner: React.FC = () => {
  const { t } = useTranslation("whats_new");
  const { currentVersion, visible, dismiss } = useWhatsNew();

  if (!visible) return null;

  const key = versionKey(currentVersion);
  const title = t(`${key}.title`, { defaultValue: "" });
  const items = t(`${key}.items`, { returnObjects: true, defaultValue: [] }) as string[];

  if (!title || !Array.isArray(items) || items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "16px 14px 14px",
        margin: "0 16px 12px",
        borderRadius: 8,
        background: "#1a2a1a",
        border: "1px solid #4caf50",
      }}
    >
      <FiGift style={{ fontSize: 30, color: "#4caf50", marginBottom: 8 }} />
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        {title}
      </div>
      <ul
        style={{
          textAlign: "left",
          fontSize: 11,
          opacity: 0.85,
          margin: "0 0 14px",
          paddingLeft: 18,
          lineHeight: 1.5,
        }}
      >
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {item}
          </li>
        ))}
      </ul>
      <ActionButton onClick={dismiss} width="100%">
        {t("dismiss")}
      </ActionButton>
    </div>
  );
};
