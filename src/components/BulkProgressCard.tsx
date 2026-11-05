import React from "react";
import { Focusable } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@moi952/decky-ui-kit";
import {
  FiAlertTriangle,
  FiCheck,
  FiCircle,
  FiLoader,
  FiMinus,
  FiX,
} from "react-icons/fi";
import PanelSectionCustom from "./PanelSectionCustom";
import { BulkRow, BulkStatus } from "../utils/bulkApply";

// Rows visible at once — the window follows the game being processed, so the
// list scrolls by itself while the counter shows how many are left.
const VISIBLE_ROWS = 8;
const ROW_HEIGHT = 26;

const STATUS_COLOR: Record<BulkStatus, string> = {
  pending: "#777",
  running: "#1a9fff",
  done: "#4caf50",
  removed: "#4caf50",
  unchanged: "#999",
  conflict: "#f5a623",
  error: "#ff5555",
  cancelled: "#777",
};

const STATUS_ICON: Record<BulkStatus, React.ReactNode> = {
  pending: <FiCircle size={13} />,
  running: (
    <FiLoader size={13} style={{ animation: "plch-spin 1s linear infinite" }} />
  ),
  done: <FiCheck size={13} />,
  removed: <FiCheck size={13} />,
  unchanged: <FiMinus size={13} />,
  conflict: <FiAlertTriangle size={13} />,
  error: <FiX size={13} />,
  cancelled: <FiMinus size={13} />,
};

interface BulkProgressCardProps {
  title: string;
  rows: BulkRow[];
  running: boolean;
  cancelling: boolean;
  onCancel: () => void;
}

export const BulkProgressCard: React.FC<BulkProgressCardProps> = ({
  title,
  rows,
  running,
  cancelling,
  onCancel,
}) => {
  const { t } = useTranslation("bulk_apply");
  const { t: tCommon } = useTranslation("common");

  const processed = rows.filter(
    (r) => r.status !== "pending" && r.status !== "running",
  ).length;

  const runningIndex = rows.findIndex((r) => r.status === "running");
  const pendingIndex = rows.findIndex((r) => r.status === "pending");
  const focusIndex =
    runningIndex >= 0
      ? runningIndex
      : pendingIndex >= 0
        ? pendingIndex
        : rows.length - 1;
  const start = Math.min(
    Math.max(0, focusIndex - 3),
    Math.max(0, rows.length - VISIBLE_ROWS),
  );
  const visible = rows.slice(start, start + VISIBLE_ROWS);
  const percent = rows.length
    ? Math.round((processed / rows.length) * 100)
    : 100;

  return (
    <PanelSectionCustom>
      <style>{`@keyframes plch-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 12, color: "#aaa", flexShrink: 0 }}>
          {processed} / {rows.length}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "#2a2f36",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: "#1a9fff",
            transition: "width 0.2s",
          }}
        />
      </div>
      <div
        style={{
          background: "#14181d",
          borderRadius: 6,
          padding: "2px 8px",
          minHeight: Math.min(rows.length, VISIBLE_ROWS) * ROW_HEIGHT,
        }}
      >
        {visible.map((row) => (
          <div
            key={row.appid}
            style={{
              height: ROW_HEIGHT,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              opacity: row.status === "pending" ? 0.6 : 1,
            }}
          >
            <span
              style={{
                color: STATUS_COLOR[row.status],
                display: "flex",
                flexShrink: 0,
              }}
            >
              {STATUS_ICON[row.status]}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.name}
            </span>
            <span
              style={{
                color: STATUS_COLOR[row.status],
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {t(`status_${row.status}`)}
            </span>
          </div>
        ))}
      </div>
      {running && (
        <Focusable style={{ marginTop: 8 }}>
          <ActionButton onClick={onCancel} width="100%" disabled={cancelling}>
            {cancelling ? t("cancelling") : tCommon("cancel")}
          </ActionButton>
        </Focusable>
      )}
    </PanelSectionCustom>
  );
};
