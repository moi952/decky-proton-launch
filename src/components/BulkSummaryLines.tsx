import React from "react";
import { useTranslation } from "react-i18next";
import { BulkSummary } from "../utils/bulkApply";

// The end-of-run tally shared by the bulk page and the group page.
export const BulkSummaryLines: React.FC<{ summary: BulkSummary }> = ({
  summary,
}) => {
  const { t } = useTranslation("bulk_apply");
  return (
    <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
      {summary.done > 0 && (
        <div>{t("summary_done", { count: summary.done })}</div>
      )}
      {summary.removed > 0 && (
        <div>{t("summary_removed", { count: summary.removed })}</div>
      )}
      {summary.unchanged > 0 && (
        <div>{t("summary_unchanged", { count: summary.unchanged })}</div>
      )}
      {summary.conflicts.length > 0 && (
        <div style={{ color: "#f5a623" }}>
          {t("summary_conflict", { count: summary.conflicts.length })}
          <div style={{ fontSize: 11, color: "#aaa" }}>
            {t("conflict_hint")}
          </div>
        </div>
      )}
      {summary.errors > 0 && (
        <div style={{ color: "#ff5555" }}>
          {t("summary_error", { count: summary.errors })}
        </div>
      )}
      {summary.cancelled > 0 && (
        <div style={{ color: "#aaa" }}>
          {t("summary_cancelled", { count: summary.cancelled })}
        </div>
      )}
    </div>
  );
};
