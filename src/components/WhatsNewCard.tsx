import React, { useState } from "react";
import { Focusable } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { FiChevronLeft, FiChevronRight, FiGift } from "react-icons/fi";
import { ActionButton } from "@moi952/decky-ui-kit";
import { getWhatsNewVersionKeys } from "../utils/whatsNewVersions";

interface WhatsNewCardProps {
  initialVersionKey?: string;
  dismissLabel?: string;
  onDismiss?: () => void;
}

// Shared by the home banner and the Settings history collapse — same
// content, same prev/next paging. Only the banner passes dismissLabel/
// onDismiss for the bottom "Compris" button.
export const WhatsNewCard: React.FC<WhatsNewCardProps> = ({
  initialVersionKey,
  dismissLabel,
  onDismiss,
}) => {
  const { t } = useTranslation("whats_new");
  const [versions] = useState(getWhatsNewVersionKeys);
  const [index, setIndex] = useState(() => {
    const i = initialVersionKey ? versions.indexOf(initialVersionKey) : 0;
    return i >= 0 ? i : 0;
  });

  if (versions.length === 0) return null;

  const key = versions[index];
  const title = t(`${key}.title`);
  const items = t(`${key}.items`, { returnObjects: true, defaultValue: [] }) as string[];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "16px 14px 14px",
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

      {versions.length > 1 && (
        <Focusable
          style={{
            display: "flex",
            width: "100%",
            gap: 8,
            marginBottom: dismissLabel && onDismiss ? 10 : 0,
          }}
          flow-children="horizontal"
        >
          <div style={{ flex: 1 }}>
            <ActionButton
              width="100%"
              disabled={index === versions.length - 1}
              onClick={() => setIndex((i) => Math.min(i + 1, versions.length - 1))}
            >
              <FiChevronLeft size={12} style={{ marginRight: 4 }} />
              {t("older")}
            </ActionButton>
          </div>
          <div style={{ flex: 1 }}>
            <ActionButton
              width="100%"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            >
              {t("newer")}
              <FiChevronRight size={12} style={{ marginLeft: 4 }} />
            </ActionButton>
          </div>
        </Focusable>
      )}

      {dismissLabel && onDismiss && (
        <ActionButton onClick={onDismiss} width="100%">
          {dismissLabel}
        </ActionButton>
      )}
    </div>
  );
};
